import assert from "node:assert";

// Implementations matching src/lib/date.ts and src/types/agenda.ts
const JAKARTA_TIMEZONE = "Asia/Jakarta";

function toJakartaDate(date = new Date()) {
  const d = typeof date === "string" || typeof date === "number" ? new Date(date) : date;
  return new Date(d.toLocaleString("en-US", { timeZone: JAKARTA_TIMEZONE }));
}

function isUpcomingAgenda(agenda, now = toJakartaDate(new Date())) {
  const eventTime = toJakartaDate(agenda.start_at).getTime();
  const currentTime = now.getTime();
  return eventTime >= currentTime;
}

function isPastAgenda(agenda, now = toJakartaDate(new Date())) {
  const eventTime = toJakartaDate(agenda.start_at).getTime();
  const currentTime = now.getTime();
  return eventTime < currentTime;
}

console.log("=== Menjalankan Pengujian Logika Kategorisasi Agenda Noctis ===\n");

const timezones = ["Asia/Jakarta", "UTC", "America/New_York", "Asia/Tokyo", "Europe/London"];

for (const tz of timezones) {
  process.env.TZ = tz;
  console.log(`[Pengujian Zona Waktu: ${tz}]`);

  // Misalkan waktu sekarang adalah 23 Oktober 2026 pukul 14:00:00 WIB (07:00:00 UTC)
  const simulatedNowInstant = new Date("2026-10-23T07:00:00.000Z");
  const now = toJakartaDate(simulatedNowInstant);

  // Skenario 1: Agenda hari ini tetapi jamnya sudah lewat (10:00 WIB vs sekarang 14:00 WIB)
  const pastTodayEvent = {
    title: "Kuliah Pagi (Lewat)",
    start_at: "2026-10-23T03:00:00.000Z", // 10:00 WIB
    end_at: "2026-10-23T05:00:00.000Z", // 12:00 WIB
  };
  assert.strictEqual(
    isUpcomingAgenda(pastTodayEvent, now),
    false,
    "Skenario 1 Gagal: Agenda hari ini yang jamnya sudah lewat TIDAK boleh masuk kategori Mendatang."
  );
  assert.strictEqual(
    isPastAgenda(pastTodayEvent, now),
    true,
    "Skenario 1 Gagal: Agenda hari ini yang jamnya sudah lewat HARUS masuk kategori Selesai."
  );
  console.log("  ✓ Skenario 1 Lolos: Agenda hari ini yang jamnya sudah lewat (10:00 WIB) masuk Selesai, bukan Mendatang.");

  // Skenario 2: Agenda hari ini yang jam mulainya lewat tetapi jam selesainya masih berlangsung (Bug sebelumnya karena cek end_at)
  // start_at: 13:00 WIB, end_at: 16:00 WIB, now: 14:00 WIB
  const ongoingEvent = {
    title: "Workshop Sedang Berlangsung",
    start_at: "2026-10-23T06:00:00.000Z", // 13:00 WIB (sudah lewat 1 jam)
    end_at: "2026-10-23T09:00:00.000Z", // 16:00 WIB (belum selesai)
  };
  assert.strictEqual(
    isUpcomingAgenda(ongoingEvent, now),
    false,
    "Skenario 2 Gagal: Agenda dengan start_at yang sudah lewat TIDAK boleh masuk kategori Mendatang meskipun end_at di masa depan."
  );
  assert.strictEqual(
    isPastAgenda(ongoingEvent, now),
    true,
    "Skenario 2 Gagal: Agenda dengan start_at yang sudah lewat HARUS masuk kategori Selesai/Lewat."
  );
  console.log("  ✓ Skenario 2 Lolos: Agenda yang sudah dimulai (start_at 13:00 WIB) tidak lagi masuk Mendatang meskipun end_at 16:00 WIB.");

  // Skenario 3: Agenda hari ini dengan jam mendatang (16:00 WIB vs sekarang 14:00 WIB)
  const futureTodayEvent = {
    title: "Rapat Sore Hari Ini",
    start_at: "2026-10-23T09:00:00.000Z", // 16:00 WIB
    end_at: "2026-10-23T10:00:00.000Z", // 17:00 WIB
  };
  assert.strictEqual(
    isUpcomingAgenda(futureTodayEvent, now),
    true,
    "Skenario 3 Gagal: Agenda hari ini jam mendatang HARUS masuk kategori Mendatang."
  );
  assert.strictEqual(
    isPastAgenda(futureTodayEvent, now),
    false,
    "Skenario 3 Gagal: Agenda hari ini jam mendatang TIDAK boleh masuk kategori Selesai."
  );
  console.log("  ✓ Skenario 3 Lolos: Agenda hari ini jam mendatang (16:00 WIB) tetap masuk Mendatang.");

  // Skenario 4: Agenda kemarin (22 Oktober 2026)
  const yesterdayEvent = {
    title: "Kegiatan Kemarin",
    start_at: "2026-10-22T07:00:00.000Z", // 22 Okt 14:00 WIB
  };
  assert.strictEqual(isUpcomingAgenda(yesterdayEvent, now), false);
  assert.strictEqual(isPastAgenda(yesterdayEvent, now), true);
  console.log("  ✓ Skenario 4 Lolos: Agenda kemarin masuk kategori Selesai.");

  // Skenario 5: Agenda besok (24 Oktober 2026)
  const tomorrowEvent = {
    title: "Seminar Besok",
    start_at: "2026-10-24T02:00:00.000Z", // 24 Okt 09:00 WIB
  };
  assert.strictEqual(isUpcomingAgenda(tomorrowEvent, now), true);
  assert.strictEqual(isPastAgenda(tomorrowEvent, now), false);
  console.log("  ✓ Skenario 5 Lolos: Agenda besok masuk kategori Mendatang.");

  // Skenario 6: Agenda tepat saat sekarang (14:00:00 WIB)
  const exactNowEvent = {
    title: "Acara Mulai Sekarang",
    start_at: "2026-10-23T07:00:00.000Z", // 14:00:00 WIB
  };
  assert.strictEqual(isUpcomingAgenda(exactNowEvent, now), true);
  assert.strictEqual(isPastAgenda(exactNowEvent, now), false);
  console.log("  ✓ Skenario 6 Lolos: Agenda tepat saat waktu saat ini dikategorikan Mendatang.\n");
}

console.log("SEMUA PENGUJIAN KATEGORISASI AGENDA BERHASIL (PASSED) 100%!");
