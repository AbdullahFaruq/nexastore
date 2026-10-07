import type { Types } from "mongoose";
import { connectToDatabase } from "@/lib/db/connect";
import { Expense } from "@/lib/db/models/expense";
import { EXPENSE_CATEGORIES, type ExpenseCategory } from "@/lib/db/models/enums";
import { EXPENSE_CATEGORY_META } from "./expense-meta";
import type { DateRange, Grain } from "@/lib/format/dates";
import { bucketLabel } from "@/lib/format/dates";
import { pctChange, ratio } from "@/lib/utils";
import { enumerateBuckets, expenseMatch, truncExpr } from "./shared";

export { EXPENSE_CATEGORY_META } from "./expense-meta";

export interface ExpenseBreakdown {
  category: ExpenseCategory;
  label: string;
  colorSlot: number;
  amount: number;
  count: number;
  share: number;
  changePct: number | null;
}

export async function getExpenseBreakdown(
  storeId: Types.ObjectId,
  range: DateRange & { previous?: DateRange },
): Promise<ExpenseBreakdown[]> {
  await connectToDatabase();

  const group = (r: DateRange) =>
    Expense.aggregate([
      expenseMatch(storeId, r),
      { $group: { _id: "$category", amount: { $sum: "$amount" }, count: { $sum: 1 } } },
    ]).exec();

  const [current, previous] = await Promise.all([
    group(range),
    range.previous ? group(range.previous) : Promise.resolve([]),
  ]);

  const curBy = new Map(current.map((r) => [r._id as ExpenseCategory, r]));
  const prevBy = new Map(previous.map((r) => [r._id as ExpenseCategory, r.amount as number]));
  const total = current.reduce((a, r) => a + r.amount, 0);

  return EXPENSE_CATEGORIES.map((cat) => {
    const cur = curBy.get(cat);
    const amount = cur?.amount ?? 0;
    const prev = prevBy.get(cat);
    return {
      category: cat,
      label: EXPENSE_CATEGORY_META[cat].label,
      colorSlot: EXPENSE_CATEGORY_META[cat].colorSlot,
      amount,
      count: cur?.count ?? 0,
      share: ratio(amount, total) * 100,
      changePct: prev === undefined ? null : pctChange(amount, prev),
    };
  })
    .filter((r) => r.amount > 0 || r.count > 0)
    .sort((a, b) => b.amount - a.amount);
}

/** Expense trend over time, optionally split by category for a stacked view. */
export async function getExpenseSeries(
  storeId: Types.ObjectId,
  range: DateRange,
  grain: Grain,
  timezone: string,
  weekStartsOn = 1,
  opts: { byCategory?: boolean } = {},
) {
  await connectToDatabase();

  const rows = await Expense.aggregate([
    expenseMatch(storeId, range),
    {
      $group: {
        _id: opts.byCategory
          ? { bucket: truncExpr("date", grain, timezone, weekStartsOn), category: "$category" }
          : truncExpr("date", grain, timezone, weekStartsOn),
        amount: { $sum: "$amount" },
      },
    },
    { $sort: { _id: 1 } },
  ]).exec();

  const buckets = enumerateBuckets(range, grain, timezone, weekStartsOn);

  if (!opts.byCategory) {
    const by = new Map<number, number>();
    for (const r of rows) by.set(new Date(r._id).getTime(), r.amount);
    return buckets.map((d) => ({
      t: d.toISOString(),
      label: bucketLabel(d, grain, timezone),
      amount: by.get(d.getTime()) ?? 0,
    }));
  }

  const by = new Map<number, Record<string, number>>();
  for (const r of rows) {
    const key = new Date(r._id.bucket).getTime();
    const entry = by.get(key) ?? {};
    entry[r._id.category] = r.amount;
    by.set(key, entry);
  }

  return buckets.map((d) => {
    const entry = by.get(d.getTime()) ?? {};
    const row: Record<string, string | number> = {
      t: d.toISOString(),
      label: bucketLabel(d, grain, timezone),
    };
    let total = 0;
    for (const cat of EXPENSE_CATEGORIES) {
      row[cat] = entry[cat] ?? 0;
      total += entry[cat] ?? 0;
    }
    row.amount = total;
    return row;
  });
}

/** Largest single expenses in the window - where the money actually went. */
export async function getTopExpenses(storeId: Types.ObjectId, range: DateRange, limit = 5) {
  await connectToDatabase();
  return Expense.find({ storeId, date: { $gte: range.from, $lt: range.to } })
    .sort({ amount: -1 })
    .limit(limit)
    .select({ description: 1, amount: 1, category: 1, date: 1, vendor: 1 })
    .lean();
}
