"use client";

import { useState, useMemo } from "react";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale/id";
import {
  Plus,
  CheckSquare,
  AlertTriangle,
  Search,
  Filter,
  Check,
} from "lucide-react";
import { Card, Badge, Button, EmptyState, priorityVariant } from "@/components/ui";
import { mockTasks } from "@/lib/mock-data";
import {
  PRIORITY_LABELS,
  STATUS_LABELS,
  isOverdue,
} from "@/types";
import type { TaskPriority, TaskStatus, Task } from "@/types";

type FilterStatus = TaskStatus | "all" | "overdue";

const STATUS_FILTERS: { value: FilterStatus; label: string }[] = [
  { value: "all", label: "Semua" },
  { value: "todo", label: "Belum Dikerjakan" },
  { value: "in_progress", label: "Sedang Dikerjakan" },
  { value: "done", label: "Selesai" },
  { value: "overdue", label: "Terlambat" },
];

export function TasksView() {
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [now] = useState<Date>(() => new Date());

  const filteredTasks = useMemo(() => {
    let tasks = [...mockTasks];

    // Search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      tasks = tasks.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.description?.toLowerCase().includes(q)
      );
    }

    // Filter
    if (filterStatus === "overdue") {
      tasks = tasks.filter((t) => isOverdue(t, now));
    } else if (filterStatus !== "all") {
      tasks = tasks.filter((t) => t.status === filterStatus);
    }

    // Sort: overdue first, then by due date, then by priority
    const priorityOrder: Record<TaskPriority, number> = {
      high: 0,
      medium: 1,
      low: 2,
    };

    tasks.sort((a, b) => {
      const aOverdue = isOverdue(a, now);
      const bOverdue = isOverdue(b, now);
      if (aOverdue !== bOverdue) return aOverdue ? -1 : 1;
      if (a.priority !== b.priority)
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      if (!a.due_at) return 1;
      if (!b.due_at) return -1;
      return new Date(a.due_at).getTime() - new Date(b.due_at).getTime();
    });

    return tasks;
  }, [filterStatus, searchQuery, now]);

  const counts = useMemo(
    () => ({
      all: mockTasks.length,
      todo: mockTasks.filter((t) => t.status === "todo").length,
      in_progress: mockTasks.filter((t) => t.status === "in_progress").length,
      done: mockTasks.filter((t) => t.status === "done").length,
      overdue: mockTasks.filter((t) => isOverdue(t, now)).length,
    }),
    [now]
  );

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            Daftar Tugas
          </h2>
          <p className="text-sm text-muted">
            {counts.all} tugas • {counts.overdue > 0 && (
              <span className="text-danger font-medium">{counts.overdue} terlambat</span>
            )}
          </p>
        </div>
        <Button size="sm" icon={<Plus className="w-4 h-4" />}>
          Tambah Tugas
        </Button>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
          <input
            type="text"
            placeholder="Cari tugas..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm bg-surface border border-border rounded-lg
              text-foreground placeholder:text-muted
              focus:outline-none focus:border-border-focus focus:ring-1 focus:ring-border-focus"
          />
        </div>
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilterStatus(f.value)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-colors ${
              filterStatus === f.value
                ? "bg-primary text-white"
                : "text-muted hover:bg-soft-accent hover:text-foreground"
            }`}
          >
            {f.label}
            <span
              className={`text-[10px] px-1 rounded ${
                filterStatus === f.value
                  ? "bg-white/20"
                  : "bg-background"
              }`}
            >
              {counts[f.value]}
            </span>
          </button>
        ))}
      </div>

      {/* Task List */}
      {filteredTasks.length === 0 ? (
        <Card>
          <EmptyState
            icon={CheckSquare}
            title={searchQuery ? "Tidak ditemukan" : "Belum ada tugas"}
            description={
              searchQuery
                ? `Tidak ada tugas yang cocok dengan "${searchQuery}".`
                : "Tambahkan tugas pertamamu untuk mulai mengelola deadline."
            }
            action={
              !searchQuery && (
                <Button size="sm" icon={<Plus className="w-4 h-4" />}>
                  Tambah Tugas
                </Button>
              )
            }
          />
        </Card>
      ) : (
        <div className="space-y-2">
          {filteredTasks.map((t) => {
            const overdue = isOverdue(t);
            return (
              <Card key={t.id} hover padding="sm">
                <div className="flex items-start gap-3">
                  {/* Checkbox */}
                  <button
                    className={`mt-0.5 w-5 h-5 rounded border-2 shrink-0 flex items-center justify-center transition-colors ${
                      t.status === "done"
                        ? "bg-success border-success text-white"
                        : overdue
                        ? "border-danger"
                        : "border-border hover:border-primary"
                    }`}
                    aria-label={
                      t.status === "done"
                        ? "Tandai belum selesai"
                        : "Tandai selesai"
                    }
                  >
                    {t.status === "done" && <Check className="w-3 h-3" />}
                  </button>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p
                      className={`font-medium text-sm ${
                        t.status === "done"
                          ? "line-through text-muted"
                          : "text-foreground"
                      }`}
                    >
                      {t.title}
                    </p>
                    {t.description && (
                      <p className="text-xs text-muted mt-0.5 truncate">
                        {t.description}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      {t.due_at && (
                        <span
                          className={`text-xs flex items-center gap-1 ${
                            overdue ? "text-danger font-medium" : "text-muted"
                          }`}
                        >
                          {overdue && (
                            <AlertTriangle className="w-3 h-3" />
                          )}
                          {overdue
                            ? "Terlambat"
                            : format(new Date(t.due_at), "dd MMM yyyy", {
                                locale: localeId,
                              })}
                        </span>
                      )}
                      <Badge variant={priorityVariant(t.priority)}>
                        {PRIORITY_LABELS[t.priority]}
                      </Badge>
                      {t.status !== "done" && (
                        <Badge variant="muted">
                          {STATUS_LABELS[t.status]}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
