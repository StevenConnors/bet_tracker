import { ObjectId } from "mongodb";
import type { User } from "@supabase/supabase-js";
import { db } from "@/lib/mongodb";
import { ensureIdentityIndexes } from "@/lib/identity";
import { accountDisplayName } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import type { AppUser } from "@/lib/types";

export async function ensureAppUser(user: Pick<User, "id" | "email" | "user_metadata">): Promise<AppUser | null> {
  if (!user.email) return null;
  const database = await db();
  await ensureIdentityIndexes(database);
  const users = database.collection<AppUser>("appUsers");
  const email = user.email.toLowerCase();
  const name = accountDisplayName(user.user_metadata);
  const role: AppUser["role"] = process.env.ADMIN_EMAIL?.toLowerCase() === email ? "admin" : "user";
  const existing = await users.findOne({ authUserId: user.id });
  if (existing) {
    await users.updateOne(
      { _id: existing._id },
      { $set: { email, ...(role === "admin" ? { role } : {}) } },
    );
    return users.findOne({ _id: existing._id });
  }

  const migrated = await users.findOneAndUpdate(
    { email, authUserId: { $exists: false } },
    { $set: { authUserId: user.id, ...(role === "admin" ? { role } : {}) } },
    { returnDocument: "after" },
  );
  if (migrated) return migrated;

  const inserted = { authUserId: user.id, email, ...(name ? { name } : {}), onboardingPending: true, createdAt: new Date() };
  await users.updateOne(
    { authUserId: user.id },
    role === "admin"
      ? { $setOnInsert: inserted, $set: { role } }
      : { $setOnInsert: { ...inserted, role } },
    { upsert: true },
  );
  return users.findOne({ authUserId: user.id });
}

export async function currentUser(): Promise<AppUser | null> {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  return ensureAppUser(user);
}
export function id(value: string) { return new ObjectId(value); }
