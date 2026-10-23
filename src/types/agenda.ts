import { toJakartaDate } from "@/lib/date";

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
 * Evaluates both date and time in Asia/Jakarta timezone.
 */
export function isUpcomingAgenda(
  agenda: { start_at: string },
  now: Date = toJakartaDate(new Date())
): boolean {
  const eventTime = toJakartaDate(agenda.start_at).getTime();
  const currentTime = now.getTime();
  return eventTime >= currentTime;
}

/**
 * Checks if an agenda event has passed/completed (start_at has already passed).
 * Evaluates both date and time in Asia/Jakarta timezone.
 */
export function isPastAgenda(
  agenda: { start_at: string },
  now: Date = toJakartaDate(new Date())
): boolean {
  const eventTime = toJakartaDate(agenda.start_at).getTime();
  const currentTime = now.getTime();
  return eventTime < currentTime;
}

