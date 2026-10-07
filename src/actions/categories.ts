"use server";

import { revalidatePath } from "next/cache";
import { requirePermission, toObjectId } from "@/lib/auth/context";
import { connectToDatabase } from "@/lib/db/connect";
import { Category } from "@/lib/db/models/category";
import { Product } from "@/lib/db/models/product";
import { AppError, fail, notFound, ok, type ActionResult } from "@/lib/errors";
import { slugify } from "@/lib/utils";
import { categorySchema } from "@/lib/validation/schemas";
import { parseOrThrow } from "@/lib/validation/common";

export async function createCategory(raw: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const ctx = await requirePermission("products:write");
    const input = parseOrThrow(categorySchema, raw);
    await connectToDatabase();

    const slug = slugify(input.name);
    if (!slug) throw new AppError("VALIDATION", "Give the category a usable name.");

    const clash = await Category.exists({ storeId: ctx.storeId, slug });
    if (clash) throw new AppError("CONFLICT", "A category with that name already exists.", { fields: { name: "Already in use" } });

    const count = await Category.countDocuments({ storeId: ctx.storeId });
    const created = await Category.create({
      storeId: ctx.storeId,
      name: input.name,
      slug,
      description: input.description,
      colorSlot: input.colorSlot,
      sortOrder: count,
    });

    revalidatePath("/categories");
    revalidatePath("/products");
    return ok({ id: String(created._id) });
  } catch (err) {
    return fail(err);
  }
}

export async function updateCategory(id: string, raw: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const ctx = await requirePermission("products:write");
    const input = parseOrThrow(categorySchema, raw);
    await connectToDatabase();

    const categoryId = toObjectId(id);
    if (!categoryId) throw notFound("That category");

    const slug = slugify(input.name);
    const clash = await Category.exists({ storeId: ctx.storeId, slug, _id: { $ne: categoryId } });
    if (clash) throw new AppError("CONFLICT", "Another category already uses that name.", { fields: { name: "Already in use" } });

    const r = await Category.updateOne(
      { _id: categoryId, storeId: ctx.storeId },
      { $set: { name: input.name, slug, description: input.description, colorSlot: input.colorSlot } },
    );
    if (r.matchedCount === 0) throw notFound("That category");

    revalidatePath("/categories");
    revalidatePath("/products");
    return ok({ id });
  } catch (err) {
    return fail(err);
  }
}

/** Deleting a category detaches its products rather than deleting them. */
export async function deleteCategory(id: string): Promise<ActionResult<{ detached: number }>> {
  try {
    const ctx = await requirePermission("products:delete");
    await connectToDatabase();
    const categoryId = toObjectId(id);
    if (!categoryId) throw notFound("That category");

    const category = await Category.findOne({ _id: categoryId, storeId: ctx.storeId });
    if (!category) throw notFound("That category");

    const r = await Product.updateMany(
      { storeId: ctx.storeId, categoryId },
      { $set: { categoryId: null } },
    );
    await Category.deleteOne({ _id: categoryId, storeId: ctx.storeId });

    revalidatePath("/categories");
    revalidatePath("/products");
    return ok({ detached: r.modifiedCount });
  } catch (err) {
    return fail(err);
  }
}
