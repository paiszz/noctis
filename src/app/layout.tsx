import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Noctis — Your Personal Productivity Space",
    template: "%s | Noctis",
  },
  description:
    "Aplikasi produktivitas pribadi untuk mengelola jadwal kuliah, tugas, catatan, agenda, dan pengingat dalam satu tempat.",
  keywords: ["productivity", "schedule", "tasks", "notes", "agenda", "student"],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="id" className={`${inter.variable} h-full`}>
      <body className="min-h-full antialiased">{children}</body>
    </html>
  );
}
