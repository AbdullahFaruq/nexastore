import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/db/connect";
import { Category } from "@/lib/db/models/category";
import { Counter } from "@/lib/db/models/counter";
import { Customer } from "@/lib/db/models/customer";
import { Expense } from "@/lib/db/models/expense";
import { InventoryMovement } from "@/lib/db/models/inventory-movement";
import { Notification } from "@/lib/db/models/notification";
import { Payment } from "@/lib/db/models/payment";
import { Product } from "@/lib/db/models/product";
import { Sale } from "@/lib/db/models/sale";
import { SaleItem } from "@/lib/db/models/sale-item";
import type { PaymentMethod } from "@/lib/db/models/enums";
import { computeSaleTotals, type TaxMode } from "@/lib/sales/pricing";
import { minorUnitFactor } from "@/lib/format/currency";
import { zonedParts, zonedTimeToUtc } from "@/lib/format/dates";
import { slugify } from "@/lib/utils";
import {
  CUSTOMER_FIRST, CUSTOMER_LAST, ELECTRONICS_CATALOG, EXPENSE_TEMPLATES,
} from "./catalog";

/**
 * Demo data generator.
 *
 * Two things matter here beyond "make rows":
 *
 * 1. Every sale is priced through computeSaleTotals - the same function the
 *    till uses. Seeded figures are therefore arithmetically identical to real
 *    ones, and the dashboard is exercising the real code path.
 * 2. Sales follow a believable shape: a growth trend, a weekly rhythm with
 *    strong Fridays and Saturdays, a lunchtime and an evening peak, and a
 *    long tail of products. A flat random scatter would make every insight the
 *    engine produces meaningless.
 *
 * Everything written here carries isDemo: true so it can be removed wholesale.
 */

export interface SeedOptions {
  storeId: Types.ObjectId;
  currency: string;
  timezone: string;
  taxMode: TaxMode;
  taxRateBps: number;
  orderPrefix: string;
  userId: string;
  userName: string;
  /** How far back to generate trading history. */
  months?: number;
  customerCount?: number;
  /** Deterministic output for a given seed. */
  seed?: number;
  now?: Date;
}

/** Mulberry32 - small, fast, and repeatable, so demos look the same each run. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(rand: () => number, arr: T[]): T {
  return arr[Math.floor(rand() * arr.length)];
}

function weightedPick<T extends { weight: number }>(rand: () => number, items: T[], totalWeight: number): T {
  let r = rand() * totalWeight;
  for (const item of items) {
    r -= item.weight;
    if (r <= 0) return item;
  }
  return items[items.length - 1];
}

/** Normal-ish noise via the central limit theorem; cheap and good enough. */
function jitter(rand: () => number, spread: number) {
  return 1 + ((rand() + rand() + rand()) / 3 - 0.5) * 2 * spread;
}

const WEEKDAY_WEIGHT = [0.72, 0.78, 0.86, 0.92, 1.0, 1.34, 1.18]; // Sun..Sat
const HOUR_WEIGHT: Record<number, number> = {
  9: 0.5, 10: 0.9, 11: 1.1, 12: 1.35, 13: 1.4, 14: 1.1,
  15: 1.0, 16: 1.15, 17: 1.45, 18: 1.5, 19: 1.1, 20: 0.6,
};

export interface SeedResult {
  categories: number;
  products: number;
  customers: number;
  sales: number;
  saleItems: number;
  expenses: number;
  movements: number;
}

