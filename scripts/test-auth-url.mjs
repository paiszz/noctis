import assert from "node:assert";
import {
  getSiteUrl,
  getAuthCallbackUrl,
  getRequestOrigin,
  PRODUCTION_SITE_URL,
  LOCAL_DEV_SITE_URL,
} from "../src/lib/auth-url.ts";

console.log("=== Menjalankan Pengujian Auth & Site URL Noctis ===\n");

// Helper to save and restore process.env & globalThis.window
const originalEnv = { ...process.env };

function resetEnvironment() {
  process.env = { ...originalEnv };
  delete process.env.NEXT_PUBLIC_SITE_URL;
  delete process.env.NEXT_PUBLIC_APP_URL;
  delete process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL;
  delete process.env.NEXT_PUBLIC_VERCEL_URL;
  delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
  delete process.env.VERCEL_URL;
  process.env.NODE_ENV = "development";
  // @ts-expect-error Mocking window
  delete globalThis.window;
}

// [Test 1] Development default fallback
{
  resetEnvironment();
  console.log("[Test 1] Default URL pada Local Development (tanpa window & tanpa env)");
  const url = getSiteUrl();
  const callback = getAuthCallbackUrl();
  assert.strictEqual(url, LOCAL_DEV_SITE_URL);
  assert.strictEqual(callback, "http://localhost:3000/auth/callback");
  console.log("  ✓ Lolos: Local development fallback menghasilkan http://localhost:3000/auth/callback");
}

// [Test 2] Respects NEXT_PUBLIC_SITE_URL (Production domain)
{
  resetEnvironment();
  console.log("\n[Test 2] Prioritas NEXT_PUBLIC_SITE_URL dengan format lengkap");
  process.env.NEXT_PUBLIC_SITE_URL = "https://noctis-personal.vercel.app";
  const url = getSiteUrl();
  const callback = getAuthCallbackUrl();
  assert.strictEqual(url, "https://noctis-personal.vercel.app");
  assert.strictEqual(callback, "https://noctis-personal.vercel.app/auth/callback");
  console.log("  ✓ Lolos: NEXT_PUBLIC_SITE_URL dihormati dan menghasilkan https://noctis-personal.vercel.app/auth/callback");
}

// [Test 3] Normalizes trailing slashes & missing protocols
{
  resetEnvironment();
  console.log("\n[Test 3] Normalisasi URL (trailing slash & missing protocol)");
  process.env.NEXT_PUBLIC_SITE_URL = "noctis-personal.vercel.app///";
  const url = getSiteUrl();
  const callback = getAuthCallbackUrl();
  assert.strictEqual(url, "https://noctis-personal.vercel.app");
  assert.strictEqual(callback, "https://noctis-personal.vercel.app/auth/callback");
  console.log("  ✓ Lolos: URL tanpa protokol dan trailing slash dinormalisasi dengan benar.");
}

// [Test 4] Browser window mock in Localhost
{
  resetEnvironment();
  console.log("\n[Test 4] Browser Window Mock di Local Development (localhost:3000)");
  // @ts-expect-error Mocking window
  globalThis.window = {
    location: {
      origin: "http://localhost:3000",
    },
  };
  const url = getSiteUrl();
  const callback = getAuthCallbackUrl();
  assert.strictEqual(url, "http://localhost:3000");
  assert.strictEqual(callback, "http://localhost:3000/auth/callback");
  console.log("  ✓ Lolos: Client-side di localhost menghasilkan http://localhost:3000/auth/callback");
}

// [Test 5] Browser window mock on Production domain
{
  resetEnvironment();
  console.log("\n[Test 5] Browser Window Mock di Domain Production Noctis");
  // @ts-expect-error Mocking window
  globalThis.window = {
    location: {
      origin: "https://noctis-personal.vercel.app",
    },
  };
  const url = getSiteUrl();
  const callback = getAuthCallbackUrl();
  assert.strictEqual(url, "https://noctis-personal.vercel.app");
  assert.strictEqual(callback, "https://noctis-personal.vercel.app/auth/callback");
  console.log("  ✓ Lolos: Client-side di production menghasilkan https://noctis-personal.vercel.app/auth/callback");
}

// [Test 6] Server-side / SSR in Production environment (NODE_ENV=production)
{
  resetEnvironment();
  console.log("\n[Test 6] SSR / Server-side Fallback di Production Environment");
  process.env.NODE_ENV = "production";
  const url = getSiteUrl();
  const callback = getAuthCallbackUrl();
  assert.strictEqual(url, PRODUCTION_SITE_URL);
  assert.strictEqual(callback, "https://noctis-personal.vercel.app/auth/callback");
  console.log("  ✓ Lolos: Production mode tanpa window fallback ke https://noctis-personal.vercel.app/auth/callback");
}

// [Test 7] Request Origin in Route Handler (Vercel X-Forwarded-Host & Proto)
{
  resetEnvironment();
  console.log("\n[Test 7] Resolusi Origin Route Handler dari Header Reverse Proxy (Vercel)");
  const mockRequest = new Request("http://127.0.0.1:3000/auth/callback?code=test-code", {
    headers: {
      "x-forwarded-host": "noctis-personal.vercel.app",
      "x-forwarded-proto": "https",
    },
  });
  const origin = getRequestOrigin(mockRequest);
  assert.strictEqual(origin, "https://noctis-personal.vercel.app");
  console.log("  ✓ Lolos: Header x-forwarded-host diprioritaskan di atas URL internal serverless.");
}

// [Test 8] Request Origin in Route Handler on Localhost
{
  resetEnvironment();
  console.log("\n[Test 8] Resolusi Origin Route Handler di Local Development");
  const mockLocalRequest = new Request("http://localhost:3000/auth/callback?code=test-code");
  const origin = getRequestOrigin(mockLocalRequest);
  assert.strictEqual(origin, "http://localhost:3000");
  console.log("  ✓ Lolos: Origin request lokal dipertahankan di http://localhost:3000.");
}

// [Test 9] Request Origin fallback in Production
{
  resetEnvironment();
  console.log("\n[Test 9] Resolusi Origin Route Handler fallback Production");
  process.env.NODE_ENV = "production";
  const mockInternalRequest = new Request("http://10.0.0.1:8080/auth/callback?code=test-code");
  const origin = getRequestOrigin(mockInternalRequest);
  assert.strictEqual(origin, "https://noctis-personal.vercel.app");
  console.log("  ✓ Lolos: IP internal serverless di production difallback ke domain production Noctis.");
}

// Cleanup
resetEnvironment();

console.log("\n=======================================================");
console.log("SEMUA PENGUJIAN AUTH & SITE URL BERHASIL 100%!");
console.log("=======================================================");

