"use client";

import { useState, useEffect, useMemo } from "react";
import { format, addDays, startOfWeek } from "date-fns";
import { id as localeId } from "date-fns/locale/id";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  CalendarDays,
  Clock,
  MapPin,
  Edit2,
  Trash2,
} from "lucide-react";
import { Card, Badge, Button, EmptyState, Modal } from "@/components/ui";
import { useData } from "@/lib/data-context";
import { toJakartaDate } from "@/lib/date";
import { DAY_LABELS } from "@/types";
import type { DayOfWeek, CourseSchedule } from "@/types";
import { ScheduleFormModal } from "./ScheduleFormModal";
import { toast } from "sonner";

const START_HOUR = 7;
const END_HOUR = 20;
const HOURS = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => i + START_HOUR); // 07:00–20:00
const HOUR_HEIGHT = 56; // 56px per hour (matches h-14)
const TOTAL_HEIGHT = (END_HOUR - START_HOUR) * HOUR_HEIGHT;

function parseTimeToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function CalendarView() {
  const { schedules, deleteSchedule, isLoaded } = useData();

  const [currentDate, setCurrentDate] = useState<Date>(() => toJakartaDate(new Date()));
  const [today, setToday] = useState<Date>(() => toJakartaDate(new Date()));
  const [view, setView] = useState<"day" | "week">("week");

  // Modal states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<CourseSchedule | null>(null);
  const [scheduleToDelete, setScheduleToDelete] = useState<CourseSchedule | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    setToday(toJakartaDate(new Date()));
  }, []);

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 }); // Monday
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const goBack = () => {
    setCurrentDate((d) => (view === "week" ? addDays(d, -7) : addDays(d, -1)));
  };

  const goForward = () => {
    setCurrentDate((d) => (view === "week" ? addDays(d, 7) : addDays(d, 1)));
  };

  const goToday = () => setCurrentDate(toJakartaDate(new Date()));

  const handleOpenCreate = () => {
    setEditingSchedule(null);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (schedule: CourseSchedule) => {
    setEditingSchedule(schedule);
    setIsFormOpen(true);
  };

  const confirmDelete = async () => {
    if (!scheduleToDelete) return;
    try {
      setIsDeleting(true);
      await deleteSchedule(scheduleToDelete.id);
      toast.success(`Jadwal "${scheduleToDelete.course_name}" telah dihapus.`);
      setScheduleToDelete(null);
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : "Gagal menghapus jadwal kuliah. Silakan periksa koneksi internet.";
      toast.error(msg);
    } finally {
      setIsDeleting(false);
    }
  };

  // Helper to filter and sort schedules for a specific day
  const getSchedulesForDay = (day: DayOfWeek): CourseSchedule[] => {
    return schedules
      .filter((s) => s.day_of_week === day)
      .sort((a, b) => a.start_time.localeCompare(b.start_time));
  };

  if (!isLoaded) {
    return (
      <div className="max-w-6xl mx-auto space-y-4 animate-pulse">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="h-8 w-60 bg-muted/20 rounded-lg" />
          <div className="flex items-center gap-2">
            <div className="h-9 w-24 bg-muted/20 rounded-xl" />
            <div className="h-9 w-32 bg-muted/20 rounded-xl" />
          </div>
        </div>
        <Card padding="md" className="h-[480px] bg-surface/60" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      {/* Controls Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={goBack} aria-label="Sebelumnya">
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <h1 className="text-base sm:text-lg font-bold text-foreground min-w-[200px] text-center">
            {view === "week"
              ? `${format(weekStart, "dd MMM", { locale: localeId })} — ${format(
                  addDays(weekStart, 6),
                  "dd MMM yyyy",
                  { locale: localeId }
                )}`
              : format(currentDate, "EEEE, dd MMMM yyyy", { locale: localeId })}
          </h1>
          <Button variant="ghost" size="sm" onClick={goForward} aria-label="Berikutnya">
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={goToday}>
            Hari Ini
          </Button>
          <div className="flex bg-surface rounded-xl p-0.5 border border-border/80 shadow-sm">
            <button
              type="button"
              onClick={() => setView("day")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                view === "day"
                  ? "bg-primary text-white shadow-sm font-bold"
                  : "text-muted hover:text-foreground"
              }`}
            >
              Hari
            </button>
            <button
              type="button"
              onClick={() => setView("week")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                view === "week"
                  ? "bg-primary text-white shadow-sm font-bold"
                  : "text-muted hover:text-foreground"
              }`}
            >
              Minggu
            </button>
          </div>
          <Button
            size="sm"
            icon={<Plus className="w-4 h-4" />}
            onClick={handleOpenCreate}
          >
            Tambah Jadwal
          </Button>
        </div>
      </div>

      {/* Week View */}
      {view === "week" && (
        <Card padding="sm" className="overflow-x-auto shadow-card">
          <div className="min-w-[760px]">
            {/* Day headers */}
            <div className="grid grid-cols-[64px_repeat(7,1fr)] border-b border-border/80">
              <div className="py-2.5 text-center text-xs font-semibold text-muted">
                Waktu
              </div>
              {weekDays.map((day, i) => {
                const isToday =
                  format(day, "yyyy-MM-dd") === format(today, "yyyy-MM-dd");
                return (
                  <div
                    key={i}
                    className={`text-center py-2.5 text-xs border-l border-border/60 ${
                      isToday ? "bg-soft-accent/60" : ""
                    }`}
                  >
                    <p className="text-muted-dark font-medium">
                      {format(day, "EEE", { locale: localeId })}
                    </p>
                    <p
                      className={`font-bold mt-0.5 ${
                        isToday
                          ? "w-6 h-6 rounded-full bg-primary text-white mx-auto flex items-center justify-center text-xs"
                          : "text-foreground"
                      }`}
                    >
                      {format(day, "dd")}
                    </p>
                  </div>
                );
              })}
            </div>

            {/* Time grid container */}
            <div className="relative grid grid-cols-[64px_repeat(7,1fr)]">
              {/* Left Time Column */}
              <div className="relative" style={{ height: `${TOTAL_HEIGHT}px` }}>
                {HOURS.slice(0, -1).map((hour, idx) => (
                  <div
                    key={hour}
                    className="absolute inset-x-0 text-right pr-2 text-[11px] font-medium text-muted-dark select-none"
                    style={{ top: `${idx * HOUR_HEIGHT - 7}px` }}
                  >
                    {String(hour).padStart(2, "0")}:00
                  </div>
                ))}
              </div>

              {/* 7 Columns for Weekdays */}
              {weekDays.map((day, colIdx) => {
                const dayOfWeek = day.getDay() as DayOfWeek;
                const daySchedules = getSchedulesForDay(dayOfWeek);
                const isToday =
                  format(day, "yyyy-MM-dd") === format(today, "yyyy-MM-dd");

                return (
                  <div
                    key={colIdx}
                    className={`relative border-l border-border/50 ${
                      isToday ? "bg-soft-accent/20" : ""
                    }`}
                    style={{ height: `${TOTAL_HEIGHT}px` }}
                  >
                    {/* Hour dividing lines background */}
                    {HOURS.slice(0, -1).map((_, lineIdx) => (
                      <div
                        key={lineIdx}
                        className="absolute inset-x-0 border-b border-border/40 pointer-events-none"
                        style={{ top: `${(lineIdx + 1) * HOUR_HEIGHT}px` }}
                      />
                    ))}

                    {/* Proportional Schedule Blocks */}
                    {daySchedules.map((s) => {
                      const startMin = parseTimeToMinutes(s.start_time);
                      const endMin = parseTimeToMinutes(s.end_time);
                      const baseMin = START_HOUR * 60;

                      const top = Math.max(0, ((startMin - baseMin) / 60) * HOUR_HEIGHT);
                      const durationMin = Math.max(endMin - startMin, 30);
                      const height = Math.max(26, (durationMin / 60) * HOUR_HEIGHT - 2);

                      return (
                        <div
                          key={s.id}
                          onClick={() => handleOpenEdit(s)}
                          style={{
                            top: `${top}px`,
                            height: `${height}px`,
                          }}
                          className="absolute inset-x-1 bg-gradient-to-br from-primary/15 to-primary/25 border-l-3 border-primary rounded-lg px-2 py-1 overflow-hidden z-10 cursor-pointer shadow-sm hover:shadow-md hover:scale-[1.02] transition-all group"
                          title={`${s.course_name} (${s.start_time}–${s.end_time})\nKlik untuk edit atau hapus`}
                        >
                          <div className="flex items-start justify-between gap-1">
                            <p className="text-xs font-bold text-primary truncate leading-tight group-hover:text-primary-dark">
                              {s.course_name}
                            </p>
                          </div>
                          <p className="text-[10px] text-muted-dark font-medium truncate mt-0.5">
                            {s.start_time}–{s.end_time}
                          </p>
                          {height > 44 && s.location && (
                            <p className="text-[10px] text-muted truncate flex items-center gap-0.5 mt-0.5">
                              <MapPin className="w-2.5 h-2.5 shrink-0" />
                              <span>{s.location}</span>
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </Card>
      )}

      {/* Day View */}
      {view === "day" && (
        <Card className="shadow-card">
          <div className="space-y-3">
            {(() => {
              const dayOfWeek = currentDate.getDay() as DayOfWeek;
              const daySchedules = getSchedulesForDay(dayOfWeek);

              if (daySchedules.length === 0) {
                return (
                  <EmptyState
                    icon={CalendarDays}
                    title="Tidak ada kelas hari ini"
                    description={`Tidak ada jadwal kuliah yang terdaftar pada hari ${DAY_LABELS[dayOfWeek]}.`}
                    action={
                      <Button
                        size="sm"
                        icon={<Plus className="w-4 h-4" />}
                        onClick={handleOpenCreate}
                      >
                        Tambah Jadwal Kuliah
                      </Button>
                    }
                    className="py-12"
                  />
                );
              }

              return (
                <div className="space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-border/70">
                    <p className="text-xs font-bold text-muted-dark uppercase tracking-wider">
                      {DAY_LABELS[dayOfWeek]} • {daySchedules.length} Kelas
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      icon={<Plus className="w-3.5 h-3.5" />}
                      onClick={handleOpenCreate}
                    >
                      Tambah
                    </Button>
                  </div>

                  {daySchedules.map((s) => (
                    <div
                      key={s.id}
                      className="flex items-start justify-between gap-4 p-4 rounded-2xl bg-surface-muted border border-border/60 hover:border-primary/40 hover:bg-soft-accent/30 transition-all group"
                    >
                      <div className="flex items-start gap-3.5 min-w-0 flex-1">
                        <div className="w-1.5 self-stretch rounded-full bg-primary shrink-0" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-bold text-base text-foreground">
                              {s.course_name}
                            </h3>
                            {s.course_code && (
                              <Badge variant="muted">{s.course_code}</Badge>
                            )}
                          </div>

                          <div className="flex items-center gap-4 mt-1.5 text-xs text-muted-dark flex-wrap">
                            <span className="flex items-center gap-1 font-semibold text-primary">
                              <Clock className="w-3.5 h-3.5" />
                              <span>
                                {s.start_time} — {s.end_time}
                              </span>
                            </span>
                            {s.location && (
                              <span className="flex items-center gap-1 text-muted">
                                <MapPin className="w-3.5 h-3.5" />
                                <span>{s.location}</span>
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(s)}
                          className="p-1.5 rounded-lg text-muted hover:text-primary hover:bg-soft-accent transition-colors cursor-pointer"
                          aria-label={`Edit ${s.course_name}`}
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setScheduleToDelete(s)}
                          className="p-1.5 rounded-lg text-muted hover:text-danger hover:bg-danger-light transition-colors cursor-pointer"
                          aria-label={`Hapus ${s.course_name}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        </Card>
      )}

      {/* Schedule Create / Edit Modal */}
      <ScheduleFormModal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        scheduleToEdit={editingSchedule}
        defaultDay={currentDate.getDay() as DayOfWeek}
        onDelete={(s) => setScheduleToDelete(s)}
      />

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={Boolean(scheduleToDelete)}
        onClose={() => setScheduleToDelete(null)}
        title="Hapus Jadwal Kuliah"
        description="Apakah kamu yakin ingin menghapus jadwal kuliah ini? Jadwal akan dihapus dari kalender mingguan."
        maxWidth="sm"
      >
        <div className="space-y-4">
          <div className="p-3 bg-surface-muted rounded-xl border border-border/80">
            <p className="text-sm font-semibold text-foreground">
              {scheduleToDelete?.course_name}
            </p>
            <p className="text-xs text-muted mt-0.5">
              {scheduleToDelete && DAY_LABELS[scheduleToDelete.day_of_week]} •{" "}
              {scheduleToDelete?.start_time} - {scheduleToDelete?.end_time}
            </p>
          </div>
          <div className="flex items-center justify-end gap-2.5 pt-2">
            <Button
              variant="ghost"
              size="sm"
              disabled={isDeleting}
              onClick={() => setScheduleToDelete(null)}
            >
              Batal
            </Button>
            <Button
              variant="danger"
              size="sm"
              disabled={isDeleting}
              onClick={confirmDelete}
            >
              {isDeleting ? "Menghapus..." : "Hapus Jadwal"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
