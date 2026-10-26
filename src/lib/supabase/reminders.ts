import { createClient as createBrowserClient } from "./client";
import {
  calculateTaskReminder,
  calculateAgendaReminder,
  calculateScheduleOccurrences,
} from "@/lib/reminders/calculate";
import type {
  Reminder,
  ReminderStatus,
  ReminderSourceType,
  Task,
  AgendaEvent,
  CourseSchedule,
  NotificationSettings,
} from "@/types";
import type { SupabaseResult } from "./profile";

export interface ReminderRecord {
  id: string;
  user_id: string;
  source_type: ReminderSourceType;
  source_id: string;
  scheduled_at: string;
  status: ReminderStatus;
  title: string;
  body: string | null;
  sent_at: string | null;
  attempts: number;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Validates whether a string is a standard UUID v4 format.
 */
export function isValidUUID(val?: string | null): boolean {
  if (!val) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(val);
}

function mapRecordToReminder(record: ReminderRecord): Reminder {
  return {
    id: record.id,
    user_id: record.user_id,
    source_type: record.source_type,
    source_id: record.source_id,
    scheduled_at: record.scheduled_at,
    status: record.status,
    title: record.title,
    body: record.body ?? undefined,
    sent_at: record.sent_at ?? undefined,
    attempts: record.attempts,
    last_error: record.last_error ?? undefined,
    created_at: record.created_at,
    updated_at: record.updated_at,
  };
}

/**
 * Retrieves all reminders for an authenticated user, ordered by scheduled_at ascending.
 */
export async function getUserReminders(userId: string): Promise<SupabaseResult<Reminder[]>> {
  if (!isValidUUID(userId)) {
    return { data: [], error: null };
  }

  const supabase = createBrowserClient();
  if (!supabase) {
    return { data: null, error: new Error("Koneksi Supabase belum dikonfigurasi.") };
  }

  try {
    const { data, error } = await supabase
      .from("reminders")
      .select("*")
      .eq("user_id", userId)
      .order("scheduled_at", { ascending: true });

    if (error) {
      return { data: null, error: new Error(error.message) };
    }

    const reminders = (data as ReminderRecord[]).map(mapRecordToReminder);
    return { data: reminders, error: null };
  } catch (err: unknown) {
    const message =
      err instanceof Error
        ? err.message
        : "Terjadi kesalahan saat memuat daftar reminder dari Supabase.";
    return { data: null, error: new Error(message) };
  }
}

/**
 * Retrieves pending reminders for an authenticated user.
 */
export async function getPendingReminders(userId: string): Promise<SupabaseResult<Reminder[]>> {
  if (!isValidUUID(userId)) {
    return { data: [], error: null };
  }

  const supabase = createBrowserClient();
  if (!supabase) {
    return { data: null, error: new Error("Koneksi Supabase belum dikonfigurasi.") };
  }

  try {
    const { data, error } = await supabase
      .from("reminders")
      .select("*")
      .eq("user_id", userId)
      .eq("status", "pending")
      .order("scheduled_at", { ascending: true });

    if (error) {
      return { data: null, error: new Error(error.message) };
    }

    const reminders = (data as ReminderRecord[]).map(mapRecordToReminder);
    return { data: reminders, error: null };
  } catch (err: unknown) {
    const message =
      err instanceof Error
        ? err.message
        : "Terjadi kesalahan saat memuat reminder pending dari Supabase.";
    return { data: null, error: new Error(message) };
  }
}

/**
 * Cancels pending reminders for a specific source entity (e.g. when a task is completed or updated).
 */
export async function cancelPendingRemindersBySource(
  userId: string,
  sourceType: ReminderSourceType,
  sourceId: string
): Promise<SupabaseResult<boolean>> {
  if (!isValidUUID(userId) || !isValidUUID(sourceId)) {
    return { data: true, error: null };
  }

  const supabase = createBrowserClient();
  if (!supabase) {
    return { data: null, error: new Error("Koneksi Supabase belum dikonfigurasi.") };
  }

  try {
    const { error } = await supabase
      .from("reminders")
      .update({
        status: "cancelled",
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId)
      .eq("source_type", sourceType)
      .eq("source_id", sourceId)
      .eq("status", "pending");

    if (error) {
      console.warn("Gagal membatalkan reminder pending di Supabase:", error.message);
      return { data: null, error: new Error(error.message) };
    }

    return { data: true, error: null };
  } catch (err: unknown) {
    const message =
      err instanceof Error
        ? err.message
        : "Terjadi kesalahan saat membatalkan reminder di Supabase.";
    console.warn(message);
    return { data: null, error: new Error(message) };
  }
}

/**
 * Cancels all pending reminders for a given source category (e.g. when user disables a notification toggle).
 */
export async function cancelPendingRemindersByType(
  userId: string,
  sourceType: ReminderSourceType
): Promise<SupabaseResult<boolean>> {
  if (!isValidUUID(userId)) {
    return { data: true, error: null };
  }

  const supabase = createBrowserClient();
  if (!supabase) {
    return { data: null, error: new Error("Koneksi Supabase belum dikonfigurasi.") };
  }

  try {
    const { error } = await supabase
      .from("reminders")
      .update({
        status: "cancelled",
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId)
      .eq("source_type", sourceType)
      .eq("status", "pending");

    if (error) {
      console.warn("Gagal membatalkan reminder kategori di Supabase:", error.message);
      return { data: null, error: new Error(error.message) };
    }

    return { data: true, error: null };
  } catch (err: unknown) {
    const message =
      err instanceof Error
        ? err.message
        : "Terjadi kesalahan saat membatalkan reminder kategori di Supabase.";
    console.warn(message);
    return { data: null, error: new Error(message) };
  }
}

/**
 * Permanently deletes reminders for a source entity when the source is deleted.
 * Prevents orphaned reminders across multi-source tables.
 */
export async function deleteRemindersBySource(
  userId: string,
  sourceType: ReminderSourceType,
  sourceId: string
): Promise<SupabaseResult<boolean>> {
  if (!isValidUUID(userId) || !isValidUUID(sourceId)) {
    return { data: true, error: null };
  }

  const supabase = createBrowserClient();
  if (!supabase) {
    return { data: null, error: new Error("Koneksi Supabase belum dikonfigurasi.") };
  }

  try {
    const { error } = await supabase
      .from("reminders")
      .delete()
      .eq("user_id", userId)
      .eq("source_type", sourceType)
      .eq("source_id", sourceId);

    if (error) {
      console.warn("Gagal menghapus reminder sumber di Supabase:", error.message);
      return { data: null, error: new Error(error.message) };
    }

    return { data: true, error: null };
  } catch (err: unknown) {
    const message =
      err instanceof Error
        ? err.message
        : "Terjadi kesalahan saat menghapus reminder sumber di Supabase.";
    console.warn(message);
    return { data: null, error: new Error(message) };
  }
}

/**
 * Synchronizes reminder for a Task.
 *
 * Rules:
 * - If notification is disabled, task is done, or due_at is null: cancels active pending reminders.
 * - Otherwise: calculates H-1 reminder and upserts with status 'pending'.
 */
export async function syncTaskReminder(
  userId: string,
  task: Task,
  enabled: boolean,
  timezone?: string
): Promise<SupabaseResult<Reminder | null>> {
  if (!isValidUUID(userId) || !isValidUUID(task.id)) {
    return { data: null, error: null };
  }

  const supabase = createBrowserClient();
  if (!supabase) {
    return { data: null, error: new Error("Koneksi Supabase belum dikonfigurasi.") };
  }

  try {
    if (!enabled || task.status === "done" || !task.due_at) {
      await cancelPendingRemindersBySource(userId, "task", task.id);
      return { data: null, error: null };
    }

    const calc = calculateTaskReminder(task, new Date(), timezone);
    if (!calc) {
      // Due date is in past or reminder time already elapsed
      await cancelPendingRemindersBySource(userId, "task", task.id);
      return { data: null, error: null };
    }

    const scheduledIso = calc.scheduledAt.toISOString();

    // Cancel any previous pending reminders with a different scheduled_at to prevent stale jobs
    await supabase
      .from("reminders")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("source_type", "task")
      .eq("source_id", task.id)
      .eq("status", "pending")
      .neq("scheduled_at", scheduledIso);

    // Upsert the reminder with idempotent constraint
    const nowIso = new Date().toISOString();
    const payload = {
      user_id: userId,
      source_type: "task",
      source_id: task.id,
      scheduled_at: scheduledIso,
      status: "pending",
      title: calc.title,
      body: calc.body,
      attempts: 0,
      updated_at: nowIso,
    };

    const { data, error } = await supabase
      .from("reminders")
      .upsert(payload, {
        onConflict: "user_id,source_type,source_id,scheduled_at",
      })
      .select()
      .single();

    if (error) {
      console.warn("Gagal mensinkronkan pengingat tugas di Supabase:", error.message);
      return { data: null, error: new Error(error.message) };
    }

    return { data: mapRecordToReminder(data as ReminderRecord), error: null };
  } catch (err: unknown) {
    const message =
      err instanceof Error
        ? err.message
        : "Terjadi kesalahan saat mensinkronkan pengingat tugas.";
    console.warn(message);
    return { data: null, error: new Error(message) };
  }
}

/**
 * Synchronizes reminder for an Agenda Event.
 *
 * Rules:
 * - If notification is disabled or event is in past: cancels active pending reminders.
 * - Otherwise: calculates H-15m (or custom reminder_minutes) and upserts with status 'pending'.
 */
export async function syncAgendaReminder(
  userId: string,
  agenda: AgendaEvent,
  enabled: boolean,
  timezone?: string
): Promise<SupabaseResult<Reminder | null>> {
  if (!isValidUUID(userId) || !isValidUUID(agenda.id)) {
    return { data: null, error: null };
  }

  const supabase = createBrowserClient();
  if (!supabase) {
    return { data: null, error: new Error("Koneksi Supabase belum dikonfigurasi.") };
  }

  try {
    if (!enabled || !agenda.start_at) {
      await cancelPendingRemindersBySource(userId, "agenda_event", agenda.id);
      return { data: null, error: null };
    }

    const calc = calculateAgendaReminder(agenda, new Date(), timezone);
    if (!calc) {
      await cancelPendingRemindersBySource(userId, "agenda_event", agenda.id);
      return { data: null, error: null };
    }

    const scheduledIso = calc.scheduledAt.toISOString();

    // Cancel previous pending reminders with differing scheduled_at
    await supabase
      .from("reminders")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("source_type", "agenda_event")
      .eq("source_id", agenda.id)
      .eq("status", "pending")
      .neq("scheduled_at", scheduledIso);

    const nowIso = new Date().toISOString();
    const payload = {
      user_id: userId,
      source_type: "agenda_event",
      source_id: agenda.id,
      scheduled_at: scheduledIso,
      status: "pending",
      title: calc.title,
      body: calc.body,
      attempts: 0,
      updated_at: nowIso,
    };

    const { data, error } = await supabase
      .from("reminders")
      .upsert(payload, {
        onConflict: "user_id,source_type,source_id,scheduled_at",
      })
      .select()
      .single();

    if (error) {
      console.warn("Gagal mensinkronkan pengingat agenda di Supabase:", error.message);
      return { data: null, error: new Error(error.message) };
    }

    return { data: mapRecordToReminder(data as ReminderRecord), error: null };
  } catch (err: unknown) {
    const message =
      err instanceof Error
        ? err.message
        : "Terjadi kesalahan saat mensinkronkan pengingat agenda.";
    console.warn(message);
    return { data: null, error: new Error(message) };
  }
}

/**
 * Synchronizes upcoming occurrences for a Course Schedule.
 *
 * Rules:
 * - If notification is disabled: cancels active pending reminders.
 * - Otherwise: resets prior pending occurrences and inserts active future occurrences within horizon.
 */
export async function syncScheduleReminders(
  userId: string,
  schedule: CourseSchedule,
  enabled: boolean,
  timezone?: string
): Promise<SupabaseResult<Reminder[]>> {
  if (!isValidUUID(userId) || !isValidUUID(schedule.id)) {
    return { data: [], error: null };
  }

  const supabase = createBrowserClient();
  if (!supabase) {
    return { data: null, error: new Error("Koneksi Supabase belum dikonfigurasi.") };
  }

  try {
    // Reset previous pending reminders for this schedule
    await cancelPendingRemindersBySource(userId, "course_schedule", schedule.id);

    if (!enabled) {
      return { data: [], error: null };
    }

    const occurrences = calculateScheduleOccurrences(schedule, {
      horizonDays: 14,
      now: new Date(),
      timezone,
    });

    if (occurrences.length === 0) {
      return { data: [], error: null };
    }

    const nowIso = new Date().toISOString();
    const payloads = occurrences.map((occ) => ({
      user_id: userId,
      source_type: "course_schedule",
      source_id: schedule.id,
      scheduled_at: occ.scheduledAt.toISOString(),
      status: "pending",
      title: occ.title,
      body: occ.body,
      attempts: 0,
      updated_at: nowIso,
    }));

    const { data, error } = await supabase
      .from("reminders")
      .upsert(payloads, {
        onConflict: "user_id,source_type,source_id,scheduled_at",
      })
      .select();

    if (error) {
      console.warn("Gagal mensinkronkan pengingat jadwal kuliah di Supabase:", error.message);
      return { data: null, error: new Error(error.message) };
    }

    const created = (data as ReminderRecord[]).map(mapRecordToReminder);
    return { data: created, error: null };
  } catch (err: unknown) {
    const message =
      err instanceof Error
        ? err.message
        : "Terjadi kesalahan saat mensinkronkan pengingat jadwal kuliah.";
    console.warn(message);
    return { data: null, error: new Error(message) };
  }
}

/**
 * Synchronizes all active reminders for a specific category when its preference is toggled.
 */
export async function resyncRemindersForCategory(
  userId: string,
  category: keyof NotificationSettings,
  enabled: boolean,
  data: {
    tasks?: Task[];
    schedules?: CourseSchedule[];
    agendaEvents?: AgendaEvent[];
  },
  timezone?: string
): Promise<void> {
  if (!isValidUUID(userId)) return;

  if (category === "task_deadline") {
    if (!enabled) {
      await cancelPendingRemindersByType(userId, "task");
    } else if (data.tasks) {
      for (const t of data.tasks) {
        if (t.status !== "done" && t.due_at) {
          await syncTaskReminder(userId, t, true, timezone);
        }
      }
    }
  } else if (category === "course_schedule") {
    if (!enabled) {
      await cancelPendingRemindersByType(userId, "course_schedule");
    } else if (data.schedules) {
      for (const s of data.schedules) {
        await syncScheduleReminders(userId, s, true, timezone);
      }
    }
  } else if (category === "agenda_event") {
    if (!enabled) {
      await cancelPendingRemindersByType(userId, "agenda_event");
    } else if (data.agendaEvents) {
      for (const a of data.agendaEvents) {
        await syncAgendaReminder(userId, a, true, timezone);
      }
    }
  }
}
