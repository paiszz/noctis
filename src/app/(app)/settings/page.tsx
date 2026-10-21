import type { Metadata } from "next";
import { SettingsView } from "@/components/settings/SettingsView";

export const metadata: Metadata = {
  title: "Settings",
  description: "Kelola profil, preferensi, dan pengaturan aplikasi.",
};

export default function SettingsPage() {
  return <SettingsView />;
}
