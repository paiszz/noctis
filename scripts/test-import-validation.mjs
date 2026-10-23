import assert from "node:assert";
import {
  noctisExportSchema,
  taskImportSchema,
  scheduleImportSchema,
  noteImportSchema,
  agendaImportSchema,
} from "../src/lib/validation/import-schema.ts";

console.log("=== Menjalankan Pengujian Stage 6.1 — Validasi Schema & Pemetaan ID ===\n");

// ── TEST 1: Validasi File Backup Lengkap dengan Nilai Null pada Field Opsional ──
console.log("[Test 1] Validasi JSON dengan nilai null pada field opsional (Null Tolerance)");
const sampleBackupWithNulls = {
  version: "1.0.0",
  app: "Noctis — Your Personal Productivity Space",
  exported_at: new Date().toISOString(),
  profile: {
    name: "Ridwan Faiz",
    email: "faiz@example.com",
    title: null, // Nullable optional
  },
  preferences: {
    theme: "dark",
    timezone: "Asia/Jakarta",
    notifications: {
      course_schedule: true,
      task_deadline: null, // null should be tolerated
    },
  },
  data: {
    tasks: [
      {
        id: "task-001",
        title: "Tugas 1",
        description: null,
        due_at: null,
        priority: "high",
        status: "todo",
        course_schedule_id: null,
      },
      {
        id: "task-002",
        title: "Tugas 2 dengan Deadline",
        description: "Ada deskripsi",
        due_at: "2026-10-25T14:00:00.000Z",
        priority: "medium",
        status: "in_progress",
        course_schedule_id: "sched-001",
      },
    ],
    notes: [
      {
        id: "note-001",
        title: "Catatan Kuliah",
        content: "Isi catatan",
        category: null,
        tags: null,
        is_favorite: true,
      },
    ],
    schedules: [
      {
        id: "sched-001",
        course_name: "Struktur Data",
        course_code: null,
        day_of_week: 1,
        start_time: "8:00", // Non-padded format to be normalized to "08:00"
        end_time: "9:40",  // Non-padded format to be normalized to "09:40"
        location: null,
        recurrence_rule: null,
        start_date: null,
        end_date: null,
      },
    ],
    agendaEvents: [
      {
        id: "agenda-001",
        title: "Rapat BEM",
        description: null,
        start_at: "2026-10-24T09:00:00.000Z",
        end_at: null,
        location: null,
        reminder_minutes: null,
      },
    ],
  },
};

const parseResult = noctisExportSchema.safeParse(sampleBackupWithNulls);
assert.strictEqual(parseResult.success, true, "Test 1 Gagal: Schema harus menerima field opsional bernilai null.");

const parsedData = parseResult.data;
assert.strictEqual(parsedData.profile.title, undefined, "Null pada profile.title harus ditransformasikan ke undefined.");
assert.strictEqual(parsedData.data.tasks[0].description, undefined, "Null pada description harus ditransformasikan ke undefined.");
assert.strictEqual(parsedData.data.tasks[0].due_at, undefined, "Null pada due_at harus ditransformasikan ke undefined.");
assert.strictEqual(parsedData.data.tasks[0].course_schedule_id, undefined, "Null pada course_schedule_id harus ditransformasikan ke undefined.");
assert.strictEqual(parsedData.data.schedules[0].start_time, "08:00", "Format waktu '8:00' harus dinormalisasi menjadi '08:00'.");
assert.strictEqual(parsedData.data.schedules[0].end_time, "09:40", "Format waktu '9:40' harus dinormalisasi menjadi '09:40'.");
assert.strictEqual(parsedData.data.notes[0].tags, undefined, "Null pada tags harus ditransformasikan ke undefined.");
assert.strictEqual(parsedData.data.agendaEvents[0].end_at, undefined, "Null pada end_at harus ditransformasikan ke undefined.");
console.log("  ✓ Lolos: Semua field opsional bernilai null berhasil divalidasi dan ditransformasikan secara aman.\n");

// ── TEST 2: Penolakan Data Tidak Valid (Invalid Types & Values) ──
console.log("[Test 2] Penolakan data tidak valid");

// 2a. Task dengan judul kosong
assert.strictEqual(
  taskImportSchema.safeParse({ id: "t1", title: "", priority: "high", status: "todo" }).success,
  false,
  "2a: Judul kosong harus ditolak"
);

// 2b. Task dengan priority tidak valid
assert.strictEqual(
  taskImportSchema.safeParse({ id: "t1", title: "Valid", priority: "critical", status: "todo" }).success,
  false,
  "2b: Priority 'critical' harus ditolak (hanya low, medium, high)"
);

// 2c. Task dengan status tidak valid
assert.strictEqual(
  taskImportSchema.safeParse({ id: "t1", title: "Valid", priority: "low", status: "pending" }).success,
  false,
  "2c: Status 'pending' harus ditolak (hanya todo, in_progress, done)"
);

