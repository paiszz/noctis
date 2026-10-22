"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale/id";
import {
  CalendarDays,
  CheckSquare,
  StickyNote,
  CalendarClock,
  Plus,
  Clock,
  AlertTriangle,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";
import { Card, CardHeader, Badge, Button, EmptyState, priorityVariant } from "@/components/ui";
import {
  mockSchedules,
  mockTasks,
  mockAgendaEvents,
} from "@/lib/mock-data";
import { toJakartaDate } from "@/lib/date";
import {
  DAY_LABELS,
  PRIORITY_LABELS,
  STATUS_LABELS,
  isOverdue,
} from "@/types";
import type { DayOfWeek, CourseSchedule, Task, AgendaEvent } from "@/types";

function getGreeting(now: Date): string {
  const hour = now.getHours();
  if (hour < 12) return "Selamat Pagi";
  if (hour < 17) return "Selamat Siang";
  if (hour < 19) return "Selamat Sore";
  return "Selamat Malam";
}

function getTodaySchedules(now: Date): CourseSchedule[] {
  const today = now.getDay() as DayOfWeek;
  return mockSchedules
    .filter((s) => s.day_of_week === today)
    .sort((a, b) => a.start_time.localeCompare(b.start_time));
}

function getUrgentTasks(now: Date): Task[] {
  return mockTasks
    .filter((t) => t.status !== "done")
    .sort((a, b) => {
      // Overdue first, then by due date
      const aOverdue = isOverdue(a, now);
      const bOverdue = isOverdue(b, now);
      if (aOverdue !== bOverdue) return aOverdue ? -1 : 1;
      if (!a.due_at) return 1;
      if (!b.due_at) return -1;
      return new Date(a.due_at).getTime() - new Date(b.due_at).getTime();
    })
    .slice(0, 4);
}

function getUpcomingAgenda(now: Date): AgendaEvent[] {
  return mockAgendaEvents
    .filter((a) => new Date(a.start_at) >= now)
    .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime())
    .slice(0, 3);
}

function getNextUp(now: Date): { type: string; title: string; time: string; location?: string } | null {
  const currentTime = format(now, "HH:mm");

  // Check today's schedules
  const todaySchedules = getTodaySchedules(now);
  const nextSchedule = todaySchedules.find((s) => s.start_time > currentTime);
  if (nextSchedule) {
    return {
      type: "Jadwal",
      title: nextSchedule.course_name,
      time: `${nextSchedule.start_time} — ${nextSchedule.end_time}`,
      location: nextSchedule.location,
    };
  }

  // Check upcoming agenda
  const upcoming = getUpcomingAgenda(now);
  if (upcoming.length > 0) {
    return {
      type: "Agenda",
      title: upcoming[0].title,
      time: format(toJakartaDate(upcoming[0].start_at), "dd MMM, HH:mm", { locale: localeId }),
      location: upcoming[0].location,
    };
  }

  return null;
}

// ── Quick Action Buttons ──

function QuickActions() {
  const actions = [
    { href: "/calendar", label: "Jadwal", icon: CalendarDays, color: "text-primary" },
    { href: "/tasks", label: "Tugas", icon: CheckSquare, color: "text-primary" },
    { href: "/notes", label: "Catatan", icon: StickyNote, color: "text-primary" },
    { href: "/agenda", label: "Agenda", icon: CalendarClock, color: "text-primary" },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {actions.map((a) => (
        <Link key={a.href} href={a.href}>
          <Card hover className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-soft-accent flex items-center justify-center shrink-0">
              <a.icon className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">{a.label}</p>
              <p className="text-xs text-muted">Tambah baru</p>
            </div>
          </Card>
        </Link>
      ))}
    </div>
  );
}

// ── Main Dashboard ──

