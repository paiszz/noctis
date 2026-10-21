export interface PushSubscriptionRecord {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  created_at: string;
  last_used_at?: string;
}

export type NotificationCategory =
  | "course_schedule"
  | "task"
  | "agenda_event";

export interface NotificationPreference {
  id: string;
  user_id: string;
  category: NotificationCategory;
  enabled: boolean;
  default_reminder_minutes: number;
}
