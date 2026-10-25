"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { Settings } from "lucide-react";

const pageTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/calendar": "Calendar",
  "/tasks": "Tasks",
  "/notes": "Notes",
  "/agenda": "Agenda",
  "/settings": "Settings",
};

export function Header() {
  const pathname = usePathname();
  const title = pageTitles[pathname] || "Noctis";

  return (
    <header className="sticky top-0 z-20 bg-surface/80 backdrop-blur-md border-b border-border">
      <div className="flex items-center justify-between h-14 px-4 lg:px-6">
        {/* Mobile: Logo + Menu */}
        <div className="flex items-center gap-3 lg:hidden">
          <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center">
            <span className="text-white font-bold text-xs">N</span>
          </div>
          <h1 className="font-semibold text-foreground">{title}</h1>
        </div>

        {/* Desktop: Page title */}
        <h1 className="hidden lg:block font-semibold text-lg text-foreground">
          {title}
        </h1>

        {/* Right actions */}
        <div className="flex items-center gap-2">
          <Link
            href="/settings"
            className="lg:hidden p-2 rounded-lg text-muted hover:text-foreground hover:bg-soft-accent/50 transition-colors"
            aria-label="Settings"
          >
            <Settings className="w-5 h-5" />
          </Link>
        </div>
      </div>
    </header>
  );
}
