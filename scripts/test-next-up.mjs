import assert from "node:assert";

// Self-contained logic matching src/lib/next-up.ts and src/lib/date.ts for direct Node execution
const JAKARTA_TIMEZONE = "Asia/Jakarta";

function toJakartaDate(date = new Date()) {
  const d = typeof date === "string" || typeof date === "number" ? new Date(date) : date;
  return new Date(d.toLocaleString("en-US", { timeZone: JAKARTA_TIMEZONE }));
}

function isScheduleActiveOnDate(schedule, targetDate) {
  if (!schedule) return false;

  let dateStr;
  let dayOfWeek;

  if (targetDate instanceof Date) {
    if (isNaN(targetDate.getTime())) return false;
    const pad = (n) => String(n).padStart(2, "0");
    dateStr = `${targetDate.getFullYear()}-${pad(targetDate.getMonth() + 1)}-${pad(targetDate.getDate())}`;
    dayOfWeek = targetDate.getDay();
  } else if (typeof targetDate === "string") {
    const match = targetDate.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!match) return false;
    dateStr = `${match[1]}-${match[2]}-${match[3]}`;
    const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
    const parsedDate = new Date(y, m - 1, d);
    dayOfWeek = parsedDate.getDay();
  } else {
    return false;
  }

  // 1. Hari kuliah harus cocok
  if (schedule.day_of_week !== dayOfWeek) {
    return false;
  }

  // 2. Batas awal (start_date)
  if (schedule.start_date && schedule.start_date.trim()) {
    const startStr = schedule.start_date.trim().slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(startStr) && dateStr < startStr) {
      return false;
    }
  }

  // 3. Batas akhir (end_date)
  if (schedule.end_date && schedule.end_date.trim()) {
    const endStr = schedule.end_date.trim().slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(endStr) && dateStr > endStr) {
      return false;
    }
  }

  return true;
}

