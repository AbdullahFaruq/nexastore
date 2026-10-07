import type { Types } from "mongoose";
import { connectToDatabase } from "@/lib/db/connect";
import { Sale } from "@/lib/db/models/sale";
import { Expense } from "@/lib/db/models/expense";
import type { DateRange, ResolvedRange } from "@/lib/format/dates";
import { pctChange, ratio } from "@/lib/utils";
import { SALE_ROLLUP, expenseMatch, firstOr, saleMatch } from "./shared";

export interface PeriodTotals {
  /** Ex-tax, net of discounts and refunds. The headline "Revenue". */
  revenue: number;
  /** Cost of goods actually sold in the window. */
  cogs: number;
  grossProfit: number;
  /** Operating expenses recognised in the window. */
  expenses: number;
  netProfit: number;
  /** List price before any discount. */
  grossAmount: number;
  discounts: number;
  refunds: number;
  tax: number;
  orders: number;
  items: number;
  averageOrderValue: number;
  grossMarginPct: number;
  netMarginPct: number;
}

const EMPTY_SALES = {
  revenue: 0, cogs: 0, tax: 0, grossAmount: 0,
  discounts: 0, refunds: 0, orders: 0, items: 0,
};

async function salesTotals(storeId: Types.ObjectId, range: DateRange) {
  const rows = await Sale.aggregate([
    saleMatch(storeId, range),
    { $group: { _id: null, ...SALE_ROLLUP } },
  ]).exec();
  return firstOr(rows, EMPTY_SALES);
}

async function expenseTotal(storeId: Types.ObjectId, range: DateRange) {
  const rows = await Expense.aggregate([
    expenseMatch(storeId, range),
    { $group: { _id: null, total: { $sum: "$amount" } } },
  ]).exec();
  return firstOr(rows, { total: 0 }).total;
}

/** Compose the derived figures once, so every screen agrees on the arithmetic. */
function derive(s: typeof EMPTY_SALES, expenses: number): PeriodTotals {
  const grossProfit = s.revenue - s.cogs;
  const netProfit = grossProfit - expenses;
  return {
    revenue: s.revenue,
    cogs: s.cogs,
    grossProfit,
    expenses,
    netProfit,
    grossAmount: s.grossAmount,
    discounts: s.discounts,
    refunds: s.refunds,
    tax: s.tax,
    orders: s.orders,
    items: s.items,
    averageOrderValue: s.orders > 0 ? Math.round(s.revenue / s.orders) : 0,
    grossMarginPct: ratio(grossProfit, s.revenue) * 100,
    netMarginPct: ratio(netProfit, s.revenue) * 100,
  };
}

export async function getPeriodTotals(
  storeId: Types.ObjectId,
  range: DateRange,
): Promise<PeriodTotals> {
  await connectToDatabase();
  const [sales, expenses] = await Promise.all([
    salesTotals(storeId, range),
    expenseTotal(storeId, range),
  ]);
  return derive(sales, expenses);
}

export type MetricKey = keyof Pick<
  PeriodTotals,
  "revenue" | "expenses" | "netProfit" | "grossProfit" | "orders" | "items" | "averageOrderValue" | "cogs"
>;

export interface MetricDelta {
  current: number;
  previous: number;
  /** null when there is no prior activity to compare against. */
  changePct: number | null;
  absoluteChange: number;
}

export interface FinancialSummary {
  current: PeriodTotals;
  previous: PeriodTotals;
  deltas: Record<MetricKey, MetricDelta>;
  range: ResolvedRange;
}

const DELTA_KEYS: MetricKey[] = [
  "revenue", "expenses", "netProfit", "grossProfit",
  "orders", "items", "averageOrderValue", "cogs",
];

/**
 * The dashboard's hero numbers: this period, the comparable previous period,
 * and the change between them. Both windows are computed with identical
 * pipelines so the comparison is honest.
 */
export async function getFinancialSummary(
  storeId: Types.ObjectId,
  range: ResolvedRange,
): Promise<FinancialSummary> {
  await connectToDatabase();
  const [current, previous] = await Promise.all([
    getPeriodTotals(storeId, range),
    getPeriodTotals(storeId, range.previous),
  ]);

  const deltas = {} as Record<MetricKey, MetricDelta>;
  for (const key of DELTA_KEYS) {
    deltas[key] = {
      current: current[key],
      previous: previous[key],
      changePct: pctChange(current[key], previous[key]),
      absoluteChange: current[key] - previous[key],
    };
  }

  return { current, previous, deltas, range };
}

/** Revenue committed but not yet earned - unpaid or held orders. */
export async function getPendingRevenue(storeId: Types.ObjectId, range: DateRange) {
  await connectToDatabase();
  const rows = await Sale.aggregate([
    { $match: { storeId, status: "pending", soldAt: { $gte: range.from, $lt: range.to } } },
    { $group: { _id: null, total: { $sum: "$netRevenue" }, orders: { $sum: 1 } } },
  ]).exec();
  return firstOr(rows, { total: 0, orders: 0 });
}
