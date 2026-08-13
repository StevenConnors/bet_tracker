import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { z } from "zod";
import { currentUser } from "@/lib/auth-helpers";
import { db } from "@/lib/mongodb";
import type { Activity, AppUser, Bet } from "@/lib/types";
import { apiError, unauthorized } from "@/lib/api";

const createSchema = z.object({ condition: z.string().trim().min(3).max(600), wager: z.string().trim().min(2).max(300), deadline: z.string().datetime(), participantEmails: z.array(z.string().email()).min(1).max(20) });
export async function GET() {
  const user = await currentUser(); if (!user) return unauthorized();
  const database = await db();
  const query = user.role === "admin" ? {} : { participantIds: user._id };
  const bets = await database.collection<Bet>("bets").find(query).sort({ deadline: 1 }).toArray();
  const ids = [...new Set(bets.flatMap(b => b.participantIds.map(String)).concat(bets.map(b => String(b.creatorId))))].map(id => new ObjectId(id));
  const users = await database.collection<AppUser>("appUsers").find({ _id: { $in: ids } }).toArray();
  const byId = new Map(users.map(u => [u._id.toString(), { email: u.email, name: u.name }]));
  return NextResponse.json({ bets: bets.map(b => ({ ...b, _id: b._id.toString(), creatorId: b.creatorId.toString(), participantIds: b.participantIds.map(String), participants: b.participantIds.map(p => byId.get(p.toString())), deadline: b.deadline.toISOString(), createdAt: b.createdAt.toISOString(), updatedAt: b.updatedAt.toISOString() })) });
}
export async function POST(request: Request) {
  try {
    const creator = await currentUser(); if (!creator) return unauthorized();
    const input = createSchema.parse(await request.json()); const database = await db();
    const emails = [...new Set(input.participantEmails.map(e => e.toLowerCase()).concat(creator.email))];
    const users = await database.collection<AppUser>("appUsers").find({ email: { $in: emails } }).toArray();
    const missing = emails.filter(email => !users.some(u => u.email === email));
    if (missing.length) return NextResponse.json({ error: `No registered account for: ${missing.join(", ")}` }, { status: 422 });
    const now = new Date(); const bet: Omit<Bet, "_id"> = { creatorId: creator._id, participantIds: users.map(u => u._id), condition: input.condition, wager: input.wager, deadline: new Date(input.deadline), status: "open", createdAt: now, updatedAt: now };
    const result = await database.collection<Bet>("bets").insertOne(bet as Bet);
    await database.collection<Activity>("activities").insertOne({ _id: new ObjectId(), betId: result.insertedId, actorId: creator._id, recipientIds: bet.participantIds, type: "created", message: `${creator.name || creator.email} created a bet.`, createdAt: now });
    return NextResponse.json({ id: result.insertedId.toString() }, { status: 201 });
  } catch (error) { return apiError(error); }
}
