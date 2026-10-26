/**
 * Noctis Reminder Delivery Engine
 * Orchestrates atomic claiming of due reminders, Web Push dispatching,
 * exponential backoff retries, stale job recovery, and subscription cleanup.
 */

import { createAdminClient } from "../supabase/server";
import {
  sendWebPushNotification,
  type PushSubscriptionKeys,
} from "../push/send";
import type { ReminderRecord } from "../supabase/reminders";

export interface DeliveryOptions {
  batchSize?: number;
  staleTimeoutMinutes?: number;
  maxAttempts?: number;
}

export interface DeliverySummary {
  success: boolean;
  claimed: number;
  sent: number;
  failed: number;
  retried: number;
  cleanedSubscriptions: number;
  errors: string[];
}

/**
 * Calculates exponential backoff in seconds based on current attempt number.
 * Attempt 1: 120s (2m), Attempt 2: 240s (4m), Attempt 3: 480s (8m), capped at 3600s (1h).
 */
export function calculateBackoffDelaySeconds(attempts: number): number {
  const safeAttempts = Math.max(1, attempts);
  const baseSeconds = Math.pow(2, safeAttempts) * 60;
  return Math.min(baseSeconds, 3600);
}

/**
 * Maps source_type to a safe, validated internal application route.
 */
export function getSourceInternalUrl(sourceType: string): string {
  switch (sourceType) {
    case "task":
      return "/tasks";
    case "course_schedule":
      return "/calendar";
    case "agenda_event":
      return "/agenda";
    default:
      return "/dashboard";
  }
}

/**
 * Processes due reminders in a safe, atomic batch.
 * Guarantees worker concurrency isolation, optimistic concurrency protection
 * against stale worker overwrites, and per-reminder failure containment.
 */
