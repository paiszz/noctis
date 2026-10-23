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
  Search,
  Bell,
  Moon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useData } from "@/lib/data-context";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/tasks", label: "Tasks", icon: CheckSquare },
  { href: "/notes", label: "Notes", icon: StickyNote },
  { href: "/agenda", label: "Agenda", icon: CalendarClock },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

export function Navbar() {
  const pathname = usePathname();
  const { profile, isLoaded, isProfileLoading } = useData();
  const initial = profile?.name ? profile.name.trim()[0].toUpperCase() : "U";


  return (
    <header className="sticky top-0 z-30 w-full pt-3 sm:pt-4 px-4 sm:px-6 lg:px-8">
      <div className="max-w-[1400px] mx-auto bg-surface/90 backdrop-blur-md rounded-2xl lg:rounded-full border border-white/70 shadow-card px-4 sm:px-6 py-2 sm:py-2.5 flex items-center justify-between gap-4">
        {/* Brand / Logo */}
        <Link href="/dashboard" className="flex items-center gap-2.5 shrink-0 group">
          <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-primary to-primary-dark flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
            <Moon className="w-5 h-5 text-white fill-white/20" />
          </div>
          <span className="font-bold text-lg sm:text-xl tracking-tight text-foreground">
            Noctis
          </span>
        </Link>

        {/* Desktop Navigation Links */}
        <nav className="hidden lg:flex items-center gap-1 bg-[#F5F4FA] p-1 rounded-full border border-border/40">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-full text-sm transition-all duration-150 font-medium",
                  isActive
                    ? "bg-primary text-white shadow-sm font-semibold"
                    : "text-muted hover:text-foreground hover:bg-white/80"
                )}
              >
                <Icon className={cn("w-4 h-4", isActive ? "text-white" : "text-muted")} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Right Actions: Search, Notifications, Profile */}
        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
          <button
            type="button"
            className="w-9 h-9 rounded-full flex items-center justify-center text-muted hover:text-foreground hover:bg-soft-accent transition-colors"
            aria-label="Cari"
          >
            <Search className="w-4 h-4" />
          </button>

          <button
            type="button"
            className="w-9 h-9 rounded-full flex items-center justify-center text-muted hover:text-foreground hover:bg-soft-accent relative transition-colors"
            aria-label="Notifikasi"
          >
            <Bell className="w-4 h-4" />
            <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-primary ring-2 ring-white" />
          </button>

          <Link
            href="/settings"
            className="flex items-center gap-2 pl-1 sm:pl-2 border-l border-border/70 hover:opacity-90 transition-opacity"
          >
            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-primary/20 to-primary/40 border-2 border-white shadow-sm flex items-center justify-center text-primary font-bold text-sm">
              {!isLoaded || isProfileLoading ? (
                <span className="w-4 h-4 rounded-full bg-primary/30 animate-pulse" />
              ) : (
                initial
              )}
            </div>
          </Link>
        </div>
      </div>
    </header>
  );
}
