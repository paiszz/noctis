-- ==============================================================================
-- Noctis — Database Migration: Cleanup Reminders on Source Entity Deletion
-- Version: Stage 5.3
-- Description:
--   Creates database triggers on public.tasks, public.schedules, and
--   public.agenda_events to automatically clean up orphaned reminders
--   when source records are deleted in PostgreSQL (defense-in-depth).
-- ==============================================================================

-- 1. Trigger Function to clean up reminders by polymorphic source
CREATE OR REPLACE FUNCTION public.cleanup_orphaned_reminders()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_TABLE_NAME = 'tasks' THEN
    DELETE FROM public.reminders
    WHERE user_id = OLD.user_id
      AND source_type = 'task'
      AND source_id = OLD.id;
  ELSIF TG_TABLE_NAME = 'schedules' THEN
    DELETE FROM public.reminders
    WHERE user_id = OLD.user_id
      AND source_type = 'course_schedule'
      AND source_id = OLD.id;
  ELSIF TG_TABLE_NAME = 'agenda_events' THEN
    DELETE FROM public.reminders
    WHERE user_id = OLD.user_id
      AND source_type = 'agenda_event'
      AND source_id = OLD.id;
  END IF;

  RETURN OLD;
END;
$$;

-- 2. Trigger on public.tasks
DROP TRIGGER IF EXISTS trg_cleanup_reminders_tasks ON public.tasks;
CREATE TRIGGER trg_cleanup_reminders_tasks
  AFTER DELETE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.cleanup_orphaned_reminders();

-- 3. Trigger on public.schedules
DROP TRIGGER IF EXISTS trg_cleanup_reminders_schedules ON public.schedules;
CREATE TRIGGER trg_cleanup_reminders_schedules
  AFTER DELETE ON public.schedules
  FOR EACH ROW
  EXECUTE FUNCTION public.cleanup_orphaned_reminders();

-- 4. Trigger on public.agenda_events
DROP TRIGGER IF EXISTS trg_cleanup_reminders_agenda ON public.agenda_events;
CREATE TRIGGER trg_cleanup_reminders_agenda
  AFTER DELETE ON public.agenda_events
  FOR EACH ROW
  EXECUTE FUNCTION public.cleanup_orphaned_reminders();
