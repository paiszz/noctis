import { z } from "zod";

const optionalString = z
  .string()
  .nullable()
  .optional()
  .transform((v) => (v !== null && v !== undefined ? v : undefined));

const optionalDateString = z
  .string()
  .nullable()
  .optional()
  .refine((v) => !v || !isNaN(Date.parse(v)), {
    message: "Format tanggal tidak valid (harus berupa string tanggal ISO yang sah)",
  })
  .transform((v) => (v !== null && v !== undefined ? v : undefined));

const normalizeTime = (val: unknown): unknown => {
  if (typeof val === "string" && /^[0-9]:[0-5][0-9]$/.test(val)) {
    return "0" + val;
  }
  return val;
};

export const taskImportSchema = z.object({
  id: z.string(),
  user_id: z.string().optional().default("user-default"),
  title: z.string().min(1, "Judul tugas tidak boleh kosong"),
  description: optionalString,
  due_at: optionalDateString,
  priority: z.enum(["low", "medium", "high"]),
  status: z.enum(["todo", "in_progress", "done"]),
  course_schedule_id: optionalString,
  created_at: optionalDateString.default(() => new Date().toISOString()),
  updated_at: optionalDateString.default(() => new Date().toISOString()),
});

export const noteImportSchema = z.object({
  id: z.string(),
  user_id: z.string().optional().default("user-default"),
  title: z.string().min(1, "Judul catatan tidak boleh kosong"),
  content: z.string(),
  category: optionalString,
  tags: z
    .array(z.string())
    .nullable()
    .optional()
    .transform((v) => (v !== null && v !== undefined ? v : undefined)),
  is_favorite: z.boolean().default(false),
  created_at: optionalDateString.default(() => new Date().toISOString()),
  updated_at: optionalDateString.default(() => new Date().toISOString()),
});

export const scheduleImportSchema = z.object({
  id: z.string(),
  user_id: z.string().optional().default("user-default"),
  course_name: z.string().min(1, "Nama mata kuliah tidak boleh kosong"),
  course_code: optionalString,
  day_of_week: z.union([
    z.literal(0),
    z.literal(1),
    z.literal(2),
    z.literal(3),
    z.literal(4),
    z.literal(5),
    z.literal(6),
  ]),
  start_time: z
    .string()
    .transform(normalizeTime)
    .pipe(
      z
        .string()
        .regex(
          /^([01][0-9]|2[0-3]):[0-5][0-9]$/,
          "Format waktu mulai harus HH:mm (contoh: 08:00, 14:30)"
        )
    ),
  end_time: z
    .string()
    .transform(normalizeTime)
    .pipe(
      z
        .string()
        .regex(
          /^([01][0-9]|2[0-3]):[0-5][0-9]$/,
          "Format waktu selesai harus HH:mm (contoh: 09:40, 16:00)"
        )
    ),
  location: optionalString,
  recurrence_rule: optionalString,
  start_date: optionalString,
  end_date: optionalString,
  created_at: optionalDateString.default(() => new Date().toISOString()),
  updated_at: optionalDateString.default(() => new Date().toISOString()),
});

export const agendaImportSchema = z.object({
  id: z.string(),
  user_id: z.string().optional().default("user-default"),
  title: z.string().min(1, "Judul agenda tidak boleh kosong"),
  description: optionalString,
  start_at: z
    .string()
    .min(1, "Waktu mulai agenda tidak boleh kosong")
    .refine((val) => !isNaN(Date.parse(val)), {
      message: "Format waktu mulai agenda (start_at) tidak valid",
    }),
  end_at: optionalDateString,
  location: optionalString,
  reminder_minutes: z
    .number()
    .nullable()
    .optional()
    .transform((v) => (v !== null && v !== undefined ? v : undefined)),
  created_at: optionalDateString.default(() => new Date().toISOString()),
  updated_at: optionalDateString.default(() => new Date().toISOString()),
});

export const noctisExportSchema = z.object({
  version: z.string(),
  app: z.string().optional(),
  exported_at: z.string().optional(),
  profile: z
    .object({
      name: z.string().min(1, "Nama profil tidak boleh kosong"),
      email: z.string().email("Format email profil tidak valid"),
      title: optionalString,
    })
    .nullable()
    .optional()
    .transform((v) => (v !== null && v !== undefined ? v : undefined)),
  preferences: z
    .object({
      theme: z
        .enum(["light", "dark", "system"])
        .nullable()
        .optional()
        .transform((v) => (v !== null && v !== undefined ? v : undefined)),
      timezone: optionalString,
      notifications: z
        .object({
          course_schedule: z
            .boolean()
            .nullable()
            .optional()
            .transform((v) => (v !== null && v !== undefined ? v : undefined)),
          task_deadline: z
            .boolean()
            .nullable()
            .optional()
            .transform((v) => (v !== null && v !== undefined ? v : undefined)),
          agenda_event: z
            .boolean()
            .nullable()
            .optional()
            .transform((v) => (v !== null && v !== undefined ? v : undefined)),
        })
        .nullable()
        .optional()
        .transform((v) => (v !== null && v !== undefined ? v : undefined)),
    })
    .nullable()
    .optional()
    .transform((v) => (v !== null && v !== undefined ? v : undefined)),
  data: z.object({
    tasks: z.array(taskImportSchema).default([]),
    notes: z.array(noteImportSchema).default([]),
    schedules: z.array(scheduleImportSchema).default([]),
    agendaEvents: z.array(agendaImportSchema).default([]),
  }),
});

export type ValidatedNoctisExport = z.infer<typeof noctisExportSchema>;
