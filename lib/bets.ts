import { ObjectId, type Db } from "mongodb";
import { z } from "zod";
import type { AppUser, Bet, Friendship } from "@/lib/types";

const email = z.string().trim().toLowerCase().email();
const objectId = z.string().refine(ObjectId.isValid, "Invalid friend ID.");
const draftFields = {
  condition: z.string().trim().min(3).max(600),
  wager: z.string().trim().min(2).max(300),
  deadline: z.string().datetime(),
  friendIds: z.array(objectId).max(20).default([]),
  participantEmails: z.array(email).max(20).default([]),
};

function validateParticipantCount(input: { friendIds: string[]; participantEmails: string[] }, context: z.RefinementCtx) {
  const count = new Set(input.friendIds).size + new Set(input.participantEmails).size;
  if (!count) context.addIssue({ code: "custom", message: "Add at least one friend or email invite.", path: ["friendIds"] });
  if (count > 20) context.addIssue({ code: "custom", message: "A bet can have at most 20 other participants.", path: ["friendIds"] });
}

export const betDraftSchema = z.object(draftFields).superRefine(validateParticipantCount);

export const confirmedBetSchema = z.object({
  ...draftFields,
  confirmed: z.literal(true),
  invitedEmails: z.array(email).max(20),
}).superRefine(validateParticipantCount);

export type BetDraft = z.infer<typeof betDraftSchema>;

export async function reviewBetParticipants(database: Db, creator: AppUser, draft: BetDraft) {
  const friendIds = [...new Set(draft.friendIds)].filter(value => value !== creator._id.toString());
  const friendObjectIds = friendIds.map(value => new ObjectId(value));
  const relationships = await database.collection<Friendship>("friendships").find({
    ownerId: creator._id,
    friendId: { $in: friendObjectIds },
  }).toArray();
  if (relationships.length !== friendIds.length) throw new z.ZodError([{
    code: "custom",
    message: "One or more selected friends are no longer in your friend list.",
    path: ["friendIds"],
  }]);

  const friendUsers = await database.collection<AppUser>("appUsers").find({ _id: { $in: friendObjectIds } }).toArray();
  const friendsById = new Map(friendUsers.map(user => [user._id.toString(), user]));
  const selectedFriends = friendIds.map(friendId => friendsById.get(friendId));
  if (selectedFriends.some(friend => !friend)) throw new z.ZodError([{
    code: "custom",
    message: "One or more selected friends could not be found.",
    path: ["friendIds"],
  }]);

  const selectedFriendEmails = new Set(friendUsers.map(user => user.email));
  const participantEmails = [...new Set(draft.participantEmails)]
    .filter(value => value !== creator.email && !selectedFriendEmails.has(value));
  if (!friendIds.length && !participantEmails.length) throw new z.ZodError([{
    code: "custom",
    message: "Add at least one friend other than yourself.",
    path: ["friendIds"],
  }]);

  const emailUsers = await database.collection<AppUser>("appUsers").find({ email: { $in: participantEmails } }).toArray();
  const byEmail = new Map(emailUsers.map(user => [user.email, user]));
  const emailParticipants = participantEmails.map(participantEmail => {
    const user = byEmail.get(participantEmail);
    return { id: user?._id.toString(), email: participantEmail, name: user?.name, username: user?.username, registered: Boolean(user), friend: false };
  });
  const participants = [
    ...friendIds.map(friendId => {
      const friend = friendsById.get(friendId)!;
      return { id: friendId, name: friend.name, username: friend.username, registered: true, friend: true };
    }),
    ...emailParticipants,
  ];
  const participantIds = [creator._id, ...friendUsers.map(user => user._id), ...emailUsers.map(user => user._id)]
    .filter((value, index, values) => values.findIndex(item => item.equals(value)) === index);

  return {
    draft: { ...draft, friendIds, participantEmails },
    participantIds,
    participants,
    missingEmails: emailParticipants.filter(participant => !participant.registered).map(participant => participant.email),
  };
}

export function resolveBetParticipants(bet: Bet, users: AppUser[]) {
  const byId = new Map(users.map(user => [user._id.toString(), user]));
  const byEmail = new Map(users.map(user => [user.email, user]));
  const seenIds = new Set<string>();
  const seenEmails = new Set<string>();
  const participants: { id?: string; email?: string; name?: string; username?: string }[] = [];
  for (const participantId of bet.participantIds) {
    const user = byId.get(participantId.toString());
    if (!user || seenIds.has(user._id.toString())) continue;
    seenIds.add(user._id.toString());
    seenEmails.add(user.email);
    participants.push({ id: user._id.toString(), email: user.email, name: user.name, username: user.username });
  }
  for (const emailAddress of bet.participantEmails || []) {
    const user = byEmail.get(emailAddress);
    if (user) {
      if (seenIds.has(user._id.toString())) continue;
      seenIds.add(user._id.toString());
      seenEmails.add(user.email);
      participants.push({ id: user._id.toString(), email: user.email, name: user.name, username: user.username });
    } else if (!seenEmails.has(emailAddress)) {
      seenEmails.add(emailAddress);
      participants.push({ email: emailAddress });
    }
  }
  return participants;
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
