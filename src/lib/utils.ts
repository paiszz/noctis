import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Sanitizes an internal redirect URL to prevent Open Redirect vulnerabilities.
 * Strictly permits only safe, internal relative paths starting with a single '/'
 * and rejects protocol-relative URLs ('//'), external URLs ('https://', 'javascript:'),
 * backslashes ('\', '/\'), and encoded bypass sequences.
 *
 * Preserves safe internal query strings and hashes (e.g. '/tasks?filter=today#active').
 * Falls back to `fallback` (default: '/dashboard') if input is invalid, external, or missing.
 */
export function sanitizeRedirectUrl(
  rawUrl: string | null | undefined,
  fallback = "/dashboard"
): string {
  if (typeof rawUrl !== "string") {
    return fallback;
  }

  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return fallback;
  }

  // Must strictly start with a single forward slash, not '//' and not containing any backslash
  if (!trimmed.startsWith("/") || trimmed.startsWith("//") || trimmed.includes("\\")) {
    return fallback;
  }

  // Iteratively decode to detect nested URL encoding tricks (e.g. %252f, %5c)
  let decoded = trimmed;
  for (let i = 0; i < 3; i++) {
    try {
      const next = decodeURIComponent(decoded);
      if (next === decoded) break;
      decoded = next;
    } catch {
      return fallback;
    }
  }

  // Check the decoded form for backslashes, double slashes, or control characters (0-31, 127)
  if (
    !decoded.startsWith("/") ||
    decoded.startsWith("//") ||
    decoded.includes("\\") ||
    // eslint-disable-next-line no-control-regex
    /[\x00-\x1F\x7F]/.test(decoded)
  ) {
    return fallback;
  }

  // Parse against a fixed internal dummy origin to verify WHATWG URL semantics
  const DUMMY_BASE = "https://noctis.local";
  try {
    const parsed = new URL(trimmed, DUMMY_BASE);
    if (parsed.origin !== DUMMY_BASE) {
      return fallback;
    }
    if (parsed.protocol !== "https:") {
      return fallback;
    }
    if (!parsed.pathname.startsWith("/") || parsed.pathname.startsWith("//")) {
      return fallback;
    }

    const safePath = `${parsed.pathname}${parsed.search}${parsed.hash}`;
    if (!safePath.startsWith("/") || safePath.startsWith("//") || safePath.includes("\\")) {
      return fallback;
    }

    return safePath;
  } catch {
    return fallback;
  }
}
