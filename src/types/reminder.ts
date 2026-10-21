export type ReminderStatus =
  | "pending"
  | "processing"
  | "sent"
  | "failed"
  | "cancelled";

export type ReminderSourceType =
  | "course_schedule"
  | "task"
  | "agenda_event";

export interface Reminder {
  id: string;
  user_id: string;
  source_type: ReminderSourceType;
  source_id: string;
  scheduled_at: string; // ISO datetime string (UTC)
  status: ReminderStatus;
  sent_at?: string;
  attempts: number;
  created_at: string;
  updated_at: string;
}
