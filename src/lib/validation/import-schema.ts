import { z } from "zod";

export const taskImportSchema = z.object({
  id: z.string(),
  user_id: z.string().optional().default("user-default"),
  title: z.string().min(1, "Judul tugas tidak boleh kosong"),
  description: z.string().optional(),
  due_at: z.string().optional(),
  priority: z.enum(["low", "medium", "high"]),
  status: z.enum(["todo", "in_progress", "done"]),
  course_schedule_id: z.string().optional(),
  created_at: z.string().optional().default(() => new Date().toISOString()),
  updated_at: z.string().optional().default(() => new Date().toISOString()),
});

export const noteImportSchema = z.object({
  id: z.string(),
  user_id: z.string().optional().default("user-default"),
  title: z.string().min(1, "Judul catatan tidak boleh kosong"),
  content: z.string(),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  is_favorite: z.boolean().default(false),
  created_at: z.string().optional().default(() => new Date().toISOString()),
  updated_at: z.string().optional().default(() => new Date().toISOString()),
});

export const scheduleImportSchema = z.object({
  id: z.string(),
  user_id: z.string().optional().default("user-default"),
  course_name: z.string().min(1, "Nama mata kuliah tidak boleh kosong"),
  course_code: z.string().optional(),
  day_of_week: z.union([
    z.literal(0),
    z.literal(1),
    z.literal(2),
    z.literal(3),
    z.literal(4),
    z.literal(5),
    z.literal(6),
  ]),
  start_time: z.string().min(3),
  end_time: z.string().min(3),
  location: z.string().optional(),
  recurrence_rule: z.string().optional(),
  created_at: z.string().optional().default(() => new Date().toISOString()),
  updated_at: z.string().optional().default(() => new Date().toISOString()),
});

export const agendaImportSchema = z.object({
  id: z.string(),
  user_id: z.string().optional().default("user-default"),
  title: z.string().min(1, "Judul agenda tidak boleh kosong"),
  description: z.string().optional(),
  start_at: z.string().min(1),
  end_at: z.string().optional(),
  location: z.string().optional(),
  reminder_minutes: z.number().optional(),
  created_at: z.string().optional().default(() => new Date().toISOString()),
  updated_at: z.string().optional().default(() => new Date().toISOString()),
});

export const noctisExportSchema = z.object({
  version: z.string(),
  app: z.string().optional(),
  exported_at: z.string().optional(),
  profile: z
    .object({
      name: z.string().min(1),
      email: z.string().email(),
      title: z.string().optional(),
    })
    .optional(),
  preferences: z
    .object({
      theme: z.enum(["light", "dark", "system"]).optional(),
      timezone: z.string().optional(),
      notifications: z
        .object({
          course_schedule: z.boolean().optional(),
          task_deadline: z.boolean().optional(),
          agenda_event: z.boolean().optional(),
        })
        .optional(),
    })
    .optional(),
  data: z.object({
    tasks: z.array(taskImportSchema).default([]),
    notes: z.array(noteImportSchema).default([]),
    schedules: z.array(scheduleImportSchema).default([]),
    agendaEvents: z.array(agendaImportSchema).default([]),
  }),
});

export type ValidatedNoctisExport = z.infer<typeof noctisExportSchema>;
