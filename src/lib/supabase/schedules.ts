import { createClient as createBrowserClient } from "./client";
import { validateScheduleDateRange } from "@/types";
import type { CourseSchedule, DayOfWeek } from "@/types";
import type { ScheduleInput } from "@/lib/data-context";
import type { SupabaseResult } from "./profile";

export interface ScheduleRecord {
  id: string;
  user_id: string;
  course_name: string;
  course_code: string | null;
  day_of_week: number;
  start_time: string;
  end_time: string;
  location: string | null;
  recurrence_rule: string | null;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Converts a database ScheduleRecord to the client application CourseSchedule model.
 */
function mapRecordToSchedule(record: ScheduleRecord): CourseSchedule {
  return {
    id: record.id,
    user_id: record.user_id,
    course_name: record.course_name,
    course_code: record.course_code ?? undefined,
    day_of_week: record.day_of_week as DayOfWeek,
    start_time: record.start_time,
    end_time: record.end_time,
    location: record.location ?? undefined,
    recurrence_rule: record.recurrence_rule ?? "weekly",
    start_date: record.start_date ?? undefined,
    end_date: record.end_date ?? undefined,
    created_at: record.created_at,
    updated_at: record.updated_at,
  };
}

/**
 * Mengambil seluruh jadwal kuliah milik pengguna yang sedang aktif dari tabel `public.schedules`.
 * Mengandalkan Row Level Security (RLS) Supabase untuk isolasi antar akun.
 */
export async function getUserSchedules(
  userId: string
): Promise<SupabaseResult<CourseSchedule[]>> {
  const supabase = createBrowserClient();
  if (!supabase) {
    return { data: null, error: new Error("Koneksi Supabase belum dikonfigurasi.") };
  }

  try {
    const { data, error } = await supabase
      .from("schedules")
      .select(
        "id, user_id, course_name, course_code, day_of_week, start_time, end_time, location, recurrence_rule, start_date, end_date, created_at, updated_at"
      )
      .eq("user_id", userId)
      .order("day_of_week", { ascending: true })
      .order("start_time", { ascending: true });

    if (error) {
      return { data: null, error: new Error(error.message) };
    }

    const schedules = (data as ScheduleRecord[]).map(mapRecordToSchedule);
    return { data: schedules, error: null };
  } catch (err: unknown) {
    const message =
      err instanceof Error
        ? err.message
        : "Terjadi kesalahan saat memuat jadwal dari Supabase.";
    return { data: null, error: new Error(message) };
  }
}

/**
 * Menambahkan jadwal kuliah baru ke tabel `public.schedules` di Supabase untuk akun terautentikasi.
 */
export async function createUserSchedule(
  userId: string,
  input: ScheduleInput
): Promise<SupabaseResult<CourseSchedule>> {
  const supabase = createBrowserClient();
  if (!supabase) {
    return { data: null, error: new Error("Koneksi Supabase belum dikonfigurasi.") };
  }

  try {
    const validation = validateScheduleDateRange(
      input.day_of_week,
      input.start_date,
      input.end_date
    );
    if (!validation.isValid) {
      return {
        data: null,
        error: new Error(validation.error || "Rentang tanggal jadwal tidak valid."),
      };
    }

    const nowISO = new Date().toISOString();
    const payload = {
      user_id: userId,
      course_name: input.course_name.trim(),
      course_code: input.course_code?.trim() || null,
      day_of_week: input.day_of_week,
      start_time: input.start_time,
      end_time: input.end_time,
      location: input.location?.trim() || null,
      recurrence_rule: input.recurrence_rule || "weekly",
      start_date: input.start_date || null,
      end_date: input.end_date || null,
      created_at: nowISO,
      updated_at: nowISO,
    };

    const { data, error } = await supabase
      .from("schedules")
      .insert(payload)
      .select(
        "id, user_id, course_name, course_code, day_of_week, start_time, end_time, location, recurrence_rule, start_date, end_date, created_at, updated_at"
      )
      .single();

    if (error) {
      return { data: null, error: new Error(error.message) };
    }

    return { data: mapRecordToSchedule(data as ScheduleRecord), error: null };
  } catch (err: unknown) {
    const message =
      err instanceof Error
        ? err.message
        : "Terjadi kesalahan saat menyimpan jadwal ke Supabase.";
    return { data: null, error: new Error(message) };
  }
}

/**
 * Memperbarui jadwal kuliah di tabel `public.schedules` di Supabase.
 */
export async function updateUserSchedule(
  userId: string,
  scheduleId: string,
  updates: Partial<Omit<CourseSchedule, "id" | "user_id">>
): Promise<SupabaseResult<CourseSchedule>> {
  const supabase = createBrowserClient();
  if (!supabase) {
    return { data: null, error: new Error("Koneksi Supabase belum dikonfigurasi.") };
  }

  try {
    if (
      updates.day_of_week !== undefined &&
      updates.start_date !== undefined &&
      updates.end_date !== undefined
    ) {
      const validation = validateScheduleDateRange(
        updates.day_of_week,
        updates.start_date,
        updates.end_date
      );
      if (!validation.isValid) {
        return {
          data: null,
          error: new Error(validation.error || "Rentang tanggal jadwal tidak valid."),
        };
      }
    }

    const payload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (updates.course_name !== undefined) {
      payload.course_name = updates.course_name.trim();
    }
    if (updates.course_code !== undefined) {
      payload.course_code = updates.course_code?.trim() || null;
    }
    if (updates.day_of_week !== undefined) {
      payload.day_of_week = updates.day_of_week;
    }
    if (updates.start_time !== undefined) {
      payload.start_time = updates.start_time;
    }
    if (updates.end_time !== undefined) {
      payload.end_time = updates.end_time;
    }
    if (updates.location !== undefined) {
      payload.location = updates.location?.trim() || null;
    }
    if (updates.recurrence_rule !== undefined) {
      payload.recurrence_rule = updates.recurrence_rule;
    }
    if (updates.start_date !== undefined) {
      payload.start_date = updates.start_date || null;
    }
    if (updates.end_date !== undefined) {
      payload.end_date = updates.end_date || null;
    }

    const { data, error } = await supabase
      .from("schedules")
      .update(payload)
      .eq("id", scheduleId)
      .eq("user_id", userId)
      .select(
        "id, user_id, course_name, course_code, day_of_week, start_time, end_time, location, recurrence_rule, start_date, end_date, created_at, updated_at"
      )
      .single();

    if (error) {
      return { data: null, error: new Error(error.message) };
    }

    return { data: mapRecordToSchedule(data as ScheduleRecord), error: null };
  } catch (err: unknown) {
    const message =
      err instanceof Error
        ? err.message
        : "Terjadi kesalahan saat memperbarui jadwal di Supabase.";
    return { data: null, error: new Error(message) };
  }
}

/**
 * Menghapus jadwal kuliah dari tabel `public.schedules` di Supabase.
 */
export async function deleteUserSchedule(
  userId: string,
  scheduleId: string
): Promise<SupabaseResult<boolean>> {
  const supabase = createBrowserClient();
  if (!supabase) {
    return { data: null, error: new Error("Koneksi Supabase belum dikonfigurasi.") };
  }

  try {
    const { error } = await supabase
      .from("schedules")
      .delete()
      .eq("id", scheduleId)
      .eq("user_id", userId);

    if (error) {
      return { data: null, error: new Error(error.message) };
    }

    return { data: true, error: null };
  } catch (err: unknown) {
    const message =
      err instanceof Error
        ? err.message
        : "Terjadi kesalahan saat menghapus jadwal di Supabase.";
    return { data: null, error: new Error(message) };
  }
}