// 2d. Task dengan tanggal rusak
assert.strictEqual(
  taskImportSchema.safeParse({ id: "t1", title: "Valid", priority: "low", status: "todo", due_at: "bukan-tanggal" }).success,
  false,
  "2d: Format due_at tidak valid harus ditolak"
);

// 2e. Schedule dengan day_of_week tidak valid (> 6)
assert.strictEqual(
  scheduleImportSchema.safeParse({
    id: "s1",
    course_name: "Kalkulus",
    day_of_week: 7,
    start_time: "08:00",
    end_time: "10:00",
  }).success,
  false,
  "2e: day_of_week di luar 0-6 harus ditolak"
);

// 2f. Schedule dengan format waktu jam rusak (misal "25:00")
assert.strictEqual(
  scheduleImportSchema.safeParse({
    id: "s1",
    course_name: "Kalkulus",
    day_of_week: 1,
    start_time: "25:00",
    end_time: "10:00",
  }).success,
  false,
  "2f: start_time di luar batas 24 jam harus ditolak"
);

// 2g. Agenda dengan start_at format tanggal rusak
assert.strictEqual(
  agendaImportSchema.safeParse({
    id: "a1",
    title: "Seminar",
    start_at: "tanggal-palsu",
  }).success,
  false,
  "2g: start_at tidak valid harus ditolak"
);

console.log("  ✓ Lolos: Seluruh data invalid (tipe, enum, rentang, dan format waktu) berhasil ditolak dengan tepat.\n");

// ── TEST 3: Logika Pemetaan ID Schedules -> Tasks ──
console.log("[Test 3] Pengujian Logika Pemetaan ID Schedules ke Tasks");

const mockSchedulesFromBackup = [
  { id: "sched-001", course_name: "Pemrograman Web" },
  { id: "sched-002", course_name: "Basis Data" },
];

const mockTasksFromBackup = [
  { id: "task-001", title: "Tugas Web", course_schedule_id: "sched-001" },
  { id: "task-002", title: "Tugas BD", course_schedule_id: "sched-002" },
  { id: "task-003", title: "Tugas Mandiri (Tanpa Relasi)", course_schedule_id: undefined },
  { id: "task-004", title: "Tugas Relasi Hilang (ID Ghost)", course_schedule_id: "sched-ghost-999" },
  { id: "task-005", title: "Tugas Relasi Eksisting Akun", course_schedule_id: "existing-uuid-123" },
];

const userExistingSchedulesInAccount = [
  { id: "existing-uuid-123", course_name: "Jadwal Lama Pengguna" },
];

// Simulasi pembuatan schedule di Supabase yang menghasilkan UUID baru
const scheduleIdMap = new Map();
const mockSupabaseGeneratedUuids = {
  "sched-001": "uuid-supabase-new-web-001",
  "sched-002": "uuid-supabase-new-bd-002",
};

for (const s of mockSchedulesFromBackup) {
  const newUuid = mockSupabaseGeneratedUuids[s.id];
  scheduleIdMap.set(s.id, newUuid);
}

// Simulasi pemetaan tasks
const resolvedTasks = mockTasksFromBackup.map((t) => {
  let resolvedScheduleId = undefined;
  if (t.course_schedule_id) {
    if (scheduleIdMap.has(t.course_schedule_id)) {
      resolvedScheduleId = scheduleIdMap.get(t.course_schedule_id);
    } else {
      const existing = userExistingSchedulesInAccount.find((s) => s.id === t.course_schedule_id);
      if (existing) {
        resolvedScheduleId = existing.id;
      } else {
        // Relasi tidak ditemukan -> eksplisit dikosongkan agar task tidak gagal FK constraint
        resolvedScheduleId = undefined;
      }
    }
  }

  return {
    ...t,
    course_schedule_id: resolvedScheduleId,
  };
});

assert.strictEqual(
  resolvedTasks[0].course_schedule_id,
  "uuid-supabase-new-web-001",
  "Task 1 harus dipetakan ke UUID baru schedule 'sched-001'"
);
assert.strictEqual(
  resolvedTasks[1].course_schedule_id,
  "uuid-supabase-new-bd-002",
  "Task 2 harus dipetakan ke UUID baru schedule 'sched-002'"
);
assert.strictEqual(
  resolvedTasks[2].course_schedule_id,
  undefined,
  "Task 3 tanpa relasi harus tetap undefined"
);
assert.strictEqual(
  resolvedTasks[3].course_schedule_id,
  undefined,
  "Task 4 dengan ID ghost harus di-resolve ke undefined (mencegah Foreign Key constraint failure)"
);
assert.strictEqual(
  resolvedTasks[4].course_schedule_id,
  "existing-uuid-123",
  "Task 5 yang merujuk pada jadwal akun yang sudah ada harus tetap terhubung"
);

console.log("  ✓ Lolos: Logika pemetaan ID berhasil menyelesaikan ID jadwal lama, relasi eksisting, dan menangani relasi hilang secara eksplisit.\n");

console.log("SEMUA PENGUJIAN STAGE 6.1 BERHASIL (PASSED) 100%!");
