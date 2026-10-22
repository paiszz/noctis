import type { Task } from "./task";
import type { Note } from "./note";
import type { CourseSchedule } from "./schedule";
import type { AgendaEvent } from "./agenda";

export interface UserProfile {
  name: string;
  email: string;
  title?: string;
}

export type AppTheme = "light" | "dark" | "system";

export interface NotificationSettings {
  course_schedule: boolean;
  task_deadline: boolean;
  agenda_event: boolean;
}

export interface UserPreferences {
  theme: AppTheme;
  timezone: string;
  notifications: NotificationSettings;
}

export interface NoctisExportData {
  version: string;
  app: string;
  exported_at: string;
  profile: UserProfile;
  preferences: UserPreferences;
  data: {
    tasks: Task[];
    notes: Note[];
    schedules: CourseSchedule[];
    agendaEvents: AgendaEvent[];
  };
}
