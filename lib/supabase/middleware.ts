import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseConfig } from "./config";
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request }); const { url, key } = supabaseConfig();
  const supabase = createServerClient(url, key, { cookies: { getAll: () => request.cookies.getAll(), setAll: (items) => {
    items.forEach(({ name, value }) => request.cookies.set(name, value)); response = NextResponse.next({ request });
    items.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
  } } });
  await supabase.auth.getUser(); return response;
}
