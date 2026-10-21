import type { Metadata } from "next";
import { CalendarView } from "@/components/calendar/CalendarView";

export const metadata: Metadata = {
  title: "Calendar",
  description: "Lihat dan kelola jadwal kuliah harian dan mingguan.",
};

export default function CalendarPage() {
  return <CalendarView />;
}
