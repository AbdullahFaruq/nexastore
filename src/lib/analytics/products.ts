import type { Types } from "mongoose";
import { connectToDatabase } from "@/lib/db/connect";
import { SaleItem } from "@/lib/db/models/sale-item";
import { Product } from "@/lib/db/models/product";
import type { DateRange, Grain } from "@/lib/format/dates";
import { bucketLabel } from "@/lib/format/dates";
import { pctChange, ratio } from "@/lib/utils";
import { enumerateBuckets, truncExpr } from "./shared";

/** Net-of-refund accumulators at the line level. */
const LINE_NET = {
  revenue: { $subtract: ["$netRevenue", "$refundedRevenue"] },
  cogs: { $subtract: ["$cogsAmount", "$refundedCogs"] },
  units: { $subtract: ["$quantity", "$refundedQuantity"] },
} as const;

function itemMatch(storeId: Types.ObjectId, range: DateRange, extra: Record<string, unknown> = {}) {
  return {
    $match: {
      storeId,
      status: { $in: ["completed", "refunded"] },
      soldAt: { $gte: range.from, $lt: range.to },
      ...extra,
    },
  };
}

export interface ProductPerformance {
  productId: string;
  name: string;
  sku: string;
  image?: string;
  categoryId?: string;
  categoryName?: string;
  unitsSold: number;
  revenue: number;
  cogs: number;
  profit: number;
  marginPct: number;
  /** Share of total revenue in the window, 0-100. */
  revenueShare: number;
  /** Growth against the previous window; null when it did not sell then. */
  growthPct: number | null;
  currentStock: number;
  orders: number;
}

export type ProductSortKey = "revenue" | "units" | "profit" | "growth" | "margin";

/**
 * Top-selling products for a window, with growth measured against the previous
 * window of equal length. One aggregation per window plus a single product
 * lookup - no N+1.
 */
export async function getTopProducts(
  storeId: Types.ObjectId,
  range: DateRange & { previous?: DateRange },
  opts: { limit?: number; sort?: ProductSortKey; categoryId?: Types.ObjectId | null } = {},
): Promise<ProductPerformance[]> {
  await connectToDatabase();
  const limit = opts.limit ?? 8;
  const extra = opts.categoryId ? { categoryId: opts.categoryId } : {};

  const groupStage = {
    $group: {
      _id: "$productId",
      name: { $last: "$productName" },
      sku: { $last: "$sku" },
      image: { $last: "$productImage" },
      categoryId: { $last: "$categoryId" },
      unitsSold: { $sum: LINE_NET.units },
      revenue: { $sum: LINE_NET.revenue },
      cogs: { $sum: LINE_NET.cogs },
      orders: { $addToSet: "$saleId" },
    },
  };

  const [current, previous] = await Promise.all([
    SaleItem.aggregate([
      itemMatch(storeId, range, extra),
      groupStage,
      { $project: { name: 1, sku: 1, image: 1, categoryId: 1, unitsSold: 1, revenue: 1, cogs: 1, orders: { $size: "$orders" } } },
      { $sort: { revenue: -1 } },
      { $limit: 200 },
    ]).exec(),
    range.previous
      ? SaleItem.aggregate([
          itemMatch(storeId, range.previous, extra),
          { $group: { _id: "$productId", revenue: { $sum: LINE_NET.revenue } } },
        ]).exec()
      : Promise.resolve([] as { _id: Types.ObjectId; revenue: number }[]),
  ]);

  const prevBy = new Map<string, number>();
  for (const r of previous) prevBy.set(String(r._id), r.revenue);

  const totalRevenue = current.reduce((a, r) => a + r.revenue, 0);

  const ids = current.map((r) => r._id);
  const [products, categories] = await Promise.all([
    Product.find({ storeId, _id: { $in: ids } }).select({ stock: 1, images: 1, name: 1 }).lean(),
    import("@/lib/db/models/category").then((m) =>
      m.Category.find({ storeId }).select({ name: 1 }).lean(),
    ),
  ]);
  const stockBy = new Map(products.map((p) => [String(p._id), p]));
  const catBy = new Map(categories.map((c) => [String(c._id), c.name]));

  const rows: ProductPerformance[] = current.map((r) => {
    const profit = r.revenue - r.cogs;
    const prev = prevBy.get(String(r._id));
    const live = stockBy.get(String(r._id));
    return {
      productId: String(r._id),
      name: r.name,
      sku: r.sku,
      image: r.image || live?.images?.[0],
      categoryId: r.categoryId ? String(r.categoryId) : undefined,
      categoryName: r.categoryId ? catBy.get(String(r.categoryId)) : undefined,
      unitsSold: r.unitsSold,
      revenue: r.revenue,
      cogs: r.cogs,
      profit,
      marginPct: ratio(profit, r.revenue) * 100,
      revenueShare: ratio(r.revenue, totalRevenue) * 100,
      growthPct: prev === undefined ? null : pctChange(r.revenue, prev),
      currentStock: live?.stock ?? 0,
      orders: r.orders,
    };
  });

  const sorters: Record<ProductSortKey, (a: ProductPerformance, b: ProductPerformance) => number> = {
    revenue: (a, b) => b.revenue - a.revenue,
    units: (a, b) => b.unitsSold - a.unitsSold,
    profit: (a, b) => b.profit - a.profit,
    margin: (a, b) => b.marginPct - a.marginPct,
    // Products with no prior sales sort last rather than pretending to be flat.
    growth: (a, b) => (b.growthPct ?? -Infinity) - (a.growthPct ?? -Infinity),
  };

  return rows.sort(sorters[opts.sort ?? "revenue"]).slice(0, limit);
}

