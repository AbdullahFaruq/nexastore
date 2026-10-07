import mongoose, { type ClientSession } from "mongoose";
import { connectToDatabase, supportsTransactions } from "./connect";

/**
 * Run `fn` inside a transaction when the deployment supports one.
 *
 * Sale completion touches four collections (Sale, SaleItem, Product stock,
 * InventoryMovement) and must not half-apply - a decremented stock level with
 * no sale behind it is corruption. On a replica set / Atlas this is a real
 * transaction. On a standalone mongod (dev convenience) it degrades to a plain
 * sequential run, and callers are responsible for ordering writes so the
 * riskiest one happens last.
 */
export async function withTransaction<T>(
  fn: (session: ClientSession | undefined) => Promise<T>,
): Promise<T> {
  await connectToDatabase();

  if (!(await supportsTransactions())) {
    return fn(undefined);
  }

  const session = await mongoose.startSession();
  try {
    let result: T;
    await session.withTransaction(async () => {
      result = await fn(session);
    });
    return result!;
  } finally {
    await session.endSession();
  }
}
