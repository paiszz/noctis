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

