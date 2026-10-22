"use client";

import { useState, useEffect, useMemo } from "react";
import { format, addDays, startOfWeek } from "date-fns";
import { id as localeId } from "date-fns/locale/id";
import {
  CalendarDays,
  CheckSquare,
  StickyNote,
  CalendarClock,
  Clock,
  ArrowRight,
  ChevronRight,
  ArrowUpRight,
  Calendar as CalendarIcon,
  Download,
  Check,
  Star,
  Sparkles,
  Plus,
  Moon,
  MapPin,
  TrendingUp,
  Activity as ActivityIcon,
} from "lucide-react";
import Link from "next/link";
import { Card, Badge, Button, priorityVariant } from "@/components/ui";
import { useData } from "@/lib/data-context";
import { toJakartaDate } from "@/lib/date";
import { isOverdue, PRIORITY_LABELS } from "@/types";
import type { DayOfWeek, CourseSchedule, Task, AgendaEvent, Note } from "@/types";
import { toast } from "sonner";


export function DashboardContent() {
  const [now, setNow] = useState<Date>(() => toJakartaDate(new Date()));
  const {
    tasks,
    toggleTaskStatus,
    notes,
    toggleNoteFavorite,
    schedules,
    agendaEvents,
    profile,
    exportAllData,
  } = useData();




  useEffect(() => {
    // Keep Asia/Jakarta time synchronized on client mount and update every minute
    setNow(toJakartaDate(new Date()));
    const timer = setInterval(() => {
      setNow(toJakartaDate(new Date()));
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  // ── Date Computations ──
  const greeting = useMemo(() => {
    const hour = now.getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    if (hour < 19) return "Good evening";
    return "Good night";
  }, [now]);

  const dateRangeStr = useMemo(() => {
    const start = startOfWeek(now, { weekStartsOn: 1 });
    const end = addDays(start, 6);
    return `${format(start, "dd MMM yyyy")} - ${format(end, "dd MMM yyyy")}`;
  }, [now]);

  // ── Today Schedules ──
  const todaySchedules = useMemo(() => {
    const today = now.getDay() as DayOfWeek;
    return schedules
      .filter((s) => s.day_of_week === today)
      .sort((a, b) => a.start_time.localeCompare(b.start_time));
  }, [schedules, now]);

  // ── Next Up Activity ──
  const nextUp = useMemo(() => {
    const currentTime = format(now, "HH:mm");
    const nextSched = todaySchedules.find((s) => s.start_time > currentTime);
    if (nextSched) {
      return {
        type: "Jadwal",
        title: nextSched.course_name,
        time: `${nextSched.start_time} — ${nextSched.end_time}`,
        location: nextSched.location || "Ruang Kelas",
        href: "/calendar",
      };
    }

    const upcoming = agendaEvents
      .filter((a) => new Date(a.start_at) >= now)
      .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime());

    if (upcoming.length > 0) {
      return {
        type: "Agenda",
        title: upcoming[0].title,
        time:
          format(toJakartaDate(upcoming[0].start_at), "HH:mm - ") +
          (upcoming[0].end_at ? format(toJakartaDate(upcoming[0].end_at), "HH:mm") : "Selesai"),
        location: upcoming[0].location || "Ruang Rapat",
        href: "/agenda",
      };
    }

    return null;
  }, [now, todaySchedules, agendaEvents]);

  // ── Task Metrics & Progress Ring ──
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t) => t.status === "done").length;
  const taskProgressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // Toggle task status locally
  const toggleTask = (taskId: string) => {
    toggleTaskStatus(taskId);
  };

  // Urgent tasks (todo or in_progress, overdue or due earliest)
  const urgentTasks = useMemo(() => {
    return tasks
      .filter((t) => t.status !== "done")
      .sort((a, b) => {
        const aOverdue = isOverdue(a, now);
        const bOverdue = isOverdue(b, now);
        if (aOverdue !== bOverdue) return aOverdue ? -1 : 1;
        if (!a.due_at) return 1;
        if (!b.due_at) return -1;
        return new Date(a.due_at).getTime() - new Date(b.due_at).getTime();
      })
      .slice(0, 3);
  }, [tasks, now]);

  // ── Agenda Events (Upcoming vs Completed) ──
  const upcomingEvents = useMemo(() => {
    return agendaEvents
      .filter((a) => new Date(a.end_at || a.start_at) >= now)
      .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime())
      .slice(0, 2);
  }, [agendaEvents, now]);

  const pastEvents = useMemo(() => {
    return agendaEvents
      .filter((a) => new Date(a.end_at || a.start_at) < now)
      .sort((a, b) => new Date(b.start_at).getTime() - new Date(a.start_at).getTime())
      .slice(0, 2);
  }, [agendaEvents, now]);

  // Unified Today's Activity timeline (Schedules + Agenda for today)
  const todayActivities = useMemo(() => {
    const list: Array<{
      id: string;
      title: string;
      time: string;
      color: string;
      href: string;
    }> = [];

    todaySchedules.forEach((s, idx) => {
      list.push({
        id: `sched-${s.id}`,
        title: s.course_name,
        time: `${s.start_time} - ${s.end_time}`,
        color: idx % 2 === 0 ? "bg-primary" : "bg-[#7A7AFF]",
        href: "/calendar",
      });
    });

    const todayStr = format(now, "yyyy-MM-dd");
    agendaEvents.forEach((a) => {
      const aStart = toJakartaDate(a.start_at);
      if (format(aStart, "yyyy-MM-dd") === todayStr) {
        list.push({
          id: `agenda-${a.id}`,
          title: a.title,
          time:
            format(aStart, "HH:mm") +
            (a.end_at ? ` - ${format(toJakartaDate(a.end_at), "HH:mm")}` : ""),
          color: "bg-[#00D589]",
          href: "/agenda",
        });
      }
    });

    return list.slice(0, 3);
  }, [todaySchedules, agendaEvents, now]);

  // ── Recent Notes ──
  const recentNotes = useMemo(() => {
    return notes.slice(0, 3);
  }, [notes]);



  // Circular ring stroke offset
  const radius = 32;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (taskProgressPercent / 100) * circumference;

  const handleExportData = () => {
    try {
      const exportData = exportAllData();
      const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
        JSON.stringify(exportData, null, 2)
      )}`;
      const downloadAnchor = document.createElement("a");
      downloadAnchor.setAttribute("href", jsonString);
      const dateStr = format(new Date(), "yyyy-MM-dd");
      downloadAnchor.setAttribute("download", `noctis-backup-${dateStr}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();

      toast.success("Laporan data berhasil diekspor.");
    } catch {
      toast.error("Gagal mengekspor data.");
    }
  };

  return (
    <div className="space-y-6 lg:space-y-7">
      {/* ── Dashboard Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
        <div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">
            {greeting}, {profile?.name || "Faiz"}.
          </h1>
          <p className="text-sm sm:text-base text-muted-dark font-medium mt-1">
            Keep going. Your goals are closer than you think.
          </p>
        </div>

        {/* Date Range Selector & Action Buttons */}
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <div className="flex items-center gap-2 bg-surface border border-border/80 px-4 py-2 rounded-full shadow-card text-xs sm:text-sm font-semibold text-foreground">
            <CalendarIcon className="w-4 h-4 text-primary" />
            <span>{dateRangeStr}</span>
          </div>

          <Button
            variant="outline"
            size="md"
            icon={<Download className="w-4 h-4 text-muted-dark" />}
            className="text-xs sm:text-sm shadow-card"
            onClick={handleExportData}
          >
            Export Report
          </Button>
        </div>
      </div>


      {/* ── Main Asymmetric 4-Column Grid ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-5 lg:gap-6 items-start">
        
        {/* =========================================
            COLUMN 1 (Lg: col-span-2)
            Metrics: Tasks Progress Ring + Total Notes
            ========================================= */}
        <div className="lg:col-span-2 space-y-5">
          {/* Card 1A: Total Tasks Completed */}
          <Card padding="md" hover className="flex flex-col justify-between min-h-[220px]">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground tracking-tight">
                Total Tasks Completed
              </span>
              <TrendingUp className="w-4 h-4 text-primary shrink-0" />
            </div>

            {/* Circular Progress Gauge */}
            <div className="relative w-24 h-24 mx-auto my-3 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 80 80">
                <circle
                  cx="40"
                  cy="40"
                  r={radius}
                  stroke="#EFEFF8"
                  strokeWidth="7"
                  fill="transparent"
                />
                <circle
                  cx="40"
                  cy="40"
                  r={radius}
                  stroke="#7A7AFF"
                  strokeWidth="7"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  fill="transparent"
                  className="transition-all duration-700 ease-out"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-base font-bold text-foreground leading-tight">
                  {completedTasks}/{totalTasks}
                </span>
                <span className="text-[10px] font-semibold text-muted">
                  {taskProgressPercent}%
                </span>
              </div>
            </div>

            {/* Daily Progress Bar */}
            <div>
              <div className="flex items-center justify-between text-[11px] font-medium text-muted mb-1.5">
                <span>Daily progress</span>
              </div>
              <div className="w-full h-1.5 bg-[#EAEAF2] rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-500"
                  style={{ width: `${taskProgressPercent}%` }}
                />
              </div>
            </div>
          </Card>

          {/* Card 1B: Total Notes */}
          <Card padding="md" hover className="flex flex-col justify-between min-h-[160px]">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground tracking-tight">
                Total Notes
              </span>
              <StickyNote className="w-4 h-4 text-muted shrink-0" />
            </div>

            <div className="my-2">
              <div className="flex items-baseline gap-2.5">
                <span className="text-3xl font-extrabold text-foreground tracking-tight">
                  {notes.length}
                </span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#E6FAF3] text-[#00D589]">
                  +{notes.length}
                </span>
              </div>
              <p className="text-[11px] text-muted font-medium mt-1">
                total tersimpan
              </p>
            </div>
          </Card>
        </div>

        {/* =========================================
            COLUMN 2 (Lg: col-span-4)
            Next Up Card + Today's Schedule Timeline
            ========================================= */}
        <div className="lg:col-span-4 space-y-5">
          {/* Card 2A: Next Up */}
          {nextUp ? (
            <Card padding="md" hover className="relative overflow-hidden bg-gradient-to-r from-surface to-[#F7F6FF]">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-dark">
                  <Clock className="w-3.5 h-3.5 text-primary" />
                  <span>Next Up</span>
                </div>
                <Link
                  href={nextUp.href}
                  className="w-7 h-7 rounded-full bg-white border border-border shadow-sm flex items-center justify-center text-muted-dark hover:text-primary hover:border-primary transition-colors"
                >
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-soft-accent flex items-center justify-center shrink-0 text-primary">
                  <CalendarDays className="w-6 h-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-bold text-base text-foreground truncate">
                    {nextUp.title}
                  </h3>
                  <p className="text-xs font-semibold text-primary mt-0.5">
                    {nextUp.time}
                  </p>
                  <p className="text-xs text-muted flex items-center gap-1 mt-0.5 truncate">
                    <MapPin className="w-3 h-3 text-muted shrink-0" />
                    <span>{nextUp.location}</span>
                  </p>
                </div>
              </div>
            </Card>
          ) : (
            <Card padding="md" className="flex items-center justify-center py-6 text-center">
              <div>
                <p className="text-sm font-semibold text-foreground">Semua aktivitas hari ini selesai!</p>
                <p className="text-xs text-muted mt-1">Istirahat dan siapkan rencana esok hari.</p>
              </div>
            </Card>
          )}

          {/* Card 2B: Today's Schedule Timeline */}
          <Card padding="md" className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-primary" />
                <h2 className="font-bold text-sm text-foreground">
                  Today&apos;s Schedule
                </h2>
              </div>
              <Link
                href="/calendar"
                className="text-xs font-semibold text-muted hover:text-primary transition-colors flex items-center gap-0.5"
              >
                <span>View All</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {/* Vertical timeline items */}
            <div className="space-y-2.5">
              {todaySchedules.length === 0 ? (
                <div className="py-6 text-center text-xs text-muted">
                  Tidak ada kelas hari ini. Nikmati waktu luangmu!
                </div>
              ) : (
                todaySchedules.map((s, idx) => {
                  const isCurrent = idx === 1; // Highlight second schedule like reference
                  return (
                    <div
                      key={s.id}
                      className={`flex items-center gap-3 p-2.5 rounded-2xl transition-all ${
                        isCurrent
                          ? "bg-soft-accent/80 border border-primary/20"
                          : "hover:bg-surface-muted"
                      }`}
                    >
                      <span className="text-xs font-semibold text-muted-dark w-12 shrink-0">
                        {s.start_time}
                      </span>
                      <div
                        className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                          idx === 0
                            ? "bg-[#7A7AFF]"
                            : idx === 1
                            ? "bg-primary"
                            : "bg-[#00D589]"
                        }`}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-foreground truncate">
                          {s.course_name}
                        </p>
                        <p className="text-[11px] text-muted truncate">
                          {s.location || "Ruang Kelas"}
                        </p>
                      </div>
                      {isCurrent && (
                        <ChevronRight className="w-4 h-4 text-primary shrink-0" />
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </Card>
        </div>

        {/* =========================================
            COLUMN 3 (Lg: col-span-3)
            Activity List + Urgent Tasks
            ========================================= */}
        <div className="lg:col-span-3 space-y-5">
          {/* Card 3A: Activity Timeline */}
          <Card padding="md" className="space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ActivityIcon className="w-4 h-4 text-primary" />
                <h2 className="font-bold text-sm text-foreground">Activity</h2>
              </div>
              <Link
                href="/agenda"
                className="text-xs font-semibold text-muted hover:text-primary transition-colors flex items-center gap-0.5"
              >
                <span>View All</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="space-y-2">
              {todayActivities.length === 0 ? (
                <div className="py-4 text-center text-xs text-muted">
                  Belum ada aktivitas hari ini.
                </div>
              ) : (
                todayActivities.map((act) => (
                  <Link
                    key={act.id}
                    href={act.href}
                    className="flex items-center justify-between p-2 rounded-xl hover:bg-surface-muted transition-colors group cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`w-2 h-2 rounded-full shrink-0 ${act.color}`} />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-foreground truncate group-hover:text-primary transition-colors">
                          {act.title}
                        </p>
                        <p className="text-[11px] text-muted">{act.time}</p>
                      </div>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-muted shrink-0 group-hover:text-primary transition-colors" />
                  </Link>
                ))
              )}
            </div>
          </Card>

          {/* Card 3B: Urgent Tasks */}
          <Card padding="md" className="space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckSquare className="w-4 h-4 text-primary" />
                <h2 className="font-bold text-sm text-foreground">Urgent Tasks</h2>
              </div>
              <Link
                href="/tasks"
                className="text-xs font-semibold text-muted hover:text-primary transition-colors flex items-center gap-0.5"
              >
                <span>View All</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="space-y-2.5">
              {urgentTasks.length === 0 ? (
                <div className="py-6 text-center text-xs text-muted">
                  Semua tugas beres! Kerja bagus!
                </div>
              ) : (
                urgentTasks.map((t) => {
                  const overdue = isOverdue(t, now);
                  return (
                    <div
                      key={t.id}
                      className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-surface-muted transition-colors group"
                    >
                      {/* Checkbox button */}
                      <button
                        type="button"
                        onClick={() => toggleTask(t.id)}
                        className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-all ${
                          t.status === "done"
                            ? "bg-primary border-primary text-white"
                            : overdue
                            ? "border-danger text-danger hover:border-primary"
                            : "border-border hover:border-primary"
                        }`}
                        aria-label="Tandai selesai"
                      >
                        {t.status === "done" && <Check className="w-3 h-3 stroke-[3]" />}
                      </button>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p
                            className={`text-xs font-bold truncate ${
                              t.status === "done"
                                ? "line-through text-muted"
                                : "text-foreground"
                            }`}
                          >
                            {t.title}
                          </p>
                          <Badge variant={priorityVariant(t.priority)} className="scale-90 origin-left">
                            {PRIORITY_LABELS[t.priority]}
                          </Badge>
                        </div>
                        <p className="text-[11px] text-muted mt-0.5">
                          {t.due_at
                            ? overdue
                              ? "Terlambat"
                              : format(toJakartaDate(t.due_at), "dd MMM · HH.mm", { locale: localeId })
                            : "Tanpa tenggat"}
                        </p>
                      </div>

                      <ChevronRight className="w-3.5 h-3.5 text-muted shrink-0 group-hover:text-primary transition-colors" />
                    </div>
                  );
                })
              )}
            </div>
          </Card>
        </div>

        {/* =========================================
            COLUMN 4 (Lg: col-span-3)
            Focus Banner (Purple) + Motivation Panel
            ========================================= */}
        <div className="lg:col-span-3 space-y-5">
          {/* Card 4A: Focus Banner (Hero Purple Accent) */}
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#7A7AFF] via-[#6F6FFF] to-[#5151E5] text-white p-5 sm:p-6 shadow-glow">
            {/* Background 3D glass star graphic */}
            <div className="absolute -right-4 -bottom-4 w-28 h-28 opacity-25 pointer-events-none">
              <svg viewBox="0 0 100 100" fill="currentColor">
                <path d="M50 0 L58 35 L93 20 L70 50 L93 80 L58 65 L50 100 L42 65 L7 80 L30 50 L7 20 L42 35 Z" />
              </svg>
            </div>

            <div className="relative z-10 space-y-3">
              <h2 className="text-lg sm:text-xl font-extrabold leading-snug">
                Focus on what matters, {profile?.name || "Faiz"}.
              </h2>
              <p className="text-xs text-white/90 leading-relaxed max-w-[220px]">
                Small steps every day lead to big results.
              </p>
              <div className="pt-1">
                <Link href="/calendar">
                  <Button
                    variant="white"
                    size="sm"
                    className="text-primary font-bold shadow-md hover:bg-white/95"
                    icon={<ArrowRight className="w-3.5 h-3.5" />}
                  >
                    View Today&apos;s Plan
                  </Button>
                </Link>
              </div>
            </div>
          </div>

          {/* Card 4B: Motivation & Quick Actions Panel */}
          <Card padding="md" className="space-y-4">
            {/* Motivational message with Crescent Moon */}
            <div className="text-center py-2 px-1">
              <div className="w-10 h-10 mx-auto rounded-full bg-soft-accent flex items-center justify-center text-primary mb-2 shadow-sm">
                <Moon className="w-5 h-5 fill-primary/20" />
              </div>
              <h3 className="font-bold text-xs sm:text-sm text-foreground">
                You&apos;re doing great, {profile?.name || "Faiz"}.
              </h3>
              <p className="text-[11px] text-muted mt-0.5">
                Stay consistent, keep going.
              </p>

              {/* Decorative wave outline */}
              <div className="w-full h-6 my-2 text-primary/20 flex justify-center items-center">
                <svg className="w-36 h-4" viewBox="0 0 100 10" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M0 5 Q 25 0, 50 5 T 100 5" />
                </svg>
              </div>
            </div>

            {/* Quick Action List */}
            <div className="space-y-1.5 border-t border-border/70 pt-3">
              <button
                type="button"
                className="w-full flex items-center justify-between p-2 rounded-xl text-xs font-semibold text-foreground hover:bg-soft-accent hover:text-primary transition-colors text-left"
              >
                <div className="flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-primary" />
                  <span>AI Assistant</span>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-muted" />
              </button>

              <Link
                href="/tasks"
                className="w-full flex items-center justify-between p-2 rounded-xl text-xs font-semibold text-foreground hover:bg-soft-accent hover:text-primary transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Plus className="w-3.5 h-3.5 text-primary" />
                  <span>Quick Add Task</span>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-muted" />
              </Link>

              <Link
                href="/notes"
                className="w-full flex items-center justify-between p-2 rounded-xl text-xs font-semibold text-foreground hover:bg-soft-accent hover:text-primary transition-colors"
              >
                <div className="flex items-center gap-2">
                  <StickyNote className="w-3.5 h-3.5 text-primary" />
                  <span>Quick Add Note</span>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-muted" />
              </Link>

              <Link
                href="/agenda"
                className="w-full flex items-center justify-between p-2 rounded-xl text-xs font-semibold text-foreground hover:bg-soft-accent hover:text-primary transition-colors"
              >
                <div className="flex items-center gap-2">
                  <CalendarClock className="w-3.5 h-3.5 text-primary" />
                  <span>Quick Add Agenda</span>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-muted" />
              </Link>
            </div>
          </Card>
        </div>

      </div>

      {/* ── Bottom Section: 2 Wide Cards ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-6 items-start">
        
        {/* Card 5A: Upcoming Agenda (lg:col-span-7) */}
        <Card padding="md" className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CalendarClock className="w-4 h-4 text-primary" />
              <h2 className="font-bold text-sm text-foreground">Upcoming Agenda</h2>
            </div>
            <Link
              href="/agenda"
              className="text-xs font-semibold text-muted hover:text-primary transition-colors flex items-center gap-0.5"
            >
              <span>View All</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            {/* Upcoming Sub-column */}
            <div className="space-y-3">
              <p className="text-[11px] font-bold tracking-wider text-muted uppercase">
                Upcoming
              </p>
              <div className="space-y-2.5">
                {upcomingEvents.map((a) => (
                  <div key={a.id} className="flex items-start gap-2.5 p-2 rounded-xl hover:bg-surface-muted transition-colors">
                    <div className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-foreground truncate">
                        {a.title}
                      </p>
                      <p className="text-[11px] text-muted mt-0.5">
                        {format(toJakartaDate(a.start_at), "HH.mm", { locale: localeId })} - {a.end_at ? format(toJakartaDate(a.end_at), "HH.mm") : "Selesai"} · {a.location || "Kampus"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Completed Sub-column */}
            <div className="space-y-3 sm:border-l sm:border-border/70 sm:pl-4">
              <p className="text-[11px] font-bold tracking-wider text-muted uppercase">
                Completed
              </p>
              <div className="space-y-2.5">
                {pastEvents.length === 0 ? (
                  <p className="text-xs text-muted py-3">Belum ada agenda selesai.</p>
                ) : (
                  pastEvents.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-start gap-2.5 p-2 rounded-xl opacity-75 hover:opacity-100 transition-opacity"
                    >
                      <div className="w-3.5 h-3.5 rounded-full bg-[#EAEAF2] flex items-center justify-center text-muted mt-0.5 shrink-0">
                        <Check className="w-2.5 h-2.5 stroke-[2.5]" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-foreground truncate">
                          {item.title}
                        </p>
                        <p className="text-[11px] text-muted mt-0.5">
                          {format(toJakartaDate(item.start_at), "dd MMM · HH:mm", {
                            locale: localeId,
                          })}
                          {item.location && ` · ${item.location}`}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </Card>

        {/* Card 5B: Recent Notes (lg:col-span-5) */}
        <Card padding="md" className="lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <StickyNote className="w-4 h-4 text-primary" />
              <h2 className="font-bold text-sm text-foreground">Recent Notes</h2>
            </div>
            <Link
              href="/notes"
              className="text-xs font-semibold text-muted hover:text-primary transition-colors flex items-center gap-0.5"
            >
              <span>View All</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="space-y-2.5 pt-1">
            {recentNotes.length === 0 ? (
              <p className="text-xs text-muted py-4 text-center">Belum ada catatan.</p>
            ) : (
              recentNotes.map((n: Note) => (
                <div
                  key={n.id}
                  className="flex items-center justify-between p-2.5 rounded-xl hover:bg-surface-muted transition-colors group"
                >
                  <Link
                    href="/notes"
                    className="flex items-center gap-2.5 min-w-0 flex-1"
                  >
                    <div
                      className={`w-2 h-2 rounded-full shrink-0 ${
                        n.category === "Kuliah"
                          ? "bg-primary"
                          : n.category === "Karir"
                          ? "bg-[#00D589]"
                          : "bg-[#FFAB2E]"
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-foreground truncate group-hover:text-primary transition-colors">
                        {n.title}
                      </p>
                      <p className="text-[11px] text-muted mt-0.5">
                        {format(toJakartaDate(n.updated_at), "dd MMM yyyy", { locale: localeId })} · {n.category || "General"}
                      </p>
                    </div>
                  </Link>

                  <button
                    type="button"
                    onClick={() => toggleNoteFavorite(n.id)}
                    className="p-1 rounded-md hover:bg-soft-accent cursor-pointer shrink-0 ml-2"
                    aria-label={n.is_favorite ? "Hapus dari favorit" : "Tambah ke favorit"}
                  >
                    <Star
                      className={`w-3.5 h-3.5 shrink-0 transition-colors ${
                        n.is_favorite
                          ? "text-primary fill-primary"
                          : "text-muted/40 hover:text-primary"
                      }`}
                    />
                  </button>
                </div>
              ))
            )}
          </div>
        </Card>

      </div>
    </div>
  );
}
