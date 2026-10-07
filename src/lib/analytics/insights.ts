import type { Types } from "mongoose";
import { connectToDatabase } from "@/lib/db/connect";
import { Product } from "@/lib/db/models/product";
import { SaleItem } from "@/lib/db/models/sale-item";
import type { ResolvedRange } from "@/lib/format/dates";
import { ratio } from "@/lib/utils";
import { getFinancialSummary } from "./summary";
import { getWeekdayProfile, getHourlyProfile } from "./timeseries";
import { getTopProducts } from "./products";
import { getStockInsights } from "./inventory";
import { getCategoryPerformance } from "./categories";
import { getCustomerStats } from "./customers";

/**
 * The insight engine.
 *
 * Every insight below is a deterministic reading of the store's own numbers -
 * a threshold, a comparison, or a rate. Nothing here is a language model and
 * nothing is fabricated: each carries the figures it was derived from so the
 * owner can check the claim. `evidence` is what a future LLM layer would be
 * handed as grounding, which is why insights are generated server-side and
 * shaped as data rather than as prose.
 */

export type InsightTone = "positive" | "warning" | "critical" | "neutral";

export interface Insight {
  id: string;
  tone: InsightTone;
  /** Short headline, e.g. "Your revenue is growing". */
  title: string;
  /** One sentence with the specific figures in it. */
  body: string;
  /** Machine-readable numbers behind the claim. */
  evidence: Record<string, number | string | null>;
  /** 0-100; the feed is ordered by this. */
  priority: number;
  href?: string;
  actionLabel?: string;
  /** Category for filtering the insights page. */
  group: "revenue" | "inventory" | "products" | "costs" | "customers" | "operations";
  /** Money fields inside `body` are pre-formatted by the caller. */
  amounts?: Record<string, number>;
}

