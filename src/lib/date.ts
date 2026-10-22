import { format } from "date-fns";
import { id as localeId } from "date-fns/locale/id";

export const JAKARTA_TIMEZONE = "Asia/Jakarta";

/**
 * Converts a date into a Date object representing the same wall-clock time
 * in the Asia/Jakarta (WIB) timezone, ensuring consistent rendering across
 * environments (e.g. UTC server and WIB client).
 */
export function toJakartaDate(date: Date | string | number = new Date()): Date {
  const d = typeof date === "string" || typeof date === "number" ? new Date(date) : date;
  return new Date(d.toLocaleString("en-US", { timeZone: JAKARTA_TIMEZONE }));
}

/**
 * Format a date in Asia/Jakarta timezone using date-fns format tokens and Indonesian locale.
 */
export function formatJakarta(date: Date | string | number, formatStr: string): string {
  const jDate = toJakartaDate(date);
  return format(jDate, formatStr, { locale: localeId });
}

/**
 * Returns current calendar parts in Asia/Jakarta timezone.
 */
export function getJakartaBaseDate(now: Date = new Date()): {
  year: number;
  month: number;
  day: number;
  dayOfWeek: 0 | 1 | 2 | 3 | 4 | 5 | 6;
} {
  const dateStr = now.toLocaleDateString("en-CA", { timeZone: JAKARTA_TIMEZONE });
  const [year, month, day] = dateStr.split("-").map(Number);

  const weekdayStr = new Intl.DateTimeFormat("en-US", {
    timeZone: JAKARTA_TIMEZONE,
    weekday: "short",
  }).format(now);

  const weekdayMap: Record<string, 0 | 1 | 2 | 3 | 4 | 5 | 6> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };

  return {
    year,
    month,
    day,
    dayOfWeek: weekdayMap[weekdayStr] ?? 0,
  };
}

/**
 * Helper to generate deterministic ISO date strings with fixed time in Asia/Jakarta (UTC+7).
 */
export function toJakartaISOString(daysOffset: number, timeStr = "09:00"): string {
  const base = getJakartaBaseDate();
  const [hours, minutes] = timeStr.split(":").map(Number);
  // Jakarta is UTC+7 -> UTC hours = hours - 7
  const utcDate = new Date(
    Date.UTC(base.year, base.month - 1, base.day + daysOffset, hours - 7, minutes, 0, 0)
  );
  return utcDate.toISOString();
}
