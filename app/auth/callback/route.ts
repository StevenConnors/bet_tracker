import { NextResponse } from "next/server";
import { safeNext } from "@/lib/auth/redirect";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = safeNext(requestUrl.searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, requestUrl.origin), 303);
  }

  const login = new URL("/login", requestUrl.origin);
  login.searchParams.set("error", "oauth");
  if (next !== "/") login.searchParams.set("next", next);
  return NextResponse.redirect(login, 303);
}
