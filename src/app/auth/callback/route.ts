import { NextResponse } from "next/server";
import { type EmailOtpType } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { sanitizeRedirectUrl } from "@/lib/utils";
import { getRequestOrigin } from "@/lib/auth-url";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const token_hash = requestUrl.searchParams.get("token_hash");
  const type = requestUrl.searchParams.get("type") as EmailOtpType | null;
  const authError = requestUrl.searchParams.get("error");
  const rawNext = requestUrl.searchParams.get("next");
  const safeNext = sanitizeRedirectUrl(rawNext, "/dashboard");
  const baseOrigin = getRequestOrigin(request);

  // 1. Explicit error from Supabase Auth verify endpoint (e.g. otp_expired, access_denied)
  // Verification TRULY failed at the Supabase server level.
  if (authError) {
    const errorRedirectUrl = new URL("/login?error=auth-code-error", baseOrigin);
    return NextResponse.redirect(errorRedirectUrl);
  }

  const supabase = await createServerClient();

  if (supabase) {
    // 2. Check if user already has an active session
    // (e.g. callback was already processed by a concurrent request, prefetch, or prior exchange)
    const {
      data: { user: existingUser },
    } = await supabase.auth.getUser();

    if (existingUser) {
      const redirectUrl = new URL(safeNext, baseOrigin);
      return NextResponse.redirect(redirectUrl);
    }

    // 3. PKCE Code Exchange flow
    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) {
        const redirectUrl = new URL(safeNext, baseOrigin);
        return NextResponse.redirect(redirectUrl);
      }

      // If exchange returned an error (e.g. single-use code was already consumed by a link scanner,
      // prefetcher, or duplicate browser invocation), re-check if user session is established in cookie store
      const {
        data: { user: sessionUser },
      } = await supabase.auth.getUser();

      if (sessionUser) {
        const redirectUrl = new URL(safeNext, baseOrigin);
        return NextResponse.redirect(redirectUrl);
      }

      // If code exchange failed without an active session (e.g. cross-device click or missing PKCE code_verifier),
      // the verification on Supabase server succeeded (since authError was null), but credentials
      // are needed to sign in on this specific browser. Redirect to /login with verified=true rather than false error!
      const verifiedRedirectUrl = new URL("/login?verified=true", baseOrigin);
      return NextResponse.redirect(verifiedRedirectUrl);
    }

    // 4. Token Hash / OTP verification flow (e.g. signup confirmation)
    if (token_hash && type) {
      const { error } = await supabase.auth.verifyOtp({
        type,
        token_hash,
      });
      if (!error) {
        const redirectUrl = new URL(safeNext, baseOrigin);
        return NextResponse.redirect(redirectUrl);
      }

      const {
        data: { user: sessionUser },
      } = await supabase.auth.getUser();

      if (sessionUser) {
        const redirectUrl = new URL(safeNext, baseOrigin);
        return NextResponse.redirect(redirectUrl);
      }

      const errorRedirectUrl = new URL("/login?error=auth-code-error", baseOrigin);
      return NextResponse.redirect(errorRedirectUrl);
    }
  }

  // 5. Fallback for unauthenticated access to callback without tokens
  const fallbackUrl = new URL("/login", baseOrigin);
  return NextResponse.redirect(fallbackUrl);
}
