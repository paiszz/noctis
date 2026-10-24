"use client";

import React, { useState, useEffect } from "react";
import { Modal, Button, Select, DateTimePicker } from "@/components/ui";
import type { SelectOption } from "@/components/ui";
import { useData } from "@/lib/data-context";
import type { AgendaEvent } from "@/types";
import { toast } from "sonner";
import { Trash2, Bell } from "lucide-react";

interface AgendaFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  agendaToEdit?: AgendaEvent | null;
  onDelete?: (agenda: AgendaEvent) => void;
}

const REMINDER_OPTIONS: SelectOption<string>[] = [
  { value: "", label: "Tanpa Pengingat" },
  { value: "0", label: "Tepat saat acara dimulai" },
  { value: "15", label: "15 menit sebelumnya" },
  { value: "30", label: "30 menit sebelumnya" },
  { value: "60", label: "1 jam sebelumnya" },
  { value: "1440", label: "1 hari sebelumnya" },
];

function toLocalDatetimeString(isoStr?: string): string {
  if (!isoStr) return "";
  try {
    const d = new Date(isoStr);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
      d.getHours()
    )}:${pad(d.getMinutes())}`;
  } catch {
    return "";
  }
}

export function AgendaFormModal({
  isOpen,
  onClose,
  agendaToEdit,
  onDelete,
}: AgendaFormModalProps) {
  const { addAgendaEvent, updateAgendaEvent } = useData();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [location, setLocation] = useState("");
  const [reminderMinutes, setReminderMinutes] = useState("15");
  const [errors, setErrors] = useState<{ title?: string; time?: string }>({});

  useEffect(() => {
    if (agendaToEdit) {
      setTitle(agendaToEdit.title);
      setDescription(agendaToEdit.description || "");
      setStartAt(toLocalDatetimeString(agendaToEdit.start_at));
      setEndAt(toLocalDatetimeString(agendaToEdit.end_at));
      setLocation(agendaToEdit.location || "");
      setReminderMinutes(
        agendaToEdit.reminder_minutes !== undefined
          ? String(agendaToEdit.reminder_minutes)
          : "15"
      );
    } else {
      // Default to today + next hour
      const now = new Date();
      now.setMinutes(0, 0, 0);
      now.setHours(now.getHours() + 1);
      const end = new Date(now.getTime() + 60 * 60 * 1000);

      setTitle("");
      setDescription("");
      setStartAt(toLocalDatetimeString(now.toISOString()));
      setEndAt(toLocalDatetimeString(end.toISOString()));
      setLocation("");
      setReminderMinutes("15");
    }
    setErrors({});
  }, [agendaToEdit, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const newErrors: { title?: string; time?: string } = {};

    if (!title.trim()) {
      newErrors.title = "Judul agenda wajib diisi.";
    }

    if (!startAt) {
      newErrors.time = "Waktu mulai wajib ditentukan.";
    } else if (endAt && new Date(endAt) <= new Date(startAt)) {
      newErrors.time = "Waktu selesai harus lebih akhir daripada waktu mulai.";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    const startISO = new Date(startAt).toISOString();
    const endISO = endAt ? new Date(endAt).toISOString() : undefined;
    const remMin = reminderMinutes !== "" ? Number(reminderMinutes) : undefined;

    try {
      setIsSubmitting(true);
      if (agendaToEdit) {
        await updateAgendaEvent(agendaToEdit.id, {
          title,
          description: description || undefined,
          start_at: startISO,
          end_at: endISO,
          location: location || undefined,
          reminder_minutes: remMin,
        });
        toast.success("Agenda berhasil diperbarui");
      } else {
        await addAgendaEvent({
          title,
          description: description || undefined,
          start_at: startISO,
          end_at: endISO,
          location: location || undefined,
          reminder_minutes: remMin,
        });
        toast.success("Agenda baru berhasil ditambahkan");
      }
      onClose();
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : "Gagal menyimpan agenda kegiatan. Silakan periksa koneksi internet.";
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={agendaToEdit ? "Edit Agenda" : "Tambah Agenda Baru"}
      description={
        agendaToEdit
          ? "Perbarui waktu, lokasi, pengingat, atau rincian kegiatan."
          : "Catat jadwal rapat, kegiatan organisasi, webinar, atau acara pribadi."
      }
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Title */}
        <div>
          <label
            htmlFor="agenda-title"
            className="block text-xs font-semibold text-foreground mb-1"
          >
            Judul Kegiatan <span className="text-danger">*</span>
          </label>
          <input
            id="agenda-title"
            type="text"
            required
            placeholder="Contoh: Rapat BEM / Bimbingan TA"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              if (errors.title) setErrors((prev) => ({ ...prev, title: undefined }));
            }}
            className="w-full px-3.5 py-2 text-sm bg-surface-muted border border-border rounded-xl text-foreground placeholder:text-muted focus:outline-none focus:border-border-focus"
          />
          {errors.title && (
            <p className="text-xs text-danger mt-1">{errors.title}</p>
          )}
        </div>

        {/* 2-column: Start At & End At */}
        <div className="space-y-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="agenda-start"
                className="block text-xs font-semibold text-foreground mb-1"
              >
                Waktu Mulai <span className="text-danger">*</span>
              </label>
              <DateTimePicker
                id="agenda-start"
                name="start_at"
                value={startAt}
                onChange={(val) => {
                  setStartAt(val);
                  if (errors.time) setErrors((prev) => ({ ...prev, time: undefined }));
                }}
                variant="muted"
                className="w-full"
                ariaLabel="Waktu Mulai"
                clearable={true}
              />
            </div>

            <div>
              <label
                htmlFor="agenda-end"
                className="block text-xs font-semibold text-foreground mb-1"
              >
                Waktu Selesai (opsional)
              </label>
              <DateTimePicker
                id="agenda-end"
                name="end_at"
                value={endAt}
                onChange={(val) => {
                  setEndAt(val);
                  if (errors.time) setErrors((prev) => ({ ...prev, time: undefined }));
                }}
                variant="muted"
                align="right"
                className="w-full"
                placeholder="Pilih tanggal & waktu..."
                ariaLabel="Waktu Selesai (opsional)"
                clearable={true}
              />
            </div>
          </div>
          {errors.time && (
            <p className="text-xs text-danger mt-1">{errors.time}</p>
          )}
        </div>

        {/* 2-column: Location & Reminder */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label
              htmlFor="agenda-loc"
              className="block text-xs font-semibold text-foreground mb-1"
            >
              Lokasi / Media (opsional)
            </label>
            <input
              id="agenda-loc"
              type="text"
              placeholder="Contoh: Sekretariat BEM / Zoom Meeting"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full px-3.5 py-2 text-sm bg-surface-muted border border-border rounded-xl text-foreground placeholder:text-muted focus:outline-none focus:border-border-focus"
            />
          </div>

          <div>
            <label
              htmlFor="agenda-rem"
              className="block text-xs font-semibold text-foreground mb-1 flex items-center gap-1"
            >
              <Bell className="w-3.5 h-3.5 text-primary" />
              <span>Pengingat (Reminder)</span>
            </label>
            <Select
              id="agenda-rem"
              value={reminderMinutes}
              onChange={(val) => setReminderMinutes(val)}
              options={REMINDER_OPTIONS}
              variant="muted"
              className="w-full"
            />
          </div>
        </div>

        {/* Description */}
        <div>
          <label
            htmlFor="agenda-desc"
            className="block text-xs font-semibold text-foreground mb-1"
          >
            Deskripsi / Catatan Tambahan (opsional)
          </label>
          <textarea
            id="agenda-desc"
            rows={2}
            placeholder="Agenda pembahasan, link meeting, atau persiapan yang diperlukan..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-3.5 py-2 text-sm bg-surface-muted border border-border rounded-xl text-foreground placeholder:text-muted focus:outline-none focus:border-border-focus resize-none"
          />
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-border/60">
          <div>
            {agendaToEdit && onDelete && (
              <Button
                type="button"
                variant="danger"
                size="sm"
                disabled={isSubmitting}
                icon={<Trash2 className="w-4 h-4" />}
                onClick={() => {
                  onDelete(agendaToEdit);
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
                : agendaToEdit
                ? "Simpan Perubahan"
                : "Tambah Agenda"}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
