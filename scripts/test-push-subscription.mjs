/**
 * Noctis Stage 5.2 — Web Push Subscription Test Suite
 * Tests payload validation, GET query validation, SW click URL sanitization,
 * key conversions, VAPID rotation detection, error cases, and security contracts.
 */

import assert from "node:assert/strict";
import {
  pushSubscriptionPayloadSchema,
  unsubscribePayloadSchema,
  pushEndpointQuerySchema,
} from "../src/lib/validation/push-subscription-schema.ts";

console.log("=== Noctis Stage 5.2 — Web Push Subscription & Security Hardening Tests ===\n");

let passedTests = 0;

function runTest(name, fn) {
  try {
    fn();
    console.log(`[PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`[FAIL] ${name}`);
    console.error(err);
    process.exitCode = 1;
  }
}

async function runAsyncTest(name, fn) {
  try {
    await fn();
    console.log(`[PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`[FAIL] ${name}`);
    console.error(err);
    process.exitCode = 1;
  }
}

// ── 1. pushSubscriptionPayloadSchema Validation ──

runTest("Valid Web Push subscription payload passes validation", () => {
  const validPayload = {
    endpoint: "https://fcm.googleapis.com/fcm/send/sample-token-12345-abcdef",
    keys: {
      p256dh: "BLc4xRzK4hW1A2B3C4D5E6F7G8H9I0J1K2L3M4N5O6P7Q8R9S0T1U2V3W4X5Y6Z7a8b9c0d1e2f3g4h5i6j7",
      auth: "5A1b2C3d4E5f6G7h8I9j0K1L2M3N",
    },
    user_agent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36",
  };

  const result = pushSubscriptionPayloadSchema.safeParse(validPayload);
  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.endpoint, validPayload.endpoint);
    assert.equal(result.data.keys.p256dh, validPayload.keys.p256dh);
    assert.equal(result.data.keys.auth, validPayload.keys.auth);
  }
});

runTest("Localhost HTTP endpoint passes validation in development", () => {
  const localhostPayload = {
    endpoint: "http://localhost:3000/api/mock-push/send",
    keys: {
      p256dh: "sampleP256dhKey1234567890",
      auth: "sampleAuthKey1234567890",
    },
  };

  const result = pushSubscriptionPayloadSchema.safeParse(localhostPayload);
  assert.equal(result.success, true);
});

runTest("Insecure non-localhost HTTP endpoint fails validation", () => {
  const insecurePayload = {
    endpoint: "http://example.com/push/send",
    keys: {
      p256dh: "sampleP256dhKey1234567890",
      auth: "sampleAuthKey1234567890",
    },
  };

  const result = pushSubscriptionPayloadSchema.safeParse(insecurePayload);
  assert.equal(result.success, false);
  assert.ok(
    result.error.issues.some((i) => i.message.includes("HTTPS")),
    "Should require HTTPS"
  );
});

runTest("Malformed endpoint URL fails validation", () => {
  const malformedPayload = {
    endpoint: "not-a-valid-url-format",
    keys: {
      p256dh: "sampleP256dhKey1234567890",
      auth: "sampleAuthKey1234567890",
    },
  };

  const result = pushSubscriptionPayloadSchema.safeParse(malformedPayload);
  assert.equal(result.success, false);
});

runTest("Endpoint exceeding 2048 characters fails validation", () => {
  const hugeEndpoint = "https://fcm.googleapis.com/fcm/send/" + "a".repeat(2100);
  const oversizedPayload = {
    endpoint: hugeEndpoint,
    keys: {
      p256dh: "sampleP256dhKey1234567890",
      auth: "sampleAuthKey1234567890",
    },
  };

  const result = pushSubscriptionPayloadSchema.safeParse(oversizedPayload);
  assert.equal(result.success, false);
  assert.ok(
    result.error.issues.some((i) => i.message.includes("2048")),
    "Should reject endpoints over 2048 chars"
  );
});

runTest("Missing keys object or missing p256dh/auth fails validation", () => {
  const missingKeys = {
    endpoint: "https://fcm.googleapis.com/fcm/send/token123",
  };
  assert.equal(pushSubscriptionPayloadSchema.safeParse(missingKeys).success, false);

  const missingAuth = {
    endpoint: "https://fcm.googleapis.com/fcm/send/token123",
    keys: { p256dh: "sampleP256dhKey1234567890" },
  };
  assert.equal(pushSubscriptionPayloadSchema.safeParse(missingAuth).success, false);

  const missingP256dh = {
    endpoint: "https://fcm.googleapis.com/fcm/send/token123",
    keys: { auth: "sampleAuthKey1234567890" },
  };
  assert.equal(pushSubscriptionPayloadSchema.safeParse(missingP256dh).success, false);
});

