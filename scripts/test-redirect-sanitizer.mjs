import assert from "node:assert";
import { sanitizeRedirectUrl } from "../src/lib/utils.ts";

console.log("=== Menjalankan Verifikasi Hardening Auth Redirect Noctis ===\n");

// [Test 1] Valid Internal Paths (Normal Dashboard & Navigation)
{
  console.log("[Test 1] Validasi Rute Internal Standar");
  assert.strictEqual(sanitizeRedirectUrl("/dashboard"), "/dashboard");
  assert.strictEqual(sanitizeRedirectUrl("/calendar"), "/calendar");
  assert.strictEqual(sanitizeRedirectUrl("/tasks"), "/tasks");
  assert.strictEqual(sanitizeRedirectUrl("/notes"), "/notes");
  assert.strictEqual(sanitizeRedirectUrl("/settings"), "/settings");
  assert.strictEqual(sanitizeRedirectUrl("/"), "/");
  console.log("  ✓ Lolos: /dashboard, /calendar, /tasks, /notes, /settings, dan / diterima dengan tepat.");
}

// [Test 2] Valid Internal Paths with Query String and Hash
{
  console.log("\n[Test 2] Validasi Rute Internal dengan Query Parameter & Hash Fragment");
  assert.strictEqual(
    sanitizeRedirectUrl("/tasks?filter=today"),
    "/tasks?filter=today",
    "Query string internal harus dipertahankan"
  );
  assert.strictEqual(
    sanitizeRedirectUrl("/tasks?filter=today#active"),
    "/tasks?filter=today#active",
    "Query string dan hash fragment internal harus dipertahankan"
  );
  assert.strictEqual(
    sanitizeRedirectUrl("/agenda?month=10&year=2026"),
    "/agenda?month=10&year=2026"
  );
  assert.strictEqual(
    sanitizeRedirectUrl("/settings#notifications"),
    "/settings#notifications"
  );
  assert.strictEqual(
    sanitizeRedirectUrl("/tasks?search=laporan%20akhir"),
    "/tasks?search=laporan%20akhir"
  );
  console.log("  ✓ Lolos: Query string dan hash internal dipertahankan dengan aman.");
}

// [Test 3] Penolakan URL Eksternal & Alternative Schemes
{
  console.log("\n[Test 3] Penolakan URL Eksternal dan Skema Berbahaya");
  const externalSchemes = [
    "https://evil.com",
    "http://evil.com",
    "https://evil.com/dashboard",
    "http://localhost:3000.evil.com",
    "javascript:alert(1)",
    "javascript:void(0)",
    "data:text/html,<script>alert(1)</script>",
    "vbscript:msgbox(1)",
    "file:///etc/passwd",
    "mailto:user@evil.com",
  ];

  for (const maliciousUrl of externalSchemes) {
    const result = sanitizeRedirectUrl(maliciousUrl);
    assert.strictEqual(
      result,
      "/dashboard",
      `Skema eksternal "${maliciousUrl}" harus ditolak dan menggunakan fallback`
    );
  }
  console.log("  ✓ Lolos: https, http, javascript, data, vbscript, dan file URI ditolak.");
}

// [Test 4] Penolakan Protocol-Relative URLs
{
  console.log("\n[Test 4] Penolakan Protocol-Relative URLs (//)");
  const protocolRelative = [
    "//evil.com",
    "//evil.com/dashboard",
    "///evil.com",
    "////evil.com",
    "//localhost",
    "//",
    "///",
  ];

  for (const pr of protocolRelative) {
    const result = sanitizeRedirectUrl(pr);
    assert.strictEqual(
      result,
      "/dashboard",
      `Protocol-relative URL "${pr}" harus ditolak dan menggunakan fallback`
    );
  }
  console.log("  ✓ Lolos: Semua variasi protocol-relative URL (//) ditolak.");
}

// [Test 5] Penolakan Variasi Backslash (Normalized Attack Vectors)
{
  console.log("\n[Test 5] Penolakan Variasi Backslash (\\, /\\, \\\\)");
  const backslashAttacks = [
    "\\\\evil.com",
    "/\\evil.com",
    "\\evil.com",
    "\\/evil.com",
    "/evil.com\\test",
    "/tasks\\evil.com",
    "/tasks/\\",
    "/\\/evil.com",
  ];

  for (const bs of backslashAttacks) {
    const result = sanitizeRedirectUrl(bs);
    assert.strictEqual(
      result,
      "/dashboard",
      `Backslash attack "${bs}" harus ditolak dan menggunakan fallback`
    );
  }
  console.log("  ✓ Lolos: Semua variasi backslash (\\, /\\, \\\\) ditolak.");
}

