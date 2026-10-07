import mongoose, { type Mongoose } from "mongoose";

/**
 * Next.js hot-reloads modules in dev and runs many lambdas in prod; both would
 * open a new pool per reload. Cache the connection promise on globalThis so a
 * process ever only holds one.
 */
declare global {
  var __nexastoreMongoose:
    | { conn: Mongoose | null; promise: Promise<Mongoose> | null }
    | undefined;
}

const cached = globalThis.__nexastoreMongoose ?? { conn: null, promise: null };
globalThis.__nexastoreMongoose = cached;

export function getMongoUri() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error(
      "MONGODB_URI is not set. Copy .env.example to .env.local and point it at your MongoDB instance.",
    );
  }
  return uri;
}

export async function connectToDatabase(): Promise<Mongoose> {
  if (cached.conn) return cached.conn;

  if (!cached.promise) {
    mongoose.set("strictQuery", true);
    // Surface slow/incorrect queries early in development.
    if (process.env.MONGO_DEBUG === "1") mongoose.set("debug", true);

    cached.promise = mongoose
      .connect(getMongoUri(), {
        dbName: process.env.MONGODB_DB || "nexastore",
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 8000,
        socketTimeoutMS: 45000,
        retryWrites: true,
      })
      .then(async (m) => {
        // Register every model exactly once, on first connect.
        await import("./models");
        return m;
      });
  }

  try {
    cached.conn = await cached.promise;
  } catch (err) {
    cached.promise = null;
    throw err;
  }
  return cached.conn;
}

/**
 * Does the deployment support multi-document transactions?
 * Standalone mongod does not; replica sets and Atlas do. Sale writes fall back
 * to a compensating sequence when false (see lib/db/tx.ts).
 */
let transactionSupport: boolean | null = null;

export async function supportsTransactions(): Promise<boolean> {
  if (transactionSupport !== null) return transactionSupport;
  if (process.env.MONGODB_TRANSACTIONS === "off") {
    transactionSupport = false;
    return false;
  }
  try {
    const conn = await connectToDatabase();
    const admin = conn.connection.db?.admin();
    const info = await admin?.command({ hello: 1 });
    transactionSupport = Boolean(info?.setName || info?.msg === "isdbgrid");
  } catch {
    transactionSupport = false;
  }
  return transactionSupport;
}
