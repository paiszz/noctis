/**
 * Noctis Stage 5.3 — Reminder Logic Test Suite
 * Tests calculation of reminder trigger times, boundary handling,
 * weekday matching, timezone conversion, UUID validation, and deduplication invariants.
 */

import assert from "node:assert/strict";

console.log("=== Noctis Stage 5.3 — Reminder Logic Test Suite ===\n");

let passedTests = 0;

function runTest(name, fn) {
  try {
    fn();
    console.log(`[PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`[FAIL] ${name}`);
    console.error(err);
    process.exitCode = 1;
  }
}

// ── 1. Reference Implementations (Matching src/lib/reminders/calculate.ts and src/lib/supabase/reminders.ts) ──

const DEFAULT_TIMEZONE = "Asia/Jakarta";

function isValidUUID(val) {
  if (!val) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(val);
}

function getTimezoneBaseDate(now = new Date(), timezone = DEFAULT_TIMEZONE) {
  const tz = timezone || DEFAULT_TIMEZONE;
  const dateStr = now.toLocaleDateString("en-CA", { timeZone: tz });
  const [year, month, day] = dateStr.split("-").map(Number);

  const weekdayStr = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "short",
  }).format(now);

  const weekdayMap = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };

  return {
    year,
    month,
    day,
    dayOfWeek: weekdayMap[weekdayStr] ?? 0,
  };
}

function datetimeLocalToIso(localStr, timezone = DEFAULT_TIMEZONE) {
  if (!localStr) return "";
  const match = localStr.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!match) return "";

  const [, yStr, mStr, dStr, hStr, minStr] = match;
  const year = Number(yStr);
  const month = Number(mStr);
  const day = Number(dStr);
  const hour = Number(hStr);
  const minute = Number(minStr);

  const tz = timezone || DEFAULT_TIMEZONE;
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0, 0));

  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hour12: false,
  });

  const parts = formatter.formatToParts(utcGuess);
  const p = (type) => Number(parts.find((x) => x.type === type)?.value || 0);

  const formattedAsDate = new Date(
    Date.UTC(
      p("year"),
      p("month") - 1,
      p("day"),
      p("hour") === 24 ? 0 : p("hour"),
      p("minute"),
      p("second")
    )
  );
  const offsetDiffMs = formattedAsDate.getTime() - utcGuess.getTime();
  const finalDate = new Date(utcGuess.getTime() - offsetDiffMs);
  return finalDate.toISOString();
}

function isScheduleActiveOnDate(schedule, targetDate) {
  if (!schedule) return false;

  let dateStr;
  let dayOfWeek;

  if (targetDate instanceof Date) {
    if (isNaN(targetDate.getTime())) return false;
    const pad = (n) => String(n).padStart(2, "0");
    dateStr = `${targetDate.getFullYear()}-${pad(targetDate.getMonth() + 1)}-${pad(targetDate.getDate())}`;
    dayOfWeek = targetDate.getDay();
  } else if (typeof targetDate === "string") {
    const match = targetDate.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!match) return false;
    dateStr = `${match[1]}-${match[2]}-${match[3]}`;
    const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
    const parsedDate = new Date(y, m - 1, d);
    dayOfWeek = parsedDate.getDay();
  } else {
    return false;
  }

  // 1. Day of week match
  if (schedule.day_of_week !== dayOfWeek) {
    return false;
  }

  // 2. Start date boundary
  if (schedule.start_date && schedule.start_date.trim()) {
    const startStr = schedule.start_date.trim().slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(startStr) && dateStr < startStr) {
      return false;
    }
  }

  // 3. End date boundary
  if (schedule.end_date && schedule.end_date.trim()) {
    const endStr = schedule.end_date.trim().slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(endStr) && dateStr > endStr) {
      return false;
    }
  }

  return true;
}

function calculateTaskReminder(task, now = new Date()) {
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

  const title = `Tenggat Waktu: ${task.title}`;
  const body = `Tugas harus diselesaikan sebelum batas waktu pengumpulan.`;

  return { scheduledAt, title, body };
}

function calculateAgendaReminder(agenda, now = new Date()) {
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

  const locationInfo = agenda.location ? ` di ${agenda.location}` : "";
  const title = `Pengingat Agenda: ${agenda.title}`;
  const body = `Acara dimulai sebentar lagi${locationInfo}.`;

  return { scheduledAt, title, body };
}

function calculateScheduleOccurrences(schedule, options = {}) {
  const {
    horizonDays = 14,
    now = new Date(),
    timezone = DEFAULT_TIMEZONE,
  } = options;

  const results = [];
  const base = getTimezoneBaseDate(now, timezone);

  for (let offset = 0; offset < horizonDays; offset++) {
    const targetDateObj = new Date(Date.UTC(base.year, base.month - 1, base.day + offset, 12, 0, 0));
    const targetBase = getTimezoneBaseDate(targetDateObj, timezone);

    if (targetBase.dayOfWeek !== schedule.day_of_week) {
      continue;
    }

    const pad = (n) => String(n).padStart(2, "0");
    const dateStr = `${targetBase.year}-${pad(targetBase.month)}-${pad(targetBase.day)}`;
    if (!isScheduleActiveOnDate(schedule, dateStr)) {
      continue;
    }

    const localDateTimeStr = `${dateStr}T${schedule.start_time}`;
    const isoUtc = datetimeLocalToIso(localDateTimeStr, timezone);
    const eventTime = new Date(isoUtc);
    if (isNaN(eventTime.getTime())) {
      continue;
    }

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

// ── 2. UUID Validation Tests ──

runTest("isValidUUID accepts valid standard UUID v4 strings", () => {
  assert.equal(isValidUUID("550e8400-e29b-41d4-a716-446655440000"), true);
  assert.equal(isValidUUID("c1a85e44-77e8-4229-87c2-19e992928f64"), true);
  assert.equal(isValidUUID("C1A85E44-77E8-4229-87C2-19E992928F64"), true);
});

runTest("isValidUUID rejects non-UUID strings, empty strings, and null/undefined", () => {
  assert.equal(isValidUUID("task-123"), false);
  assert.equal(isValidUUID("sched-custom-1"), false);
  assert.equal(isValidUUID(""), false);
  assert.equal(isValidUUID(null), false);
  assert.equal(isValidUUID(undefined), false);
  assert.equal(isValidUUID("550e8400-e29b-41d4-a716-44665544000"), false); // too short
});

// ── 3. Task Deadline Reminder Logic Tests ──

runTest("Task: calculates reminder exactly 24 hours (1 day) before due_at", () => {
  const baseNow = new Date("2026-10-26T10:00:00.000Z");
  // Due date: 3 days in the future
  const dueAt = new Date("2026-10-29T10:00:00.000Z").toISOString();

  const task = {
    id: "c1a85e44-77e8-4229-87c2-19e992928f64",
    user_id: "550e8400-e29b-41d4-a716-446655440000",
    title: "Laporan Praktikum Fisika",
    priority: "high",
    status: "todo",
    due_at: dueAt,
  };

  const result = calculateTaskReminder(task, baseNow, "Asia/Jakarta");
  assert.notEqual(result, null);
  // Expected reminder: 24h prior to 2026-10-29T10:00:00Z -> 2026-10-28T10:00:00Z
  assert.equal(result.scheduledAt.toISOString(), "2026-10-28T10:00:00.000Z");
  assert.ok(result.title.includes("Laporan Praktikum Fisika"));
});

runTest("Task: returns null if task status is 'done'", () => {
  const baseNow = new Date("2026-10-26T10:00:00.000Z");
  const dueAt = new Date("2026-10-29T10:00:00.000Z").toISOString();

  const task = {
    id: "c1a85e44-77e8-4229-87c2-19e992928f64",
    user_id: "550e8400-e29b-41d4-a716-446655440000",
    title: "Tugas Selesai",
    status: "done",
    due_at: dueAt,
  };

  const result = calculateTaskReminder(task, baseNow);
  assert.equal(result, null);
});

runTest("Task: returns null if task has no due_at", () => {
  const baseNow = new Date("2026-10-26T10:00:00.000Z");

  const task = {
    id: "c1a85e44-77e8-4229-87c2-19e992928f64",
    user_id: "550e8400-e29b-41d4-a716-446655440000",
    title: "Tugas Tanpa Tenggat",
    status: "todo",
  };

  const result = calculateTaskReminder(task, baseNow);
  assert.equal(result, null);
});

runTest("Task: returns null if the 24-hour reminder time is already in the past", () => {
  const baseNow = new Date("2026-10-26T10:00:00.000Z");
  // Due in 12 hours -> H-1 was 12 hours ago
  const dueAt = new Date("2026-10-26T22:00:00.000Z").toISOString();

  const task = {
    id: "c1a85e44-77e8-4229-87c2-19e992928f64",
    user_id: "550e8400-e29b-41d4-a716-446655440000",
    title: "Tugas Mepet Deadline",
    status: "todo",
    due_at: dueAt,
  };

  const result = calculateTaskReminder(task, baseNow);
  assert.equal(result, null);
});

// ── 4. Agenda Event Reminder Logic Tests ──

runTest("Agenda: calculates reminder default 15 minutes before start_at", () => {
  const baseNow = new Date("2026-10-26T07:00:00.000Z");
  // Event starts at 08:00:00Z
  const startAt = new Date("2026-10-26T08:00:00.000Z").toISOString();

  const agenda = {
    id: "d2b96f55-88f9-4330-98d3-20f003039f75",
    user_id: "550e8400-e29b-41d4-a716-446655440000",
    title: "Rapat BEM Fakultas",
    start_at: startAt,
    location: "Ruang Rapat 2",
  };

  const result = calculateAgendaReminder(agenda, baseNow, "Asia/Jakarta");
  assert.notEqual(result, null);
  // Expected reminder: 15 mins before 08:00Z -> 07:45Z
  assert.equal(result.scheduledAt.toISOString(), "2026-10-26T07:45:00.000Z");
  assert.ok(result.title.includes("Rapat BEM Fakultas"));
  assert.ok(result.body.includes("Ruang Rapat 2"));
});

runTest("Agenda: respects custom reminder_minutes (e.g. 60 minutes)", () => {
  const baseNow = new Date("2026-10-26T06:00:00.000Z");
  const startAt = new Date("2026-10-26T08:00:00.000Z").toISOString();

  const agenda = {
    id: "d2b96f55-88f9-4330-98d3-20f003039f75",
    user_id: "550e8400-e29b-41d4-a716-446655440000",
    title: "Seminar Riset",
    start_at: startAt,
    reminder_minutes: 60,
  };

  const result = calculateAgendaReminder(agenda, baseNow, "Asia/Jakarta");
  assert.notEqual(result, null);
  // Expected: 60 mins before 08:00Z -> 07:00Z
  assert.equal(result.scheduledAt.toISOString(), "2026-10-26T07:00:00.000Z");
});

runTest("Agenda: returns null if reminder time has already passed", () => {
  const baseNow = new Date("2026-10-26T07:50:00.000Z");
  // Event starts at 08:00:00Z, reminder at 07:45:00Z (already passed at 07:50Z)
  const startAt = new Date("2026-10-26T08:00:00.000Z").toISOString();

  const agenda = {
    id: "d2b96f55-88f9-4330-98d3-20f003039f75",
    user_id: "550e8400-e29b-41d4-a716-446655440000",
    title: "Diskusi Kelompok",
    start_at: startAt,
  };

  const result = calculateAgendaReminder(agenda, baseNow);
  assert.equal(result, null);
});

// ── 5. Course Schedule Occurrences Reminder Logic Tests ──

runTest("Schedule: calculates reminder 30 minutes before class on matching day_of_week", () => {
  // Let baseNow be Monday 2026-10-26 at 06:00:00 WIB (which is 2026-10-25T23:00:00Z)
  // Asia/Jakarta is UTC+7
  const baseNow = new Date("2026-10-25T23:00:00.000Z"); // Monday 06:00 WIB

  // Schedule: Every Monday (day_of_week = 1), 08:00 to 10:00
  const schedule = {
    id: "e3c07a66-99a0-5441-a9e4-31a114140a86",
    user_id: "550e8400-e29b-41d4-a716-446655440000",
    course_name: "Kecerdasan Buatan",
    course_code: "IF3110",
    day_of_week: 1, // Monday
    start_time: "08:00",
    end_time: "10:00",
    location: "Lab Komputer 3",
    recurrence_rule: "weekly",
  };

  const occurrences = calculateScheduleOccurrences(schedule, {
    horizonDays: 14,
    now: baseNow,
    timezone: "Asia/Jakarta",
  });

  // Over 14 days, there should be 2 Monday occurrences (today 2026-10-26 and next week 2026-11-02)
  assert.equal(occurrences.length, 2);

  const first = occurrences[0];
  // 08:00 WIB - 30 mins = 07:30 WIB (which is 00:30 UTC on 2026-10-26)
  assert.equal(first.scheduledAt.toISOString(), "2026-10-26T00:30:00.000Z");
  assert.ok(first.title.includes("Kecerdasan Buatan"));
  assert.ok(first.body.includes("08:00"));
  assert.ok(first.body.includes("Lab Komputer 3"));

  const second = occurrences[1];
  assert.equal(second.scheduledAt.toISOString(), "2026-11-02T00:30:00.000Z");
});

runTest("Schedule: skips occurrence if 30-min reminder time has already elapsed today", () => {
  // Let baseNow be Monday 2026-10-26 at 07:45:00 WIB (00:45:00 UTC)
  // Reminder for 08:00 WIB was due at 07:30 WIB (00:30:00 UTC) -> already passed
  const baseNow = new Date("2026-10-26T00:45:00.000Z");

  const schedule = {
    id: "e3c07a66-99a0-5441-a9e4-31a114140a86",
    user_id: "550e8400-e29b-41d4-a716-446655440000",
    course_name: "Algoritma Pemrograman",
    day_of_week: 1, // Monday
    start_time: "08:00",
    end_time: "10:00",
  };

  const occurrences = calculateScheduleOccurrences(schedule, {
    horizonDays: 14,
    now: baseNow,
    timezone: "Asia/Jakarta",
  });

  // Only next Monday should remain
  assert.equal(occurrences.length, 1);
  assert.equal(occurrences[0].scheduledAt.toISOString(), "2026-11-02T00:30:00.000Z");
});

runTest("Schedule: respects start_date and end_date date range boundaries", () => {
  const baseNow = new Date("2026-10-25T23:00:00.000Z"); // Monday 2026-10-26 06:00 WIB

  // Schedule restricted to only active until 2026-10-30
  const schedule = {
    id: "e3c07a66-99a0-5441-a9e4-31a114140a86",
    user_id: "550e8400-e29b-41d4-a716-446655440000",
    course_name: "Sistem Terdistribusi",
    day_of_week: 1, // Monday
    start_time: "13:00",
    end_time: "15:00",
    start_date: "2026-10-20",
    end_date: "2026-10-30", // Stops before second Monday (2026-11-02)
  };

  const occurrences = calculateScheduleOccurrences(schedule, {
    horizonDays: 14,
    now: baseNow,
    timezone: "Asia/Jakarta",
  });

  // Only 1 occurrence should be active within range
  assert.equal(occurrences.length, 1);
  // 13:00 WIB - 30 mins = 12:30 WIB (05:30 UTC)
  assert.equal(occurrences[0].scheduledAt.toISOString(), "2026-10-26T05:30:00.000Z");
});

// ── 6. Deduplication and Idempotency Invariants ──

runTest("Idempotency: occurrences have unique scheduledAt timestamps per source", () => {
  const baseNow = new Date("2026-10-25T23:00:00.000Z");
  const schedule = {
    id: "e3c07a66-99a0-5441-a9e4-31a114140a86",
    user_id: "550e8400-e29b-41d4-a716-446655440000",
    course_name: "Basis Data",
    day_of_week: 3, // Wednesday
    start_time: "09:00",
    end_time: "11:00",
  };

  const occurrences = calculateScheduleOccurrences(schedule, {
    horizonDays: 28,
    now: baseNow,
    timezone: "Asia/Jakarta",
  });

  const timestamps = occurrences.map((o) => o.scheduledAt.toISOString());
  const uniqueTimestamps = new Set(timestamps);
  assert.equal(timestamps.length, uniqueTimestamps.size, "All occurrences must be strictly deduplicated");
});

console.log(`\n=== All ${passedTests} Reminder Logic Tests Passed Successfully! ===`);
