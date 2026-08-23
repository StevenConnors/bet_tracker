import type { Db } from "mongodb";
import { z } from "zod";
import type { AppUser, Bet } from "@/lib/types";

const email = z.string().trim().toLowerCase().email();

export const betDraftSchema = z.object({
  condition: z.string().trim().min(3).max(600),
  wager: z.string().trim().min(2).max(300),
  deadline: z.string().datetime(),
  participantEmails: z.array(email).min(1).max(20),
});

export const confirmedBetSchema = betDraftSchema.extend({
  confirmed: z.literal(true),
  invitedEmails: z.array(email).max(20),
});

export type BetDraft = z.infer<typeof betDraftSchema>;

export async function reviewBetParticipants(database: Db, creator: AppUser, draft: BetDraft) {
  const participantEmails = [...new Set(draft.participantEmails)].filter(value => value !== creator.email);
  if (!participantEmails.length) throw new z.ZodError([{
    code: "custom",
    message: "Add at least one friend other than yourself",
    path: ["participantEmails"],
  }]);

  const allEmails = [creator.email, ...participantEmails];
  const users = await database.collection<AppUser>("appUsers").find({ email: { $in: allEmails } }).toArray();
  const byEmail = new Map(users.map(user => [user.email, user]));
  const participants = participantEmails.map(participantEmail => {
    const user = byEmail.get(participantEmail);
    return { email: participantEmail, name: user?.name, registered: Boolean(user) };
  });

  return {
    draft: { ...draft, participantEmails },
    allEmails,
    users,
    participantIds: users.map(user => user._id),
    participants,
    missingEmails: participants.filter(participant => !participant.registered).map(participant => participant.email),
  };
}

export function sameEmailSet(left: string[], right: string[]) {
  const a = [...new Set(left)].sort();
  const b = [...new Set(right)].sort();
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

export function canReadBet(user: AppUser, bet: Bet) {
  if (user.role === "admin") return true;
  return Boolean(bet.participantEmails?.includes(user.email) || bet.participantIds.some(id => id.equals(user._id)));
}

export function betParticipantQuery(user: AppUser) {
  if (user.role === "admin") return {};
  return { $or: [{ participantEmails: user.email }, { participantIds: user._id }] };
}
