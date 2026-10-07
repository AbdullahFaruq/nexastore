/**
 * Demo data seeder.
 *
 *   npm run seed                      -> owner@nexastore.dev, "Northline Electronics"
 *   npm run seed -- --email=me@x.com --store="My Shop" --currency=EUR --months=18
 *   npm run seed -- --reset           -> remove existing demo rows first
 *
 * Creates the store, the owner membership and a full trading history. Every
 * row is marked isDemo so `npm run seed:clear` can remove it without touching
 * anything entered by hand.
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local", quiet: true });
loadEnv({ quiet: true });
import mongoose from "mongoose";
import { connectToDatabase } from "../src/lib/db/connect";
import { Store } from "../src/lib/db/models/store";
import { Membership } from "../src/lib/db/models/membership";
import { UserProfile } from "../src/lib/db/models/user-profile";
import { generateDemoData } from "../src/lib/seed/generate";
import { CURRENCIES } from "../src/lib/format/currency";
import { slugify } from "../src/lib/utils";

function arg(name: string, fallback: string) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}
const flag = (name: string) => process.argv.includes(`--${name}`);

async function main() {
  const email = arg("email", "owner@nexastore.dev").toLowerCase();
  const storeName = arg("store", "Northline Electronics");
  const currency = arg("currency", "USD").toUpperCase();
  const timezone = arg("timezone", "America/New_York");
  const months = Number(arg("months", "15"));
  const customers = Number(arg("customers", "320"));
  const taxPct = Number(arg("tax", "8.5"));

  if (!(currency in CURRENCIES)) {
    console.error(`Unsupported currency "${currency}". Supported: ${Object.keys(CURRENCIES).join(", ")}`);
    process.exit(1);
  }

  console.log("\n  NexaStore seed\n  " + "-".repeat(46));
  await connectToDatabase();
  console.log(`  database    ${mongoose.connection.name}`);

  // Matches the id derivation in actions/dev-auth.ts, so signing in with this
  // email in development lands straight in the seeded store.
  const userId = `dev_${Buffer.from(email).toString("base64url").slice(0, 24)}`;
  const displayName = email.split("@")[0].replace(/[._-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  await UserProfile.updateOne(
    { userId },
    { $setOnInsert: { userId }, $set: { email, displayName } },
    { upsert: true },
  );

  let store = await Store.findOne({ slug: slugify(storeName) });
  if (store && flag("reset")) {
    console.log("  reset       removing existing demo rows");
  }

  if (!store) {
    store = await Store.create({
      name: storeName,
      slug: slugify(storeName),
      ownerUserId: userId,
      currency,
      timezone,
      businessType: "electronics",
      colorSlot: 0,
      email,
      address: "148 High Street, Riverside",
      phone: "+1 555 0142",
      settings: {
        defaultTaxRateBps: Math.round(taxPct * 100),
        lowStockThreshold: 10,
        weekStartsOn: 1,
        orderPrefix: "NX",
        taxMode: "exclusive",
        receiptFooter: "Thanks for shopping with us. Returns accepted within 30 days with a receipt.",
      },
      onboardingCompleted: true,
      onboardingStep: 5,
      isDemo: true,
    });
    console.log(`  store       created "${store.name}"`);
  } else {
    console.log(`  store       reusing "${store.name}"`);
  }

  await Membership.updateOne(
    { storeId: store._id, userId },
    {
      $setOnInsert: { storeId: store._id, userId, role: "owner", status: "active" },
      $set: { displayName, email },
    },
    { upsert: true },
  );

  // A second, non-owner member so the team screen and role logic have something
  // real to show.
  const managerEmail = "manager@nexastore.dev";
  const managerId = `dev_${Buffer.from(managerEmail).toString("base64url").slice(0, 24)}`;
  await Membership.updateOne(
    { storeId: store._id, userId: managerId },
    {
      $setOnInsert: { storeId: store._id, userId: managerId, role: "manager", status: "active" },
      $set: { displayName: "Dana Whitfield", email: managerEmail },
    },
    { upsert: true },
  );
  await Membership.updateOne(
    { storeId: store._id, email: "sam@nexastore.dev" },
    {
      $setOnInsert: {
        storeId: store._id,
        userId: `invite:sam@nexastore.dev:${store._id.toString()}`,
        role: "employee",
        status: "invited",
      },
      $set: { displayName: "Sam Okafor", email: "sam@nexastore.dev" },
    },
    { upsert: true },
  );

  await UserProfile.updateOne({ userId }, { $set: { activeStoreId: store._id } });

  console.log(`  generating  ${months} months of trading history...`);
  const started = Date.now();

  const result = await generateDemoData({
    storeId: store._id,
    currency: store.currency,
    timezone: store.timezone,
    taxMode: store.settings.taxMode,
    taxRateBps: store.settings.defaultTaxRateBps,
    orderPrefix: store.settings.orderPrefix,
    userId,
    userName: displayName,
    months,
    customerCount: customers,
  });

  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  console.log("  " + "-".repeat(46));
  console.log(`  categories  ${result.categories}`);
  console.log(`  products    ${result.products}`);
  console.log(`  customers   ${result.customers}`);
  console.log(`  sales       ${result.sales}`);
  console.log(`  line items  ${result.saleItems}`);
  console.log(`  expenses    ${result.expenses}`);
  console.log(`  movements   ${result.movements}`);
  console.log(`  took        ${seconds}s`);
  console.log("  " + "-".repeat(46));
  console.log(`\n  Sign in at http://localhost:3000/sign-in as:\n    ${email}\n`);

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error("\n  Seed failed:", err);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