/** Everything the product detail page needs about one product's trading history. */
export async function getProductStats(
  storeId: Types.ObjectId,
  productId: Types.ObjectId,
  range: DateRange,
  grain: Grain,
  timezone: string,
  weekStartsOn = 1,
) {
  await connectToDatabase();

  const [totals, allTime, series] = await Promise.all([
    SaleItem.aggregate([
      itemMatch(storeId, range, { productId }),
      {
        $group: {
          _id: null,
          unitsSold: { $sum: LINE_NET.units },
          revenue: { $sum: LINE_NET.revenue },
          cogs: { $sum: LINE_NET.cogs },
          orders: { $addToSet: "$saleId" },
        },
      },
      { $project: { unitsSold: 1, revenue: 1, cogs: 1, orders: { $size: "$orders" } } },
    ]).exec(),
    SaleItem.aggregate([
      { $match: { storeId, productId, status: { $in: ["completed", "refunded"] } } },
      {
        $group: {
          _id: null,
          unitsSold: { $sum: LINE_NET.units },
          revenue: { $sum: LINE_NET.revenue },
          cogs: { $sum: LINE_NET.cogs },
          firstSale: { $min: "$soldAt" },
          lastSale: { $max: "$soldAt" },
        },
      },
    ]).exec(),
    SaleItem.aggregate([
      itemMatch(storeId, range, { productId }),
      {
        $group: {
          _id: truncExpr("soldAt", grain, timezone, weekStartsOn),
          revenue: { $sum: LINE_NET.revenue },
          units: { $sum: LINE_NET.units },
        },
      },
      { $sort: { _id: 1 } },
    ]).exec(),
  ]);

  const t = totals[0] ?? { unitsSold: 0, revenue: 0, cogs: 0, orders: 0 };
  const a = allTime[0] ?? { unitsSold: 0, revenue: 0, cogs: 0, firstSale: null, lastSale: null };

  const byBucket = new Map<number, { revenue: number; units: number }>();
  for (const r of series) byBucket.set(new Date(r._id).getTime(), r);

  const points = enumerateBuckets(range, grain, timezone, weekStartsOn).map((d) => ({
    t: d.toISOString(),
    label: bucketLabel(d, grain, timezone),
    revenue: byBucket.get(d.getTime())?.revenue ?? 0,
    units: byBucket.get(d.getTime())?.units ?? 0,
  }));

  return {
    period: {
      unitsSold: t.unitsSold,
      revenue: t.revenue,
      cogs: t.cogs,
      profit: t.revenue - t.cogs,
      marginPct: ratio(t.revenue - t.cogs, t.revenue) * 100,
      orders: t.orders,
    },
    lifetime: {
      unitsSold: a.unitsSold,
      revenue: a.revenue,
      profit: a.revenue - a.cogs,
      firstSale: a.firstSale as Date | null,
      lastSale: a.lastSale as Date | null,
    },
    points,
  };
}

/** Units sold per product over a window - the input to stock runway maths. */
export async function getUnitsSoldByProduct(
  storeId: Types.ObjectId,
  range: DateRange,
): Promise<Map<string, number>> {
  await connectToDatabase();
  const rows = await SaleItem.aggregate([
    itemMatch(storeId, range),
    { $group: { _id: "$productId", units: { $sum: LINE_NET.units } } },
  ]).exec();
  return new Map(rows.map((r) => [String(r._id), r.units as number]));
}
