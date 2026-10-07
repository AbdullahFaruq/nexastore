"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission, requireStoreContext } from "@/lib/auth/context";
import { getAuthUser } from "@/lib/auth/provider";
import { connectToDatabase } from "@/lib/db/connect";
import { withTransaction } from "@/lib/db/tx";
import { Category } from "@/lib/db/models/category";
import { Membership } from "@/lib/db/models/membership";
import { Store } from "@/lib/db/models/store";
import { UserProfile } from "@/lib/db/models/user-profile";
import { AppError, fail, ok, unauthorized, type ActionResult } from "@/lib/errors";
import { hashIndex, slugify } from "@/lib/utils";
import { createStoreSchema, storeSettingsSchema, updateStoreSchema } from "@/lib/validation/schemas";
import { parseOrThrow } from "@/lib/validation/common";

/** A sensible starting taxonomy per business type, so day one is not empty. */
const STARTER_CATEGORIES: Record<string, string[]> = {
  retail: ["Apparel", "Footwear", "Accessories", "Home", "Gifts"],
  grocery: ["Produce", "Bakery", "Dairy", "Beverages", "Pantry", "Household"],
  fashion: ["Womenswear", "Menswear", "Footwear", "Bags", "Jewellery"],
  electronics: ["Phones", "Audio", "Computers", "Wearables", "Accessories"],
  pharmacy: ["Prescription", "Over the counter", "Vitamins", "Personal care", "Baby"],
  restaurant: ["Starters", "Mains", "Desserts", "Drinks", "Sides"],
  cafe: ["Coffee", "Tea", "Pastries", "Sandwiches", "Cold drinks"],
  beauty: ["Skincare", "Makeup", "Haircare", "Fragrance", "Tools"],
  hardware: ["Tools", "Fixings", "Paint", "Electrical", "Garden"],
  bookstore: ["Fiction", "Non-fiction", "Children", "Stationery", "Magazines"],
  other: ["General"],
};

async function uniqueSlug(base: string) {
  const root = slugify(base) || "store";
  let slug = root;
  for (let i = 2; i < 50; i++) {
    if (!(await Store.exists({ slug }))) return slug;
    slug = `${root}-${i}`;
  }
  return `${root}-${Date.now().toString(36)}`;
}

/**
 * Create a store and make the caller its owner, in one transaction.
 * The Membership row is what actually grants access - the store's ownerUserId
 * is a convenience field, never an authorisation check.
 */
export async function createStore(raw: unknown): Promise<ActionResult<{ storeId: string }>> {
  try {
    const user = await getAuthUser();
    if (!user) throw unauthorized();

    const input = parseOrThrow(createStoreSchema, raw);
    await connectToDatabase();

    const existing = await Membership.countDocuments({ userId: user.userId, status: "active" });
    if (existing >= 10) {
      throw new AppError("CONFLICT", "You already belong to the maximum number of stores.");
    }

    const slug = await uniqueSlug(input.name);

    const storeId = await withTransaction(async (session) => {
      const [store] = await Store.create(
        [
          {
            name: input.name,
            slug,
            ownerUserId: user.userId,
            currency: input.currency,
            timezone: input.timezone,
            businessType: input.businessType,
            colorSlot: hashIndex(slug, 8),
            email: user.email,
            onboardingStep: 1,
            onboardingCompleted: false,
          },
        ],
        { session, ordered: true },
      );

      await Membership.create(
        [
          {
            storeId: store._id,
            userId: user.userId,
            role: "owner",
            status: "active",
            displayName: user.displayName,
            email: user.email,
            avatarUrl: user.avatarUrl,
          },
        ],
        { session, ordered: true },
      );

      const names = STARTER_CATEGORIES[input.businessType] ?? STARTER_CATEGORIES.other;
      await Category.insertMany(
        names.map((name, i) => ({
          storeId: store._id,
          name,
          slug: slugify(name),
          colorSlot: i % 8,
          sortOrder: i,
        })),
        { session, ordered: true },
      );

      await UserProfile.updateOne(
        { userId: user.userId },
        { $set: { activeStoreId: store._id }, $setOnInsert: { userId: user.userId } },
        { upsert: true, session },
      );

      return store._id;
    });

    revalidatePath("/", "layout");
    return ok({ storeId: String(storeId) });
  } catch (err) {
    return fail(err);
  }
}

