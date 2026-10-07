import type { Types } from "mongoose";
import type { DateRange, ResolvedRange } from "@/lib/format/dates";
import { pctChange, ratio } from "@/lib/utils";
import { getPeriodTotals, type PeriodTotals } from "./summary";
import { getExpenseBreakdown, type ExpenseBreakdown } from "./expenses";

export interface PnlLine {
  key: string;
  label: string;
  /** Signed: additions are positive, deductions negative. */
  amount: number;
  kind: "revenue" | "deduction" | "subtotal" | "total";
  /** Indent level for the statement view. */
  depth: number;
  hint?: string;
  /** Percentage of net revenue, for the common-size column. */
  ofRevenuePct?: number;
}

export interface WaterfallStep {
  key: string;
  label: string;
  /** Signed contribution. */
  delta: number;
  /** Running total after this step. */
  running: number;
  /** Bar base for a floating waterfall bar. */
  base: number;
  height: number;
  kind: "increase" | "decrease" | "total";
}

export interface ProfitAndLoss {
  totals: PeriodTotals;
  previous: PeriodTotals;
  lines: PnlLine[];
  waterfall: WaterfallStep[];
  expenseBreakdown: ExpenseBreakdown[];
  deltas: {
    revenue: number | null;
    grossProfit: number | null;
    netProfit: number | null;
    expenses: number | null;
    grossMarginPts: number;
    netMarginPts: number;
  };
  range: ResolvedRange;
}

/**
 * The full statement.
 *
 *   Gross revenue (list price)
 *   - discounts
 *   - refunds
 *   = Net revenue          <- "Revenue" everywhere else in the product
 *   - cost of goods sold
 *   = Gross profit
 *   - operating expenses
 *   = Net profit
 *
 * Tax collected is deliberately absent: it is money held for the tax authority,
 * never income. It is reported separately on the statement as a memo line.
 */
export async function getProfitAndLoss(
  storeId: Types.ObjectId,
  range: ResolvedRange,
): Promise<ProfitAndLoss> {
  const [totals, previous, expenseBreakdown] = await Promise.all([
    getPeriodTotals(storeId, range),
    getPeriodTotals(storeId, range.previous),
    getExpenseBreakdown(storeId, range),
  ]);

  const pct = (n: number) => ratio(n, totals.revenue) * 100;

  const lines: PnlLine[] = [
    {
      key: "gross",
      label: "Gross revenue",
      amount: totals.grossAmount,
      kind: "revenue",
      depth: 0,
      hint: "Everything sold, at list price",
      ofRevenuePct: pct(totals.grossAmount),
    },
    {
      key: "discounts",
      label: "Discounts",
      amount: -totals.discounts,
      kind: "deduction",
      depth: 1,
      hint: "Given away at the till",
      ofRevenuePct: -pct(totals.discounts),
    },
    {
      key: "refunds",
      label: "Refunds",
      amount: -totals.refunds,
      kind: "deduction",
      depth: 1,
      hint: "Returned to customers",
      ofRevenuePct: -pct(totals.refunds),
    },
    {
      key: "revenue",
      label: "Net revenue",
      amount: totals.revenue,
      kind: "subtotal",
      depth: 0,
      hint: "What the business actually earned, before costs",
      ofRevenuePct: 100,
    },
    {
      key: "cogs",
      label: "Cost of goods sold",
      amount: -totals.cogs,
      kind: "deduction",
      depth: 1,
      hint: "What the sold stock cost to buy",
      ofRevenuePct: -pct(totals.cogs),
    },
    {
      key: "grossProfit",
      label: "Gross profit",
      amount: totals.grossProfit,
      kind: "subtotal",
      depth: 0,
      hint: "Margin earned on trading",
      ofRevenuePct: pct(totals.grossProfit),
    },
    ...expenseBreakdown.map<PnlLine>((e) => ({
      key: `expense:${e.category}`,
      label: e.label,
      amount: -e.amount,
      kind: "deduction",
      depth: 1,
      ofRevenuePct: -pct(e.amount),
    })),
    {
      key: "expenses",
      label: "Total operating expenses",
      amount: -totals.expenses,
      kind: "deduction",
      depth: 0,
      ofRevenuePct: -pct(totals.expenses),
    },
    {
      key: "netProfit",
      label: "Net profit",
      amount: totals.netProfit,
      kind: "total",
      depth: 0,
      hint: "What the owner keeps",
      ofRevenuePct: pct(totals.netProfit),
    },
  ];

  // Waterfall: gross revenue down to net profit, each deduction a floating bar.
  const steps: { key: string; label: string; delta: number; kind: WaterfallStep["kind"] }[] = [
    { key: "gross", label: "Gross revenue", delta: totals.grossAmount, kind: "increase" },
    { key: "discounts", label: "Discounts", delta: -totals.discounts, kind: "decrease" },
    { key: "refunds", label: "Refunds", delta: -totals.refunds, kind: "decrease" },
    { key: "cogs", label: "Cost of goods", delta: -totals.cogs, kind: "decrease" },
    { key: "expenses", label: "Operating costs", delta: -totals.expenses, kind: "decrease" },
    { key: "netProfit", label: "Net profit", delta: 0, kind: "total" },
  ];

  let running = 0;
  const waterfall: WaterfallStep[] = steps.map((s) => {
    if (s.kind === "total") {
      return { ...s, running, base: Math.min(0, running), height: Math.abs(running), delta: running };
    }
    const start = running;
    running += s.delta;
    return {
      ...s,
      running,
      base: Math.min(start, running),
      height: Math.abs(s.delta),
    };
  });

  return {
    totals,
    previous,
    lines,
    waterfall,
    expenseBreakdown,
    deltas: {
      revenue: pctChange(totals.revenue, previous.revenue),
      grossProfit: pctChange(totals.grossProfit, previous.grossProfit),
      netProfit: pctChange(totals.netProfit, previous.netProfit),
      expenses: pctChange(totals.expenses, previous.expenses),
      grossMarginPts: totals.grossMarginPct - previous.grossMarginPct,
      netMarginPts: totals.netMarginPct - previous.netMarginPct,
    },
    range,
  };
}

/** Compact P&L for a sub-window, used by the daily/weekly/monthly report tabs. */
export async function getPeriodComparison(
  storeId: Types.ObjectId,
  windows: { key: string; label: string; range: DateRange }[],
) {
  const results = await Promise.all(
    windows.map(async (w) => ({ ...w, totals: await getPeriodTotals(storeId, w.range) })),
  );
  return results;
}
