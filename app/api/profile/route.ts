import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth-helpers";
import { unauthorized } from "@/lib/api";
import { db } from "@/lib/mongodb";
import { isDuplicateKeyError } from "@/lib/identity";
import { profileInputSchema } from "@/lib/profile";
import type { AppUser } from "@/lib/types";

export async function PATCH(request: Request) {
  const user = await currentUser();
  if (!user) return unauthorized();
  const parsed = profileInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Check your visible name and try again." }, { status: 400 });
  }
  try {
    await (await db()).collection<AppUser>("appUsers").updateOne(
      { _id: user._id },
      { $set: { name: parsed.data.name, username: parsed.data.username, onboardingPending: false, updatedAt: new Date() } },
    );
    return NextResponse.json({ user: { id: user._id.toString(), email: user.email, name: parsed.data.name, username: parsed.data.username, role: user.role } });
  } catch (error) {
    if (isDuplicateKeyError(error)) return NextResponse.json({ error: "That username is already taken." }, { status: 409 });
    throw error;
  }
}
