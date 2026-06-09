import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "edge";

function getSafeNextPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}

function decodeCookieValue(value: string | undefined) {
  if (!value) return null;
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const cookieNextPath = decodeCookieValue(request.cookies.get("oauth_next")?.value);
  const nextPath = getSafeNextPath(
    requestUrl.searchParams.get("next") || cookieNextPath,
  );

  if (code) {
    const supabase = createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const response = NextResponse.redirect(new URL(nextPath, request.url));
      response.cookies.delete("oauth_next");
      return response;
    }
  }

  const redirectUrl = new URL("/auth", request.url);
  redirectUrl.searchParams.set("error", "auth_callback_failed");
  redirectUrl.searchParams.set("next", nextPath);
  const response = NextResponse.redirect(redirectUrl);
  response.cookies.delete("oauth_next");
  return response;
}
