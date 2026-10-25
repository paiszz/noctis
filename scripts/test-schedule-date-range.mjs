import assert from "node:assert";

/**
 * Logika isScheduleActiveOnDate yang identik dengan src/types/schedule.ts
 */
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

console.log("=== Menjalankan Pengujian Rentang Tanggal Jadwal Kuliah Noctis ===\n");

// Contoh jadwal: Pemrograman Web setiap hari Senin (day_of_week: 1)
// Semester Ganjil: 7 September 2026 s/d 21 Desember 2026
const semesterSchedule = {
  id: "sched-sem-01",
  course_name: "Pemrograman Web",
  day_of_week: 1, // Senin
  start_time: "08:00",
  end_time: "09:40",
  start_date: "2026-09-07",
  end_date: "2026-12-21",
};

// [Test 1] Batas Awal (Start Date Boundary)
console.log("[Test 1] Batas Awal: Jadwal harus aktif pada tanggal start_date persis");
{
  const onStart = new Date(2026, 8, 7); // 7 September 2026 (Senin)
  assert.strictEqual(
    isScheduleActiveOnDate(semesterSchedule, onStart),
    true,
    "Jadwal HARUS aktif pada tanggal start_date persis (7 Sep 2026)"
  );
  assert.strictEqual(
    isScheduleActiveOnDate(semesterSchedule, "2026-09-07"),
    true,
    "Jadwal HARUS aktif ketika targetDate berupa string '2026-09-07'"
  );
  console.log("  ✓ Lolos: Jadwal aktif pada batas awal (start_date).");
}

// [Test 2] Batas Akhir (End Date Boundary)
console.log("[Test 2] Batas Akhir: Jadwal harus aktif pada tanggal end_date persis");
{
  const onEnd = new Date(2026, 11, 21); // 21 Desember 2026 (Senin)
  assert.strictEqual(
    isScheduleActiveOnDate(semesterSchedule, onEnd),
    true,
    "Jadwal HARUS aktif pada tanggal end_date persis (21 Des 2026)"
  );
  assert.strictEqual(
    isScheduleActiveOnDate(semesterSchedule, "2026-12-21"),
    true,
    "Jadwal HARUS aktif ketika targetDate berupa string '2026-12-21'"
  );
  console.log("  ✓ Lolos: Jadwal aktif pada batas akhir (end_date).");
}

// [Test 3] Di Dalam Rentang (Within Range)
console.log("[Test 3] Dalam Rentang: Jadwal harus aktif pada hari Senin di antara rentang");
{
  const midSemester = new Date(2026, 9, 19); // 19 Oktober 2026 (Senin)
  assert.strictEqual(
    isScheduleActiveOnDate(semesterSchedule, midSemester),
    true,
    "Jadwal HARUS aktif pada 19 Okt 2026 (Senin di tengah semester)"
  );
  console.log("  ✓ Lolos: Jadwal aktif di tengah rentang semester.");
}

// [Test 4] Di Luar Rentang: Sebelum Batas Awal
console.log("[Test 4] Di Luar Rentang: Jadwal TIDAK boleh muncul sebelum start_date");
{
  const beforeStart = new Date(2026, 7, 31); // 31 Agustus 2026 (Senin sebelum semester)
  assert.strictEqual(
    isScheduleActiveOnDate(semesterSchedule, beforeStart),
    false,
    "Jadwal TIDAK boleh aktif pada 31 Agustus 2026 (sebelum semester mulai)"
  );
  assert.strictEqual(
    isScheduleActiveOnDate(semesterSchedule, "2026-08-31"),
    false,
    "Jadwal TIDAK boleh aktif pada string '2026-08-31'"
  );
  console.log("  ✓ Lolos: Jadwal berhasil disembunyikan sebelum tanggal mulai.");
}

// [Test 5] Di Luar Rentang: Setelah Batas Akhir
console.log("[Test 5] Di Luar Rentang: Jadwal TIDAK boleh muncul setelah end_date");
{
  const afterEnd = new Date(2026, 11, 28); // 28 Desember 2026 (Senin setelah semester selesai)
  assert.strictEqual(
    isScheduleActiveOnDate(semesterSchedule, afterEnd),
    false,
    "Jadwal TIDAK boleh aktif pada 28 Desember 2026 (setelah semester selesai)"
  );
  assert.strictEqual(
    isScheduleActiveOnDate(semesterSchedule, "2026-12-28"),
    false,
    "Jadwal TIDAK boleh aktif pada string '2026-12-28'"
  );
  console.log("  ✓ Lolos: Jadwal berhasil disembunyikan setelah tanggal selesai.");
}

// [Test 6] Hari Tidak Sesuai (Weekday Mismatch)
console.log("[Test 6] Hari Berbeda: Jadwal TIDAK boleh muncul pada hari yang salah meskipun dalam rentang");
{
  const tuesdayInRange = new Date(2026, 9, 20); // 20 Oktober 2026 (Selasa)
  assert.strictEqual(
    isScheduleActiveOnDate(semesterSchedule, tuesdayInRange),
    false,
    "Jadwal kuliah Senin TIDAK boleh muncul di hari Selasa"
  );
  console.log("  ✓ Lolos: Jadwal tidak muncul pada hari yang tidak sesuai.");
}

