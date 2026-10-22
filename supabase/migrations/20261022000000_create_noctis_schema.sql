-- ==============================================================================
-- Noctis — Database Schema & Row Level Security (RLS) Migration
-- Version: Stage 4.2 (Revised & Hardened)
-- Description:
--   Creates core tables for Noctis: profiles, user_preferences, schedules,
--   tasks, notes, and agenda_events with hardened Row Level Security, composite
--   foreign key integrity for tasks-schedules, search_path security, and
--   an unswallowed error trigger for reliable auth user initialization.
-- ==============================================================================

-- ==============================================================================
-- 1. HELPER FUNCTION: updated_at timestamp management
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = pg_catalog.now();
  RETURN NEW;
END;
$$;

-- ==============================================================================
-- 2. TABLE: profiles
-- Linked 1:1 with auth.users(id).
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  email text,
  title text DEFAULT '',
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  updated_at timestamptz NOT NULL DEFAULT pg_catalog.now()
);

-- ==============================================================================
-- 3. TABLE: user_preferences
-- Stores user UI/system settings linked 1:1 with auth.users(id).
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.user_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  theme text NOT NULL DEFAULT 'system' CHECK (theme IN ('light', 'dark', 'system')),
  timezone text NOT NULL DEFAULT 'Asia/Jakarta',
  notifications jsonb NOT NULL DEFAULT '{"course_schedule": true, "task_deadline": true, "agenda_event": false}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  updated_at timestamptz NOT NULL DEFAULT pg_catalog.now()
);

-- ==============================================================================
-- 4. TABLE: schedules (Course Schedules / Jadwal Kuliah)
-- Stores recurring weekly academic schedules.
-- Includes unique constraint (user_id, id) for composite foreign key integrity.
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_name text NOT NULL,
  course_code text,
  day_of_week smallint NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time text NOT NULL CHECK (start_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  end_time text NOT NULL CHECK (end_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  location text,
  recurrence_rule text DEFAULT 'weekly',
  start_date date,
  end_date date,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  updated_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  CONSTRAINT uq_schedules_user_id_id UNIQUE (user_id, id),
  CONSTRAINT chk_schedules_time_order CHECK (start_time < end_time)
);

-- ==============================================================================
-- 5. TABLE: tasks
-- Stores task items.
-- Uses composite foreign key (user_id, course_schedule_id) referencing
-- schedules(user_id, id) to ensure users can only link tasks to their OWN schedules.
-- In PostgreSQL 15+, ON DELETE SET NULL (course_schedule_id) sets only
-- the course_schedule_id column to NULL when a schedule is deleted.
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  due_at timestamptz,
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  status text NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'done')),
  course_schedule_id uuid,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  updated_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  CONSTRAINT fk_tasks_course_schedule
    FOREIGN KEY (user_id, course_schedule_id)
    REFERENCES public.schedules(user_id, id)
    ON DELETE SET NULL (course_schedule_id)
);

-- ==============================================================================
-- 6. TABLE: notes
-- Stores personal notes with tags and favorites.
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  content text NOT NULL DEFAULT '',
  category text,
  tags text[] DEFAULT '{}'::text[],
  is_favorite boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  updated_at timestamptz NOT NULL DEFAULT pg_catalog.now()
);

-- ==============================================================================
-- 7. TABLE: agenda_events
-- Stores personal events and meeting reminders.
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.agenda_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  start_at timestamptz NOT NULL,
  end_at timestamptz,
  location text,
  reminder_minutes integer,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  updated_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  CONSTRAINT chk_agenda_events_time CHECK (end_at IS NULL OR end_at >= start_at)
);

-- ==============================================================================
-- 8. TRIGGERS: Automated updated_at refresh
-- ==============================================================================
DROP TRIGGER IF EXISTS set_profiles_updated_at ON public.profiles;
CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_user_preferences_updated_at ON public.user_preferences;
CREATE TRIGGER set_user_preferences_updated_at
  BEFORE UPDATE ON public.user_preferences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_schedules_updated_at ON public.schedules;
CREATE TRIGGER set_schedules_updated_at
  BEFORE UPDATE ON public.schedules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_tasks_updated_at ON public.tasks;
CREATE TRIGGER set_tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_notes_updated_at ON public.notes;
CREATE TRIGGER set_notes_updated_at
  BEFORE UPDATE ON public.notes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_agenda_events_updated_at ON public.agenda_events;
CREATE TRIGGER set_agenda_events_updated_at
  BEFORE UPDATE ON public.agenda_events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ==============================================================================
-- 9. AUTH TRIGGER: User Registration Initialization
-- Runs on new auth.users insertion.
-- Hardened with SECURITY DEFINER and SET search_path = ''.
-- Does NOT swallow errors, guaranteeing that essential profile and preference
-- records are initialized reliably without leaving orphaned/inconsistent states.
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  raw_name text;
  clean_name text;
  raw_title text;
  clean_title text;
