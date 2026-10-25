-- ==============================================================================
-- Noctis — Database Migration: Validate Import Schedule Date Range (Tahap 2)
-- Description:
--   Updates the public.import_user_data_atomic(payload jsonb) RPC function.
--   Enforces date range relationship (start_date <= end_date) and guarantees
--   that the date range contains at least one day matching day_of_week
--   during the pre-validation pass of user data import.
--
-- Security & Hardening:
--   - Uses SECURITY DEFINER with SET search_path = public, pg_catalog.
--   - Strictly enforces auth.uid() as the actor; rejects unauthenticated calls.
--   - Scopes all DELETE, UPDATE, and INSERT operations strictly to auth.uid().
--   - Pre-validation pass: Validates structure, types, enums, dates, times,
--     AND schedule date ranges BEFORE executing any DELETE, UPDATE, or INSERT statement.
--   - Safe partial payload semantics:
--       * Omitted or null category key: Existing data for that category is preserved (no DELETE).
--       * Category key present with empty array: Category data is cleared.
--       * Category key present with items: Category data is replaced with new items.
--   - Unbounded schedules (null or empty start_date/end_date) remain valid.
--   - True DB fidelity: Uses RETURNING to_jsonb(...) to return exact persisted data.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.import_user_data_atomic(
  payload jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_schedule_map jsonb := '{}'::jsonb;
  v_seen_sched_ids jsonb := '{}'::jsonb;
  v_new_sched_id uuid;
  v_new_task_id uuid;
  v_new_note_id uuid;
  v_new_agenda_id uuid;
  v_target_sched_id uuid;

  -- Result containers: NULL indicates category was omitted from payload (untouched)
  v_res_schedules jsonb := NULL;
  v_res_tasks jsonb := NULL;
  v_res_notes jsonb := NULL;
  v_res_agenda jsonb := NULL;
  v_res_profile jsonb := NULL;
  v_res_preferences jsonb := NULL;

  v_raw_item jsonb;
  v_inserted_item jsonb;
  v_now timestamptz := pg_catalog.now();
  v_day_val integer;
  v_rem_min integer;
  v_str_val text;
BEGIN
  -- ──────────────────────────────────────────────────────────────────────────
  -- 1. AUTHENTICATION & ROOT STRUCTURE VALIDATION
  -- ──────────────────────────────────────────────────────────────────────────
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: User must be authenticated to import data';
  END IF;

  IF payload IS NULL OR jsonb_typeof(payload) != 'object' THEN
    RAISE EXCEPTION 'Invalid payload: Payload must be a JSON object';
  END IF;

  -- ──────────────────────────────────────────────────────────────────────────
  -- 2. PRE-VALIDATION PASS (Runs BEFORE any DELETE, UPDATE, or INSERT)
  -- ──────────────────────────────────────────────────────────────────────────

  -- 2.1 Relationship Safety Check for Partial Payloads:
  -- If replacing schedules without providing tasks, ensure user has no linked tasks that would be severed
  IF (payload ? 'schedules' AND payload->'schedules' IS NOT NULL AND jsonb_typeof(payload->'schedules') != 'null')
     AND NOT (payload ? 'tasks' AND payload->'tasks' IS NOT NULL AND jsonb_typeof(payload->'tasks') != 'null') THEN
    IF EXISTS (SELECT 1 FROM public.tasks WHERE user_id = v_user_id AND course_schedule_id IS NOT NULL) THEN
      RAISE EXCEPTION 'Cannot replace schedules without tasks: existing tasks are linked to current schedules. Include tasks in the payload to maintain schedule associations safely.';
    END IF;
  END IF;

  -- 2.2 Pre-validate Schedules (if key is present and not null in payload)
  IF payload ? 'schedules' AND payload->'schedules' IS NOT NULL AND jsonb_typeof(payload->'schedules') != 'null' THEN
    IF jsonb_typeof(payload->'schedules') != 'array' THEN
      RAISE EXCEPTION 'Invalid schedules payload: must be a JSON array';
    END IF;

    v_seen_sched_ids := '{}'::jsonb;

    FOR v_raw_item IN SELECT * FROM jsonb_array_elements(payload->'schedules')
    LOOP
      IF jsonb_typeof(v_raw_item) != 'object' THEN
        RAISE EXCEPTION 'Invalid schedule item: must be an object';
      END IF;

      -- Validate id (required, non-empty, and unique across payload)
      v_str_val := pg_catalog.btrim(COALESCE(v_raw_item->>'id', ''));
      IF v_str_val = '' THEN
        RAISE EXCEPTION 'Invalid schedule: id is required and cannot be empty';
      END IF;
      IF v_seen_sched_ids ? v_str_val THEN
        RAISE EXCEPTION 'Duplicate schedule id found in payload: "%". Each schedule must have a unique id.', v_str_val;
      END IF;
      v_seen_sched_ids := jsonb_set(v_seen_sched_ids, ARRAY[v_str_val], 'true'::jsonb);

      -- Validate course_name
      v_str_val := pg_catalog.btrim(COALESCE(v_raw_item->>'course_name', ''));
      IF v_str_val = '' THEN
        RAISE EXCEPTION 'Invalid schedule: course_name is required and cannot be empty';
      END IF;

      -- Validate day_of_week
      IF v_raw_item->>'day_of_week' IS NULL THEN
        RAISE EXCEPTION 'Invalid schedule: day_of_week is required';
      END IF;
      BEGIN
        v_day_val := (v_raw_item->>'day_of_week')::integer;
      EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION 'Invalid schedule: day_of_week must be an integer between 0 and 6';
      END;
      IF v_day_val < 0 OR v_day_val > 6 THEN
        RAISE EXCEPTION 'Invalid schedule day_of_week: % (must be between 0 and 6)', v_day_val;
      END IF;

      -- Validate start_time and end_time format (HH:mm)
      v_str_val := v_raw_item->>'start_time';
      IF v_str_val IS NULL OR NOT (v_str_val ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$') THEN
        RAISE EXCEPTION 'Invalid schedule start_time: "%" (must match HH:mm format)', COALESCE(v_str_val, 'NULL');
      END IF;

      v_str_val := v_raw_item->>'end_time';
      IF v_str_val IS NULL OR NOT (v_str_val ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$') THEN
        RAISE EXCEPTION 'Invalid schedule end_time: "%" (must match HH:mm format)', COALESCE(v_str_val, 'NULL');
      END IF;

      -- Validate time order
      IF (v_raw_item->>'start_time') >= (v_raw_item->>'end_time') THEN
        RAISE EXCEPTION 'Invalid schedule time: start_time (%) must be earlier than end_time (%)',
          v_raw_item->>'start_time', v_raw_item->>'end_time';
      END IF;

      -- Validate dates if provided
      IF v_raw_item ? 'start_date' AND v_raw_item->>'start_date' IS NOT NULL AND v_raw_item->>'start_date' != '' THEN
        BEGIN
          PERFORM (v_raw_item->>'start_date')::date;
        EXCEPTION WHEN OTHERS THEN
          RAISE EXCEPTION 'Invalid schedule start_date: "%" (must be a valid date YYYY-MM-DD)', v_raw_item->>'start_date';
        END;
      END IF;

      IF v_raw_item ? 'end_date' AND v_raw_item->>'end_date' IS NOT NULL AND v_raw_item->>'end_date' != '' THEN
        BEGIN
          PERFORM (v_raw_item->>'end_date')::date;
        EXCEPTION WHEN OTHERS THEN
          RAISE EXCEPTION 'Invalid schedule end_date: "%" (must be a valid date YYYY-MM-DD)', v_raw_item->>'end_date';
        END;
      END IF;

      -- Validate date range relationship and day_of_week inclusion if BOTH dates are provided
      IF (v_raw_item ? 'start_date' AND v_raw_item->>'start_date' IS NOT NULL AND v_raw_item->>'start_date' != '')
         AND (v_raw_item ? 'end_date' AND v_raw_item->>'end_date' IS NOT NULL AND v_raw_item->>'end_date' != '') THEN

        -- 1. Date order: start_date <= end_date
        IF (v_raw_item->>'start_date')::date > (v_raw_item->>'end_date')::date THEN
          RAISE EXCEPTION 'Invalid schedule date range: start_date (%) must be on or before end_date (%)',
            v_raw_item->>'start_date', v_raw_item->>'end_date';
        END IF;

        -- 2. Verify range includes day_of_week (0 = Sunday ... 6 = Saturday)
        -- If date difference is >= 6 days (7 or more calendar days inclusive), every weekday occurs at least once.
        -- If date difference is < 6 days, check each day in range using generate_series.
        IF ((v_raw_item->>'end_date')::date - (v_raw_item->>'start_date')::date) < 6 THEN
          IF NOT EXISTS (
            SELECT 1
            FROM pg_catalog.generate_series(
              (v_raw_item->>'start_date')::date,
              (v_raw_item->>'end_date')::date,
              '1 day'::interval
            ) AS d
            WHERE EXTRACT(DOW FROM d)::integer = v_day_val
          ) THEN
            RAISE EXCEPTION 'Invalid schedule date range: range [% to %] does not include day_of_week %',
              v_raw_item->>'start_date', v_raw_item->>'end_date', v_day_val;
          END IF;
        END IF;
      END IF;

      -- Validate created_at and updated_at if provided
      IF v_raw_item ? 'created_at' AND v_raw_item->>'created_at' IS NOT NULL AND v_raw_item->>'created_at' != '' THEN
        BEGIN
          PERFORM (v_raw_item->>'created_at')::timestamptz;
        EXCEPTION WHEN OTHERS THEN
          RAISE EXCEPTION 'Invalid schedule created_at: "%" (must be a valid ISO timestamp)', v_raw_item->>'created_at';
        END;
      END IF;

      IF v_raw_item ? 'updated_at' AND v_raw_item->>'updated_at' IS NOT NULL AND v_raw_item->>'updated_at' != '' THEN
        BEGIN
          PERFORM (v_raw_item->>'updated_at')::timestamptz;
        EXCEPTION WHEN OTHERS THEN
          RAISE EXCEPTION 'Invalid schedule updated_at: "%" (must be a valid ISO timestamp)', v_raw_item->>'updated_at';
        END;
      END IF;
    END LOOP;
  END IF;

  -- 2.3 Pre-validate Tasks (if key is present and not null in payload)
  IF payload ? 'tasks' AND payload->'tasks' IS NOT NULL AND jsonb_typeof(payload->'tasks') != 'null' THEN
    IF jsonb_typeof(payload->'tasks') != 'array' THEN
      RAISE EXCEPTION 'Invalid tasks payload: must be a JSON array';
    END IF;

    FOR v_raw_item IN SELECT * FROM jsonb_array_elements(payload->'tasks')
    LOOP
      IF jsonb_typeof(v_raw_item) != 'object' THEN
        RAISE EXCEPTION 'Invalid task item: must be an object';
      END IF;

      -- Validate title
      v_str_val := pg_catalog.btrim(COALESCE(v_raw_item->>'title', ''));
      IF v_str_val = '' THEN
        RAISE EXCEPTION 'Invalid task: title is required and cannot be empty';
      END IF;

      -- Validate priority
      v_str_val := COALESCE(NULLIF(v_raw_item->>'priority', ''), 'medium');
      IF v_str_val NOT IN ('low', 'medium', 'high') THEN
        RAISE EXCEPTION 'Invalid task priority: "%" (must be low, medium, or high)', v_str_val;
      END IF;

      -- Validate status
      v_str_val := COALESCE(NULLIF(v_raw_item->>'status', ''), 'todo');
      IF v_str_val NOT IN ('todo', 'in_progress', 'done') THEN
        RAISE EXCEPTION 'Invalid task status: "%" (must be todo, in_progress, or done)', v_str_val;
      END IF;

      -- Validate due_at if provided
      IF v_raw_item ? 'due_at' AND v_raw_item->>'due_at' IS NOT NULL AND v_raw_item->>'due_at' != '' THEN
        BEGIN
          PERFORM (v_raw_item->>'due_at')::timestamptz;
        EXCEPTION WHEN OTHERS THEN
          RAISE EXCEPTION 'Invalid task due_at: "%" (must be a valid ISO timestamp)', v_raw_item->>'due_at';
        END;
      END IF;

      -- Validate created_at and updated_at if provided
      IF v_raw_item ? 'created_at' AND v_raw_item->>'created_at' IS NOT NULL AND v_raw_item->>'created_at' != '' THEN
        BEGIN
          PERFORM (v_raw_item->>'created_at')::timestamptz;
        EXCEPTION WHEN OTHERS THEN
          RAISE EXCEPTION 'Invalid task created_at: "%" (must be a valid ISO timestamp)', v_raw_item->>'created_at';
        END;
      END IF;

      IF v_raw_item ? 'updated_at' AND v_raw_item->>'updated_at' IS NOT NULL AND v_raw_item->>'updated_at' != '' THEN
        BEGIN
          PERFORM (v_raw_item->>'updated_at')::timestamptz;
        EXCEPTION WHEN OTHERS THEN
          RAISE EXCEPTION 'Invalid task updated_at: "%" (must be a valid ISO timestamp)', v_raw_item->>'updated_at';
        END;
      END IF;
    END LOOP;
  END IF;

  -- 2.4 Pre-validate Notes (if key is present and not null in payload)
  IF payload ? 'notes' AND payload->'notes' IS NOT NULL AND jsonb_typeof(payload->'notes') != 'null' THEN
    IF jsonb_typeof(payload->'notes') != 'array' THEN
      RAISE EXCEPTION 'Invalid notes payload: must be a JSON array';
    END IF;

    FOR v_raw_item IN SELECT * FROM jsonb_array_elements(payload->'notes')
    LOOP
      IF jsonb_typeof(v_raw_item) != 'object' THEN
        RAISE EXCEPTION 'Invalid note item: must be an object';
      END IF;

      -- Validate title
      v_str_val := pg_catalog.btrim(COALESCE(v_raw_item->>'title', ''));
      IF v_str_val = '' THEN
        RAISE EXCEPTION 'Invalid note: title is required and cannot be empty';
      END IF;

      -- Validate is_favorite if provided (must be a valid JSON boolean)
      IF v_raw_item ? 'is_favorite' AND (v_raw_item->'is_favorite' IS NULL OR jsonb_typeof(v_raw_item->'is_favorite') != 'boolean') THEN
        RAISE EXCEPTION 'Invalid note is_favorite: "%" (must be a boolean true or false)', COALESCE(v_raw_item->>'is_favorite', 'null');
      END IF;

      -- Validate created_at and updated_at if provided
      IF v_raw_item ? 'created_at' AND v_raw_item->>'created_at' IS NOT NULL AND v_raw_item->>'created_at' != '' THEN
        BEGIN
          PERFORM (v_raw_item->>'created_at')::timestamptz;
        EXCEPTION WHEN OTHERS THEN
          RAISE EXCEPTION 'Invalid note created_at: "%" (must be a valid ISO timestamp)', v_raw_item->>'created_at';
        END;
      END IF;

      IF v_raw_item ? 'updated_at' AND v_raw_item->>'updated_at' IS NOT NULL AND v_raw_item->>'updated_at' != '' THEN
        BEGIN
          PERFORM (v_raw_item->>'updated_at')::timestamptz;
        EXCEPTION WHEN OTHERS THEN
          RAISE EXCEPTION 'Invalid note updated_at: "%" (must be a valid ISO timestamp)', v_raw_item->>'updated_at';
        END;
      END IF;
    END LOOP;
  END IF;

  -- 2.5 Pre-validate Agenda Events (if key is present and not null in payload)
  IF payload ? 'agenda_events' AND payload->'agenda_events' IS NOT NULL AND jsonb_typeof(payload->'agenda_events') != 'null' THEN
    IF jsonb_typeof(payload->'agenda_events') != 'array' THEN
      RAISE EXCEPTION 'Invalid agenda_events payload: must be a JSON array';
    END IF;

    FOR v_raw_item IN SELECT * FROM jsonb_array_elements(payload->'agenda_events')
    LOOP
      IF jsonb_typeof(v_raw_item) != 'object' THEN
        RAISE EXCEPTION 'Invalid agenda event item: must be an object';
      END IF;

      -- Validate title
      v_str_val := pg_catalog.btrim(COALESCE(v_raw_item->>'title', ''));
      IF v_str_val = '' THEN
        RAISE EXCEPTION 'Invalid agenda event: title is required and cannot be empty';
      END IF;

      -- Validate start_at
      IF v_raw_item->>'start_at' IS NULL OR v_raw_item->>'start_at' = '' THEN
        RAISE EXCEPTION 'Invalid agenda event: start_at is required';
      END IF;
      BEGIN
        PERFORM (v_raw_item->>'start_at')::timestamptz;
      EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION 'Invalid agenda event start_at: "%" (must be a valid ISO timestamp)', v_raw_item->>'start_at';
      END;

      -- Validate end_at and time ordering if provided
      IF v_raw_item ? 'end_at' AND v_raw_item->>'end_at' IS NOT NULL AND v_raw_item->>'end_at' != '' THEN
        BEGIN
          PERFORM (v_raw_item->>'end_at')::timestamptz;
        EXCEPTION WHEN OTHERS THEN
          RAISE EXCEPTION 'Invalid agenda event end_at: "%" (must be a valid ISO timestamp)', v_raw_item->>'end_at';
        END;

        IF (v_raw_item->>'end_at')::timestamptz < (v_raw_item->>'start_at')::timestamptz THEN
          RAISE EXCEPTION 'Invalid agenda time: end_at (%) must be greater than or equal to start_at (%)',
            v_raw_item->>'end_at', v_raw_item->>'start_at';
        END IF;
      END IF;

      -- Validate reminder_minutes if provided
      IF v_raw_item ? 'reminder_minutes' AND v_raw_item->>'reminder_minutes' IS NOT NULL AND v_raw_item->>'reminder_minutes' != '' THEN
        BEGIN
          PERFORM (v_raw_item->>'reminder_minutes')::integer;
        EXCEPTION WHEN OTHERS THEN
          RAISE EXCEPTION 'Invalid agenda reminder_minutes: "%" (must be an integer)', v_raw_item->>'reminder_minutes';
        END;
      END IF;

      -- Validate created_at and updated_at if provided
      IF v_raw_item ? 'created_at' AND v_raw_item->>'created_at' IS NOT NULL AND v_raw_item->>'created_at' != '' THEN
        BEGIN
          PERFORM (v_raw_item->>'created_at')::timestamptz;
        EXCEPTION WHEN OTHERS THEN
          RAISE EXCEPTION 'Invalid agenda event created_at: "%" (must be a valid ISO timestamp)', v_raw_item->>'created_at';
        END;
      END IF;

      IF v_raw_item ? 'updated_at' AND v_raw_item->>'updated_at' IS NOT NULL AND v_raw_item->>'updated_at' != '' THEN
        BEGIN
          PERFORM (v_raw_item->>'updated_at')::timestamptz;
        EXCEPTION WHEN OTHERS THEN
          RAISE EXCEPTION 'Invalid agenda event updated_at: "%" (must be a valid ISO timestamp)', v_raw_item->>'updated_at';
        END;
      END IF;
    END LOOP;
  END IF;

  -- 2.6 Pre-validate Profile (if key is present and not null)
  IF payload ? 'profile' AND payload->'profile' IS NOT NULL AND jsonb_typeof(payload->'profile') != 'null' THEN
    IF jsonb_typeof(payload->'profile') != 'object' THEN
      RAISE EXCEPTION 'Invalid profile payload: must be an object';
    END IF;
  END IF;

  -- 2.7 Pre-validate Preferences (if key is present and not null)
  IF payload ? 'preferences' AND payload->'preferences' IS NOT NULL AND jsonb_typeof(payload->'preferences') != 'null' THEN
    IF jsonb_typeof(payload->'preferences') != 'object' THEN
      RAISE EXCEPTION 'Invalid preferences payload: must be an object';
    END IF;

    IF (payload->'preferences') ? 'theme' AND (payload->'preferences'->>'theme') IS NOT NULL AND (payload->'preferences'->>'theme') != '' THEN
      IF (payload->'preferences'->>'theme') NOT IN ('light', 'dark', 'system') THEN
        RAISE EXCEPTION 'Invalid theme: "%" (must be light, dark, or system)', payload->'preferences'->>'theme';
      END IF;
    END IF;

    -- Validate timezone if provided
    IF payload->'preferences' ? 'timezone' AND payload->'preferences'->>'timezone' IS NOT NULL AND payload->'preferences'->>'timezone' != '' THEN
      v_str_val := pg_catalog.btrim(payload->'preferences'->>'timezone');
      IF v_str_val = '' THEN
        RAISE EXCEPTION 'Invalid preferences: timezone cannot be empty';
      END IF;
    END IF;
  END IF;

  -- ──────────────────────────────────────────────────────────────────────────
  -- 3. DELETION PHASE (Only executed for categories explicitly provided and not null)
  -- ──────────────────────────────────────────────────────────────────────────
  -- Tasks must be deleted before Schedules to respect foreign key constraint
  IF payload ? 'tasks' AND payload->'tasks' IS NOT NULL AND jsonb_typeof(payload->'tasks') != 'null' THEN
    DELETE FROM public.tasks WHERE user_id = v_user_id;
    v_res_tasks := '[]'::jsonb;
  END IF;

  IF payload ? 'schedules' AND payload->'schedules' IS NOT NULL AND jsonb_typeof(payload->'schedules') != 'null' THEN
    DELETE FROM public.schedules WHERE user_id = v_user_id;
    v_res_schedules := '[]'::jsonb;
  END IF;

  IF payload ? 'notes' AND payload->'notes' IS NOT NULL AND jsonb_typeof(payload->'notes') != 'null' THEN
    DELETE FROM public.notes WHERE user_id = v_user_id;
    v_res_notes := '[]'::jsonb;
  END IF;

  IF payload ? 'agenda_events' AND payload->'agenda_events' IS NOT NULL AND jsonb_typeof(payload->'agenda_events') != 'null' THEN
    DELETE FROM public.agenda_events WHERE user_id = v_user_id;
    v_res_agenda := '[]'::jsonb;
  END IF;

  -- ──────────────────────────────────────────────────────────────────────────
  -- 4. INSERTION & ID MAPPING PHASE
  -- ──────────────────────────────────────────────────────────────────────────

  -- 4.1 Insert Schedules (if provided and not null)
  IF payload ? 'schedules' AND payload->'schedules' IS NOT NULL AND jsonb_typeof(payload->'schedules') != 'null' THEN
    FOR v_raw_item IN SELECT * FROM jsonb_array_elements(payload->'schedules')
    LOOP
      v_new_sched_id := gen_random_uuid();
      v_day_val := (v_raw_item->>'day_of_week')::integer;

      INSERT INTO public.schedules (
        id,
        user_id,
        course_name,
        course_code,
        day_of_week,
        start_time,
        end_time,
        location,
        recurrence_rule,
        start_date,
        end_date,
        created_at,
        updated_at
      ) VALUES (
        v_new_sched_id,
        v_user_id,
        pg_catalog.btrim(v_raw_item->>'course_name'),
        NULLIF(pg_catalog.btrim(v_raw_item->>'course_code'), ''),
        v_day_val::smallint,
        v_raw_item->>'start_time',
        v_raw_item->>'end_time',
        NULLIF(pg_catalog.btrim(v_raw_item->>'location'), ''),
        COALESCE(NULLIF(pg_catalog.btrim(v_raw_item->>'recurrence_rule'), ''), 'weekly'),
        NULLIF(v_raw_item->>'start_date', '')::date,
        NULLIF(v_raw_item->>'end_date', '')::date,
        COALESCE(NULLIF(v_raw_item->>'created_at', '')::timestamptz, v_now),
        COALESCE(NULLIF(v_raw_item->>'updated_at', '')::timestamptz, v_now)
      )
      RETURNING to_jsonb(public.schedules.*) INTO v_inserted_item;

      -- Record old ID -> new UUID mapping
      IF v_raw_item ? 'id' AND v_raw_item->>'id' IS NOT NULL AND v_raw_item->>'id' != '' THEN
        v_schedule_map := jsonb_set(
          v_schedule_map,
          ARRAY[v_raw_item->>'id'],
          to_jsonb(v_new_sched_id::text)
        );
      END IF;

      v_res_schedules := v_res_schedules || v_inserted_item;
    END LOOP;
  END IF;

  -- 4.2 Insert Tasks (if provided and not null)
  IF payload ? 'tasks' AND payload->'tasks' IS NOT NULL AND jsonb_typeof(payload->'tasks') != 'null' THEN
    FOR v_raw_item IN SELECT * FROM jsonb_array_elements(payload->'tasks')
    LOOP
      v_new_task_id := gen_random_uuid();
      v_target_sched_id := NULL;

      -- Resolve course_schedule_id
      IF v_raw_item ? 'course_schedule_id' AND v_raw_item->>'course_schedule_id' IS NOT NULL AND v_raw_item->>'course_schedule_id' != '' THEN
        IF v_schedule_map ? (v_raw_item->>'course_schedule_id') THEN
          -- Mapped from schedules newly imported in this transaction
          v_target_sched_id := (v_schedule_map->>(v_raw_item->>'course_schedule_id'))::uuid;
        ELSIF NOT (payload ? 'schedules' AND payload->'schedules' IS NOT NULL AND jsonb_typeof(payload->'schedules') != 'null') THEN
          -- Schedules were NOT replaced: check against user's existing schedules in database
          BEGIN
            SELECT id INTO v_target_sched_id
            FROM public.schedules
            WHERE user_id = v_user_id AND id = (v_raw_item->>'course_schedule_id')::uuid;
          EXCEPTION WHEN OTHERS THEN
            v_target_sched_id := NULL;
          END;
        END IF;
      END IF;

      INSERT INTO public.tasks (
        id,
        user_id,
        title,
        description,
        due_at,
        priority,
        status,
        course_schedule_id,
        created_at,
        updated_at
      ) VALUES (
        v_new_task_id,
        v_user_id,
        pg_catalog.btrim(v_raw_item->>'title'),
        NULLIF(pg_catalog.btrim(v_raw_item->>'description'), ''),
        NULLIF(v_raw_item->>'due_at', '')::timestamptz,
        COALESCE(NULLIF(v_raw_item->>'priority', ''), 'medium'),
        COALESCE(NULLIF(v_raw_item->>'status', ''), 'todo'),
        v_target_sched_id,
        COALESCE(NULLIF(v_raw_item->>'created_at', '')::timestamptz, v_now),
        COALESCE(NULLIF(v_raw_item->>'updated_at', '')::timestamptz, v_now)
      )
      RETURNING to_jsonb(public.tasks.*) INTO v_inserted_item;

      v_res_tasks := v_res_tasks || v_inserted_item;
    END LOOP;
  END IF;

  -- 4.3 Insert Notes (if provided and not null)
  IF payload ? 'notes' AND payload->'notes' IS NOT NULL AND jsonb_typeof(payload->'notes') != 'null' THEN
    FOR v_raw_item IN SELECT * FROM jsonb_array_elements(payload->'notes')
    LOOP
      v_new_note_id := gen_random_uuid();

      INSERT INTO public.notes (
        id,
        user_id,
        title,
        content,
        category,
        tags,
        is_favorite,
        created_at,
        updated_at
      ) VALUES (
        v_new_note_id,
        v_user_id,
        pg_catalog.btrim(v_raw_item->>'title'),
        COALESCE(v_raw_item->>'content', ''),
        NULLIF(pg_catalog.btrim(v_raw_item->>'category'), ''),
        -- Robust tags parsing: safely handle array, null, scalar, and missing
        CASE
          WHEN v_raw_item ? 'tags' AND jsonb_typeof(v_raw_item->'tags') = 'array'
          THEN ARRAY(SELECT x FROM jsonb_array_elements_text(v_raw_item->'tags') AS t(x) WHERE x IS NOT NULL)
          ELSE '{}'::text[]
        END,
        COALESCE((v_raw_item->>'is_favorite')::boolean, false),
        COALESCE(NULLIF(v_raw_item->>'created_at', '')::timestamptz, v_now),
        COALESCE(NULLIF(v_raw_item->>'updated_at', '')::timestamptz, v_now)
      )
      RETURNING to_jsonb(public.notes.*) INTO v_inserted_item;

      v_res_notes := v_res_notes || v_inserted_item;
    END LOOP;
  END IF;

  -- 4.4 Insert Agenda Events (if provided and not null)
  IF payload ? 'agenda_events' AND payload->'agenda_events' IS NOT NULL AND jsonb_typeof(payload->'agenda_events') != 'null' THEN
    FOR v_raw_item IN SELECT * FROM jsonb_array_elements(payload->'agenda_events')
    LOOP
      v_new_agenda_id := gen_random_uuid();

      IF v_raw_item ? 'reminder_minutes' AND v_raw_item->>'reminder_minutes' IS NOT NULL AND v_raw_item->>'reminder_minutes' != '' THEN
        v_rem_min := (v_raw_item->>'reminder_minutes')::integer;
      ELSE
        v_rem_min := NULL;
      END IF;

      INSERT INTO public.agenda_events (
        id,
        user_id,
        title,
        description,
        start_at,
        end_at,
        location,
        reminder_minutes,
        created_at,
        updated_at
      ) VALUES (
        v_new_agenda_id,
        v_user_id,
        pg_catalog.btrim(v_raw_item->>'title'),
        NULLIF(pg_catalog.btrim(v_raw_item->>'description'), ''),
        (v_raw_item->>'start_at')::timestamptz,
        NULLIF(v_raw_item->>'end_at', '')::timestamptz,
        NULLIF(pg_catalog.btrim(v_raw_item->>'location'), ''),
        v_rem_min,
        COALESCE(NULLIF(v_raw_item->>'created_at', '')::timestamptz, v_now),
        COALESCE(NULLIF(v_raw_item->>'updated_at', '')::timestamptz, v_now)
      )
      RETURNING to_jsonb(public.agenda_events.*) INTO v_inserted_item;

      v_res_agenda := v_res_agenda || v_inserted_item;
    END LOOP;
  END IF;

  -- 4.5 Upsert Profile (if provided in payload)
  IF payload ? 'profile' AND payload->'profile' IS NOT NULL AND jsonb_typeof(payload->'profile') = 'object' THEN
    INSERT INTO public.profiles (
      id,
      name,
      email,
      title,
      created_at,
      updated_at
    ) VALUES (
      v_user_id,
      COALESCE(NULLIF(pg_catalog.btrim(payload->'profile'->>'name'), ''), 'User'),
      (SELECT email FROM auth.users WHERE id = v_user_id),
      COALESCE(NULLIF(pg_catalog.btrim(payload->'profile'->>'title'), ''), 'Personal Workspace'),
      v_now,
      v_now
    )
    ON CONFLICT (id) DO UPDATE SET
      name = COALESCE(NULLIF(pg_catalog.btrim(EXCLUDED.name), ''), public.profiles.name),
      title = COALESCE(NULLIF(pg_catalog.btrim(EXCLUDED.title), ''), public.profiles.title),
      updated_at = v_now
    RETURNING to_jsonb(public.profiles.*) INTO v_res_profile;
  END IF;

  -- 4.6 Upsert Preferences (if provided in payload)
  IF payload ? 'preferences' AND payload->'preferences' IS NOT NULL AND jsonb_typeof(payload->'preferences') = 'object' THEN
    INSERT INTO public.user_preferences (
      id,
      user_id,
      theme,
      timezone,
      notifications,
      created_at,
      updated_at
    ) VALUES (
      gen_random_uuid(),
      v_user_id,
      COALESCE(NULLIF(payload->'preferences'->>'theme', ''), 'light'),
      COALESCE(NULLIF(payload->'preferences'->>'timezone', ''), 'Asia/Jakarta'),
      COALESCE(
        CASE
          WHEN jsonb_typeof(payload->'preferences'->'notifications') = 'object'
          THEN payload->'preferences'->'notifications'
          ELSE NULL
        END,
        '{"course_schedule": true, "task_deadline": true, "agenda_event": false}'::jsonb
      ),
      v_now,
      v_now
    )
    ON CONFLICT (user_id) DO UPDATE SET
      theme = COALESCE(NULLIF(EXCLUDED.theme, ''), public.user_preferences.theme),
      timezone = COALESCE(NULLIF(EXCLUDED.timezone, ''), public.user_preferences.timezone),
      notifications = COALESCE(EXCLUDED.notifications, public.user_preferences.notifications),
      updated_at = v_now
    RETURNING to_jsonb(public.user_preferences.*) INTO v_res_preferences;
  END IF;

  -- ──────────────────────────────────────────────────────────────────────────
  -- 5. RETURN ALL INSERTED/UPDATED DATA WITH TRUE DB FIDELITY
  -- ──────────────────────────────────────────────────────────────────────────
  RETURN jsonb_build_object(
    'schedules', v_res_schedules,
    'tasks', v_res_tasks,
    'notes', v_res_notes,
    'agenda_events', v_res_agenda,
    'profile', v_res_profile,
    'preferences', v_res_preferences
  );
END;
$$;

-- Grant execution to authenticated users only; revoke from anon and public
REVOKE ALL ON FUNCTION public.import_user_data_atomic(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.import_user_data_atomic(jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.import_user_data_atomic(jsonb) TO authenticated;
