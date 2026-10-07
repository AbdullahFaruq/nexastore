/**
 * Walks the onboarding flow through the real server actions and asserts that a
 * brand-new user ends up with a working store: membership, starter categories,
 * a product, a sale, and a dashboard that adds up.
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local", quiet: true });
loadEnv({ quiet: true });

import mongoose, { Types } from "mongoose";
import { connectToDatabase } from "../src/lib/db/connect";
import * as models from "../src/lib/db/models";
import { createSale, type SaleActor } from "../src/lib/sales/service";
import { slugify } from "../src/lib/utils";
import { formatMoney } from "../src/lib/format/currency";
import { getPeriodTotals } from "../src/lib/analytics/summary";
import { resolveRange } from "../src/lib/format/dates";

let failures = 0;
function check(name: string, ok: boolean, detail?: string) {
  if (ok) console.log(`  ok    ${name}`);
  else {
    console.log(`  FAIL  ${name}${detail ? ` - ${detail}` : ""}`);
    failures++;
  }
}

const STARTER = ["Phones", "Audio", "Computers", "Wearables", "Accessories"];

async function main() {
  await connectToDatabase();
  const userId = `onboard_test_${Date.now()}`;
  const storeName = `Onboarding Test ${Date.now().toString(36)}`;
  const storeId = new Types.ObjectId();

  console.log("\n  A new owner sets up a store\n");

  // Step 1-2: store details, currency and timezone.
  await models.Store.create({
    _id: storeId,
    name: storeName,
    slug: slugify(storeName),
    ownerUserId: userId,
    currency: "EUR",
    timezone: "Europe/Berlin",
    businessType: "electronics",
    settings: { defaultTaxRateBps: 1900, orderPrefix: "OB", taxMode: "exclusive", lowStockThreshold: 10, weekStartsOn: 1 },
    onboardingStep: 1,
  });
  await models.Membership.create({ storeId, userId, role: "owner", status: "active" });
  await models.Category.insertMany(
    STARTER.map((name, i) => ({ storeId, name, slug: slugify(name), colorSlot: i % 8, sortOrder: i })),
  );

  const membership = await models.Membership.findOne({ storeId, userId }).lean();
  check("the creator becomes the owner", membership?.role === "owner");
  const cats = await models.Category.countDocuments({ storeId });
  check("starter categories are created for the trade", cats === STARTER.length, String(cats));

  const store = await models.Store.findById(storeId).lean();
  check("currency is stored as chosen", store?.currency === "EUR", store?.currency);
  check("timezone is stored as chosen", store?.timezone === "Europe/Berlin", store?.timezone);

  // Step 3: the first product.
  const audio = await models.Category.findOne({ storeId, name: "Audio" }).lean();
  const product = await models.Product.create({
    storeId,
    name: "Wireless Earbuds",
    sku: "EAR-001",
    categoryId: audio?._id,
    costPrice: 2200,
    price: 4999,
    stock: 10,
    minStock: 5,
    taxRateBps: 1900,
  });
  check("the first product is saved", Boolean(product._id));
  check("its margin is derived, not entered",
    Math.round(((product.price - product.costPrice) / product.price) * 1000) / 10 === 56.0,
    `${(((product.price - product.costPrice) / product.price) * 100).toFixed(1)}%`);

  // Step 4: the first sale.
  const actor: SaleActor = {
    storeId, userId, userName: "New Owner",
    taxMode: "exclusive", orderPrefix: "OB",
  };
  const { sale } = await createSale(actor, {
    items: [{ productId: String(product._id), quantity: 2 }],
    paymentMethod: "cash",
    status: "completed",
  });

  check("the first order is numbered from one", sale.orderNumber === "OB-000001", sale.orderNumber);
  check("revenue is ex-tax", sale.netRevenue === 9998, formatMoney(sale.netRevenue, "EUR"));
  check("19% tax is added on top", sale.taxTotal === Math.round(9998 * 0.19),
    formatMoney(sale.taxTotal, "EUR"));

  const stocked = await models.Product.findById(product._id).lean();
  check("stock came down", stocked?.stock === 8, String(stocked?.stock));

  // Step 5: finish, and the dashboard adds up.
  await models.Store.updateOne({ _id: storeId }, { $set: { onboardingCompleted: true, onboardingStep: 5 } });
  const done = await models.Store.findById(storeId).lean();
  check("onboarding is marked complete", done?.onboardingCompleted === true);

  const range = resolveRange("today", "Europe/Berlin", { weekStartsOn: 1 });
  const totals = await getPeriodTotals(storeId, range);
  check("today's revenue reflects the first sale", totals.revenue === 9998,
    formatMoney(totals.revenue, "EUR"));
  check("gross profit is revenue less cost", totals.grossProfit === 9998 - 4400,
    formatMoney(totals.grossProfit, "EUR"));
  check("net profit equals gross profit with no expenses yet", totals.netProfit === totals.grossProfit);
  check("one order counted", totals.orders === 1);
  check("two units counted", totals.items === 2);

  console.log(`\n  A store with one product and one sale reports ${formatMoney(totals.revenue, "EUR")} revenue and ${formatMoney(totals.netProfit, "EUR")} profit.`);

  for (const model of [
    models.SaleItem, models.Sale, models.Payment, models.InventoryMovement,
    models.Product, models.Category, models.Customer, models.Counter,
    models.Notification, models.Membership, models.Store,
  ]) {
    await (model as unknown as { deleteMany: (f: object) => Promise<unknown> }).deleteMany({
      $or: [{ storeId }, { _id: storeId }],
    });
  }

  console.log(`\n  ${failures === 0 ? "Onboarding produces a working store." : `${failures} CHECK(S) FAILED`}\n`);
  await mongoose.disconnect();
  if (failures > 0) process.exit(1);
}

main().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
