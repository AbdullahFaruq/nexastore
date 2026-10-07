import type { Types } from "mongoose";
import { connectToDatabase } from "@/lib/db/connect";
import { Customer } from "@/lib/db/models/customer";
import { Sale } from "@/lib/db/models/sale";
import { SaleItem } from "@/lib/db/models/sale-item";
import type { DateRange } from "@/lib/format/dates";
import { ratio } from "@/lib/utils";

export { SEGMENT_META, type CustomerSegment } from "./segments";
import type { CustomerSegment } from "./segments";

/**
 * Segment from observed behaviour, not from a field someone typed.
 * `vipFloor` is the store's own 90th percentile of lifetime spend, so "VIP"
 * means something different - and correct - in a corner shop than in a
 * jeweller.
 */
export function segmentOf(
  c: { totalOrders: number; totalSpent: number; firstPurchaseAt?: Date | null; lastPurchaseAt?: Date | null },
  vipFloor: number,
  now = new Date(),
): CustomerSegment {
  if (!c.lastPurchaseAt || c.totalOrders === 0) return "inactive";
  const daysSince = (now.getTime() - new Date(c.lastPurchaseAt).getTime()) / 86_400_000;

  if (daysSince > 120) return "inactive";
  if (c.totalSpent >= vipFloor && vipFloor > 0) return "vip";
  if (daysSince > 60) return "at_risk";

  const firstDays = c.firstPurchaseAt
    ? (now.getTime() - new Date(c.firstPurchaseAt).getTime()) / 86_400_000
    : Infinity;
  if (c.totalOrders === 1 && firstDays <= 30) return "new";
  return c.totalOrders > 1 ? "returning" : "new";
}

/** The store's own 90th percentile of lifetime spend. */
export async function getVipFloor(storeId: Types.ObjectId): Promise<number> {
  await connectToDatabase();
  const count = await Customer.countDocuments({ storeId, totalOrders: { $gt: 0 } });
  if (count < 10) return Infinity; // Too few customers for a percentile to mean anything.
  const skip = Math.floor(count * 0.9);
  const row = await Customer.find({ storeId, totalOrders: { $gt: 0 } })
    .sort({ totalSpent: 1 })
    .skip(skip)
    .limit(1)
    .select({ totalSpent: 1 })
    .lean();
  return row[0]?.totalSpent ?? Infinity;
}

export async function getCustomerSegmentCounts(storeId: Types.ObjectId, now = new Date()) {
  await connectToDatabase();
  const [customers, vipFloor] = await Promise.all([
    Customer.find({ storeId })
      .select({ totalOrders: 1, totalSpent: 1, firstPurchaseAt: 1, lastPurchaseAt: 1 })
      .lean(),
    getVipFloor(storeId),
  ]);

  const counts: Record<CustomerSegment, { count: number; value: number }> = {
    vip: { count: 0, value: 0 },
    returning: { count: 0, value: 0 },
    new: { count: 0, value: 0 },
    at_risk: { count: 0, value: 0 },
    inactive: { count: 0, value: 0 },
  };

  for (const c of customers) {
    const seg = segmentOf(c, vipFloor, now);
    counts[seg].count++;
    counts[seg].value += c.totalSpent;
  }

  return { counts, vipFloor, total: customers.length };
}

export async function getCustomerStats(storeId: Types.ObjectId, range: DateRange) {
  await connectToDatabase();
  const [totals, newInPeriod, repeat] = await Promise.all([
    Customer.aggregate([
      { $match: { storeId } },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          lifetimeValue: { $sum: "$totalSpent" },
          withOrders: { $sum: { $cond: [{ $gt: ["$totalOrders", 0] }, 1, 0] } },
        },
      },
    ]).exec(),
    Customer.countDocuments({ storeId, firstPurchaseAt: { $gte: range.from, $lt: range.to } }),
    Customer.countDocuments({ storeId, totalOrders: { $gt: 1 } }),
  ]);

  const t = totals[0] ?? { count: 0, lifetimeValue: 0, withOrders: 0 };
  return {
    total: t.count,
    purchasing: t.withOrders,
    lifetimeValue: t.lifetimeValue,
    averageLifetimeValue: t.withOrders > 0 ? Math.round(t.lifetimeValue / t.withOrders) : 0,
    newInPeriod,
    repeatCustomers: repeat,
    repeatRate: ratio(repeat, t.withOrders) * 100,
  };
}

/** Purchase history, favourite products and spend trend for one customer. */
export async function getCustomerDetailStats(storeId: Types.ObjectId, customerId: Types.ObjectId) {
  await connectToDatabase();
  const [orders, favourites, monthly] = await Promise.all([
    Sale.find({ storeId, customerId, status: { $in: ["completed", "refunded", "pending"] } })
      .sort({ soldAt: -1 })
      .limit(50)
      .lean(),
    SaleItem.aggregate([
      { $match: { storeId, status: { $in: ["completed", "refunded"] } } },
      { $lookup: { from: "sales", localField: "saleId", foreignField: "_id", as: "sale" } },
      { $unwind: "$sale" },
      { $match: { "sale.customerId": customerId } },
      {
        $group: {
          _id: "$productId",
          name: { $last: "$productName" },
          image: { $last: "$productImage" },
          units: { $sum: { $subtract: ["$quantity", "$refundedQuantity"] } },
          spent: { $sum: { $subtract: ["$netRevenue", "$refundedRevenue"] } },
        },
      },
      { $sort: { units: -1 } },
      { $limit: 5 },
    ]).exec(),
    Sale.aggregate([
      { $match: { storeId, customerId, status: { $in: ["completed", "refunded"] } } },
      {
        $group: {
          _id: { $dateTrunc: { date: "$soldAt", unit: "month" } },
          spent: { $sum: { $subtract: ["$netRevenue", "$refundedRevenue"] } },
          orders: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
      { $limit: 24 },
    ]).exec(),
  ]);

  return { orders, favourites, monthly };
}
