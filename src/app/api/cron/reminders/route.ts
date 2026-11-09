import { type NextRequest } from "next/server";
import { handleProcessRequest } from "@/app/api/reminders/process/route";

/**
 * GET /api/cron/reminders
 * Triggered by external HTTP cron services (e.g. cron-job.org, Vercel Cron, Uptime monitors)
 * that execute scheduled jobs via GET requests.
 *
 * Protected by verifySchedulerAuth (checks CRON_SECRET or REMINDER_SCHEDULER_SECRET).
 */
export async function GET(request: NextRequest) {
  return handleProcessRequest(request);
}

/**
 * POST /api/cron/reminders
 * Supports POST cron triggers with optional JSON body parameters.
 */
export async function POST(request: NextRequest) {
  return handleProcessRequest(request);
}

/**
 * HEAD /api/cron/reminders
 * Supports connectivity check by monitoring or cron services without executing a batch.
 */
export async function HEAD() {
  return new Response(null, {
    status: 200,
    headers: {
      "Cache-Control": "no-store, max-age=0",
    },
  });
}