export async function updateStore(raw: unknown): Promise<ActionResult<{ saved: true }>> {
  try {
    const ctx = await requirePermission("settings:manage");
    const input = parseOrThrow(updateStoreSchema, raw);
    await connectToDatabase();

    const set: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input)) {
      if (v !== undefined && v !== "") set[k] = v;
    }
    if (input.name) set.slug = await uniqueSlug(input.name);

    await Store.updateOne({ _id: ctx.storeId }, { $set: set });
    revalidatePath("/", "layout");
    return ok({ saved: true });
  } catch (err) {
    return fail(err);
  }
}

export async function updateStoreSettings(raw: unknown): Promise<ActionResult<{ saved: true }>> {
  try {
    const ctx = await requirePermission("settings:manage");
    const input = parseOrThrow(storeSettingsSchema, raw);
    await connectToDatabase();

    await Store.updateOne(
      { _id: ctx.storeId },
      {
        $set: {
          "settings.defaultTaxRateBps": Math.round(input.defaultTaxRatePct * 100),
          "settings.lowStockThreshold": input.lowStockThreshold,
          "settings.weekStartsOn": input.weekStartsOn,
          "settings.orderPrefix": input.orderPrefix,
          "settings.taxMode": input.taxMode,
          "settings.receiptFooter": input.receiptFooter,
        },
      },
    );

    revalidatePath("/", "layout");
    return ok({ saved: true });
  } catch (err) {
    return fail(err);
  }
}

export async function setOnboardingStep(step: number): Promise<ActionResult<{ step: number }>> {
  try {
    const ctx = await requireStoreContext();
    await Store.updateOne({ _id: ctx.storeId }, { $set: { onboardingStep: Math.max(0, step) } });
    return ok({ step });
  } catch (err) {
    return fail(err);
  }
}

export async function completeOnboarding(): Promise<ActionResult<{ done: true }>> {
  try {
    const ctx = await requireStoreContext();
    await Store.updateOne(
      { _id: ctx.storeId },
      { $set: { onboardingCompleted: true, onboardingStep: 5 } },
    );
    revalidatePath("/", "layout");
    return ok({ done: true });
  } catch (err) {
    return fail(err);
  }
}

/** Wipe seeded demo rows without touching anything a real user entered. */
export async function clearDemoData(): Promise<ActionResult<{ removed: number }>> {
  try {
    const ctx = await requirePermission("settings:manage");
    await connectToDatabase();

    const models = await import("@/lib/db/models");
    const collections = [
      models.SaleItem, models.Sale, models.Payment, models.InventoryMovement,
      models.Expense, models.Product, models.Customer, models.Notification,
    ];

    let removed = 0;
    for (const model of collections) {
      const r = await (model as { deleteMany: (f: object) => Promise<{ deletedCount: number }> }).deleteMany({
        storeId: ctx.storeId,
        isDemo: true,
      });
      removed += r.deletedCount;
    }
    await models.Store.updateOne({ _id: ctx.storeId }, { $set: { isDemo: false } });

    revalidatePath("/", "layout");
    return ok({ removed });
  } catch (err) {
    return fail(err);
  }
}

/** Irreversible: removes the store and every record inside it. Owner only. */
export async function deleteStore(confirmName: string): Promise<ActionResult<never>> {
  const ctx = await requirePermission("store:delete");
  if (confirmName.trim() !== ctx.store.name) {
    return fail(
      new AppError("VALIDATION", "Type the store name exactly to confirm.", {
        fields: { confirmName: "Does not match" },
      }),
    );
  }

  await connectToDatabase();
  const models = await import("@/lib/db/models");
  const tenantModels = [
    models.SaleItem, models.Sale, models.Payment, models.InventoryMovement,
    models.Expense, models.Product, models.Customer, models.Category,
    models.Notification, models.Counter, models.Membership,
  ];
  for (const model of tenantModels) {
    await (model as { deleteMany: (f: object) => Promise<unknown> }).deleteMany({ storeId: ctx.storeId });
  }
  await models.Store.deleteOne({ _id: ctx.storeId });
  await models.UserProfile.updateMany({ activeStoreId: ctx.storeId }, { $unset: { activeStoreId: 1 } });

  revalidatePath("/", "layout");
  redirect("/onboarding");
}
