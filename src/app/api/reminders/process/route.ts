import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { verifySchedulerAuth } from "@/lib/reminders/auth";
import { processDueReminders, type DeliveryOptions } from "@/lib/reminders/delivery";

const schedulerQuerySchema = z.object({
  batch_size: z.coerce.number().int().min(1).max(50).optional(),
  stale_timeout_minutes: z.coerce.number().int().min(1).max(60).optional(),
  max_attempts: z.coerce.number().int().min(1).max(5).optional(),
});

/**
 * Executes due reminder batch processing.
 */
async function handleProcessRequest(request: NextRequest) {
  const requestReceivedAt = Date.now();
  const requestIso = new Date(requestReceivedAt).toISOString();

  // 1. Verify scheduler authentication
  const authCheck = verifySchedulerAuth(request);
  if (!authCheck.authorized) {
    console.warn(
      `[Reminder Scheduler] Unauthorized access attempt at ${requestIso}: ${authCheck.error}`
    );
    return NextResponse.json(
      { error: authCheck.error },
      { status: authCheck.status || 401 }
    );
  }

  // 2. Parse and validate optional batch parameters from URL search params or JSON body
  const { searchParams } = new URL(request.url);
  const queryParams = {
    batch_size: searchParams.get("batch_size") || undefined,
    stale_timeout_minutes: searchParams.get("stale_timeout_minutes") || undefined,
    max_attempts: searchParams.get("max_attempts") || undefined,
  };

  let bodyParams: Record<string, unknown> = {};
  if (request.method === "POST") {
    try {
      const parsedBody = await request.json();
      if (parsedBody && typeof parsedBody === "object") {
        bodyParams = parsedBody as Record<string, unknown>;
      }
    } catch {
      // Body is optional; continue with query params if body is not JSON
    }
  }

  const rawOptions = {
    batch_size: bodyParams.batch_size ?? queryParams.batch_size,
    stale_timeout_minutes: bodyParams.stale_timeout_minutes ?? queryParams.stale_timeout_minutes,
    max_attempts: bodyParams.max_attempts ?? queryParams.max_attempts,
  };

  const validation = schedulerQuerySchema.safeParse(rawOptions);
  if (!validation.success) {
    return NextResponse.json(
      {
        error: "Parameter scheduler tidak valid.",
        details: validation.error.issues.map((i) => i.message),
      },
      { status: 400 }
    );
  }

  const options: DeliveryOptions = {
    batchSize: validation.data.batch_size,
    staleTimeoutMinutes: validation.data.stale_timeout_minutes,
    maxAttempts: validation.data.max_attempts,
    requestReceivedAt,
  };

  // 3. Trigger delivery engine batch execution
  const summary = await processDueReminders(options);
  const totalDurationMs = Date.now() - requestReceivedAt;

  console.log(
    `[Reminder Scheduler] Batch executed in ${totalDurationMs}ms (received_at: ${requestIso}): ` +
    `claimed=${summary.claimed}, sent=${summary.sent}, failed=${summary.failed}, retried=${summary.retried}`
  );

  return NextResponse.json(
    {
      success: summary.success,
      timestamp: new Date().toISOString(),
      summary: {
        claimed: summary.claimed,
        sent: summary.sent,
        failed: summary.failed,
        retried: summary.retried,
        cleaned_subscriptions: summary.cleanedSubscriptions,
      },
      errors: summary.errors.length > 0 ? summary.errors : undefined,
    },
    {
      status: summary.success ? 200 : 500,
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    }
  );
}

/**
 * POST /api/reminders/process
 * Internal scheduler endpoint to claim and process due reminders.
 */
export async function POST(request: NextRequest) {
  return handleProcessRequest(request);
}

/**
 * GET /api/reminders/process
 * Supports external HTTP cron providers (e.g. Vercel Cron, Uptime monitors)
 * that trigger scheduled jobs via GET requests.
 */
export async function GET(request: NextRequest) {
  return handleProcessRequest(request);
}
