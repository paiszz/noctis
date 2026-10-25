"use client";

import { useState, useMemo, useEffect } from "react";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale/id";
import {
  Plus,
  CheckSquare,
  AlertTriangle,
  Search,
  Check,
  Edit2,
  Trash2,
  BookOpen,
} from "lucide-react";
import { Card, Badge, Button, EmptyState, Modal, priorityVariant, Select } from "@/components/ui";
import type { SelectOption } from "@/components/ui";
import { useData } from "@/lib/data-context";
import { toTimezoneDate, DEFAULT_TIMEZONE } from "@/lib/date";
import {
  PRIORITY_LABELS,
  STATUS_LABELS,
  isOverdue,
} from "@/types";
import type { TaskPriority, TaskStatus, Task } from "@/types";
import { TaskFormModal } from "./TaskFormModal";
import { toast } from "sonner";

type FilterStatus = TaskStatus | "all" | "overdue";
type FilterPriority = TaskPriority | "all";

const PRIORITY_OPTIONS: SelectOption<FilterPriority>[] = [
  { value: "all", label: "Semua Prioritas" },
  { value: "high", label: "Prioritas Tinggi" },
  { value: "medium", label: "Prioritas Sedang" },
  { value: "low", label: "Prioritas Rendah" },
];

const STATUS_FILTERS: { value: FilterStatus; label: string }[] = [
  { value: "all", label: "Semua" },
  { value: "todo", label: "Belum Dikerjakan" },
  { value: "in_progress", label: "Sedang Dikerjakan" },
  { value: "done", label: "Selesai" },
  { value: "overdue", label: "Terlambat" },
];

