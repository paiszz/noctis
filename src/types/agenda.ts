import { toTimezoneDate, DEFAULT_TIMEZONE } from "@/lib/date";

export interface AgendaEvent {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  start_at: string; // ISO datetime string
  end_at?: string; // ISO datetime string
  location?: string;
  reminder_minutes?: number; // minutes before start_at, e.g. 15, 30, 60
  created_at: string;
  updated_at: string;
}

/**
 * Checks if an agenda event is upcoming (start_at has not passed yet).
 * Evaluates both date and time in the user's timezone (default: Asia/Jakarta).
 */
export function isUpcomingAgenda(
  agenda: { start_at: string },
  now?: Date,
  timezone: string = DEFAULT_TIMEZONE
): boolean {
  const effectiveNow = now ?? toTimezoneDate(new Date(), timezone);
  const eventTime = toTimezoneDate(agenda.start_at, timezone).getTime();
  const currentTime = effectiveNow.getTime();
  return eventTime >= currentTime;
}

/**
 * Checks if an agenda event has passed/completed (start_at has already passed).
 * Evaluates both date and time in the user's timezone (default: Asia/Jakarta).
 */
export function isPastAgenda(
  agenda: { start_at: string },
  now?: Date,
  timezone: string = DEFAULT_TIMEZONE
): boolean {
  const effectiveNow = now ?? toTimezoneDate(new Date(), timezone);
  const eventTime = toTimezoneDate(agenda.start_at, timezone).getTime();
  const currentTime = effectiveNow.getTime();
  return eventTime < currentTime;
}

