"use client";

import React, { useState, useEffect } from "react";
import { Modal, Button } from "@/components/ui";
import { useData } from "@/lib/data-context";
import { DAY_LABELS } from "@/types";
import type { CourseSchedule, DayOfWeek } from "@/types";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

interface ScheduleFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  scheduleToEdit?: CourseSchedule | null;
  onDelete?: (schedule: CourseSchedule) => void;
  defaultDay?: DayOfWeek;
}

const DAYS: DayOfWeek[] = [1, 2, 3, 4, 5, 6, 0]; // Senin to Minggu

export function ScheduleFormModal({
  isOpen,
  onClose,
  scheduleToEdit,
  onDelete,
  defaultDay = 1,
}: ScheduleFormModalProps) {
  const { addSchedule, updateSchedule } = useData();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [courseName, setCourseName] = useState("");
  const [courseCode, setCourseCode] = useState("");
  const [dayOfWeek, setDayOfWeek] = useState<DayOfWeek>(defaultDay);
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("09:40");
  const [location, setLocation] = useState("");
  const [errors, setErrors] = useState<{
    courseName?: string;
    time?: string;
  }>({});

  useEffect(() => {
    if (scheduleToEdit) {
      setCourseName(scheduleToEdit.course_name);
      setCourseCode(scheduleToEdit.course_code || "");
      setDayOfWeek(scheduleToEdit.day_of_week);
      setStartTime(scheduleToEdit.start_time);
      setEndTime(scheduleToEdit.end_time);
      setLocation(scheduleToEdit.location || "");
    } else {
      setCourseName("");
      setCourseCode("");
      setDayOfWeek(defaultDay);
      setStartTime("08:00");
      setEndTime("09:40");
      setLocation("");
    }
    setErrors({});
  }, [scheduleToEdit, isOpen, defaultDay]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const newErrors: { courseName?: string; time?: string } = {};

    if (!courseName.trim()) {
      newErrors.courseName = "Nama mata kuliah wajib diisi.";
    }

    if (!startTime || !endTime) {
      newErrors.time = "Jam mulai dan jam selesai wajib diisi.";
    } else if (endTime <= startTime) {
      newErrors.time = "Jam selesai harus lebih akhir daripada jam mulai.";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    try {
      setIsSubmitting(true);
      if (scheduleToEdit) {
        await updateSchedule(scheduleToEdit.id, {
          course_name: courseName,
          course_code: courseCode || undefined,
          day_of_week: dayOfWeek,
          start_time: startTime,
          end_time: endTime,
          location: location || undefined,
        });
        toast.success("Jadwal kuliah berhasil diperbarui");
      } else {
        await addSchedule({
          course_name: courseName,
          course_code: courseCode || undefined,
          day_of_week: dayOfWeek,
          start_time: startTime,
          end_time: endTime,
          location: location || undefined,
        });
        toast.success("Jadwal kuliah baru berhasil ditambahkan");
      }
      onClose();
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : "Gagal menyimpan jadwal kuliah. Silakan periksa koneksi internet.";
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={scheduleToEdit ? "Edit Jadwal Kuliah" : "Tambah Jadwal Kuliah"}
      description={
        scheduleToEdit
          ? "Perbarui informasi mata kuliah, hari, jam, atau ruang kelas."
          : "Tambahkan kelas mingguan untuk memantau jadwal kuliah harianmu."
      }
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Course Name */}
        <div>
          <label
            htmlFor="sched-name"
            className="block text-xs font-semibold text-foreground mb-1"
          >
            Nama Mata Kuliah <span className="text-danger">*</span>
          </label>
          <input
            id="sched-name"
            type="text"
            required
            placeholder="Contoh: Pemrograman Web"
            value={courseName}
            onChange={(e) => {
              setCourseName(e.target.value);
              if (errors.courseName) setErrors((prev) => ({ ...prev, courseName: undefined }));
            }}
            className="w-full px-3.5 py-2 text-sm bg-surface-muted border border-border rounded-xl text-foreground placeholder:text-muted focus:outline-none focus:border-border-focus focus:ring-1 focus:ring-border-focus"
          />
          {errors.courseName && (
            <p className="text-xs text-danger mt-1">{errors.courseName}</p>
          )}
        </div>

        {/* 2-column: Course Code & Day */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Course Code */}
          <div>
            <label
              htmlFor="sched-code"
              className="block text-xs font-semibold text-foreground mb-1"
            >
              Kode Mata Kuliah (opsional)
            </label>
            <input
              id="sched-code"
              type="text"
              placeholder="Contoh: IF2201"
              value={courseCode}
              onChange={(e) => setCourseCode(e.target.value)}
              className="w-full px-3.5 py-2 text-sm bg-surface-muted border border-border rounded-xl text-foreground placeholder:text-muted focus:outline-none focus:border-border-focus focus:ring-1 focus:ring-border-focus"
            />
          </div>

          {/* Day of Week */}
          <div>
            <label
              htmlFor="sched-day"
              className="block text-xs font-semibold text-foreground mb-1"
            >
              Hari Kuliah <span className="text-danger">*</span>
            </label>
            <select
              id="sched-day"
              value={dayOfWeek}
              onChange={(e) => setDayOfWeek(Number(e.target.value) as DayOfWeek)}
              className="w-full px-3.5 py-2 text-sm bg-surface-muted border border-border rounded-xl text-foreground focus:outline-none focus:border-border-focus focus:ring-1 focus:ring-border-focus cursor-pointer"
            >
              {DAYS.map((d) => (
                <option key={d} value={d} className="bg-surface text-foreground">
                  {DAY_LABELS[d]}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 2-column: Start Time & End Time */}
        <div className="space-y-1">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="sched-start"
                className="block text-xs font-semibold text-foreground mb-1"
              >
                Jam Mulai <span className="text-danger">*</span>
              </label>
              <input
                id="sched-start"
                type="time"
                required
                value={startTime}
                onChange={(e) => {
                  setStartTime(e.target.value);
                  if (errors.time) setErrors((prev) => ({ ...prev, time: undefined }));
                }}
                className="w-full px-3.5 py-2 text-sm bg-surface-muted border border-border rounded-xl text-foreground focus:outline-none focus:border-border-focus focus:ring-1 focus:ring-border-focus [color-scheme:light] dark:[color-scheme:dark]"
              />
            </div>

            <div>
              <label
                htmlFor="sched-end"
                className="block text-xs font-semibold text-foreground mb-1"
              >
                Jam Selesai <span className="text-danger">*</span>
              </label>
              <input
                id="sched-end"
                type="time"
                required
                value={endTime}
                onChange={(e) => {
                  setEndTime(e.target.value);
                  if (errors.time) setErrors((prev) => ({ ...prev, time: undefined }));
                }}
                className="w-full px-3.5 py-2 text-sm bg-surface-muted border border-border rounded-xl text-foreground focus:outline-none focus:border-border-focus focus:ring-1 focus:ring-border-focus [color-scheme:light] dark:[color-scheme:dark]"
              />
            </div>
          </div>
          {errors.time && (
            <p className="text-xs text-danger mt-1">{errors.time}</p>
          )}
        </div>

        {/* Location */}
        <div>
          <label
            htmlFor="sched-loc"
            className="block text-xs font-semibold text-foreground mb-1"
          >
            Ruangan / Lokasi (opsional)
          </label>
          <input
            id="sched-loc"
            type="text"
            placeholder="Contoh: Lab Komputer 3 / Ruang 201 / Online Zoom"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="w-full px-3.5 py-2 text-sm bg-surface-muted border border-border rounded-xl text-foreground placeholder:text-muted focus:outline-none focus:border-border-focus focus:ring-1 focus:ring-border-focus"
          />
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-border/60">
          <div>
            {scheduleToEdit && onDelete && (
              <Button
                type="button"
                variant="danger"
                size="sm"
                icon={<Trash2 className="w-4 h-4" />}
                onClick={() => {
                  onDelete(scheduleToEdit);
                  onClose();
                }}
              >
                Hapus
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={isSubmitting}
              onClick={onClose}
            >
              Batal
            </Button>
            <Button type="submit" size="sm" disabled={isSubmitting}>
              {isSubmitting
                ? "Menyimpan..."
                : scheduleToEdit
                ? "Simpan Perubahan"
                : "Tambah Jadwal"}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
