import assert from "node:assert";

// Implementations matching src/lib/date.ts, src/lib/next-up.ts, src/types/agenda.ts, and src/types/task.ts
const DEFAULT_TIMEZONE = "Asia/Jakarta";

function toTimezoneDate(date = new Date(), timezone = DEFAULT_TIMEZONE) {
  const d = typeof date === "string" || typeof date === "number" ? new Date(date) : date;
  if (isNaN(d.getTime())) return new Date(NaN);
  return new Date(d.toLocaleString("en-US", { timeZone: timezone || DEFAULT_TIMEZONE }));
}

function isoToDatetimeLocal(isoStr, timezone = DEFAULT_TIMEZONE) {
  if (!isoStr) return "";
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return "";

  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone || DEFAULT_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    hourCycle: "h23",
  });

  const parts = formatter.formatToParts(d);
  const getPart = (type) => parts.find((p) => p.type === type)?.value || "";
  return `${getPart("year")}-${getPart("month")}-${getPart("day")}T${getPart("hour")}:${getPart("minute")}`;
}

function datetimeLocalToIso(localStr, timezone = DEFAULT_TIMEZONE) {
  if (!localStr) return "";
  const match = localStr.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!match) return "";

  const [, yStr, mStr, dStr, hStr, minStr] = match;
  const year = Number(yStr);
  const month = Number(mStr);
  const day = Number(dStr);
  const hour = Number(hStr);
  const minute = Number(minStr);

  const tz = timezone || DEFAULT_TIMEZONE;
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0, 0));

  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hour12: false,
  });

  const parts = formatter.formatToParts(utcGuess);
  const p = (type) => Number(parts.find((x) => x.type === type)?.value || 0);

  const formattedAsDate = new Date(
    Date.UTC(
      p("year"),
      p("month") - 1,
      p("day"),
      p("hour") === 24 ? 0 : p("hour"),
      p("minute"),
      p("second")
    )
  );
  const offsetDiffMs = formattedAsDate.getTime() - utcGuess.getTime();

  const finalDate = new Date(utcGuess.getTime() - offsetDiffMs);
  return finalDate.toISOString();
}

function isUpcomingAgenda(agenda, now, timezone = DEFAULT_TIMEZONE) {
  const effectiveNow = now ?? toTimezoneDate(new Date(), timezone);
  const eventTime = toTimezoneDate(agenda.start_at, timezone).getTime();
  const currentTime = effectiveNow.getTime();
  return eventTime >= currentTime;
}

function isPastAgenda(agenda, now, timezone = DEFAULT_TIMEZONE) {
  const effectiveNow = now ?? toTimezoneDate(new Date(), timezone);
  const eventTime = toTimezoneDate(agenda.start_at, timezone).getTime();
  const currentTime = effectiveNow.getTime();
  return eventTime < currentTime;
}

function isOverdue(task, now, timezone = DEFAULT_TIMEZONE) {
  if (task.status === "done" || !task.due_at) return false;
  const effectiveNow = now ?? toTimezoneDate(new Date(), timezone);
  const dueWallClock = toTimezoneDate(task.due_at, timezone).getTime();
  return dueWallClock < effectiveNow.getTime();
}

