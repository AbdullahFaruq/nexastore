import { Types, type ClientSession } from "mongoose";
import { connectToDatabase } from "@/lib/db/connect";
import { withTransaction } from "@/lib/db/tx";
import { Counter } from "@/lib/db/models/counter";
import { Customer } from "@/lib/db/models/customer";
import { InventoryMovement } from "@/lib/db/models/inventory-movement";
import { Notification } from "@/lib/db/models/notification";
import { Payment } from "@/lib/db/models/payment";
import { Product, effectivePrice, type ProductDoc } from "@/lib/db/models/product";
import { Sale, type SaleDoc } from "@/lib/db/models/sale";
import { SaleItem } from "@/lib/db/models/sale-item";
import type { PaymentMethod, SaleStatus } from "@/lib/db/models/enums";
import { AppError, notFound } from "@/lib/errors";
import { computeSaleTotals, type TaxMode } from "./pricing";

export interface SaleActor {
  storeId: Types.ObjectId;
  userId: string;
  userName?: string;
  taxMode: TaxMode;
  orderPrefix: string;
  isDemo?: boolean;
}

export interface SaleLineInput {
  productId: string;
  quantity: number;
  lineDiscount?: number;
}

export interface CreateSaleInput {
  items: SaleLineInput[];
  customerId?: string | null;
  orderDiscount?: number;
  paymentMethod?: PaymentMethod;
  status?: "completed" | "pending";
  amountPaid?: number;
  note?: string;
  soldAt?: Date;
  channel?: "pos" | "online" | "manual";
}

/**
 * Reserve the next order number for a store.
 *
 * A single-document $inc, so two tills completing a sale at the same instant
 * can never receive the same number - which counting the collection would do.
 */
export async function nextOrderNumber(
  storeId: Types.ObjectId,
  prefix: string,
  session?: ClientSession,
): Promise<{ orderNumber: string; sequence: number }> {
  const counter = await Counter.findOneAndUpdate(
    { storeId, key: "order" },
    { $inc: { value: 1 } },
    { upsert: true, returnDocument: "after", session },
  );
  const sequence = counter.value;
  return { orderNumber: `${prefix}-${String(sequence).padStart(6, "0")}`, sequence };
}

/**
 * Recompute a customer's lifetime figures from the sale ledger.
 *
 * Deliberately a full recount rather than an increment: refunds, cancellations
 * and edits all flow through here, and a recount cannot drift the way a running
 * total can.
 */
export async function recomputeCustomerStats(
  storeId: Types.ObjectId,
  customerId: Types.ObjectId,
  session?: ClientSession,
) {
  const rows = await Sale.aggregate([
    { $match: { storeId, customerId, status: { $in: ["completed", "refunded"] } } },
    {
      $group: {
        _id: null,
        totalSpent: { $sum: { $subtract: ["$netRevenue", "$refundedRevenue"] } },
        totalOrders: { $sum: { $cond: [{ $eq: ["$status", "refunded"] }, 0, 1] } },
        firstPurchaseAt: { $min: "$soldAt" },
        lastPurchaseAt: { $max: "$soldAt" },
      },
    },
  ]).session(session ?? null);

  const r = rows[0] ?? { totalSpent: 0, totalOrders: 0, firstPurchaseAt: null, lastPurchaseAt: null };
  await Customer.updateOne(
    { _id: customerId, storeId },
    {
      $set: {
        totalSpent: Math.max(0, r.totalSpent),
        totalOrders: r.totalOrders,
        firstPurchaseAt: r.firstPurchaseAt,
        lastPurchaseAt: r.lastPurchaseAt,
      },
    },
    { session },
  );
}

