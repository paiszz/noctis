"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
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
import { useAuth } from "@/lib/auth-context";
import {
  getUserProfile,
  updateUserProfile as apiUpdateUserProfile,
  getUserPreferences,
  updateUserPreferences as apiUpdateUserPreferences,
} from "@/lib/supabase/profile";
import {
  getUserTasks,
  createUserTask,
  updateUserTask,
  deleteUserTask,
} from "@/lib/supabase/tasks";
import {
  getUserSchedules,
  createUserSchedule,
  updateUserSchedule,
  deleteUserSchedule,
} from "@/lib/supabase/schedules";

export const LEGACY_STORAGE_KEYS = {
  tasks: "noctis_storage_tasks_v1",
  notes: "noctis_storage_notes_v1",
  schedules: "noctis_storage_schedules_v1",
  agenda: "noctis_storage_agenda_v1",
  profile: "noctis_storage_profile_v1",
  preferences: "noctis_storage_preferences_v1",
} as const;

export type ScopedResourceType =
  | "tasks"
  | "notes"
  | "schedules"
  | "agenda"
  | "profile"
  | "preferences";

export function getScopedStorageKey(
  userId: string | null | undefined,
  resource: ScopedResourceType
): string {
  if (!userId) {
    return LEGACY_STORAGE_KEYS[resource];
  }
  return `noctis_user_${userId}_${resource}_v1`;
}

const DEFAULT_USER_ID = "user-default";

const DEFAULT_GUEST_PROFILE: UserProfile = {
  name: "Faiz",
  email: "faiz@example.com",
  title: "Personal Workspace",
};

const EMPTY_PROFILE: UserProfile = {
  name: "",
  email: "",
  title: "",
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
  start_date?: string;
  end_date?: string;
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
  addTask: (input: TaskInput) => Promise<Task>;
  updateTask: (id: string, updates: Partial<Omit<Task, "id" | "user_id">>) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  toggleTaskStatus: (id: string) => Promise<void>;

  // Notes
  notes: Note[];
  addNote: (input: NoteInput) => Note;
  updateNote: (id: string, updates: Partial<Omit<Note, "id" | "user_id">>) => void;
  deleteNote: (id: string) => void;
  toggleNoteFavorite: (id: string) => void;

  // Schedules (Jadwal Kuliah)
  schedules: CourseSchedule[];
  addSchedule: (input: ScheduleInput) => Promise<CourseSchedule>;
  updateSchedule: (id: string, updates: Partial<Omit<CourseSchedule, "id" | "user_id">>) => Promise<void>;
  deleteSchedule: (id: string) => Promise<void>;

  // Agenda Events
  agendaEvents: AgendaEvent[];
  addAgendaEvent: (input: AgendaInput) => AgendaEvent;
  updateAgendaEvent: (id: string, updates: Partial<Omit<AgendaEvent, "id" | "user_id">>) => void;
  deleteAgendaEvent: (id: string) => void;

  // Profile
  profile: UserProfile;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;

  // Preferences
  preferences: UserPreferences;
  updatePreferences: (updates: Partial<UserPreferences>) => Promise<void>;
  setNotificationPreference: (category: keyof NotificationSettings, enabled: boolean) => Promise<void>;

  // Data Management
  exportAllData: () => NoctisExportData;
  importAllData: (data: ValidatedNoctisExport) => void;

  // Granular Loading States
  isAuthLoading: boolean;
  isProfileLoading: boolean;
  isDataLoading: boolean;
  isLoaded: boolean;
}

const DataContext = createContext<DataContextType | null>(null);

