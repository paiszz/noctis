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
