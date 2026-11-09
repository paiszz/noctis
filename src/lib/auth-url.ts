/**
 * Auth & Site URL Resolution for Noctis
 *
 * Provides environment-aware URL resolution for Supabase Auth redirect URLs:
 * - Production: uses NEXT_PUBLIC_SITE_URL or falls back to 'https://noctis-personal.vercel.app'
 * - Preview / Staging: uses Vercel environment variables if set
 * - Local Development: uses current window origin (if in browser) or 'http://localhost:3000'
 */

export const PRODUCTION_SITE_URL = "https://noctis-personal.vercel.app";
export const LOCAL_DEV_SITE_URL = "http://localhost:3000";

/**
 * Normalizes a URL string by ensuring protocol and removing trailing slashes.
 */
function normalizeUrl(url: string): string {
  let trimmed = url.trim().replace(/\/+$/, "");
  if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
    trimmed = `https://${trimmed}`;
  }
  return trimmed;
}

/**
 * Resolves the base site URL for Noctis across environments:
 * 1. Explicit configured site URL via NEXT_PUBLIC_SITE_URL or NEXT_PUBLIC_APP_URL
 * 2. Client-side window.location.origin (distinguishing localhost vs production domain)
 * 3. Vercel deployment URL (NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL or VERCEL_URL)
 * 4. Production fallback: https://noctis-personal.vercel.app
 * 5. Local development fallback: http://localhost:3000
 */
export function getSiteUrl(): string {
  // 1. Explicit configured site URL via environment variable
  const envUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL;
  if (envUrl && envUrl.trim()) {
    return normalizeUrl(envUrl);
  }

  // 2. Client-side browser runtime check
  if (typeof window !== "undefined" && window.location?.origin) {
    const origin = window.location.origin.trim();
    // In local development, respect the actual window origin (e.g. localhost:3000, 127.0.0.1:3000)
    if (origin.includes("localhost") || origin.includes("127.0.0.1")) {
      return origin;
    }
    // In browser on production domain or custom domain
    if (origin.startsWith("http://") || origin.startsWith("https://")) {
      return normalizeUrl(origin);
    }
  }

  // 3. Vercel deployment URL (if available)
  const vercelUrl =
    process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL ||
    process.env.NEXT_PUBLIC_VERCEL_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    process.env.VERCEL_URL;
  if (vercelUrl && vercelUrl.trim()) {
    return normalizeUrl(vercelUrl);
  }

  // 4. Default based on NODE_ENV
  if (process.env.NODE_ENV === "production") {
    return PRODUCTION_SITE_URL;
  }

  // 5. Default local development URL
  return LOCAL_DEV_SITE_URL;
}

/**
 * Returns the absolute redirect URL for Supabase Auth callback.
 * Guaranteed to produce:
 * - In Production: 'https://noctis-personal.vercel.app/auth/callback'
 * - In Development: 'http://localhost:3000/auth/callback'
 */
export function getAuthCallbackUrl(): string {
  return `${getSiteUrl()}/auth/callback`;
}

/**
 * Resolves the incoming request's base origin in Next.js Server Components / Route Handlers,
 * accounting for reverse proxy headers (e.g. x-forwarded-host, x-forwarded-proto on Vercel)
 * and preventing unintended redirects to localhost in production.
 */
export function getRequestOrigin(request: Request): string {
  // 1. Check standard reverse-proxy headers from Vercel / Cloudflare / Nginx
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto") || "https";

  if (forwardedHost) {
    const host = forwardedHost.split(",")[0].trim();
    return `${forwardedProto}://${host}`;
  }

  // 2. Check direct host header if it is not localhost
  const host = request.headers.get("host");
  if (host && !host.includes("localhost") && !host.includes("127.0.0.1")) {
    const proto = request.headers.get("x-forwarded-proto") || "https";
    return `${proto}://${host}`;
  }

  // 3. Explicit environment variable
  const envUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (envUrl && envUrl.trim()) {
    return normalizeUrl(envUrl);
  }

  // 4. Production fallback
  if (process.env.NODE_ENV === "production") {
    return PRODUCTION_SITE_URL;
  }

  // 5. Fallback to request.url origin for local development
  try {
    const requestUrl = new URL(request.url);
    return requestUrl.origin;
  } catch {
    return LOCAL_DEV_SITE_URL;
  }
}

