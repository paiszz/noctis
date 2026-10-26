-- ==============================================================================
-- Noctis — Database Migration: Harden Push Subscriptions Privileges & Constraints
-- Version: Stage 5.2 Hardening
-- Description:
--   1. Enforces defense-in-depth CHECK constraints on public.push_subscriptions
--      for protocol (HTTPS/localhost), endpoint length, and key lengths.
--   2. Explicitly revokes direct PostgREST access from anon and authenticated roles.
--   3. Restricts direct table access to service_role and postgres, ensuring all
--      subscription modifications must pass through authenticated Next.js server route handlers.
-- ==============================================================================

-- 1. DEFENSE-IN-DEPTH CHECK CONSTRAINTS
DO $$
BEGIN
  -- 1.1 Enforce HTTPS protocol (allowing http://localhost for local development)
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_push_subscriptions_endpoint_protocol'
  ) THEN
    ALTER TABLE public.push_subscriptions
      ADD CONSTRAINT chk_push_subscriptions_endpoint_protocol
      CHECK (endpoint ~ '^https://|^http://localhost');
  END IF;

  -- 1.2 Enforce maximum endpoint URL length
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_push_subscriptions_endpoint_length'
  ) THEN
    ALTER TABLE public.push_subscriptions
      ADD CONSTRAINT chk_push_subscriptions_endpoint_length
      CHECK (char_length(endpoint) <= 2048);
  END IF;

  -- 1.3 Enforce cryptographic key length limits
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_push_subscriptions_keys_length'
  ) THEN
    ALTER TABLE public.push_subscriptions
      ADD CONSTRAINT chk_push_subscriptions_keys_length
      CHECK (char_length(p256dh) BETWEEN 10 AND 256 AND char_length(auth) BETWEEN 10 AND 128);
  END IF;
END $$;

-- 2. REVOKE DIRECT POSTGREST ACCESS
-- Explicitly revokes all direct table privileges from anon and authenticated clients.
-- Client browsers cannot directly query or manipulate push_subscriptions via supabase-js.
REVOKE ALL ON TABLE public.push_subscriptions FROM anon, authenticated;

-- 3. GRANT PRIVILEGES TO TRUSTED BACKEND ROLES
-- Only privileged server-side operations (using service_role key) can read/write this table.
GRANT ALL ON TABLE public.push_subscriptions TO service_role, postgres;
