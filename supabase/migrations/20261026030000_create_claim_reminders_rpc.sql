-- ==============================================================================
-- Noctis — Database Migration: Atomic Reminder Claim RPC & Stale Recovery
-- Version: Stage 5.4
-- Description:
--   1. Creates partial index for stale processing recovery.
--   2. Defines PostgreSQL function `public.claim_due_reminders` using
--      `FOR UPDATE SKIP LOCKED` for atomic, race-condition-free reminder claiming.
--   3. Automatically recovers stale reminders left in 'processing' state
--      due to worker crashes or abnormal termination.
--   4. Restricts execution privileges exclusively to service_role and postgres.
-- ==============================================================================

-- 1. PARTIAL INDEX FOR STALE PROCESSING RECOVERY
-- Accelerates identifying reminders stuck in 'processing' status beyond timeout
CREATE INDEX IF NOT EXISTS idx_reminders_processing_stale
  ON public.reminders (updated_at ASC)
  WHERE status = 'processing';

-- 2. STORED PROCEDURE: claim_due_reminders
-- Atomically claims a batch of pending reminders due for delivery.
-- Guarantees that concurrent scheduler workers cannot claim the same reminder.
CREATE OR REPLACE FUNCTION public.claim_due_reminders(
  p_batch_size integer DEFAULT 20,
  p_stale_timeout_minutes integer DEFAULT 5,
  p_max_attempts integer DEFAULT 3
)
RETURNS SETOF public.reminders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_batch_limit integer;
  v_stale_interval interval;
  v_max_attempts integer;
BEGIN
  -- Sanitize inputs
  v_batch_limit := pg_catalog.least(pg_catalog.greatest(COALESCE(p_batch_size, 20), 1), 50);
  v_stale_interval := (pg_catalog.greatest(COALESCE(p_stale_timeout_minutes, 5), 1) || ' minutes')::interval;
  v_max_attempts := pg_catalog.least(pg_catalog.greatest(COALESCE(p_max_attempts, 3), 1), 5);

  -- Step 1: Recover stale 'processing' reminders that hung longer than timeout.
  -- Reminders with attempts < max_attempts are reset to 'pending' for retry.
  UPDATE public.reminders
  SET status = 'pending',
      last_error = 'Stale processing timeout: worker died or stalled',
      updated_at = pg_catalog.now()
  WHERE status = 'processing'
    AND updated_at < pg_catalog.now() - v_stale_interval
    AND attempts < v_max_attempts;

  -- Reminders that have already exhausted max_attempts are permanently marked 'failed'.
  UPDATE public.reminders
  SET status = 'failed',
      last_error = 'Stale processing timeout: maximum attempts exceeded',
      updated_at = pg_catalog.now()
  WHERE status = 'processing'
    AND updated_at < pg_catalog.now() - v_stale_interval
    AND attempts >= v_max_attempts;

  -- Step 2: Atomically select and lock pending due reminders using FOR UPDATE SKIP LOCKED.
  -- Concurrently running workers skip locked rows without blocking.
  RETURN QUERY
  WITH claimed AS (
    SELECT id
    FROM public.reminders
    WHERE status = 'pending'
      AND scheduled_at <= pg_catalog.now()
      AND attempts < v_max_attempts
    ORDER BY scheduled_at ASC
    LIMIT v_batch_limit
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.reminders r
  SET status = 'processing',
      attempts = r.attempts + 1,
      updated_at = pg_catalog.now()
  FROM claimed
  WHERE r.id = claimed.id
  RETURNING r.*;
END;
$$;

-- 3. REVOKE & GRANT PRIVILEGES
-- Strictly lock down RPC access: only trusted backend service_role can claim reminders.
REVOKE ALL ON FUNCTION public.claim_due_reminders(integer, integer, integer) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_due_reminders(integer, integer, integer) TO service_role, postgres;
