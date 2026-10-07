"use server";

import { revalidatePath } from "next/cache";
import { requirePermission, toObjectId } from "@/lib/auth/context";
import { connectToDatabase } from "@/lib/db/connect";
import { withTransaction } from "@/lib/db/tx";
import { InventoryMovement } from "@/lib/db/models/inventory-movement";
import { Product } from "@/lib/db/models/product";
import { AppError, fail, notFound, ok, type ActionResult } from "@/lib/errors";
import { parseMoney } from "@/lib/format/currency";
import { stockAdjustmentSchema } from "@/lib/validation/schemas";
import { parseOrThrow } from "@/lib/validation/common";

/**
 * Move stock and write the ledger row that explains it, together.
 * Sales are excluded here by the schema - stock leaves through a sale, and a
 * sale is the only thing that may record it, or the two ledgers disagree.
 */
export async function adjustStock(
  raw: unknown,
): Promise<ActionResult<{ productId: string; stock: number }>> {
  try {
    const ctx = await requirePermission("inventory:adjust");
    const input = parseOrThrow(stockAdjustmentSchema, raw);
    await connectToDatabase();

    const productId = toObjectId(input.productId);
    if (!productId) throw notFound("That product");

    const unitCost =
      input.unitCost !== undefined && String(input.unitCost).trim() !== ""
        ? parseMoney(String(input.unitCost), ctx.currency)
        : null;

    const stock = await withTransaction(async (session) => {
      const product = await Product.findOne({ _id: productId, storeId: ctx.storeId }).session(
        session ?? null,
      );
      if (!product) throw notFound("That product");

      // Damage and returns describe a direction, so their sign is implied.
      let delta = input.quantity;
      if (input.type === "damage") delta = -Math.abs(input.quantity);
      if (input.type === "purchase" || input.type === "return" || input.type === "initial") {
        delta = Math.abs(input.quantity);
      }

      const before = product.stock;
      const after = before + delta;
      if (after < 0) {
        throw new AppError(
          "INSUFFICIENT_STOCK",
          `That would take ${product.name} to ${after} units. There are only ${before} in stock.`,
          { fields: { quantity: `At most ${before}` } },
        );
      }

      await Product.updateOne(
        { _id: productId, storeId: ctx.storeId },
        {
          $set: { stock: after },
          // A purchase at a new price updates the cost basis for future sales.
          ...(unitCost !== null && input.type === "purchase" ? { $max: { costPrice: 0 } } : {}),
        },
        { session },
      );

      if (unitCost !== null && input.type === "purchase") {
        await Product.updateOne(
          { _id: productId, storeId: ctx.storeId },
          { $set: { costPrice: unitCost } },
          { session },
        );
      }

      await InventoryMovement.create(
        [
          {
            storeId: ctx.storeId,
            productId,
            productName: product.name,
            sku: product.sku,
            type: input.type,
            quantity: delta,
            stockBefore: before,
            stockAfter: after,
            unitCost: unitCost ?? product.costPrice,
            reason: input.reason,
            createdBy: ctx.user.userId,
            createdByName: ctx.user.displayName,
          },
        ],
        { session, ordered: true },
      );

      return after;
    });

    revalidatePath("/inventory");
    revalidatePath("/products");
    revalidatePath(`/products/${input.productId}`);
    return ok({ productId: input.productId, stock });
  } catch (err) {
    return fail(err);
  }
}
