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
import {
  type Task,
  type Note,
  type CourseSchedule,
  type AgendaEvent,
  type DayOfWeek,
  type TaskPriority,
  type TaskStatus,
  type UserProfile,
  type UserPreferences,
  type NotificationSettings,
  type NoctisExportData,
  validateScheduleDateRange,
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
import {
  getUserNotes,
  createUserNote,
  updateUserNote,
  deleteUserNote,
} from "@/lib/supabase/notes";
import {
  getUserAgendaEvents,
  createUserAgendaEvent,
  updateUserAgendaEvent,
  deleteUserAgendaEvent,
} from "@/lib/supabase/agenda";
import {
  importUserDataAtomic,
  type ImportAtomicPayload,
} from "@/lib/supabase/import";

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
  name: "Tamu",
  email: "",
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
  addNote: (input: NoteInput) => Promise<Note>;
  updateNote: (id: string, updates: Partial<Omit<Note, "id" | "user_id">>) => Promise<void>;
  deleteNote: (id: string) => Promise<void>;
  toggleNoteFavorite: (id: string) => Promise<void>;

  // Schedules (Jadwal Kuliah)
  schedules: CourseSchedule[];
  addSchedule: (input: ScheduleInput) => Promise<CourseSchedule>;
  updateSchedule: (id: string, updates: Partial<Omit<CourseSchedule, "id" | "user_id">>) => Promise<void>;
  deleteSchedule: (id: string) => Promise<void>;

  // Agenda Events
  agendaEvents: AgendaEvent[];
  addAgendaEvent: (input: AgendaInput) => Promise<AgendaEvent>;
  updateAgendaEvent: (id: string, updates: Partial<Omit<AgendaEvent, "id" | "user_id">>) => Promise<void>;
  deleteAgendaEvent: (id: string) => Promise<void>;

  // Profile
  profile: UserProfile;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;

  // Preferences
  preferences: UserPreferences;
  updatePreferences: (updates: Partial<UserPreferences>) => Promise<void>;
  setNotificationPreference: (category: keyof NotificationSettings, enabled: boolean) => Promise<void>;

  // Data Management
  exportAllData: () => NoctisExportData;
  importAllData: (data: ValidatedNoctisExport) => Promise<void>;

  // Granular Loading States
  isAuthLoading: boolean;
  isProfileLoading: boolean;
  isDataLoading: boolean;
  isLoaded: boolean;
}

function getInitialPreferences(): UserPreferences {
  if (typeof window === "undefined") {
    return DEFAULT_PREFERENCES;
  }
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith("noctis_user_") && key.endsWith("_preferences_v1")) {
        const raw = localStorage.getItem(key);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === "object") {
            return {
              ...DEFAULT_PREFERENCES,
              ...parsed,
              notifications: {
                ...DEFAULT_PREFERENCES.notifications,
                ...(parsed.notifications || {}),
              },
            };
          }
        }
      }
    }
    const rawGuest = localStorage.getItem(LEGACY_STORAGE_KEYS.preferences);
    if (rawGuest) {
      const parsed = JSON.parse(rawGuest);
      if (parsed && typeof parsed === "object") {
        return {
          ...DEFAULT_PREFERENCES,
          ...parsed,
          notifications: {
            ...DEFAULT_PREFERENCES.notifications,
            ...(parsed.notifications || {}),
          },
        };
      }
    }
  } catch {
    // Fallback safely to default preferences
  }
  return DEFAULT_PREFERENCES;
}

const DataContext = createContext<DataContextType | null>(null);

