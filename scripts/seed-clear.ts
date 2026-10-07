/**
 * Remove every row marked isDemo, across all stores.
 * Anything a real user entered is left untouched.
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local", quiet: true });
loadEnv({ quiet: true });
import mongoose from "mongoose";
import { connectToDatabase } from "../src/lib/db/connect";
import * as models from "../src/lib/db/models";

async function main() {
  await connectToDatabase();
  console.log(`\n  Clearing demo data from ${mongoose.connection.name}\n`);

  const targets = [
    ["Sale items", models.SaleItem],
    ["Sales", models.Sale],
    ["Payments", models.Payment],
    ["Inventory movements", models.InventoryMovement],
    ["Expenses", models.Expense],
    ["Products", models.Product],
    ["Customers", models.Customer],
    ["Categories", models.Category],
    ["Notifications", models.Notification],
  ] as const;

  let total = 0;
  for (const [label, model] of targets) {
    const r = await (model as unknown as { deleteMany: (f: object) => Promise<{ deletedCount: number }> })
      .deleteMany({ isDemo: true });
    total += r.deletedCount;
    console.log(`  ${label.padEnd(22)} ${r.deletedCount}`);
  }

  console.log(`\n  Removed ${total} demo records.\n`);
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
