"use client";

import React, { useState } from "react";
import { Modal, Button, Select, TimePicker, DatePicker } from "@/components/ui";
import type { SelectOption } from "@/components/ui";
import { useData } from "@/lib/data-context";
import { DAY_LABELS, validateScheduleDateRange } from "@/types";
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

const DAY_OPTIONS: SelectOption<DayOfWeek>[] = DAYS.map((d) => ({
  value: d,
  label: DAY_LABELS[d],
}));

export function ScheduleFormModal({
  isOpen,
  onClose,
  scheduleToEdit,
  onDelete,
  defaultDay = 1,
}: ScheduleFormModalProps) {
  const { addSchedule, updateSchedule } = useData();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [courseName, setCourseName] = useState(() => scheduleToEdit?.course_name || "");
  const [courseCode, setCourseCode] = useState(() => scheduleToEdit?.course_code || "");
  const [dayOfWeek, setDayOfWeek] = useState<DayOfWeek>(() => scheduleToEdit?.day_of_week || defaultDay);
  const [startTime, setStartTime] = useState(() => scheduleToEdit?.start_time || "08:00");
  const [endTime, setEndTime] = useState(() => scheduleToEdit?.end_time || "09:40");
  const [location, setLocation] = useState(() => scheduleToEdit?.location || "");
  const [startDate, setStartDate] = useState(() =>
    scheduleToEdit?.start_date ? scheduleToEdit.start_date.slice(0, 10) : ""
  );
  const [endDate, setEndDate] = useState(() =>
    scheduleToEdit?.end_date ? scheduleToEdit.end_date.slice(0, 10) : ""
  );
  const [errors, setErrors] = useState<{
    courseName?: string;
    time?: string;
    date?: string;
  }>({});

  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  const [prevScheduleToEdit, setPrevScheduleToEdit] = useState(scheduleToEdit);
  const [prevDefaultDay, setPrevDefaultDay] = useState(defaultDay);

  // Synchronize form when modal opens, scheduleToEdit changes, or defaultDay changes
  if (isOpen !== prevIsOpen || scheduleToEdit !== prevScheduleToEdit || defaultDay !== prevDefaultDay) {
    setPrevIsOpen(isOpen);
    setPrevScheduleToEdit(scheduleToEdit);
    setPrevDefaultDay(defaultDay);
    if (isOpen) {
      if (scheduleToEdit) {
        setCourseName(scheduleToEdit.course_name);
        setCourseCode(scheduleToEdit.course_code || "");
        setDayOfWeek(scheduleToEdit.day_of_week);
        setStartTime(scheduleToEdit.start_time);
        setEndTime(scheduleToEdit.end_time);
        setLocation(scheduleToEdit.location || "");
        setStartDate(scheduleToEdit.start_date ? scheduleToEdit.start_date.slice(0, 10) : "");
        setEndDate(scheduleToEdit.end_date ? scheduleToEdit.end_date.slice(0, 10) : "");
      } else {
        setCourseName("");
        setCourseCode("");
        setDayOfWeek(defaultDay);
        setStartTime("08:00");
        setEndTime("09:40");
        setLocation("");
        setStartDate("");
        setEndDate("");
      }
      setErrors({});
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const newErrors: { courseName?: string; time?: string; date?: string } = {};

    if (!courseName.trim()) {
      newErrors.courseName = "Nama mata kuliah wajib diisi.";
    }

    if (!startTime || !endTime) {
      newErrors.time = "Jam mulai dan jam selesai wajib diisi.";
    } else if (endTime <= startTime) {
      newErrors.time = "Jam selesai harus lebih akhir daripada jam mulai.";
    }

    const dateValidation = validateScheduleDateRange(dayOfWeek, startDate, endDate);
    if (!dateValidation.isValid) {
      newErrors.date = dateValidation.error;
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
          start_date: startDate ? startDate : "",
          end_date: endDate ? endDate : "",
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
          start_date: startDate || undefined,
          end_date: endDate || undefined,
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
            className="w-full px-3.5 py-2 text-sm bg-surface-muted border border-border rounded-xl text-foreground placeholder:text-muted focus:outline-none focus:border-border-focus"
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
              className="w-full px-3.5 py-2 text-sm bg-surface-muted border border-border rounded-xl text-foreground placeholder:text-muted focus:outline-none focus:border-border-focus"
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
            <Select<DayOfWeek>
              id="sched-day"
              value={dayOfWeek}
              onChange={(val) => {
                setDayOfWeek(Number(val) as DayOfWeek);
                if (errors.date) setErrors((prev) => ({ ...prev, date: undefined }));
              }}
              options={DAY_OPTIONS}
              variant="muted"
              className="w-full"
            />
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
              <TimePicker
                id="sched-start"
                name="start_time"
                value={startTime}
                onChange={(val) => {
                  setStartTime(val);
                  if (errors.time) setErrors((prev) => ({ ...prev, time: undefined }));
                }}
                variant="muted"
                className="w-full"
                ariaLabel="Jam Mulai"
              />
            </div>

            <div>
              <label
                htmlFor="sched-end"
                className="block text-xs font-semibold text-foreground mb-1"
              >
                Jam Selesai <span className="text-danger">*</span>
              </label>
              <TimePicker
                id="sched-end"
                name="end_time"
                value={endTime}
                onChange={(val) => {
                  setEndTime(val);
                  if (errors.time) setErrors((prev) => ({ ...prev, time: undefined }));
                }}
                variant="muted"
                align="right"
                className="w-full"
                ariaLabel="Jam Selesai"
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
            className="w-full px-3.5 py-2 text-sm bg-surface-muted border border-border rounded-xl text-foreground placeholder:text-muted focus:outline-none focus:border-border-focus"
          />
        </div>

        {/* 2-column: Start Date & End Date (Rentang Semester) */}
        <div className="space-y-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="sched-start-date"
                className="block text-xs font-semibold text-foreground mb-1"
              >
                Tanggal Mulai (opsional)
              </label>
              <DatePicker
                id="sched-start-date"
                value={startDate}
                onChange={(val) => {
                  setStartDate(val);
                  if (errors.date) setErrors((prev) => ({ ...prev, date: undefined }));
                }}
                placeholder="Pilih tanggal mulai..."
                variant="muted"
                className="w-full"
                ariaLabel="Tanggal Mulai Semester"
                maxDate={endDate || undefined}
              />
            </div>

            <div>
              <label
                htmlFor="sched-end-date"
                className="block text-xs font-semibold text-foreground mb-1"
              >
                Tanggal Selesai (opsional)
              </label>
              <DatePicker
                id="sched-end-date"
                value={endDate}
                onChange={(val) => {
                  setEndDate(val);
                  if (errors.date) setErrors((prev) => ({ ...prev, date: undefined }));
                }}
                placeholder="Pilih tanggal selesai..."
                variant="muted"
                className="w-full"
                align="right"
                ariaLabel="Tanggal Selesai Semester"
                minDate={startDate || undefined}
              />
            </div>
          </div>
          {errors.date && (
            <p className="text-xs text-danger mt-1">{errors.date}</p>
          )}
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