function determineNextUpActivity(schedules, agendaEvents, now, timezone = DEFAULT_TIMEZONE) {
  const effectiveNow = now ?? toTimezoneDate(new Date(), timezone);
  const currentTime = effectiveNow.getTime();
  const todayDay = effectiveNow.getDay();
  const pad = (n) => String(n).padStart(2, "0");
  const todayStr = `${effectiveNow.getFullYear()}-${pad(effectiveNow.getMonth() + 1)}-${pad(effectiveNow.getDate())}`;

  const candidates = [];

  // 1. Course Schedules for today
  const todaySchedules = schedules.filter((s) => s.day_of_week === todayDay);
  for (const s of todaySchedules) {
    if (!s.start_time || !s.end_time) continue;

    const [startH, startM] = s.start_time.split(":").map(Number);
    const [endH, endM] = s.end_time.split(":").map(Number);

    if (isNaN(startH) || isNaN(startM) || isNaN(endH) || isNaN(endM)) continue;

    const startDateTime = new Date(effectiveNow);
    startDateTime.setHours(startH, startM, 0, 0);

    const endDateTime = new Date(effectiveNow);
    endDateTime.setHours(endH, endM, 0, 0);

    if (endDateTime.getTime() < startDateTime.getTime()) {
      endDateTime.setDate(endDateTime.getDate() + 1);
    }

    const isOngoing =
      startDateTime.getTime() <= currentTime && endDateTime.getTime() >= currentTime;
    const isUpcoming = startDateTime.getTime() > currentTime;

    if (isOngoing || isUpcoming) {
      candidates.push({
        id: s.id,
        type: "Jadwal",
        title: s.course_name,
        time: `${s.start_time} — ${s.end_time}`,
        location: s.location || "Ruang Kelas",
        href: "/calendar",
        isOngoing,
        startDateTime,
        endDateTime,
      });
    }
  }

  // 2. Agenda Events
  for (const a of agendaEvents) {
    if (!a.start_at) continue;

    const startDateTime = toTimezoneDate(a.start_at, timezone);
    const endDateTime = a.end_at
      ? toTimezoneDate(a.end_at, timezone)
      : new Date(startDateTime.getTime() + 60 * 60 * 1000);

    const isOngoing =
      startDateTime.getTime() <= currentTime && endDateTime.getTime() >= currentTime;
    const isUpcoming = startDateTime.getTime() > currentTime;

    if (isOngoing || isUpcoming) {
      const aStartStr = `${startDateTime.getFullYear()}-${pad(startDateTime.getMonth() + 1)}-${pad(startDateTime.getDate())}`;
      const isStartToday = aStartStr === todayStr;
      const startTimeFormatted = `${pad(startDateTime.getHours())}:${pad(startDateTime.getMinutes())}`;
      const endTimeFormatted = a.end_at
        ? `${pad(endDateTime.getHours())}:${pad(endDateTime.getMinutes())}`
        : "";

      const timeDisplay = isStartToday
        ? endTimeFormatted
          ? `${startTimeFormatted} — ${endTimeFormatted}`
          : startTimeFormatted
        : `${pad(startDateTime.getDate())}/${pad(startDateTime.getMonth() + 1)} · ${startTimeFormatted}` +
          (endTimeFormatted ? ` — ${endTimeFormatted}` : "");

      candidates.push({
        id: a.id,
        type: "Agenda",
        title: a.title,
        time: timeDisplay,
        location: a.location || "Ruang Rapat",
        href: "/agenda",
        isOngoing,
        startDateTime,
        endDateTime,
      });
    }
  }

  if (candidates.length === 0) return null;

  const comparator = (a, b) => {
    if (a.isOngoing && !b.isOngoing) return -1;
    if (!a.isOngoing && b.isOngoing) return 1;
    const startDiff = a.startDateTime.getTime() - b.startDateTime.getTime();
    if (startDiff !== 0) return startDiff;
    const endDiff = a.endDateTime.getTime() - b.endDateTime.getTime();
    if (endDiff !== 0) return endDiff;
    if (a.type !== b.type) return a.type === "Agenda" ? -1 : 1;
    return a.title.localeCompare(b.title);
  };

  candidates.sort(comparator);
  return candidates[0];
}

console.log("=== Menjalankan Pengujian Dukungan Zona Waktu Noctis ===\n");

// [Test 1] Form Datetime Roundtrip: Asia/Jakarta (UTC+7) vs Asia/Makassar (UTC+8)
{
  console.log("[Test 1] Konversi Input Datetime Form: Jakarta vs Makassar");
  
  // User di Makassar memilih tanggal 2026-10-25 pukul 09:00 WITA
  const inputMakassar = "2026-10-25T09:00";
  const isoFromMakassar = datetimeLocalToIso(inputMakassar, "Asia/Makassar");
  // 09:00 WITA (UTC+8) -> 01:00:00.000Z
  assert.strictEqual(isoFromMakassar, "2026-10-25T01:00:00.000Z");

  // Format ulang ke input Makassar harus persis sama
  const backToLocalMakassar = isoToDatetimeLocal(isoFromMakassar, "Asia/Makassar");
  assert.strictEqual(backToLocalMakassar, inputMakassar);

  // Jika data yang sama dibuka oleh user di Jakarta (UTC+7), harus tampil 08:00 WIB
  const displayInJakarta = isoToDatetimeLocal(isoFromMakassar, "Asia/Jakarta");
  assert.strictEqual(displayInJakarta, "2026-10-25T08:00");

  console.log("  ✓ Lolos: Input 09:00 WITA tersimpan sebagai 01:00 UTC dan tampil 08:00 WIB di Jakarta.");
}

