import { createClient as createBrowserClient } from "./client";
import type { Note } from "@/types";
import type { NoteInput } from "@/lib/data-context";
import type { SupabaseResult } from "./profile";

export interface NoteRecord {
  id: string;
  user_id: string;
  title: string;
  content: string;
  category: string | null;
  tags: string[] | null;
  is_favorite: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Converts a database NoteRecord to the client application Note model.
 */
function mapRecordToNote(record: NoteRecord): Note {
  return {
    id: record.id,
    user_id: record.user_id,
    title: record.title,
    content: record.content,
    category: record.category ?? undefined,
    tags: record.tags && record.tags.length > 0 ? record.tags : undefined,
    is_favorite: Boolean(record.is_favorite),
    created_at: record.created_at,
    updated_at: record.updated_at,
  };
}

/**
 * Mengambil seluruh catatan milik pengguna yang sedang aktif dari tabel `public.notes`.
 * Diurutkan berdasarkan is_favorite descending, kemudian updated_at descending.
 * Mengandalkan Row Level Security (RLS) Supabase untuk isolasi data antar akun.
 */
export async function getUserNotes(
  userId: string
): Promise<SupabaseResult<Note[]>> {
  const supabase = createBrowserClient();
  if (!supabase) {
    return { data: null, error: new Error("Koneksi Supabase belum dikonfigurasi.") };
  }

  try {
    const { data, error } = await supabase
      .from("notes")
      .select(
        "id, user_id, title, content, category, tags, is_favorite, created_at, updated_at"
      )
      .eq("user_id", userId)
      .order("updated_at", { ascending: false });

    if (error) {
      return { data: null, error: new Error(error.message) };
    }

    const notes = (data as NoteRecord[]).map(mapRecordToNote);
    return { data: notes, error: null };
  } catch (err: unknown) {
    const message =
      err instanceof Error
        ? err.message
        : "Terjadi kesalahan saat memuat catatan dari Supabase.";
    return { data: null, error: new Error(message) };
  }
}

/**
 * Menambahkan Catatan baru ke tabel `public.notes` di Supabase untuk akun terautentikasi.
 */
export async function createUserNote(
  userId: string,
  input: NoteInput
): Promise<SupabaseResult<Note>> {
  const supabase = createBrowserClient();
  if (!supabase) {
    return { data: null, error: new Error("Koneksi Supabase belum dikonfigurasi.") };
  }

  try {
    const nowISO = new Date().toISOString();
    const payload = {
      user_id: userId,
      title: input.title.trim(),
      content: input.content.trim(),
      category: input.category?.trim() || null,
      tags: input.tags && input.tags.length > 0 ? input.tags : [],
      is_favorite: Boolean(input.is_favorite),
      created_at: nowISO,
      updated_at: nowISO,
    };

    const { data, error } = await supabase
      .from("notes")
      .insert(payload)
      .select(
        "id, user_id, title, content, category, tags, is_favorite, created_at, updated_at"
      )
      .single();

    if (error) {
      return { data: null, error: new Error(error.message) };
    }

    return { data: mapRecordToNote(data as NoteRecord), error: null };
  } catch (err: unknown) {
    const message =
      err instanceof Error
        ? err.message
        : "Terjadi kesalahan saat menyimpan catatan ke Supabase.";
    return { data: null, error: new Error(message) };
  }
}

/**
 * Memperbarui catatan di tabel `public.notes` di Supabase.
 */
export async function updateUserNote(
  userId: string,
  noteId: string,
  updates: Partial<Omit<Note, "id" | "user_id">>
): Promise<SupabaseResult<Note>> {
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
    if (updates.content !== undefined) {
      payload.content = updates.content.trim();
    }
    if (updates.category !== undefined) {
      payload.category = updates.category ? updates.category.trim() : null;
    }
    if (updates.tags !== undefined) {
      payload.tags = updates.tags && updates.tags.length > 0 ? updates.tags : [];
    }
    if (updates.is_favorite !== undefined) {
      payload.is_favorite = Boolean(updates.is_favorite);
    }

    const { data, error } = await supabase
      .from("notes")
      .update(payload)
      .eq("id", noteId)
      .eq("user_id", userId)
      .select(
        "id, user_id, title, content, category, tags, is_favorite, created_at, updated_at"
      )
      .single();

    if (error) {
      return { data: null, error: new Error(error.message) };
    }

    return { data: mapRecordToNote(data as NoteRecord), error: null };
  } catch (err: unknown) {
    const message =
      err instanceof Error
        ? err.message
        : "Terjadi kesalahan saat memperbarui catatan di Supabase.";
    return { data: null, error: new Error(message) };
  }
}

/**
 * Menghapus catatan dari tabel `public.notes` di Supabase.
 */
export async function deleteUserNote(
  userId: string,
  noteId: string
): Promise<SupabaseResult<boolean>> {
  const supabase = createBrowserClient();
  if (!supabase) {
    return { data: null, error: new Error("Koneksi Supabase belum dikonfigurasi.") };
  }

  try {
    const { error } = await supabase
      .from("notes")
      .delete()
      .eq("id", noteId)
      .eq("user_id", userId);

    if (error) {
      return { data: null, error: new Error(error.message) };
    }

    return { data: true, error: null };
  } catch (err: unknown) {
    const message =
      err instanceof Error
        ? err.message
        : "Terjadi kesalahan saat menghapus catatan di Supabase.";
    return { data: null, error: new Error(message) };
  }
}
