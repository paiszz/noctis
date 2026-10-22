import { createServerClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
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
 * Explicit server client getter
 */
export const getServerClient = createClient;
