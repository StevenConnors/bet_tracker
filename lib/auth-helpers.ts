import { ObjectId } from "mongodb";
import type { User } from "@supabase/supabase-js";
import { db } from "@/lib/mongodb";
import { accountDisplayName } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import type { AppUser } from "@/lib/types";

export async function ensureAppUser(user: Pick<User, "email" | "user_metadata">): Promise<AppUser | null> {
  if (!user.email) return null;
  const database = await db();
  const email = user.email.toLowerCase();
  const name = accountDisplayName(user.user_metadata);
  const role: AppUser["role"] = process.env.ADMIN_EMAIL?.toLowerCase() === email ? "admin" : "user";
  const inserted = { email, ...(name ? { name } : {}), onboardingPending: true, createdAt: new Date() };
  await database.collection<AppUser>("appUsers").updateOne(
    { email },
    role === "admin"
      ? { $setOnInsert: inserted, $set: { role } }
      : { $setOnInsert: { ...inserted, role } },
    { upsert: true },
  );
  return database.collection<AppUser>("appUsers").findOne({ email });
}

export async function currentUser(): Promise<AppUser | null> {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  return ensureAppUser(user);
}
export function id(value: string) { return new ObjectId(value); }
