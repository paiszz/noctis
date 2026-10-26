/**
 * Noctis Server-Side Web Push Delivery Engine
 * Handles VAPID authentication, notification payload assembly,
 * safe URL sanitization, and delivery to browser Push Services.
 */

import webpush from "web-push";

export interface PushSubscriptionKeys {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface PushNotificationPayload {
  title: string;
  body: string;
  url?: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: Record<string, unknown>;
}

export interface PushSendResult {
  success: boolean;
  statusCode?: number;
  isExpired?: boolean;
  error?: string;
}

/**
 * Masks endpoint URL for safe server logs without leaking full push tokens.
 */
export function maskPushEndpoint(endpoint: string): string {
  try {
    const url = new URL(endpoint);
    return `${url.origin}${url.pathname.slice(0, 16)}...`;
  } catch {
    return "[invalid-endpoint]";
  }
}

/**
 * Sanitizes target notification redirect URL to strictly enforce safe internal routing.
 * Prevents open redirect attacks, protocol escapes, and directory traversal characters.
 */
export function sanitizeInternalUrl(rawUrl?: string | null): string {
  if (typeof rawUrl !== "string") return "/dashboard";
  const trimmed = rawUrl.trim();

  // Must begin with a single slash, not scheme-relative '//' or Windows path separator '/\'
  if (!trimmed.startsWith("/") || trimmed.startsWith("//") || trimmed.startsWith("/\\")) {
    return "/dashboard";
  }

  // Reject backslashes or null bytes
  if (trimmed.includes("\\") || trimmed.includes("\0")) {
    return "/dashboard";
  }

  return trimmed;
}

let isVapidConfigured = false;

/**
 * Initializes web-push with VAPID details from server environment variables.
 * Caches configuration status once initialized.
 */
export function configureVapid(): { configured: boolean; error?: string } {
  if (isVapidConfigured) {
    return { configured: true };
  }

  const publicKey =
    process.env.VAPID_PUBLIC_KEY?.trim() ||
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  const subject = process.env.VAPID_SUBJECT?.trim() || "mailto:admin@noctis.app";

  if (!publicKey || publicKey === "your-vapid-public-key" || publicKey.length < 20) {
    return {
      configured: false,
      error: "VAPID_PUBLIC_KEY belum dikonfigurasi di lingkungan server.",
    };
  }

  if (!privateKey || privateKey === "your-vapid-private-key" || privateKey.length < 20) {
    return {
      configured: false,
      error: "VAPID_PRIVATE_KEY belum dikonfigurasi di lingkungan server.",
    };
  }

  try {
    webpush.setVapidDetails(subject, publicKey, privateKey);
    isVapidConfigured = true;
    return { configured: true };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Gagal menginisialisasi kredensial VAPID.";
    return { configured: false, error: message };
  }
}

/**
 * Sends a Web Push notification to a specific browser push subscription.
 * Identifies expired or invalid subscriptions (HTTP 404 or 410) for cleanup.
 */
export async function sendWebPushNotification(
  subscription: PushSubscriptionKeys,
  payload: PushNotificationPayload,
  timeoutMs = 8000
): Promise<PushSendResult> {
  const config = configureVapid();
  if (!config.configured) {
    return {
      success: false,
      error: config.error || "VAPID belum dikonfigurasi.",
      isExpired: false,
    };
  }

  const safeUrl = sanitizeInternalUrl(payload.url);
  const formattedPayload = JSON.stringify({
    title: payload.title,
    body: payload.body,
    icon: payload.icon || "/icons/icon-192x192.png",
    badge: payload.badge || "/icons/icon-192x192.png",
    url: safeUrl,
    tag: payload.tag,
    data: {
      ...payload.data,
      url: safeUrl,
    },
  });

  const pushSubscription = {
    endpoint: subscription.endpoint,
    keys: {
      p256dh: subscription.p256dh,
      auth: subscription.auth,
    },
  };

  try {
    const response = await webpush.sendNotification(pushSubscription, formattedPayload, {
      timeout: timeoutMs,
      TTL: 60 * 60 * 24, // 24 hours Time-To-Live on Push Service
      urgency: "high",
    });

    return {
      success: true,
      statusCode: response.statusCode,
    };
  } catch (err: unknown) {
    // webpush.WebPushError contains statusCode (e.g. 404, 410, 400, 401, 500, 503)
    const pushErr = err as {
      statusCode?: number;
      message?: string;
      body?: string;
    };

    const statusCode = typeof pushErr.statusCode === "number" ? pushErr.statusCode : undefined;
    // 404 Not Found or 410 Gone indicates the subscription is definitively expired or revoked
    const isExpired = statusCode === 404 || statusCode === 410;

    const errorMessage =
      pushErr.message ||
      (pushErr.body ? String(pushErr.body).slice(0, 100) : "Kesalahan pengiriman Web Push.");

    return {
      success: false,
      statusCode,
      isExpired,
      error: errorMessage,
    };
  }
}
