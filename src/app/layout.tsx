import type { Metadata } from "next";
import { Urbanist } from "next/font/google";
import { AuthProvider } from "@/lib/auth-context";
import "./globals.css";

const urbanist = Urbanist({
  variable: "--font-urbanist",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={`${urbanist.variable} h-full`}>
      <body className="min-h-full antialiased">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
