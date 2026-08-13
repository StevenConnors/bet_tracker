import { ObjectId } from "mongodb";
import { auth } from "@/auth";
import { db } from "@/lib/mongodb";
import type { AppUser } from "@/lib/types";

export async function currentUser(): Promise<AppUser | null> {
  const session = await auth();
  if (!session?.user?.email) return null;
  const database = await db();
  const email = session.user.email.toLowerCase();
  const role = process.env.ADMIN_EMAIL?.toLowerCase() === email ? "admin" : "user";
  await database.collection<AppUser>("appUsers").updateOne(
    { email },
    role === "admin"
      ? { $setOnInsert: { email, name: session.user.name ?? undefined, createdAt: new Date() }, $set: { role } }
      : { $setOnInsert: { email, name: session.user.name ?? undefined, role, createdAt: new Date() } },
    { upsert: true },
  );
  return database.collection<AppUser>("appUsers").findOne({ email });
}
export function id(value: string) { return new ObjectId(value); }
