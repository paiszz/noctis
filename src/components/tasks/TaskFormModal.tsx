"use client";

import React, { useState, useEffect } from "react";
import { Modal, Button } from "@/components/ui";
import { useData } from "@/lib/data-context";
import { PRIORITY_LABELS, STATUS_LABELS } from "@/types";
import type { Task, TaskPriority, TaskStatus } from "@/types";
import { toast } from "sonner";

interface TaskFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  taskToEdit?: Task | null;
}

export function TaskFormModal({
  isOpen,
  onClose,
  taskToEdit,
}: TaskFormModalProps) {
  const { addTask, updateTask, schedules } = useData();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [status, setStatus] = useState<TaskStatus>("todo");
  const [courseScheduleId, setCourseScheduleId] = useState<string>("");
  const [errors, setErrors] = useState<{ title?: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (taskToEdit) {
      setTitle(taskToEdit.title);
      setDescription(taskToEdit.description || "");
      // Convert ISO due_at to local datetime-local value (YYYY-MM-DDTHH:mm)
      if (taskToEdit.due_at) {
        try {
          const d = new Date(taskToEdit.due_at);
          // Format as YYYY-MM-DDTHH:mm using local parts
          const pad = (n: number) => String(n).padStart(2, "0");
          const localStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
            d.getDate()
          )}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
          setDueDate(localStr);
        } catch {
          setDueDate("");
        }
      } else {
        setDueDate("");
      }
      setPriority(taskToEdit.priority);
      setStatus(taskToEdit.status);
      setCourseScheduleId(taskToEdit.course_schedule_id || "");
    } else {
      // Reset form
      setTitle("");
      setDescription("");
      setDueDate("");
      setPriority("medium");
      setStatus("todo");
      setCourseScheduleId("");
    }
    setErrors({});
  }, [taskToEdit, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      setErrors({ title: "Judul tugas wajib diisi." });
      return;
    }

    let isoDueDate: string | undefined = undefined;
    if (dueDate) {
      const parsed = new Date(dueDate);
      if (!isNaN(parsed.getTime())) {
        isoDueDate = parsed.toISOString();
      }
    }

    try {
      setIsSubmitting(true);
      if (taskToEdit) {
        await updateTask(taskToEdit.id, {
          title,
          description: description || undefined,
          due_at: isoDueDate,
          priority,
          status,
          course_schedule_id: courseScheduleId || undefined,
        });
        toast.success("Tugas berhasil diperbarui");
      } else {
        await addTask({
          title,
          description: description || undefined,
          due_at: isoDueDate,
          priority,
          status,
          course_schedule_id: courseScheduleId || undefined,
        });
        toast.success("Tugas baru berhasil ditambahkan");
      }
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal menyimpan tugas. Silakan periksa koneksi internet.";
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={taskToEdit ? "Edit Tugas" : "Tambah Tugas Baru"}
      description={
        taskToEdit
          ? "Perbarui rincian, deadline, atau prioritas tugas."
          : "Kelola tenggat dan prioritas tugas akademik maupun pribadimu."
      }
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Title */}
        <div>
          <label
            htmlFor="task-title"
            className="block text-xs font-semibold text-foreground mb-1"
          >
            Judul Tugas <span className="text-danger">*</span>
          </label>
          <input
            id="task-title"
            type="text"
            required
            placeholder="Contoh: Tugas Praktikum Web Modul 5"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              if (errors.title) setErrors({});
            }}
            className="w-full px-3.5 py-2 text-sm bg-surface-muted border border-border rounded-xl text-foreground placeholder:text-muted focus:outline-none focus:border-border-focus focus:ring-1 focus:ring-border-focus"
          />
          {errors.title && (
            <p className="text-xs text-danger mt-1">{errors.title}</p>
          )}
        </div>

        {/* Description */}
        <div>
          <label
            htmlFor="task-desc"
            className="block text-xs font-semibold text-foreground mb-1"
          >
            Deskripsi (opsional)
          </label>
          <textarea
            id="task-desc"
            rows={2}
            placeholder="Tambahkan catatan atau instruksi singkat..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-3.5 py-2 text-sm bg-surface-muted border border-border rounded-xl text-foreground placeholder:text-muted focus:outline-none focus:border-border-focus focus:ring-1 focus:ring-border-focus resize-none"
          />
        </div>

        {/* 2-column: Deadline & Priority */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Due date */}
          <div>
            <label
              htmlFor="task-due"
              className="block text-xs font-semibold text-foreground mb-1"
            >
              Tenggat Waktu (Deadline)
            </label>
            <input
              id="task-due"
              type="datetime-local"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full px-3 py-2 text-xs sm:text-sm bg-surface-muted border border-border rounded-xl text-foreground focus:outline-none focus:border-border-focus focus:ring-1 focus:ring-border-focus [color-scheme:light] dark:[color-scheme:dark]"
            />
          </div>

          {/* Priority */}
          <div>
            <label
              htmlFor="task-priority"
              className="block text-xs font-semibold text-foreground mb-1"
            >
              Prioritas
            </label>
            <select
              id="task-priority"
              value={priority}
              onChange={(e) => setPriority(e.target.value as TaskPriority)}
              className="w-full px-3 py-2 text-sm bg-surface-muted border border-border rounded-xl text-foreground focus:outline-none focus:border-border-focus focus:ring-1 focus:ring-border-focus"
            >
              {(Object.keys(PRIORITY_LABELS) as TaskPriority[]).map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_LABELS[p]}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 2-column: Status & Relasi Mata Kuliah */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Status */}
          <div>
            <label
              htmlFor="task-status"
              className="block text-xs font-semibold text-foreground mb-1"
            >
              Status
            </label>
            <select
              id="task-status"
              value={status}
              onChange={(e) => setStatus(e.target.value as TaskStatus)}
              className="w-full px-3 py-2 text-sm bg-surface-muted border border-border rounded-xl text-foreground focus:outline-none focus:border-border-focus focus:ring-1 focus:ring-border-focus"
            >
              {(Object.keys(STATUS_LABELS) as TaskStatus[]).map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </div>

          {/* Course relation */}
          <div>
            <label
              htmlFor="task-course"
              className="block text-xs font-semibold text-foreground mb-1"
            >
              Mata Kuliah (opsional)
            </label>
            <select
              id="task-course"
              value={courseScheduleId}
              onChange={(e) => setCourseScheduleId(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-surface-muted border border-border rounded-xl text-foreground focus:outline-none focus:border-border-focus focus:ring-1 focus:ring-border-focus"
            >
              <option value="">-- Tidak terkait matkul --</option>
              {schedules.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.course_name} {s.course_code ? `(${s.course_code})` : ""}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border/60">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
          >
            Batal
          </Button>
          <Button type="submit" size="sm" disabled={isSubmitting}>
            {isSubmitting
              ? "Menyimpan..."
              : taskToEdit
              ? "Simpan Perubahan"
              : "Tambah Tugas"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
