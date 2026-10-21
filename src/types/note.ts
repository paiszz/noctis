export interface Note {
  id: string;
  user_id: string;
  title: string;
  content: string; // plain text or Markdown
  category?: string;
  tags?: string[];
  is_favorite: boolean;
  created_at: string;
  updated_at: string;
}
