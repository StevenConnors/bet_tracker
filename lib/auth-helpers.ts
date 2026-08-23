import { ObjectId } from "mongodb";
import { db } from "@/lib/mongodb";
import { createClient } from "@/lib/supabase/server";
import type { AppUser } from "@/lib/types";

export async function currentUser(): Promise<AppUser | null> {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user?.email) return null;
  const database = await db();
  const email = user.email.toLowerCase();
  const name = typeof user.user_metadata?.name === "string" ? user.user_metadata.name : undefined;
  const role = process.env.ADMIN_EMAIL?.toLowerCase() === email ? "admin" : "user";
  await database.collection<AppUser>("appUsers").updateOne(
    { email },
    role === "admin"
      ? { $setOnInsert: { email, name, createdAt: new Date() }, $set: { role } }
      : { $setOnInsert: { email, name, role, createdAt: new Date() } },
    { upsert: true },
  );
  return database.collection<AppUser>("appUsers").findOne({ email });
}
export function id(value: string) { return new ObjectId(value); }
