import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth-helpers";
import { db } from "@/lib/mongodb";
import type { Activity } from "@/lib/types";
import { unauthorized } from "@/lib/api";
export async function GET() {
  const user = await currentUser(); if (!user) return unauthorized();
  const items = await (await db()).collection<Activity>("activities").find(user.role === "admin" ? {} : { $or: [{ recipientIds: user._id }, { recipientEmails: user.email }] }).sort({ createdAt: -1 }).limit(20).toArray();
  return NextResponse.json({ activities: items.map(a => ({ ...a, _id: a._id.toString(), betId: a.betId?.toString(), createdAt: a.createdAt.toISOString() })) });
}