function determineNextUpActivity(schedules, agendaEvents, now = toJakartaDate(new Date())) {
  const currentTime = now.getTime();
  const pad = (n) => String(n).padStart(2, "0");
  const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

  const candidates = [];

  // 1. Course Schedules for today (respecting day_of_week, start_date, and end_date)
  const todaySchedules = schedules.filter((s) => isScheduleActiveOnDate(s, now));
  for (const s of todaySchedules) {
    if (!s.start_time || !s.end_time) continue;

    const [startH, startM] = s.start_time.split(":").map(Number);
    const [endH, endM] = s.end_time.split(":").map(Number);

    if (isNaN(startH) || isNaN(startM) || isNaN(endH) || isNaN(endM)) continue;

    const startDateTime = new Date(now);
    startDateTime.setHours(startH, startM, 0, 0);

    const endDateTime = new Date(now);
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

    const startDateTime = toJakartaDate(a.start_at);
    const endDateTime = a.end_at
      ? toJakartaDate(a.end_at)
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
        : `${pad(startDateTime.getDate())} ${pad(startDateTime.getMonth() + 1)} · ${startTimeFormatted}` +
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

  if (candidates.length === 0) {
    return null;
  }

  const comparator = (a, b) => {
    // Ongoing items always take priority over upcoming
    if (a.isOngoing && !b.isOngoing) return -1;
    if (!a.isOngoing && b.isOngoing) return 1;

    // Both ongoing or both upcoming: earliest start wins
    const startDiff = a.startDateTime.getTime() - b.startDateTime.getTime();
    if (startDiff !== 0) return startDiff;

    // Tie-break 1: Earlier end time wins
    const endDiff = a.endDateTime.getTime() - b.endDateTime.getTime();
    if (endDiff !== 0) return endDiff;

    // Tie-break 2: Agenda takes precedence over Course Schedule
    if (a.type !== b.type) {
      return a.type === "Agenda" ? -1 : 1;
    }

    // Tie-break 3: Title alphabetical
    return a.title.localeCompare(b.title);
  };

  candidates.sort(comparator);
  return candidates[0];
}

console.log("=== Menjalankan Unit Test Penentuan Next Up Noctis ===\n");

const timezones = ["Asia/Jakarta", "UTC", "America/New_York", "Asia/Tokyo"];

for (const tz of timezones) {
  process.env.TZ = tz;
  console.log(`[Testing in TZ: ${tz}]`);

  // Fixed test day: Friday, 24 October 2026 (day_of_week = 5 in JS Date, or 6 if Saturday)
  // Let's create base date representing 2026-10-24 in WIB:
  // 2026-10-24 00:00:00 WIB is 2026-10-23 17:00:00 UTC
  const makeWibDate = (hour, minute = 0) => {
    // UTC hour = hour - 7
    const utcHour = hour - 7;
    const d = new Date(Date.UTC(2026, 9, 24, utcHour, minute, 0, 0));
    return toJakartaDate(d);
  };

  const dayOfWeek = makeWibDate(4).getDay();

  // Test data
  const agendaSarapan = {
    id: "agenda-sarapan",
    title: "Sarapan Pagi",
    start_at: new Date(Date.UTC(2026, 9, 24, 5 - 7, 0, 0, 0)).toISOString(), // 05:00 WIB
    end_at: new Date(Date.UTC(2026, 9, 24, 6 - 7, 0, 0, 0)).toISOString(),   // 06:00 WIB
    location: "Kantin Asrama",
  };

  const jadwalKuliah = {
    id: "jadwal-kuliah",
    day_of_week: dayOfWeek,
    course_name: "Pemrograman Web Lanjut",
    start_time: "08:00",
    end_time: "10:30",
    location: "Lab Komputer 3",
  };

  // --- Skenario A ---
  // Sekarang pukul 04.00, agenda sarapan mulai pukul 05.00, kuliah mulai pukul 08.00.
  // Next Up harus memilih agenda sarapan.
  {
    const now04 = makeWibDate(4, 0);
    const result = determineNextUpActivity([jadwalKuliah], [agendaSarapan], now04);
    assert.ok(result, "Skenario A: Hasil tidak boleh null");
    assert.strictEqual(result.type, "Agenda", "Skenario A: Harus bertipe Agenda");
    assert.strictEqual(result.title, "Sarapan Pagi", "Skenario A: Harus memilih Sarapan Pagi");
    assert.strictEqual(result.href, "/agenda", "Skenario A: href harus /agenda");
    assert.strictEqual(result.isOngoing, false, "Skenario A: Belum berlangsung pada 04.00");
    console.log("  ✓ Skenario A Lolos: Pukul 04:00 memilih Agenda Sarapan (05:00) dibanding Kuliah (08:00).");
  }

  // --- Skenario B ---
  // Sekarang pukul 06.00 dengan kedua kegiatan yang sama.
  // Next Up harus tetap memilih agenda sarapan (sedang berakhir/berlangsung hingga 06:00).
  {
    const now06 = makeWibDate(6, 0);
    const result = determineNextUpActivity([jadwalKuliah], [agendaSarapan], now06);
    assert.ok(result, "Skenario B: Hasil tidak boleh null");
    assert.strictEqual(result.type, "Agenda", "Skenario B: Harus bertipe Agenda");
    assert.strictEqual(result.title, "Sarapan Pagi", "Skenario B: Harus memilih Sarapan Pagi");
    assert.strictEqual(result.isOngoing, true, "Skenario B: Harus berstatus ongoing pada batas akhir 06.00");
    console.log("  ✓ Skenario B Lolos: Pukul 06:00 tetap memilih Agenda Sarapan yang sedang berlangsung/berakhir.");
  }

  // --- Skenario C ---
  // Sekarang pukul 07.00, agenda sarapan sudah selesai pukul 06.00, kuliah mulai pukul 08.00.
  // Next Up harus memilih jadwal kuliah.
  {
    const now07 = makeWibDate(7, 0);
    const result = determineNextUpActivity([jadwalKuliah], [agendaSarapan], now07);
    assert.ok(result, "Skenario C: Hasil tidak boleh null");
    assert.strictEqual(result.type, "Jadwal", "Skenario C: Harus bertipe Jadwal");
    assert.strictEqual(result.title, "Pemrograman Web Lanjut", "Skenario C: Harus memilih Kuliah");
    assert.strictEqual(result.href, "/calendar", "Skenario C: href harus /calendar");
    console.log("  ✓ Skenario C Lolos: Pukul 07:00 memilih Kuliah (08:00) karena Sarapan telah selesai pada 06:00.");
  }

  // --- Skenario D1 (Tie-Break: Waktu mulai sama, durasi lebih singkat menang) ---
  {
    const now07 = makeWibDate(7, 0);
    const agendaRapat = {
      id: "agenda-rapat",
      title: "Rapat Singkat",
      start_at: new Date(Date.UTC(2026, 9, 24, 8 - 7, 0, 0, 0)).toISOString(), // 08:00 WIB
      end_at: new Date(Date.UTC(2026, 9, 24, 9 - 7, 0, 0, 0)).toISOString(),   // 09:00 WIB
    };
    const result = determineNextUpActivity([jadwalKuliah], [agendaRapat], now07);
    assert.strictEqual(result.title, "Rapat Singkat", "Skenario D1: Acara yang selesai lebih cepat harus menang");
    console.log("  ✓ Skenario D1 Lolos: Waktu mulai sama (08:00), acara yang selesai lebih awal (09:00 vs 10:30) dipilih.");
  }

  // --- Skenario D2 (Tie-Break: Mulai dan selesai sama, Agenda menang dari Jadwal) ---
  {
    const now07 = makeWibDate(7, 0);
    const agendaSamaWaktu = {
      id: "agenda-persis",
      title: "Agenda Bersamaan",
      start_at: new Date(Date.UTC(2026, 9, 24, 8 - 7, 0, 0, 0)).toISOString(), // 08:00 WIB
      end_at: new Date(Date.UTC(2026, 9, 24, 10 - 7, 30, 0, 0)).toISOString(),  // 10:30 WIB
    };
    const result = determineNextUpActivity([jadwalKuliah], [agendaSamaWaktu], now07);
    assert.strictEqual(result.type, "Agenda", "Skenario D2: Agenda harus diprioritaskan dibanding Jadwal jika waktu identik");
    console.log("  ✓ Skenario D2 Lolos: Waktu mulai dan durasi persis sama, Agenda diutamakan dibanding Jadwal Kuliah.");
  }

  // --- Skenario D3 (Tie-Break: Tipe dan waktu sama, abjad judul menang) ---
  {
    const now07 = makeWibDate(7, 0);
    const jadwalB = {
      ...jadwalKuliah,
      id: "jadwal-b",
      course_name: "Algoritma & Struktur Data", // Abjad A lebih dulu dari P
    };
    const result = determineNextUpActivity([jadwalKuliah, jadwalB], [], now07);
    assert.strictEqual(result.title, "Algoritma & Struktur Data", "Skenario D3: Abjad awal harus menang");
    console.log("  ✓ Skenario D3 Lolos: Waktu dan jenis sama, diurutkan menurut abjad judul.");
  }

  // --- Skenario Prioritas Ongoing ---
  {
    // Now = 08:30. Kuliah (08:00 - 10:30) sedang ongoing.
    // Agenda webinar (08:45 - 09:45) akan mulai 15 menit lagi.
    // Kuliah yang sedang berlangsung harus menang dari upcoming.
    const now0830 = makeWibDate(8, 30);
    const agendaMendatang = {
      id: "agenda-webinar",
      title: "Webinar",
      start_at: new Date(Date.UTC(2026, 9, 24, 8 - 7, 45, 0, 0)).toISOString(), // 08:45 WIB
      end_at: new Date(Date.UTC(2026, 9, 24, 9 - 7, 45, 0, 0)).toISOString(),   // 09:45 WIB
    };
    const result = determineNextUpActivity([jadwalKuliah], [agendaMendatang], now0830);
    assert.strictEqual(result.title, "Pemrograman Web Lanjut", "Ongoing harus mengalahkan upcoming");
    assert.strictEqual(result.isOngoing, true);
    console.log("  ✓ Skenario Ongoing: Kegiatan ongoing mengalahkan kegiatan upcoming.");
  }

  // --- Skenario Empty State ---
  {
    // Now = 22:00. Semua kegiatan sudah lewat.
    const now22 = makeWibDate(22, 0);
    const result = determineNextUpActivity([jadwalKuliah], [agendaSarapan], now22);
    assert.strictEqual(result, null, "Harus null saat semua kegiatan telah selesai");
    console.log("  ✓ Skenario Empty State: Mengembalikan null secara bersih jika tidak ada kegiatan aktif/mendatang.");
  }
}

// =====================================================================
// PENGUJIAN FILTER RENTANG TANGGAL JADWAL (start_date & end_date)
// =====================================================================
console.log("\n=== Menjalankan Pengujian Filter Rentang Tanggal Jadwal pada Next Up ===");

// Target tanggal uji: Sabtu, 24 Oktober 2026 (day_of_week: 6)
// Waktu pengujian: 07:00 WIB
const testNowDate = new Date(Date.UTC(2026, 9, 24, 7 - 7, 0, 0, 0)); // 07:00 WIB
const testNow = toJakartaDate(testNowDate);
assert.strictEqual(testNow.getDay(), 6, "Hari uji harus hari Sabtu (6)");

// 1. Jadwal dengan start_date di masa depan (2026-10-31) tidak boleh muncul pada 2026-10-24
{
  const futureSchedule = {
    id: "sched-future",
    day_of_week: 6,
    course_name: "Jadwal Belum Dimulai",
    start_time: "08:00",
    end_time: "10:00",
    start_date: "2026-10-31",
    end_date: "2026-12-31",
  };
  const result = determineNextUpActivity([futureSchedule], [], testNow);
  assert.strictEqual(result, null, "Jadwal dengan start_date di masa depan tidak boleh muncul");
  console.log("  ✓ Lolos 1: Jadwal dengan start_date di masa depan tidak muncul sebelum tanggal mulai.");
}

// 2. Jadwal dengan end_date di masa lalu (2026-10-17) tidak boleh muncul pada 2026-10-24
{
  const expiredSchedule = {
    id: "sched-expired",
    day_of_week: 6,
    course_name: "Jadwal Telah Berakhir",
    start_time: "08:00",
    end_time: "10:00",
    start_date: "2026-08-01",
    end_date: "2026-10-17",
  };
  const result = determineNextUpActivity([expiredSchedule], [], testNow);
  assert.strictEqual(result, null, "Jadwal dengan end_date di masa lalu tidak boleh muncul");
  console.log("  ✓ Lolos 2: Jadwal dengan end_date di masa lalu tidak muncul setelah tanggal berakhir.");
}

// 3a. Jadwal tepat pada start_date (inklusif batas awal: 2026-10-24)
{
  const startDateSchedule = {
    id: "sched-start-inclusive",
    day_of_week: 6,
    course_name: "Kuliah Perdana",
    start_time: "08:00",
    end_time: "10:00",
    start_date: "2026-10-24",
    end_date: "2026-12-31",
  };
  const result = determineNextUpActivity([startDateSchedule], [], testNow);
  assert.ok(result, "Jadwal tepat pada start_date harus muncul");
  assert.strictEqual(result.title, "Kuliah Perdana");
  console.log("  ✓ Lolos 3a: Jadwal tepat pada start_date tetap aktif (batas awal inklusif).");
}

// 3b. Jadwal tepat pada end_date (inklusif batas akhir: 2026-10-24)
{
  const endDateSchedule = {
    id: "sched-end-inclusive",
    day_of_week: 6,
    course_name: "Kuliah Terakhir",
    start_time: "08:00",
    end_time: "10:00",
    start_date: "2026-08-01",
    end_date: "2026-10-24",
  };
  const result = determineNextUpActivity([endDateSchedule], [], testNow);
  assert.ok(result, "Jadwal tepat pada end_date harus muncul");
  assert.strictEqual(result.title, "Kuliah Terakhir");
  console.log("  ✓ Lolos 3b: Jadwal tepat pada end_date tetap aktif (batas akhir inklusif).");
}

// 4. Jadwal yang berada dalam rentang tanggal aktif dan cocok hari mingguan
{
  const activeSchedule = {
    id: "sched-in-range",
    day_of_week: 6,
    course_name: "Sistem Terdistribusi",
    start_time: "08:00",
    end_time: "10:00",
    start_date: "2026-10-01",
    end_date: "2026-11-30",
  };
  const result = determineNextUpActivity([activeSchedule], [], testNow);
  assert.ok(result, "Jadwal dalam rentang aktif harus muncul");
  assert.strictEqual(result.title, "Sistem Terdistribusi");
  console.log("  ✓ Lolos 4: Jadwal yang masih dalam rentang tanggal dan cocok hari mingguan tetap muncul.");
}

// 5. Jadwal lama (legacy) tanpa start_date dan end_date tetap aktif
{
  const legacySchedule = {
    id: "sched-legacy",
    day_of_week: 6,
    course_name: "Jadwal Legacy Tanpa Batas",
    start_time: "08:00",
    end_time: "10:00",
    start_date: null,
    end_date: null,
  };
  const result = determineNextUpActivity([legacySchedule], [], testNow);
  assert.ok(result, "Jadwal legacy tanpa tanggal harus tetap aktif");
  assert.strictEqual(result.title, "Jadwal Legacy Tanpa Batas");
  console.log("  ✓ Lolos 5: Jadwal lama tanpa start_date dan end_date tetap berfungsi normal.");
}

// 6. Interaksi Next Up: Jadwal masa depan tidak menghalangi Agenda yang valid hari ini
{
  const futureSchedule = {
    id: "sched-future-2",
    day_of_week: 6,
    course_name: "Jadwal Belum Mulai Jam 08:00",
    start_time: "08:00",
    end_time: "10:00",
    start_date: "2026-11-01",
    end_date: "2026-12-31",
  };
  const todayAgenda = {
    id: "agenda-today-0900",
    title: "Workshop Desain UI",
    start_at: new Date(Date.UTC(2026, 9, 24, 9 - 7, 0, 0, 0)).toISOString(), // 09:00 WIB
    end_at: new Date(Date.UTC(2026, 9, 24, 11 - 7, 0, 0, 0)).toISOString(),  // 11:00 WIB
  };
  // Pukul 07:00 WIB, jadwal 08:00 tidak valid karena start_date di masa depan.
  // Next Up harus memilih agenda 09:00 secara tepat.
  const result = determineNextUpActivity([futureSchedule], [todayAgenda], testNow);
  assert.ok(result, "Harus memilih Agenda yang valid");
  assert.strictEqual(result.title, "Workshop Desain UI");
  assert.strictEqual(result.type, "Agenda");
  console.log("  ✓ Lolos 6: Jadwal di luar rentang tanggal diabaikan dan Agenda valid terpilih sebagai Next Up.");
}

console.log("\n Semua pengujian Next Up berhasil 100%!");
