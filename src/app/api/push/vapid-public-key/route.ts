import { NextResponse } from "next/server";

/**
 * GET /api/push/vapid-public-key
 * Returns the VAPID Public Key needed by the browser to subscribe to Web Push notifications.
 * Never exposes the VAPID private key.
 */
export async function GET() {
  const publicKey =
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim() ||
    process.env.VAPID_PUBLIC_KEY?.trim() ||
    null;

  const isConfigured = Boolean(
    publicKey &&
    publicKey !== "your-vapid-public-key" &&
    publicKey.length > 20
  );

  return NextResponse.json(
    {
      publicKey: isConfigured ? publicKey : null,
      isConfigured,
    },
    {
      headers: {
        "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
      },
    }
  );
}
