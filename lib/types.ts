import type { ObjectId } from "mongodb";

export type Role = "user" | "admin";
export type BetStatus = "open" | "completed" | "cancelled" | "unresolved";
export interface AppUser { _id: ObjectId; email: string; name?: string; role: Role; createdAt: Date }
export interface Bet {
  _id: ObjectId; creatorId: ObjectId; participantIds: ObjectId[];
  condition: string; wager: string; deadline: Date; status: BetStatus;
  resolutionNote?: string; createdAt: Date; updatedAt: Date;
}
export interface Activity {
  _id: ObjectId; betId?: ObjectId; actorId?: ObjectId; recipientIds: ObjectId[];
  type: "created" | "participant_added" | "edited" | "completed" | "cancelled" | "unresolved" | "admin_action";
  message: string; createdAt: Date;
}
export const isOverdue = (bet: Pick<Bet, "status" | "deadline">) => bet.status === "open" && bet.deadline.getTime() < Date.now();
