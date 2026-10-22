"use client";

import { useState, useMemo } from "react";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale/id";
import { Plus, CalendarClock, Clock, MapPin } from "lucide-react";
import { Card, Button, EmptyState } from "@/components/ui";
import { mockAgendaEvents } from "@/lib/mock-data";

export function AgendaView() {
  const [now] = useState<Date>(() => new Date());

  const sortedEvents = useMemo(() => {
    return [...mockAgendaEvents].sort(
      (a, b) =>
        new Date(a.start_at).getTime() - new Date(b.start_at).getTime()
    );
  }, []);

  const upcoming = sortedEvents.filter(
    (a) => new Date(a.start_at) >= now
  );
  const past = sortedEvents.filter(
    (a) => new Date(a.start_at) < now
  );

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Agenda</h2>
          <p className="text-sm text-muted">
            {upcoming.length} kegiatan mendatang
          </p>
        </div>
        <Button size="sm" icon={<Plus className="w-4 h-4" />}>
          Tambah Agenda
        </Button>
      </div>

      {/* Upcoming */}
      {upcoming.length === 0 && past.length === 0 ? (
        <Card>
          <EmptyState
            icon={CalendarClock}
            title="Belum ada agenda"
            description="Tambahkan rapat, kegiatan, atau acara yang akan datang."
            action={
              <Button size="sm" icon={<Plus className="w-4 h-4" />}>
                Tambah Agenda
              </Button>
            }
          />
        </Card>
      ) : (
        <>
          {upcoming.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-muted uppercase tracking-wider">
                Mendatang
              </h3>
              {upcoming.map((event) => (
                <Card key={event.id} hover>
                  <div className="flex items-start gap-4">
                    {/* Date badge */}
                    <div className="w-14 h-14 rounded-xl bg-soft-accent flex flex-col items-center justify-center shrink-0">
                      <span className="text-lg font-bold text-primary leading-none">
                        {format(new Date(event.start_at), "dd")}
                      </span>
                      <span className="text-[10px] text-primary font-medium uppercase mt-0.5">
                        {format(new Date(event.start_at), "MMM", {
                          locale: localeId,
                        })}
                      </span>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-foreground">
                        {event.title}
                      </h3>
                      {event.description && (
                        <p className="text-sm text-muted mt-0.5 line-clamp-2">
                          {event.description}
                        </p>
                      )}
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {format(new Date(event.start_at), "HH:mm", {
                            locale: localeId,
                          })}
                          {event.end_at &&
                            ` — ${format(new Date(event.end_at), "HH:mm", {
                              locale: localeId,
                            })}`}
                        </span>
                        {event.location && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {event.location}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {past.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-muted uppercase tracking-wider">
                Selesai
              </h3>
              {past.map((event) => (
                <Card key={event.id} className="opacity-60">
                  <div className="flex items-start gap-4">
                    <div className="w-14 h-14 rounded-xl bg-background flex flex-col items-center justify-center shrink-0">
                      <span className="text-lg font-bold text-muted leading-none">
                        {format(new Date(event.start_at), "dd")}
                      </span>
                      <span className="text-[10px] text-muted font-medium uppercase mt-0.5">
                        {format(new Date(event.start_at), "MMM", {
                          locale: localeId,
                        })}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-muted">
                        {event.title}
                      </h3>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {format(new Date(event.start_at), "dd MMM, HH:mm", {
                            locale: localeId,
                          })}
                        </span>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