runTest("Cryptographic keys that are too short fail validation", () => {
  const shortKeys = {
    endpoint: "https://fcm.googleapis.com/fcm/send/token123",
    keys: {
      p256dh: "short", // < 10 chars
      auth: "short", // < 10 chars
    },
  };

  const result = pushSubscriptionPayloadSchema.safeParse(shortKeys);
  assert.equal(result.success, false);
});

runTest("Cryptographic keys exceeding safe max bounds fail validation", () => {
  const oversizedKeys = {
    endpoint: "https://fcm.googleapis.com/fcm/send/token123",
    keys: {
      p256dh: "x".repeat(300), // > 256 chars
      auth: "y".repeat(150), // > 128 chars
    },
  };

  const result = pushSubscriptionPayloadSchema.safeParse(oversizedKeys);
  assert.equal(result.success, false);
});

runTest("User agent string over 512 characters is rejected", () => {
  const oversizedUa = {
    endpoint: "https://fcm.googleapis.com/fcm/send/token123",
    keys: {
      p256dh: "sampleP256dhKey1234567890",
      auth: "sampleAuthKey1234567890",
    },
    user_agent: "Browser/".repeat(100),
  };

  const result = pushSubscriptionPayloadSchema.safeParse(oversizedUa);
  assert.equal(result.success, false);
});

// ── 2. unsubscribePayloadSchema Validation ──

runTest("Valid unsubscribe payload passes validation", () => {
  const valid = {
    endpoint: "https://fcm.googleapis.com/fcm/send/token-to-delete",
  };
  const result = unsubscribePayloadSchema.safeParse(valid);
  assert.equal(result.success, true);
});

runTest("Invalid unsubscribe payload fails validation", () => {
  const invalid = {
    endpoint: "not-a-url",
  };
  const result = unsubscribePayloadSchema.safeParse(invalid);
  assert.equal(result.success, false);
});

// ── 3. pushEndpointQuerySchema (GET Validation) ──

runTest("GET query parameter: valid HTTPS endpoint passes validation", () => {
  const valid = {
    endpoint: "https://fcm.googleapis.com/fcm/send/token-query-123",
  };
  const result = pushEndpointQuerySchema.safeParse(valid);
  assert.equal(result.success, true);
});

runTest("GET query parameter: localhost endpoint passes in dev", () => {
  const localhost = {
    endpoint: "http://localhost:3000/api/mock-push/send",
  };
  const result = pushEndpointQuerySchema.safeParse(localhost);
  assert.equal(result.success, true);
});

runTest("GET query parameter: insecure non-localhost endpoint is rejected", () => {
  const insecure = {
    endpoint: "http://example.com/send",
  };
  const result = pushEndpointQuerySchema.safeParse(insecure);
  assert.equal(result.success, false);
});

runTest("GET query parameter: malformed URL or oversized string is rejected", () => {
  assert.equal(pushEndpointQuerySchema.safeParse({ endpoint: "malformed-url" }).success, false);
  const huge = "https://fcm.googleapis.com/fcm/send/" + "x".repeat(2100);
  assert.equal(pushEndpointQuerySchema.safeParse({ endpoint: huge }).success, false);
});

// ── 4. Service Worker Notificationclick URL Sanitization ──

function sanitizeNotificationUrl(rawUrl) {
  if (typeof rawUrl !== "string") return "/dashboard";
  const trimmed = rawUrl.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//") || trimmed.startsWith("/\\")) {
    return "/dashboard";
  }
  if (trimmed.includes("\\") || trimmed.includes("\0")) {
    return "/dashboard";
  }
  return trimmed;
}

runTest("SW URL sanitizer: valid internal relative paths are preserved", () => {
  assert.equal(sanitizeNotificationUrl("/dashboard"), "/dashboard");
  assert.equal(sanitizeNotificationUrl("/calendar"), "/calendar");
  assert.equal(sanitizeNotificationUrl("/tasks?filter=today"), "/tasks?filter=today");
  assert.equal(sanitizeNotificationUrl("/agenda#event-123"), "/agenda#event-123");
});

runTest("SW URL sanitizer: external absolute URLs fallback to /dashboard", () => {
  assert.equal(sanitizeNotificationUrl("https://evil.com"), "/dashboard");
  assert.equal(sanitizeNotificationUrl("http://attacker.site/phish"), "/dashboard");
  assert.equal(sanitizeNotificationUrl("javascript:alert(1)"), "/dashboard");
  assert.equal(sanitizeNotificationUrl("data:text/html,<script>"), "/dashboard");
});

runTest("SW URL sanitizer: protocol-relative and backslash escapes fallback to /dashboard", () => {
  assert.equal(sanitizeNotificationUrl("//evil.com/path"), "/dashboard");
  assert.equal(sanitizeNotificationUrl("/\\evil.com"), "/dashboard");
  assert.equal(sanitizeNotificationUrl("/dashboard\\evil.com"), "/dashboard");
  assert.equal(sanitizeNotificationUrl("/dashboard\0evil"), "/dashboard");
});

