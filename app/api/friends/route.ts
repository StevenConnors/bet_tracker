import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, unauthorized } from "@/lib/api";
import { currentUser } from "@/lib/auth-helpers";
import { isDuplicateKeyError, usernameSchema } from "@/lib/identity";
import { db } from "@/lib/mongodb";
import type { AppUser, Friendship } from "@/lib/types";

const addFriendSchema = z.object({ username: usernameSchema });

function friendJson(user: AppUser) {
  return { id: user._id.toString(), name: user.name, username: user.username };
}

export async function GET() {
  const owner = await currentUser();
  if (!owner) return unauthorized();
  const database = await db();
  const relationships = await database.collection<Friendship>("friendships")
    .find({ ownerId: owner._id })
    .sort({ createdAt: -1 })
    .toArray();
  const users = await database.collection<AppUser>("appUsers")
    .find({ _id: { $in: relationships.map(relationship => relationship.friendId) } })
    .toArray();
  const byId = new Map(users.map(user => [user._id.toString(), user]));
  const friends = relationships
    .map(relationship => byId.get(relationship.friendId.toString()))
    .filter((friend): friend is AppUser => Boolean(friend?.username))
    .map(friendJson);
  return NextResponse.json({ friends });
}

export async function POST(request: Request) {
  try {
    const owner = await currentUser();
    if (!owner) return unauthorized();
    const input = addFriendSchema.parse(await request.json());
    const database = await db();
    const friend = await database.collection<AppUser>("appUsers").findOne({ username: input.username });
    if (!friend) return NextResponse.json({ error: "No account has that exact username." }, { status: 404 });
    if (friend._id.equals(owner._id)) return NextResponse.json({ error: "You cannot add yourself as a friend." }, { status: 400 });
    try {
      await database.collection<Friendship>("friendships").insertOne({
        _id: new ObjectId(),
        ownerId: owner._id,
        friendId: friend._id,
        createdAt: new Date(),
      });
    } catch (error) {
      if (isDuplicateKeyError(error)) return NextResponse.json({ error: "That person is already in your friends." }, { status: 409 });
      throw error;
    }
    return NextResponse.json({ friend: friendJson(friend) }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
