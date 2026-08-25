import { NextResponse } from "next/server";
import { z } from "zod";
import { safeNext } from "@/lib/auth/redirect";
import { ensureAppUser } from "@/lib/auth-helpers";
import { needsProfileSetup, profileSetupPath } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
const inputSchema = z.union([
  z.object({ email: z.string().email(), token: z.string().regex(/^\d{6}$/), next: z.string().optional() }),
  z.object({ tokenHash: z.string().min(20).max(2048), type: z.literal("email"), next: z.string().optional() }),
]);
export async function POST(request: Request) {
  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "This sign-in code or link is invalid or has expired." }, { status: 400 });
  const supabase = await createClient();
  const result = "tokenHash" in parsed.data
    ? await supabase.auth.verifyOtp({ token_hash: parsed.data.tokenHash, type: parsed.data.type })
    : await supabase.auth.verifyOtp({ email: parsed.data.email.toLowerCase(), token: parsed.data.token, type: "email" });
  if (result.error) return NextResponse.json({ error: "This sign-in code or link is invalid or has expired." }, { status: 400 });
  const next = safeNext(parsed.data.next);
  const user = result.data.user ? await ensureAppUser(result.data.user) : null;
  return NextResponse.json({ next: user && needsProfileSetup(user) ? profileSetupPath(next) : next });
}
