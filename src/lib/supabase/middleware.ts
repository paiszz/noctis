import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseConfig } from './config';

/**
 * Refreshes auth session tokens in Next.js middleware and propagates cookies.
 * Safely passes request through if Supabase is unconfigured.
 */
export async function updateSession(request: NextRequest) {
  const { url, publishableKey, isConfigured } = getSupabaseConfig();

  // If Supabase credentials are not provided yet, proceed safely without modifying response headers
  if (!isConfigured) {
    return NextResponse.next({
      request: {
        headers: request.headers,
      },
    });
  }

  let supabaseResponse = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  // IMPORTANT: Do not run auth code between createServerClient and
  // supabase.auth.getUser().
  try {
    await supabase.auth.getUser();
  } catch {
    // Graceful fallback if network is unreachable
  }

  return supabaseResponse;
}
