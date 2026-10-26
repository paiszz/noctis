/**
 * Noctis Scheduler Authentication Helper
 * Provides constant-time secret validation for internal cron and worker endpoints.
 * Strictly prevents timing attacks, supports independent secrets without assuming
 * CRON_SECRET matches REMINDER_SCHEDULER_SECRET, and rejects SUPABASE_SERVICE_ROLE_KEY.
 */

import crypto from "crypto";

export interface SchedulerAuthResult {
  authorized: boolean;
  error?: string;
  status?: number;
}

export interface HeaderProvider {
  headers: {
    get(name: string): string | null;
  };
}

/**
 * Validates the scheduler authorization secret in constant time.
 * Checks whether the incoming token matches either REMINDER_SCHEDULER_SECRET
 * or CRON_SECRET (if configured), without assuming they are identical.
 *
 * Accepts either:
 * - `Authorization: Bearer <token>`
 * - `x-scheduler-secret: <token>`
 */
export function verifySchedulerAuth(request: HeaderProvider): SchedulerAuthResult {
  const reminderSecret = process.env.REMINDER_SCHEDULER_SECRET?.trim();
  const cronSecret = process.env.CRON_SECRET?.trim();

  // Collect all validly configured secrets (minimum 8 characters)
  const validSecrets = [reminderSecret, cronSecret].filter(
    (s): s is string => Boolean(s && s.length >= 8)
  );

  if (validSecrets.length === 0) {
    return {
      authorized: false,
      error: "REMINDER_SCHEDULER_SECRET belum dikonfigurasi di server.",
      status: 503,
    };
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  // Extract token from Authorization Bearer or x-scheduler-secret header
  const authHeader = request.headers.get("authorization")?.trim();
  const customHeader = request.headers.get("x-scheduler-secret")?.trim();

  let token = "";
  if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
    token = authHeader.slice(7).trim();
  } else if (customHeader) {
    token = customHeader;
  }

  if (!token) {
    return {
      authorized: false,
      error: "Autentikasi diperlukan. Header Authorization: Bearer <secret> atau x-scheduler-secret tidak ditemukan.",
      status: 401,
    };
  }

  // Reject if token is accidentally or maliciously using SUPABASE_SERVICE_ROLE_KEY
  if (
    serviceRoleKey &&
    token === serviceRoleKey &&
    !validSecrets.includes(serviceRoleKey)
  ) {
    return {
      authorized: false,
      error: "Kunci SUPABASE_SERVICE_ROLE_KEY tidak dapat digunakan sebagai scheduler secret.",
      status: 403,
    };
  }

  // Secure constant-time comparison against all configured secrets independently
  const tokenBuf = Buffer.from(token);
  let isMatch = false;

  for (const secret of validSecrets) {
    const secretBuf = Buffer.from(secret);
    if (
      tokenBuf.length === secretBuf.length &&
      crypto.timingSafeEqual(tokenBuf, secretBuf)
    ) {
      isMatch = true;
      break;
    }
  }

  if (!isMatch) {
    return {
      authorized: false,
      error: "Token scheduler tidak valid.",
      status: 401,
    };
  }

  return { authorized: true };
}
