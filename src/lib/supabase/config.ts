/**
 * Supabase Environment Configuration & Safety Checks
 *
 * Requirements:
 * - Uses NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
 * - Backwards/interop compatibility: also checks NEXT_PUBLIC_SUPABASE_ANON_KEY if publishable key is not set
 * - Safe when unconfigured (does not crash client, server, or build)
 * - Explicitly prevents secret key exposure on client
 */

export interface SupabaseConfig {
  url: string;
  publishableKey: string;
  isConfigured: boolean;
}

/**
 * Validates whether a given URL is a valid Supabase endpoint (not empty or a placeholder).
 */
function isValidSupabaseUrl(url?: string): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (
    !trimmed ||
    trimmed === 'https://your-project-id.supabase.co' ||
    trimmed.startsWith('https://your-project')
  ) {
    return false;
  }
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

/**
 * Validates whether a key looks like a real key (not empty or a placeholder).
 */
function isValidKey(key?: string): boolean {
  if (!key || typeof key !== 'string') return false;
  const trimmed = key.trim();
  return Boolean(
    trimmed &&
    trimmed !== 'your-supabase-publishable-or-anon-key' &&
    trimmed !== 'your-supabase-anon-key' &&
    !trimmed.startsWith('your-supabase-')
  );
}

/**
 * Retrieves client-safe Supabase configuration.
 * Never accesses SUPABASE_SERVICE_ROLE_KEY or any server-only secrets.
 */
export function getSupabaseConfig(): SupabaseConfig {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  // Support NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY as primary, fallback to NEXT_PUBLIC_SUPABASE_ANON_KEY
  const publishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const isConfigured = isValidSupabaseUrl(url) && isValidKey(publishableKey);

  return {
    url: url?.trim() ?? '',
    publishableKey: publishableKey?.trim() ?? '',
    isConfigured,
  };
}

/**
 * Quick check if Supabase public keys and URL are properly configured.
 */
export function isSupabaseConfigured(): boolean {
  return getSupabaseConfig().isConfigured;
}

/**
 * User-friendly diagnostic message when Supabase is not configured.
 */
export function getSupabaseConfigNotice(): string {
  const { url, publishableKey, isConfigured } = getSupabaseConfig();
  if (isConfigured) {
    return 'Supabase terkonfigurasi dengan baik.';
  }

  const missing: string[] = [];
  if (!isValidSupabaseUrl(url)) {
    missing.push('NEXT_PUBLIC_SUPABASE_URL');
  }
  if (!isValidKey(publishableKey)) {
    missing.push('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY');
  }

  return `[Noctis Supabase] Environment variable belum diatur: ${missing.join(', ')}. Aplikasi berjalan dalam mode lokal (localStorage).`;
}