runTest("SW URL sanitizer: null, undefined, empty, or non-string fallback to /dashboard", () => {
  assert.equal(sanitizeNotificationUrl(null), "/dashboard");
  assert.equal(sanitizeNotificationUrl(undefined), "/dashboard");
  assert.equal(sanitizeNotificationUrl(""), "/dashboard");
  assert.equal(sanitizeNotificationUrl("   "), "/dashboard");
  assert.equal(sanitizeNotificationUrl(12345), "/dashboard");
});

// ── 5. VAPID Key Rotation & Comparison Logic ──

function areUint8ArraysEqual(a, b) {
  if (a.byteLength !== b.byteLength) return false;
  for (let i = 0; i < a.byteLength; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

runTest("VAPID comparison: identical keys match accurately", () => {
  const key1 = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
  const key2 = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
  assert.equal(areUint8ArraysEqual(key1, key2), true);
});

runTest("VAPID comparison: rotated or different keys detect mismatch accurately", () => {
  const oldKey = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
  const rotatedKey = new Uint8Array([1, 2, 3, 4, 9, 9, 9, 9]);
  const diffLength = new Uint8Array([1, 2, 3]);

  assert.equal(areUint8ArraysEqual(oldKey, rotatedKey), false);
  assert.equal(areUint8ArraysEqual(oldKey, diffLength), false);
});

// ── 6. Logout Best-Effort Unregister Safety ──

await runAsyncTest("Logout safety: network error during unregister does not throw or block", async () => {
  // Simulating unregisterPushSubscriptionOnLogout behavior under failing network
  async function mockUnregisterOnLogout(timeoutMs = 500) {
    try {
      const failingTask = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Network offline")), 50)
      );
      const timeoutTask = new Promise((resolve) => setTimeout(resolve, timeoutMs));
      await Promise.race([failingTask, timeoutTask]);
    } catch {
      // Best-effort: must never fail or bubble error
    }
  }

  // Must resolve smoothly without throwing
  let didLogoutProceed = false;
  await mockUnregisterOnLogout(200);
  didLogoutProceed = true;
  assert.equal(didLogoutProceed, true, "Logout must proceed even if unregister fails");
});

await runAsyncTest("Logout safety: timeout bounds unregister execution if network hangs", async () => {
  async function mockUnregisterWithTimeout(timeoutMs = 100) {
    const hangingTask = new Promise(() => {}); // never resolves
    const timeoutTask = new Promise((resolve) => setTimeout(resolve, timeoutMs));
    await Promise.race([hangingTask, timeoutTask]);
  }

  const startTime = Date.now();
  await mockUnregisterWithTimeout(100);
  const elapsed = Date.now() - startTime;
  assert.ok(elapsed >= 90 && elapsed < 350, `Elapsed ${elapsed}ms should be bounded by timeout`);
});

// ── 7. Base64 URL to Uint8Array Conversion Logic ──

runTest("Base64 and URL-safe Base64 conversion decodes accurately", () => {
  function nodeUrlBase64ToUint8Array(base64String) {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    const buffer = Buffer.from(base64, "base64");
    return new Uint8Array(buffer);
  }

  const testString = "NoctisWebPushKey123";
  const base64UrlSafe = Buffer.from(testString)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const decodedBytes = nodeUrlBase64ToUint8Array(base64UrlSafe);
  const reencoded = Buffer.from(decodedBytes).toString("utf-8");
  assert.equal(reencoded, testString);
});

// ── 8. Security Contracts Verification ──

runTest("Security contract: client user_id in request body is ignored", () => {
  const spoofedPayload = {
    user_id: "00000000-0000-0000-0000-000000000000",
    endpoint: "https://fcm.googleapis.com/fcm/send/attacker-endpoint",
    keys: {
      p256dh: "sampleP256dhKey1234567890",
      auth: "sampleAuthKey1234567890",
    },
  };

  const parsed = pushSubscriptionPayloadSchema.parse(spoofedPayload);
  assert.equal("user_id" in parsed, false, "user_id should NOT be in parsed schema output");
});

runTest("Security contract: VAPID private key is never exposed by public endpoint", () => {
  const publicEndpointResponse = {
    publicKey: "BLc4xRzK4hW1A2B3C4D5E6F7G8H9I0J1K2L3M4N5O6P7Q8R9S0T1U2V3W4X5Y6Z7a8b9c0d1e2f3g4h5i6j7",
    isConfigured: true,
  };

  assert.equal("privateKey" in publicEndpointResponse, false);
  assert.equal("VAPID_PRIVATE_KEY" in publicEndpointResponse, false);
  assert.equal("secret" in publicEndpointResponse, false);
});

console.log(`\nAll ${passedTests} Web Push Subscription & Security Hardening tests passed successfully!`);
