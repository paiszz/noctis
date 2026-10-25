import { createClient as createBrowserClient } from "./client";
import type { AppTheme, NotificationSettings } from "@/types";

export interface ProfileRecord {
  id: string;
  name: string;
  email: string | null;
  title: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserPreferencesRecord {
  id: string;
  user_id: string;
  theme: AppTheme;
  timezone: string;
  notifications: NotificationSettings;
  created_at: string;
  updated_at: string;
}

export interface SupabaseResult<T> {
  data: T | null;
  error: Error | null;
}

/**
 * Mengambil profil pengguna dari tabel `public.profiles`.
 * Jika record belum ada karena trigger terlewat (PGRST116), dilakukan fallback insert secara aman.
 */
export async function getUserProfile(
  userId: string,
  fallback?: { name?: string; email?: string; title?: string }
): Promise<SupabaseResult<ProfileRecord>> {
  const supabase = createBrowserClient();
  if (!supabase) {
    return { data: null, error: new Error("Koneksi Supabase belum dikonfigurasi.") };
  }

  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, name, email, title, avatar_url, created_at, updated_at")
      .eq("id", userId)
      .single();

    if (error) {
      // PGRST116: no rows returned -> lakukan inisialisasi aman jika trigger belum sempat membuat baris
      if (error.code === "PGRST116") {
        const { data: created, error: insertError } = await supabase
          .from("profiles")
          .insert({
            id: userId,
            name: fallback?.name?.trim() || "",
            email: fallback?.email || null,
            title: fallback?.title?.trim() || "Personal Workspace",
          })
          .select("id, name, email, title, avatar_url, created_at, updated_at")
          .single();

        if (insertError) {
          return { data: null, error: new Error(insertError.message) };
        }
        return { data: created as ProfileRecord, error: null };
      }

      return { data: null, error: new Error(error.message) };
    }

    return { data: data as ProfileRecord, error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Terjadi kesalahan saat mengambil profil.";
    return { data: null, error: new Error(message) };
  }
}

/**
 * Memperbarui nama dan title profil pengguna di tabel `public.profiles`.
 */
export async function updateUserProfile(
  userId: string,
  updates: { name: string; title?: string }
): Promise<SupabaseResult<ProfileRecord>> {
  const supabase = createBrowserClient();
  if (!supabase) {
    return { data: null, error: new Error("Koneksi Supabase belum dikonfigurasi.") };
  }

  try {
    const payload: { name: string; title: string; updated_at: string } = {
      name: updates.name.trim(),
      title: updates.title !== undefined ? updates.title.trim() : "",
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("profiles")
      .update(payload)
      .eq("id", userId)
      .select("id, name, email, title, avatar_url, created_at, updated_at")
      .single();

    if (error) {
      return { data: null, error: new Error(error.message) };
    }

    return { data: data as ProfileRecord, error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Terjadi kesalahan saat memperbarui profil.";
    return { data: null, error: new Error(message) };
  }
}

/**
 * Mengambil preferensi pengguna dari tabel `public.user_preferences`.
 * Jika baris belum ada (PGRST116), dilakukan fallback insert secara aman.
 */
export async function getUserPreferences(
  userId: string
): Promise<SupabaseResult<UserPreferencesRecord>> {
  const supabase = createBrowserClient();
  if (!supabase) {
    return { data: null, error: new Error("Koneksi Supabase belum dikonfigurasi.") };
  }

  try {
    const { data, error } = await supabase
      .from("user_preferences")
      .select("id, user_id, theme, timezone, notifications, created_at, updated_at")
      .eq("user_id", userId)
      .single();

    if (error) {
      // PGRST116: no rows returned -> inisialisasi default jika row belum ada
      if (error.code === "PGRST116") {
        const { data: created, error: insertError } = await supabase
          .from("user_preferences")
          .insert({
            user_id: userId,
            theme: "light",
            timezone: "Asia/Jakarta",
            notifications: {
              course_schedule: true,
              task_deadline: true,
              agenda_event: false,
            },
          })
          .select("id, user_id, theme, timezone, notifications, created_at, updated_at")
          .single();

        if (insertError) {
          return { data: null, error: new Error(insertError.message) };
        }
        return { data: created as UserPreferencesRecord, error: null };
      }

      return { data: null, error: new Error(error.message) };
    }

    return { data: data as UserPreferencesRecord, error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Terjadi kesalahan saat mengambil preferensi.";
    return { data: null, error: new Error(message) };
  }
}

/**
 * Memperbarui pengaturan tema, timezone, dan notifikasi di tabel `public.user_preferences`.
 */
export async function updateUserPreferences(
  userId: string,
  updates: Partial<{
    theme: AppTheme;
    timezone: string;
    notifications: NotificationSettings;
  }>
): Promise<SupabaseResult<UserPreferencesRecord>> {
  const supabase = createBrowserClient();
  if (!supabase) {
    return { data: null, error: new Error("Koneksi Supabase belum dikonfigurasi.") };
  }

  try {
    const payload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (updates.theme !== undefined) {
      payload.theme = updates.theme;
    }
    if (updates.timezone !== undefined) {
      payload.timezone = updates.timezone;
    }
    if (updates.notifications !== undefined) {
      payload.notifications = updates.notifications;
    }

    const { data, error } = await supabase
      .from("user_preferences")
      .update(payload)
      .eq("user_id", userId)
      .select("id, user_id, theme, timezone, notifications, created_at, updated_at")
      .single();

    if (error) {
      return { data: null, error: new Error(error.message) };
    }

    return { data: data as UserPreferencesRecord, error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Terjadi kesalahan saat memperbarui preferensi.";
    return { data: null, error: new Error(message) };
  }
}
