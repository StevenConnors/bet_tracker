import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI ?? "mongodb://127.0.0.1:27017/stakeout";

const globalForMongo = global as typeof globalThis & { mongoClient?: Promise<MongoClient> };
export const clientPromise = globalForMongo.mongoClient ?? new MongoClient(uri).connect();
if (process.env.NODE_ENV !== "production") globalForMongo.mongoClient = clientPromise;

export async function db() {
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is required");
  return (await clientPromise).db();
}
