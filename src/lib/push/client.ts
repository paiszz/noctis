/**
 * Noctis Web Push Client Utility
 * Handles browser PushManager compatibility, VAPID key encoding,
 * subscription registration, VAPID rotation detection, and revocation.
 */

import { pushSubscriptionPayloadSchema } from "../validation/push-subscription-schema";

/**
 * Checks whether the current browser supports Web Push notifications,
 * Service Workers, and the Push API. Safe to call during SSR.
 */
export function isWebPushSupported(): boolean {
  if (typeof window === "undefined") return false;
  return (
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/**
 * Converts a base64 or URL-safe base64 string to a Uint8Array
 * required by PushManager.subscribe({ applicationServerKey }).
 */
export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Compares two Uint8Arrays for byte-for-byte equality.
 */
export function areUint8ArraysEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.byteLength !== b.byteLength) return false;
  for (let i = 0; i < a.byteLength; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

/**
 * Converts an ArrayBuffer to a standard base64 string.
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

/**
 * Fetches the VAPID public key.
 * Checks NEXT_PUBLIC_VAPID_PUBLIC_KEY first, then falls back to /api/push/vapid-public-key.
 */
export async function getVapidPublicKey(): Promise<string | null> {
  const envKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
  if (envKey && envKey !== "your-vapid-public-key") {
    return envKey;
  }

  try {
    const res = await fetch("/api/push/vapid-public-key", {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      cache: "default",
    });

    if (!res.ok) {
      return null;
    }

    const data = (await res.json()) as { publicKey?: string | null; isConfigured?: boolean };
    return data.publicKey || null;
  } catch (err) {
    console.warn("[WebPush Client] Failed to fetch VAPID public key:", err);
    return null;
  }
}

/**
 * Retrieves the active PushSubscription from the browser's Service Worker, if any.
 */
export async function getExistingPushSubscription(): Promise<PushSubscription | null> {
  if (!isWebPushSupported()) return null;

  try {
    const registration = await navigator.serviceWorker.ready;
    return await registration.pushManager.getSubscription();
  } catch (err) {
    console.warn("[WebPush Client] Failed to retrieve existing subscription:", err);
    return null;
  }
}

/**
 * Checks whether a given endpoint is actively registered in the Noctis backend for this user.
 */
export async function checkServerPushStatus(endpoint: string): Promise<boolean> {
  if (!endpoint) return false;

  try {
    const res = await fetch(`/api/push/subscribe?endpoint=${encodeURIComponent(endpoint)}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    if (!res.ok) return false;

    const data = (await res.json()) as { isSubscribed?: boolean };
    return Boolean(data.isSubscribed);
  } catch {
    return false;
  }
}

export interface RegisterPushResult {
  success: boolean;
  subscription?: PushSubscription;
  error?: string;
  conflict?: boolean;
}

/**
 * Registers the browser for Web Push notifications and syncs the subscription with the Noctis server.
 * Handles permission requests, key conversion, VAPID key rotation detection, endpoint conflict resolution, and validation.
 */
export async function registerPushSubscription(
  providedVapidKey?: string
): Promise<RegisterPushResult> {
  if (!isWebPushSupported()) {
    return {
      success: false,
      error: "Browser Anda tidak mendukung Web Push Notification.",
    };
  }

  // 1. Request Notification permission
  let permission = Notification.permission;
  if (permission !== "granted") {
    permission = await Notification.requestPermission();
  }

  if (permission === "denied") {
    return {
      success: false,
      error: "Izin notifikasi ditolak oleh browser.",
    };
  }

  if (permission !== "granted") {
    return {
      success: false,
      error: "Izin notifikasi tidak diberikan.",
    };
  }

  // 2. Obtain VAPID Public Key
  const vapidKey = providedVapidKey || (await getVapidPublicKey());
  if (!vapidKey) {
    return {
      success: false,
      error: "Kunci server VAPID belum dikonfigurasi di server Noctis.",
    };
  }

  try {
    // 3. Ensure Service Worker is ready
    const registration = await navigator.serviceWorker.ready;

    // 4. Retrieve or create PushSubscription
    let subscription = await registration.pushManager.getSubscription();

    // 4.1 Safe VAPID key rotation check:
    // If an existing subscription has a different applicationServerKey than the current server key,
    // unsubscribe it so a new subscription with the rotated key can be created.
    if (subscription && subscription.options && subscription.options.applicationServerKey) {
      try {
        const expectedKeyBytes = urlBase64ToUint8Array(vapidKey);
        const actualKeyBytes = new Uint8Array(subscription.options.applicationServerKey);

        if (!areUint8ArraysEqual(expectedKeyBytes, actualKeyBytes)) {
          // Key mismatch: gracefully unsubscribe stale subscription
          await subscription.unsubscribe();
          subscription = null;
        }
      } catch (keyCompErr) {
        // If comparison fails due to environment quirks, do not drop a valid subscription
        console.warn("[WebPush Client] ApplicationServerKey comparison skipped:", keyCompErr);
      }
    }

    if (!subscription) {
      const applicationServerKey = urlBase64ToUint8Array(vapidKey);
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey as BufferSource,
      });
    }

    // 5. Extract and validate subscription keys
    const subJson = subscription.toJSON();
    const p256dhKey = subscription.getKey ? subscription.getKey("p256dh") : null;
    const authKey = subscription.getKey ? subscription.getKey("auth") : null;

    const p256dh =
      subJson.keys?.p256dh || (p256dhKey ? arrayBufferToBase64(p256dhKey) : "");
    const auth =
      subJson.keys?.auth || (authKey ? arrayBufferToBase64(authKey) : "");

    const payload = {
      endpoint: subscription.endpoint,
      keys: { p256dh, auth },
      user_agent: navigator.userAgent.slice(0, 500),
    };

    const validation = pushSubscriptionPayloadSchema.safeParse(payload);
    if (!validation.success) {
      return {
        success: false,
        error: `Data subscription browser tidak valid: ${validation.error.issues[0]?.message}`,
      };
    }

    // 6. Send subscription payload to server API
    let res = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validation.data),
    });

    // 7. Handle endpoint conflict (409)
    // Occurs if the endpoint was registered by a previous account on this browser.
    if (res.status === 409) {
      // Unsubscribe the stale browser registration to force a fresh endpoint
      await subscription.unsubscribe();

      // Re-subscribe to generate a brand new endpoint
      const applicationServerKey = urlBase64ToUint8Array(vapidKey);
      const newSubscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey as BufferSource,
      });

      const newSubJson = newSubscription.toJSON();
      const newP256dhKey = newSubscription.getKey ? newSubscription.getKey("p256dh") : null;
      const newAuthKey = newSubscription.getKey ? newSubscription.getKey("auth") : null;

      const newP256dh =
        newSubJson.keys?.p256dh || (newP256dhKey ? arrayBufferToBase64(newP256dhKey) : "");
      const newAuth =
        newSubJson.keys?.auth || (newAuthKey ? arrayBufferToBase64(newAuthKey) : "");

      const retryPayload = {
        endpoint: newSubscription.endpoint,
        keys: { p256dh: newP256dh, auth: newAuth },
        user_agent: navigator.userAgent.slice(0, 500),
      };

      res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(retryPayload),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        return {
          success: false,
          conflict: true,
          error:
            errorData.error ||
            "Konflik subscription browser lama. Silakan muat ulang halaman.",
        };
      }

      return {
        success: true,
        subscription: newSubscription,
      };
    }

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      return {
        success: false,
        error: errorData.error || "Gagal menyimpan subscription ke server.",
      };
    }

    return {
      success: true,
      subscription,
    };
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Terjadi kesalahan yang tidak diketahui.";
    return {
      success: false,
      error: `Pendaftaran Push Notification gagal: ${message}`,
    };
  }
}

export interface UnregisterPushResult {
  success: boolean;
  error?: string;
}

/**
 * Revokes the Web Push subscription from both the Noctis backend and the local browser PushManager.
 */
export async function unregisterPushSubscription(): Promise<UnregisterPushResult> {
  if (!isWebPushSupported()) {
    return { success: true };
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      return { success: true };
    }

    const endpoint = subscription.endpoint;

    // 1. Notify server to delete subscription record
    try {
      await fetch("/api/push/subscribe", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint }),
      });
    } catch (apiErr) {
      console.warn("[WebPush Client] Server unregister failed:", apiErr);
    }

    // 2. Unsubscribe locally in browser PushManager
    const unsubscribed = await subscription.unsubscribe();

    if (!unsubscribed) {
      return {
        success: false,
        error: "Gagal mencabut subscription dari browser.",
      };
    }

    return { success: true };
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Terjadi kesalahan saat mencabut notifikasi.";
    return {
      success: false,
      error: message,
    };
  }
}

/**
 * Best-effort push subscription revocation for user logout.
 * Ensures local browser subscription is cleaned up with a strict timeout
 * so that slow or offline networks never block or delay the logout flow.
 * Never throws an unhandled error.
 */
export async function unregisterPushSubscriptionOnLogout(
  timeoutMs: number = 1500
): Promise<void> {
  if (!isWebPushSupported()) return;

  try {
    const unregisterPromise = (async () => {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (!subscription) return;

      const endpoint = subscription.endpoint;

      // 1. Attempt server notification with short timeout
      try {
        const controller = new AbortController();
        const fetchTimeout = setTimeout(() => controller.abort(), Math.max(100, timeoutMs - 200));
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint }),
          signal: controller.signal,
        });
        clearTimeout(fetchTimeout);
      } catch {
        // Ignored: proceed to local unsubscription
      }

      // 2. Unsubscribe browser PushManager locally
      try {
        await subscription.unsubscribe();
      } catch {
        // Ignored
      }
    })();

    const timeoutPromise = new Promise<void>((resolve) =>
      setTimeout(resolve, timeoutMs)
    );

    await Promise.race([unregisterPromise, timeoutPromise]);
  } catch {
    // Best-effort: must never fail or block logout
  }
}
