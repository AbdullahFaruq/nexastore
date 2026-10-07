import type { Types } from "mongoose";
import { connectToDatabase } from "@/lib/db/connect";
import { SaleItem } from "@/lib/db/models/sale-item";
import { Category } from "@/lib/db/models/category";
import { Product } from "@/lib/db/models/product";
import type { DateRange } from "@/lib/format/dates";
import { pctChange, ratio } from "@/lib/utils";

export interface CategoryPerformance {
  categoryId: string | null;
  name: string;
  colorSlot: number;
  productCount: number;
  unitsSold: number;
  revenue: number;
  profit: number;
  marginPct: number;
  revenueShare: number;
  growthPct: number | null;
}

async function revenueByCategory(storeId: Types.ObjectId, range: DateRange) {
  return SaleItem.aggregate([
    {
      $match: {
        storeId,
        status: { $in: ["completed", "refunded"] },
        soldAt: { $gte: range.from, $lt: range.to },
      },
    },
    {
      $group: {
        _id: "$categoryId",
        unitsSold: { $sum: { $subtract: ["$quantity", "$refundedQuantity"] } },
        revenue: { $sum: { $subtract: ["$netRevenue", "$refundedRevenue"] } },
        cogs: { $sum: { $subtract: ["$cogsAmount", "$refundedCogs"] } },
      },
    },
  ]).exec();
}

export async function getCategoryPerformance(
  storeId: Types.ObjectId,
  range: DateRange & { previous?: DateRange },
): Promise<CategoryPerformance[]> {
  await connectToDatabase();

  const [categories, current, previous, productCounts] = await Promise.all([
    Category.find({ storeId }).sort({ sortOrder: 1, name: 1 }).lean(),
    revenueByCategory(storeId, range),
    range.previous ? revenueByCategory(storeId, range.previous) : Promise.resolve([]),
    Product.aggregate([
      { $match: { storeId, status: { $ne: "archived" } } },
      { $group: { _id: "$categoryId", count: { $sum: 1 } } },
    ]).exec(),
  ]);

  const curBy = new Map(current.map((r) => [String(r._id ?? "none"), r]));
  const prevBy = new Map(previous.map((r) => [String(r._id ?? "none"), r.revenue as number]));
  const countBy = new Map(productCounts.map((r) => [String(r._id ?? "none"), r.count as number]));

  const totalRevenue = current.reduce((a, r) => a + r.revenue, 0);

  const rows: CategoryPerformance[] = categories.map((c, i) => {
    const key = String(c._id);
    const cur = curBy.get(key);
    const revenue = cur?.revenue ?? 0;
    const profit = revenue - (cur?.cogs ?? 0);
    const prev = prevBy.get(key);
    return {
      categoryId: key,
      name: c.name,
      colorSlot: c.colorSlot ?? i % 8,
      productCount: countBy.get(key) ?? 0,
      unitsSold: cur?.unitsSold ?? 0,
      revenue,
      profit,
      marginPct: ratio(profit, revenue) * 100,
      revenueShare: ratio(revenue, totalRevenue) * 100,
      growthPct: prev === undefined ? null : pctChange(revenue, prev),
    };
  });

  // Products with no category still sold something; surface them honestly.
  const orphan = curBy.get("none");
  if (orphan && orphan.revenue > 0) {
    const profit = orphan.revenue - orphan.cogs;
    rows.push({
      categoryId: null,
      name: "Uncategorised",
      colorSlot: 7,
      productCount: countBy.get("none") ?? 0,
      unitsSold: orphan.unitsSold,
      revenue: orphan.revenue,
      profit,
      marginPct: ratio(profit, orphan.revenue) * 100,
      revenueShare: ratio(orphan.revenue, totalRevenue) * 100,
      growthPct: prevBy.get("none") === undefined ? null : pctChange(orphan.revenue, prevBy.get("none")!),
    });
  }

  return rows.sort((a, b) => b.revenue - a.revenue);
}
