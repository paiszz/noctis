"use client";

import { useState, useEffect } from "react";
import { toTimezoneDate, DEFAULT_TIMEZONE } from "@/lib/date";

/**
 * Custom hook providing a reactive wall-clock Date synchronized to the user's timezone.
 *
 * Capabilities:
 * 1. Base Periodic Interval: Updates periodically (default: 30,000ms / 30 seconds).
 * 2. Next Transition Scheduling: Given an array of target timestamps (e.g. task deadlines,
 *    agenda start/end times, schedule boundaries), calculates the nearest future transition
 *    and schedules an exact timer (+50ms cushion) so time-dependent statuses update
 *    immediately without waiting for the next periodic tick.
 * 3. Page Visibility & Window Focus: Listens to `visibilitychange`, `focus`, and `pageshow`
 *    so when a background tab is reopened or a sleeping device wakes up, the clock and
 *    all derived statuses refresh instantly.
 * 4. Clean Teardown: Cleans up all intervals, timeouts, and event listeners on unmount.
 *
 * @param timezone The user's configured timezone (default: "Asia/Jakarta")
 * @param targetTimestamps Optional array of ISO strings, epoch milliseconds, or Date objects to watch for transitions
 * @param intervalMs Periodic fallback interval in milliseconds (default: 30000)
 */
export function useRealtimeClock(
  timezone: string = DEFAULT_TIMEZONE,
  targetTimestamps?: (string | number | Date | null | undefined)[],
  intervalMs: number = 30000
): Date {
  const [now, setNow] = useState<Date>(() => toTimezoneDate(new Date(), timezone));
  const [prevTimezone, setPrevTimezone] = useState(timezone);

  // Synchronize now if timezone changes during render
  if (timezone !== prevTimezone) {
    setPrevTimezone(timezone);
    setNow(toTimezoneDate(new Date(), timezone));
  }

  useEffect(() => {
    let isMounted = true;
    let transitionTimer: ReturnType<typeof setTimeout> | null = null;
    let intervalTimer: ReturnType<typeof setInterval> | null = null;

    const updateNow = () => {
      if (!isMounted) return;
      setNow(toTimezoneDate(new Date(), timezone));
    };

    // 1. Periodic tick (default: every 30s)
    intervalTimer = setInterval(updateNow, intervalMs);

    // 2. Schedule exact timeout for the nearest future transition
    const scheduleNextTransition = () => {
      if (transitionTimer) {
        clearTimeout(transitionTimer);
        transitionTimer = null;
      }

      if (!targetTimestamps || targetTimestamps.length === 0) return;

      const currentRealTime = Date.now();
      let nearestFutureDiff = Infinity;

      for (const target of targetTimestamps) {
        if (!target) continue;
        const targetEpoch =
          typeof target === "number"
            ? target
            : target instanceof Date
            ? target.getTime()
            : new Date(target).getTime();

        if (isNaN(targetEpoch)) continue;

        const diff = targetEpoch - currentRealTime;
        if (diff > 0 && diff < nearestFutureDiff) {
          nearestFutureDiff = diff;
        }
      }

      // Only schedule if within a 24-hour window to prevent 32-bit timer overflow
      if (nearestFutureDiff !== Infinity && nearestFutureDiff <= 86400000) {
        transitionTimer = setTimeout(() => {
          updateNow();
          scheduleNextTransition();
        }, nearestFutureDiff + 50);
      }
    };

    scheduleNextTransition();

    // 3. Page visibility & window focus handlers for tab switch / device sleep recovery
    const handleVisibilityOrFocus = () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        return;
      }
      updateNow();
      scheduleNextTransition();
    };

    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", handleVisibilityOrFocus);
    }
    if (typeof window !== "undefined") {
      window.addEventListener("focus", handleVisibilityOrFocus);
      window.addEventListener("pageshow", handleVisibilityOrFocus);
    }

    return () => {
      isMounted = false;
      if (intervalTimer) clearInterval(intervalTimer);
      if (transitionTimer) clearTimeout(transitionTimer);
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", handleVisibilityOrFocus);
      }
      if (typeof window !== "undefined") {
        window.removeEventListener("focus", handleVisibilityOrFocus);
        window.removeEventListener("pageshow", handleVisibilityOrFocus);
      }
    };
  }, [timezone, intervalMs, targetTimestamps]);

  return now;
}
