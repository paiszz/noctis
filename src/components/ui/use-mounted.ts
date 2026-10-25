"use client";

import { useSyncExternalStore } from "react";

const emptySubscribe = () => () => {};

/**
 * Custom hook to safely detect client-side mounting in SSR / Next.js App Router environments
 * without causing cascading renders or violating React Compiler set-state-in-effect rules.
 */
export function useMounted(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
}
