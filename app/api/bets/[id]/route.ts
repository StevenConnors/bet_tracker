import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { z } from "zod";
import { currentUser } from "@/lib/auth-helpers";
import { canReadBet } from "@/lib/bets";
import { db } from "@/lib/mongodb";
import type { Activity, Bet } from "@/lib/types";
import { apiError, forbidden, unauthorized } from "@/lib/api";
const patchSchema = z.object({ condition: z.string().trim().min(3).max(600).optional(), wager: z.string().trim().min(2).max(300).optional(), deadline: z.string().datetime().optional(), status: z.enum(["completed", "cancelled", "unresolved"]).optional(), resolutionNote: z.string().trim().max(600).optional() });
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser(); if (!user) return unauthorized(); const value = (await params).id; if (!ObjectId.isValid(value)) return NextResponse.json({ error: "Not found" }, { status: 404 }); const betId = new ObjectId(value); const database = await db();
  const bet = await database.collection<Bet>("bets").findOne({ _id: betId }); if (!bet) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canReadBet(user, bet)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const activity = await database.collection<Activity>("activities").find({ betId }).sort({ createdAt: -1 }).toArray();
  return NextResponse.json({ bet, activity });
}
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
 try { const user = await currentUser(); if (!user) return unauthorized(); const value = (await params).id; if (!ObjectId.isValid(value)) return NextResponse.json({ error: "Not found" }, { status: 404 }); const betId = new ObjectId(value); const database = await db(); const bet = await database.collection<Bet>("bets").findOne({ _id: betId }); if (!bet) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (user.role !== "admin" && !bet.creatorId.equals(user._id)) return forbidden(); if (bet.status !== "open" && user.role !== "admin") return NextResponse.json({ error: "Closed bets cannot be changed" }, { status: 409 });
  const input = patchSchema.parse(await request.json()); if (!Object.keys(input).length) return NextResponse.json({ error: "No changes supplied" }, { status: 400 });
  const now = new Date(); const { deadline, ...changes } = input; const update = await database.collection<Bet>("bets").updateOne({ _id: betId, ...(user.role === "admin" ? {} : { status: "open" }) }, { $set: { ...changes, ...(deadline ? { deadline: new Date(deadline) } : {}), updatedAt: now } });
  if (!update.matchedCount) return NextResponse.json({ error: "Closed bets cannot be changed" }, { status: 409 });
  const action = input.status ?? "edited"; await database.collection<Activity>("activities").insertOne({ _id: new ObjectId(), betId, actorId: user._id, recipientIds: bet.participantIds, recipientEmails: bet.participantEmails, type: action, message: `${user.name || user.email} ${action === "edited" ? "updated this bet" : `marked this bet ${action}`}.`, createdAt: now });
  return NextResponse.json({ ok: true });
 } catch (error) { return apiError(error); }
}
