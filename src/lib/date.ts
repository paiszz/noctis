import { format } from "date-fns";
import { id as localeId } from "date-fns/locale/id";

export const DEFAULT_TIMEZONE = "Asia/Jakarta";
export const JAKARTA_TIMEZONE = "Asia/Jakarta";

/**
 * Converts a date into a Date object representing the wall-clock time
 * in the specified timezone, ensuring consistent rendering across
 * environments (e.g. UTC server and client).
 */
export function toTimezoneDate(
  date: Date | string | number = new Date(),
  timezone: string = DEFAULT_TIMEZONE
): Date {
  const d = typeof date === "string" || typeof date === "number" ? new Date(date) : date;
  if (isNaN(d.getTime())) return new Date(NaN);
  return new Date(d.toLocaleString("en-US", { timeZone: timezone || DEFAULT_TIMEZONE }));
}

/**
 * Converts a date into a Date object representing the wall-clock time
 * in the Asia/Jakarta (WIB) timezone (backward-compatible alias).
 */
export function toJakartaDate(date: Date | string | number = new Date()): Date {
  return toTimezoneDate(date, JAKARTA_TIMEZONE);
}

/**
 * Format a date in the specified timezone using date-fns format tokens and Indonesian locale.
 */
export function formatInTimezone(
  date: Date | string | number,
  formatStr: string,
  timezone: string = DEFAULT_TIMEZONE
): string {
  const tzDate = toTimezoneDate(date, timezone);
  return format(tzDate, formatStr, { locale: localeId });
}

/**
 * Format a date in Asia/Jakarta timezone using date-fns format tokens and Indonesian locale (backward-compatible alias).
 */
export function formatJakarta(date: Date | string | number, formatStr: string): string {
  return formatInTimezone(date, formatStr, JAKARTA_TIMEZONE);
}

/**
 * Returns current calendar parts in the specified timezone.
 */
export function getTimezoneBaseDate(
  now: Date = new Date(),
  timezone: string = DEFAULT_TIMEZONE
): {
  year: number;
  month: number;
  day: number;
  dayOfWeek: 0 | 1 | 2 | 3 | 4 | 5 | 6;
} {
  const tz = timezone || DEFAULT_TIMEZONE;
  const dateStr = now.toLocaleDateString("en-CA", { timeZone: tz });
  const [year, month, day] = dateStr.split("-").map(Number);

  const weekdayStr = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
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
 * Returns current calendar parts in Asia/Jakarta timezone (backward-compatible alias).
 */
export function getJakartaBaseDate(now: Date = new Date()): {
  year: number;
  month: number;
  day: number;
  dayOfWeek: 0 | 1 | 2 | 3 | 4 | 5 | 6;
} {
  return getTimezoneBaseDate(now, JAKARTA_TIMEZONE);
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

/**
 * Converts an ISO UTC string to "YYYY-MM-DDTHH:mm" in the specified timezone for form inputs.
 */
export function isoToDatetimeLocal(
  isoStr?: string,
  timezone: string = DEFAULT_TIMEZONE
): string {
  if (!isoStr) return "";
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return "";

  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone || DEFAULT_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    hourCycle: "h23",
  });

  const parts = formatter.formatToParts(d);
  const getPart = (type: string) => parts.find((p) => p.type === type)?.value || "";
  return `${getPart("year")}-${getPart("month")}-${getPart("day")}T${getPart("hour")}:${getPart("minute")}`;
}

/**
 * Converts a "YYYY-MM-DDTHH:mm" local form input string in the specified timezone to a UTC ISO string.
 */
export function datetimeLocalToIso(
  localStr?: string,
  timezone: string = DEFAULT_TIMEZONE
): string {
  if (!localStr) return "";
  const match = localStr.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!match) return "";

  const [, yStr, mStr, dStr, hStr, minStr] = match;
  const year = Number(yStr);
  const month = Number(mStr);
  const day = Number(dStr);
  const hour = Number(hStr);
  const minute = Number(minStr);

  const tz = timezone || DEFAULT_TIMEZONE;
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0, 0));

  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hour12: false,
  });

  const parts = formatter.formatToParts(utcGuess);
  const p = (type: string) => Number(parts.find((x) => x.type === type)?.value || 0);

  const formattedAsDate = new Date(
    Date.UTC(
      p("year"),
      p("month") - 1,
      p("day"),
      p("hour") === 24 ? 0 : p("hour"),
      p("minute"),
      p("second")
    )
  );
  const offsetDiffMs = formattedAsDate.getTime() - utcGuess.getTime();

  const finalDate = new Date(utcGuess.getTime() - offsetDiffMs);
  return finalDate.toISOString();
}
