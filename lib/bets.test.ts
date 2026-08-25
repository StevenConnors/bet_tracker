import { describe, expect, it } from "vitest";
import { ObjectId } from "mongodb";
import { canReadBet, resolveBetParticipants, sameEmailSet } from "./bets";
import type { AppUser, Bet } from "./types";

const creatorId = new ObjectId();
const registeredParticipantId = new ObjectId();
const now = new Date();
const bet: Bet = {
  _id: new ObjectId(),
  creatorId,
  participantIds: [creatorId, registeredParticipantId],
  participantEmails: ["creator@example.test", "invited@example.test"],
  condition: "A private condition",
  wager: "Coffee",
  deadline: new Date(now.getTime() + 60_000),
  status: "open",
  createdAt: now,
  updatedAt: now,
};

const user = (id: ObjectId, email: string, role: AppUser["role"] = "user"): AppUser => ({ _id: id, email, role, createdAt: now });

describe("bet authorization", () => {
  it("allows a newly registered invitee by normalized email", () => {
    expect(canReadBet(user(new ObjectId(), "invited@example.test"), bet)).toBe(true);
  });

  it("keeps legacy registered participants authorized by id", () => {
    expect(canReadBet(user(registeredParticipantId, "renamed@example.test"), bet)).toBe(true);
  });

  it("denies a non-participant", () => {
    expect(canReadBet(user(new ObjectId(), "outsider@example.test"), bet)).toBe(false);
  });
});

describe("confirmation snapshot", () => {
  it("compares invited email sets independent of order and duplicates", () => {
    expect(sameEmailSet(["b@example.test", "a@example.test", "a@example.test"], ["a@example.test", "b@example.test"])).toBe(true);
    expect(sameEmailSet(["a@example.test"], ["b@example.test"])).toBe(false);
  });
});

describe("participant presentation", () => {
  it("uses the current username from a stable participant ID", () => {
    const creator = { ...user(creatorId, "creator@example.test"), username: "creator" };
    const friend = { ...user(registeredParticipantId, "friend@example.test"), name: "Friendly Name", username: "new_username" };
    const participants = resolveBetParticipants({ ...bet, participantEmails: [] }, [creator, friend]);
    expect(participants).toEqual([
      expect.objectContaining({ id: creatorId.toString(), username: "creator" }),
      expect.objectContaining({ id: registeredParticipantId.toString(), username: "new_username" }),
    ]);
  });
});