export function TasksView() {
  const { tasks, toggleTaskStatus, deleteTask, schedules, preferences, isLoaded } = useData();
  const userTimezone = preferences?.timezone || DEFAULT_TIMEZONE;

  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const [filterPriority, setFilterPriority] = useState<FilterPriority>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [now, setNow] = useState<Date>(() => toTimezoneDate(new Date(), userTimezone));
  const [prevTimezone, setPrevTimezone] = useState(userTimezone);

  // Synchronize now if userTimezone changes during render
  if (userTimezone !== prevTimezone) {
    setPrevTimezone(userTimezone);
    setNow(toTimezoneDate(new Date(), userTimezone));
  }

  useEffect(() => {
    // Update current time every minute to keep overdue calculations accurate
    const timer = setInterval(() => {
      setNow(toTimezoneDate(new Date(), userTimezone));
    }, 60000);
    return () => clearInterval(timer);
  }, [userTimezone]);

  // Modal states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);

  // Map schedules for quick lookup
  const scheduleMap = useMemo(() => {
    const map = new Map<string, string>();
    schedules.forEach((s) => {
      map.set(s.id, s.course_name + (s.course_code ? ` (${s.course_code})` : ""));
    });
    return map;
  }, [schedules]);

  const filteredTasks = useMemo(() => {
    let list = [...tasks];

    // Search by title or description
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.description?.toLowerCase().includes(q)
      );
    }

    // Filter by status
    if (filterStatus === "overdue") {
      list = list.filter((t) => isOverdue(t, now, userTimezone));
    } else if (filterStatus !== "all") {
      list = list.filter((t) => t.status === filterStatus);
    }

    // Filter by priority
    if (filterPriority !== "all") {
      list = list.filter((t) => t.priority === filterPriority);
    }

    // Sort: overdue first, then by due date, then by priority
    const priorityOrder: Record<TaskPriority, number> = {
      high: 0,
      medium: 1,
      low: 2,
    };

    list.sort((a, b) => {
      const aOverdue = isOverdue(a, now, userTimezone);
      const bOverdue = isOverdue(b, now, userTimezone);
      if (aOverdue !== bOverdue) return aOverdue ? -1 : 1;
      if (a.priority !== b.priority)
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      if (!a.due_at) return 1;
      if (!b.due_at) return -1;
      return new Date(a.due_at).getTime() - new Date(b.due_at).getTime();
    });

    return list;
  }, [tasks, filterStatus, filterPriority, searchQuery, now, userTimezone]);

  const counts = useMemo(
    () => ({
      all: tasks.length,
      todo: tasks.filter((t) => t.status === "todo").length,
      in_progress: tasks.filter((t) => t.status === "in_progress").length,
      done: tasks.filter((t) => t.status === "done").length,
      overdue: tasks.filter((t) => isOverdue(t, now, userTimezone)).length,
    }),
    [tasks, now, userTimezone]
  );

  const handleOpenCreate = () => {
    setEditingTask(null);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (task: Task) => {
    setEditingTask(task);
    setIsFormOpen(true);
  };

  const confirmDelete = async () => {
    if (taskToDelete) {
      try {
        await deleteTask(taskToDelete.id);
        toast.success(`Tugas "${taskToDelete.title}" telah dihapus.`);
        setTaskToDelete(null);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Gagal menghapus tugas dari cloud.";
        toast.error(msg);
      }
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
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} padding="sm" className="h-20 bg-surface/60" />
          ))}
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} padding="sm" className="h-16 bg-surface/60" />
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
            Daftar Tugas
          </h1>
          <p className="text-sm text-muted mt-0.5">
            {counts.all} tugas terdaftar •{" "}
            {counts.overdue > 0 ? (
              <span className="text-danger font-semibold">
                {counts.overdue} terlambat
              </span>
            ) : (
              <span className="text-success font-medium">
                Semua deadline terkontrol
              </span>
            )}
          </p>
        </div>
        <Button
          size="sm"
          icon={<Plus className="w-4 h-4" />}
          onClick={handleOpenCreate}
        >
          Tambah Tugas
        </Button>
      </div>

      {/* Search & Priority Filter Controls */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
          <input
            type="text"
            placeholder="Cari tugas berdasarkan judul atau deskripsi..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm bg-surface border border-border/80 rounded-xl
              text-foreground placeholder:text-muted shadow-sm
              focus:outline-none focus:border-border-focus"
          />
        </div>

        {/* Priority Filter */}
        <div className="flex items-center gap-2 shrink-0">
          <Select
            value={filterPriority}
            onChange={(val) => setFilterPriority(val)}
            options={PRIORITY_OPTIONS}
            aria-label="Filter berdasarkan prioritas"
            align="right"
          />
        </div>
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
        {STATUS_FILTERS.map((f) => {
          const isActive = filterStatus === f.value;
          return (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilterStatus(f.value)}
              className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-full whitespace-nowrap transition-all cursor-pointer ${
                isActive
                  ? "bg-primary text-white shadow-sm font-bold"
                  : "bg-surface text-muted hover:bg-soft-accent hover:text-foreground border border-border/60"
              }`}
            >
              <span>{f.label}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  isActive
                    ? "bg-white/25 text-white"
                    : "bg-surface-muted text-muted-dark"
                }`}
              >
                {counts[f.value]}
              </span>
            </button>
          );
        })}
      </div>

      {/* Task List */}
      {filteredTasks.length === 0 ? (
        <Card>
          <EmptyState
            icon={CheckSquare}
            title={
              searchQuery || filterStatus !== "all" || filterPriority !== "all"
                ? "Tugas tidak ditemukan"
                : "Belum ada tugas"
            }
            description={
              searchQuery || filterStatus !== "all" || filterPriority !== "all"
                ? "Tidak ada tugas yang sesuai dengan kriteria pencarian atau filter saat ini."
                : "Tambahkan tugas pertamamu untuk mulai mengelola deadline dan aktivitas kuliah."
            }
            action={
              !searchQuery && filterStatus === "all" && filterPriority === "all" ? (
                <Button
                  size="sm"
                  icon={<Plus className="w-4 h-4" />}
                  onClick={handleOpenCreate}
                >
                  Tambah Tugas
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearchQuery("");
                    setFilterStatus("all");
                    setFilterPriority("all");
                  }}
                >
                  Reset Filter
                </Button>
              )
            }
          />
        </Card>
      ) : (
        <div className="space-y-2.5">
          {filteredTasks.map((t) => {
            const overdue = isOverdue(t, now, userTimezone);
            const courseLabel = t.course_schedule_id
              ? scheduleMap.get(t.course_schedule_id)
              : null;

            return (
              <Card
                key={t.id}
                hover
                padding="sm"
                className="group relative transition-all"
              >
                <div className="flex items-start gap-3 sm:gap-3.5">
                  {/* Interactive Checkbox */}
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await toggleTaskStatus(t.id);
                        toast.success(
                          t.status === "done"
                            ? `Tugas "${t.title}" ditandai belum selesai.`
                            : `Selamat! Tugas "${t.title}" selesai.`
                        );
                      } catch (err: unknown) {
                        const msg =
                          err instanceof Error
                            ? err.message
                            : "Gagal memperbarui status tugas di cloud.";
                        toast.error(msg);
                      }
                    }}
                    className={`mt-0.5 w-5 h-5 rounded-lg border-2 shrink-0 flex items-center justify-center transition-all cursor-pointer ${
                      t.status === "done"
                        ? "bg-success border-success text-white shadow-sm"
                        : overdue
                        ? "border-danger text-danger hover:border-primary hover:bg-soft-accent/30"
                        : "border-border hover:border-primary hover:bg-soft-accent/30"
                    }`}
                    aria-label={
                      t.status === "done"
                        ? "Tandai belum selesai"
                        : "Tandai selesai"
                    }
                  >
                    {t.status === "done" && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                  </button>

                  {/* Task Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p
                        className={`font-semibold text-sm sm:text-base leading-snug ${
                          t.status === "done"
                            ? "line-through text-muted"
                            : "text-foreground"
                        }`}
                      >
                        {t.title}
                      </p>

                      {/* Action buttons (Edit & Delete) */}
                      <div className="flex items-center gap-1 shrink-0 opacity-80 group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(t)}
                          className="p-1.5 rounded-lg text-muted hover:text-primary hover:bg-soft-accent transition-colors cursor-pointer"
                          aria-label={`Edit tugas ${t.title}`}
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setTaskToDelete(t)}
                          className="p-1.5 rounded-lg text-muted hover:text-danger hover:bg-danger-light transition-colors cursor-pointer"
                          aria-label={`Hapus tugas ${t.title}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {t.description && (
                      <p className="text-xs text-muted-dark mt-1 line-clamp-2">
                        {t.description}
                      </p>
                    )}

                    {/* Metadata tags: Due, Priority, Status, Course */}
                    <div className="flex items-center gap-2 mt-2 flex-wrap text-xs">
                      {t.due_at && (
                        <span
                          className={`inline-flex items-center gap-1 font-medium ${
                            overdue ? "text-danger font-bold" : "text-muted-dark"
                          }`}
                        >
                          {overdue && <AlertTriangle className="w-3.5 h-3.5 text-danger" />}
                          <span>
                            {overdue
                              ? "Terlambat • "
                              : "Deadline: "}
                            {format(toTimezoneDate(t.due_at, userTimezone), "dd MMM yyyy, HH:mm", {
                              locale: localeId,
                            })}
                          </span>
                        </span>
                      )}

                      <Badge variant={priorityVariant(t.priority)}>
                        {PRIORITY_LABELS[t.priority]}
                      </Badge>

                      {t.status !== "done" && (
                        <Badge variant="muted">{STATUS_LABELS[t.status]}</Badge>
                      )}

                      {courseLabel && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-soft-accent text-primary text-[11px] font-medium">
                          <BookOpen className="w-3 h-3" />
                          <span className="truncate max-w-[150px] sm:max-w-[200px]">
                            {courseLabel}
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
      )}

      {/* Task Create/Edit Modal */}
      <TaskFormModal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        taskToEdit={editingTask}
      />

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={Boolean(taskToDelete)}
        onClose={() => setTaskToDelete(null)}
        title="Hapus Tugas"
        description="Apakah kamu yakin ingin menghapus tugas ini? Tindakan ini tidak dapat dibatalkan."
        maxWidth="sm"
      >
        <div className="space-y-4">
          <div className="p-3 bg-surface-muted rounded-xl border border-border/80">
            <p className="text-sm font-semibold text-foreground">
              {taskToDelete?.title}
            </p>
          </div>
          <div className="flex items-center justify-end gap-2.5 pt-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setTaskToDelete(null)}
            >
              Batal
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={confirmDelete}
            >
              Hapus Tugas
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