BEGIN
  -- Extract name safely with fallback to email prefix or 'User'
  raw_name := COALESCE(
    NEW.raw_user_meta_data->>'name',
    NEW.raw_user_meta_data->>'full_name',
    pg_catalog.split_part(NEW.email, '@', 1),
    'User'
  );
  clean_name := pg_catalog.nullif(pg_catalog.trim(raw_name), '');
  IF clean_name IS NULL THEN
    clean_name := 'User';
  END IF;

  raw_title := NEW.raw_user_meta_data->>'title';
  clean_title := COALESCE(pg_catalog.nullif(pg_catalog.trim(raw_title), ''), 'Personal Workspace');

  -- 1. Initialize profile
  INSERT INTO public.profiles (id, name, email, title, created_at, updated_at)
  VALUES (
    NEW.id,
    clean_name,
    NEW.email,
    clean_title,
    pg_catalog.now(),
    pg_catalog.now()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    updated_at = pg_catalog.now();

  -- 2. Initialize default user preferences
  INSERT INTO public.user_preferences (user_id, theme, timezone, notifications, created_at, updated_at)
  VALUES (
    NEW.id,
    'light',
    'Asia/Jakarta',
    '{"course_schedule": true, "task_deadline": true, "agenda_event": false}'::jsonb,
    pg_catalog.now(),
    pg_catalog.now()
  )
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ==============================================================================
-- 10. ROW LEVEL SECURITY (RLS) POLICIES
-- Strict isolation ensuring users can only read, write, and delete their own records.
-- Drop statements ensure idempotency when re-running migrations.
-- ==============================================================================

-- 10.1 profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_delete_own" ON public.profiles;
CREATE POLICY "profiles_delete_own"
  ON public.profiles FOR DELETE
  USING (auth.uid() = id);

-- 10.2 user_preferences
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_preferences_select_own" ON public.user_preferences;
CREATE POLICY "user_preferences_select_own"
  ON public.user_preferences FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_preferences_insert_own" ON public.user_preferences;
CREATE POLICY "user_preferences_insert_own"
  ON public.user_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_preferences_update_own" ON public.user_preferences;
CREATE POLICY "user_preferences_update_own"
  ON public.user_preferences FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_preferences_delete_own" ON public.user_preferences;
CREATE POLICY "user_preferences_delete_own"
  ON public.user_preferences FOR DELETE
  USING (auth.uid() = user_id);

-- 10.3 schedules
ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "schedules_select_own" ON public.schedules;
CREATE POLICY "schedules_select_own"
  ON public.schedules FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "schedules_insert_own" ON public.schedules;
CREATE POLICY "schedules_insert_own"
  ON public.schedules FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "schedules_update_own" ON public.schedules;
CREATE POLICY "schedules_update_own"
  ON public.schedules FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "schedules_delete_own" ON public.schedules;
CREATE POLICY "schedules_delete_own"
  ON public.schedules FOR DELETE
  USING (auth.uid() = user_id);

-- 10.4 tasks
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tasks_select_own" ON public.tasks;
CREATE POLICY "tasks_select_own"
  ON public.tasks FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "tasks_insert_own" ON public.tasks;
CREATE POLICY "tasks_insert_own"
  ON public.tasks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "tasks_update_own" ON public.tasks;
CREATE POLICY "tasks_update_own"
  ON public.tasks FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "tasks_delete_own" ON public.tasks;
CREATE POLICY "tasks_delete_own"
  ON public.tasks FOR DELETE
  USING (auth.uid() = user_id);

-- 10.5 notes
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notes_select_own" ON public.notes;
CREATE POLICY "notes_select_own"
  ON public.notes FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "notes_insert_own" ON public.notes;
CREATE POLICY "notes_insert_own"
  ON public.notes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "notes_update_own" ON public.notes;
CREATE POLICY "notes_update_own"
  ON public.notes FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "notes_delete_own" ON public.notes;
CREATE POLICY "notes_delete_own"
  ON public.notes FOR DELETE
  USING (auth.uid() = user_id);

-- 10.6 agenda_events
ALTER TABLE public.agenda_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "agenda_events_select_own" ON public.agenda_events;
CREATE POLICY "agenda_events_select_own"
  ON public.agenda_events FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "agenda_events_insert_own" ON public.agenda_events;
CREATE POLICY "agenda_events_insert_own"
  ON public.agenda_events FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "agenda_events_update_own" ON public.agenda_events;
CREATE POLICY "agenda_events_update_own"
  ON public.agenda_events FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "agenda_events_delete_own" ON public.agenda_events;
CREATE POLICY "agenda_events_delete_own"
  ON public.agenda_events FOR DELETE
  USING (auth.uid() = user_id);

-- ==============================================================================
-- 11. INDEXES FOR QUERY OPTIMIZATION
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_schedules_user_day ON public.schedules(user_id, day_of_week);
CREATE INDEX IF NOT EXISTS idx_tasks_user_status ON public.tasks(user_id, status);
CREATE INDEX IF NOT EXISTS idx_tasks_user_due ON public.tasks(user_id, due_at);
CREATE INDEX IF NOT EXISTS idx_tasks_user_course ON public.tasks(user_id, course_schedule_id);
CREATE INDEX IF NOT EXISTS idx_notes_user_favorite ON public.notes(user_id, is_favorite);
CREATE INDEX IF NOT EXISTS idx_notes_user_updated ON public.notes(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_agenda_user_start ON public.agenda_events(user_id, start_at);
