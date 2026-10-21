import type { Metadata } from "next";
import { DashboardContent } from "@/components/dashboard/DashboardContent";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Lihat jadwal, tugas, dan agenda hari ini.",
};

export default function DashboardPage() {
  return <DashboardContent />;
}
