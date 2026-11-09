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

  // If Supabase redirected with an explicit error (e.g. otp expired)
  if (authError) {
    const errorRedirectUrl = new URL("/login?error=auth-code-error", baseOrigin);
    return NextResponse.redirect(errorRedirectUrl);
  }

  const supabase = await createServerClient();

  if (supabase) {
    // 1. PKCE Code Exchange flow
    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) {
        const redirectUrl = new URL(safeNext, baseOrigin);
        return NextResponse.redirect(redirectUrl);
      }
    }

    // 2. Token Hash / OTP verification flow (e.g. signup confirmation)
    if (token_hash && type) {
      const { error } = await supabase.auth.verifyOtp({
        type,
        token_hash,
      });
      if (!error) {
        const redirectUrl = new URL(safeNext, baseOrigin);
        return NextResponse.redirect(redirectUrl);
      }
    }
  }

  // Redirect to login with error indicator if code exchange or token verification fails
  const errorRedirectUrl = new URL("/login?error=auth-code-error", baseOrigin);
  return NextResponse.redirect(errorRedirectUrl);
}