/** Raise a low-stock notice once per product per day, never twice for the same fact. */
async function maybeNotifyLowStock(
  actor: SaleActor,
  products: { _id: Types.ObjectId; name: string; stock: number; minStock: number }[],
  session?: ClientSession,
) {
  const day = new Date().toISOString().slice(0, 10);
  const notices = products
    .filter((p) => p.stock <= p.minStock)
    .map((p) => ({
      storeId: actor.storeId,
      type: p.stock <= 0 ? ("out_of_stock" as const) : ("low_stock" as const),
      priority: p.stock <= 0 ? ("critical" as const) : ("high" as const),
      title: p.stock <= 0 ? `${p.name} is out of stock` : `${p.name} is running low`,
      body:
        p.stock <= 0
          ? "This product sold out and cannot be sold again until restocked."
          : `Only ${p.stock} left, at or below the reorder point of ${p.minStock}.`,
      href: `/products/${p._id.toString()}`,
      dedupeKey: `${actor.storeId}:stock:${p._id}:${p.stock <= 0 ? "out" : "low"}:${day}`,
      isDemo: Boolean(actor.isDemo),
    }));

  if (notices.length === 0) return;
  try {
    await Notification.insertMany(notices, { session, ordered: false });
  } catch {
    // A duplicate dedupeKey means the alert already exists - that is the point.
  }
}

export interface CreateSaleResult {
  sale: SaleDoc;
  lowStock: { name: string; stock: number }[];
}

/**
 * Record a sale.
 *
 * Everything monetary is derived server-side from the store's own product
 * records - the caller supplies product ids, quantities and a discount, never
 * prices or totals. Sale header, line items, stock levels, the inventory
 * ledger and the payment row are written together, so a decremented stock
 * level without a sale behind it is not a reachable state.
 */
