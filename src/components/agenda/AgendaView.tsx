"use client";

import { useState, useMemo } from "react";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale/id";
import {
  Plus,
  CalendarClock,
  Clock,
  MapPin,
  Edit2,
  Trash2,
  Bell,
  Search,
} from "lucide-react";
import { Card, Button, EmptyState, Modal } from "@/components/ui";
import { useData } from "@/lib/data-context";
import { toTimezoneDate, DEFAULT_TIMEZONE } from "@/lib/date";
import { type AgendaEvent, isUpcomingAgenda, isPastAgenda } from "@/types";
import { AgendaFormModal } from "./AgendaFormModal";
import { toast } from "sonner";
import { useRealtimeClock } from "@/lib/hooks/use-realtime-clock";

export function AgendaView() {
  const { agendaEvents, deleteAgendaEvent, preferences, isLoaded } = useData();
  const userTimezone = preferences?.timezone || DEFAULT_TIMEZONE;

  const [searchQuery, setSearchQuery] = useState("");

  // Dynamic targets for agenda events (start and end times) so upcoming/past transitions happen in real-time
  const targetTimestamps = useMemo(() => {
    return agendaEvents
      .flatMap((a) => [a.start_at, a.end_at])
      .filter((t): t is string => Boolean(t));
  }, [agendaEvents]);

  const now = useRealtimeClock(userTimezone, targetTimestamps);

  // Modal states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingAgenda, setEditingAgenda] = useState<AgendaEvent | null>(null);
  const [agendaToDelete, setAgendaToDelete] = useState<AgendaEvent | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const filteredEvents = useMemo(() => {
    let list = [...agendaEvents];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (a) =>
          a.title.toLowerCase().includes(q) ||
          a.description?.toLowerCase().includes(q) ||
          a.location?.toLowerCase().includes(q)
      );
    }

    // Sort ascending by start_at
    list.sort(
      (a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime()
    );

    return list;
  }, [agendaEvents, searchQuery]);

  // Separate upcoming vs past accurately based on start_at in user timezone
  const upcoming = useMemo(() => {
    return filteredEvents.filter((a) => isUpcomingAgenda(a, now, userTimezone));
  }, [filteredEvents, now, userTimezone]);

  const past = useMemo(() => {
    return filteredEvents
      .filter((a) => isPastAgenda(a, now, userTimezone))
      .reverse(); // Most recently completed first
  }, [filteredEvents, now, userTimezone]);

  // Keep currently edited agenda synced with latest data-context state
  const activeAgendaToEdit = useMemo(() => {
    if (!editingAgenda) return null;
    return agendaEvents.find((a) => a.id === editingAgenda.id) ?? editingAgenda;
  }, [editingAgenda, agendaEvents]);

  const handleOpenCreate = () => {
    setEditingAgenda(null);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (event: AgendaEvent) => {
    setEditingAgenda(event);
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setEditingAgenda(null);
  };

  const confirmDelete = async () => {
    if (!agendaToDelete) return;
    try {
      setIsDeleting(true);
      await deleteAgendaEvent(agendaToDelete.id);
      toast.success(`Agenda "${agendaToDelete.title}" telah dihapus.`);
      setAgendaToDelete(null);
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : "Gagal menghapus agenda kegiatan. Silakan periksa koneksi internet.";
      toast.error(msg);
    } finally {
      setIsDeleting(false);
    }
  };

  if (!isLoaded) {
    return (
      <div className="max-w-4xl mx-auto space-y-5 animate-pulse">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-2">
            <div className="h-8 w-44 bg-muted/20 rounded-lg" />
            <div className="h-4 w-60 bg-muted/15 rounded" />
          </div>
          <div className="h-9 w-32 bg-muted/20 rounded-xl" />
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} padding="sm" className="h-20 bg-surface/60" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Agenda Kegiatan
          </h1>
          <p className="text-sm text-muted mt-0.5">
            {upcoming.length} kegiatan mendatang • {past.length} kegiatan selesai
          </p>
        </div>
        <Button
          size="sm"
          icon={<Plus className="w-4 h-4" />}
          onClick={handleOpenCreate}
        >
          Tambah Agenda
        </Button>
      </div>

      {/* Search Filter */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
        <input
          type="text"
          placeholder="Cari agenda berdasarkan judul, lokasi, atau deskripsi..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2 text-sm bg-surface border border-border/80 rounded-xl
            text-foreground placeholder:text-muted shadow-sm
            focus:outline-none focus:border-border-focus"
        />
      </div>

      {/* Empty State */}
      {upcoming.length === 0 && past.length === 0 ? (
        <Card>
          <EmptyState
            icon={CalendarClock}
            title={searchQuery ? "Agenda tidak ditemukan" : "Belum ada agenda"}
            description={
              searchQuery
                ? `Tidak ada agenda yang cocok dengan pencarian "${searchQuery}".`
                : "Tambahkan rapat organisasi, webinar, bimbingan, atau kegiatan pribadi yang akan datang."
            }
            action={
              !searchQuery ? (
                <Button
                  size="sm"
                  icon={<Plus className="w-4 h-4" />}
                  onClick={handleOpenCreate}
                >
                  Tambah Agenda
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSearchQuery("")}
                >
                  Reset Pencarian
                </Button>
              )
            }
          />
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Upcoming Events */}
          {upcoming.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-xs font-bold text-muted-dark uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-primary" />
                <span>Mendatang ({upcoming.length})</span>
              </h2>

              <div className="space-y-2.5">
                {upcoming.map((event) => {
                  const startDate = toTimezoneDate(event.start_at, userTimezone);
                  const endDate = event.end_at ? toTimezoneDate(event.end_at, userTimezone) : null;

                  return (
                    <Card
                      key={event.id}
                      hover
                      padding="sm"
                      className="group transition-all"
                    >
                      <div className="flex items-start gap-3 sm:gap-4">
                        {/* Date badge */}
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-soft-accent to-[#ECE7FE] dark:to-soft-accent/60 flex flex-col items-center justify-center shrink-0 border border-primary/20 shadow-sm">
                          <span className="text-lg font-extrabold text-primary leading-none">
                            {format(startDate, "dd")}
                          </span>
                          <span className="text-[10px] text-primary font-bold uppercase mt-0.5">
                            {format(startDate, "MMM", { locale: localeId })}
                          </span>
                        </div>

                        {/* Event Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <h3 className="font-bold text-sm sm:text-base text-foreground leading-snug group-hover:text-primary transition-colors">
                              {event.title}
                            </h3>

                            {/* Action Buttons */}
                            <div className="flex items-center gap-1 shrink-0 opacity-80 group-hover:opacity-100 transition-opacity">
                              <button
                                type="button"
                                onClick={() => handleOpenEdit(event)}
                                className="p-1.5 rounded-lg text-muted hover:text-primary hover:bg-soft-accent transition-colors cursor-pointer"
                                aria-label={`Edit ${event.title}`}
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setAgendaToDelete(event)}
                                className="p-1.5 rounded-lg text-muted hover:text-danger hover:bg-danger-light transition-colors cursor-pointer"
                                aria-label={`Hapus ${event.title}`}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {event.description && (
                            <p className="text-xs text-muted-dark mt-1 line-clamp-2">
                              {event.description}
                            </p>
                          )}

                          <div className="flex items-center gap-3 mt-2 text-xs text-muted-dark flex-wrap">
                            <span className="flex items-center gap-1 font-semibold text-primary">
                              <Clock className="w-3.5 h-3.5" />
                              <span>
                                {format(startDate, "HH:mm", { locale: localeId })}
                                {endDate && ` — ${format(endDate, "HH:mm", { locale: localeId })}`}
                              </span>
                            </span>

                            {event.location && (
                              <span className="flex items-center gap-1 text-muted">
                                <MapPin className="w-3.5 h-3.5" />
                                <span>{event.location}</span>
                              </span>
                            )}

                            {event.reminder_minutes !== undefined && (
                              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-soft-accent text-[11px] font-medium text-primary">
                                <Bell className="w-3 h-3" />
                                <span>
                                  {event.reminder_minutes === 0
                                    ? "Tepat waktu"
                                    : `${event.reminder_minutes}m sblmnya`}
                                </span>
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {/* Past Events */}
          {past.length > 0 && (
            <div className="space-y-3 pt-2">
              <h2 className="text-xs font-bold text-muted-dark uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-muted" />
                <span>Selesai ({past.length})</span>
              </h2>

              <div className="space-y-2.5">
                {past.map((event) => {
                  const startDate = toTimezoneDate(event.start_at, userTimezone);
                  const endDate = event.end_at ? toTimezoneDate(event.end_at, userTimezone) : null;

                  return (
                    <Card
                      key={event.id}
                      padding="sm"
                      className="opacity-75 hover:opacity-100 transition-opacity bg-surface-muted/60"
                    >
                      <div className="flex items-start gap-3 sm:gap-4">
                        <div className="w-12 h-12 rounded-xl bg-surface border border-border/80 flex flex-col items-center justify-center shrink-0">
                          <span className="text-base font-bold text-muted-dark leading-none">
                            {format(startDate, "dd")}
                          </span>
                          <span className="text-[9px] text-muted font-bold uppercase mt-0.5">
                            {format(startDate, "MMM", { locale: localeId })}
                          </span>
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <h3 className="font-semibold text-sm text-foreground">
                              {event.title}
                            </h3>

                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => handleOpenEdit(event)}
                                className="p-1 rounded text-muted hover:text-primary transition-colors cursor-pointer"
                                aria-label={`Edit ${event.title}`}
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setAgendaToDelete(event)}
                                className="p-1 rounded text-muted hover:text-danger transition-colors cursor-pointer"
                                aria-label={`Hapus ${event.title}`}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 mt-1 text-xs text-muted">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              <span>
                                {format(startDate, "dd MMM yyyy, HH:mm", {
                                  locale: localeId,
                                })}
                                {endDate && ` — ${format(endDate, "HH:mm", { locale: localeId })}`}
                              </span>
                            </span>
                            {event.location && (
                              <span className="flex items-center gap-1 truncate">
                                <MapPin className="w-3 h-3" />
                                {event.location}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Agenda Create / Edit Modal */}
      <AgendaFormModal
        isOpen={isFormOpen}
        onClose={handleCloseForm}
        agendaToEdit={activeAgendaToEdit}
        onDelete={(a) => setAgendaToDelete(a)}
      />

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={Boolean(agendaToDelete)}
        onClose={() => setAgendaToDelete(null)}
        title="Hapus Agenda"
        description="Apakah kamu yakin ingin menghapus agenda kegiatan ini?"
        maxWidth="sm"
      >
        <div className="space-y-4">
          <div className="p-3 bg-surface-muted rounded-xl border border-border/80">
            <p className="text-sm font-semibold text-foreground">
              {agendaToDelete?.title}
            </p>
            {agendaToDelete?.location && (
              <p className="text-xs text-muted mt-0.5">
                📍 {agendaToDelete.location}
              </p>
            )}
          </div>
          <div className="flex items-center justify-end gap-2.5 pt-2">
            <Button
              variant="ghost"
              size="sm"
              disabled={isDeleting}
              onClick={() => setAgendaToDelete(null)}
            >
              Batal
            </Button>
            <Button
              variant="danger"
              size="sm"
              disabled={isDeleting}
              onClick={confirmDelete}
            >
              {isDeleting ? "Menghapus..." : "Hapus Agenda"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
