import { createClient as createAdminClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

const inputSchema = z.object({ email: z.string().email() });

export async function POST(request: Request) {
  const expectedSecret = process.env.E2E_AUTH_SECRET;
  if (process.env.NODE_ENV === "production" || !expectedSecret || request.headers.get("x-e2e-auth-secret") !== expectedSecret) {
    return new NextResponse(null, { status: 404 });
  }

  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!parsed.success || !serviceRoleKey) return new NextResponse(null, { status: 400 });

  const { url } = supabaseConfig();
  const admin = createAdminClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const email = parsed.data.email.toLowerCase();
  const created = await admin.auth.admin.createUser({ email, email_confirm: true });
  const existingUser = created.error && ["email_exists", "user_already_exists"].includes(created.error.code || "");
  if (created.error && !existingUser) return new NextResponse(null, { status: 400 });
  const generated = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (generated.error) return new NextResponse(null, { status: 400 });

  const supabase = await createClient();
  const verified = await supabase.auth.verifyOtp({ token_hash: generated.data.properties.hashed_token, type: "magiclink" });
  return new NextResponse(null, { status: verified.error ? 400 : 204 });
}