// [Test 6] Penolakan Encoding Bypasses & Control Characters
{
  console.log("\n[Test 6] Penolakan Bypasses Berbasis Encoding dan Karakter Kontrol");
  const encodedAttacks = [
    "/%2f/evil.com",
    "/%2fevil.com",
    "/%5cevil.com",
    "/%5C%5Cevil.com",
    "/%255cevil.com",
    "/%252f%252fevil.com",
    "/%00/evil.com",
    "/%0d%0a/evil.com",
    "/%09/evil.com",
    "/calendar\r\nSet-Cookie: evil=1",
    "/calendar\t//evil.com",
    "/%E0%A4%A", // Malformed percent-encoding
  ];

  for (const enc of encodedAttacks) {
    const result = sanitizeRedirectUrl(enc);
    assert.strictEqual(
      result,
      "/dashboard",
      `Encoded attack "${enc}" harus ditolak dan menggunakan fallback`
    );
  }
  console.log("  ✓ Lolos: Variasi URL encoding, double encoding, CRLF, dan control character ditolak.");
}

// [Test 7] Penanganan Whitespace, Input Kosong, dan Null/Undefined
{
  console.log("\n[Test 7] Penanganan Whitespace dan Nilai Kosong/Null/Undefined");
  assert.strictEqual(sanitizeRedirectUrl(""), "/dashboard");
  assert.strictEqual(sanitizeRedirectUrl("   "), "/dashboard");
  assert.strictEqual(sanitizeRedirectUrl(null), "/dashboard");
  assert.strictEqual(sanitizeRedirectUrl(undefined), "/dashboard");
  assert.strictEqual(sanitizeRedirectUrl("  /calendar  "), "/calendar", "Whitespace leading/trailing harus dibersihkan");
  assert.strictEqual(sanitizeRedirectUrl("  /tasks?filter=today  "), "/tasks?filter=today");
  assert.strictEqual(sanitizeRedirectUrl(null, "/calendar"), "/calendar", "Custom fallback harus dihormati");
  assert.strictEqual(sanitizeRedirectUrl("https://evil.com", "/login"), "/login", "Custom fallback saat ditolak");
  console.log("  ✓ Lolos: Input kosong/null/undefined dan custom fallback ditangani sesuai spesifikasi.");
}

// [Test 8] Simulasi Konstruksi Redirect URL pada Auth Callback
{
  console.log("\n[Test 8] Simulasi Konstruksi Redirect URL pada Auth Callback");
  const origin = "https://noctis.app";

  const safeCases = [
    { rawNext: "/calendar", expectedHref: "https://noctis.app/calendar" },
    { rawNext: "/tasks?filter=today", expectedHref: "https://noctis.app/tasks?filter=today" },
    { rawNext: "//evil.com", expectedHref: "https://noctis.app/dashboard" },
    { rawNext: "https://attacker.com", expectedHref: "https://noctis.app/dashboard" },
    { rawNext: "/\\evil.com", expectedHref: "https://noctis.app/dashboard" },
    { rawNext: null, expectedHref: "https://noctis.app/dashboard" },
  ];

  for (const { rawNext, expectedHref } of safeCases) {
    const safeNext = sanitizeRedirectUrl(rawNext, "/dashboard");
    const redirectUrl = new URL(safeNext, origin);
    assert.strictEqual(
      redirectUrl.href,
      expectedHref,
      `Callback redirect untuk raw input "${rawNext}" harus menghasilkan "${expectedHref}"`
    );
    assert.strictEqual(
      redirectUrl.origin,
      origin,
      "Origin pada URL redirect callback tidak boleh pernah teralihkan"
    );
  }
  console.log("  ✓ Lolos: Konstruksi redirect URL pada auth callback selalu aman dan terikat pada origin aplikasi.");
}

console.log("\n=======================================================");
console.log("SEMUA PENGUJIAN HARDENING REDIRECT BERHASIL 100%!");
console.log("=======================================================");