export function DataProvider({ children }: { children: React.ReactNode }) {
  const { user, isLoading: isAuthLoading, isLoggingOut } = useAuth();

  // Initialize with neutral / empty states to eliminate initial render flicker
  const [tasks, setTasks] = useState<Task[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [schedules, setSchedules] = useState<CourseSchedule[]>([]);
  const [agendaEvents, setAgendaEvents] = useState<AgendaEvent[]>([]);
  const [profile, setProfile] = useState<UserProfile>(EMPTY_PROFILE);
  const [preferences, setPreferences] = useState<UserPreferences>(getInitialPreferences);

  const [isDataLoading, setIsDataLoading] = useState(true);
  const [isProfileLoading, setIsProfileLoading] = useState(true);
  const [isLoaded, setIsLoaded] = useState(false);

  const currentUserId = user?.id ?? null;
  const [activeUserId, setActiveUserId] = useState<string | null | undefined>(currentUserId);

  // Synchronous state adjustment during render (React recommended pattern for prop/auth switching):
  // When user changes (account switch, logout, login), synchronously reset in-memory state
  // before children can render with stale data from the previous account.
  if (activeUserId !== currentUserId) {
    setActiveUserId(currentUserId);
    setTasks([]);
    setNotes([]);
    setSchedules([]);
    setAgendaEvents([]);
    setProfile(EMPTY_PROFILE);
    setIsDataLoading(true);
    setIsProfileLoading(true);
    setIsLoaded(false);
  }

  const requestSeqRef = useRef<number>(0);
  const prevUserIdRef = useRef<string | null | undefined>(undefined);
  const isLoadedRef = useRef(false);

  useEffect(() => {
    isLoadedRef.current = isLoaded;
  }, [isLoaded]);

  // 1. Unified lifecycle effect: waits for authentication status, isolates account states,
  //    and safely synchronizes Tasks, Schedules, Profile, and Preferences from Supabase.
  useEffect(() => {
    // If Supabase authentication is still verifying the session or in the process of logging out,
    // wait before touching data.
    if (isAuthLoading || isLoggingOut) {
      return;
    }

    const seq = ++requestSeqRef.current;
    const isUserSwitched =
      prevUserIdRef.current !== undefined && prevUserIdRef.current !== currentUserId;

    // Prevent redundant reload and remounting when user has not switched and data is already loaded
    if (!isUserSwitched && prevUserIdRef.current !== undefined && isLoadedRef.current) {
      return;
    }

    prevUserIdRef.current = currentUserId;

    setIsDataLoading(true);
    setIsProfileLoading(true);
    setIsLoaded(false);
    isLoadedRef.current = false;

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
      async function loadGuestData() {
        await Promise.resolve();
        if (seq !== requestSeqRef.current) return;

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
            try {
              const parsed = JSON.parse(storedProfile);
              // Sanitize obsolete mock identity if present in browser localStorage
              if (parsed.email === "faiz@example.com") {
                parsed.email = "";
              }
              if (parsed.name === "Faiz") {
                parsed.name = "Tamu";
              }
              setProfile(parsed);
            } catch {
              setProfile(DEFAULT_GUEST_PROFILE);
            }
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
          if (seq === requestSeqRef.current) {
            setTasks(initialMockTasks);
            setNotes(initialMockNotes);
            setSchedules(initialMockSchedules);
            setAgendaEvents(initialMockAgendaEvents);
            setProfile(DEFAULT_GUEST_PROFILE);
            setPreferences(DEFAULT_PREFERENCES);
          }
        } finally {
          if (seq === requestSeqRef.current) {
            setIsDataLoading(false);
            setIsProfileLoading(false);
            setIsLoaded(true);
            isLoadedRef.current = true;
          }
        }
      }

      loadGuestData();
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

      const initialUserName =
        user.user_metadata?.name || user.email?.split("@")[0] || "User";
      const initialUserTitle =
        user.user_metadata?.title || "Personal Workspace";
      const currentUserIdForFetch = user.id;
      const currentUserEmailForFetch = user.email;

      async function loadSupabaseUserData() {
        await Promise.resolve();
        if (seq !== requestSeqRef.current) return;

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
          if (storedNotes) {
            setNotes(JSON.parse(storedNotes));
          }

          const storedAgenda = localStorage.getItem(scopedAgendaKey);
          if (storedAgenda) {
            setAgendaEvents(JSON.parse(storedAgenda));
          }

          const cachedProfile = localStorage.getItem(scopedProfileKey);
          if (cachedProfile) {
            setProfile(JSON.parse(cachedProfile));
          } else {
            setProfile({
              name: initialUserName,
              email: currentUserEmailForFetch || "",
              title: initialUserTitle,
            });
          }

          const cachedPrefs = localStorage.getItem(scopedPreferencesKey);
          if (cachedPrefs) {
            setPreferences(JSON.parse(cachedPrefs));
          }
        } catch (err) {
          console.warn("Noctis: Could not read scoped cache from localStorage", err);
        }

        // 2. Concurrent Supabase fetch
        try {
          const [profileRes, prefRes, tasksRes, schedulesRes, notesRes, agendaRes] = await Promise.all([
            getUserProfile(currentUserIdForFetch, {
              name: initialUserName,
              email: currentUserEmailForFetch || undefined,
              title: initialUserTitle,
            }),
            getUserPreferences(currentUserIdForFetch),
            getUserTasks(currentUserIdForFetch),
            getUserSchedules(currentUserIdForFetch),
            getUserNotes(currentUserIdForFetch),
            getUserAgendaEvents(currentUserIdForFetch),
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

          // Notes from Supabase
          if (notesRes.data) {
            setNotes(notesRes.data);
            try {
              localStorage.setItem(scopedNotesKey, JSON.stringify(notesRes.data));
            } catch (e) {
              console.warn("Error caching scoped notes", e);
            }
          } else if (notesRes.error) {
            console.error("Error loading user notes from Supabase:", notesRes.error);
          }

          // Agenda Events from Supabase
          if (agendaRes.data) {
            setAgendaEvents(agendaRes.data);
            try {
              localStorage.setItem(scopedAgendaKey, JSON.stringify(agendaRes.data));
            } catch (e) {
              console.warn("Error caching scoped agenda", e);
            }
          } else if (agendaRes.error) {
            console.error("Error loading user agenda events from Supabase:", agendaRes.error);
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
            isLoadedRef.current = true;
          }
        }
      }

      loadSupabaseUserData();
    }
  }, [user, currentUserId, isAuthLoading, isLoggingOut]);

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

  // ── Note Actions (Supabase Cloud + Local Storage Fallback) ──

  const addNote = useCallback(
    async (input: NoteInput): Promise<Note> => {
      if (user) {
        const { data, error } = await createUserNote(user.id, input);
        if (error || !data) {
          throw error || new Error("Gagal membuat catatan di Supabase.");
        }

        setNotes((prev) => {
          const next = [data, ...prev];
          try {
            const storageKey = getScopedStorageKey(user.id, "notes");
            localStorage.setItem(storageKey, JSON.stringify(next));
          } catch (e) {
            console.warn("Error caching notes", e);
          }
          return next;
        });

        return data;
      } else {
        // Guest mode
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
            localStorage.setItem(LEGACY_STORAGE_KEYS.notes, JSON.stringify(next));
          } catch (e) {
            console.warn("Error saving notes", e);
          }
          return next;
        });

        return newNote;
      }
    },
    [user]
  );

  const updateNote = useCallback(
    async (
      id: string,
      updates: Partial<Omit<Note, "id" | "user_id">>
    ): Promise<void> => {
      if (user) {
        let rollbackNotes: Note[] = [];
        setNotes((prev) => {
          rollbackNotes = prev;
          return prev.map((n) =>
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
                  tags:
                    updates.tags !== undefined
                      ? updates.tags.length > 0
                        ? updates.tags
                        : undefined
                      : n.tags,
                  is_favorite:
                    updates.is_favorite !== undefined
                      ? Boolean(updates.is_favorite)
                      : n.is_favorite,
                  updated_at: new Date().toISOString(),
                }
              : n
          );
        });

        const { data, error } = await updateUserNote(user.id, id, updates);
        if (error) {
          setNotes(rollbackNotes);
          throw error;
        }

        if (data) {
          setNotes((prev) => {
            const next = prev.map((n) => (n.id === id ? data : n));
            try {
              const storageKey = getScopedStorageKey(user.id, "notes");
              localStorage.setItem(storageKey, JSON.stringify(next));
            } catch (e) {
              console.warn("Error caching notes", e);
            }
            return next;
          });
        }
      } else {
        // Guest mode
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
                  tags:
                    updates.tags !== undefined
                      ? updates.tags.length > 0
                        ? updates.tags
                        : undefined
                      : n.tags,
                  is_favorite:
                    updates.is_favorite !== undefined
                      ? Boolean(updates.is_favorite)
                      : n.is_favorite,
                  updated_at: new Date().toISOString(),
                }
              : n
          );
          try {
            localStorage.setItem(LEGACY_STORAGE_KEYS.notes, JSON.stringify(next));
          } catch (e) {
            console.warn("Error saving notes", e);
          }
          return next;
        });
      }
    },
    [user]
  );

  const deleteNote = useCallback(
    async (id: string): Promise<void> => {
      if (user) {
        let rollbackNotes: Note[] = [];
        setNotes((prev) => {
          rollbackNotes = prev;
          return prev.filter((n) => n.id !== id);
        });

        const { error } = await deleteUserNote(user.id, id);
        if (error) {
          setNotes(rollbackNotes);
          throw error;
        }

        try {
          const storageKey = getScopedStorageKey(user.id, "notes");
          localStorage.setItem(
            storageKey,
            JSON.stringify(rollbackNotes.filter((n) => n.id !== id))
          );
        } catch (e) {
          console.warn("Error caching notes", e);
        }
      } else {
        // Guest mode
        setNotes((prev) => {
          const next = prev.filter((n) => n.id !== id);
          try {
            localStorage.setItem(LEGACY_STORAGE_KEYS.notes, JSON.stringify(next));
          } catch (e) {
            console.warn("Error saving notes", e);
          }
          return next;
        });
      }
    },
    [user]
  );

  const toggleNoteFavorite = useCallback(
    async (id: string): Promise<void> => {
      const target = notes.find((n) => n.id === id);
      if (!target) return;
      const nextFavorite = !target.is_favorite;

      if (user) {
        let rollbackNotes: Note[] = [];
        setNotes((prev) => {
          rollbackNotes = prev;
          return prev.map((n) =>
            n.id === id
              ? {
                  ...n,
                  is_favorite: nextFavorite,
                  updated_at: new Date().toISOString(),
                }
              : n
          );
        });

        const { error } = await updateUserNote(user.id, id, { is_favorite: nextFavorite });
        if (error) {
          setNotes(rollbackNotes);
          throw error;
        }

        try {
          const storageKey = getScopedStorageKey(user.id, "notes");
          localStorage.setItem(
            storageKey,
            JSON.stringify(
              rollbackNotes.map((n) =>
                n.id === id
                  ? { ...n, is_favorite: nextFavorite, updated_at: new Date().toISOString() }
                  : n
              )
            )
          );
        } catch (e) {
          console.warn("Error caching notes", e);
        }
      } else {
        // Guest mode
        setNotes((prev) => {
          const next = prev.map((n) =>
            n.id === id
              ? {
                  ...n,
                  is_favorite: nextFavorite,
                  updated_at: new Date().toISOString(),
                }
              : n
          );
          try {
            localStorage.setItem(LEGACY_STORAGE_KEYS.notes, JSON.stringify(next));
          } catch (e) {
            console.warn("Error saving notes", e);
          }
          return next;
        });
      }
    },
    [user, notes]
  );

  // ── Schedule Actions (Supabase Cloud + Local Storage Fallback) ──

  const addSchedule = useCallback(
    async (input: ScheduleInput): Promise<CourseSchedule> => {
      const validation = validateScheduleDateRange(
        input.day_of_week,
        input.start_date,
        input.end_date
      );
      if (!validation.isValid) {
        throw new Error(validation.error || "Rentang tanggal jadwal tidak valid.");
      }

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
      const existing = schedules.find((s) => s.id === id);
      const targetDay =
        updates.day_of_week !== undefined ? updates.day_of_week : existing?.day_of_week ?? 1;
      const targetStart =
        updates.start_date !== undefined ? updates.start_date : existing?.start_date;
      const targetEnd =
        updates.end_date !== undefined ? updates.end_date : existing?.end_date;

      const validation = validateScheduleDateRange(targetDay, targetStart, targetEnd);
      if (!validation.isValid) {
        throw new Error(validation.error || "Rentang tanggal jadwal tidak valid.");
      }

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
                  start_date:
                    updates.start_date !== undefined ? updates.start_date || undefined : s.start_date,
                  end_date:
                    updates.end_date !== undefined ? updates.end_date || undefined : s.end_date,
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
                  start_date:
                    updates.start_date !== undefined ? updates.start_date || undefined : s.start_date,
                  end_date:
                    updates.end_date !== undefined ? updates.end_date || undefined : s.end_date,
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
    [user, schedules]
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

  // ── Agenda Actions (Supabase Cloud + Local Storage Fallback) ──

  const addAgendaEvent = useCallback(
    async (input: AgendaInput): Promise<AgendaEvent> => {
      if (user) {
        const { data, error } = await createUserAgendaEvent(user.id, input);
        if (error || !data) {
          throw error || new Error("Gagal membuat agenda kegiatan di Supabase.");
        }

        setAgendaEvents((prev) => {
          const next = [data, ...prev];
          try {
            const storageKey = getScopedStorageKey(user.id, "agenda");
            localStorage.setItem(storageKey, JSON.stringify(next));
          } catch (e) {
            console.warn("Error caching agenda events", e);
          }
          return next;
        });

        return data;
      } else {
        // Guest mode
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
            localStorage.setItem(LEGACY_STORAGE_KEYS.agenda, JSON.stringify(next));
          } catch (e) {
            console.warn("Error saving agenda events", e);
          }
          return next;
        });

        return newEvent;
      }
    },
    [user]
  );

  const updateAgendaEvent = useCallback(
    async (
      id: string,
      updates: Partial<Omit<AgendaEvent, "id" | "user_id">>
    ): Promise<void> => {
      if (user) {
        let rollbackAgenda: AgendaEvent[] = [];
        setAgendaEvents((prev) => {
          rollbackAgenda = prev;
          return prev.map((a) =>
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
        });

        const { data, error } = await updateUserAgendaEvent(user.id, id, updates);
        if (error) {
          setAgendaEvents(rollbackAgenda);
          throw error;
        }

        if (data) {
          setAgendaEvents((prev) => {
            const next = prev.map((a) => (a.id === id ? data : a));
            try {
              const storageKey = getScopedStorageKey(user.id, "agenda");
              localStorage.setItem(storageKey, JSON.stringify(next));
            } catch (e) {
              console.warn("Error caching agenda events", e);
            }
            return next;
          });
        }
      } else {
        // Guest mode
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
            localStorage.setItem(LEGACY_STORAGE_KEYS.agenda, JSON.stringify(next));
          } catch (e) {
            console.warn("Error saving agenda events", e);
          }
          return next;
        });
      }
    },
    [user]
  );

  const deleteAgendaEvent = useCallback(
    async (id: string): Promise<void> => {
      if (user) {
        let rollbackAgenda: AgendaEvent[] = [];
        setAgendaEvents((prev) => {
          rollbackAgenda = prev;
          return prev.filter((a) => a.id !== id);
        });

        const { error } = await deleteUserAgendaEvent(user.id, id);
        if (error) {
          setAgendaEvents(rollbackAgenda);
          throw error;
        }

        try {
          const storageKey = getScopedStorageKey(user.id, "agenda");
          localStorage.setItem(
            storageKey,
            JSON.stringify(rollbackAgenda.filter((a) => a.id !== id))
          );
        } catch (e) {
          console.warn("Error caching agenda events", e);
        }
      } else {
        // Guest mode
        setAgendaEvents((prev) => {
          const next = prev.filter((a) => a.id !== id);
          try {
            localStorage.setItem(LEGACY_STORAGE_KEYS.agenda, JSON.stringify(next));
          } catch (e) {
            console.warn("Error saving agenda events", e);
          }
          return next;
        });
      }
    },
    [user]
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
    async (imported: ValidatedNoctisExport): Promise<void> => {
      if (!user) {
        // ── GUEST MODE (REPLACE DATA IN LOCALSTORAGE & REACT STATE) ──

        // Relationship Safety Check for Partial Payloads:
        // If replacing schedules without providing tasks, ensure user has no linked tasks that would be severed
        if (imported.data.schedules !== undefined && imported.data.tasks === undefined) {
          const hasLinkedTasks = tasks.some((t) => Boolean(t.course_schedule_id));
          if (hasLinkedTasks) {
            throw new Error(
              "Tidak dapat mengganti jadwal kuliah tanpa menyertakan tugas, karena ada tugas tersimpan yang terhubung ke jadwal saat ini. Sertakan data tugas dalam file impor untuk menjaga relasi jadwal secara aman."
            );
          }
        }

        // 1. Schedules (only replaced if schedules key is present in payload)
        let activeSchedules = schedules;
        if (imported.data.schedules !== undefined) {
          const sanitizedSchedules: CourseSchedule[] = imported.data.schedules.map((s) => ({
            id: s.id || generateId("sched"),
            user_id: DEFAULT_USER_ID,
            course_name: s.course_name,
            course_code: s.course_code,
            day_of_week: s.day_of_week as DayOfWeek,
            start_time: s.start_time,
            end_time: s.end_time,
            location: s.location,
            recurrence_rule: s.recurrence_rule,
            start_date: s.start_date,
            end_date: s.end_date,
            created_at: s.created_at || new Date().toISOString(),
            updated_at: s.updated_at || new Date().toISOString(),
          }));

          setSchedules(sanitizedSchedules);
          activeSchedules = sanitizedSchedules;
          try {
            localStorage.setItem(
              LEGACY_STORAGE_KEYS.schedules,
              JSON.stringify(sanitizedSchedules)
            );
          } catch (e) {
            console.warn("Error saving guest schedules", e);
          }
        }

        // 2. Tasks (only replaced if tasks key is present in payload)
        if (imported.data.tasks !== undefined) {
          const validScheduleIds = new Set(activeSchedules.map((s) => s.id));
          const sanitizedTasks: Task[] = imported.data.tasks.map((t) => {
            const resolvedScheduleId =
              t.course_schedule_id && validScheduleIds.has(t.course_schedule_id)
                ? t.course_schedule_id
                : undefined;

            return {
              id: t.id || generateId("task"),
              user_id: DEFAULT_USER_ID,
              title: t.title,
              description: t.description,
              due_at: t.due_at,
              priority: t.priority as TaskPriority,
              status: t.status as TaskStatus,
              course_schedule_id: resolvedScheduleId,
              created_at: t.created_at || new Date().toISOString(),
              updated_at: t.updated_at || new Date().toISOString(),
            };
          });

          setTasks(sanitizedTasks);
          try {
            localStorage.setItem(
              LEGACY_STORAGE_KEYS.tasks,
              JSON.stringify(sanitizedTasks)
            );
          } catch (e) {
            console.warn("Error saving guest tasks", e);
          }
        }

        // 3. Notes (only replaced if notes key is present in payload)
        if (imported.data.notes !== undefined) {
          const sanitizedNotes: Note[] = imported.data.notes.map((n) => ({
            id: n.id || generateId("note"),
            user_id: DEFAULT_USER_ID,
            title: n.title,
            content: n.content,
            category: n.category,
            tags: n.tags || [],
            is_favorite: Boolean(n.is_favorite),
            created_at: n.created_at || new Date().toISOString(),
            updated_at: n.updated_at || new Date().toISOString(),
          }));

          setNotes(sanitizedNotes);
          try {
            localStorage.setItem(
              LEGACY_STORAGE_KEYS.notes,
              JSON.stringify(sanitizedNotes)
            );
          } catch (e) {
            console.warn("Error saving guest notes", e);
          }
        }

        // 4. Agenda Events (only replaced if agendaEvents/agenda_events key is present)
        const guestAgenda = imported.data.agendaEvents ?? imported.data.agenda_events;
        if (guestAgenda !== undefined) {
          const sanitizedEvents: AgendaEvent[] = guestAgenda.map((a) => ({
            id: a.id || generateId("agenda"),
            user_id: DEFAULT_USER_ID,
            title: a.title,
            description: a.description,
            start_at: a.start_at,
            end_at: a.end_at,
            location: a.location,
            reminder_minutes: a.reminder_minutes,
            created_at: a.created_at || new Date().toISOString(),
            updated_at: a.updated_at || new Date().toISOString(),
          }));

          setAgendaEvents(sanitizedEvents);
          try {
            localStorage.setItem(
              LEGACY_STORAGE_KEYS.agenda,
              JSON.stringify(sanitizedEvents)
            );
          } catch (e) {
            console.warn("Error saving guest agenda", e);
          }
        }

        // 5. Profile (only update if provided in backup)
        if (imported.profile !== undefined) {
          const newProfile: UserProfile = {
            name: imported.profile.name || DEFAULT_GUEST_PROFILE.name,
            email: imported.profile.email || DEFAULT_GUEST_PROFILE.email,
            title: imported.profile.title || DEFAULT_GUEST_PROFILE.title,
          };
          setProfile(newProfile);
          try {
            localStorage.setItem(
              LEGACY_STORAGE_KEYS.profile,
              JSON.stringify(newProfile)
            );
          } catch (e) {
            console.warn("Error saving guest profile", e);
          }
        }

        // 6. Preferences (only update if provided in backup)
        if (imported.preferences !== undefined) {
          const newPrefs: UserPreferences = {
            theme: imported.preferences.theme || DEFAULT_PREFERENCES.theme,
            timezone: imported.preferences.timezone || DEFAULT_PREFERENCES.timezone,
            notifications: {
              ...DEFAULT_PREFERENCES.notifications,
              ...(imported.preferences.notifications || {}),
            },
          };
          setPreferences(newPrefs);
          try {
            localStorage.setItem(
              LEGACY_STORAGE_KEYS.preferences,
              JSON.stringify(newPrefs)
            );
          } catch (e) {
            console.warn("Error saving guest preferences", e);
          }
        }

        return;
      }

      // ── AUTHENTICATED USER MODE (ATOMIC DATABASE TRANSACTION VIA RPC) ──
      // Relationship Safety Check for Partial Payloads:
      // If replacing schedules without providing tasks, ensure user has no linked tasks that would be severed
      if (imported.data.schedules !== undefined && imported.data.tasks === undefined) {
        const hasLinkedTasks = tasks.some((t) => Boolean(t.course_schedule_id));
        if (hasLinkedTasks) {
          throw new Error(
            "Tidak dapat mengganti jadwal kuliah tanpa menyertakan tugas, karena ada tugas tersimpan yang terhubung ke jadwal saat ini. Sertakan data tugas dalam file impor untuk menjaga relasi jadwal secara aman."
          );
        }
      }

      const payload: ImportAtomicPayload = {};

      if (imported.data.schedules !== undefined) {
        payload.schedules = imported.data.schedules.map((s) => ({
          id: s.id,
          course_name: s.course_name,
          course_code: s.course_code,
          day_of_week: s.day_of_week,
          start_time: s.start_time,
          end_time: s.end_time,
          location: s.location,
          recurrence_rule: s.recurrence_rule,
          start_date: s.start_date,
          end_date: s.end_date,
          created_at: s.created_at,
          updated_at: s.updated_at,
        }));
      }

      if (imported.data.tasks !== undefined) {
        payload.tasks = imported.data.tasks.map((t) => ({
          id: t.id,
          title: t.title,
          description: t.description,
          due_at: t.due_at,
          priority: t.priority,
          status: t.status,
          course_schedule_id: t.course_schedule_id,
          created_at: t.created_at,
          updated_at: t.updated_at,
        }));
      }

      if (imported.data.notes !== undefined) {
        payload.notes = imported.data.notes.map((n) => ({
          id: n.id,
          title: n.title,
          content: n.content,
          category: n.category,
          tags: n.tags,
          is_favorite: Boolean(n.is_favorite),
          created_at: n.created_at,
          updated_at: n.updated_at,
        }));
      }

      const rawAgenda = imported.data.agendaEvents ?? imported.data.agenda_events;
      if (rawAgenda !== undefined) {
        payload.agenda_events = rawAgenda.map((a) => ({
          id: a.id,
          title: a.title,
          description: a.description,
          start_at: a.start_at,
          end_at: a.end_at,
          location: a.location,
          reminder_minutes: a.reminder_minutes,
          created_at: a.created_at,
          updated_at: a.updated_at,
        }));
      }

      if (imported.profile !== undefined) {
        payload.profile = {
          name: imported.profile.name,
          title: imported.profile.title,
        };
      }

      if (imported.preferences !== undefined) {
        payload.preferences = {
          theme: imported.preferences.theme,
          timezone: imported.preferences.timezone,
          notifications: imported.preferences.notifications,
        };
      }

      const res = await importUserDataAtomic(payload);
      if (res.error || !res.data) {
        throw new Error(res.error?.message || "Gagal mengimpor data ke Supabase.");
      }

      const {
        schedules: newSchedules,
        tasks: newTasks,
        notes: newNotes,
        agendaEvents: newAgenda,
        profile: newProfile,
        preferences: newPrefs,
      } = res.data;

      // Update React State & Scoped LocalStorage ONLY for categories present in result
      if (newSchedules !== undefined) {
        setSchedules(newSchedules);
        try {
          const key = getScopedStorageKey(user.id, "schedules");
          localStorage.setItem(key, JSON.stringify(newSchedules));
        } catch (e) {
          console.warn("Error caching scoped schedules", e);
        }
      }

      if (newTasks !== undefined) {
        setTasks(newTasks);
        try {
          const key = getScopedStorageKey(user.id, "tasks");
          localStorage.setItem(key, JSON.stringify(newTasks));
        } catch (e) {
          console.warn("Error caching scoped tasks", e);
        }
      }

      if (newNotes !== undefined) {
        setNotes(newNotes);
        try {
          const key = getScopedStorageKey(user.id, "notes");
          localStorage.setItem(key, JSON.stringify(newNotes));
        } catch (e) {
          console.warn("Error caching scoped notes", e);
        }
      }

      if (newAgenda !== undefined) {
        setAgendaEvents(newAgenda);
        try {
          const key = getScopedStorageKey(user.id, "agenda");
          localStorage.setItem(key, JSON.stringify(newAgenda));
        } catch (e) {
          console.warn("Error caching scoped agenda", e);
        }
      }

      if (newProfile !== undefined) {
        setProfile(newProfile);
        try {
          const key = getScopedStorageKey(user.id, "profile");
          localStorage.setItem(key, JSON.stringify(newProfile));
        } catch (e) {
          console.warn("Error caching scoped profile", e);
        }
      }

      if (newPrefs !== undefined) {
        setPreferences(newPrefs);
        try {
          const key = getScopedStorageKey(user.id, "preferences");
          localStorage.setItem(key, JSON.stringify(newPrefs));
        } catch (e) {
          console.warn("Error caching scoped preferences", e);
        }
      }
    },
    [user, tasks, schedules]
  );

  // Derived pending status: whenever auth is loading, logging out, or active user is switching,
  // enforce neutral empty/loading states so consumers never see stale profile or data.
  const isPendingAuth = isAuthLoading || isLoggingOut || activeUserId !== currentUserId;

  const value = useMemo(
    () => ({
      tasks: isPendingAuth ? [] : tasks,
      addTask,
      updateTask,
      deleteTask,
      toggleTaskStatus,

      notes: isPendingAuth ? [] : notes,
      addNote,
      updateNote,
      deleteNote,
      toggleNoteFavorite,

      schedules: isPendingAuth ? [] : schedules,
      addSchedule,
      updateSchedule,
      deleteSchedule,

      agendaEvents: isPendingAuth ? [] : agendaEvents,
      addAgendaEvent,
      updateAgendaEvent,
      deleteAgendaEvent,

      profile: isPendingAuth ? EMPTY_PROFILE : profile,
      updateProfile,

      preferences,
      updatePreferences,
      setNotificationPreference,

      exportAllData,
      importAllData,

      isAuthLoading: isPendingAuth || isAuthLoading,
      isProfileLoading: isPendingAuth || isProfileLoading,
      isDataLoading: isPendingAuth || isDataLoading,
      isLoaded: isPendingAuth ? false : isLoaded,
    }),
    [
      isPendingAuth,
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
