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
  Moon,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
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
  const { isLoggingOut } = useAuth();
  const { profile, isLoaded, isProfileLoading } = useData();

  const isProfilePending = !isLoaded || isProfileLoading || isLoggingOut;
  const initial = profile?.name?.trim() ? profile.name.trim()[0].toUpperCase() : null;


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

        {/* Right Actions: Profile */}
        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
          <Link
            href="/settings"
            className="flex items-center rounded-full hover:opacity-90 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            aria-label="Profil dan Pengaturan Akun"
          >
            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-primary/20 to-primary/40 border-2 border-white shadow-sm flex items-center justify-center text-primary font-bold text-sm">
              {isProfilePending ? (
                <span className="w-4 h-4 rounded-full bg-primary/30 animate-pulse" />
              ) : initial ? (
                initial
              ) : (
                <User className="w-4 h-4 text-primary/70" />
              )}
            </div>
          </Link>
        </div>
      </div>
    </header>
  );
}