// [Test 2] Midnight Crossing (Pergantian Hari): Jakarta vs Makassar
{
  console.log("\n[Test 2] Kasus Melintasi Tengah Malam (Crossing Midnight)");

  // Waktu saat ini: 2026-10-25 pukul 16:30:00 UTC (Minggu malam)
  // - Di Jakarta (UTC+7): 23:30 WIB, Minggu (Day 0)
  // - Di Makassar (UTC+8): 00:30 WITA, Senin (Day 1)
  const instantSundayNight = new Date("2026-10-25T16:30:00.000Z");

  const nowJakarta = toTimezoneDate(instantSundayNight, "Asia/Jakarta");
  const nowMakassar = toTimezoneDate(instantSundayNight, "Asia/Makassar");

  assert.strictEqual(nowJakarta.getDay(), 0, "Jakarta harus masih hari Minggu (0)");
  assert.strictEqual(nowJakarta.getHours(), 23, "Jakarta harus pukul 23");

  assert.strictEqual(nowMakassar.getDay(), 1, "Makassar harus sudah hari Senin (1)");
  assert.strictEqual(nowMakassar.getHours(), 0, "Makassar harus pukul 00");

  // Buat jadwal kuliah hari Senin (Day 1) jam 08:00 - 09:40
  const mondaySchedule = {
    id: "sched-mon",
    course_name: "Kalkulus Lanjut",
    day_of_week: 1, // Senin
    start_time: "08:00",
    end_time: "09:40",
  };

  // Di Jakarta (Minggu malam), jadwal kuliah Senin belum aktif
  const nextUpJakarta = determineNextUpActivity([mondaySchedule], [], nowJakarta, "Asia/Jakarta");
  assert.strictEqual(nextUpJakarta, null, "Di Jakarta (Minggu), jadwal Senin tidak boleh muncul.");

  // Di Makassar (Senin dini hari), jadwal kuliah Senin adalah Next Up hari ini!
  const nextUpMakassar = determineNextUpActivity([mondaySchedule], [], nowMakassar, "Asia/Makassar");
  assert.notStrictEqual(nextUpMakassar, null, "Di Makassar (Senin), jadwal Senin harus muncul sebagai Next Up.");
  assert.strictEqual(nextUpMakassar.title, "Kalkulus Lanjut");
  assert.strictEqual(nextUpMakassar.time, "08:00 — 09:40");

  console.log("  ✓ Lolos: Jadwal kuliah hari Senin aktif di Makassar (00:30 WITA) tapi belum di Jakarta (23:30 WIB).");
}

