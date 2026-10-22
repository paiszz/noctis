"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
} from "react";
import type {
  Task,
  Note,
  CourseSchedule,
  AgendaEvent,
  DayOfWeek,
  TaskPriority,
  TaskStatus,
  UserProfile,
  UserPreferences,
  NotificationSettings,
  NoctisExportData,
} from "@/types";
import type { ValidatedNoctisExport } from "@/lib/validation/import-schema";
import {
  mockTasks as initialMockTasks,
  mockNotes as initialMockNotes,
  mockSchedules as initialMockSchedules,
  mockAgendaEvents as initialMockAgendaEvents,
} from "@/lib/mock-data";

const TASKS_STORAGE_KEY = "noctis_storage_tasks_v1";
const NOTES_STORAGE_KEY = "noctis_storage_notes_v1";
const SCHEDULES_STORAGE_KEY = "noctis_storage_schedules_v1";
const AGENDA_STORAGE_KEY = "noctis_storage_agenda_v1";
const PROFILE_STORAGE_KEY = "noctis_storage_profile_v1";
const PREFERENCES_STORAGE_KEY = "noctis_storage_preferences_v1";

const DEFAULT_USER_ID = "user-default";

const DEFAULT_PROFILE: UserProfile = {
  name: "Faiz",
  email: "faiz@example.com",
  title: "Personal Workspace",
};

const DEFAULT_PREFERENCES: UserPreferences = {
  theme: "light",
  timezone: "Asia/Jakarta",
  notifications: {
    course_schedule: true,
    task_deadline: true,
    agenda_event: false,
  },
};

function generateId(prefix: string): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}

export interface TaskInput {
  title: string;
  description?: string;
  due_at?: string;
  priority: TaskPriority;
  status?: TaskStatus;
  course_schedule_id?: string;
}

export interface NoteInput {
  title: string;
  content: string;
  category?: string;
  tags?: string[];
  is_favorite?: boolean;
}

export interface ScheduleInput {
  course_name: string;
  course_code?: string;
  day_of_week: DayOfWeek;
  start_time: string; // "HH:mm"
  end_time: string; // "HH:mm"
  location?: string;
  recurrence_rule?: string;
}

export interface AgendaInput {
  title: string;
  description?: string;
  start_at: string; // ISO datetime
  end_at?: string; // ISO datetime
  location?: string;
  reminder_minutes?: number;
}

interface DataContextType {
  // Tasks
  tasks: Task[];
  addTask: (input: TaskInput) => Task;
  updateTask: (id: string, updates: Partial<Omit<Task, "id" | "user_id">>) => void;
  deleteTask: (id: string) => void;
  toggleTaskStatus: (id: string) => void;

  // Notes
  notes: Note[];
  addNote: (input: NoteInput) => Note;
  updateNote: (id: string, updates: Partial<Omit<Note, "id" | "user_id">>) => void;
  deleteNote: (id: string) => void;
  toggleNoteFavorite: (id: string) => void;

  // Schedules (Jadwal Kuliah)
  schedules: CourseSchedule[];
  addSchedule: (input: ScheduleInput) => CourseSchedule;
  updateSchedule: (id: string, updates: Partial<Omit<CourseSchedule, "id" | "user_id">>) => void;
  deleteSchedule: (id: string) => void;

  // Agenda Events
  agendaEvents: AgendaEvent[];
  addAgendaEvent: (input: AgendaInput) => AgendaEvent;
  updateAgendaEvent: (id: string, updates: Partial<Omit<AgendaEvent, "id" | "user_id">>) => void;
  deleteAgendaEvent: (id: string) => void;

  // Profile
  profile: UserProfile;
  updateProfile: (updates: Partial<UserProfile>) => void;

  // Preferences
  preferences: UserPreferences;
  updatePreferences: (updates: Partial<UserPreferences>) => void;
  setNotificationPreference: (category: keyof NotificationSettings, enabled: boolean) => void;

  // Data Management
  exportAllData: () => NoctisExportData;
  importAllData: (data: ValidatedNoctisExport) => void;

