import { format } from "date-fns";
import { toTimezoneDate, DEFAULT_TIMEZONE } from "@/lib/date";
import type { CourseSchedule, AgendaEvent, DayOfWeek } from "@/types";

export interface NextUpActivity {
  id: string;
  type: "Jadwal" | "Agenda";
  title: string;
  time: string;
  location: string;
  href: string;
  isOngoing: boolean;
  startDateTime: Date;
  endDateTime: Date;
}

/**
 * Determines the Next Up activity between today's course schedules and agenda events.
 *
 * Rules:
 * 1. Timezone: Calculations use user timezone (default: Asia/Jakarta).
 * 2. Ongoing Priority: If any activity is currently ongoing (start <= now && end >= now),
 *    the ongoing activity takes precedence. If multiple ongoing exist, the one with earliest start wins.
 * 3. Upcoming Nearest: If no activity is ongoing, the upcoming activity (start > now)
 *    whose start time is closest to now is chosen.
 * 4. Tie-break Rule (Scenario D): If an agenda and a schedule start at the EXACT same time:
 *    a. The one that finishes earlier (shorter duration) takes precedence.
 *    b. If still tied: Agenda takes precedence over Course Schedule.
 *    c. If still tied: Alphabetical by title.
 * 5. Returns null if all activities are past or no candidates exist.
 */
export function determineNextUpActivity(
  schedules: CourseSchedule[],
  agendaEvents: AgendaEvent[],
  now?: Date,
  timezone: string = DEFAULT_TIMEZONE
): NextUpActivity | null {
  const effectiveNow = now ?? toTimezoneDate(new Date(), timezone);
  const currentTime = effectiveNow.getTime();
  const todayDay = effectiveNow.getDay() as DayOfWeek;
  const todayStr = format(effectiveNow, "yyyy-MM-dd");

  const candidates: NextUpActivity[] = [];

  // 1. Course Schedules for today
  const todaySchedules = schedules.filter((s) => s.day_of_week === todayDay);
  for (const s of todaySchedules) {
    if (!s.start_time || !s.end_time) continue;

    const [startH, startM] = s.start_time.split(":").map(Number);
    const [endH, endM] = s.end_time.split(":").map(Number);

    if (isNaN(startH) || isNaN(startM) || isNaN(endH) || isNaN(endM)) continue;

    const startDateTime = new Date(effectiveNow);
    startDateTime.setHours(startH, startM, 0, 0);

    const endDateTime = new Date(effectiveNow);
    endDateTime.setHours(endH, endM, 0, 0);

    // If end_time is earlier than start_time (overnight), roll over to next day
    if (endDateTime.getTime() < startDateTime.getTime()) {
      endDateTime.setDate(endDateTime.getDate() + 1);
    }

    const isOngoing =
      startDateTime.getTime() <= currentTime && endDateTime.getTime() >= currentTime;
    const isUpcoming = startDateTime.getTime() > currentTime;

    // Only ongoing or upcoming activities are valid candidates
    if (isOngoing || isUpcoming) {
      candidates.push({
        id: s.id,
        type: "Jadwal",
        title: s.course_name,
        time: `${s.start_time} — ${s.end_time}`,
        location: s.location || "Ruang Kelas",
        href: "/calendar",
        isOngoing,
        startDateTime,
        endDateTime,
      });
    }
  }

  // 2. Agenda Events (today and upcoming)
  for (const a of agendaEvents) {
    if (!a.start_at) continue;

    const startDateTime = toTimezoneDate(a.start_at, timezone);
    // If end_at is not specified, assume standard 1 hour duration
    const endDateTime = a.end_at
      ? toTimezoneDate(a.end_at, timezone)
      : new Date(startDateTime.getTime() + 60 * 60 * 1000);

    const isOngoing =
      startDateTime.getTime() <= currentTime && endDateTime.getTime() >= currentTime;
    const isUpcoming = startDateTime.getTime() > currentTime;

    // Consider ongoing events or upcoming events within today or near future
    if (isOngoing || isUpcoming) {
      const isStartToday = format(startDateTime, "yyyy-MM-dd") === todayStr;
      const startTimeFormatted = format(startDateTime, "HH:mm");
      const endTimeFormatted = a.end_at ? format(endDateTime, "HH:mm") : "";

      const timeDisplay = isStartToday
        ? endTimeFormatted
          ? `${startTimeFormatted} — ${endTimeFormatted}`
          : startTimeFormatted
        : format(startDateTime, "dd MMM · HH:mm") +
          (endTimeFormatted ? ` — ${endTimeFormatted}` : "");

      candidates.push({
        id: a.id,
        type: "Agenda",
        title: a.title,
        time: timeDisplay,
        location: a.location || "Ruang Rapat",
        href: "/agenda",
        isOngoing,
        startDateTime,
        endDateTime,
      });
    }
  }

  if (candidates.length === 0) {
    return null;
  }

  // Sorting function adhering strictly to Rules 2, 3, 4
  const comparator = (a: NextUpActivity, b: NextUpActivity): number => {
    // Ongoing items always precede upcoming items
    if (a.isOngoing && !b.isOngoing) return -1;
    if (!a.isOngoing && b.isOngoing) return 1;

    // Both are ongoing or both are upcoming: compare start times
    const startDiff = a.startDateTime.getTime() - b.startDateTime.getTime();
    if (startDiff !== 0) return startDiff;

    // Tie-break 1: Earlier end time wins
    const endDiff = a.endDateTime.getTime() - b.endDateTime.getTime();
    if (endDiff !== 0) return endDiff;

    // Tie-break 2: Agenda takes precedence over Course Schedule
    if (a.type !== b.type) {
      return a.type === "Agenda" ? -1 : 1;
    }

    // Tie-break 3: Title alphabetically
    return a.title.localeCompare(b.title);
  };

  candidates.sort(comparator);
  return candidates[0];
}
