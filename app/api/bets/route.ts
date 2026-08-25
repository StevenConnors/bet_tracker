import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { currentUser } from "@/lib/auth-helpers";
import { betParticipantQuery, confirmedBetSchema, resolveBetParticipants, reviewBetParticipants, sameEmailSet } from "@/lib/bets";
import { sendBetInvitation } from "@/lib/email/bet-invitation";
import { db } from "@/lib/mongodb";
import type { Activity, AppUser, Bet } from "@/lib/types";
import { apiError, unauthorized } from "@/lib/api";

export async function GET() {
  const user = await currentUser(); if (!user) return unauthorized();
  const database = await db();
  const query = betParticipantQuery(user);
  const bets = await database.collection<Bet>("bets").find(query).sort({ deadline: 1 }).toArray();
  const ids = [...new Set(bets.flatMap(b => b.participantIds.map(String)).concat(bets.map(b => String(b.creatorId))))].map(id => new ObjectId(id));
  const emails = [...new Set(bets.flatMap(b => b.participantEmails || []))];
  const users = await database.collection<AppUser>("appUsers").find({ $or: [{ _id: { $in: ids } }, { email: { $in: emails } }] }).toArray();
  return NextResponse.json({ bets: bets.map(b => ({ ...b, _id: b._id.toString(), creatorId: b.creatorId.toString(), participantIds: b.participantIds.map(String), participants: resolveBetParticipants(b, users), deadline: b.deadline.toISOString(), createdAt: b.createdAt.toISOString(), updatedAt: b.updatedAt.toISOString() })) });
}
export async function POST(request: Request) {
  try {
    const creator = await currentUser(); if (!creator) return unauthorized();
    const input = confirmedBetSchema.parse(await request.json()); const database = await db();
    const review = await reviewBetParticipants(database, creator, input);
    if (!sameEmailSet(input.invitedEmails, review.missingEmails)) return NextResponse.json({
      error: "Participant account status changed. Please review the bet again.",
      code: "REVIEW_REQUIRED",
      review: { draft: review.draft, participants: review.participants, missingEmails: review.missingEmails },
    }, { status: 409 });
    const now = new Date(); const bet: Omit<Bet, "_id"> = { creatorId: creator._id, participantIds: review.participantIds, participantEmails: review.missingEmails, condition: input.condition, wager: input.wager, deadline: new Date(input.deadline), status: "open", createdAt: now, updatedAt: now };
    const result = await database.collection<Bet>("bets").insertOne(bet as Bet);
    await database.collection<Activity>("activities").insertOne({ _id: new ObjectId(), betId: result.insertedId, actorId: creator._id, recipientIds: bet.participantIds, recipientEmails: bet.participantEmails, type: "created", message: `${creator.name || creator.email} created a bet.`, createdAt: now });
    const deliveries = await Promise.allSettled(review.missingEmails.map(recipient => sendBetInvitation({
      betId: result.insertedId.toString(),
      condition: bet.condition,
      creatorLabel: creator.name || creator.email,
      deadline: bet.deadline,
      recipient,
      wager: bet.wager,
    })));
    const failed = deliveries.filter(delivery => delivery.status === "rejected").length;
    if (failed) console.error("One or more bet invitation emails failed", { betId: result.insertedId.toString(), failed });
    return NextResponse.json({ id: result.insertedId.toString(), invitations: { sent: deliveries.length - failed, failed } }, { status: 201 });
  } catch (error) { return apiError(error); }
}
