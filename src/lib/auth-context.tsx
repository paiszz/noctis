"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { usePathname } from "next/navigation";
import type { User, Session } from "@supabase/supabase-js";
import { createBrowserClient, isSupabaseConfigured } from "@/lib/supabase";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isLoggingOut: boolean;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  isLoading: true,
  isLoggingOut: false,
  signOut: async () => {},
  refreshSession: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(() => isSupabaseConfigured());
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const isLoggingOutRef = useRef(false);

  // Reset isLoggingOut cleanly once route navigation (e.g. to /login) has taken effect
  useEffect(() => {
    if (isLoggingOutRef.current) {
      isLoggingOutRef.current = false;
      setIsLoggingOut(false);
    }
  }, [pathname]);

  const refreshSession = useCallback(async () => {
    const supabase = createBrowserClient();
    if (!supabase || !isSupabaseConfigured()) {
      setIsLoading(false);
      return;
    }
    try {
      const { data } = await supabase.auth.getSession();
      setSession(data.session);
      setUser((prevUser) => {
        const nextUser = data.session?.user ?? null;
        if (!prevUser && !nextUser) return null;
        if (
          prevUser &&
          nextUser &&
          prevUser.id === nextUser.id &&
          prevUser.email === nextUser.email &&
          prevUser.updated_at === nextUser.updated_at
        ) {
          return prevUser;
        }
        return nextUser;
      });
    } catch {
      // Fallback if network fails
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const supabase = createBrowserClient();
    if (!supabase || !isSupabaseConfigured()) {
      return;
    }

    // 1. Initial session check
    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        setSession(session);
        setUser(session?.user ?? null);
        setIsLoading(false);
      })
      .catch(() => {
        setIsLoading(false);
      });

    // 2. Real-time auth state listener
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, currentSession) => {
      setSession(currentSession);
      setUser((prevUser) => {
        const nextUser = currentSession?.user ?? null;
        if (!prevUser && !nextUser) return null;
        if (
          prevUser &&
          nextUser &&
          prevUser.id === nextUser.id &&
          prevUser.email === nextUser.email &&
          prevUser.updated_at === nextUser.updated_at
        ) {
          return prevUser;
        }
        return nextUser;
      });
      setIsLoading(false);
      if (event === "SIGNED_IN") {
        isLoggingOutRef.current = false;
        setIsLoggingOut(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signOut = useCallback(async () => {
    isLoggingOutRef.current = true;
    setIsLoggingOut(true);
    setIsLoading(true);
    try {
      const supabase = createBrowserClient();
      if (supabase) {
        await supabase.auth.signOut();
      }
    } catch (err) {
      isLoggingOutRef.current = false;
      setIsLoggingOut(false);
      setIsLoading(false);
      throw err;
    } finally {
      setUser(null);
      setSession(null);
      setIsLoading(false);
      // Fallback safety timeout in case route change is delayed or not triggered
      setTimeout(() => {
        if (isLoggingOutRef.current) {
          isLoggingOutRef.current = false;
          setIsLoggingOut(false);
        }
      }, 4000);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        isLoading,
        isLoggingOut,
        signOut,
        refreshSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
