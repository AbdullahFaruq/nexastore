"use server";

import { revalidatePath } from "next/cache";
import { Types } from "mongoose";
import { requirePermission, toObjectId } from "@/lib/auth/context";
import { connectToDatabase } from "@/lib/db/connect";
import { withTransaction } from "@/lib/db/tx";
import { InventoryMovement } from "@/lib/db/models/inventory-movement";
import { Product } from "@/lib/db/models/product";
import { SaleItem } from "@/lib/db/models/sale-item";
import { AppError, fail, notFound, ok, type ActionResult } from "@/lib/errors";
import { parseMoney } from "@/lib/format/currency";
import { productSchema, bulkStockSchema } from "@/lib/validation/schemas";
import { parseOrThrow } from "@/lib/validation/common";

function pricesFrom(input: Record<string, unknown>, currency: string) {
  const cost = parseMoney(String(input.costPrice ?? "0"), currency);
  const price = parseMoney(String(input.price ?? "0"), currency);
  const discountRaw = String(input.discountPrice ?? "").trim();
  const discount = discountRaw === "" ? null : parseMoney(discountRaw, currency);

  if (cost === null) throw new AppError("VALIDATION", "Enter a valid cost price.", { fields: { costPrice: "Invalid amount" } });
  if (price === null) throw new AppError("VALIDATION", "Enter a valid selling price.", { fields: { price: "Invalid amount" } });
  if (cost < 0 || price < 0) {
    throw new AppError("VALIDATION", "Prices cannot be negative.", { fields: { price: "Must be zero or more" } });
  }
  if (discount !== null && discount >= price) {
    throw new AppError("VALIDATION", "The discount price must be lower than the selling price.", {
      fields: { discountPrice: "Must be below the selling price" },
    });
  }
  return { cost, price, discount };
}

export async function createProduct(raw: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const ctx = await requirePermission("products:write");
    const input = parseOrThrow(productSchema, raw);
    const { cost, price, discount } = pricesFrom(input as Record<string, unknown>, ctx.currency);

    await connectToDatabase();

    const categoryId = toObjectId(input.categoryId);
    if (input.categoryId && !categoryId) throw new AppError("VALIDATION", "Unknown category.");
    if (categoryId) {
      const { Category } = await import("@/lib/db/models/category");
      const exists = await Category.exists({ _id: categoryId, storeId: ctx.storeId });
      if (!exists) throw notFound("That category");
    }

    const product = await withTransaction(async (session) => {
      const [created] = await Product.create(
        [
          {
            storeId: ctx.storeId,
            name: input.name,
            sku: input.sku,
            barcode: input.barcode || undefined,
            description: input.description,
            images: input.images ?? [],
            categoryId,
            supplier: input.supplier,
            costPrice: cost,
            price,
            discountPrice: discount,
            stock: input.stock,
            minStock: input.minStock,
            taxRateBps: Math.round(input.taxRatePct * 100),
            unit: input.unit,
            status: input.status,
          },
        ],
        { session, ordered: true },
      );

      // Opening stock is a real inventory event and belongs in the ledger.
      if (input.stock > 0) {
        await InventoryMovement.create(
          [
            {
              storeId: ctx.storeId,
              productId: created._id,
              productName: created.name,
              sku: created.sku,
              type: "initial",
              quantity: input.stock,
              stockBefore: 0,
              stockAfter: input.stock,
              unitCost: cost,
              reason: "Opening stock",
              createdBy: ctx.user.userId,
              createdByName: ctx.user.displayName,
            },
          ],
          { session, ordered: true },
        );
      }
      return created;
    });

    revalidatePath("/products");
    revalidatePath("/inventory");
    return ok({ id: String(product._id) });
  } catch (err) {
    return fail(err);
  }
}