export function DashboardContent() {
  const [now, setNow] = useState<Date>(() => toJakartaDate(new Date()));

  useEffect(() => {
    // Keep Asia/Jakarta time synchronized on client mount and update every minute
    setNow(toJakartaDate(new Date()));
    const timer = setInterval(() => {
      setNow(toJakartaDate(new Date()));
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  const todayDate = format(now, "EEEE, dd MMMM yyyy", { locale: localeId });
  const greeting = getGreeting(now);
  const todaySchedules = getTodaySchedules(now);
  const urgentTasks = getUrgentTasks(now);
  const upcomingAgenda = getUpcomingAgenda(now);
  const nextUp = getNextUp(now);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Greeting & Date */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">{greeting} 👋</h1>
        <p className="text-muted mt-1 capitalize">{todayDate}</p>
      </div>

      {/* Next Up */}
      {nextUp && (
        <Card className="bg-gradient-to-r from-primary to-primary-dark text-white border-0">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-white/80 mb-1">
                Aktivitas Berikutnya
              </p>
              <h2 className="text-lg font-semibold">{nextUp.title}</h2>
              <div className="flex items-center gap-3 mt-2 text-sm text-white/90">
                <span className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {nextUp.time}
                </span>
                {nextUp.location && (
                  <span>📍 {nextUp.location}</span>
                )}
              </div>
            </div>
            <Badge className="bg-white/20 text-white border-0">{nextUp.type}</Badge>
          </div>
        </Card>
      )}

      {/* Quick Actions */}
      <QuickActions />

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Today's Schedule */}
        <Card>
          <CardHeader
            title="Jadwal Hari Ini"
            description={`${todaySchedules.length} kelas`}
            action={
              <Link href="/calendar">
                <Button variant="ghost" size="sm" icon={<ArrowRight className="w-4 h-4" />}>
                  Lihat Semua
                </Button>
              </Link>
            }
          />
          {todaySchedules.length === 0 ? (
            <EmptyState
              icon={CalendarDays}
              title="Tidak ada kelas hari ini"
              description="Nikmati hari bebasmu!"
              className="py-8"
            />
          ) : (
            <div className="space-y-3">
              {todaySchedules.map((s) => (
                <div
                  key={s.id}
                  className="flex items-start gap-3 p-3 rounded-lg bg-background hover:bg-soft-accent/40 transition-colors"
                >
                  <div className="w-1 h-12 rounded-full bg-primary shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-foreground truncate">
                      {s.course_name}
                    </p>
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted">
                      <span>{s.start_time} — {s.end_time}</span>
                      {s.location && (
                        <>
                          <span>•</span>
                          <span className="truncate">{s.location}</span>
                        </>
                      )}
                    </div>
                  </div>
                  {s.course_code && (
                    <Badge variant="muted">{s.course_code}</Badge>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Urgent Tasks */}
        <Card>
          <CardHeader
            title="Tugas Mendesak"
            description={`${urgentTasks.length} tugas aktif`}
            action={
              <Link href="/tasks">
                <Button variant="ghost" size="sm" icon={<ArrowRight className="w-4 h-4" />}>
                  Lihat Semua
                </Button>
              </Link>
            }
          />
          {urgentTasks.length === 0 ? (
            <EmptyState
              icon={CheckSquare}
              title="Semua tugas selesai"
              description="Kerja bagus! Tidak ada tugas mendesak."
              className="py-8"
            />
          ) : (
            <div className="space-y-3">
              {urgentTasks.map((t) => {
                const overdue = isOverdue(t, now);
                return (
                  <div
                    key={t.id}
                    className="flex items-start gap-3 p-3 rounded-lg bg-background hover:bg-soft-accent/40 transition-colors"
                  >
                    <div
                      className={`w-5 h-5 mt-0.5 rounded border-2 shrink-0 ${
                        overdue
                          ? "border-danger bg-danger-light"
                          : "border-border"
                      }`}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-foreground truncate">
                        {t.title}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        {t.due_at && (
                          <span
                            className={`text-xs flex items-center gap-1 ${
                              overdue ? "text-danger font-medium" : "text-muted"
                            }`}
                          >
                            {overdue && <AlertTriangle className="w-3 h-3" />}
                            {overdue ? "Terlambat" : format(toJakartaDate(t.due_at), "dd MMM", { locale: localeId })}
                          </span>
                        )}
                        <Badge variant={priorityVariant(t.priority)}>
                          {PRIORITY_LABELS[t.priority]}
                        </Badge>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Upcoming Agenda */}
        <Card className="lg:col-span-2">
          <CardHeader
            title="Agenda Mendatang"
            description={`${upcomingAgenda.length} kegiatan`}
            action={
              <Link href="/agenda">
                <Button variant="ghost" size="sm" icon={<ArrowRight className="w-4 h-4" />}>
                  Lihat Semua
                </Button>
              </Link>
            }
          />
          {upcomingAgenda.length === 0 ? (
            <EmptyState
              icon={CalendarClock}
              title="Belum ada agenda"
              description="Tambahkan kegiatan, rapat, atau acara yang akan datang."
              className="py-8"
              action={
                <Link href="/agenda">
                  <Button variant="secondary" size="sm" icon={<Plus className="w-4 h-4" />}>
                    Tambah Agenda
                  </Button>
                </Link>
              }
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {upcomingAgenda.map((a) => (
                <div
                  key={a.id}
                  className="p-3 rounded-lg bg-background hover:bg-soft-accent/40 transition-colors"
                >
                  <p className="font-medium text-sm text-foreground">{a.title}</p>
                  <div className="mt-2 space-y-1 text-xs text-muted">
                    <p className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {format(toJakartaDate(a.start_at), "dd MMM, HH:mm", { locale: localeId })}
                    </p>
                    {a.location && <p>📍 {a.location}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
