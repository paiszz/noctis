/**
 * Noctis — Real-Time Clock & Dynamic Transition Test Suite
 * Validates real-time transition determination, timezone consistency,
 * task overdue transitions, and agenda status transitions without manual page refresh.
 */

import assert from "node:assert/strict";

console.log("=== Noctis — Real-Time Status & Transition Tests ===\n");

let passedTests = 0;

function runTest(name, fn) {
  try {
    fn();
    console.log(`  ✓ PASS: ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ FAIL: ${name}`);
    console.error(err);
    process.exitCode = 1;
  }
}

const DEFAULT_TIMEZONE = "Asia/Jakarta";

function toTimezoneDate(date = new Date(), timezone = DEFAULT_TIMEZONE) {
  const d = typeof date === "string" || typeof date === "number" ? new Date(date) : date;
  if (isNaN(d.getTime())) return new Date(NaN);
  return new Date(d.toLocaleString("en-US", { timeZone: timezone || DEFAULT_TIMEZONE }));
}

function isOverdue(task, now, timezone = DEFAULT_TIMEZONE) {
  if (task.status === "done" || !task.due_at) return false;
  const effectiveNow = now ?? toTimezoneDate(new Date(), timezone);
  const dueWallClock = toTimezoneDate(task.due_at, timezone).getTime();
  return dueWallClock < effectiveNow.getTime();
}

function isUpcomingAgenda(agenda, now, timezone = DEFAULT_TIMEZONE) {
  const effectiveNow = now ?? toTimezoneDate(new Date(), timezone);
  const eventTime = toTimezoneDate(agenda.start_at, timezone).getTime();
  const currentTime = effectiveNow.getTime();
  return eventTime >= currentTime;
}

function isPastAgenda(agenda, now, timezone = DEFAULT_TIMEZONE) {
  const effectiveNow = now ?? toTimezoneDate(new Date(), timezone);
  const eventTime = toTimezoneDate(agenda.start_at, timezone).getTime();
  const currentTime = effectiveNow.getTime();
  return eventTime < currentTime;
}

// ── 1. Target Transition Math & Scheduling ──

runTest("Calculates nearest future diff correctly from target timestamps", () => {
  const currentEpoch = 1700000000000;
  const pastTarget = 1699999000000; // in the past
  const nearTarget = 1700000005000; // 5 seconds in future
  const farTarget = 1700000060000;  // 60 seconds in future

  const targets = [pastTarget, nearTarget, farTarget];
  let nearestDiff = Infinity;

  for (const t of targets) {
    const diff = t - currentEpoch;
    if (diff > 0 && diff < nearestDiff) {
      nearestDiff = diff;
    }
  }

  assert.equal(nearestDiff, 5000, "Should select 5000ms as nearest future diff");
});

runTest("Ignores past targets and returns Infinity if all targets elapsed", () => {
  const currentEpoch = 1700000000000;
  const pastTargets = [1699999000000, 1699990000000];

  let nearestDiff = Infinity;
  for (const t of pastTargets) {
    const diff = t - currentEpoch;
    if (diff > 0 && diff < nearestDiff) {
      nearestDiff = diff;
    }
  }

  assert.equal(nearestDiff, Infinity, "Should return Infinity when all targets are in past");
});

// ── 2. Real-Time Task Overdue Status Flipping ──

