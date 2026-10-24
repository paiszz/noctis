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

const themeScript = `(function(){try{var t=null;for(var i=0;i<localStorage.length;i++){var k=localStorage.key(i);if(k&&k.indexOf('noctis_user_')===0&&k.indexOf('_preferences_v1')!==-1){var r=localStorage.getItem(k);if(r){var p=JSON.parse(r);if(p&&p.theme){t=p.theme;break;}}}}if(!t){var rg=localStorage.getItem('noctis_storage_preferences_v1');if(rg){var pg=JSON.parse(rg);if(pg&&pg.theme){t=pg.theme;}}}var d=t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);if(d){document.documentElement.classList.add('dark');}else{document.documentElement.classList.remove('dark');}}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={`${urbanist.variable} h-full`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full antialiased">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
