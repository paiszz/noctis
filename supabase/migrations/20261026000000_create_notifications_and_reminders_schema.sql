-- ==============================================================================
-- Noctis — Database Migration: Push Subscriptions & Reminder Engine
-- Version: Stage 5.1
-- Description:
--   Creates foundational tables for Web Push Notification and Reminder Engine:
--   1. public.push_subscriptions: Stores Web Push endpoints and encryption keys (p256dh, auth).
--   2. public.reminders: Tracks scheduled notification jobs, statuses, retry attempts,
--      and delivery timestamps with strict multi-tenant Row Level Security (RLS).
-- ==============================================================================

-- ==============================================================================
-- 1. TABLE: push_subscriptions
-- Stores Web Push API subscriptions per device/browser.
-- Linked to auth.users(id) with ON DELETE CASCADE.
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  updated_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  last_used_at timestamptz,
  CONSTRAINT uq_push_subscriptions_endpoint UNIQUE (endpoint)
);

-- Automated updated_at trigger for push_subscriptions
DROP TRIGGER IF EXISTS set_push_subscriptions_updated_at ON public.push_subscriptions;
CREATE TRIGGER set_push_subscriptions_updated_at
  BEFORE UPDATE ON public.push_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ==============================================================================
-- 2. TABLE: reminders
-- Stores individual scheduled reminder events generated from tasks, schedules,
-- and agenda events.
-- Supports idempotent deduplication and lifecycle statuses:
--   'pending', 'processing', 'sent', 'failed', 'cancelled'
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_type text NOT NULL CHECK (source_type IN ('course_schedule', 'task', 'agenda_event')),
  source_id uuid NOT NULL,
  scheduled_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'cancelled')),
  title text NOT NULL,
  body text,
  sent_at timestamptz,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  last_error text,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  updated_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  -- Idempotency constraint: prevents duplicate reminder jobs for the same event and scheduled timestamp
  CONSTRAINT uq_reminders_source_event_time UNIQUE (user_id, source_type, source_id, scheduled_at)
);

-- Automated updated_at trigger for reminders
DROP TRIGGER IF EXISTS set_reminders_updated_at ON public.reminders;
CREATE TRIGGER set_reminders_updated_at
  BEFORE UPDATE ON public.reminders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ==============================================================================
-- 3. ROW LEVEL SECURITY (RLS) POLICIES
-- Strict multi-tenant isolation ensuring users can only read, insert, update,
-- and delete their own subscriptions and reminders.
-- ==============================================================================

-- 3.1 push_subscriptions RLS
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "push_subscriptions_select_own" ON public.push_subscriptions;
CREATE POLICY "push_subscriptions_select_own"
  ON public.push_subscriptions FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "push_subscriptions_insert_own" ON public.push_subscriptions;
CREATE POLICY "push_subscriptions_insert_own"
  ON public.push_subscriptions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "push_subscriptions_update_own" ON public.push_subscriptions;
CREATE POLICY "push_subscriptions_update_own"
  ON public.push_subscriptions FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "push_subscriptions_delete_own" ON public.push_subscriptions;
CREATE POLICY "push_subscriptions_delete_own"
  ON public.push_subscriptions FOR DELETE
  USING (auth.uid() = user_id);

-- 3.2 reminders RLS
ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reminders_select_own" ON public.reminders;
CREATE POLICY "reminders_select_own"
  ON public.reminders FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "reminders_insert_own" ON public.reminders;
CREATE POLICY "reminders_insert_own"
  ON public.reminders FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "reminders_update_own" ON public.reminders;
CREATE POLICY "reminders_update_own"
  ON public.reminders FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "reminders_delete_own" ON public.reminders;
CREATE POLICY "reminders_delete_own"
  ON public.reminders FOR DELETE
  USING (auth.uid() = user_id);

-- ==============================================================================
-- 4. INDEXES FOR QUERY & SCHEDULER OPTIMIZATION
-- ==============================================================================

-- Optimize subscription lookup by user
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id
  ON public.push_subscriptions (user_id);

-- Partial index for scheduler engine: efficiently selects pending reminders due for delivery
CREATE INDEX IF NOT EXISTS idx_reminders_scheduler_due
  ON public.reminders (scheduled_at ASC)
  WHERE status = 'pending';

-- Optimize user-specific reminder queries (e.g. active reminders list or dashboard notifications)
CREATE INDEX IF NOT EXISTS idx_reminders_user_status_scheduled
  ON public.reminders (user_id, status, scheduled_at);

-- Optimize cascade lookups or cancellation when source entities (task/schedule/agenda) change
CREATE INDEX IF NOT EXISTS idx_reminders_user_source
  ON public.reminders (user_id, source_type, source_id);
