"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/context";
import type { StoreContext } from "@/lib/auth/context";
import { fail, ok, type ActionResult } from "@/lib/errors";
import {
  cancelSale as cancelSaleService,
  completePendingSale,
  createSale as createSaleService,
  refundSale as refundSaleService,
  type SaleActor,
} from "@/lib/sales/service";
import { createSaleSchema, refundSaleSchema } from "@/lib/validation/schemas";
import { parseOrThrow } from "@/lib/validation/common";

function actorFrom(ctx: StoreContext): SaleActor {
  return {
    storeId: ctx.storeId,
    userId: ctx.user.userId,
    userName: ctx.user.displayName,
    taxMode: ctx.store.settings?.taxMode ?? "exclusive",
    orderPrefix: ctx.store.settings?.orderPrefix ?? "NX",
  };
}

export interface CompletedSaleSummary {
  id: string;
  orderNumber: string;
  total: number;
  changeGiven: number;
  itemCount: number;
  status: string;
  lowStock: { name: string; stock: number }[];
}

/**
 * Record a sale. The client sends product ids, quantities and a discount -
 * never prices - and every figure comes back computed by the server.
 */
export async function createSale(raw: unknown): Promise<ActionResult<CompletedSaleSummary>> {
  try {
    const ctx = await requirePermission("sales:create");
    const input = parseOrThrow(createSaleSchema, raw);

    const { sale, lowStock } = await createSaleService(actorFrom(ctx), {
      items: input.items,
      customerId: input.customerId,
      orderDiscount: input.orderDiscount,
      paymentMethod: input.paymentMethod,
      status: input.status,
      amountPaid: input.amountPaid,
      note: input.note,
      soldAt: input.soldAt,
      channel: "pos",
    });

    revalidatePath("/sales");
    revalidatePath("/dashboard");
    revalidatePath("/inventory");
    revalidatePath("/products");

    return ok({
      id: String(sale._id),
      orderNumber: sale.orderNumber,
      total: sale.total,
      changeGiven: sale.changeGiven,
      itemCount: sale.itemCount,
      status: sale.status,
      lowStock,
    });
  } catch (err) {
    return fail(err);
  }
}

export async function refundSale(raw: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const ctx = await requirePermission("sales:refund");
    const input = parseOrThrow(refundSaleSchema, raw);

    const sale = await refundSaleService(actorFrom(ctx), input.saleId, {
      reason: input.reason,
      restock: input.restock,
    });

    revalidatePath("/sales");
    revalidatePath(`/sales/${input.saleId}`);
    revalidatePath("/dashboard");
    revalidatePath("/inventory");
    return ok({ id: String(sale._id) });
  } catch (err) {
    return fail(err);
  }
}

export async function cancelSale(saleId: string, reason?: string): Promise<ActionResult<{ id: string }>> {
  try {
    const ctx = await requirePermission("sales:void");
    const sale = await cancelSaleService(actorFrom(ctx), saleId, reason);
    revalidatePath("/sales");
    revalidatePath(`/sales/${saleId}`);
    revalidatePath("/dashboard");
    return ok({ id: String(sale._id) });
  } catch (err) {
    return fail(err);
  }
}

/**
 * Edit the non-financial parts of an order.
 *
 * Amounts, lines and taxes are deliberately NOT editable: quietly rewriting a
 * completed sale would change history and break every report that already
 * counted it. A mistaken sale is corrected by refunding it, which leaves the
 * original and its reversal both on the record.
 */
export async function updateSaleDetails(
  saleId: string,
  input: { note?: string; customerId?: string | null },
): Promise<ActionResult<{ id: string }>> {
  try {
    const ctx = await requirePermission("sales:create");
    const { Types } = await import("mongoose");
    const { Sale } = await import("@/lib/db/models/sale");
    const { Customer } = await import("@/lib/db/models/customer");
    const { connectToDatabase } = await import("@/lib/db/connect");
    const { notFound } = await import("@/lib/errors");

    if (!Types.ObjectId.isValid(saleId)) throw notFound("That order");
    await connectToDatabase();

    const set: Record<string, unknown> = {};
    if (input.note !== undefined) set.note = input.note.slice(0, 1000);

    if (input.customerId !== undefined) {
      if (input.customerId && Types.ObjectId.isValid(input.customerId)) {
        const customer = await Customer.findOne({
          storeId: ctx.storeId,
          _id: new Types.ObjectId(input.customerId),
        }).lean();
        if (!customer) throw notFound("That customer");
        set.customerId = customer._id;
        set.customerName = customer.name;
      } else {
        set.customerId = null;
        set.customerName = undefined;
      }
    }

    const r = await Sale.updateOne({ _id: new Types.ObjectId(saleId), storeId: ctx.storeId }, { $set: set });
    if (r.matchedCount === 0) throw notFound("That order");

    revalidatePath(`/sales/${saleId}`);
    revalidatePath("/sales");
    return ok({ id: saleId });
  } catch (err) {
    return fail(err);
  }
}

export async function markSalePaid(
  saleId: string,
  paymentMethod?: "cash" | "card" | "bank_transfer" | "mobile" | "other",
): Promise<ActionResult<{ id: string }>> {
  try {
    const ctx = await requirePermission("sales:create");
    const sale = await completePendingSale(actorFrom(ctx), saleId, { paymentMethod });
    revalidatePath("/sales");
    revalidatePath(`/sales/${saleId}`);
    revalidatePath("/dashboard");
    return ok({ id: String(sale._id) });
  } catch (err) {
    return fail(err);
  }
}