interface Ctx {
  storeId: Types.ObjectId;
  range: ResolvedRange;
  timezone: string;
  weekStartsOn: number;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Revenue, profit and expense movement against the comparable window. */
async function revenueInsights({ storeId, range }: Ctx): Promise<Insight[]> {
  const summary = await getFinancialSummary(storeId, range);
  const out: Insight[] = [];
  const { current, previous, deltas } = summary;

  if (current.orders === 0) return out;

  if (deltas.revenue.changePct !== null && Math.abs(deltas.revenue.changePct) >= 3) {
    const up = deltas.revenue.changePct > 0;
    out.push({
      id: "revenue-trend",
      tone: up ? "positive" : "warning",
      title: up ? "Your revenue is growing" : "Revenue is slipping",
      body: `Revenue is ${up ? "up" : "down"} ${round1(Math.abs(deltas.revenue.changePct))}% compared with ${range.previousLabel}.`,
      evidence: {
        current: current.revenue,
        previous: previous.revenue,
        changePct: round1(deltas.revenue.changePct),
      },
      amounts: { current: current.revenue, previous: previous.revenue },
      priority: up ? 70 : 88,
      group: "revenue",
      href: "/analytics",
      actionLabel: "See the breakdown",
    });
  }

  // Costs rising is only news when they rise FASTER than the revenue paying for
  // them. Expenses up 12% on revenue up 30% is a business growing, not a
  // problem, and flagging it would train the owner to ignore this feed.
  const expenseGrowth = deltas.expenses.changePct;
  const revenueGrowth = deltas.revenue.changePct;
  const outpacing =
    expenseGrowth !== null &&
    expenseGrowth >= 10 &&
    current.expenses > 0 &&
    (revenueGrowth === null || expenseGrowth > revenueGrowth + 5);

  if (outpacing) {
    const gap = revenueGrowth === null ? null : expenseGrowth - revenueGrowth;
    out.push({
      id: "expense-spike",
      tone: expenseGrowth >= 25 ? "critical" : "warning",
      title: "Costs are outgrowing sales",
      body:
        revenueGrowth === null
          ? `Operating expenses rose ${round1(expenseGrowth)}% this period.`
          : `Operating expenses rose ${round1(expenseGrowth)}% while revenue moved ${revenueGrowth >= 0 ? "up" : "down"} ${round1(Math.abs(revenueGrowth))}% - a gap of ${round1(gap!)} points.`,
      evidence: {
        current: current.expenses,
        previous: previous.expenses,
        expenseChangePct: round1(expenseGrowth),
        revenueChangePct: revenueGrowth === null ? null : round1(revenueGrowth),
      },
      amounts: { current: current.expenses },
      priority: 90,
      group: "costs",
      href: "/expenses",
      actionLabel: "Review expenses",
    });
  }

  // The reassuring counterpart: costs held while the business grew.
  if (
    expenseGrowth !== null &&
    revenueGrowth !== null &&
    revenueGrowth >= 10 &&
    expenseGrowth < revenueGrowth - 10 &&
    current.expenses > 0
  ) {
    out.push({
      id: "operating-leverage",
      tone: "positive",
      title: "You are growing without spending more",
      body: `Revenue rose ${round1(revenueGrowth)}% while operating costs rose only ${round1(expenseGrowth)}%. Expenses now take ${round1(ratio(current.expenses, current.revenue) * 100)}% of revenue, down from ${round1(ratio(previous.expenses, previous.revenue) * 100)}%.`,
      evidence: {
        revenueChangePct: round1(revenueGrowth),
        expenseChangePct: round1(expenseGrowth),
        expenseRatioPct: round1(ratio(current.expenses, current.revenue) * 100),
      },
      priority: 64,
      group: "costs",
      href: "/analytics",
    });
  }

  const marginPts = current.grossMarginPct - previous.grossMarginPct;
  if (Math.abs(marginPts) >= 2 && previous.revenue > 0) {
    const up = marginPts > 0;
    out.push({
      id: "margin-shift",
      tone: up ? "positive" : "warning",
      title: up ? "Margins are improving" : "Margins are compressing",
      body: `Gross margin moved ${up ? "up" : "down"} ${round1(Math.abs(marginPts))} points to ${round1(current.grossMarginPct)}%.`,
      evidence: {
        currentMargin: round1(current.grossMarginPct),
        previousMargin: round1(previous.grossMarginPct),
        pointChange: round1(marginPts),
      },
      priority: up ? 60 : 82,
      group: "revenue",
      href: "/analytics",
    });
  }

  if (current.netProfit < 0) {
    out.push({
      id: "loss-making",
      tone: "critical",
      title: "You are trading at a loss",
      body: `Expenses and cost of goods exceeded revenue this period. Gross profit covered only ${round1(ratio(current.grossProfit, current.expenses) * 100)}% of operating costs.`,
      evidence: { netProfit: current.netProfit, grossProfit: current.grossProfit, expenses: current.expenses },
      amounts: { netProfit: current.netProfit },
      priority: 99,
      group: "costs",
      href: "/analytics",
      actionLabel: "Open profit & loss",
    });
  }

  const discountRate = ratio(current.discounts, current.grossAmount) * 100;
  if (discountRate >= 12 && current.grossAmount > 0) {
    out.push({
      id: "discount-leakage",
      tone: "warning",
      title: "Discounting is eating your margin",
      body: `${round1(discountRate)}% of list value was discounted away this period. Removing a quarter of that would add roughly this much to gross profit.`,
      evidence: { discountRate: round1(discountRate), discounts: current.discounts },
      amounts: { recoverable: Math.round(current.discounts * 0.25) },
      priority: 74,
      group: "revenue",
      href: "/sales",
    });
  }

  const refundRate = ratio(current.refunds, current.revenue + current.refunds) * 100;
  if (refundRate >= 5) {
    out.push({
      id: "refund-rate",
      tone: refundRate >= 10 ? "critical" : "warning",
      title: "Refunds are running high",
      body: `${round1(refundRate)}% of gross sales were refunded this period.`,
      evidence: { refundRate: round1(refundRate), refunds: current.refunds },
      amounts: { refunds: current.refunds },
      priority: 80,
      group: "operations",
      href: "/sales?status=refunded",
    });
  }

  if (deltas.averageOrderValue.changePct !== null && Math.abs(deltas.averageOrderValue.changePct) >= 8) {
    const up = deltas.averageOrderValue.changePct > 0;
    out.push({
      id: "aov-shift",
      tone: up ? "positive" : "neutral",
      title: up ? "Baskets are getting bigger" : "Baskets are getting smaller",
      body: `Average order value ${up ? "rose" : "fell"} ${round1(Math.abs(deltas.averageOrderValue.changePct))}% to this period's average.`,
      evidence: {
        current: current.averageOrderValue,
        previous: previous.averageOrderValue,
        changePct: round1(deltas.averageOrderValue.changePct),
      },
      amounts: { current: current.averageOrderValue },
      priority: 52,
      group: "revenue",
    });
  }

  return out;
}

/** Which day and hour actually carry the week. */
async function rhythmInsights({ storeId, range, timezone }: Ctx): Promise<Insight[]> {
  const [weekdays, hours] = await Promise.all([
    getWeekdayProfile(storeId, range, timezone),
    getHourlyProfile(storeId, range, timezone),
  ]);
  const out: Insight[] = [];

  const trading = weekdays.filter((d) => d.orders > 0);
  if (trading.length >= 3) {
    const avg = trading.reduce((a, d) => a + d.revenue, 0) / trading.length;
    const best = [...trading].sort((a, b) => b.revenue - a.revenue)[0];
    const lift = ratio(best.revenue - avg, avg) * 100;
    if (lift >= 15) {
      out.push({
        id: "best-weekday",
        tone: "neutral",
        title: `${best.name} is your strongest day`,
        body: `You take ${round1(lift)}% more revenue on ${best.name}s than your daily average. Staff and stock accordingly.`,
        evidence: { weekday: best.name, revenue: best.revenue, averageRevenue: Math.round(avg), liftPct: round1(lift) },
        amounts: { revenue: best.revenue },
        priority: 55,
        group: "operations",
        href: "/analytics",
      });
    }

    const worst = [...trading].sort((a, b) => a.revenue - b.revenue)[0];
    if (trading.length >= 5 && ratio(avg - worst.revenue, avg) * 100 >= 40) {
      out.push({
        id: "weakest-weekday",
        tone: "neutral",
        title: `${worst.name}s are quiet`,
        body: `${worst.name} brings in ${round1(ratio(avg - worst.revenue, avg) * 100)}% less than an average day - a candidate for shorter hours or a promotion.`,
        evidence: { weekday: worst.name, revenue: worst.revenue, averageRevenue: Math.round(avg) },
        priority: 40,
        group: "operations",
      });
    }
  }

  // Rank the rush by ORDER COUNT, not revenue: one laptop sale can make a quiet
  // hour look like the peak. And require a real sample - over a short window a
  // handful of orders per hour is noise, and claiming a pattern from it would
  // be exactly the kind of confident nonsense this engine exists to avoid.
  const totalOrders = hours.reduce((a, h) => a + h.orders, 0);
  const busiest = [...hours].sort((a, b) => b.orders - a.orders)[0];
  const totalRevenue = hours.reduce((a, h) => a + h.revenue, 0);

  if (busiest && totalRevenue > 0 && totalOrders >= 120) {
    const window = hours.slice(Math.max(0, busiest.hour - 1), busiest.hour + 2);
    const windowShare = ratio(window.reduce((a, h) => a + h.revenue, 0), totalRevenue) * 100;
    if (windowShare >= 25) {
      out.push({
        id: "peak-hours",
        tone: "neutral",
        title: "Your rush is concentrated",
        body: `${round1(windowShare)}% of revenue lands in the three hours around ${busiest.label}.`,
        evidence: {
        peakHour: busiest.label,
        sharePct: round1(windowShare),
        ordersInPeakHour: busiest.orders,
        totalOrders,
      },
        priority: 45,
        group: "operations",
      });
    }
  }

  return out;
}

/**
 * Stock about to run out, stock that never moves, and stock already gone.
 *
 * Deliberately ignores the selected date range: stock is a position, not a
 * flow. "Two days of cover left" is true today regardless of which month the
 * dashboard is showing, and filtering it by an old range would hide a live
 * problem.
 */
async function inventoryInsights({ storeId }: Ctx): Promise<Insight[]> {
  await connectToDatabase();
  const out: Insight[] = [];

  const atRisk = await getStockInsights(storeId, { onlyAtRisk: true, limit: 60 });

  const urgent = atRisk.filter((p) => p.daysRemaining !== null && p.daysRemaining <= 5 && p.stock > 0);
  if (urgent.length > 0) {
    const worst = urgent[0];
    out.push({
      id: "stock-runway",
      tone: worst.daysRemaining! <= 2 ? "critical" : "warning",
      title: "Inventory warning",
      body:
        urgent.length === 1
          ? `${worst.name} has ${worst.stock} left and sold ${worst.soldRecently} in the last two weeks - roughly ${Math.max(1, Math.round(worst.daysRemaining!))} day${Math.round(worst.daysRemaining!) === 1 ? "" : "s"} of cover.`
          : `${worst.name} has about ${Math.max(1, Math.round(worst.daysRemaining!))} day${Math.round(worst.daysRemaining!) === 1 ? "" : "s"} of stock left, and ${urgent.length - 1} other product${urgent.length - 1 === 1 ? " is" : "s are"} close behind.`,
      evidence: {
        product: worst.name,
        stock: worst.stock,
        soldLast14Days: worst.soldRecently,
        daysRemaining: round1(worst.daysRemaining!),
        atRiskCount: urgent.length,
      },
      priority: 95,
      group: "inventory",
      href: "/inventory?view=restock",
      actionLabel: "Open restock list",
    });
  }

  const outOfStock = await Product.countDocuments({ storeId, status: "active", stock: { $lte: 0 } });
  if (outOfStock > 0) {
    // Only worth flagging if those products were actually earning.
    const lost = await SaleItem.aggregate([
      {
        $match: {
          storeId,
          status: "completed",
          soldAt: { $gte: new Date(Date.now() - 30 * 86_400_000) },
        },
      },
      { $group: { _id: "$productId", revenue: { $sum: "$netRevenue" } } },
      { $lookup: { from: "products", localField: "_id", foreignField: "_id", as: "p" } },
      { $unwind: "$p" },
      { $match: { "p.stock": { $lte: 0 }, "p.status": "active" } },
      { $group: { _id: null, revenue: { $sum: "$revenue" }, count: { $sum: 1 } } },
    ]).exec();

    const l = lost[0];
    if (l && l.count > 0) {
      out.push({
        id: "out-of-stock-cost",
        tone: "critical",
        title: "You are out of stock on sellers",
        body: `${l.count} product${l.count === 1 ? "" : "s"} with no stock earned money in the last 30 days. That shelf space is currently earning nothing.`,
        evidence: { productCount: l.count, revenueLast30Days: l.revenue },
        amounts: { revenueLast30Days: l.revenue },
        priority: 92,
        group: "inventory",
        href: "/inventory?status=out",
        actionLabel: "Restock now",
      });
    }
  }

  // Capital sitting still: in stock, but nothing sold in 60 days.
  const soldRecently = await SaleItem.distinct("productId", {
    storeId,
    soldAt: { $gte: new Date(Date.now() - 60 * 86_400_000) },
  });
  const deadRows = await Product.aggregate([
    { $match: { storeId, status: "active", stock: { $gt: 0 }, _id: { $nin: soldRecently } } },
    {
      $group: {
        _id: null,
        count: { $sum: 1 },
        value: { $sum: { $multiply: ["$stock", "$costPrice"] } },
      },
    },
  ]).exec();

  const dead = deadRows[0];
  if (dead && dead.count >= 3 && dead.value > 0) {
    out.push({
      id: "dead-stock",
      tone: "warning",
      title: "Capital is sitting still",
      body: `${dead.count} products have not sold in 60 days. That is working capital tied up on the shelf.`,
      evidence: { productCount: dead.count, capitalAtCost: dead.value },
      amounts: { capitalAtCost: dead.value },
      priority: 68,
      group: "inventory",
      href: "/inventory?sort=slowest",
      actionLabel: "See slow movers",
    });
  }

  return out;
}

/** Winners, losers and anything selling below cost. */
async function productInsights({ storeId, range }: Ctx): Promise<Insight[]> {
  const out: Insight[] = [];
  const top = await getTopProducts(storeId, range, { limit: 12 });
  if (top.length === 0) return out;

  const best = top[0];
  out.push({
    id: "best-performer",
    tone: "positive",
    title: "Best performer",
    body: `${best.name} generated the most revenue this period across ${best.unitsSold} units, at a ${round1(best.marginPct)}% margin.`,
    evidence: {
      product: best.name,
      revenue: best.revenue,
      units: best.unitsSold,
      marginPct: round1(best.marginPct),
    },
    amounts: { revenue: best.revenue },
    priority: 66,
    group: "products",
    href: `/products/${best.productId}`,
    actionLabel: "View product",
  });

  const surging = top.filter((p) => p.growthPct !== null && p.growthPct >= 40 && p.revenue > 0);
  if (surging.length > 0) {
    const s = surging[0];
    out.push({
      id: "surging-product",
      tone: "positive",
      title: "Something is taking off",
      body: `${s.name} revenue grew ${round1(s.growthPct!)}% against the previous period. Make sure stock keeps up.`,
      evidence: { product: s.name, growthPct: round1(s.growthPct!), revenue: s.revenue, stock: s.currentStock },
      amounts: { revenue: s.revenue },
      priority: 72,
      group: "products",
      href: `/products/${s.productId}`,
    });
  }

  const sinking = top.filter((p) => p.growthPct !== null && p.growthPct <= -35);
  if (sinking.length > 0) {
    const s = sinking[0];
    out.push({
      id: "falling-product",
      tone: "warning",
      title: "A regular seller is fading",
      body: `${s.name} revenue fell ${round1(Math.abs(s.growthPct!))}% versus the previous period.`,
      evidence: { product: s.name, growthPct: round1(s.growthPct!), revenue: s.revenue },
      priority: 64,
      group: "products",
      href: `/products/${s.productId}`,
    });
  }

  const belowCost = top.filter((p) => p.revenue > 0 && p.profit < 0);
  if (belowCost.length > 0) {
    const b = belowCost[0];
    out.push({
      id: "below-cost",
      tone: "critical",
      title: "You are selling below cost",
      body: `${b.name} lost money on every sale this period after discounts. Check its cost price and discount rules.`,
      evidence: { product: b.name, revenue: b.revenue, profit: b.profit },
      amounts: { loss: Math.abs(b.profit) },
      priority: 94,
      group: "products",
      href: `/products/${b.productId}`,
      actionLabel: "Fix pricing",
    });
  }

  // Concentration risk: too much of the business riding on one product.
  const totalRevenue = top.reduce((a, p) => a + p.revenue, 0);
  if (totalRevenue > 0 && best.revenueShare >= 35 && top.length >= 4) {
    out.push({
      id: "concentration-risk",
      tone: "neutral",
      title: "Revenue is concentrated",
      body: `${best.name} alone is ${round1(best.revenueShare)}% of revenue. A supply problem there would be felt immediately.`,
      evidence: { product: best.name, sharePct: round1(best.revenueShare) },
      priority: 48,
      group: "products",
    });
  }

  return out;
}

async function categoryInsights({ storeId, range }: Ctx): Promise<Insight[]> {
  const cats = await getCategoryPerformance(storeId, range);
  const trading = cats.filter((c) => c.revenue > 0);
  if (trading.length < 2) return [];

  const growing = trading
    .filter((c) => c.growthPct !== null && c.growthPct >= 25)
    .sort((a, b) => (b.growthPct ?? 0) - (a.growthPct ?? 0));

  if (growing.length === 0) return [];
  const g = growing[0];
  return [
    {
      id: "category-momentum",
      tone: "positive",
      title: `${g.name} has momentum`,
      body: `${g.name} grew ${round1(g.growthPct!)}% this period and now makes up ${round1(g.revenueShare)}% of revenue.`,
      evidence: { category: g.name, growthPct: round1(g.growthPct!), sharePct: round1(g.revenueShare) },
      amounts: { revenue: g.revenue },
      priority: 58,
      group: "products",
      href: "/categories",
    },
  ];
}

async function customerInsights({ storeId, range }: Ctx): Promise<Insight[]> {
  const stats = await getCustomerStats(storeId, range);
  const out: Insight[] = [];
  if (stats.purchasing < 5) return out;

  if (stats.repeatRate >= 35) {
    out.push({
      id: "loyal-base",
      tone: "positive",
      title: "Customers keep coming back",
      body: `${round1(stats.repeatRate)}% of your customers have bought more than once. Repeat buyers are the cheapest revenue you have.`,
      evidence: { repeatRatePct: round1(stats.repeatRate), repeatCustomers: stats.repeatCustomers },
      amounts: { averageLifetimeValue: stats.averageLifetimeValue },
      priority: 50,
      group: "customers",
      href: "/customers",
    });
  } else if (stats.repeatRate < 15 && stats.purchasing >= 20) {
    out.push({
      id: "weak-retention",
      tone: "warning",
      title: "Few customers return",
      body: `Only ${round1(stats.repeatRate)}% of customers have bought more than once. Winning back an existing customer usually costs less than finding a new one.`,
      evidence: { repeatRatePct: round1(stats.repeatRate), purchasing: stats.purchasing },
      priority: 62,
      group: "customers",
      href: "/customers?segment=at_risk",
      actionLabel: "See at-risk customers",
    });
  }

  if (stats.newInPeriod > 0) {
    out.push({
      id: "new-customers",
      tone: "positive",
      title: "New customers arrived",
      body: `${stats.newInPeriod} ${stats.newInPeriod === 1 ? "customer" : "customers"} bought from you for the first time this period.`,
      evidence: { newCustomers: stats.newInPeriod },
      priority: 42,
      group: "customers",
      href: "/customers?segment=new",
    });
  }

  return out;
}

/**
 * Generate the full insight feed. Generators run in parallel and one failing
 * must not blank the page - a broken insight is dropped, not fatal.
 */
export async function generateInsights(ctx: Ctx): Promise<Insight[]> {
  await connectToDatabase();

  const generators = [
    revenueInsights,
    rhythmInsights,
    inventoryInsights,
    productInsights,
    categoryInsights,
    customerInsights,
  ];

  const settled = await Promise.allSettled(generators.map((g) => g(ctx)));
  const insights: Insight[] = [];
  for (const r of settled) {
    if (r.status === "fulfilled") insights.push(...r.value);
    else console.error("[insights] generator failed:", r.reason);
  }

  return insights.sort((a, b) => b.priority - a.priority);
}