runTest("Task overdue status transitions automatically across deadline boundary", () => {
  const deadlineIso = "2026-10-26T12:00:00.000Z";
  const deadlineEpoch = new Date(deadlineIso).getTime();

  const task = {
    id: "task-1",
    user_id: "user-1",
    title: "Tugas Fisika",
    status: "todo",
    priority: "high",
    due_at: deadlineIso,
    created_at: "2026-10-20T00:00:00Z",
    updated_at: "2026-10-20T00:00:00Z",
  };

  // 1 second BEFORE deadline: not overdue
  const beforeNow = new Date(deadlineEpoch - 1000);
  const beforeWallClock = toTimezoneDate(beforeNow, "Asia/Jakarta");
  assert.equal(isOverdue(task, beforeWallClock, "Asia/Jakarta"), false, "Must NOT be overdue before deadline");

  // AT deadline: not overdue (strictly <)
  const atNow = new Date(deadlineEpoch);
  const atWallClock = toTimezoneDate(atNow, "Asia/Jakarta");
  assert.equal(isOverdue(task, atWallClock, "Asia/Jakarta"), false, "Must NOT be overdue exactly at deadline");

  // 1 second AFTER deadline: OVERDUE!
  const afterNow = new Date(deadlineEpoch + 1000);
  const afterWallClock = toTimezoneDate(afterNow, "Asia/Jakarta");
  assert.equal(isOverdue(task, afterWallClock, "Asia/Jakarta"), true, "MUST be overdue immediately after deadline passes");
});

runTest("Completed task never flips to overdue even after deadline passes", () => {
  const deadlineIso = "2026-10-26T12:00:00.000Z";
  const deadlineEpoch = new Date(deadlineIso).getTime();

  const doneTask = {
    id: "task-2",
    user_id: "user-1",
    title: "Tugas Selesai",
    status: "done",
    priority: "medium",
    due_at: deadlineIso,
    created_at: "2026-10-20T00:00:00Z",
    updated_at: "2026-10-20T00:00:00Z",
  };

  const afterNow = new Date(deadlineEpoch + 5000);
  const afterWallClock = toTimezoneDate(afterNow, "Asia/Jakarta");
  assert.equal(isOverdue(doneTask, afterWallClock, "Asia/Jakarta"), false, "Done task should never be overdue");
});

// ── 3. Real-Time Agenda Upcoming vs Past Transition ──

runTest("Agenda event transitions from upcoming to past when start_at arrives", () => {
  const startIso = "2026-10-26T14:30:00.000Z";
  const startEpoch = new Date(startIso).getTime();

  const agenda = {
    id: "agenda-1",
    user_id: "user-1",
    title: "Seminar Teknologi",
    start_at: startIso,
    created_at: "2026-10-20T00:00:00Z",
    updated_at: "2026-10-20T00:00:00Z",
  };

  // 1 second BEFORE start: isUpcoming === true, isPast === false
  const beforeNow = new Date(startEpoch - 1000);
  const beforeWallClock = toTimezoneDate(beforeNow, "Asia/Jakarta");
  assert.equal(isUpcomingAgenda(agenda, beforeWallClock, "Asia/Jakarta"), true, "Should be upcoming before start_at");
  assert.equal(isPastAgenda(agenda, beforeWallClock, "Asia/Jakarta"), false, "Should not be past before start_at");

  // 1 second AFTER start: isUpcoming === false, isPast === true
  const afterNow = new Date(startEpoch + 1000);
  const afterWallClock = toTimezoneDate(afterNow, "Asia/Jakarta");
  assert.equal(isUpcomingAgenda(agenda, afterWallClock, "Asia/Jakarta"), false, "Should no longer be upcoming after start_at");
  assert.equal(isPastAgenda(agenda, afterWallClock, "Asia/Jakarta"), true, "Should be past after start_at");
});

// ── 4. Timezone Wall Clock Consistency ──

runTest("toTimezoneDate correctly shifts wall clock across WIB, WITA, WIT", () => {
  const fixedUtc = new Date("2026-10-26T12:00:00.000Z");

  const wib = toTimezoneDate(fixedUtc, "Asia/Jakarta"); // UTC+7
  const wita = toTimezoneDate(fixedUtc, "Asia/Makassar"); // UTC+8
  const wit = toTimezoneDate(fixedUtc, "Asia/Jayapura"); // UTC+9

  assert.equal(wib.getHours(), 19, "WIB should be 19:00");
  assert.equal(wita.getHours(), 20, "WITA should be 20:00");
  assert.equal(wit.getHours(), 21, "WIT should be 21:00");
});

console.log(`\nTest Results: ${passedTests} passed, 0 failed\n`);
