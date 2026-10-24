import { createClient as createBrowserClient } from "./client";
import type {
  CourseSchedule,
  Task,
  Note,
  AgendaEvent,
  UserProfile,
  UserPreferences,
  DayOfWeek,
  TaskPriority,
  TaskStatus,
  AppTheme,
  NotificationSettings,
} from "@/types";
import type { SupabaseResult, ProfileRecord, UserPreferencesRecord } from "./profile";
import type { ScheduleRecord } from "./schedules";
import type { TaskRecord } from "./tasks";
import type { NoteRecord } from "./notes";
import type { AgendaEventRecord } from "./agenda";

export interface ImportAtomicPayload {
  schedules?: Array<{
    id: string;
    course_name: string;
    course_code?: string;
    day_of_week: number;
    start_time: string;
    end_time: string;
    location?: string;
    recurrence_rule?: string;
    start_date?: string;
    end_date?: string;
    created_at?: string;
    updated_at?: string;
  }>;
  tasks?: Array<{
    id: string;
    title: string;
    description?: string;
    due_at?: string;
    priority: string;
    status: string;
    course_schedule_id?: string;
    created_at?: string;
    updated_at?: string;
  }>;
  notes?: Array<{
    id: string;
    title: string;
    content: string;
    category?: string;
    tags?: string[];
    is_favorite: boolean;
    created_at?: string;
    updated_at?: string;
  }>;
  agenda_events?: Array<{
    id: string;
    title: string;
    description?: string;
    start_at: string;
    end_at?: string;
    location?: string;
    reminder_minutes?: number;
    created_at?: string;
    updated_at?: string;
  }>;
  profile?: {
    name?: string;
    title?: string;
  };
  preferences?: {
    theme?: string;
    timezone?: string;
    notifications?: Partial<NotificationSettings>;
  };
}

export interface ImportAtomicResult {
  schedules?: CourseSchedule[];
  tasks?: Task[];
  notes?: Note[];
  agendaEvents?: AgendaEvent[];
  profile?: UserProfile;
  preferences?: UserPreferences;
}

interface RawImportRpcResponse {
  schedules: ScheduleRecord[] | null;
  tasks: TaskRecord[] | null;
  notes: NoteRecord[] | null;
  agenda_events: AgendaEventRecord[] | null;
  profile: ProfileRecord | null;
  preferences: UserPreferencesRecord | null;
}

function mapScheduleRecord(r: ScheduleRecord): CourseSchedule {
  return {
    id: r.id,
    user_id: r.user_id,
    course_name: r.course_name,
    course_code: r.course_code ?? undefined,
    day_of_week: r.day_of_week as DayOfWeek,
    start_time: r.start_time,
    end_time: r.end_time,
    location: r.location ?? undefined,
    recurrence_rule: r.recurrence_rule ?? "weekly",
    start_date: r.start_date ?? undefined,
    end_date: r.end_date ?? undefined,
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

function mapTaskRecord(r: TaskRecord): Task {
  return {
    id: r.id,
    user_id: r.user_id,
    title: r.title,
    description: r.description ?? undefined,
    due_at: r.due_at ?? undefined,
    priority: r.priority as TaskPriority,
    status: r.status as TaskStatus,
    course_schedule_id: r.course_schedule_id ?? undefined,
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

function mapNoteRecord(r: NoteRecord): Note {
  return {
    id: r.id,
    user_id: r.user_id,
    title: r.title,
    content: r.content,
    category: r.category ?? undefined,
    tags: r.tags && r.tags.length > 0 ? r.tags : undefined,
    is_favorite: Boolean(r.is_favorite),
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

function mapAgendaRecord(r: AgendaEventRecord): AgendaEvent {
  return {
    id: r.id,
    user_id: r.user_id,
    title: r.title,
    description: r.description ?? undefined,
    start_at: r.start_at,
    end_at: r.end_at ?? undefined,
    location: r.location ?? undefined,
    reminder_minutes: r.reminder_minutes ?? undefined,
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

/**
 * Menjalankan impor dan penggantian data pengguna secara atomik di database Supabase
 * melalui RPC `import_user_data_atomic`.
 *
 * Mengandalkan sesi autentikasi pengguna aktif (`auth.uid()`) dari Supabase client.
 * Seluruh operasi penghapusan data lama dan penyisipan data baru dieksekusi dalam
 * SATU transaksi database PostgreSQL. Jika terjadi kesalahan apa pun, seluruh
 * perubahan dibatalkan (rollback) otomatis oleh PostgreSQL sehingga data lama tetap utuh.
 */
export async function importUserDataAtomic(
  payload: ImportAtomicPayload
): Promise<SupabaseResult<ImportAtomicResult>> {
  const supabase = createBrowserClient();
  if (!supabase) {
    return { data: null, error: new Error("Koneksi Supabase belum dikonfigurasi.") };
  }

  try {
    const { data, error } = await supabase.rpc("import_user_data_atomic", {
      payload,
    });

    if (error) {
      if (
        error.code === "PGRST202" ||
        (error.message && error.message.includes("import_user_data_atomic"))
      ) {
        return {
          data: null,
          error: new Error(
            "Fungsi import atomik belum terpasang di database Supabase (PGRST202). " +
            "Harap jalankan file migrasi 'supabase/migrations/20261023000000_import_user_data_atomic.sql' " +
            "di SQL Editor Supabase terlebih dahulu."
          ),
        };
      }
      return { data: null, error: new Error(error.message) };
    }

    if (!data) {
      return {
        data: null,
        error: new Error("Database tidak mengembalikan hasil setelah impor."),
      };
    }

    const raw = data as RawImportRpcResponse;

    const result: ImportAtomicResult = {};

    if (raw.schedules !== null && raw.schedules !== undefined) {
      result.schedules = raw.schedules.map(mapScheduleRecord);
    }

    if (raw.tasks !== null && raw.tasks !== undefined) {
      result.tasks = raw.tasks.map(mapTaskRecord);
    }

    if (raw.notes !== null && raw.notes !== undefined) {
      result.notes = raw.notes.map(mapNoteRecord);
    }

    if (raw.agenda_events !== null && raw.agenda_events !== undefined) {
      result.agendaEvents = raw.agenda_events.map(mapAgendaRecord);
    }

    if (raw.profile) {
      result.profile = {
        name: raw.profile.name,
        email: raw.profile.email || "",
        title: raw.profile.title || "Personal Workspace",
      };
    }

    if (raw.preferences) {
      result.preferences = {
        theme: (raw.preferences.theme as AppTheme) || "light",
        timezone: raw.preferences.timezone || "Asia/Jakarta",
        notifications: (raw.preferences.notifications as NotificationSettings) || {
          course_schedule: true,
          task_deadline: true,
          agenda_event: false,
        },
      };
    }

    return { data: result, error: null };
  } catch (err: unknown) {
    const message =
      err instanceof Error
        ? err.message
        : "Terjadi kesalahan tidak terduga saat mengimpor data ke Supabase.";
    return { data: null, error: new Error(message) };
  }
}
