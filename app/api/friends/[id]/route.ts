import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { unauthorized } from "@/lib/api";
import { currentUser } from "@/lib/auth-helpers";
import { db } from "@/lib/mongodb";
import type { Friendship } from "@/lib/types";

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const owner = await currentUser();
  if (!owner) return unauthorized();
  const value = (await params).id;
  if (!ObjectId.isValid(value)) return NextResponse.json({ error: "Friend not found." }, { status: 404 });
  const result = await (await db()).collection<Friendship>("friendships").deleteOne({
    ownerId: owner._id,
    friendId: new ObjectId(value),
  });
  if (!result.deletedCount) return NextResponse.json({ error: "Friend not found." }, { status: 404 });
  return new NextResponse(null, { status: 204 });
}
