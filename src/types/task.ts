import { toTimezoneDate, DEFAULT_TIMEZONE } from "@/lib/date";

export type TaskPriority = "low" | "medium" | "high";

export type TaskStatus = "todo" | "in_progress" | "done";

export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: "Rendah",
  medium: "Sedang",
  high: "Tinggi",
};

export const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: "Belum Dikerjakan",
  in_progress: "Sedang Dikerjakan",
  done: "Selesai",
};

export interface Task {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  due_at?: string; // ISO datetime string
  priority: TaskPriority;
  status: TaskStatus;
  course_schedule_id?: string; // optional relation to a course
  created_at: string;
  updated_at: string;
}

/** Computed at display time — not stored in DB */
export function isOverdue(
  task: Task,
  now?: Date,
  timezone: string = DEFAULT_TIMEZONE
): boolean {
  if (task.status === "done" || !task.due_at) return false;
  const effectiveNow = now ?? toTimezoneDate(new Date(), timezone);
  const dueWallClock = toTimezoneDate(task.due_at, timezone).getTime();
  return dueWallClock < effectiveNow.getTime();
}