// [Test 3] Next Up Activity: Agenda Waktu Lokal Pengguna
{
  console.log("\n[Test 3] Next Up Activity dengan Zona Waktu Pengguna");

  // Agenda rapat: 2026-10-25 01:00:00 UTC (09:00 WITA / 08:00 WIB)
  const meetingAgenda = {
    id: "agenda-1",
    title: "Rapat Departemen",
    start_at: "2026-10-25T01:00:00.000Z",
    end_at: "2026-10-25T02:00:00.000Z",
  };

  // Sekarang pukul 00:30 UTC:
  // Di Makassar: 08:30 WITA (30 menit sebelum rapat)
  // Di Jakarta: 07:30 WIB (30 menit sebelum rapat)
  const currentInstant = new Date("2026-10-25T00:30:00.000Z");
  const nowMakassar = toTimezoneDate(currentInstant, "Asia/Makassar");
  const nowJakarta = toTimezoneDate(currentInstant, "Asia/Jakarta");

  const nextUpMakassar = determineNextUpActivity([], [meetingAgenda], nowMakassar, "Asia/Makassar");
  assert.notStrictEqual(nextUpMakassar, null);
  assert.strictEqual(nextUpMakassar.time, "09:00 — 10:00", "Di Makassar harus menampilkan waktu 09:00 — 10:00");

  const nextUpJakarta = determineNextUpActivity([], [meetingAgenda], nowJakarta, "Asia/Jakarta");
  assert.notStrictEqual(nextUpJakarta, null);
  assert.strictEqual(nextUpJakarta.time, "08:00 — 09:00", "Di Jakarta harus menampilkan waktu 08:00 — 09:00");

  console.log("  ✓ Lolos: Tampilan waktu Next Up mencerminkan zona waktu pengguna (09:00 WITA vs 08:00 WIB).");
}

// [Test 4] isUpcomingAgenda & isPastAgenda dengan Zona Waktu Pengguna
{
  console.log("\n[Test 4] Kategorisasi Agenda (Upcoming vs Past) dengan Zona Waktu Pengguna");

  const event = {
    id: "ev-1",
    title: "Seminar Online",
    start_at: "2026-10-25T05:00:00.000Z", // 12:00 WIB / 13:00 WITA
  };

  // Waktu: 04:30 UTC (11:30 WIB / 12:30 WITA) -> Upcoming di kedua zona
  const nowBefore = new Date("2026-10-25T04:30:00.000Z");
  assert.strictEqual(isUpcomingAgenda(event, toTimezoneDate(nowBefore, "Asia/Jakarta"), "Asia/Jakarta"), true);
  assert.strictEqual(isUpcomingAgenda(event, toTimezoneDate(nowBefore, "Asia/Makassar"), "Asia/Makassar"), true);

  // Waktu: 05:30 UTC (12:30 WIB / 13:30 WITA) -> Past di kedua zona
  const nowAfter = new Date("2026-10-25T05:30:00.000Z");
  assert.strictEqual(isPastAgenda(event, toTimezoneDate(nowAfter, "Asia/Jakarta"), "Asia/Jakarta"), true);
  assert.strictEqual(isPastAgenda(event, toTimezoneDate(nowAfter, "Asia/Makassar"), "Asia/Makassar"), true);

  console.log("  ✓ Lolos: Kategorisasi upcoming vs past konsisten di zona waktu berbeda.");
}

// [Test 5] isOverdue Tasks dengan Zona Waktu Pengguna
{
  console.log("\n[Test 5] Evaluasi Keterlambatan Tugas (isOverdue) dengan Zona Waktu Pengguna");

  const task = {
    id: "task-1",
    title: "Laporan Praktikum",
    due_at: "2026-10-25T10:00:00.000Z", // 17:00 WIB / 18:00 WITA
    status: "todo",
  };

  // Waktu: 09:30 UTC -> Belum overdue
  const nowBefore = new Date("2026-10-25T09:30:00.000Z");
  assert.strictEqual(isOverdue(task, toTimezoneDate(nowBefore, "Asia/Jakarta"), "Asia/Jakarta"), false);
  assert.strictEqual(isOverdue(task, toTimezoneDate(nowBefore, "Asia/Makassar"), "Asia/Makassar"), false);

  // Waktu: 10:30 UTC -> Sudah overdue
  const nowAfter = new Date("2026-10-25T10:30:00.000Z");
  assert.strictEqual(isOverdue(task, toTimezoneDate(nowAfter, "Asia/Jakarta"), "Asia/Jakarta"), true);
  assert.strictEqual(isOverdue(task, toTimezoneDate(nowAfter, "Asia/Makassar"), "Asia/Makassar"), true);

  console.log("  ✓ Lolos: Perhitungan isOverdue tepat dan konsisten di zona waktu pengguna.");
}

console.log("\n=======================================================");
console.log("SEMUA PENGUJIAN DUKUNGAN ZONA WAKTU BERHASIL 100%!");
console.log("=======================================================");
