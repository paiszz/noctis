export interface AgendaEvent {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  start_at: string; // ISO datetime string
  end_at?: string; // ISO datetime string
  location?: string;
  created_at: string;
  updated_at: string;
}
