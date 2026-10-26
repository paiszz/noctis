-- ==============================================================================
-- Noctis — Database Migration: Enable Realtime for Core Tables
-- Version: Stage 5.5
-- Description:
--   Ensures public.tasks, public.schedules, and public.agenda_events are
--   added to the supabase_realtime publication and set REPLICA IDENTITY FULL
--   so full row records (including OLD records on update/delete) are broadcast
--   via Supabase Realtime to subscribed client sessions.
-- ==============================================================================

-- 1. Enable REPLICA IDENTITY FULL so deletes and updates broadcast full records
ALTER TABLE public.tasks REPLICA IDENTITY FULL;
ALTER TABLE public.schedules REPLICA IDENTITY FULL;
ALTER TABLE public.agenda_events REPLICA IDENTITY FULL;

-- 2. Add core tables to supabase_realtime publication safely (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'tasks'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'schedules'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.schedules;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'agenda_events'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.agenda_events;
  END IF;
END;
$$;
