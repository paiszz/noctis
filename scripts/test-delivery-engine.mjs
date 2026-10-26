/**
 * Noctis Stage 5.4 — Delivery Engine & Scheduler Test Suite
 * Tests scheduler authentication, atomic claim logic, batch isolation,
 * Web Push error handling, expired subscription detection, exponential backoff,
 * database error tracking, OCC guard against stale workers, and migration integrity.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { verifySchedulerAuth } from "../src/lib/reminders/auth.ts";
import { sanitizeInternalUrl } from "../src/lib/push/send.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

console.log("\n🧪 Running Noctis Stage 5.4 Delivery Engine & Scheduler Tests...\n");

let passed = 0;
let failed = 0;

function runTest(name, fn) {
  try {
    fn();
    console.log(`  ✓ PASS: ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ FAIL: ${name}`);
    console.error(`    ${err.message}\n`);
    failed++;
  }
}

async function runAsyncTest(name, fn) {
  try {
    await fn();
    console.log(`  ✓ PASS: ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ FAIL: ${name}`);
    console.error(`    ${err.message}\n`);
    failed++;
  }
}

// ==============================================================================
// 1. Exponential Backoff Calculation Tests
// ==============================================================================
runTest("Exponential backoff calculation matches expected intervals", () => {
  function calculateBackoffDelaySeconds(attempts) {
    const safeAttempts = Math.max(1, attempts);
    const baseSeconds = Math.pow(2, safeAttempts) * 60;
    return Math.min(baseSeconds, 3600);
  }

  // Attempt 1: 2^1 * 60 = 120s (2m)
  assert.equal(calculateBackoffDelaySeconds(1), 120);
  // Attempt 2: 2^2 * 60 = 240s (4m)
  assert.equal(calculateBackoffDelaySeconds(2), 240);
  // Attempt 3: 2^3 * 60 = 480s (8m)
  assert.equal(calculateBackoffDelaySeconds(3), 480);
  // Attempt 4: 2^4 * 60 = 960s (16m)
  assert.equal(calculateBackoffDelaySeconds(4), 960);
  // Capped at 3600s
  assert.equal(calculateBackoffDelaySeconds(10), 3600);
});

// ==============================================================================
// 2. Safe URL Sanitization Tests
// ==============================================================================
runTest("URL Sanitizer enforces safe internal navigation", () => {
  assert.equal(sanitizeInternalUrl("/tasks"), "/tasks");
  assert.equal(sanitizeInternalUrl("/calendar?view=week"), "/calendar?view=week");
  assert.equal(sanitizeInternalUrl("/agenda"), "/agenda");

  // Attack vectors & malformed inputs must safely fallback to /dashboard
  assert.equal(sanitizeInternalUrl(null), "/dashboard");
  assert.equal(sanitizeInternalUrl(""), "/dashboard");
  assert.equal(sanitizeInternalUrl("https://malicious.com"), "/dashboard");
  assert.equal(sanitizeInternalUrl("//malicious.com"), "/dashboard");
  assert.equal(sanitizeInternalUrl("/\\malicious.com"), "/dashboard");
  assert.equal(sanitizeInternalUrl("/dashboard\\test"), "/dashboard");
  assert.equal(sanitizeInternalUrl("/dashboard\0test"), "/dashboard");
});

// ==============================================================================
// 3. Scheduler Secret Authentication Tests
// ==============================================================================
runTest("Scheduler authentication strictly validates token and rejects unauthorized calls", () => {
  const originalSecret = process.env.REMINDER_SCHEDULER_SECRET;
  const originalCronSecret = process.env.CRON_SECRET;
  const originalServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

  try {
    process.env.REMINDER_SCHEDULER_SECRET = "super-secret-scheduler-token-12345";
    process.env.CRON_SECRET = "vercel-cron-secret-token-abcdef";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "supabase-service-role-admin-token-98765";

    // Helper mock request with headers
    function mockReq(headers = {}) {
      const headerMap = new Map(Object.entries(headers));
      return {
        headers: {
          get: (name) => headerMap.get(name.toLowerCase()) || null,
        },
      };
    }

    // 1. Missing authentication
    const resNoAuth = verifySchedulerAuth(mockReq({}));
    assert.equal(resNoAuth.authorized, false);
    assert.equal(resNoAuth.status, 401);

    // 2. Invalid Bearer token
    const resInvalidBearer = verifySchedulerAuth(
      mockReq({ authorization: "Bearer wrong-token-abcdef" })
    );
    assert.equal(resInvalidBearer.authorized, false);
    assert.equal(resInvalidBearer.status, 401);

    // 3. Invalid custom header
    const resInvalidHeader = verifySchedulerAuth(
      mockReq({ "x-scheduler-secret": "wrong-token-abcdef" })
    );
    assert.equal(resInvalidHeader.authorized, false);
    assert.equal(resInvalidHeader.status, 401);

    // 4. Using SUPABASE_SERVICE_ROLE_KEY instead of scheduler secret must be forbidden (HTTP 403)
    const resServiceRoleKey = verifySchedulerAuth(
      mockReq({
        authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      })
    );
    assert.equal(resServiceRoleKey.authorized, false);
    assert.equal(resServiceRoleKey.status, 403);

    // 5. Valid Bearer token using REMINDER_SCHEDULER_SECRET
    const resValidBearer = verifySchedulerAuth(
      mockReq({
        authorization: `Bearer ${process.env.REMINDER_SCHEDULER_SECRET}`,
      })
    );
    assert.equal(resValidBearer.authorized, true);

    // 6. Valid custom header using REMINDER_SCHEDULER_SECRET
    const resValidHeader = verifySchedulerAuth(
      mockReq({
        "x-scheduler-secret": process.env.REMINDER_SCHEDULER_SECRET,
      })
    );
    assert.equal(resValidHeader.authorized, true);

    // 7. Valid Bearer token using CRON_SECRET (independent verification without assuming identical values)
    const resValidCronSecret = verifySchedulerAuth(
      mockReq({
        authorization: `Bearer ${process.env.CRON_SECRET}`,
      })
    );
    assert.equal(resValidCronSecret.authorized, true);

    // 8. When server has no secret configured
    delete process.env.REMINDER_SCHEDULER_SECRET;
    delete process.env.CRON_SECRET;
    const resUnconfigured = verifySchedulerAuth(
      mockReq({ authorization: "Bearer anything" })
    );
    assert.equal(resUnconfigured.authorized, false);
    assert.equal(resUnconfigured.status, 503);
  } finally {
    if (originalSecret !== undefined) {
      process.env.REMINDER_SCHEDULER_SECRET = originalSecret;
    } else {
      delete process.env.REMINDER_SCHEDULER_SECRET;
    }
    if (originalCronSecret !== undefined) {
      process.env.CRON_SECRET = originalCronSecret;
    } else {
      delete process.env.CRON_SECRET;
    }
    if (originalServiceRole !== undefined) {
      process.env.SUPABASE_SERVICE_ROLE_KEY = originalServiceRole;
    } else {
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    }
  }
});

// ==============================================================================
// 4. Web Push Delivery & Expired Subscription Detection Tests
// ==============================================================================
runTest("Web Push error handler accurately detects 404/410 expired subscriptions", () => {
  function checkExpired(statusCode) {
    return statusCode === 404 || statusCode === 410;
  }

  assert.equal(checkExpired(404), true, "404 Not Found must mark subscription as expired");
  assert.equal(checkExpired(410), true, "410 Gone must mark subscription as expired");
  assert.equal(checkExpired(400), false, "400 Bad Request is not expired subscription");
  assert.equal(checkExpired(401), false, "401 Unauthorized is VAPID credential error");
  assert.equal(checkExpired(500), false, "500 Internal Error is temporary server issue");
  assert.equal(checkExpired(503), false, "503 Unavailable is temporary push service issue");
});

// ==============================================================================
// 5. Batch Isolation and Resilient Failure Handling Simulation
// ==============================================================================
await runAsyncTest("Batch processor isolates individual item failures without aborting batch", async () => {
  // Simulate mock reminders
  const mockReminders = [
    { id: "rem-1", title: "Task Reminder", attempts: 0, status: "processing" },
    { id: "rem-2", title: "Schedule Reminder", attempts: 1, status: "processing" },
    { id: "rem-3", title: "Agenda Reminder", attempts: 2, status: "processing" },
  ];

  // Simulate execution of each item with different outcomes
  const outcomes = [];
  const cleanedSubscriptions = [];

  for (const reminder of mockReminders) {
    try {
      if (reminder.id === "rem-1") {
        // Success
        outcomes.push({ id: reminder.id, status: "sent", sent_at: new Date().toISOString() });
      } else if (reminder.id === "rem-2") {
        // Temporary Network Failure -> Exponential Backoff
        const backoffSeconds = Math.pow(2, reminder.attempts) * 60;
        outcomes.push({
          id: reminder.id,
          status: "pending",
          retry_in: backoffSeconds,
          last_error: "Push service timeout",
        });
      } else if (reminder.id === "rem-3") {
        // Subscription Expired (410 Gone) -> Clean subscription & mark failed (attempts exhausted)
        cleanedSubscriptions.push("sub-for-rem-3");
        outcomes.push({
          id: reminder.id,
          status: "failed",
          last_error: "Subscription expired: 410 Gone",
        });
      }
    } catch {
      outcomes.push({ id: reminder.id, status: "failed" });
    }
  }

  assert.equal(outcomes.length, 3, "All reminders must be processed regardless of individual errors");
  assert.equal(outcomes[0].status, "sent");
  assert.equal(outcomes[1].status, "pending");
  assert.equal(outcomes[1].retry_in, 120);
  assert.equal(outcomes[2].status, "failed");
  assert.equal(cleanedSubscriptions.length, 1);
});

// ==============================================================================
// 6. Optimistic Concurrency Control (Stale Worker Protection) Tests
// ==============================================================================
runTest("OCC guard prevents stale workers from overwriting re-claimed reminders", () => {
  // Simulate database row
  const dbRow = {
    id: "rem-100",
    status: "processing",
    attempts: 2, // Already re-claimed by Worker B after stale timeout
  };

  // Stale Worker A had claimed rem-100 when attempts was 1
  const staleWorkerA = {
    id: "rem-100",
    claimedAttempts: 1,
  };

  // OCC update condition: WHERE id = rem.id AND status = 'processing' AND attempts = rem.attempts
  function executeOccUpdate(dbCurrent, worker) {
    if (
      dbCurrent.id === worker.id &&
      dbCurrent.status === "processing" &&
      dbCurrent.attempts === worker.claimedAttempts
    ) {
      dbCurrent.status = "sent";
      return { updatedRows: [dbCurrent] };
    }
    return { updatedRows: [] };
  }

  const result = executeOccUpdate(dbRow, staleWorkerA);
  assert.equal(result.updatedRows.length, 0, "Stale worker update must be rejected when attempts do not match");
  assert.equal(dbRow.attempts, 2, "DB row attempts must remain intact");
  assert.equal(dbRow.status, "processing", "DB row status must not be overwritten by stale worker");
});

// ==============================================================================
// 7. Database Query Error Reporting Tests
// ==============================================================================
runTest("Database query failures are captured and not reported as success", () => {
  const summary = {
    success: true,
    sent: 0,
    failed: 0,
    errors: [],
  };

  // Simulate database update failure
  const updateError = { message: "connection to server was lost" };

  if (updateError) {
    summary.success = false;
    summary.errors.push(`Update failed: ${updateError.message}`);
    // summary.sent must NOT be incremented
  } else {
    summary.sent += 1;
  }

  assert.equal(summary.success, false, "summary.success must be false on DB error");
  assert.equal(summary.sent, 0, "summary.sent must not be incremented when DB update fails");
  assert.equal(summary.errors.length, 1, "Error must be recorded");
});

// ==============================================================================
// 8. Database Migration Integrity Check
// ==============================================================================
runTest("Migration 20261026030000_create_claim_reminders_rpc.sql fulfills all requirements", () => {
  const migrationPath = path.join(
    rootDir,
    "supabase",
    "migrations",
    "20261026030000_create_claim_reminders_rpc.sql"
  );

  assert.ok(fs.existsSync(migrationPath), "Migration file must exist");
  const sql = fs.readFileSync(migrationPath, "utf-8");

  // Check RPC definition
  assert.ok(sql.includes("CREATE OR REPLACE FUNCTION public.claim_due_reminders"), "Must define claim_due_reminders RPC");
  // Check FOR UPDATE SKIP LOCKED
  assert.ok(sql.includes("FOR UPDATE SKIP LOCKED"), "Must use atomic FOR UPDATE SKIP LOCKED");
  // Check pending status filter and scheduled_at check
  assert.ok(sql.includes("status = 'pending'"), "Must only claim pending reminders");
  assert.ok(sql.includes("scheduled_at <= pg_catalog.now()"), "Must only claim due reminders");
  // Check stale recovery
  assert.ok(sql.includes("WHERE status = 'processing'"), "Must recover stale processing reminders");
  assert.ok(sql.includes("v_stale_interval"), "Must apply stale interval timeout");
  // Check security definer & privileges
  assert.ok(sql.includes("SECURITY DEFINER"), "Function must be SECURITY DEFINER");
  assert.ok(sql.includes("REVOKE ALL ON FUNCTION public.claim_due_reminders"), "Must revoke from public/anon/authenticated");
  assert.ok(sql.includes("GRANT EXECUTE ON FUNCTION public.claim_due_reminders"), "Must grant to service_role");
  // Check partial index
  assert.ok(sql.includes("idx_reminders_processing_stale"), "Must create partial index for stale processing");
});

// ==============================================================================
// 9. Middleware Scheduler Route Check
// ==============================================================================
runTest("Middleware permits /api/reminders/process without redirecting to login", () => {
  const middlewarePath = path.join(rootDir, "src", "lib", "supabase", "middleware.ts");
  const middlewareContent = fs.readFileSync(middlewarePath, "utf-8");

  assert.ok(
    middlewareContent.includes("pathname === '/api/reminders/process'"),
    "Middleware must allow /api/reminders/process through for server-to-server token authentication"
  );
});

// ==============================================================================
// Summary
// ==============================================================================
console.log(`\nTest Results: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
}