  isLoaded: boolean;
}

const DataContext = createContext<DataContextType | null>(null);

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [tasks, setTasks] = useState<Task[]>(initialMockTasks);
  const [notes, setNotes] = useState<Note[]>(initialMockNotes);
  const [schedules, setSchedules] = useState<CourseSchedule[]>(initialMockSchedules);
  const [agendaEvents, setAgendaEvents] = useState<AgendaEvent[]>(initialMockAgendaEvents);
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_PREFERENCES);
  const [isLoaded, setIsLoaded] = useState(false);

  // Initialize from localStorage on client mount (safe from SSR hydration mismatch)
  useEffect(() => {
    try {
      const storedTasks = localStorage.getItem(TASKS_STORAGE_KEY);
      if (storedTasks) {
        setTasks(JSON.parse(storedTasks));
      } else {
        localStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(initialMockTasks));
      }

      const storedNotes = localStorage.getItem(NOTES_STORAGE_KEY);
      if (storedNotes) {
        setNotes(JSON.parse(storedNotes));
      } else {
        localStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(initialMockNotes));
      }

      const storedSchedules = localStorage.getItem(SCHEDULES_STORAGE_KEY);
      if (storedSchedules) {
        setSchedules(JSON.parse(storedSchedules));
      } else {
        localStorage.setItem(SCHEDULES_STORAGE_KEY, JSON.stringify(initialMockSchedules));
      }

      const storedAgenda = localStorage.getItem(AGENDA_STORAGE_KEY);
      if (storedAgenda) {
        setAgendaEvents(JSON.parse(storedAgenda));
      } else {
        localStorage.setItem(AGENDA_STORAGE_KEY, JSON.stringify(initialMockAgendaEvents));
      }

      const storedProfile = localStorage.getItem(PROFILE_STORAGE_KEY);
      if (storedProfile) {
        setProfile(JSON.parse(storedProfile));
      } else {
        localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(DEFAULT_PROFILE));
      }

      const storedPrefs = localStorage.getItem(PREFERENCES_STORAGE_KEY);
      if (storedPrefs) {
        setPreferences(JSON.parse(storedPrefs));
      } else {
        localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(DEFAULT_PREFERENCES));
      }
    } catch (err) {
      console.warn("Noctis: Could not read from localStorage, using fallback mock data.", err);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  // Synchronize theme to document element class list
  useEffect(() => {
    if (typeof window === "undefined") return;
    const root = document.documentElement;
    const isDark =
      preferences.theme === "dark" ||
      (preferences.theme === "system" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches);

    if (isDark) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [preferences.theme]);

  // ── Profile Actions ──

  const updateProfile = useCallback((updates: Partial<UserProfile>) => {
    setProfile((prev) => {
      const next = {
        ...prev,
        ...updates,
        name: updates.name !== undefined ? updates.name.trim() : prev.name,
        email: updates.email !== undefined ? updates.email.trim() : prev.email,
        title: updates.title !== undefined ? updates.title.trim() : prev.title,
      };
      try {
        localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(next));
      } catch (e) {
        console.warn("Error saving profile", e);
      }
      return next;
    });
  }, []);

  // ── Preferences Actions ──

  const updatePreferences = useCallback((updates: Partial<UserPreferences>) => {
    setPreferences((prev) => {
      const next = {
        ...prev,
        ...updates,
        notifications: updates.notifications
          ? { ...prev.notifications, ...updates.notifications }
          : prev.notifications,
      };
      try {
        localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(next));
      } catch (e) {
        console.warn("Error saving preferences", e);
      }
      return next;
    });
  }, []);

  const setNotificationPreference = useCallback(
    (category: keyof NotificationSettings, enabled: boolean) => {
      setPreferences((prev) => {
        const next = {
          ...prev,
          notifications: {
            ...prev.notifications,
            [category]: enabled,
          },
        };
        try {
          localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(next));
        } catch (e) {
          console.warn("Error saving notification preferences", e);
        }
        return next;
      });
    },
    []
  );

  // ── Task Actions ──

  const addTask = useCallback((input: TaskInput): Task => {
    const nowISO = new Date().toISOString();
    const newTask: Task = {
      id: generateId("task"),
      user_id: DEFAULT_USER_ID,
      title: input.title.trim(),
      description: input.description?.trim() || undefined,
      due_at: input.due_at || undefined,
      priority: input.priority || "medium",
      status: input.status || "todo",
      course_schedule_id: input.course_schedule_id || undefined,
      created_at: nowISO,
      updated_at: nowISO,
    };

    setTasks((prev) => {
      const next = [newTask, ...prev];
      try {
        localStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(next));
      } catch (e) {
        console.warn("Error saving tasks", e);
      }
      return next;
    });

    return newTask;
  }, []);

  const updateTask = useCallback(
    (id: string, updates: Partial<Omit<Task, "id" | "user_id">>) => {
      setTasks((prev) => {
        const next = prev.map((t) =>
          t.id === id
            ? {
                ...t,
                ...updates,
                title: updates.title !== undefined ? updates.title.trim() : t.title,
                description:
                  updates.description !== undefined
                    ? updates.description.trim() || undefined
                    : t.description,
                updated_at: new Date().toISOString(),
              }
            : t
        );
        try {
          localStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(next));
        } catch (e) {
          console.warn("Error saving tasks", e);
        }
        return next;
      });
    },
    []
  );

  const deleteTask = useCallback((id: string) => {
    setTasks((prev) => {
      const next = prev.filter((t) => t.id !== id);
      try {
        localStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(next));
      } catch (e) {
        console.warn("Error saving tasks", e);
      }
      return next;
    });
  }, []);

  const toggleTaskStatus = useCallback((id: string) => {
    setTasks((prev) => {
      const next = prev.map((t) => {
        if (t.id !== id) return t;
        const newStatus: TaskStatus = t.status === "done" ? "todo" : "done";
        return {
          ...t,
          status: newStatus,
          updated_at: new Date().toISOString(),
        };
      });
      try {
        localStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(next));
      } catch (e) {
        console.warn("Error saving tasks", e);
      }
      return next;
    });
  }, []);

  // ── Note Actions ──

  const addNote = useCallback((input: NoteInput): Note => {
    const nowISO = new Date().toISOString();
    const newNote: Note = {
      id: generateId("note"),
      user_id: DEFAULT_USER_ID,
      title: input.title.trim(),
      content: input.content.trim(),
      category: input.category?.trim() || undefined,
      tags: input.tags && input.tags.length > 0 ? input.tags : undefined,
      is_favorite: Boolean(input.is_favorite),
      created_at: nowISO,
      updated_at: nowISO,
    };

    setNotes((prev) => {
      const next = [newNote, ...prev];
      try {
        localStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(next));
      } catch (e) {
        console.warn("Error saving notes", e);
      }
      return next;
    });

    return newNote;
  }, []);

  const updateNote = useCallback(
    (id: string, updates: Partial<Omit<Note, "id" | "user_id">>) => {
      setNotes((prev) => {
        const next = prev.map((n) =>
          n.id === id
            ? {
                ...n,
                ...updates,
                title: updates.title !== undefined ? updates.title.trim() : n.title,
                content: updates.content !== undefined ? updates.content.trim() : n.content,
                category:
                  updates.category !== undefined
                    ? updates.category.trim() || undefined
                    : n.category,
                updated_at: new Date().toISOString(),
              }
            : n
        );
        try {
          localStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(next));
        } catch (e) {
          console.warn("Error saving notes", e);
        }
        return next;
      });
    },
    []
  );

  const deleteNote = useCallback((id: string) => {
    setNotes((prev) => {
      const next = prev.filter((n) => n.id !== id);
      try {
        localStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(next));
      } catch (e) {
        console.warn("Error saving notes", e);
      }
      return next;
    });
  }, []);

  const toggleNoteFavorite = useCallback((id: string) => {
    setNotes((prev) => {
      const next = prev.map((n) =>
        n.id === id
          ? {
              ...n,
              is_favorite: !n.is_favorite,
              updated_at: new Date().toISOString(),
            }
          : n
      );
      try {
        localStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(next));
      } catch (e) {
        console.warn("Error saving notes", e);
      }
      return next;
    });
  }, []);

  // ── Schedule Actions (Jadwal Kuliah) ──

  const addSchedule = useCallback((input: ScheduleInput): CourseSchedule => {
    const nowISO = new Date().toISOString();
    const newSchedule: CourseSchedule = {
      id: generateId("sched"),
      user_id: DEFAULT_USER_ID,
      course_name: input.course_name.trim(),
      course_code: input.course_code?.trim() || undefined,
      day_of_week: input.day_of_week,
      start_time: input.start_time,
      end_time: input.end_time,
      location: input.location?.trim() || undefined,
      recurrence_rule: input.recurrence_rule || "weekly",
      created_at: nowISO,
      updated_at: nowISO,
    };

    setSchedules((prev) => {
      const next = [...prev, newSchedule];
      try {
        localStorage.setItem(SCHEDULES_STORAGE_KEY, JSON.stringify(next));
      } catch (e) {
        console.warn("Error saving schedules", e);
      }
      return next;
    });

    return newSchedule;
  }, []);

  const updateSchedule = useCallback(
    (id: string, updates: Partial<Omit<CourseSchedule, "id" | "user_id">>) => {
      setSchedules((prev) => {
        const next = prev.map((s) =>
          s.id === id
            ? {
                ...s,
                ...updates,
                course_name:
                  updates.course_name !== undefined ? updates.course_name.trim() : s.course_name,
                course_code:
                  updates.course_code !== undefined
                    ? updates.course_code.trim() || undefined
                    : s.course_code,
                location:
                  updates.location !== undefined ? updates.location.trim() || undefined : s.location,
                updated_at: new Date().toISOString(),
              }
            : s
        );
        try {
          localStorage.setItem(SCHEDULES_STORAGE_KEY, JSON.stringify(next));
        } catch (e) {
          console.warn("Error saving schedules", e);
        }
        return next;
      });
    },
    []
  );

  const deleteSchedule = useCallback((id: string) => {
    setSchedules((prev) => {
      const next = prev.filter((s) => s.id !== id);
      try {
        localStorage.setItem(SCHEDULES_STORAGE_KEY, JSON.stringify(next));
      } catch (e) {
        console.warn("Error saving schedules", e);
      }
      return next;
    });
  }, []);

  // ── Agenda Actions ──

  const addAgendaEvent = useCallback((input: AgendaInput): AgendaEvent => {
    const nowISO = new Date().toISOString();
    const newEvent: AgendaEvent = {
      id: generateId("agenda"),
      user_id: DEFAULT_USER_ID,
      title: input.title.trim(),
      description: input.description?.trim() || undefined,
      start_at: input.start_at,
      end_at: input.end_at || undefined,
      location: input.location?.trim() || undefined,
      reminder_minutes: input.reminder_minutes,
      created_at: nowISO,
      updated_at: nowISO,
    };

    setAgendaEvents((prev) => {
      const next = [newEvent, ...prev];
      try {
        localStorage.setItem(AGENDA_STORAGE_KEY, JSON.stringify(next));
      } catch (e) {
        console.warn("Error saving agenda events", e);
      }
      return next;
    });

    return newEvent;
  }, []);

  const updateAgendaEvent = useCallback(
    (id: string, updates: Partial<Omit<AgendaEvent, "id" | "user_id">>) => {
      setAgendaEvents((prev) => {
        const next = prev.map((a) =>
          a.id === id
            ? {
                ...a,
                ...updates,
                title: updates.title !== undefined ? updates.title.trim() : a.title,
                description:
                  updates.description !== undefined
                    ? updates.description.trim() || undefined
                    : a.description,
                location:
                  updates.location !== undefined ? updates.location.trim() || undefined : a.location,
                updated_at: new Date().toISOString(),
              }
            : a
        );
        try {
          localStorage.setItem(AGENDA_STORAGE_KEY, JSON.stringify(next));
        } catch (e) {
          console.warn("Error saving agenda events", e);
        }
        return next;
      });
    },
    []
  );

  const deleteAgendaEvent = useCallback((id: string) => {
    setAgendaEvents((prev) => {
      const next = prev.filter((a) => a.id !== id);
      try {
        localStorage.setItem(AGENDA_STORAGE_KEY, JSON.stringify(next));
      } catch (e) {
        console.warn("Error saving agenda events", e);
      }
      return next;
    });
  }, []);

  // ── Data Management (Export & Import) ──

  const exportAllData = useCallback((): NoctisExportData => {
    return {
      version: "1.0.0",
      app: "Noctis — Your Personal Productivity Space",
      exported_at: new Date().toISOString(),
      profile,
      preferences,
      data: {
        tasks,
        notes,
        schedules,
        agendaEvents,
      },
    };
  }, [profile, preferences, tasks, notes, schedules, agendaEvents]);

  const importAllData = useCallback((imported: ValidatedNoctisExport) => {
    if (imported.data.tasks) {
      setTasks(imported.data.tasks);
      localStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(imported.data.tasks));
    }
    if (imported.data.notes) {
      setNotes(imported.data.notes);
      localStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(imported.data.notes));
    }
    if (imported.data.schedules) {
      setSchedules(imported.data.schedules);
      localStorage.setItem(SCHEDULES_STORAGE_KEY, JSON.stringify(imported.data.schedules));
    }
    if (imported.data.agendaEvents) {
      setAgendaEvents(imported.data.agendaEvents);
      localStorage.setItem(AGENDA_STORAGE_KEY, JSON.stringify(imported.data.agendaEvents));
    }
    if (imported.profile) {
      const newProfile: UserProfile = {
        name: imported.profile.name || DEFAULT_PROFILE.name,
        email: imported.profile.email || DEFAULT_PROFILE.email,
        title: imported.profile.title || DEFAULT_PROFILE.title,
      };
      setProfile(newProfile);
      localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(newProfile));
    }
    if (imported.preferences) {
      const newPrefs: UserPreferences = {
        theme: imported.preferences.theme || DEFAULT_PREFERENCES.theme,
        timezone: imported.preferences.timezone || DEFAULT_PREFERENCES.timezone,
        notifications: {
          ...DEFAULT_PREFERENCES.notifications,
          ...(imported.preferences.notifications || {}),
        },
      };
      setPreferences(newPrefs);
      localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(newPrefs));
    }
  }, []);

  const value = useMemo(
    () => ({
      tasks,
      addTask,
      updateTask,
      deleteTask,
      toggleTaskStatus,

      notes,
      addNote,
      updateNote,
      deleteNote,
      toggleNoteFavorite,

      schedules,
      addSchedule,
      updateSchedule,
      deleteSchedule,

      agendaEvents,
      addAgendaEvent,
      updateAgendaEvent,
      deleteAgendaEvent,

      profile,
      updateProfile,

      preferences,
      updatePreferences,
      setNotificationPreference,

      exportAllData,
      importAllData,

      isLoaded,
    }),
    [
      tasks,
      addTask,
      updateTask,
      deleteTask,
      toggleTaskStatus,
      notes,
      addNote,
      updateNote,
      deleteNote,
      toggleNoteFavorite,
      schedules,
      addSchedule,
      updateSchedule,
      deleteSchedule,
      agendaEvents,
      addAgendaEvent,
      updateAgendaEvent,
      deleteAgendaEvent,
      profile,
      updateProfile,
      preferences,
      updatePreferences,
      setNotificationPreference,
      exportAllData,
      importAllData,
      isLoaded,
    ]
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData(): DataContextType {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error("useData must be used within a DataProvider");
  }
  return context;
}
