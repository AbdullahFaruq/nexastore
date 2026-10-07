import type { PipelineStage, Types } from "mongoose";
import type { DateRange, Grain } from "@/lib/format/dates";
import { zonedParts, zonedTimeToUtc } from "@/lib/format/dates";

/**
 * Sales in these states are recognised in the books. A "pending" sale is
 * committed inventory but unearned revenue, and a "cancelled" one never
 * happened - counting either would overstate the business.
 */
export const RECOGNISED_STATUSES = ["completed", "refunded"] as const;

/** The tenant + time-window match that opens every financial pipeline. */
export function saleMatch(
  storeId: Types.ObjectId,
  range: DateRange,
  extra: Record<string, unknown> = {},
): PipelineStage.Match {
  return {
    $match: {
      storeId,
      status: { $in: [...RECOGNISED_STATUSES] },
      soldAt: { $gte: range.from, $lt: range.to },
      ...extra,
    },
  };
}

export function expenseMatch(
  storeId: Types.ObjectId,
  range: DateRange,
  extra: Record<string, unknown> = {},
): PipelineStage.Match {
  return { $match: { storeId, date: { $gte: range.from, $lt: range.to }, ...extra } };
}

/**
 * Net-of-refunds accumulators. Every rollup uses these expressions so a refund
 * is reversed identically everywhere, and revenue can never be double counted.
 */
export const NET = {
  revenue: { $subtract: ["$netRevenue", "$refundedRevenue"] },
  cogs: { $subtract: ["$cogsTotal", "$refundedCogs"] },
  tax: { $subtract: ["$taxTotal", "$refundedTax"] },
  /** A refunded order sold nothing on net. */
  items: { $cond: [{ $eq: ["$status", "refunded"] }, 0, "$itemCount"] },
} as const;

export const SALE_ROLLUP = {
  revenue: { $sum: NET.revenue },
  cogs: { $sum: NET.cogs },
  tax: { $sum: NET.tax },
  grossAmount: { $sum: "$grossAmount" },
  discounts: { $sum: "$discountTotal" },
  refunds: { $sum: "$refundedRevenue" },
  orders: { $sum: 1 },
  items: { $sum: NET.items },
} as const;

const MONGO_WEEK_START = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

/** $dateTrunc spec for a grain, honouring the store's timezone and week start. */
export function truncExpr(field: string, grain: Grain, timezone: string, weekStartsOn = 1) {
  // `$${field}` builds a Mongo field path such as "$soldAt". source-check-ignore
  const spec: Record<string, unknown> = { date: `$${field}`, unit: grain, timezone };
  if (grain === "week") spec.startOfWeek = MONGO_WEEK_START[weekStartsOn] ?? "monday";
  return { $dateTrunc: spec };
}

/**
 * Every bucket boundary in [from, to) at `grain`, in the store's timezone.
 *
 * Charts must show a day with no sales as a zero, not as a gap - otherwise a
 * quiet Tuesday silently disappears and the line lies about the trend.
 */
export function enumerateBuckets(range: DateRange, grain: Grain, timezone: string, weekStartsOn = 1): Date[] {
  const out: Date[] = [];
  const p = zonedParts(range.from, timezone);
  let cursor: Date;

  switch (grain) {
    case "hour":
      cursor = zonedTimeToUtc(timezone, p.year, p.month, p.day, p.hour);
      break;
    case "day":
      cursor = zonedTimeToUtc(timezone, p.year, p.month, p.day);
      break;
    case "week": {
      const diff = (p.weekday - weekStartsOn + 7) % 7;
      cursor = zonedTimeToUtc(timezone, p.year, p.month, p.day - diff);
      break;
    }
    case "month":
      cursor = zonedTimeToUtc(timezone, p.year, p.month, 1);
      break;
    case "year":
      cursor = zonedTimeToUtc(timezone, p.year, 1, 1);
      break;
  }

  // Hard cap: a pathological custom range must not spin forever.
  for (let i = 0; cursor < range.to && i < 2000; i++) {
    out.push(cursor);
    const c = zonedParts(cursor, timezone);
    switch (grain) {
      case "hour": cursor = new Date(cursor.getTime() + 3_600_000); break;
      case "day": cursor = zonedTimeToUtc(timezone, c.year, c.month, c.day + 1); break;
      case "week": cursor = zonedTimeToUtc(timezone, c.year, c.month, c.day + 7); break;
      case "month": cursor = zonedTimeToUtc(timezone, c.year, c.month + 1, 1); break;
      case "year": cursor = zonedTimeToUtc(timezone, c.year + 1, 1, 1); break;
    }
  }
  return out;
}

export type Num = number;

/** Coerce a possibly-missing aggregation result into a full zeroed shape. */
export function firstOr<T extends Record<string, Num>>(rows: unknown[], shape: T): T {
  const row = (rows[0] ?? {}) as Record<string, unknown>;
  const out = { ...shape };
  for (const k of Object.keys(shape) as (keyof T)[]) {
    const v = row[k as string];
    out[k] = (typeof v === "number" && Number.isFinite(v) ? v : 0) as T[keyof T];
  }
  return out;
}
