import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { sanitizeRedirectUrl } from "@/lib/utils";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const rawNext = requestUrl.searchParams.get("next");
  const safeNext = sanitizeRedirectUrl(rawNext, "/dashboard");

  if (code) {
    const supabase = await createServerClient();
    if (supabase) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) {
        const redirectUrl = new URL(safeNext, requestUrl.origin);
        return NextResponse.redirect(redirectUrl);
      }
    }
  }

  // Redirect to login with error indicator if code exchange fails
  const errorRedirectUrl = new URL("/login?error=auth-code-error", requestUrl.origin);
  return NextResponse.redirect(errorRedirectUrl);
}
