import type {
  CourseSchedule,
  Task,
  Note,
  AgendaEvent,
} from "@/types";

// ================================================
// Mock Data for Noctis — Fase 0–3 Development
// Data contoh untuk render UI tanpa database.
// Akan diganti dengan Supabase queries di Fase 6.
// ================================================

const USER_ID = "mock-user-001";
const now = new Date();

function toISODate(daysOffset: number): string {
  const d = new Date(now);
  d.setDate(d.getDate() + daysOffset);
  return d.toISOString();
}

function todayDayOfWeek(): 0 | 1 | 2 | 3 | 4 | 5 | 6 {
  return now.getDay() as 0 | 1 | 2 | 3 | 4 | 5 | 6;
}

function nextDay(offset: number): 0 | 1 | 2 | 3 | 4 | 5 | 6 {
  return ((now.getDay() + offset) % 7) as 0 | 1 | 2 | 3 | 4 | 5 | 6;
}

// ── Jadwal Kuliah ──

export const mockSchedules: CourseSchedule[] = [
  {
    id: "sched-001",
    user_id: USER_ID,
    course_name: "Pemrograman Web",
    course_code: "IF2201",
    day_of_week: todayDayOfWeek(),
    start_time: "08:00",
    end_time: "09:40",
    location: "Lab Komputer 3",
    recurrence_rule: "weekly",
    created_at: toISODate(-30),
    updated_at: toISODate(-30),
  },
  {
    id: "sched-002",
    user_id: USER_ID,
    course_name: "Basis Data",
    course_code: "IF2202",
    day_of_week: todayDayOfWeek(),
    start_time: "10:00",
    end_time: "11:40",
    location: "Ruang 201",
    recurrence_rule: "weekly",
    created_at: toISODate(-30),
    updated_at: toISODate(-30),
  },
  {
    id: "sched-003",
    user_id: USER_ID,
    course_name: "Kalkulus II",
    course_code: "MA1201",
    day_of_week: nextDay(1),
    start_time: "13:00",
    end_time: "14:40",
    location: "Ruang 105",
    recurrence_rule: "weekly",
    created_at: toISODate(-30),
    updated_at: toISODate(-30),
  },
  {
    id: "sched-004",
    user_id: USER_ID,
    course_name: "Sistem Operasi",
    course_code: "IF3101",
    day_of_week: nextDay(2),
    start_time: "08:00",
    end_time: "09:40",
    location: "Lab Komputer 1",
    recurrence_rule: "weekly",
    created_at: toISODate(-30),
    updated_at: toISODate(-30),
  },
  {
    id: "sched-005",
    user_id: USER_ID,
    course_name: "Rekayasa Perangkat Lunak",
    course_code: "IF3202",
    day_of_week: nextDay(3),
    start_time: "10:00",
    end_time: "12:30",
    location: "Ruang 302",
    recurrence_rule: "weekly",
    created_at: toISODate(-30),
    updated_at: toISODate(-30),
  },
];

// ── Tugas ──

export const mockTasks: Task[] = [
  {
    id: "task-001",
    user_id: USER_ID,
    title: "Tugas Praktikum Web — Modul 5",
    description: "Implementasi CRUD dengan Next.js dan Supabase.",
    due_at: toISODate(2),
    priority: "high",
    status: "in_progress",
    course_schedule_id: "sched-001",
    created_at: toISODate(-5),
    updated_at: toISODate(-1),
  },
  {
    id: "task-002",
    user_id: USER_ID,
    title: "Laporan Basis Data — ER Diagram",
    description: "Buat ER diagram untuk studi kasus perpustakaan.",
    due_at: toISODate(5),
    priority: "medium",
    status: "todo",
    course_schedule_id: "sched-002",
    created_at: toISODate(-3),
    updated_at: toISODate(-3),
  },
  {
    id: "task-003",
    user_id: USER_ID,
    title: "Tugas Kalkulus — Integral Lipat Dua",
    due_at: toISODate(-1), // overdue
    priority: "high",
    status: "todo",
    course_schedule_id: "sched-003",
    created_at: toISODate(-7),
    updated_at: toISODate(-7),
  },
  {
    id: "task-004",
    user_id: USER_ID,
    title: "Review materi UTS Sistem Operasi",
    due_at: toISODate(10),
    priority: "low",
    status: "todo",
    course_schedule_id: "sched-004",
    created_at: toISODate(-2),
    updated_at: toISODate(-2),
  },
  {
    id: "task-005",
    user_id: USER_ID,
    title: "Beli buku referensi RPL",
    priority: "low",
    status: "done",
    created_at: toISODate(-10),
    updated_at: toISODate(-4),
  },
];

