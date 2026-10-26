import { createServerClient } from '@supabase/ssr';
import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { getSupabaseConfig, getSupabaseConfigNotice } from './config';

/**
 * Creates a Supabase client for Server Components, Server Actions, and Route Handlers.
 * Returns `null` if Supabase environment variables are not configured.
 */
export async function createClient(): Promise<SupabaseClient | null> {
  const { url, publishableKey, isConfigured } = getSupabaseConfig();

  if (!isConfigured) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(getSupabaseConfigNotice());
    }
    return null;
  }

  const cookieStore = await cookies();

  return createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // The `setAll` method was called from a Server Component.
          // This can be ignored if you have middleware refreshing user sessions.
        }
      },
    },
  });
}

/**
 * Creates an administrative Supabase client using SUPABASE_SERVICE_ROLE_KEY.
 * Strictly for server-side operations requiring elevated permissions.
 * Never exposes the key or client to browser components.
 * Returns null if SUPABASE_SERVICE_ROLE_KEY or SUPABASE_URL is not configured.
 */
export function createAdminClient(): SupabaseClient | null {
  const { url } = getSupabaseConfig();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (
    !url ||
    !serviceRoleKey ||
    serviceRoleKey === 'your-supabase-service-role-key' ||
    serviceRoleKey.length < 20
  ) {
    return null;
  }

  return createSupabaseClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

/**
 * Explicit server client getter aliases
 */
export const getServerClient = createClient;
export const createServerClientInstance = createClient;