export async function createSale(
  actor: SaleActor,
  input: CreateSaleInput,
): Promise<CreateSaleResult> {
  await connectToDatabase();

  if (!input.items?.length) {
    throw new AppError("VALIDATION", "Add at least one product to the sale.");
  }

  // Collapse duplicate scans of the same product into one line.
  const merged = new Map<string, SaleLineInput>();
  for (const item of input.items) {
    const existing = merged.get(item.productId);
    if (existing) {
      existing.quantity += item.quantity;
      existing.lineDiscount = (existing.lineDiscount ?? 0) + (item.lineDiscount ?? 0);
    } else {
      merged.set(item.productId, { ...item });
    }
  }
  const lines = [...merged.values()];

  const productIds = lines.map((l) => {
    if (!Types.ObjectId.isValid(l.productId)) {
      throw new AppError("VALIDATION", "One of the items is not a valid product.");
    }
    return new Types.ObjectId(l.productId);
  });

  return withTransaction(async (session) => {
    // Tenant-scoped read: a product id from another store simply will not resolve.
    const products = await Product.find({ storeId: actor.storeId, _id: { $in: productIds } })
      .session(session ?? null)
      .lean<ProductDoc[]>();

    const byId = new Map(products.map((p) => [String(p._id), p]));

    for (const line of lines) {
      const p = byId.get(line.productId);
      if (!p) throw notFound("One of the products in this sale");
      if (p.status === "archived") {
        throw new AppError("INVALID_STATE", `${p.name} is archived and cannot be sold.`);
      }
      if (line.quantity > p.stock) {
        throw new AppError(
          "INSUFFICIENT_STOCK",
          p.stock <= 0
            ? `${p.name} is out of stock.`
            : `Only ${p.stock} of ${p.name} left in stock - you tried to sell ${line.quantity}.`,
          { fields: { [line.productId]: `Only ${p.stock} available` } },
        );
      }
    }

    // Prices and costs come from OUR records, never from the request body.
    const totals = computeSaleTotals(
      lines.map((line) => {
        const p = byId.get(line.productId)!;
        return {
          productId: line.productId,
          quantity: line.quantity,
          unitPrice: effectivePrice(p),
          unitCost: p.costPrice,
          lineDiscount: line.lineDiscount ?? 0,
          taxRateBps: p.taxRateBps,
        };
      }),
      { orderDiscount: input.orderDiscount ?? 0, taxMode: actor.taxMode },
    );

    const status: SaleStatus = input.status ?? "completed";
    const soldAt = input.soldAt ?? new Date();
    const { orderNumber, sequence } = await nextOrderNumber(actor.storeId, actor.orderPrefix, session);

    let customerId: Types.ObjectId | null = null;
    let customerName: string | undefined;
    if (input.customerId && Types.ObjectId.isValid(input.customerId)) {
      const customer = await Customer.findOne({
        storeId: actor.storeId,
        _id: new Types.ObjectId(input.customerId),
      })
        .session(session ?? null)
        .lean();
      if (!customer) throw notFound("That customer");
      customerId = customer._id;
      customerName = customer.name;
    }

    const amountPaid = status === "completed" ? (input.amountPaid || totals.total) : (input.amountPaid ?? 0);
    const paymentMethod = input.paymentMethod ?? "cash";

    const [sale] = await Sale.create(
      [
        {
          storeId: actor.storeId,
          orderNumber,
          sequence,
          customerId,
          customerName,
          grossAmount: totals.grossAmount,
          lineDiscountTotal: totals.lineDiscountTotal,
          orderDiscount: totals.orderDiscount,
          discountTotal: totals.discountTotal,
          netRevenue: totals.netRevenue,
          taxTotal: totals.taxTotal,
          total: totals.total,
          cogsTotal: totals.cogsTotal,
          itemCount: totals.itemCount,
          lineCount: totals.lineCount,
          status,
          paymentMethod,
          paymentStatus: status === "completed" ? "paid" : "unpaid",
          amountPaid,
          changeGiven: Math.max(0, amountPaid - totals.total),
          channel: input.channel ?? "pos",
          note: input.note,
          soldAt,
          createdBy: actor.userId,
          createdByName: actor.userName,
          isDemo: Boolean(actor.isDemo),
        },
      ],
      { session, ordered: true },
    );

    await SaleItem.insertMany(
      totals.lines.map((l) => {
        const p = byId.get(l.productId)!;
        return {
          storeId: actor.storeId,
          saleId: sale._id,
          orderNumber,
          productId: p._id,
          categoryId: p.categoryId ?? null,
          productName: p.name,
          sku: p.sku,
          productImage: p.images?.[0],
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          unitCost: l.unitCost,
          lineDiscount: l.lineDiscount,
          allocatedOrderDiscount: l.allocatedOrderDiscount,
          taxRateBps: l.taxRateBps,
          grossAmount: l.grossAmount,
          netRevenue: l.netRevenue,
          taxAmount: l.taxAmount,
          cogsAmount: l.cogsAmount,
          status,
          soldAt,
          isDemo: Boolean(actor.isDemo),
        };
      }),
      { session, ordered: true },
    );

    // Stock down, one movement row per line - the ledger explains every change.
    const movements = [];
    const lowStock: { name: string; stock: number }[] = [];
    const afterStock: { _id: Types.ObjectId; name: string; stock: number; minStock: number }[] = [];

    for (const l of totals.lines) {
      const p = byId.get(l.productId)!;
      const before = p.stock;
      const after = before - l.quantity;

      await Product.updateOne(
        { _id: p._id, storeId: actor.storeId },
        { $inc: { stock: -l.quantity } },
        { session },
      );

      movements.push({
        storeId: actor.storeId,
        productId: p._id,
        productName: p.name,
        sku: p.sku,
        type: "sale" as const,
        quantity: -l.quantity,
        stockBefore: before,
        stockAfter: after,
        unitCost: l.unitCost,
        saleId: sale._id,
        orderNumber,
        createdBy: actor.userId,
        createdByName: actor.userName,
        isDemo: Boolean(actor.isDemo),
      });

      afterStock.push({ _id: p._id, name: p.name, stock: after, minStock: p.minStock });
      if (after <= p.minStock) lowStock.push({ name: p.name, stock: after });
    }

    await InventoryMovement.insertMany(movements, { session, ordered: true });

    if (status === "completed" && amountPaid > 0) {
      await Payment.create(
        [
          {
            storeId: actor.storeId,
            saleId: sale._id,
            orderNumber,
            method: paymentMethod,
            amount: Math.min(amountPaid, totals.total),
            kind: "capture",
            createdBy: actor.userId,
            isDemo: Boolean(actor.isDemo),
          },
        ],
        { session, ordered: true },
      );
    }

    if (customerId) await recomputeCustomerStats(actor.storeId, customerId, session);
    if (!actor.isDemo) await maybeNotifyLowStock(actor, afterStock, session);

    return { sale: sale.toObject() as SaleDoc, lowStock };
  });
}

