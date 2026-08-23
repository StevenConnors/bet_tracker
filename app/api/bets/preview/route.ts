import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth-helpers";
import { betDraftSchema, reviewBetParticipants } from "@/lib/bets";
import { db } from "@/lib/mongodb";
import { apiError, unauthorized } from "@/lib/api";

export async function POST(request: Request) {
  try {
    const creator = await currentUser();
    if (!creator) return unauthorized();
    const draft = betDraftSchema.parse(await request.json());
    const review = await reviewBetParticipants(await db(), creator, draft);
    return NextResponse.json({
      draft: review.draft,
      participants: review.participants,
      missingEmails: review.missingEmails,
    });
  } catch (error) {
    return apiError(error);
  }
}
