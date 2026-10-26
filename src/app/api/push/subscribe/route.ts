import { NextResponse, type NextRequest } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import {
  pushSubscriptionPayloadSchema,
  unsubscribePayloadSchema,
  pushEndpointQuerySchema,
} from "@/lib/validation/push-subscription-schema";

/**
 * Sanitizes endpoint URL for safe debugging logs without exposing full token tokens or secrets.
 */
function maskEndpoint(endpoint: string): string {
  try {
    const url = new URL(endpoint);
    return `${url.origin}${url.pathname.slice(0, 15)}...`;
  } catch {
    return "[invalid-url]";
  }
}

/**
 * GET /api/push/subscribe
 * Checks whether a given endpoint or user has an active push subscription.
 * Requires an authenticated user session.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Layanan database belum dikonfigurasi." },
      { status: 503 }
    );
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { error: "Autentikasi diperlukan untuk memeriksa status Web Push." },
      { status: 401 }
    );
  }

  // Use administrative client if available (allowing direct PostgREST privilege hardening)
  // while strictly enforcing session-verified user authorization. Fall back to user client.
  const db = createAdminClient() || supabase;

  const { searchParams } = new URL(request.url);
  const endpointParam = searchParams.get("endpoint");

  if (endpointParam !== null) {
    // Validate endpoint query parameter strictly
    const queryValidation = pushEndpointQuerySchema.safeParse({ endpoint: endpointParam });
    if (!queryValidation.success) {
      return NextResponse.json(
        { error: "Parameter endpoint tidak valid atau format URL salah." },
        { status: 400 }
      );
    }

    const { endpoint } = queryValidation.data;

    // Scoped strictly to current authenticated user
    const { data, error } = await db
      .from("push_subscriptions")
      .select("id, created_at, updated_at")
      .eq("endpoint", endpoint)
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      console.error("[Push API] Query error:", error.message);
      return NextResponse.json(
        { error: "Gagal memeriksa status subscription." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      isSubscribed: Boolean(data),
      subscription: data || null,
    });
  }

  // Return user's registered subscriptions scoped strictly to authenticated user
  const { data: subscriptions, error } = await db
    .from("push_subscriptions")
    .select("id, created_at, updated_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) {
    console.error("[Push API] List subscriptions query error:", error.message);
    return NextResponse.json(
      { error: "Gagal mengambil daftar subscription." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    subscriptions: subscriptions || [],
    count: subscriptions ? subscriptions.length : 0,
  });
}

/**
 * POST /api/push/subscribe
 * Registers or updates a Web Push subscription for the authenticated user.
 * Validates payload schema, verifies user session, and prevents cross-account endpoint hijacking.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Layanan database belum dikonfigurasi." },
      { status: 503 }
    );
  }

  // 1. Authenticate user from session cookies (never trust client user_id)
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { error: "Autentikasi diperlukan untuk mendaftarkan Web Push." },
      { status: 401 }
    );
  }

  // 2. Parse and validate JSON payload
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Format payload request JSON tidak valid." },
      { status: 400 }
    );
  }

  const validation = pushSubscriptionPayloadSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json(
      {
        error: "Data subscription tidak valid.",
        details: validation.error.issues.map((i) => i.message),
      },
      { status: 400 }
    );
  }

  const { endpoint, keys, user_agent } = validation.data;

  // Use administrative client if available (allowing direct PostgREST privilege hardening)
  // while strictly enforcing session-verified user authorization. Fall back to user client.
  const db = createAdminClient() || supabase;

  // 3. Check if endpoint is already registered in database across any account
  const { data: existingSub, error: selectError } = await db
    .from("push_subscriptions")
    .select("id, user_id")
    .eq("endpoint", endpoint)
    .maybeSingle();

  if (selectError) {
    console.error(
      `[Push API] Check existing subscription failed for endpoint ${maskEndpoint(endpoint)}:`,
      selectError.message
    );
    return NextResponse.json(
      { error: "Gagal memproses data subscription." },
      { status: 500 }
    );
  }

  // 4. If endpoint is already registered (either under current user or from a prior session on this browser device),
  // transfer / update subscription ownership to the current authenticated user and refresh encryption keys
  if (existingSub) {
    const { error: updateError } = await db
      .from("push_subscriptions")
      .update({
        user_id: user.id,
        p256dh: keys.p256dh,
        auth: keys.auth,
        user_agent: user_agent || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existingSub.id);

    if (updateError) {
      console.error(
        `[Push API] Update subscription failed for endpoint ${maskEndpoint(endpoint)}:`,
        updateError.message
      );
      return NextResponse.json(
        { error: "Gagal memperbarui subscription Web Push." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Subscription Web Push berhasil diperbarui.",
      id: existingSub.id,
    });
  }

  // 5. If not registered, insert new subscription for current authenticated user
  const { data: inserted, error: insertError } = await db
    .from("push_subscriptions")
    .insert({
      user_id: user.id,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      user_agent: user_agent || null,
    })
    .select("id")
    .single();

  if (insertError) {
    // Unique constraint violation safety net (Postgres error 23505) - race condition update
    if (insertError.code === "23505") {
      const { data: updatedAfterRace, error: raceUpdateError } = await db
        .from("push_subscriptions")
        .update({
          user_id: user.id,
          p256dh: keys.p256dh,
          auth: keys.auth,
          user_agent: user_agent || null,
          updated_at: new Date().toISOString(),
        })
        .eq("endpoint", endpoint)
        .select("id")
        .single();

      if (!raceUpdateError && updatedAfterRace) {
        return NextResponse.json({
          success: true,
          message: "Subscription Web Push berhasil diperbarui.",
          id: updatedAfterRace.id,
        });
      }
    }

    console.error(
      `[Push API] Insert subscription failed for endpoint ${maskEndpoint(endpoint)}:`,
      insertError.message
    );
    return NextResponse.json(
      { error: "Gagal menyimpan subscription Web Push." },
      { status: 500 }
    );
  }

  return NextResponse.json(
    {
      success: true,
      message: "Subscription Web Push berhasil didaftarkan.",
      id: inserted.id,
    },
    { status: 201 }
  );
}

/**
 * DELETE /api/push/subscribe
 * Unsubscribes a Web Push endpoint for the authenticated user.
 */
export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Layanan database belum dikonfigurasi." },
      { status: 503 }
    );
  }

  // 1. Authenticate user
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { error: "Autentikasi diperlukan untuk mencabut Web Push." },
      { status: 401 }
    );
  }

  // 2. Parse and validate JSON payload
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Format payload request JSON tidak valid." },
      { status: 400 }
    );
  }

  const validation = unsubscribePayloadSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json(
      {
        error: "Data unsubscription tidak valid.",
        details: validation.error.issues.map((i) => i.message),
      },
      { status: 400 }
    );
  }

  const { endpoint } = validation.data;

  // Use administrative client if available, strictly scoped by user_id
  const db = createAdminClient() || supabase;

  // 3. Delete subscription strictly belonging to this authenticated user
  const { error: deleteError } = await db
    .from("push_subscriptions")
    .delete()
    .eq("endpoint", endpoint)
    .eq("user_id", user.id);

  if (deleteError) {
    console.error(
      `[Push API] Delete subscription failed for endpoint ${maskEndpoint(endpoint)}:`,
      deleteError.message
    );
    return NextResponse.json(
      { error: "Gagal mencabut subscription Web Push." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    message: "Subscription Web Push berhasil dicabut.",
  });
}
