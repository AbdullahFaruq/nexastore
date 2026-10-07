import type { Types } from "mongoose";
import { connectToDatabase } from "@/lib/db/connect";
import { Sale } from "@/lib/db/models/sale";
import { Expense } from "@/lib/db/models/expense";
import type { DateRange, Grain } from "@/lib/format/dates";
import { bucketLabel } from "@/lib/format/dates";
import { NET, enumerateBuckets, expenseMatch, saleMatch, truncExpr } from "./shared";

export interface SeriesPoint {
  /** Bucket start, ISO. */
  t: string;
  label: string;
  revenue: number;
  expenses: number;
  profit: number;
  cogs: number;
  orders: number;
  items: number;
}

export interface TimeSeries {
  grain: Grain;
  points: SeriesPoint[];
  /**
   * True when the last bucket is still running (today, this week, this month).
   * The chart shades it, because a half-finished Tuesday plotted like a
   * finished one reads as a collapse in trade.
   */
  partialLast: boolean;
  /** The same-shaped previous window, aligned index-for-index for comparison. */
  previous: SeriesPoint[];
  totals: { revenue: number; expenses: number; profit: number; orders: number; items: number };
}

async function bucketedSales(
  storeId: Types.ObjectId,
  range: DateRange,
  grain: Grain,
  timezone: string,
  weekStartsOn: number,
) {
  return Sale.aggregate([
    saleMatch(storeId, range),
    {
      $group: {
        _id: truncExpr("soldAt", grain, timezone, weekStartsOn),
        revenue: { $sum: NET.revenue },
        cogs: { $sum: NET.cogs },
        orders: { $sum: 1 },
        items: { $sum: NET.items },
      },
    },
    { $sort: { _id: 1 } },
  ]).exec();
}

async function bucketedExpenses(
  storeId: Types.ObjectId,
  range: DateRange,
  grain: Grain,
  timezone: string,
  weekStartsOn: number,
) {
  return Expense.aggregate([
    expenseMatch(storeId, range),
    {
      $group: {
        _id: truncExpr("date", grain, timezone, weekStartsOn),
        expenses: { $sum: "$amount" },
      },
    },
    { $sort: { _id: 1 } },
  ]).exec();
}

async function buildSeries(
  storeId: Types.ObjectId,
  range: DateRange,
  grain: Grain,
  timezone: string,
  weekStartsOn: number,
): Promise<SeriesPoint[]> {
  const [sales, expenses] = await Promise.all([
    bucketedSales(storeId, range, grain, timezone, weekStartsOn),
    bucketedExpenses(storeId, range, grain, timezone, weekStartsOn),
  ]);

  const saleBy = new Map<number, (typeof sales)[number]>();
  for (const r of sales) saleBy.set(new Date(r._id).getTime(), r);
  const expBy = new Map<number, number>();
  for (const r of expenses) expBy.set(new Date(r._id).getTime(), r.expenses);

  // Walk the full bucket list so empty periods render as zeros, not gaps -
  // but stop at the current bucket. A "this year" chart should not show four
  // empty future months and imply the business fell off a cliff.
  const now = Date.now();
  const all = enumerateBuckets(range, grain, timezone, weekStartsOn);
  const visible = all.filter((d, i) => d.getTime() <= now || i === 0);

  return visible.map((d) => {
    const key = d.getTime();
    const s = saleBy.get(key);
    const revenue = s?.revenue ?? 0;
    const cogs = s?.cogs ?? 0;
    const expensesAmt = expBy.get(key) ?? 0;
    return {
      t: d.toISOString(),
      label: bucketLabel(d, grain, timezone),
      revenue,
      cogs,
      expenses: expensesAmt,
      profit: revenue - cogs - expensesAmt,
      orders: s?.orders ?? 0,
      items: s?.items ?? 0,
    };
  });
}

/**
 * The main revenue chart's data.
 *
 * `profit` here is NET profit for the bucket: revenue - COGS - operating
 * expenses recognised in that same bucket. Expenses are lumpy (rent lands on
 * one day), which is honest but spiky - the UI says so in the chart footnote
 * rather than smoothing it silently.
 */
export async function getTimeSeries(
  storeId: Types.ObjectId,
  range: DateRange & { previous?: DateRange },
  grain: Grain,
  timezone: string,
  weekStartsOn = 1,
  opts: { includePrevious?: boolean } = {},
): Promise<TimeSeries> {
  await connectToDatabase();

  const [points, previous] = await Promise.all([
    buildSeries(storeId, range, grain, timezone, weekStartsOn),
    opts.includePrevious && range.previous
      ? buildSeries(storeId, range.previous, grain, timezone, weekStartsOn)
      : Promise.resolve([] as SeriesPoint[]),
  ]);

  // The final bucket is incomplete if the window itself extends past now.
  const partialLast = points.length > 0 && range.to.getTime() > Date.now();

  const totals = points.reduce(
    (a, p) => ({
      revenue: a.revenue + p.revenue,
      expenses: a.expenses + p.expenses,
      profit: a.profit + p.profit,
      orders: a.orders + p.orders,
      items: a.items + p.items,
    }),
    { revenue: 0, expenses: 0, profit: 0, orders: 0, items: 0 },
  );

  return { grain, points, previous, totals, partialLast };
}

/**
 * Revenue by day-of-week across the window - powers the "Friday is your
 * strongest day" insight and the weekly rhythm strip.
 */
export async function getWeekdayProfile(
  storeId: Types.ObjectId,
  range: DateRange,
  timezone: string,
) {
  await connectToDatabase();
  const rows = await Sale.aggregate([
    saleMatch(storeId, range),
    {
      $group: {
        _id: { $dayOfWeek: { date: "$soldAt", timezone } }, // 1 = Sunday
        revenue: { $sum: NET.revenue },
        orders: { $sum: 1 },
      },
    },
  ]).exec();

  const names = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const byDay = new Map<number, { revenue: number; orders: number }>();
  for (const r of rows) byDay.set(r._id - 1, { revenue: r.revenue, orders: r.orders });

  return names.map((name, i) => ({
    weekday: i,
    name,
    short: name.slice(0, 3),
    revenue: byDay.get(i)?.revenue ?? 0,
    orders: byDay.get(i)?.orders ?? 0,
  }));
}

/** Revenue by hour of day - shows a shop owner when their rush actually is. */
export async function getHourlyProfile(
  storeId: Types.ObjectId,
  range: DateRange,
  timezone: string,
) {
  await connectToDatabase();
  const rows = await Sale.aggregate([
    saleMatch(storeId, range),
    {
      $group: {
        _id: { $hour: { date: "$soldAt", timezone } },
        revenue: { $sum: NET.revenue },
        orders: { $sum: 1 },
      },
    },
  ]).exec();

  const byHour = new Map<number, { revenue: number; orders: number }>();
  for (const r of rows) byHour.set(r._id, { revenue: r.revenue, orders: r.orders });

  return Array.from({ length: 24 }, (_, h) => ({
    hour: h,
    label: h === 0 ? "12a" : h < 12 ? `${h}a` : h === 12 ? "12p" : `${h - 12}p`,
    revenue: byHour.get(h)?.revenue ?? 0,
    orders: byHour.get(h)?.orders ?? 0,
  }));
}