// ── Catatan ──

export const mockNotes: Note[] = [
  {
    id: "note-001",
    user_id: USER_ID,
    title: "Catatan Pemrograman Web — REST API",
    content:
      "## REST API\n\nREST (Representational State Transfer) menggunakan HTTP methods:\n\n- **GET** — mengambil resource\n- **POST** — membuat resource baru\n- **PUT** — mengubah resource\n- **DELETE** — menghapus resource\n\nGunakan status code yang tepat: 200, 201, 404, 500.",
    category: "Kuliah",
    is_favorite: true,
    created_at: toISODate(-14),
    updated_at: toISODate(-2),
  },
  {
    id: "note-002",
    user_id: USER_ID,
    title: "Rangkuman Normalisasi Database",
    content:
      "## Normalisasi\n\n1. **1NF** — Atomic values, no repeating groups\n2. **2NF** — Full functional dependency on PK\n3. **3NF** — No transitive dependency\n4. **BCNF** — Every determinant is a candidate key",
    category: "Kuliah",
    is_favorite: false,
    created_at: toISODate(-10),
    updated_at: toISODate(-10),
  },
  {
    id: "note-003",
    user_id: USER_ID,
    title: "Ide Project Semester Depan",
    content:
      "- Aplikasi manajemen keuangan mahasiswa\n- Platform belajar coding interaktif\n- Sistem reservasi ruang belajar",
    category: "Personal",
    is_favorite: true,
    created_at: toISODate(-5),
    updated_at: toISODate(-5),
  },
  {
    id: "note-004",
    user_id: USER_ID,
    title: "Tips Wawancara Magang",
    content:
      "- Siapkan portfolio\n- Pelajari company culture\n- Latihan problem solving\n- Bawa pertanyaan untuk interviewer",
    category: "Karir",
    is_favorite: false,
    created_at: toISODate(-3),
    updated_at: toISODate(-3),
  },
];

// ── Agenda ──

export const mockAgendaEvents: AgendaEvent[] = [
  {
    id: "agenda-001",
    user_id: USER_ID,
    title: "Rapat Organisasi BEM",
    description: "Bahas acara Dies Natalis.",
    start_at: toISODate(1),
    end_at: toISODate(1),
    location: "Sekretariat BEM",
    created_at: toISODate(-7),
    updated_at: toISODate(-7),
  },
  {
    id: "agenda-002",
    user_id: USER_ID,
    title: "Belajar kelompok Kalkulus",
    start_at: toISODate(3),
    end_at: toISODate(3),
    location: "Perpustakaan Lantai 2",
    created_at: toISODate(-4),
    updated_at: toISODate(-4),
  },
  {
    id: "agenda-003",
    user_id: USER_ID,
    title: "Workshop Git & GitHub",
    description: "Workshop internal lab tentang version control.",
    start_at: toISODate(5),
    location: "Lab Komputer 2",
    created_at: toISODate(-2),
    updated_at: toISODate(-2),
  },
];

// ── Helper: categories dari notes ──

export function getMockNoteCategories(): string[] {
  const categories = new Set(
    mockNotes.map((n) => n.category).filter(Boolean) as string[]
  );
  return Array.from(categories);
}