export async function updateProduct(id: string, raw: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const ctx = await requirePermission("products:write");
    const input = parseOrThrow(productSchema, raw);
    const { cost, price, discount } = pricesFrom(input as Record<string, unknown>, ctx.currency);

    await connectToDatabase();
    const productId = toObjectId(id);
    if (!productId) throw notFound("That product");

    const existing = await Product.findOne({ _id: productId, storeId: ctx.storeId });
    if (!existing) throw notFound("That product");

    const categoryId = toObjectId(input.categoryId);
    const stockChanged = input.stock !== existing.stock;
    const stockBefore = existing.stock;

    await withTransaction(async (session) => {
      await Product.updateOne(
        { _id: productId, storeId: ctx.storeId },
        {
          $set: {
            name: input.name,
            sku: input.sku,
            barcode: input.barcode || undefined,
            description: input.description,
            images: input.images ?? [],
            categoryId,
            supplier: input.supplier,
            costPrice: cost,
            price,
            discountPrice: discount,
            stock: input.stock,
            minStock: input.minStock,
            taxRateBps: Math.round(input.taxRatePct * 100),
            unit: input.unit,
            status: input.status,
          },
        },
        { session },
      );

      // Editing the stock field is an adjustment, and it is logged as one.
      if (stockChanged) {
        await InventoryMovement.create(
          [
            {
              storeId: ctx.storeId,
              productId,
              productName: input.name,
              sku: input.sku,
              type: "adjustment",
              quantity: input.stock - stockBefore,
              stockBefore,
              stockAfter: input.stock,
              reason: "Adjusted while editing the product",
              createdBy: ctx.user.userId,
              createdByName: ctx.user.displayName,
            },
          ],
          { session, ordered: true },
        );
      }
    });

    revalidatePath("/products");
    revalidatePath(`/products/${id}`);
    revalidatePath("/inventory");
    return ok({ id });
  } catch (err) {
    return fail(err);
  }
}

/**
 * Products that have sold are archived, never deleted - deleting one would
 * orphan its sale history and silently change past revenue. Only a product
 * that has never sold can actually be removed.
 */
export async function deleteProduct(id: string): Promise<ActionResult<{ archived: boolean }>> {
  try {
    const ctx = await requirePermission("products:delete");
    await connectToDatabase();
    const productId = toObjectId(id);
    if (!productId) throw notFound("That product");

    const product = await Product.findOne({ _id: productId, storeId: ctx.storeId });
    if (!product) throw notFound("That product");

    const soldCount = await SaleItem.countDocuments({ storeId: ctx.storeId, productId });

    if (soldCount > 0) {
      await Product.updateOne({ _id: productId, storeId: ctx.storeId }, { $set: { status: "archived" } });
      revalidatePath("/products");
      revalidatePath("/inventory");
      return ok({ archived: true });
    }

    await withTransaction(async (session) => {
      await Product.deleteOne({ _id: productId, storeId: ctx.storeId }, { session });
      await InventoryMovement.deleteMany({ storeId: ctx.storeId, productId }, { session });
    });

    revalidatePath("/products");
    revalidatePath("/inventory");
    return ok({ archived: false });
  } catch (err) {
    return fail(err);
  }
}

export async function bulkUpdateProducts(raw: unknown): Promise<ActionResult<{ updated: number }>> {
  try {
    const ctx = await requirePermission("products:write");
    const input = parseOrThrow(bulkStockSchema, raw);
    await connectToDatabase();

    const ids = input.productIds.map((i) => new Types.ObjectId(i));
    const filter = { storeId: ctx.storeId, _id: { $in: ids } };

    switch (input.action) {
      case "archive": {
        const r = await Product.updateMany(filter, { $set: { status: "archived" } });
        revalidatePath("/products");
        return ok({ updated: r.modifiedCount });
      }
      case "activate": {
        const r = await Product.updateMany(filter, { $set: { status: "active" } });
        revalidatePath("/products");
        return ok({ updated: r.modifiedCount });
      }
      case "set_min_stock": {
        if (input.minStock === undefined) throw new AppError("VALIDATION", "Enter a reorder point.");
        const r = await Product.updateMany(filter, { $set: { minStock: input.minStock } });
        revalidatePath("/inventory");
        return ok({ updated: r.modifiedCount });
      }
      case "set_category": {
        const categoryId = toObjectId(input.categoryId);
        const r = await Product.updateMany(filter, { $set: { categoryId } });
        revalidatePath("/products");
        return ok({ updated: r.modifiedCount });
      }
      case "delete": {
        await requirePermission("products:delete");
        const sold = await SaleItem.distinct("productId", { storeId: ctx.storeId, productId: { $in: ids } });
        const soldSet = new Set(sold.map(String));
        const deletable = ids.filter((i) => !soldSet.has(String(i)));

        await Product.updateMany(
          { storeId: ctx.storeId, _id: { $in: [...soldSet].map((s) => new Types.ObjectId(s)) } },
          { $set: { status: "archived" } },
        );
        const r = await Product.deleteMany({ storeId: ctx.storeId, _id: { $in: deletable } });
        revalidatePath("/products");
        return ok({ updated: r.deletedCount + soldSet.size });
      }
    }
  } catch (err) {
    return fail(err);
  }
}
