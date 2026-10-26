import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseConfig, getSupabaseConfigNotice } from './config';

let warned = false;
let cachedBrowserClient: SupabaseClient | null = null;

/**
 * Creates or retrieves a Supabase client for client-side React components.
 * Returns `SupabaseClient` if environment variables are set, or `null` if unconfigured.
 * Prevents throwing uncaught errors during SSR or initial page load when unconfigured.
 */
export function createClient(): SupabaseClient | null {
  const { url, publishableKey, isConfigured } = getSupabaseConfig();

  if (!isConfigured) {
    if (process.env.NODE_ENV !== 'production' && !warned && typeof window !== 'undefined') {
      console.warn(getSupabaseConfigNotice());
      warned = true;
    }
    return null;
  }

  if (typeof window !== 'undefined') {
    if (!cachedBrowserClient) {
      cachedBrowserClient = createBrowserClient(url, publishableKey);
    }
    return cachedBrowserClient;
  }

  return createBrowserClient(url, publishableKey);
}

/**
 * Explicit browser client getter
 */
export const getBrowserClient = createClient;
