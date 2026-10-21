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
