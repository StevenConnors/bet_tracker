import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth-helpers";
import { db } from "@/lib/mongodb";
import type { AppUser } from "@/lib/types";
import { unauthorized } from "@/lib/api";

export async function GET(request: Request) {
  if (!await currentUser()) return unauthorized();
  const email = new URL(request.url).searchParams.get("email")?.trim().toLowerCase();
  if (!email) return NextResponse.json({ error: "Email is required" }, { status: 400 });
  const user = await (await db()).collection<AppUser>("appUsers").findOne({ email }, { projection: { email: 1, name: 1 } });
  return NextResponse.json({ user: user ? { id: user._id.toString(), email: user.email, name: user.name } : null });
}
