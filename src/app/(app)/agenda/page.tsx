import type { Metadata } from "next";
import { AgendaView } from "@/components/agenda/AgendaView";

export const metadata: Metadata = {
  title: "Agenda",
  description: "Kelola kegiatan pribadi, rapat, dan acara mendatang.",
};

export default function AgendaPage() {
  return <AgendaView />;
}
