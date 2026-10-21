import type { Metadata } from "next";
import { NotesView } from "@/components/notes/NotesView";

export const metadata: Metadata = {
  title: "Notes",
  description: "Buat dan kelola catatan dengan kategori dan favorit.",
};

export default function NotesPage() {
  return <NotesView />;
}