export function DataProvider({ children }: { children: React.ReactNode }) {
  const { user, isLoading: isAuthLoading } = useAuth();

  // Initialize with neutral / empty states to eliminate initial render flicker
  const [tasks, setTasks] = useState<Task[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [schedules, setSchedules] = useState<CourseSchedule[]>([]);
  const [agendaEvents, setAgendaEvents] = useState<AgendaEvent[]>([]);
  const [profile, setProfile] = useState<UserProfile>(EMPTY_PROFILE);
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_PREFERENCES);

  const [isDataLoading, setIsDataLoading] = useState(true);
  const [isProfileLoading, setIsProfileLoading] = useState(true);
  const [isLoaded, setIsLoaded] = useState(false);

  const requestSeqRef = useRef<number>(0);
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  // 1. Unified lifecycle effect: waits for authentication status, isolates account states,
  //    and safely synchronizes Tasks, Schedules, Profile, and Preferences from Supabase.
  useEffect(() => {
    // If Supabase authentication is still verifying the session, wait before touching data.
    if (isAuthLoading) {
      return;
    }

    const seq = ++requestSeqRef.current;
    const currentUserId = user?.id ?? null;
    const isUserSwitched =
      prevUserIdRef.current !== undefined && prevUserIdRef.current !== currentUserId;
    prevUserIdRef.current = currentUserId;

    setIsDataLoading(true);
    setIsProfileLoading(true);
    setIsLoaded(false);

    // If account switched or user logged out, immediately purge in-memory state
    // so previous user's tasks/schedules never display for even a single frame
    if (isUserSwitched) {
      setTasks([]);
      setNotes([]);
      setSchedules([]);
      setAgendaEvents([]);
      setProfile(EMPTY_PROFILE);
    }

    if (!user) {
      // ── GUEST MODE ──
      // Preserve existing localStorage keys without deletion or auto-migration.
      try {
        const storedTasks = localStorage.getItem(LEGACY_STORAGE_KEYS.tasks);
        if (storedTasks) {
          setTasks(JSON.parse(storedTasks));
        } else {
          localStorage.setItem(
            LEGACY_STORAGE_KEYS.tasks,
            JSON.stringify(initialMockTasks)
          );
          setTasks(initialMockTasks);
        }

        const storedNotes = localStorage.getItem(LEGACY_STORAGE_KEYS.notes);
        if (storedNotes) {
          setNotes(JSON.parse(storedNotes));
        } else {
          localStorage.setItem(
            LEGACY_STORAGE_KEYS.notes,
            JSON.stringify(initialMockNotes)
          );
          setNotes(initialMockNotes);
        }

        const storedSchedules = localStorage.getItem(LEGACY_STORAGE_KEYS.schedules);
        if (storedSchedules) {
          setSchedules(JSON.parse(storedSchedules));
        } else {
          localStorage.setItem(
            LEGACY_STORAGE_KEYS.schedules,
            JSON.stringify(initialMockSchedules)
          );
          setSchedules(initialMockSchedules);
        }

        const storedAgenda = localStorage.getItem(LEGACY_STORAGE_KEYS.agenda);
        if (storedAgenda) {
          setAgendaEvents(JSON.parse(storedAgenda));
        } else {
          localStorage.setItem(
            LEGACY_STORAGE_KEYS.agenda,
            JSON.stringify(initialMockAgendaEvents)
          );
          setAgendaEvents(initialMockAgendaEvents);
        }

        const storedProfile = localStorage.getItem(LEGACY_STORAGE_KEYS.profile);
        if (storedProfile) {
          setProfile(JSON.parse(storedProfile));
        } else {
          localStorage.setItem(
            LEGACY_STORAGE_KEYS.profile,
            JSON.stringify(DEFAULT_GUEST_PROFILE)
          );
          setProfile(DEFAULT_GUEST_PROFILE);
        }

        const storedPrefs = localStorage.getItem(LEGACY_STORAGE_KEYS.preferences);
        if (storedPrefs) {
          setPreferences(JSON.parse(storedPrefs));
        } else {
          localStorage.setItem(
            LEGACY_STORAGE_KEYS.preferences,
            JSON.stringify(DEFAULT_PREFERENCES)
          );
          setPreferences(DEFAULT_PREFERENCES);
        }
      } catch (err) {
        console.warn("Noctis: Could not read guest data from localStorage", err);
        setTasks(initialMockTasks);
        setNotes(initialMockNotes);
        setSchedules(initialMockSchedules);
        setAgendaEvents(initialMockAgendaEvents);
        setProfile(DEFAULT_GUEST_PROFILE);
        setPreferences(DEFAULT_PREFERENCES);
      } finally {
        if (seq === requestSeqRef.current) {
          setIsDataLoading(false);
          setIsProfileLoading(false);
          setIsLoaded(true);
        }
      }
    } else {
      // ── AUTHENTICATED USER MODE ──
      // Feature data is isolated using user-scoped storage keys.
      // Tasks and Schedules are fetched and synchronized directly with Supabase.
      const scopedTasksKey = getScopedStorageKey(user.id, "tasks");
      const scopedNotesKey = getScopedStorageKey(user.id, "notes");
      const scopedSchedulesKey = getScopedStorageKey(user.id, "schedules");
      const scopedAgendaKey = getScopedStorageKey(user.id, "agenda");
      const scopedProfileKey = getScopedStorageKey(user.id, "profile");
      const scopedPreferencesKey = getScopedStorageKey(user.id, "preferences");

      // 1. Fast-path: read scoped local cache for immediate UI responsiveness
      try {
        const storedTasks = localStorage.getItem(scopedTasksKey);
        if (storedTasks) {
          setTasks(JSON.parse(storedTasks));
        }

        const storedSchedules = localStorage.getItem(scopedSchedulesKey);
        if (storedSchedules) {
          setSchedules(JSON.parse(storedSchedules));
        }

        const storedNotes = localStorage.getItem(scopedNotesKey);
        setNotes(storedNotes ? JSON.parse(storedNotes) : []);

        const storedAgenda = localStorage.getItem(scopedAgendaKey);
        setAgendaEvents(storedAgenda ? JSON.parse(storedAgenda) : []);

        const cachedProfile = localStorage.getItem(scopedProfileKey);
        if (cachedProfile) {
          setProfile(JSON.parse(cachedProfile));
        } else {
          const interimName =
            user.user_metadata?.name || user.email?.split("@")[0] || "User";
          const interimTitle =
            user.user_metadata?.title || "Personal Workspace";
          setProfile({
            name: interimName,
            email: user.email || "",
            title: interimTitle,
          });
        }

        const cachedPrefs = localStorage.getItem(scopedPreferencesKey);
        if (cachedPrefs) {
          setPreferences(JSON.parse(cachedPrefs));
        }
      } catch (err) {
        console.warn("Noctis: Could not read scoped cache from localStorage", err);
      }

      // 2. Fetch Tasks, Schedules, Profile, and Preferences concurrently from Supabase
      const initialUserName =
        user.user_metadata?.name || user.email?.split("@")[0] || "User";
      const initialUserTitle =
        user.user_metadata?.title || "Personal Workspace";
      const currentUserIdForFetch = user.id;
      const currentUserEmailForFetch = user.email;

      async function loadSupabaseUserData() {
        try {
          const [profileRes, prefRes, tasksRes, schedulesRes] = await Promise.all([
            getUserProfile(currentUserIdForFetch, {
              name: initialUserName,
              email: currentUserEmailForFetch || undefined,
              title: initialUserTitle,
            }),
            getUserPreferences(currentUserIdForFetch),
            getUserTasks(currentUserIdForFetch),
            getUserSchedules(currentUserIdForFetch),
          ]);

          // Discard results if user switched or another load was initiated
          if (seq !== requestSeqRef.current) return;

          // Tasks from Supabase
          if (tasksRes.data) {
            setTasks(tasksRes.data);
            try {
              localStorage.setItem(scopedTasksKey, JSON.stringify(tasksRes.data));
            } catch (e) {
              console.warn("Error caching scoped tasks", e);
            }
          } else if (tasksRes.error) {
            console.error("Error loading user tasks from Supabase:", tasksRes.error);
          }

          // Schedules from Supabase
          if (schedulesRes.data) {
            setSchedules(schedulesRes.data);
            try {
              localStorage.setItem(scopedSchedulesKey, JSON.stringify(schedulesRes.data));
            } catch (e) {
              console.warn("Error caching scoped schedules", e);
            }
          } else if (schedulesRes.error) {
            console.error("Error loading user schedules from Supabase:", schedulesRes.error);
          }

          // Profile from Supabase
          if (profileRes.data) {
            const resolvedProfile: UserProfile = {
              name: profileRes.data.name || initialUserName,
              email: currentUserEmailForFetch || profileRes.data.email || "",
              title: profileRes.data.title || initialUserTitle,
            };
            setProfile(resolvedProfile);
            try {
              localStorage.setItem(scopedProfileKey, JSON.stringify(resolvedProfile));
            } catch (e) {
              console.warn("Error caching scoped profile", e);
            }
          } else if (profileRes.error) {
            console.error("Error loading user profile from Supabase:", profileRes.error);
          }

          // Preferences from Supabase
          if (prefRes.data) {
            const resolvedPrefs: UserPreferences = {
              theme: prefRes.data.theme || DEFAULT_PREFERENCES.theme,
              timezone: prefRes.data.timezone || DEFAULT_PREFERENCES.timezone,
              notifications: {
                ...DEFAULT_PREFERENCES.notifications,
                ...(prefRes.data.notifications || {}),
              },
            };
            setPreferences(resolvedPrefs);
            try {
              localStorage.setItem(scopedPreferencesKey, JSON.stringify(resolvedPrefs));
            } catch (e) {
              console.warn("Error caching scoped preferences", e);
            }
          } else if (prefRes.error) {
            console.error("Error loading user preferences from Supabase:", prefRes.error);
          }
        } catch (err) {
          console.error("Failed to load Supabase user data:", err);
        } finally {
          if (seq === requestSeqRef.current) {
            setIsDataLoading(false);
            setIsProfileLoading(false);
            setIsLoaded(true);
          }
        }
      }

      loadSupabaseUserData();
    }
  }, [user, isAuthLoading]);

  // 2. Synchronize theme to document element class list & listen to system theme changes
  useEffect(() => {
    if (typeof window === "undefined") return;
    const root = document.documentElement;
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const applyTheme = () => {
      const isDark =
        preferences.theme === "dark" ||
        (preferences.theme === "system" && mediaQuery.matches);

      if (isDark) {
        root.classList.add("dark");
      } else {
        root.classList.remove("dark");
      }
    };

    applyTheme();

    if (preferences.theme === "system") {
      mediaQuery.addEventListener("change", applyTheme);
      return () => {
        mediaQuery.removeEventListener("change", applyTheme);
      };
    }
  }, [preferences.theme]);

  // ── Profile Actions ──

  const updateProfile = useCallback(
    async (updates: Partial<UserProfile>) => {
      const nextName = updates.name !== undefined ? updates.name.trim() : profile.name;
      const nextTitle = updates.title !== undefined ? updates.title.trim() : profile.title;

      if (user) {
        const { data, error } = await apiUpdateUserProfile(user.id, {
          name: nextName,
          title: nextTitle,
        });

        if (error) {
          throw error;
        }

        const nextProfile: UserProfile = {
          ...profile,
          name: data?.name ?? nextName,
          title: data?.title ?? nextTitle,
          email: user.email ?? profile.email,
        };
        setProfile(nextProfile);

        try {
          const key = getScopedStorageKey(user.id, "profile");
          localStorage.setItem(key, JSON.stringify(nextProfile));
        } catch (e) {
          console.warn("Error caching scoped profile", e);
        }
      } else {
        setProfile((prev) => {
          const next = {
            ...prev,
            ...updates,
            name: nextName,
            email: updates.email !== undefined ? updates.email.trim() : prev.email,
            title: nextTitle,
          };
          try {
            localStorage.setItem(LEGACY_STORAGE_KEYS.profile, JSON.stringify(next));
          } catch (e) {
            console.warn("Error saving guest profile", e);
          }
          return next;
        });
      }
    },
    [user, profile]
  );

  // ── Preferences Actions ──

  const updatePreferences = useCallback(
    async (updates: Partial<UserPreferences>) => {
      if (user) {
        const { data, error } = await apiUpdateUserPreferences(user.id, updates);
        if (error) {
          throw error;
        }

        const nextPrefs: UserPreferences = {
          ...preferences,
          theme: data?.theme ?? (updates.theme || preferences.theme),
          timezone: data?.timezone ?? (updates.timezone || preferences.timezone),
          notifications: data?.notifications ?? (updates.notifications
            ? { ...preferences.notifications, ...updates.notifications }
            : preferences.notifications),
        };
        setPreferences(nextPrefs);

        try {
          const key = getScopedStorageKey(user.id, "preferences");
          localStorage.setItem(key, JSON.stringify(nextPrefs));
        } catch (e) {
          console.warn("Error caching scoped preferences", e);
        }
      } else {
        setPreferences((prev) => {
          const next = {
            ...prev,
            ...updates,
            notifications: updates.notifications
              ? { ...prev.notifications, ...updates.notifications }
              : prev.notifications,
          };
          try {
            localStorage.setItem(LEGACY_STORAGE_KEYS.preferences, JSON.stringify(next));
          } catch (e) {
            console.warn("Error saving guest preferences", e);
          }
          return next;
        });
      }
    },
    [user, preferences]
  );

  const setNotificationPreference = useCallback(
    async (category: keyof NotificationSettings, enabled: boolean) => {
      const nextNotifications: NotificationSettings = {
        ...preferences.notifications,
        [category]: enabled,
      };

      if (user) {
        const { error } = await apiUpdateUserPreferences(user.id, {
          notifications: nextNotifications,
        });
        if (error) {
          throw error;
        }

        const nextPrefs: UserPreferences = {
          ...preferences,
          notifications: nextNotifications,
        };
        setPreferences(nextPrefs);

        try {
          const key = getScopedStorageKey(user.id, "preferences");
          localStorage.setItem(key, JSON.stringify(nextPrefs));
        } catch (e) {
          console.warn("Error caching scoped preferences", e);
        }
      } else {
        setPreferences((prev) => {
          const next = {
            ...prev,
            notifications: nextNotifications,
          };
          try {
            localStorage.setItem(LEGACY_STORAGE_KEYS.preferences, JSON.stringify(next));
          } catch (e) {
            console.warn("Error saving notification preferences", e);
          }
          return next;
        });
      }
    },
    [user, preferences]
  );

  // ── Task Actions (Supabase Cloud + Local Storage Fallback) ──

  const addTask = useCallback(
    async (input: TaskInput): Promise<Task> => {
      if (user) {
        const { data, error } = await createUserTask(user.id, input);
        if (error || !data) {
          throw error || new Error("Gagal membuat tugas di Supabase.");
        }

        setTasks((prev) => {
          const next = [data, ...prev];
          try {
            const storageKey = getScopedStorageKey(user.id, "tasks");
            localStorage.setItem(storageKey, JSON.stringify(next));
          } catch (e) {
            console.warn("Error caching tasks", e);
          }
          return next;
        });

        return data;
      } else {
        // Guest mode
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
            localStorage.setItem(LEGACY_STORAGE_KEYS.tasks, JSON.stringify(next));
          } catch (e) {
            console.warn("Error saving tasks", e);
          }
          return next;
        });

        return newTask;
      }
    },
    [user]
  );

  const updateTask = useCallback(
    async (id: string, updates: Partial<Omit<Task, "id" | "user_id">>): Promise<void> => {
      if (user) {
        let rollbackTasks: Task[] = [];
        setTasks((prev) => {
          rollbackTasks = prev;
          return prev.map((t) =>
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
        });

        const { data, error } = await updateUserTask(user.id, id, updates);
        if (error) {
          setTasks(rollbackTasks);
          throw error;
        }

        if (data) {
          setTasks((prev) => {
            const next = prev.map((t) => (t.id === id ? data : t));
            try {
              const storageKey = getScopedStorageKey(user.id, "tasks");
              localStorage.setItem(storageKey, JSON.stringify(next));
            } catch (e) {
              console.warn("Error caching tasks", e);
            }
            return next;
          });
        }
      } else {
        // Guest mode
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
            localStorage.setItem(LEGACY_STORAGE_KEYS.tasks, JSON.stringify(next));
          } catch (e) {
            console.warn("Error saving tasks", e);
          }
          return next;
        });
      }
    },
    [user]
  );

  const deleteTask = useCallback(
    async (id: string): Promise<void> => {
      if (user) {
        let rollbackTasks: Task[] = [];
        setTasks((prev) => {
          rollbackTasks = prev;
          return prev.filter((t) => t.id !== id);
        });

        const { error } = await deleteUserTask(user.id, id);
        if (error) {
          setTasks(rollbackTasks);
          throw error;
        }

        try {
          const storageKey = getScopedStorageKey(user.id, "tasks");
          localStorage.setItem(
            storageKey,
            JSON.stringify(rollbackTasks.filter((t) => t.id !== id))
          );
        } catch (e) {
          console.warn("Error caching tasks", e);
        }
      } else {
        // Guest mode
        setTasks((prev) => {
          const next = prev.filter((t) => t.id !== id);
          try {
            localStorage.setItem(LEGACY_STORAGE_KEYS.tasks, JSON.stringify(next));
          } catch (e) {
            console.warn("Error saving tasks", e);
          }
          return next;
        });
      }
    },
    [user]
  );

  const toggleTaskStatus = useCallback(
    async (id: string): Promise<void> => {
      const target = tasks.find((t) => t.id === id);
      if (!target) return;
      const nextStatus: TaskStatus = target.status === "done" ? "todo" : "done";

      if (user) {
        let rollbackTasks: Task[] = [];
        setTasks((prev) => {
          rollbackTasks = prev;
          return prev.map((t) =>
            t.id === id
              ? {
                  ...t,
                  status: nextStatus,
                  updated_at: new Date().toISOString(),
                }
              : t
          );
        });

        const { error } = await updateUserTask(user.id, id, { status: nextStatus });
        if (error) {
          setTasks(rollbackTasks);
          throw error;
        }

        try {
          const storageKey = getScopedStorageKey(user.id, "tasks");
          localStorage.setItem(
            storageKey,
            JSON.stringify(
              rollbackTasks.map((t) =>
                t.id === id
                  ? { ...t, status: nextStatus, updated_at: new Date().toISOString() }
                  : t
              )
            )
          );
        } catch (e) {
          console.warn("Error caching tasks", e);
        }
      } else {
        // Guest mode
        setTasks((prev) => {
          const next = prev.map((t) => {
            if (t.id !== id) return t;
            return {
              ...t,
              status: nextStatus,
              updated_at: new Date().toISOString(),
            };
          });
          try {
            localStorage.setItem(LEGACY_STORAGE_KEYS.tasks, JSON.stringify(next));
          } catch (e) {
            console.warn("Error saving tasks", e);
          }
          return next;
        });
      }
    },
    [user, tasks]
  );

  // ── Note Actions ──

  const addNote = useCallback(
    (input: NoteInput): Note => {
      const currentUserId = user?.id || DEFAULT_USER_ID;
      const nowISO = new Date().toISOString();
      const newNote: Note = {
        id: generateId("note"),
        user_id: currentUserId,
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
          const storageKey = getScopedStorageKey(user?.id, "notes");
          localStorage.setItem(storageKey, JSON.stringify(next));
        } catch (e) {
          console.warn("Error saving notes", e);
        }
        return next;
      });

      return newNote;
    },
    [user?.id]
  );

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
          const storageKey = getScopedStorageKey(user?.id, "notes");
          localStorage.setItem(storageKey, JSON.stringify(next));
        } catch (e) {
          console.warn("Error saving notes", e);
        }
        return next;
      });
    },
    [user?.id]
  );

  const deleteNote = useCallback(
    (id: string) => {
      setNotes((prev) => {
        const next = prev.filter((n) => n.id !== id);
        try {
          const storageKey = getScopedStorageKey(user?.id, "notes");
          localStorage.setItem(storageKey, JSON.stringify(next));
        } catch (e) {
          console.warn("Error saving notes", e);
        }
        return next;
      });
    },
    [user?.id]
  );

  const toggleNoteFavorite = useCallback(
    (id: string) => {
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
          const storageKey = getScopedStorageKey(user?.id, "notes");
          localStorage.setItem(storageKey, JSON.stringify(next));
        } catch (e) {
          console.warn("Error saving notes", e);
        }
        return next;
      });
    },
    [user?.id]
  );

  // ── Schedule Actions (Supabase Cloud + Local Storage Fallback) ──

  const addSchedule = useCallback(
    async (input: ScheduleInput): Promise<CourseSchedule> => {
      if (user) {
        const { data, error } = await createUserSchedule(user.id, input);
        if (error || !data) {
          throw error || new Error("Gagal membuat jadwal kuliah di Supabase.");
        }

        setSchedules((prev) => {
          const next = [...prev, data];
          try {
            const storageKey = getScopedStorageKey(user.id, "schedules");
            localStorage.setItem(storageKey, JSON.stringify(next));
          } catch (e) {
            console.warn("Error caching schedules", e);
          }
          return next;
        });

        return data;
      } else {
        // Guest mode
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
          start_date: input.start_date || undefined,
          end_date: input.end_date || undefined,
          created_at: nowISO,
          updated_at: nowISO,
        };

        setSchedules((prev) => {
          const next = [...prev, newSchedule];
          try {
            localStorage.setItem(LEGACY_STORAGE_KEYS.schedules, JSON.stringify(next));
          } catch (e) {
            console.warn("Error saving schedules", e);
          }
          return next;
        });

        return newSchedule;
      }
    },
    [user]
  );

  const updateSchedule = useCallback(
    async (
      id: string,
      updates: Partial<Omit<CourseSchedule, "id" | "user_id">>
    ): Promise<void> => {
      if (user) {
        let rollbackSchedules: CourseSchedule[] = [];
        setSchedules((prev) => {
          rollbackSchedules = prev;
          return prev.map((s) =>
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
        });

        const { data, error } = await updateUserSchedule(user.id, id, updates);
        if (error) {
          setSchedules(rollbackSchedules);
          throw error;
        }

        if (data) {
          setSchedules((prev) => {
            const next = prev.map((s) => (s.id === id ? data : s));
            try {
              const storageKey = getScopedStorageKey(user.id, "schedules");
              localStorage.setItem(storageKey, JSON.stringify(next));
            } catch (e) {
              console.warn("Error caching schedules", e);
            }
            return next;
          });
        }
      } else {
        // Guest mode
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
            localStorage.setItem(LEGACY_STORAGE_KEYS.schedules, JSON.stringify(next));
          } catch (e) {
            console.warn("Error saving schedules", e);
          }
          return next;
        });
      }
    },
    [user]
  );

  const deleteSchedule = useCallback(
    async (id: string): Promise<void> => {
      if (user) {
        let rollbackSchedules: CourseSchedule[] = [];
        setSchedules((prev) => {
          rollbackSchedules = prev;
          return prev.filter((s) => s.id !== id);
        });

        const { error } = await deleteUserSchedule(user.id, id);
        if (error) {
          setSchedules(rollbackSchedules);
          throw error;
        }

        try {
          const storageKey = getScopedStorageKey(user.id, "schedules");
          localStorage.setItem(
            storageKey,
            JSON.stringify(rollbackSchedules.filter((s) => s.id !== id))
          );
        } catch (e) {
          console.warn("Error caching schedules", e);
        }
      } else {
        // Guest mode
        setSchedules((prev) => {
          const next = prev.filter((s) => s.id !== id);
          try {
            localStorage.setItem(LEGACY_STORAGE_KEYS.schedules, JSON.stringify(next));
          } catch (e) {
            console.warn("Error saving schedules", e);
          }
          return next;
        });
      }
    },
    [user]
  );

  // ── Agenda Actions ──

  const addAgendaEvent = useCallback(
    (input: AgendaInput): AgendaEvent => {
      const currentUserId = user?.id || DEFAULT_USER_ID;
      const nowISO = new Date().toISOString();
      const newEvent: AgendaEvent = {
        id: generateId("agenda"),
        user_id: currentUserId,
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
          const storageKey = getScopedStorageKey(user?.id, "agenda");
          localStorage.setItem(storageKey, JSON.stringify(next));
        } catch (e) {
          console.warn("Error saving agenda events", e);
        }
        return next;
      });

      return newEvent;
    },
    [user?.id]
  );

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
          const storageKey = getScopedStorageKey(user?.id, "agenda");
          localStorage.setItem(storageKey, JSON.stringify(next));
        } catch (e) {
          console.warn("Error saving agenda events", e);
        }
        return next;
      });
    },
    [user?.id]
  );

  const deleteAgendaEvent = useCallback(
    (id: string) => {
      setAgendaEvents((prev) => {
        const next = prev.filter((a) => a.id !== id);
        try {
          const storageKey = getScopedStorageKey(user?.id, "agenda");
          localStorage.setItem(storageKey, JSON.stringify(next));
        } catch (e) {
          console.warn("Error saving agenda events", e);
        }
        return next;
      });
    },
    [user?.id]
  );

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

  const importAllData = useCallback(
    (imported: ValidatedNoctisExport) => {
      const currentUserId = user?.id;

      if (imported.data.tasks) {
        if (user) {
          // Re-map tasks with active user's UUID
          const sanitizedTasks = imported.data.tasks.map((t) => ({
            ...t,
            user_id: user.id,
          }));
          setTasks(sanitizedTasks);
          const key = getScopedStorageKey(user.id, "tasks");
          localStorage.setItem(key, JSON.stringify(sanitizedTasks));

          // Sync each imported task to Supabase
          for (const t of sanitizedTasks) {
            createUserTask(user.id, {
              title: t.title,
              description: t.description,
              due_at: t.due_at,
              priority: t.priority,
              status: t.status,
              course_schedule_id: t.course_schedule_id,
            }).catch((err) =>
              console.error("Error importing task to Supabase:", err)
            );
          }
        } else {
          setTasks(imported.data.tasks);
          localStorage.setItem(LEGACY_STORAGE_KEYS.tasks, JSON.stringify(imported.data.tasks));
        }
      }

      if (imported.data.schedules) {
        if (user) {
          // Re-map schedules with active user's UUID
          const sanitizedSchedules = imported.data.schedules.map((s) => ({
            ...s,
            user_id: user.id,
          }));
          setSchedules(sanitizedSchedules);
          const key = getScopedStorageKey(user.id, "schedules");
          localStorage.setItem(key, JSON.stringify(sanitizedSchedules));

          // Sync each imported schedule to Supabase
          for (const s of sanitizedSchedules) {
            createUserSchedule(user.id, {
              course_name: s.course_name,
              course_code: s.course_code,
              day_of_week: s.day_of_week,
              start_time: s.start_time,
              end_time: s.end_time,
              location: s.location,
              recurrence_rule: s.recurrence_rule,
              start_date: s.start_date,
              end_date: s.end_date,
            }).catch((err) =>
              console.error("Error importing schedule to Supabase:", err)
            );
          }
        } else {
          setSchedules(imported.data.schedules);
          localStorage.setItem(
            LEGACY_STORAGE_KEYS.schedules,
            JSON.stringify(imported.data.schedules)
          );
        }
      }

      if (imported.data.notes) {
        setNotes(imported.data.notes);
        const key = getScopedStorageKey(currentUserId, "notes");
        localStorage.setItem(key, JSON.stringify(imported.data.notes));
      }
      if (imported.data.agendaEvents) {
        setAgendaEvents(imported.data.agendaEvents);
        const key = getScopedStorageKey(currentUserId, "agenda");
        localStorage.setItem(key, JSON.stringify(imported.data.agendaEvents));
      }
      if (imported.profile) {
        const newProfile: UserProfile = {
          name:
            imported.profile.name ||
            (user
              ? user.user_metadata?.name || user.email?.split("@")[0] || "User"
              : DEFAULT_GUEST_PROFILE.name),
          email: user
            ? user.email || ""
            : imported.profile.email || DEFAULT_GUEST_PROFILE.email,
          title: imported.profile.title || DEFAULT_GUEST_PROFILE.title,
        };
        setProfile(newProfile);

        if (user) {
          apiUpdateUserProfile(user.id, {
            name: newProfile.name,
            title: newProfile.title,
          }).catch((err) =>
            console.error("Error importing profile to Supabase:", err)
          );
          const key = getScopedStorageKey(user.id, "profile");
          localStorage.setItem(key, JSON.stringify(newProfile));
        } else {
          localStorage.setItem(
            LEGACY_STORAGE_KEYS.profile,
            JSON.stringify(newProfile)
          );
        }
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

        if (user) {
          apiUpdateUserPreferences(user.id, newPrefs).catch((err) =>
            console.error("Error importing preferences to Supabase:", err)
          );
          const key = getScopedStorageKey(user.id, "preferences");
          localStorage.setItem(key, JSON.stringify(newPrefs));
        } else {
          localStorage.setItem(
            LEGACY_STORAGE_KEYS.preferences,
            JSON.stringify(newPrefs)
          );
        }
      }
    },
    [user]
  );

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

      isAuthLoading,
      isProfileLoading,
      isDataLoading,
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
      isAuthLoading,
      isProfileLoading,
      isDataLoading,
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