export async function generateDemoData(opts: SeedOptions): Promise<SeedResult> {
  await connectToDatabase();

  const {
    storeId, currency, timezone, taxMode, taxRateBps, orderPrefix, userId, userName,
    months = 15, customerCount = 320, seed = 20260831, now = new Date(),
  } = opts;

  const rand = rng(seed);
  const unit = minorUnitFactor(currency);
  const money = (major: number) => Math.round(major * unit);

  /* ------------------------------------------------------------ categories */

  const categoryNames = [...new Set(ELECTRONICS_CATALOG.map((c) => c.category))];
  const categoryDocs = categoryNames.map((name, i) => ({
    _id: new Types.ObjectId(),
    storeId,
    name,
    slug: slugify(name),
    colorSlot: i % 8,
    sortOrder: i,
    isDemo: true,
  }));
  await Category.deleteMany({ storeId, isDemo: true });
  await Category.insertMany(categoryDocs, { ordered: false }).catch(() => undefined);
  const categoryByName = new Map(categoryDocs.map((c) => [c.name, c._id]));

  /* -------------------------------------------------------------- products */

  const productDocs = ELECTRONICS_CATALOG.map((item) => ({
    _id: new Types.ObjectId(),
    storeId,
    name: item.name,
    sku: item.sku,
    description: item.description,
    images: [] as string[],
    categoryId: categoryByName.get(item.category) ?? null,
    supplier: item.supplier,
    costPrice: money(item.cost),
    price: money(item.price),
    discountPrice: item.discount ? money(item.discount) : null,
    // Start high; the sales loop draws stock down to today's level.
    stock: item.stock,
    minStock: item.minStock,
    taxRateBps,
    unit: item.unit ?? "unit",
    status: "active" as const,
    isDemo: true,
  }));

  await Product.deleteMany({ storeId, isDemo: true });
  await Product.insertMany(productDocs, { ordered: false });

  const catalogByProductId = new Map(
    productDocs.map((p, i) => [String(p._id), ELECTRONICS_CATALOG[i]]),
  );
  const sellable = productDocs.map((p, i) => ({
    _id: p._id,
    name: p.name,
    sku: p.sku,
    categoryId: p.categoryId,
    price: p.discountPrice && p.discountPrice < p.price ? p.discountPrice : p.price,
    cost: p.costPrice,
    taxRateBps,
    weight: ELECTRONICS_CATALOG[i].weight,
  }));
  const totalWeight = sellable.reduce((a, p) => a + p.weight, 0);

  /* ------------------------------------------------------------- customers */

  const customerDocs = Array.from({ length: customerCount }, () => {
    const first = pick(rand, CUSTOMER_FIRST);
    const last = pick(rand, CUSTOMER_LAST);
    return {
      _id: new Types.ObjectId(),
      storeId,
      name: `${first} ${last}`,
      email: `${first.toLowerCase()}.${last.toLowerCase()}${Math.floor(rand() * 90 + 10)}@example.com`,
      phone: `+1 ${Math.floor(rand() * 800 + 200)} ${Math.floor(rand() * 900 + 100)} ${Math.floor(rand() * 9000 + 1000)}`,
      totalOrders: 0,
      totalSpent: 0,
      tags: [] as string[],
      isDemo: true,
    };
  });
  await Customer.deleteMany({ storeId, isDemo: true });
  await Customer.insertMany(customerDocs, { ordered: false });

  // A minority of customers buy repeatedly - that is what makes segmentation
  // (VIP / returning / at risk) produce anything meaningful.
  const loyal = customerDocs.slice(0, Math.floor(customerCount * 0.16));

  /* ----------------------------------------------------------------- sales */

  await Sale.deleteMany({ storeId, isDemo: true });
  await SaleItem.deleteMany({ storeId, isDemo: true });
  await Payment.deleteMany({ storeId, isDemo: true });
  await InventoryMovement.deleteMany({ storeId, isDemo: true });
  await Expense.deleteMany({ storeId, isDemo: true });
  await Notification.deleteMany({ storeId, isDemo: true });

  // Anchor the history to store-local calendar days. Deriving days by adding
  // 86,400,000ms to a server-local midnight drifts across DST and silently
  // drops the current day when the store is west of the server.
  const nowParts = zonedParts(now, timezone);
  const start = zonedTimeToUtc(timezone, nowParts.year, nowParts.month - months, nowParts.day);

  const sales: Record<string, unknown>[] = [];
  const saleItems: Record<string, unknown>[] = [];
  const payments: Record<string, unknown>[] = [];
  const movements: Record<string, unknown>[] = [];

  // Track stock backwards: today's figure is the catalogue value, so we build
  // history forward from a higher opening balance.
  const stockLevel = new Map<string, number>();
  const unitsSoldTotal = new Map<string, number>();

  const paymentMethods: { method: PaymentMethod; weight: number }[] = [
    { method: "card", weight: 58 },
    { method: "cash", weight: 26 },
    { method: "mobile", weight: 11 },
    { method: "bank_transfer", weight: 5 },
  ];
  const pmTotal = paymentMethods.reduce((a, p) => a + p.weight, 0);

  let sequence = 0;

  const totalDays = Math.max(1, Math.round((now.getTime() - start.getTime()) / 86_400_000));

  let cursor = start;
  for (let day = 0; cursor <= now && day < 2000; day++) {
    const date = cursor;
    const dayParts = zonedParts(date, timezone);
    // Step to the next store-local midnight before anything can `continue`.
    cursor = zonedTimeToUtc(timezone, dayParts.year, dayParts.month, dayParts.day + 1);

    // Trend: roughly 55% growth across the whole window, plus a gentle annual
    // seasonal wave and day-to-day noise.
    const progress = day / Math.max(1, totalDays);
    const trend = 0.72 + progress * 0.62;
    const seasonal = 1 + 0.14 * Math.sin(((dayParts.month - 1) / 12) * Math.PI * 2 - 1.1);
    const weekday = WEEKDAY_WEIGHT[dayParts.weekday];
    const noise = jitter(rand, 0.3);

    let orderCount = Math.round(9 * trend * seasonal * weekday * noise);
    // An occasional exceptional day - promotions, a local event.
    if (rand() < 0.03) orderCount = Math.round(orderCount * (1.6 + rand()));
    orderCount = Math.max(0, orderCount);

    for (let o = 0; o < orderCount; o++) {
      const hours = Object.keys(HOUR_WEIGHT).map(Number);
      const hourTotal = hours.reduce((a, h) => a + HOUR_WEIGHT[h], 0);
      let hr = rand() * hourTotal;
      let hour = 12;
      for (const h of hours) {
        hr -= HOUR_WEIGHT[h];
        if (hr <= 0) {
          hour = h;
          break;
        }
      }
      // Wall-clock hours are meaningful in the STORE's timezone: a 6pm rush
      // must land at 6pm local, not 6pm on whichever machine ran the seed.
      const dp = zonedParts(date, timezone);
      const soldAt = zonedTimeToUtc(
        timezone, dp.year, dp.month, dp.day,
        hour, Math.floor(rand() * 60), Math.floor(rand() * 60),
      );
      if (soldAt > now) continue;

      // Basket: mostly one or two lines, occasionally a big one.
      const lineCount = rand() < 0.5 ? 1 : rand() < 0.85 ? 2 : rand() < 0.96 ? 3 : 4;
      const chosen = new Map<string, number>();
      for (let l = 0; l < lineCount; l++) {
        const product = weightedPick(rand, sellable, totalWeight);
        const qty = product.price > money(300) ? 1 : rand() < 0.72 ? 1 : rand() < 0.93 ? 2 : 3;
        chosen.set(String(product._id), (chosen.get(String(product._id)) ?? 0) + qty);
      }

      const lines = [...chosen.entries()].map(([productId, quantity]) => {
        const p = sellable.find((s) => String(s._id) === productId)!;
        // Occasional till discount on a line.
        const lineDiscount = rand() < 0.09 ? Math.round(p.price * quantity * (0.05 + rand() * 0.13)) : 0;
        return {
          productId,
          quantity,
          unitPrice: p.price,
          unitCost: p.cost,
          lineDiscount,
          taxRateBps: p.taxRateBps,
        };
      });

      const orderDiscount = rand() < 0.06 ? Math.round(money(5) + rand() * money(20)) : 0;
      const totals = computeSaleTotals(lines, { orderDiscount, taxMode });
      if (totals.lineCount === 0) continue;

      sequence++;
      const saleId = new Types.ObjectId();
      const orderNumber = `${orderPrefix}-${String(sequence).padStart(6, "0")}`;

      // Roughly a third of orders are attached to a named customer, weighted
      // towards the loyal cohort.
      let customerId: Types.ObjectId | null = null;
      let customerName: string | undefined;
      if (rand() < 0.34) {
        const c = rand() < 0.42 ? pick(rand, loyal) : pick(rand, customerDocs);
        customerId = c._id;
        customerName = c.name;
      }

      let pmr = rand() * pmTotal;
      let method: PaymentMethod = "card";
      for (const pm of paymentMethods) {
        pmr -= pm.weight;
        if (pmr <= 0) {
          method = pm.method;
          break;
        }
      }

      // Status mix: mostly completed, a few refunds, a couple pending, rare cancel.
      const roll = rand();
      const daysAgo = (now.getTime() - soldAt.getTime()) / 86_400_000;
      // Pending orders only make sense recently - an unpaid order from eight
      // months ago would be a bookkeeping problem, not a demo.
      const status =
        daysAgo < 9 && roll < 0.11 ? "pending"
        : roll < 0.028 ? "refunded"
        : roll < 0.04 ? "cancelled"
        : "completed";

      const refunded = status === "refunded";
      const counts = status === "completed" || status === "refunded";

      sales.push({
        _id: saleId,
        storeId,
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
        refundedRevenue: refunded ? totals.netRevenue : 0,
        refundedTax: refunded ? totals.taxTotal : 0,
        refundedCogs: refunded ? totals.cogsTotal : 0,
        refundedAt: refunded ? new Date(soldAt.getTime() + 86_400_000 * (1 + rand() * 6)) : null,
        refundReason: refunded ? pick(rand, ["Faulty on arrival", "Customer changed their mind", "Wrong model", "Damaged packaging"]) : undefined,
        itemCount: totals.itemCount,
        lineCount: totals.lineCount,
        status,
        paymentMethod: method,
        paymentStatus: status === "completed" ? "paid" : refunded ? "refunded" : "unpaid",
        amountPaid: status === "completed" || refunded ? totals.total : 0,
        changeGiven: 0,
        channel: rand() < 0.86 ? "pos" : "online",
        soldAt,
        createdBy: userId,
        createdByName: userName,
        isDemo: true,
        createdAt: soldAt,
        updatedAt: soldAt,
      });

      for (const l of totals.lines) {
        const p = sellable.find((s) => String(s._id) === l.productId)!;
        const catalogItem = catalogByProductId.get(l.productId);

        saleItems.push({
          storeId,
          saleId,
          orderNumber,
          productId: p._id,
          categoryId: p.categoryId,
          productName: p.name,
          sku: p.sku,
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
          refundedQuantity: refunded ? l.quantity : 0,
          refundedRevenue: refunded ? l.netRevenue : 0,
          refundedCogs: refunded ? l.cogsAmount : 0,
          status,
          soldAt,
          isDemo: true,
          createdAt: soldAt,
          updatedAt: soldAt,
        });

        if (counts && !refunded) {
          unitsSoldTotal.set(l.productId, (unitsSoldTotal.get(l.productId) ?? 0) + l.quantity);
          // Only the last 90 days of movements are kept - a full history would
          // be tens of thousands of rows with no analytical value.
          if (daysAgo <= 90) {
            const before = stockLevel.get(l.productId) ?? (catalogItem?.stock ?? 0) + l.quantity;
            movements.push({
              storeId,
              productId: p._id,
              productName: p.name,
              sku: p.sku,
              type: "sale",
              quantity: -l.quantity,
              stockBefore: before,
              stockAfter: before - l.quantity,
              unitCost: l.unitCost,
              saleId,
              orderNumber,
              createdBy: userId,
              createdByName: userName,
              isDemo: true,
              createdAt: soldAt,
              updatedAt: soldAt,
            });
            stockLevel.set(l.productId, before - l.quantity);
          }
        }
      }

      if (status === "completed" || refunded) {
        payments.push({
          storeId, saleId, orderNumber, method,
          amount: totals.total, kind: "capture",
          createdBy: userId, isDemo: true, createdAt: soldAt, updatedAt: soldAt,
        });
        if (refunded) {
          payments.push({
            storeId, saleId, orderNumber, method,
            amount: -totals.total, kind: "refund",
            createdBy: userId, isDemo: true,
            createdAt: new Date(soldAt.getTime() + 86_400_000),
            updatedAt: new Date(soldAt.getTime() + 86_400_000),
          });
        }
      }
    }
  }

  // Chunked inserts - a single insertMany of tens of thousands of docs will
  // exceed the 16MB BSON command limit.
  const CHUNK = 800;
  for (let i = 0; i < sales.length; i += CHUNK) {
    await Sale.insertMany(sales.slice(i, i + CHUNK), { ordered: false });
  }
  for (let i = 0; i < saleItems.length; i += CHUNK) {
    await SaleItem.insertMany(saleItems.slice(i, i + CHUNK), { ordered: false });
  }
  for (let i = 0; i < payments.length; i += CHUNK) {
    await Payment.insertMany(payments.slice(i, i + CHUNK), { ordered: false });
  }

  await Counter.findOneAndUpdate(
    { storeId, key: "order" },
    { $set: { value: sequence } },
    { upsert: true },
  );

  /* ------------------------------------------------ restocking + movements */

  // Purchase movements so the ledger explains how stock got back up.
  const restockMovements: Record<string, unknown>[] = [];
  for (const p of productDocs) {
    const catalogItem = catalogByProductId.get(String(p._id));
    if (!catalogItem) continue;
    const restocks = 1 + Math.floor(rand() * 3);
    for (let r = 0; r < restocks; r++) {
      const at = new Date(now.getTime() - (5 + rand() * 85) * 86_400_000);
      const qty = Math.max(5, Math.round(catalogItem.stock * (0.4 + rand() * 0.8)));
      restockMovements.push({
        storeId,
        productId: p._id,
        productName: p.name,
        sku: p.sku,
        type: "purchase",
        quantity: qty,
        stockBefore: 0,
        stockAfter: qty,
        unitCost: p.costPrice,
        reason: `Purchase order from ${catalogItem.supplier}`,
        createdBy: userId,
        createdByName: userName,
        isDemo: true,
        createdAt: at,
        updatedAt: at,
      });
    }
    // A little shrinkage, so the damage movement type is represented.
    if (rand() < 0.18) {
      const at = new Date(now.getTime() - rand() * 70 * 86_400_000);
      restockMovements.push({
        storeId, productId: p._id, productName: p.name, sku: p.sku,
        type: "damage", quantity: -(1 + Math.floor(rand() * 3)),
        stockBefore: 0, stockAfter: 0, unitCost: p.costPrice,
        reason: pick(rand, ["Damaged in transit", "Display unit written off", "Water damage in storeroom"]),
        createdBy: userId, createdByName: userName, isDemo: true, createdAt: at, updatedAt: at,
      });
    }
  }

  const allMovements = [...movements, ...restockMovements];
  for (let i = 0; i < allMovements.length; i += CHUNK) {
    await InventoryMovement.insertMany(allMovements.slice(i, i + CHUNK), { ordered: false });
  }

  /* -------------------------------------------------------------- expenses */

  const expenses: Record<string, unknown>[] = [];

  // Walk months as (year, month) pairs. Date.setMonth on a 31st silently rolls
  // "31 June" into 1 July, which double-books one month and skips another - and
  // the resulting lumpy totals look like a real trend rather than a bug.
  const startParts = zonedParts(start, timezone);
  for (let m = 0; m <= months; m++) {
    const monthIndex = startParts.month + m;
    const year = startParts.year + Math.floor((monthIndex - 1) / 12);
    const month = ((monthIndex - 1) % 12) + 1;
    const monthStart = zonedTimeToUtc(timezone, year, month, 1);
    if (monthStart > now) break;

    // Costs creep up over time, roughly in line with the business growing.
    const inflation = 1 + (m / Math.max(1, months)) * 0.18;

    for (const tpl of EXPENSE_TEMPLATES) {
      const occurrences =
        tpl.cadence === "monthly" ? 1 : tpl.cadence === "weekly" ? 4 : rand() < 0.4 ? 1 : 0;

      for (let i = 0; i < occurrences; i++) {
        const dayOfMonth =
          tpl.cadence === "monthly" ? 1 + Math.floor(rand() * 6) : 1 + Math.floor(rand() * 27);
        const date = zonedTimeToUtc(timezone, year, month, dayOfMonth, 9 + Math.floor(rand() * 8));
        if (date > now) continue;

        const amount = money(tpl.amount * inflation * jitter(rand, tpl.variance ?? 0.04));
        expenses.push({
          storeId,
          category: tpl.category,
          amount,
          description: tpl.description,
          vendor: tpl.vendor,
          date,
          paymentMethod: tpl.category === "salaries" ? "bank_transfer" : pick(rand, ["bank_transfer", "card", "cash"]),
          recurring: tpl.cadence === "monthly",
          recurrenceInterval: tpl.cadence === "monthly" ? "monthly" : undefined,
          createdBy: userId,
          createdByName: userName,
          isDemo: true,
          createdAt: date,
          updatedAt: date,
        });
      }
    }
  }
  for (let i = 0; i < expenses.length; i += CHUNK) {
    await Expense.insertMany(expenses.slice(i, i + CHUNK), { ordered: false });
  }

  /* -------------------------------------------- customer lifetime rollups */

  const customerRollup = await Sale.aggregate([
    { $match: { storeId, isDemo: true, customerId: { $ne: null }, status: { $in: ["completed", "refunded"] } } },
    {
      $group: {
        _id: "$customerId",
        totalSpent: { $sum: { $subtract: ["$netRevenue", "$refundedRevenue"] } },
        totalOrders: { $sum: { $cond: [{ $eq: ["$status", "refunded"] }, 0, 1] } },
        firstPurchaseAt: { $min: "$soldAt" },
        lastPurchaseAt: { $max: "$soldAt" },
      },
    },
  ]);

  if (customerRollup.length > 0) {
    await Customer.bulkWrite(
      customerRollup.map((c) => ({
        updateOne: {
          filter: { _id: c._id, storeId },
          update: {
            $set: {
              totalSpent: Math.max(0, c.totalSpent),
              totalOrders: c.totalOrders,
              firstPurchaseAt: c.firstPurchaseAt,
              lastPurchaseAt: c.lastPurchaseAt,
            },
          },
        },
      })),
      { ordered: false },
    );
  }

  /* --------------------------------------------------------- notifications */

  const lowStock = productDocs
    .filter((p) => p.stock <= p.minStock)
    .slice(0, 4)
    .map((p) => ({
      storeId,
      type: p.stock <= 0 ? "out_of_stock" : "low_stock",
      priority: p.stock <= 0 ? "critical" : "high",
      title: p.stock <= 0 ? `${p.name} is out of stock` : `${p.name} is running low`,
      body:
        p.stock <= 0
          ? "This product sold out and cannot be sold again until restocked."
          : `Only ${p.stock} left, at or below the reorder point of ${p.minStock}.`,
      href: `/products/${String(p._id)}`,
      dedupeKey: `${storeId}:seed:stock:${p._id}`,
      readBy: [],
      isDemo: true,
    }));

  const biggest = [...sales].sort(
    (a, b) => (b.total as number) - (a.total as number),
  )[0];

  const notices: Record<string, unknown>[] = [...lowStock];
  if (biggest) {
    notices.push({
      storeId,
      type: "large_sale",
      priority: "normal",
      title: "Large sale completed",
      body: `Order ${biggest.orderNumber} came to the highest total in your history.`,
      href: `/sales/${String(biggest._id)}`,
      dedupeKey: `${storeId}:seed:largest`,
      readBy: [],
      isDemo: true,
    });
  }
  notices.push({
    storeId,
    type: "report_ready",
    priority: "low",
    title: "Monthly report is ready",
    body: "Last month's profit and loss statement has been compiled.",
    href: "/reports",
    dedupeKey: `${storeId}:seed:report`,
    readBy: [],
    isDemo: true,
  });

  await Notification.insertMany(notices, { ordered: false }).catch(() => undefined);

  return {
    categories: categoryDocs.length,
    products: productDocs.length,
    customers: customerDocs.length,
    sales: sales.length,
    saleItems: saleItems.length,
    expenses: expenses.length,
    movements: allMovements.length,
  };
}
