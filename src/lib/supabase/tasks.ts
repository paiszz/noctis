import { createClient as createBrowserClient } from "./client";
import type { Task, TaskPriority, TaskStatus } from "@/types";
import type { TaskInput } from "@/lib/data-context";
import type { SupabaseResult } from "./profile";

export interface TaskRecord {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  due_at: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  course_schedule_id: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Validates if a string is a standard UUID v4 format.
 */
function isValidUUID(val?: string | null): boolean {
  if (!val) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(val);
}

/**
 * Converts a database TaskRecord to the client application Task model.
 */
function mapRecordToTask(record: TaskRecord): Task {
  return {
    id: record.id,
    user_id: record.user_id,
    title: record.title,
    description: record.description ?? undefined,
    due_at: record.due_at ?? undefined,
    priority: record.priority,
    status: record.status,
    course_schedule_id: record.course_schedule_id ?? undefined,
    created_at: record.created_at,
    updated_at: record.updated_at,
  };
}

/**
 * Mengambil seluruh daftar Tasks milik pengguna yang sedang aktif dari tabel `public.tasks`.
 * Mengandalkan Row Level Security (RLS) Supabase untuk memastikan isolasi antar pengguna.
 */
export async function getUserTasks(userId: string): Promise<SupabaseResult<Task[]>> {
  const supabase = createBrowserClient();
  if (!supabase) {
    return { data: null, error: new Error("Koneksi Supabase belum dikonfigurasi.") };
  }

  try {
    const { data, error } = await supabase
      .from("tasks")
      .select("id, user_id, title, description, due_at, priority, status, course_schedule_id, created_at, updated_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      return { data: null, error: new Error(error.message) };
    }

    const tasks = (data as TaskRecord[]).map(mapRecordToTask);
    return { data: tasks, error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Terjadi kesalahan saat memuat tasks dari Supabase.";
    return { data: null, error: new Error(message) };
  }
}

/**
 * Menambahkan Task baru ke tabel `public.tasks` di Supabase untuk akun yang terautentikasi.
 */
export async function createUserTask(
  userId: string,
  input: TaskInput
): Promise<SupabaseResult<Task>> {
  const supabase = createBrowserClient();
  if (!supabase) {
    return { data: null, error: new Error("Koneksi Supabase belum dikonfigurasi.") };
  }

  try {
    const nowISO = new Date().toISOString();
    // Catatan arsitektur: course_schedule_id di database memiliki foreign key ke public.schedules(user_id, id).
    // Karena tabel schedules belum diintegrasikan ke Supabase (masih di localStorage), nilai yang bukan UUID
    // valid atau belum ada di database harus diset null ke Supabase agar tidak melanggar foreign key constraint.
    const validScheduleId = isValidUUID(input.course_schedule_id) ? input.course_schedule_id : null;

    const payload = {
      user_id: userId,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      due_at: input.due_at || null,
      priority: input.priority || "medium",
      status: input.status || "todo",
      course_schedule_id: validScheduleId,
      created_at: nowISO,
      updated_at: nowISO,
    };

    const { data, error } = await supabase
      .from("tasks")
      .insert(payload)
      .select("id, user_id, title, description, due_at, priority, status, course_schedule_id, created_at, updated_at")
      .single();

    if (error) {
      return { data: null, error: new Error(error.message) };
    }

    const createdTask = mapRecordToTask(data as TaskRecord);
    // Pertahankan relasi lokal jika user mengaitkan dengan jadwal lokal
    if (!createdTask.course_schedule_id && input.course_schedule_id) {
      createdTask.course_schedule_id = input.course_schedule_id;
    }

    return { data: createdTask, error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Terjadi kesalahan saat menyimpan tugas ke Supabase.";
    return { data: null, error: new Error(message) };
  }
}

/**
 * Memperbarui Task di tabel `public.tasks` di Supabase.
 */
export async function updateUserTask(
  userId: string,
  taskId: string,
  updates: Partial<Omit<Task, "id" | "user_id">>
): Promise<SupabaseResult<Task>> {
  const supabase = createBrowserClient();
  if (!supabase) {
    return { data: null, error: new Error("Koneksi Supabase belum dikonfigurasi.") };
  }

  try {
    const payload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (updates.title !== undefined) {
      payload.title = updates.title.trim();
    }
    if (updates.description !== undefined) {
      payload.description = updates.description.trim() || null;
    }
    if (updates.due_at !== undefined) {
      payload.due_at = updates.due_at || null;
    }
    if (updates.priority !== undefined) {
      payload.priority = updates.priority;
    }
    if (updates.status !== undefined) {
      payload.status = updates.status;
    }
    if (updates.course_schedule_id !== undefined) {
      payload.course_schedule_id = isValidUUID(updates.course_schedule_id)
        ? updates.course_schedule_id
        : null;
    }

    const { data, error } = await supabase
      .from("tasks")
      .update(payload)
      .eq("id", taskId)
      .eq("user_id", userId)
      .select("id, user_id, title, description, due_at, priority, status, course_schedule_id, created_at, updated_at")
      .single();

    if (error) {
      return { data: null, error: new Error(error.message) };
    }

    const updatedTask = mapRecordToTask(data as TaskRecord);
    if (!updatedTask.course_schedule_id && updates.course_schedule_id) {
      updatedTask.course_schedule_id = updates.course_schedule_id;
    }

    return { data: updatedTask, error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Terjadi kesalahan saat memperbarui tugas di Supabase.";
    return { data: null, error: new Error(message) };
  }
}

/**
 * Menghapus Task dari tabel `public.tasks` di Supabase.
 */
export async function deleteUserTask(
  userId: string,
  taskId: string
): Promise<SupabaseResult<boolean>> {
  const supabase = createBrowserClient();
  if (!supabase) {
    return { data: null, error: new Error("Koneksi Supabase belum dikonfigurasi.") };
  }

  try {
    const { error } = await supabase
      .from("tasks")
      .delete()
      .eq("id", taskId)
      .eq("user_id", userId);

    if (error) {
      return { data: null, error: new Error(error.message) };
    }

    return { data: true, error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Terjadi kesalahan saat menghapus tugas di Supabase.";
    return { data: null, error: new Error(message) };
  }
}
