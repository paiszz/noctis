import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";

console.log("=== Menjalankan Verifikasi PWA Noctis ===\n");

// [Test 1] Validasi Struktur dan File Manifest
{
  console.log("[Test 1] Validasi public/manifest.json");
  const manifestPath = path.resolve(process.cwd(), "public/manifest.json");
  assert.strictEqual(fs.existsSync(manifestPath), true, "public/manifest.json harus ada");

  const raw = fs.readFileSync(manifestPath, "utf-8");
  const manifest = JSON.parse(raw);

  assert.strictEqual(manifest.id, "/", "id manifest harus terdefinisi sebagai /");
  assert.strictEqual(manifest.name, "Noctis — Your Personal Productivity Space");
  assert.strictEqual(manifest.short_name, "Noctis");
  assert.strictEqual(manifest.start_url, "/dashboard");
  assert.strictEqual(manifest.scope, "/");
  assert.strictEqual(manifest.display, "standalone");
  assert.strictEqual(manifest.theme_color, "#7A7AFF");
  assert.strictEqual(manifest.background_color, "#FFFFFF");
  assert.strictEqual(Array.isArray(manifest.icons), true, "icons harus array");
  assert.strictEqual(manifest.icons.length >= 2, true, "icons harus memiliki minimal 2 ukuran");
  assert.strictEqual(Array.isArray(manifest.screenshots), true, "screenshots harus array untuk Richer Install UI");
  assert.strictEqual(manifest.screenshots.length >= 2, true, "screenshots minimal memiliki desktop dan mobile");

  console.log("  ✓ Lolos: Struktur public/manifest.json valid dan sesuai spesifikasi PRD.");

  // [Test 2] Validasi Ikon dan Screenshot yang Dirujuk Manifest
  console.log("\n[Test 2] Validasi Integritas File Ikon & Screenshot PWA");
  const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  for (const icon of manifest.icons) {
    const iconRel = icon.src.replace(/^\//, "");
    const iconAbs = path.resolve(process.cwd(), "public", iconRel);
    assert.strictEqual(fs.existsSync(iconAbs), true, `Ikon ${icon.src} harus ada di disk`);
    const buf = fs.readFileSync(iconAbs);
    assert.strictEqual(buf.length > 500, true, `Ukuran ikon ${icon.src} harus > 500 bytes`);
    assert.strictEqual(
      buf.subarray(0, 8).equals(pngSignature),
      true,
      `Ikon ${icon.src} harus memiliki PNG magic header valid`
    );
    console.log(`  ✓ Lolos: ${icon.src} (${icon.sizes}, ${icon.purpose}) valid PNG [${buf.length} bytes].`);
  }

  // Apple touch icon check
  const appleIconPath = path.resolve(process.cwd(), "public/icons/apple-touch-icon.png");
  assert.strictEqual(fs.existsSync(appleIconPath), true, "apple-touch-icon.png harus ada");
  const appleBuf = fs.readFileSync(appleIconPath);
  assert.strictEqual(appleBuf.subarray(0, 8).equals(pngSignature), true, "apple-touch-icon.png valid PNG");
  console.log(`  ✓ Lolos: apple-touch-icon.png valid PNG [${appleBuf.length} bytes].`);

  // Screenshots validation
  for (const shot of manifest.screenshots) {
    const shotRel = shot.src.replace(/^\//, "");
    const shotAbs = path.resolve(process.cwd(), "public", shotRel);
    assert.strictEqual(fs.existsSync(shotAbs), true, `Screenshot ${shot.src} harus ada di disk`);
    const sBuf = fs.readFileSync(shotAbs);
    assert.strictEqual(sBuf.length > 10000, true, `Ukuran screenshot ${shot.src} harus representatif (>10KB)`);
    assert.strictEqual(
      sBuf.subarray(0, 8).equals(pngSignature),
      true,
      `Screenshot ${shot.src} harus memiliki PNG magic header valid`
    );
    console.log(`  ✓ Lolos: ${shot.src} (${shot.sizes}, ${shot.form_factor || 'mobile'}) valid PNG [${sBuf.length} bytes].`);
  }
}

// [Test 3] Validasi Service Worker (public/sw.js)
{
  console.log("\n[Test 3] Validasi Logika dan Pengamanan public/sw.js");
  const swPath = path.resolve(process.cwd(), "public/sw.js");
  assert.strictEqual(fs.existsSync(swPath), true, "public/sw.js harus ada");

  const swContent = fs.readFileSync(swPath, "utf-8");

  // Lifecycle listeners
  assert.strictEqual(swContent.includes("addEventListener('install'"), true, "SW harus menangani event install");
  assert.strictEqual(swContent.includes("addEventListener('message'"), true, "SW harus menangani event message (SKIP_WAITING)");
  assert.strictEqual(swContent.includes("addEventListener('activate'"), true, "SW harus menangani event activate");
  assert.strictEqual(swContent.includes("addEventListener('fetch'"), true, "SW harus menangani event fetch");
  assert.strictEqual(swContent.includes("addEventListener('push'"), true, "SW harus siap menangani event push notification");
  assert.strictEqual(swContent.includes("addEventListener('notificationclick'"), true, "SW harus siap menangani event notificationclick");

  // Safety Guards: Supabase, internal API, dan Auth pages TIDAK BOLEH di-cache
  assert.strictEqual(swContent.includes("supabase.co"), true, "SW harus mengecualikan request supabase.co");
  assert.strictEqual(swContent.includes("url.pathname.startsWith('/api/')"), true, "SW harus mengecualikan rute /api/");
  assert.strictEqual(swContent.includes("url.pathname === '/login'"), true, "SW harus mengecualikan /login");
  assert.strictEqual(swContent.includes("url.pathname === '/register'"), true, "SW harus mengecualikan /register");
  assert.strictEqual(swContent.includes("request.method !== 'GET'"), true, "SW harus mengabaikan mutasi non-GET");

  console.log("  ✓ Lolos: public/sw.js memiliki seluruh lifecycle, push listener, dan proteksi isolasi data.");
}

// [Test 4] Validasi Proxy Matcher Regex (Pengecualian sw.js dan manifest.json)
{
  console.log("\n[Test 4] Validasi Next.js Proxy Regex Matcher (Bypass Auth Middleware)");
  const proxyPath = path.resolve(process.cwd(), "src/proxy.ts");
  const proxyContent = fs.readFileSync(proxyPath, "utf-8");

  // Extract matcher regex string
  const match = proxyContent.match(/"(\/\(\(\?!.*?\)\.\*\))"/);
  assert.notStrictEqual(match, null, "Harus menemukan matcher regex di src/proxy.ts");

  // String literal in source has escaped backslashes; JSON.parse unescapes to the actual string evaluated by Next.js
  const patternString = JSON.parse(match[0]);
  const regex = new RegExp(`^${patternString}$`);

  // Rute publik PWA HARUS TIDAK MATCH (artinya TIDAK masuk ke middleware / tidak di-redirect)
  assert.strictEqual(regex.test("/sw.js"), false, "/sw.js TIDAK boleh masuk matcher proxy");
  assert.strictEqual(regex.test("/manifest.json"), false, "/manifest.json TIDAK boleh masuk matcher proxy");
  assert.strictEqual(regex.test("/manifest.webmanifest"), false, "/manifest.webmanifest TIDAK boleh masuk matcher proxy");
  assert.strictEqual(regex.test("/icons/icon-192x192.png"), false, "icons PNG TIDAK boleh masuk matcher proxy");
  assert.strictEqual(regex.test("/favicon.ico"), false, "favicon.ico TIDAK boleh masuk matcher proxy");

  // Rute privat aplikasi HARUS TETAP MATCH (artinya tetap diproteksi middleware)
  assert.strictEqual(regex.test("/dashboard"), true, "/dashboard HARUS tetap diproteksi matcher proxy");
  assert.strictEqual(regex.test("/calendar"), true, "/calendar HARUS tetap diproteksi matcher proxy");
  assert.strictEqual(regex.test("/tasks"), true, "/tasks HARUS tetap diproteksi matcher proxy");
  assert.strictEqual(regex.test("/notes"), true, "/notes HARUS tetap diproteksi matcher proxy");
  assert.strictEqual(regex.test("/agenda"), true, "/agenda HARUS tetap diproteksi matcher proxy");
  assert.strictEqual(regex.test("/settings"), true, "/settings HARUS tetap diproteksi matcher proxy");

  console.log("  ✓ Lolos: Proxy matcher mengecualikan file PWA tanpa mengurangi proteksi rute privat.");
}

console.log("\n=======================================================");
console.log("SEMUA PENGUJIAN PWA BERHASIL 100%!");
console.log("=======================================================");
