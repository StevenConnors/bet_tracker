import { NextResponse } from "next/server";
import { ensureAppUser } from "@/lib/auth-helpers";
import { safeNext } from "@/lib/auth/redirect";
import { needsProfileSetup, profileSetupPath } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = safeNext(requestUrl.searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const user = data.user ? await ensureAppUser(data.user) : null;
      const destination = user && needsProfileSetup(user) ? profileSetupPath(next) : next;
      return NextResponse.redirect(new URL(destination, requestUrl.origin), 303);
    }
  }

  const login = new URL("/login", requestUrl.origin);
  login.searchParams.set("error", "oauth");
  if (next !== "/") login.searchParams.set("next", next);
  return NextResponse.redirect(login, 303);
}
