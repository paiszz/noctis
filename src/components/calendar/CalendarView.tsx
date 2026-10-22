"use client";

import { useState, useEffect } from "react";
import { format, addDays, startOfWeek } from "date-fns";
import { id as localeId } from "date-fns/locale/id";
import { ChevronLeft, ChevronRight, Plus, CalendarDays } from "lucide-react";
import { Card, Badge, Button, EmptyState } from "@/components/ui";
import { mockSchedules } from "@/lib/mock-data";
import { toJakartaDate } from "@/lib/date";
import { DAY_LABELS } from "@/types";
import type { DayOfWeek, CourseSchedule } from "@/types";

const HOURS = Array.from({ length: 14 }, (_, i) => i + 7); // 07:00–20:00

function getSchedulesForDay(day: DayOfWeek): CourseSchedule[] {
  return mockSchedules
    .filter((s) => s.day_of_week === day)
    .sort((a, b) => a.start_time.localeCompare(b.start_time));
}

export function CalendarView() {
  const [currentDate, setCurrentDate] = useState<Date>(() => toJakartaDate(new Date()));
  const [today, setToday] = useState<Date>(() => toJakartaDate(new Date()));
  const [view, setView] = useState<"day" | "week">("week");

  useEffect(() => {
    const jDate = toJakartaDate(new Date());
    setToday(jDate);
  }, []);

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 }); // Monday
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const goBack = () => {
    setCurrentDate((d) =>
      view === "week" ? addDays(d, -7) : addDays(d, -1)
    );
  };

  const goForward = () => {
    setCurrentDate((d) =>
      view === "week" ? addDays(d, 7) : addDays(d, 1)
    );
  };

  const goToday = () => setCurrentDate(toJakartaDate(new Date()));


  return (
    <div className="max-w-6xl mx-auto space-y-4">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={goBack}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <h2 className="text-lg font-semibold text-foreground min-w-[200px] text-center">
            {view === "week"
              ? `${format(weekStart, "dd MMM", { locale: localeId })} — ${format(addDays(weekStart, 6), "dd MMM yyyy", { locale: localeId })}`
              : format(currentDate, "EEEE, dd MMMM yyyy", { locale: localeId })}
          </h2>
          <Button variant="ghost" size="sm" onClick={goForward}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={goToday}>
            Hari Ini
          </Button>
          <div className="flex bg-background rounded-lg p-0.5 border border-border">
            <button
              onClick={() => setView("day")}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                view === "day"
                  ? "bg-primary text-white"
                  : "text-muted hover:text-foreground"
              }`}
            >
              Hari
            </button>
            <button
              onClick={() => setView("week")}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                view === "week"
                  ? "bg-primary text-white"
                  : "text-muted hover:text-foreground"
              }`}
            >
              Minggu
            </button>
          </div>
          <Button size="sm" icon={<Plus className="w-4 h-4" />}>
            Tambah
          </Button>
        </div>
      </div>

      {/* Week View */}
      {view === "week" && (
        <Card padding="sm" className="overflow-x-auto">
          <div className="min-w-[700px]">
            {/* Day headers */}
            <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-border">
              <div /> {/* Time column header */}
              {weekDays.map((day, i) => {
                const isToday =
                  format(day, "yyyy-MM-dd") === format(today, "yyyy-MM-dd");
                return (
                  <div
                    key={i}
                    className={`text-center py-3 text-sm border-l border-border ${
                      isToday ? "bg-soft-accent" : ""
                    }`}
                  >
                    <p className="text-muted text-xs">
                      {format(day, "EEE", { locale: localeId })}
                    </p>
                    <p
                      className={`font-semibold mt-0.5 ${
                        isToday
                          ? "w-7 h-7 rounded-full bg-primary text-white mx-auto flex items-center justify-center text-xs"
                          : "text-foreground"
                      }`}
                    >
                      {format(day, "dd")}
                    </p>
                  </div>
                );
              })}
            </div>

            {/* Time grid */}
            <div className="relative">
              {HOURS.map((hour) => (
                <div
                  key={hour}
                  className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-border/50 h-14"
                >
                  <div className="text-xs text-muted pr-2 text-right pt-1">
                    {String(hour).padStart(2, "0")}:00
                  </div>
                  {weekDays.map((day, i) => {
                    const dayOfWeek = day.getDay() as DayOfWeek;
                    const schedules = getSchedulesForDay(dayOfWeek);
                    const hourStr = String(hour).padStart(2, "0");

                    // Find schedules that start at this hour
                    const matchingSchedules = schedules.filter(
                      (s) => s.start_time.startsWith(hourStr + ":")
                    );

                    const isToday =
                      format(day, "yyyy-MM-dd") ===
                      format(today, "yyyy-MM-dd");

                    return (
                      <div
                        key={i}
                        className={`border-l border-border/50 relative ${
                          isToday ? "bg-soft-accent/30" : ""
                        }`}
                      >
                        {matchingSchedules.map((s) => (
                          <div
                            key={s.id}
                            className="absolute inset-x-0.5 top-0.5 bg-primary/10 border-l-2 border-primary rounded-r-md px-1.5 py-1 overflow-hidden z-10"
                            title={`${s.course_name} (${s.start_time}–${s.end_time})`}
                          >
                            <p className="text-xs font-medium text-primary truncate">
                              {s.course_name}
                            </p>
                            <p className="text-[10px] text-muted truncate">
                              {s.start_time}–{s.end_time}
                            </p>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* Day View */}
      {view === "day" && (
        <Card>
          <div className="space-y-3">
            {(() => {
              const dayOfWeek = currentDate.getDay() as DayOfWeek;
              const schedules = getSchedulesForDay(dayOfWeek);

              if (schedules.length === 0) {
                return (
                  <EmptyState
                    icon={CalendarDays}
                    title="Tidak ada jadwal"
                    description={`Tidak ada kelas pada hari ${DAY_LABELS[dayOfWeek]}.`}
                    className="py-12"
                  />
                );
              }

              return schedules.map((s) => (
                <div
                  key={s.id}
                  className="flex items-start gap-4 p-4 rounded-lg bg-background hover:bg-soft-accent/40 transition-colors"
                >
                  <div className="w-1 self-stretch rounded-full bg-primary shrink-0" />
                  <div className="flex-1">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-medium text-foreground">
                          {s.course_name}
                        </h3>
                        <p className="text-sm text-muted mt-0.5">
                          {s.start_time} — {s.end_time}
                        </p>
                      </div>
                      {s.course_code && (
                        <Badge variant="muted">{s.course_code}</Badge>
                      )}
                    </div>
                    {s.location && (
                      <p className="text-sm text-muted mt-1">
                        📍 {s.location}
                      </p>
                    )}
                  </div>
                </div>
              ));
            })()}
          </div>
        </Card>
      )}
    </div>
  );
}
