"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CalendarDays,
  CheckSquare,
  StickyNote,
  CalendarClock,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/calendar", label: "Kalender", icon: CalendarDays },
  { href: "/tasks", label: "Tugas", icon: CheckSquare },
  { href: "/notes", label: "Catatan", icon: StickyNote },
  { href: "/agenda", label: "Agenda", icon: CalendarClock },
  { href: "/settings", label: "Setelan", icon: Settings },
] as const;

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="lg:hidden fixed bottom-3 inset-x-3 z-40">
      <div className="bg-surface/95 backdrop-blur-lg rounded-2xl border border-white/80 shadow-dropdown px-2 py-1.5 flex items-center justify-around">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center gap-1 py-1.5 px-2 rounded-xl transition-all duration-150 min-w-[50px]",
                isActive
                  ? "text-primary font-semibold"
                  : "text-muted hover:text-foreground"
              )}
            >
              <div
                className={cn(
                  "p-1.5 rounded-full transition-colors",
                  isActive ? "bg-soft-accent text-primary" : "text-muted"
                )}
              >
                <Icon className="w-4 h-4" />
              </div>
              <span className="text-[10px] leading-tight font-medium">
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
