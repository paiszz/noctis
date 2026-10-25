/** Day of the week (0 = Sunday, 1 = Monday, ..., 6 = Saturday) */
export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export const DAY_LABELS: Record<DayOfWeek, string> = {
  0: "Minggu",
  1: "Senin",
  2: "Selasa",
  3: "Rabu",
  4: "Kamis",
  5: "Jumat",
  6: "Sabtu",
};

export interface CourseSchedule {
  id: string;
  user_id: string;
  course_name: string;
  course_code?: string;
  day_of_week: DayOfWeek;
  start_time: string; // "HH:mm" format
  end_time: string; // "HH:mm" format
  location?: string;
  recurrence_rule?: string; // e.g., "weekly"
  start_date?: string; // ISO date string
  end_date?: string; // ISO date string
  created_at: string;
  updated_at: string;
}

export type ExceptionType = "cancelled" | "rescheduled";

export interface ScheduleException {
  id: string;
  schedule_id: string;
  occurrence_date: string; // ISO date string
  exception_type: ExceptionType;
  override_start?: string; // "HH:mm" format
  override_end?: string; // "HH:mm" format
  location?: string;
  created_at: string;
}

/**
 * Checks whether a recurring course schedule is active on a specific calendar date.
 *
 * Rules:
 * 1. Day of week must match schedule.day_of_week.
 * 2. If start_date is set, target date must be >= start_date (inclusive).
 * 3. If end_date is set, target date must be <= end_date (inclusive).
 * 4. Backward compatibility: if start_date or end_date are null/undefined/empty
 *    (e.g., legacy schedules), the schedule is treated as open-ended (unbounded)
 *    and remains active on every matching weekday.
 */
export function isScheduleActiveOnDate(
  schedule: CourseSchedule,
  targetDate: Date | string
): boolean {
  if (!schedule) return false;

  let dateStr: string;
  let dayOfWeek: DayOfWeek;

  if (targetDate instanceof Date) {
    if (isNaN(targetDate.getTime())) return false;
    const pad = (n: number) => String(n).padStart(2, "0");
    dateStr = `${targetDate.getFullYear()}-${pad(targetDate.getMonth() + 1)}-${pad(targetDate.getDate())}`;
    dayOfWeek = targetDate.getDay() as DayOfWeek;
  } else if (typeof targetDate === "string") {
    const match = targetDate.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!match) return false;
    dateStr = `${match[1]}-${match[2]}-${match[3]}`;
    const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
    const parsedDate = new Date(y, m - 1, d);
    dayOfWeek = parsedDate.getDay() as DayOfWeek;
  } else {
    return false;
  }

  // 1. Day of week match
  if (schedule.day_of_week !== dayOfWeek) {
    return false;
  }

  // 2. Start date boundary (on or after start_date)
  if (schedule.start_date && schedule.start_date.trim()) {
    const startStr = schedule.start_date.trim().slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(startStr) && dateStr < startStr) {
      return false;
    }
  }

  // 3. End date boundary (on or before end_date)
  if (schedule.end_date && schedule.end_date.trim()) {
    const endStr = schedule.end_date.trim().slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(endStr) && dateStr > endStr) {
      return false;
    }
  }

  return true;
}

/**
 * Result of schedule date range validation.
 */
export interface ScheduleDateRangeValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Checks whether a given calendar date range [startDateStr, endDateStr]
 * contains at least one day matching dayOfWeek.
 * Both boundaries are inclusive. Uses pure UTC calendar math to prevent any timezone shifts.
 */
export function doesDateRangeIncludeDay(
  dayOfWeek: DayOfWeek,
  startDateStr: string,
  endDateStr: string
): boolean {
  const matchStart = startDateStr.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  const matchEnd = endDateStr.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!matchStart || !matchEnd) return true;

  const startUtc = Date.UTC(Number(matchStart[1]), Number(matchStart[2]) - 1, Number(matchStart[3]));
  const endUtc = Date.UTC(Number(matchEnd[1]), Number(matchEnd[2]) - 1, Number(matchEnd[3]));

  if (startUtc > endUtc) return false;

  const msPerDay = 24 * 60 * 60 * 1000;
  const totalDays = Math.round((endUtc - startUtc) / msPerDay) + 1;

  // Spans a full week or more: guarantees every day of week occurs at least once
  if (totalDays >= 7) {
    return true;
  }

  // Iterate day by day for spans under 7 days
  for (let t = startUtc; t <= endUtc; t += msPerDay) {
    if (new Date(t).getUTCDay() === dayOfWeek) {
      return true;
    }
  }

  return false;
}

/**
 * Validates a schedule's start_date and end_date range against its day_of_week.
 *
 * Rules:
 * 1. If start_date or end_date are empty/null/undefined, schedule is unbounded and valid.
 * 2. If both dates are provided:
 *    - start_date must be <= end_date (inclusive).
 *    - The range [start_date, end_date] must contain at least one day matching day_of_week.
 */
export function validateScheduleDateRange(
  dayOfWeek: DayOfWeek,
  startDate?: string | null,
  endDate?: string | null
): ScheduleDateRangeValidationResult {
  const startClean = startDate?.trim() || "";
  const endClean = endDate?.trim() || "";

  // Unbounded schedules (open-ended) are always valid
  if (!startClean || !endClean) {
    return { isValid: true };
  }

  const matchStart = startClean.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const matchEnd = endClean.match(/^(\d{4})-(\d{2})-(\d{2})/);

  if (!matchStart || !matchEnd) {
    return { isValid: true };
  }

  const startUtc = Date.UTC(Number(matchStart[1]), Number(matchStart[2]) - 1, Number(matchStart[3]));
  const endUtc = Date.UTC(Number(matchEnd[1]), Number(matchEnd[2]) - 1, Number(matchEnd[3]));

  // 1. Order check
  if (startUtc > endUtc) {
    return {
      isValid: false,
      error: "Tanggal selesai harus sama atau setelah tanggal mulai.",
    };
  }

  // 2. Inclusion check
  if (!doesDateRangeIncludeDay(dayOfWeek, startClean, endClean)) {
    const dayName = DAY_LABELS[dayOfWeek] || "yang dipilih";
    return {
      isValid: false,
      error: `Rentang tanggal tidak mencakup satu pun hari ${dayName}. Pastikan rentang tanggal mencakup setidaknya satu hari ${dayName}.`,
    };
  }

  return { isValid: true };
}
