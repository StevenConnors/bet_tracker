import type { Db } from "mongodb";
import { z } from "zod";
import { USERNAME_MAX_LENGTH, USERNAME_MIN_LENGTH } from "./profile-constants";
import type { AppUser, Friendship } from "./types";

export { USERNAME_MAX_LENGTH, USERNAME_MIN_LENGTH } from "./profile-constants";

export function normalizeUsername(value: string) {
  return value.trim().toLowerCase();
}

export const usernameSchema = z.string()
  .transform(normalizeUsername)
  .pipe(z.string()
    .min(USERNAME_MIN_LENGTH, `Username must be at least ${USERNAME_MIN_LENGTH} characters.`)
    .max(USERNAME_MAX_LENGTH, `Username must be ${USERNAME_MAX_LENGTH} characters or fewer.`)
    .regex(/^[a-z0-9_]+$/, "Use only letters, numbers, and underscores in your username."));

export function usernameSuggestion(value: string) {
  const normalized = normalizeUsername(value)
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, USERNAME_MAX_LENGTH);
  if (normalized.length >= USERNAME_MIN_LENGTH) return normalized;
  return `${normalized || "user"}${"0".repeat(USERNAME_MIN_LENGTH)}`.slice(0, USERNAME_MIN_LENGTH);
}

let indexesReady: Promise<void> | undefined;

export async function ensureIdentityIndexes(database: Db) {
  if (!indexesReady) {
    indexesReady = Promise.all([
      database.collection<AppUser>("appUsers").createIndex(
        { authUserId: 1 },
        { unique: true, sparse: true, name: "unique_auth_user_id" },
      ),
      database.collection<AppUser>("appUsers").createIndex(
        { username: 1 },
        { unique: true, sparse: true, name: "unique_username" },
      ),
      database.collection<Friendship>("friendships").createIndex(
        { ownerId: 1, friendId: 1 },
        { unique: true, name: "unique_owner_friend" },
      ),
      database.collection<Friendship>("friendships").createIndex(
        { ownerId: 1, createdAt: -1 },
        { name: "friends_by_owner" },
      ),
    ]).then(() => undefined).catch(error => {
      indexesReady = undefined;
      throw error;
    });
  }
  await indexesReady;
}

export function isDuplicateKeyError(error: unknown): error is { code: number } {
  return typeof error === "object" && error !== null && "code" in error && error.code === 11000;
}
