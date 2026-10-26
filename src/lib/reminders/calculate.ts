import { DEFAULT_TIMEZONE, formatInTimezone, getTimezoneBaseDate, datetimeLocalToIso } from "@/lib/date";
import { isScheduleActiveOnDate } from "@/types";
import type { Task, AgendaEvent, CourseSchedule } from "@/types";

export interface ReminderCalculationResult {
  scheduledAt: Date;
  title: string;
  body: string;
}

export interface ScheduleOccurrenceReminder extends ReminderCalculationResult {
  eventTime: Date;
}

/**
 * Calculates reminder details for a Task.
 *
 * Rules:
 * - Reminder is scheduled exactly 24 hours (1 day) before task.due_at.
 * - Completed tasks (status === 'done') or tasks without due_at return null.
 * - If the reminder time has already elapsed relative to 'now', returns null.
 */
export function calculateTaskReminder(
  task: Task,
  now: Date = new Date(),
  timezone: string = DEFAULT_TIMEZONE
): ReminderCalculationResult | null {
  if (task.status === "done" || !task.due_at) {
    return null;
  }

  const dueDate = new Date(task.due_at);
  if (isNaN(dueDate.getTime())) {
    return null;
  }

  // 24 hours prior to deadline
  const scheduledTimeMs = dueDate.getTime() - 24 * 60 * 60 * 1000;
  const scheduledAt = new Date(scheduledTimeMs);

  if (scheduledAt.getTime() <= now.getTime()) {
    return null;
  }

  const formattedDueDate = formatInTimezone(dueDate, "EEEE, d MMM yyyy 'pukul' HH:mm", timezone);
  const title = `Tenggat Waktu: ${task.title}`;
  const body = `Tugas harus diselesaikan sebelum ${formattedDueDate}.`;

  return { scheduledAt, title, body };
}

/**
 * Calculates reminder details for an Agenda Event.
 *
 * Rules:
 * - Reminder is scheduled (reminder_minutes ?? 15) minutes before agenda.start_at.
 * - If the reminder time has already passed relative to 'now', returns null.
 */
export function calculateAgendaReminder(
  agenda: AgendaEvent,
  now: Date = new Date(),
  timezone: string = DEFAULT_TIMEZONE
): ReminderCalculationResult | null {
  if (!agenda.start_at) {
    return null;
  }

  const startDate = new Date(agenda.start_at);
  if (isNaN(startDate.getTime())) {
    return null;
  }

  const reminderMinutes = agenda.reminder_minutes ?? 15;
  const scheduledTimeMs = startDate.getTime() - reminderMinutes * 60 * 1000;
  const scheduledAt = new Date(scheduledTimeMs);

  if (scheduledAt.getTime() <= now.getTime()) {
    return null;
  }

  const formattedStartTime = formatInTimezone(startDate, "HH:mm", timezone);
  const formattedDate = formatInTimezone(startDate, "EEEE, d MMM", timezone);
  const locationInfo = agenda.location ? ` di ${agenda.location}` : "";
  const title = `Pengingat Agenda: ${agenda.title}`;
  const body = `Acara dimulai pada ${formattedDate} pukul ${formattedStartTime}${locationInfo}.`;

  return { scheduledAt, title, body };
}

/**
 * Calculates upcoming concrete reminder occurrences for a recurring weekly Course Schedule.
 *
 * Rules:
 * - Scans future days across the given horizon (default: 14 days / 2 weeks).
 * - Matches schedule.day_of_week and verifies isScheduleActiveOnDate (respecting start_date & end_date).
 * - Reminder is scheduled 30 minutes before class start_time in the user's timezone.
 * - Only future occurrences (scheduledAt > now) are returned.
 */
export function calculateScheduleOccurrences(
  schedule: CourseSchedule,
  options: {
    horizonDays?: number;
    now?: Date;
    timezone?: string;
  } = {}
): ScheduleOccurrenceReminder[] {
  const {
    horizonDays = 14,
    now = new Date(),
    timezone = DEFAULT_TIMEZONE,
  } = options;

  const results: ScheduleOccurrenceReminder[] = [];
  const base = getTimezoneBaseDate(now, timezone);

  for (let offset = 0; offset < horizonDays; offset++) {
    // Generate date parts for the target day at noon to avoid boundary drift
    const targetDateObj = new Date(Date.UTC(base.year, base.month - 1, base.day + offset, 12, 0, 0));
    const targetBase = getTimezoneBaseDate(targetDateObj, timezone);

    // 1. Day of week must match
    if (targetBase.dayOfWeek !== schedule.day_of_week) {
      continue;
    }

    // 2. Active date range boundary check (start_date & end_date)
    const pad = (n: number) => String(n).padStart(2, "0");
    const dateStr = `${targetBase.year}-${pad(targetBase.month)}-${pad(targetBase.day)}`;
    if (!isScheduleActiveOnDate(schedule, dateStr)) {
      continue;
    }

    // 3. Construct local timestamp and convert to UTC ISO
    const localDateTimeStr = `${dateStr}T${schedule.start_time}`;
    const isoUtc = datetimeLocalToIso(localDateTimeStr, timezone);
    const eventTime = new Date(isoUtc);
    if (isNaN(eventTime.getTime())) {
      continue;
    }

    // 4. 30 minutes prior to class start
    const scheduledTimeMs = eventTime.getTime() - 30 * 60 * 1000;
    const scheduledAt = new Date(scheduledTimeMs);

    if (scheduledAt.getTime() <= now.getTime()) {
      continue;
    }

    const locationInfo = schedule.location ? ` di ${schedule.location}` : "";
    const title = `Jadwal Kuliah: ${schedule.course_name}`;
    const body = `Kelas dimulai pukul ${schedule.start_time}${locationInfo}.`;

    results.push({
      scheduledAt,
      eventTime,
      title,
      body,
    });
  }

  return results;
}
