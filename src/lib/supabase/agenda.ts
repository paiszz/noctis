import { createClient as createBrowserClient } from "./client";
import type { AgendaEvent } from "@/types";
import type { AgendaInput } from "@/lib/data-context";
import type { SupabaseResult } from "./profile";

export interface AgendaEventRecord {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  start_at: string;
  end_at: string | null;
  location: string | null;
  reminder_minutes: number | null;
  created_at: string;
  updated_at: string;
}

/**
 * Converts a database AgendaEventRecord to the client application AgendaEvent model.
 */
function mapRecordToAgendaEvent(record: AgendaEventRecord): AgendaEvent {
  return {
    id: record.id,
    user_id: record.user_id,
    title: record.title,
    description: record.description ?? undefined,
    start_at: record.start_at,
    end_at: record.end_at ?? undefined,
    location: record.location ?? undefined,
    reminder_minutes: record.reminder_minutes ?? undefined,
    created_at: record.created_at,
    updated_at: record.updated_at,
  };
}

/**
 * Mengambil seluruh agenda kegiatan milik pengguna yang sedang aktif dari tabel `public.agenda_events`.
 * Diurutkan berdasarkan waktu mulai (start_at) ascending.
 * Mengandalkan Row Level Security (RLS) Supabase untuk isolasi data antar akun.
 */
export async function getUserAgendaEvents(
  userId: string
): Promise<SupabaseResult<AgendaEvent[]>> {
  const supabase = createBrowserClient();
  if (!supabase) {
    return { data: null, error: new Error("Koneksi Supabase belum dikonfigurasi.") };
  }

  try {
    const { data, error } = await supabase
      .from("agenda_events")
      .select(
        "id, user_id, title, description, start_at, end_at, location, reminder_minutes, created_at, updated_at"
      )
      .eq("user_id", userId)
      .order("start_at", { ascending: true });

    if (error) {
      return { data: null, error: new Error(error.message) };
    }

    const events = (data as AgendaEventRecord[]).map(mapRecordToAgendaEvent);
    return { data: events, error: null };
  } catch (err: unknown) {
    const message =
      err instanceof Error
        ? err.message
        : "Terjadi kesalahan saat memuat agenda kegiatan dari Supabase.";
    return { data: null, error: new Error(message) };
  }
}

/**
 * Menambahkan Agenda Kegiatan baru ke tabel `public.agenda_events` di Supabase untuk akun terautentikasi.
 */
export async function createUserAgendaEvent(
  userId: string,
  input: AgendaInput
): Promise<SupabaseResult<AgendaEvent>> {
  const supabase = createBrowserClient();
  if (!supabase) {
    return { data: null, error: new Error("Koneksi Supabase belum dikonfigurasi.") };
  }

  try {
    const nowISO = new Date().toISOString();
    const payload = {
      user_id: userId,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      start_at: input.start_at,
      end_at: input.end_at || null,
      location: input.location?.trim() || null,
      reminder_minutes: input.reminder_minutes ?? null,
      created_at: nowISO,
      updated_at: nowISO,
    };

    const { data, error } = await supabase
      .from("agenda_events")
      .insert(payload)
      .select(
        "id, user_id, title, description, start_at, end_at, location, reminder_minutes, created_at, updated_at"
      )
      .single();

    if (error) {
      return { data: null, error: new Error(error.message) };
    }

    return { data: mapRecordToAgendaEvent(data as AgendaEventRecord), error: null };
  } catch (err: unknown) {
    const message =
      err instanceof Error
        ? err.message
        : "Terjadi kesalahan saat menyimpan agenda kegiatan ke Supabase.";
    return { data: null, error: new Error(message) };
  }
}

/**
 * Memperbarui agenda kegiatan di tabel `public.agenda_events` di Supabase.
 */
export async function updateUserAgendaEvent(
  userId: string,
  eventId: string,
  updates: Partial<Omit<AgendaEvent, "id" | "user_id">>
): Promise<SupabaseResult<AgendaEvent>> {
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
      payload.description = updates.description?.trim() || null;
    }
    if (updates.start_at !== undefined) {
      payload.start_at = updates.start_at;
    }
    if (updates.end_at !== undefined) {
      payload.end_at = updates.end_at || null;
    }
    if (updates.location !== undefined) {
      payload.location = updates.location?.trim() || null;
    }
    if (updates.reminder_minutes !== undefined) {
      payload.reminder_minutes = updates.reminder_minutes ?? null;
    }

    const { data, error } = await supabase
      .from("agenda_events")
      .update(payload)
      .eq("id", eventId)
      .eq("user_id", userId)
      .select(
        "id, user_id, title, description, start_at, end_at, location, reminder_minutes, created_at, updated_at"
      )
      .single();

    if (error) {
      return { data: null, error: new Error(error.message) };
    }

    return { data: mapRecordToAgendaEvent(data as AgendaEventRecord), error: null };
  } catch (err: unknown) {
    const message =
      err instanceof Error
        ? err.message
        : "Terjadi kesalahan saat memperbarui agenda kegiatan di Supabase.";
    return { data: null, error: new Error(message) };
  }
}

/**
 * Menghapus agenda kegiatan dari tabel `public.agenda_events` di Supabase.
 */
export async function deleteUserAgendaEvent(
  userId: string,
  eventId: string
): Promise<SupabaseResult<boolean>> {
  const supabase = createBrowserClient();
  if (!supabase) {
    return { data: null, error: new Error("Koneksi Supabase belum dikonfigurasi.") };
  }

  try {
    const { error } = await supabase
      .from("agenda_events")
      .delete()
      .eq("id", eventId)
      .eq("user_id", userId);

    if (error) {
      return { data: null, error: new Error(error.message) };
    }

    return { data: true, error: null };
  } catch (err: unknown) {
    const message =
      err instanceof Error
        ? err.message
        : "Terjadi kesalahan saat menghapus agenda kegiatan di Supabase.";
    return { data: null, error: new Error(message) };
  }
}