/**
 * Reverse a completed sale in full: revenue and cost are backed out, the goods
 * go back on the shelf, and a negative payment records the money leaving.
 * History is never edited - the original sale keeps its figures and gains a
 * refunded counterpart, which is what makes the ledger auditable.
 */
export async function refundSale(
  actor: SaleActor,
  saleId: string,
  opts: { reason?: string; restock?: boolean } = {},
) {
  await connectToDatabase();
  if (!Types.ObjectId.isValid(saleId)) throw notFound("That order");

  return withTransaction(async (session) => {
    const sale = await Sale.findOne({ _id: new Types.ObjectId(saleId), storeId: actor.storeId }).session(
      session ?? null,
    );
    if (!sale) throw notFound("That order");
    if (sale.status === "refunded") {
      throw new AppError("INVALID_STATE", "This order has already been refunded.");
    }
    if (sale.status === "cancelled") {
      throw new AppError("INVALID_STATE", "A cancelled order has nothing to refund.");
    }

    const items = await SaleItem.find({ saleId: sale._id, storeId: actor.storeId }).session(
      session ?? null,
    );

    const restock = opts.restock !== false;
    if (restock) {
      for (const item of items) {
        const product = await Product.findOne({ _id: item.productId, storeId: actor.storeId })
          .select({ stock: 1, name: 1, sku: 1 })
          .session(session ?? null);
        if (!product) continue; // Product deleted since; the refund still stands.

        const before = product.stock;
        await Product.updateOne(
          { _id: item.productId, storeId: actor.storeId },
          { $inc: { stock: item.quantity } },
          { session },
        );
        await InventoryMovement.create(
          [
            {
              storeId: actor.storeId,
              productId: item.productId,
              productName: product.name,
              sku: product.sku,
              type: "return",
              quantity: item.quantity,
              stockBefore: before,
              stockAfter: before + item.quantity,
              unitCost: item.unitCost,
              saleId: sale._id,
              orderNumber: sale.orderNumber,
              reason: opts.reason || "Order refunded",
              createdBy: actor.userId,
              createdByName: actor.userName,
              isDemo: Boolean(actor.isDemo),
            },
          ],
          { session, ordered: true },
        );
      }
    }

    // An update pipeline, so each line reverses its own figures in one pass.
    // Mongoose 9 requires updatePipeline: true to accept an array here.
    await SaleItem.updateMany(
      { saleId: sale._id, storeId: actor.storeId },
      [
        {
          $set: {
            status: "refunded",
            refundedQuantity: "$quantity",
            refundedRevenue: "$netRevenue",
            refundedCogs: "$cogsAmount",
          },
        },
      ],
      { session, updatePipeline: true },
    );

    sale.status = "refunded";
    sale.paymentStatus = "refunded";
    sale.refundedRevenue = sale.netRevenue;
    sale.refundedTax = sale.taxTotal;
    sale.refundedCogs = sale.cogsTotal;
    sale.refundedAt = new Date();
    sale.refundReason = opts.reason;
    await sale.save({ session });

    await Payment.create(
      [
        {
          storeId: actor.storeId,
          saleId: sale._id,
          orderNumber: sale.orderNumber,
          method: sale.paymentMethod,
          amount: -sale.total,
          kind: "refund",
          reference: opts.reason,
          createdBy: actor.userId,
          isDemo: Boolean(actor.isDemo),
        },
      ],
      { session, ordered: true },
    );

    if (sale.customerId) await recomputeCustomerStats(actor.storeId, sale.customerId, session);

    return sale.toObject() as SaleDoc;
  });
}