// [Test 7] Kompatibilitas Jadwal Lama (Legacy Schedules without dates)
console.log("[Test 7] Kompatibilitas Jadwal Lama: Jadwal tanpa start_date & end_date harus tetap aktif di semua hari yang cocok");
{
  const legacySchedule1 = {
    id: "sched-legacy-01",
    course_name: "Kalkulus (Legacy undefined)",
    day_of_week: 1, // Senin
    start_time: "10:00",
    end_time: "11:40",
  };
  const legacySchedule2 = {
    id: "sched-legacy-02",
    course_name: "Fisika (Legacy null)",
    day_of_week: 1, // Senin
    start_time: "13:00",
    end_time: "14:40",
    start_date: null,
    end_date: null,
  };
  const legacySchedule3 = {
    id: "sched-legacy-03",
    course_name: "Kimia (Legacy empty string)",
    day_of_week: 1, // Senin
    start_time: "15:00",
    end_time: "16:40",
    start_date: "",
    end_date: "",
  };

  const datesToTest = [
    new Date(2024, 0, 1),   // 1 Jan 2024 (Senin masa lalu)
    new Date(2026, 9, 19),  // 19 Okt 2026 (Senin saat ini)
    new Date(2030, 4, 13),  // 13 Mei 2030 (Senin masa depan)
  ];

  for (const date of datesToTest) {
    assert.strictEqual(
      isScheduleActiveOnDate(legacySchedule1, date),
      true,
      `Jadwal legacy (undefined) harus aktif pada ${date.toISOString()}`
    );
    assert.strictEqual(
      isScheduleActiveOnDate(legacySchedule2, date),
      true,
      `Jadwal legacy (null) harus aktif pada ${date.toISOString()}`
    );
    assert.strictEqual(
      isScheduleActiveOnDate(legacySchedule3, date),
      true,
      `Jadwal legacy (empty string) harus aktif pada ${date.toISOString()}`
    );
  }
  console.log("  ✓ Lolos: Seluruh jadwal lama (undefined/null/empty) tetap aman dan tidak hilang.");
}

// [Test 8] Rentang Parsial: Hanya start_date (Unbounded End)
console.log("[Test 8] Rentang Parsial: Jadwal dengan hanya start_date aktif sejak tanggal mulai ke masa depan");
{
  const openEndSchedule = {
    id: "sched-open-end",
    course_name: "Bimbingan Skripsi",
    day_of_week: 1,
    start_date: "2026-09-07",
  };

  assert.strictEqual(isScheduleActiveOnDate(openEndSchedule, "2026-08-31"), false);
  assert.strictEqual(isScheduleActiveOnDate(openEndSchedule, "2026-09-07"), true);
  assert.strictEqual(isScheduleActiveOnDate(openEndSchedule, "2027-09-06"), true);
  console.log("  ✓ Lolos: Jadwal dengan hanya start_date bekerja secara tepat.");
}

// [Test 9] Rentang Parsial: Hanya end_date (Unbounded Start)
console.log("[Test 9] Rentang Parsial: Jadwal dengan hanya end_date aktif dari masa lalu hingga batas selesai");
{
  const openStartSchedule = {
    id: "sched-open-start",
    course_name: "Matrikulasi",
    day_of_week: 1,
    end_date: "2026-10-12",
  };

  assert.strictEqual(isScheduleActiveOnDate(openStartSchedule, "2025-01-06"), true);
  assert.strictEqual(isScheduleActiveOnDate(openStartSchedule, "2026-10-12"), true);
  assert.strictEqual(isScheduleActiveOnDate(openStartSchedule, "2026-10-19"), false);
  console.log("  ✓ Lolos: Jadwal dengan hanya end_date bekerja secara tepat.");
}

// [Test 10] Dukungan ISO Timestamp String pada start_date dan end_date
console.log("[Test 10] Toleransi Format: Mendukung start_date dan end_date berformat ISO lengkap");
{
  const isoSchedule = {
    id: "sched-iso",
    course_name: "Sistem Operasi",
    day_of_week: 1,
    start_date: "2026-09-07T00:00:00.000Z",
    end_date: "2026-12-21T23:59:59.000Z",
  };

  assert.strictEqual(isScheduleActiveOnDate(isoSchedule, "2026-08-31"), false);
  assert.strictEqual(isScheduleActiveOnDate(isoSchedule, "2026-09-07"), true);
  assert.strictEqual(isScheduleActiveOnDate(isoSchedule, "2026-12-21"), true);
  assert.strictEqual(isScheduleActiveOnDate(isoSchedule, "2026-12-28"), false);
  console.log("  ✓ Lolos: Format ISO timestamp lengkap ditoleransi dengan sempurna.");
}

// [Test 11] Konsistensi Lintas Zona Waktu
console.log("[Test 11] Konsistensi Lintas Zona Waktu: Tidak terjadi pergeseran tanggal kalender");
{
  const testTzs = ["Asia/Jakarta", "Asia/Makassar", "Asia/Jayapura", "UTC", "America/New_York", "Europe/London"];
  for (const tz of testTzs) {
    process.env.TZ = tz;
    const testDate = new Date(2026, 8, 7); // 7 Sep 2026 (Senin)
    assert.strictEqual(
      isScheduleActiveOnDate(semesterSchedule, testDate),
      true,
      `Gagal pada zona waktu ${tz}`
    );
    assert.strictEqual(
      isScheduleActiveOnDate(semesterSchedule, "2026-09-07"),
      true,
      `Gagal string pada zona waktu ${tz}`
    );
  }
  console.log("  ✓ Lolos: Konsisten di seluruh zona waktu tanpa pergeseran kalender.");
}

console.log("\n=======================================================");
console.log("SEMUA PENGUJIAN RENTANG TANGGAL JADWAL BERHASIL 100%!");
console.log("=======================================================\n");