export async function processDueReminders(
  options: DeliveryOptions = {}
): Promise<DeliverySummary> {
  const batchSize = Math.min(Math.max(options.batchSize ?? 20, 1), 50);
  const staleTimeoutMinutes = Math.min(Math.max(options.staleTimeoutMinutes ?? 5, 1), 60);
  const maxAttempts = Math.min(Math.max(options.maxAttempts ?? 3, 1), 5);

  const summary: DeliverySummary = {
    success: true,
    claimed: 0,
    sent: 0,
    failed: 0,
    retried: 0,
    cleanedSubscriptions: 0,
    errors: [],
  };

  const adminClient = createAdminClient();
  if (!adminClient) {
    const errorMsg =
      "Supabase admin client (SUPABASE_SERVICE_ROLE_KEY) belum dikonfigurasi.";
    summary.success = false;
    summary.errors.push(errorMsg);
    return summary;
  }

  // 1. Atomically claim due reminders via PostgreSQL RPC
  let claimedReminders: ReminderRecord[] = [];

  const { data: rpcData, error: rpcError } = await adminClient.rpc(
    "claim_due_reminders",
    {
      p_batch_size: batchSize,
      p_stale_timeout_minutes: staleTimeoutMinutes,
      p_max_attempts: maxAttempts,
    }
  );

  if (rpcError) {
    // If the stored procedure does not exist yet (e.g. pending database migration),
    // provide a graceful, defensive fallback using standard queries.
    console.warn(
      "[Reminder Delivery] RPC claim_due_reminders failed, falling back to defensive query:",
      rpcError.message
    );

    const nowIso = new Date().toISOString();
    const staleCutoff = new Date(
      Date.now() - staleTimeoutMinutes * 60 * 1000
    ).toISOString();

    // Fallback stale recovery
    await adminClient
      .from("reminders")
      .update({
        status: "pending",
        last_error: "Stale processing timeout: worker died or stalled",
        updated_at: nowIso,
      })
      .eq("status", "processing")
      .lt("updated_at", staleCutoff)
      .lt("attempts", maxAttempts);

    // Fallback fetch pending due reminders
    const { data: fallbackData, error: fallbackError } = await adminClient
      .from("reminders")
      .select("*")
      .eq("status", "pending")
      .lte("scheduled_at", nowIso)
      .lt("attempts", maxAttempts)
      .order("scheduled_at", { ascending: true })
      .limit(batchSize);

    if (fallbackError || !fallbackData || fallbackData.length === 0) {
      if (fallbackError) {
        summary.success = false;
        summary.errors.push(fallbackError.message);
      }
      return summary;
    }

    // Mark claimed items as processing
    const ids = fallbackData.map((r: ReminderRecord) => r.id);
    const { error: markError } = await adminClient
      .from("reminders")
      .update({
        status: "processing",
        updated_at: nowIso,
      })
      .in("id", ids);

    if (markError) {
      summary.success = false;
      summary.errors.push(`Gagal mengklaim fallback reminders: ${markError.message}`);
      return summary;
    }

    claimedReminders = fallbackData as ReminderRecord[];
  } else if (rpcData && Array.isArray(rpcData)) {
    claimedReminders = rpcData as ReminderRecord[];
  }

  summary.claimed = claimedReminders.length;
  if (claimedReminders.length === 0) {
    return summary;
  }

  // 2. Process each claimed reminder in isolation
  for (const reminder of claimedReminders) {
    try {
      // 2.1 Retrieve active push subscriptions for the user
      interface SubRow {
        id: string;
        endpoint: string;
        p256dh: string;
        auth: string;
      }

      const { data: subscriptions, error: subError } = await adminClient
        .from("push_subscriptions")
        .select("id, endpoint, p256dh, auth")
        .eq("user_id", reminder.user_id);

      if (subError) {
        throw new Error(`Gagal mengambil subscription: ${subError.message}`);
      }

      const activeSubs = (subscriptions as SubRow[]) || [];

      // Terminal behavior: If user has zero active push subscriptions, permanently mark 'failed'
      if (activeSubs.length === 0) {
        const errorMsg = "Tidak ada Web Push subscription aktif untuk pengguna ini.";
        const { data: updatedRows, error: updateError } = await adminClient
          .from("reminders")
          .update({
            status: "failed",
            last_error: errorMsg,
            updated_at: new Date().toISOString(),
          })
          .eq("id", reminder.id)
          .eq("status", "processing")
          .eq("attempts", reminder.attempts)
          .select("id");

        if (updateError) {
          summary.success = false;
          summary.errors.push(
            `Gagal memperbarui reminder ${reminder.id} tanpa subscription: ${updateError.message}`
          );
        } else if (updatedRows && updatedRows.length > 0) {
          summary.failed += 1;
          summary.errors.push(`Reminder ${reminder.id}: ${errorMsg}`);
        } else {
          console.warn(
            `[Reminder Delivery] Reminder ${reminder.id} sudah diambil alih oleh worker lain, abaikan update.`
          );
        }
        continue;
      }

      // 2.2 Assemble notification payload
      const internalUrl = getSourceInternalUrl(reminder.source_type);
      const payload = {
        title: reminder.title,
        body: reminder.body || "",
        url: internalUrl,
        tag: `noctis-reminder-${reminder.id}`,
        data: {
          reminder_id: reminder.id,
          source_type: reminder.source_type,
          source_id: reminder.source_id,
        },
      };

      // 2.3 Dispatch to all user subscriptions
      const sendPromises = activeSubs.map(async (sub) => {
        const keys: PushSubscriptionKeys = {
          endpoint: sub.endpoint,
          p256dh: sub.p256dh,
          auth: sub.auth,
        };
        const result = await sendWebPushNotification(keys, payload);
        return { subId: sub.id, endpoint: sub.endpoint, result };
      });

      const settledResults = await Promise.allSettled(sendPromises);

      let successCount = 0;
      const errorDetails: string[] = [];
      const expiredSubIds: string[] = [];

      for (const item of settledResults) {
        if (item.status === "fulfilled") {
          const { subId, result } = item.value;
          if (result.success) {
            successCount += 1;
          } else {
            if (result.isExpired) {
              expiredSubIds.push(subId);
            }
            if (result.error) {
              errorDetails.push(result.error);
            }
          }
        } else {
          errorDetails.push(item.reason?.message || "Delivery rejected");
        }
      }

      // 2.4 Clean up expired / revoked subscriptions (HTTP 404 or 410)
      if (expiredSubIds.length > 0) {
        const { error: delError } = await adminClient
          .from("push_subscriptions")
          .delete()
          .in("id", expiredSubIds);

        if (!delError) {
          summary.cleanedSubscriptions += expiredSubIds.length;
        } else {
          console.warn("[Reminder Delivery] Failed cleaning expired subscriptions:", delError.message);
        }
      }

      // 2.5 Evaluate delivery outcome with Optimistic Concurrency Control (OCC)
      const nowIso = new Date().toISOString();

      if (successCount > 0) {
        // At least one subscription received the notification -> update to 'sent'
        const { data: updatedRows, error: updateError } = await adminClient
          .from("reminders")
          .update({
            status: "sent",
            sent_at: nowIso,
            last_error: null,
            updated_at: nowIso,
          })
          .eq("id", reminder.id)
          .eq("status", "processing")
          .eq("attempts", reminder.attempts)
          .select("id");

        if (updateError) {
          summary.success = false;
          summary.errors.push(
            `Gagal memperbarui status sent untuk reminder ${reminder.id}: ${updateError.message}`
          );
        } else if (!updatedRows || updatedRows.length === 0) {
          // Worker was superseded by another worker after stale recovery
          const warnMsg = `Reminder ${reminder.id} tidak diubah menjadi sent karena sudah diklaim ulang oleh worker lain.`;
          console.warn("[Reminder Delivery]", warnMsg);
          summary.errors.push(warnMsg);
        } else {
          summary.sent += 1;
        }
      } else {
        // All endpoints failed
        const summarizedError =
          errorDetails.join("; ") || "Gagal mengirim notifikasi ke semua subscription.";

        if (reminder.attempts >= maxAttempts) {
          // Max attempts exhausted -> mark terminal 'failed'
          const { data: updatedRows, error: updateError } = await adminClient
            .from("reminders")
            .update({
              status: "failed",
              last_error: summarizedError,
              updated_at: nowIso,
            })
            .eq("id", reminder.id)
            .eq("status", "processing")
            .eq("attempts", reminder.attempts)
            .select("id");

          if (updateError) {
            summary.success = false;
            summary.errors.push(
              `Gagal memperbarui status failed untuk reminder ${reminder.id}: ${updateError.message}`
            );
          } else if (updatedRows && updatedRows.length > 0) {
            summary.failed += 1;
            summary.errors.push(`Reminder ${reminder.id} (failed permanently): ${summarizedError}`);
          }
        } else {
          // Retry with exponential backoff -> return to 'pending'
          const backoffSeconds = calculateBackoffDelaySeconds(reminder.attempts);
          const nextScheduledAt = new Date(Date.now() + backoffSeconds * 1000).toISOString();

          const { data: updatedRows, error: updateError } = await adminClient
            .from("reminders")
            .update({
              status: "pending",
              scheduled_at: nextScheduledAt,
              last_error: summarizedError,
              updated_at: nowIso,
            })
            .eq("id", reminder.id)
            .eq("status", "processing")
            .eq("attempts", reminder.attempts)
            .select("id");

          if (updateError) {
            summary.success = false;
            summary.errors.push(
              `Gagal memperbarui status retry pending untuk reminder ${reminder.id}: ${updateError.message}`
            );
          } else if (updatedRows && updatedRows.length > 0) {
            summary.retried += 1;
          }
        }
      }
    } catch (err) {
      // Isolate unexpected per-reminder errors so the batch continues
      const errorMsg =
        err instanceof Error ? err.message : "Kesalahan tak terduga saat memproses reminder.";

      summary.failed += 1;
      summary.errors.push(`Reminder ${reminder.id}: ${errorMsg}`);

      // Gracefully record error with OCC guard
      try {
        await adminClient
          .from("reminders")
          .update({
            status: reminder.attempts >= maxAttempts ? "failed" : "pending",
            last_error: errorMsg,
            updated_at: new Date().toISOString(),
          })
          .eq("id", reminder.id)
          .eq("status", "processing")
          .eq("attempts", reminder.attempts);
      } catch (updateErr) {
        console.error("[Reminder Delivery] Failed recording error for reminder:", updateErr);
      }
    }
  }

  return summary;
}