/** Cancel a pending order: nothing was earned, so the stock simply goes back. */
export async function cancelSale(actor: SaleActor, saleId: string, reason?: string) {
  await connectToDatabase();
  if (!Types.ObjectId.isValid(saleId)) throw notFound("That order");

  return withTransaction(async (session) => {
    const sale = await Sale.findOne({ _id: new Types.ObjectId(saleId), storeId: actor.storeId }).session(
      session ?? null,
    );
    if (!sale) throw notFound("That order");
    if (sale.status === "completed") {
      throw new AppError(
        "INVALID_STATE",
        "This order is already completed. Refund it instead of cancelling.",
      );
    }
    if (sale.status !== "pending") {
      throw new AppError("INVALID_STATE", `A ${sale.status} order cannot be cancelled.`);
    }

    const items = await SaleItem.find({ saleId: sale._id, storeId: actor.storeId }).session(
      session ?? null,
    );

    for (const item of items) {
      const product = await Product.findOne({ _id: item.productId, storeId: actor.storeId })
        .select({ stock: 1, name: 1, sku: 1 })
        .session(session ?? null);
      if (!product) continue;
      const before = product.stock;
      await Product.updateOne(
        { _id: item.productId, storeId: actor.storeId },
        { $inc: { stock: item.quantity } },
        { session },
      );
      await InventoryMovement.create(
        [
          {
            storeId: actor.storeId,
            productId: item.productId,
            productName: product.name,
            sku: product.sku,
            type: "return",
            quantity: item.quantity,
            stockBefore: before,
            stockAfter: before + item.quantity,
            saleId: sale._id,
            orderNumber: sale.orderNumber,
            reason: reason || "Order cancelled",
            createdBy: actor.userId,
            isDemo: Boolean(actor.isDemo),
          },
        ],
        { session, ordered: true },
      );
    }

    await SaleItem.updateMany(
      { saleId: sale._id, storeId: actor.storeId },
      { $set: { status: "cancelled" } },
      { session },
    );

    sale.status = "cancelled";
    sale.note = reason ? `${sale.note ? `${sale.note}\n` : ""}Cancelled: ${reason}` : sale.note;
    await sale.save({ session });

    if (sale.customerId) await recomputeCustomerStats(actor.storeId, sale.customerId, session);
    return sale.toObject() as SaleDoc;
  });
}

/** Settle a pending order - the point at which its revenue is recognised. */
export async function completePendingSale(
  actor: SaleActor,
  saleId: string,
  opts: { paymentMethod?: PaymentMethod; amountPaid?: number } = {},
) {
  await connectToDatabase();
  if (!Types.ObjectId.isValid(saleId)) throw notFound("That order");

  return withTransaction(async (session) => {
    const sale = await Sale.findOne({ _id: new Types.ObjectId(saleId), storeId: actor.storeId }).session(
      session ?? null,
    );
    if (!sale) throw notFound("That order");
    if (sale.status !== "pending") {
      throw new AppError("INVALID_STATE", `Only a pending order can be completed (this one is ${sale.status}).`);
    }

    const method = opts.paymentMethod ?? sale.paymentMethod;
    const paid = opts.amountPaid ?? sale.total;

    sale.status = "completed";
    sale.paymentStatus = "paid";
    sale.paymentMethod = method;
    sale.amountPaid = paid;
    sale.changeGiven = Math.max(0, paid - sale.total);
    await sale.save({ session });

    await SaleItem.updateMany(
      { saleId: sale._id, storeId: actor.storeId },
      { $set: { status: "completed" } },
      { session },
    );

    await Payment.create(
      [
        {
          storeId: actor.storeId,
          saleId: sale._id,
          orderNumber: sale.orderNumber,
          method,
          amount: Math.min(paid, sale.total),
          kind: "capture",
          createdBy: actor.userId,
          isDemo: Boolean(actor.isDemo),
        },
      ],
      { session, ordered: true },
    );

    if (sale.customerId) await recomputeCustomerStats(actor.storeId, sale.customerId, session);
    return sale.toObject() as SaleDoc;
  });
}
