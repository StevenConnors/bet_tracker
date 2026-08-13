import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { z } from "zod";
import { currentUser } from "@/lib/auth-helpers";
import { db } from "@/lib/mongodb";
import type { Activity, AppUser, Bet } from "@/lib/types";
import { apiError, forbidden, unauthorized } from "@/lib/api";
export async function GET() { const user = await currentUser(); if (!user) return unauthorized(); if (user.role !== "admin") return forbidden(); const database = await db(); return NextResponse.json({ users: await database.collection<AppUser>("appUsers").find().sort({ createdAt: -1 }).toArray(), bets: await database.collection<Bet>("bets").find().sort({ updatedAt: -1 }).limit(100).toArray() }); }
const schema = z.object({ userId: z.string(), role: z.enum(["user", "admin"]) });
export async function PATCH(request: Request) { try { const admin = await currentUser(); if (!admin) return unauthorized(); if (admin.role !== "admin") return forbidden(); const input = schema.parse(await request.json()); const database = await db(); const targetId = new ObjectId(input.userId); if (targetId.equals(admin._id) && input.role !== "admin") return NextResponse.json({ error: "You cannot remove your own admin access" }, { status: 409 }); await database.collection<AppUser>("appUsers").updateOne({ _id: targetId }, { $set: { role: input.role } }); await database.collection<Activity>("activities").insertOne({ _id: new ObjectId(), actorId: admin._id, recipientIds: [targetId], type: "admin_action", message: `${admin.email} changed a user role to ${input.role}.`, createdAt: new Date() }); return NextResponse.json({ ok: true }); } catch (error) { return apiError(error); } }
