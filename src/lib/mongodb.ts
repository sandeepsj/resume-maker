import mongoose from "mongoose";
import { MongoClient } from "mongodb";

const MONGODB_URI = process.env.DATABASE_URL!;

if (!MONGODB_URI) {
  throw new Error("Please define the DATABASE_URL environment variable");
}

// ─── Mongoose connection (for app models) ────────────────────────────────────

declare global {
  // eslint-disable-next-line no-var
  var mongooseConn: {
    conn: typeof mongoose | null;
    promise: Promise<typeof mongoose> | null;
  };
}

const cached = globalThis.mongooseConn ?? { conn: null, promise: null };
globalThis.mongooseConn = cached;

export async function connectDB(): Promise<typeof mongoose> {
  if (cached.conn) return cached.conn;

  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGODB_URI, {
      bufferCommands: false,
    });
  }

  cached.conn = await cached.promise;
  return cached.conn;
}

// ─── MongoClient (for NextAuth.js adapter) ───────────────────────────────────

declare global {
  // eslint-disable-next-line no-var
  var mongoClient: MongoClient | undefined;
}

let client: MongoClient;
let clientPromise: Promise<MongoClient>;

if (process.env.NODE_ENV === "development") {
  if (!globalThis.mongoClient) {
    globalThis.mongoClient = new MongoClient(MONGODB_URI);
  }
  client = globalThis.mongoClient;
  clientPromise = client.connect();
} else {
  client = new MongoClient(MONGODB_URI);
  clientPromise = client.connect();
}

export { clientPromise };
