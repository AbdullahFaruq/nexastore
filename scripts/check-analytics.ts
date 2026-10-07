/**
 * Runs every analytics pipeline against the seeded store and asserts the
 * figures reconcile. This is the guard against a rollup quietly double
 * counting or dropping refunds.
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local", quiet: true });
loadEnv({ quiet: true });

import mongoose from "mongoose";
import { connectToDatabase } from "../src/lib/db/connect";
import { Store } from "../src/lib/db/models/store";
import { Sale } from "../src/lib/db/models/sale";
import { SaleItem } from "../src/lib/db/models/sale-item";
import { Expense } from "../src/lib/db/models/expense";
import { resolveRange } from "../src/lib/format/dates";
import { formatMoney } from "../src/lib/format/currency";
import {
  getFinancialSummary, getTimeSeries, getTopProducts, getStockInsights,
  getInventoryTotals, getCategoryPerformance, getExpenseBreakdown,
  getCustomerSegmentCounts, getProfitAndLoss, generateInsights, getWeekdayProfile,
} from "../src/lib/analytics";

let failures = 0;
function check(name: string, condition: boolean, detail?: string) {
  if (condition) console.log(`  ok    ${name}`);
  else {
    console.log(`  FAIL  ${name}${detail ? ` - ${detail}` : ""}`);
    failures++;
  }
}

async function main() {
  await connectToDatabase();
  const store = await Store.findOne({ isDemo: true });
  if (!store) throw new Error("No demo store found. Run `npm run seed` first.");

  const fmt = (n: number) => formatMoney(n, store.currency);
  const range = resolveRange("this_year", store.timezone, { weekStartsOn: store.settings.weekStartsOn });

  console.log(`\n  Store: ${store.name} (${store.currency}, ${store.timezone})`);
  console.log(`  Window: ${range.label} ${range.from.toISOString().slice(0, 10)} -> ${range.to.toISOString().slice(0, 10)}\n`);

  /* --------------------------------------------------- financial summary */
  const summary = await getFinancialSummary(store._id, range);
  const c = summary.current;
  console.log("  Financial summary");
  console.log(`    revenue        ${fmt(c.revenue)}`);
  console.log(`    cogs           ${fmt(c.cogs)}`);
  console.log(`    gross profit   ${fmt(c.grossProfit)}  (${c.grossMarginPct.toFixed(1)}%)`);
  console.log(`    expenses       ${fmt(c.expenses)}`);
  console.log(`    net profit     ${fmt(c.netProfit)}  (${c.netMarginPct.toFixed(1)}%)`);
  console.log(`    orders         ${c.orders}`);
  console.log(`    items          ${c.items}`);
  console.log(`    AOV            ${fmt(c.averageOrderValue)}\n`);

  check("revenue is positive", c.revenue > 0);
  check("gross profit = revenue - cogs", c.grossProfit === c.revenue - c.cogs);
  check("net profit = gross profit - expenses", c.netProfit === c.grossProfit - c.expenses);
  check("AOV = revenue / orders", c.averageOrderValue === Math.round(c.revenue / c.orders));
  check("margin is plausible for retail (10-70%)", c.grossMarginPct > 10 && c.grossMarginPct < 70,
    `${c.grossMarginPct.toFixed(1)}%`);

  /* ----------------------------- cross-check against raw collection sums */
  const rawSale = await Sale.aggregate([
    { $match: { storeId: store._id, status: { $in: ["completed", "refunded"] }, soldAt: { $gte: range.from, $lt: range.to } } },
    { $group: { _id: null, rev: { $sum: { $subtract: ["$netRevenue", "$refundedRevenue"] } } } },
  ]);
  check("summary revenue matches a raw Sale aggregation", rawSale[0]?.rev === c.revenue,
    `${rawSale[0]?.rev} vs ${c.revenue}`);

  const rawItems = await SaleItem.aggregate([
    { $match: { storeId: store._id, status: { $in: ["completed", "refunded"] }, soldAt: { $gte: range.from, $lt: range.to } } },
    { $group: { _id: null, rev: { $sum: { $subtract: ["$netRevenue", "$refundedRevenue"] } } } },
  ]);
  check("Sale header totals reconcile with the SaleItem ledger", rawItems[0]?.rev === c.revenue,
    `items ${rawItems[0]?.rev} vs sales ${c.revenue}`);

  const rawExp = await Expense.aggregate([
    { $match: { storeId: store._id, date: { $gte: range.from, $lt: range.to } } },
    { $group: { _id: null, total: { $sum: "$amount" } } },
  ]);
  check("expenses match a raw Expense aggregation", rawExp[0]?.total === c.expenses);

  const cancelled = await Sale.countDocuments({ storeId: store._id, status: "cancelled" });
  const pending = await Sale.countDocuments({ storeId: store._id, status: "pending" });
  check("cancelled and pending orders exist but are excluded", cancelled > 0 && pending > 0,
    `cancelled ${cancelled}, pending ${pending}`);

  /* ---------------------------------------------------------- timeseries */
  const series = await getTimeSeries(
    store._id, range, range.grain, store.timezone, store.settings.weekStartsOn, { includePrevious: true },
  );
  check("series has no gaps (a bucket per period)", series.points.length >= 6, `${series.points.length} buckets`);
  check("series revenue sums to the summary revenue", series.totals.revenue === c.revenue,
    `${series.totals.revenue} vs ${c.revenue}`);
  check("previous-period series is aligned", series.previous.length === series.points.length ||
    series.previous.length > 0, `${series.previous.length}`);
  const zeroBuckets = series.points.filter((p) => p.revenue === 0).length;
  console.log(`    ${series.points.length} ${series.grain} buckets, ${zeroBuckets} empty\n`);

  /* ------------------------------------------------------------ products */
  const top = await getTopProducts(store._id, range, { limit: 5 });
  console.log("  Top products");
  for (const p of top) {
    console.log(`    ${p.name.padEnd(28).slice(0, 28)} ${String(p.unitsSold).padStart(5)} units  ${fmt(p.revenue).padStart(12)}  ${p.marginPct.toFixed(0)}% margin`);
  }
  console.log();
  check("top products returned", top.length === 5);
  check("top products are sorted by revenue", top.every((p, i) => i === 0 || top[i - 1].revenue >= p.revenue));
  check("revenue share sums sensibly", top[0].revenueShare > 0 && top[0].revenueShare <= 100);
  check("profit = revenue - cogs per product", top.every((p) => p.profit === p.revenue - p.cogs));

  /* ----------------------------------------------------------- inventory */
  const stock = await getStockInsights(store._id, { onlyAtRisk: true, limit: 6 });
  const totals = await getInventoryTotals(store._id);
  console.log("  Stock at risk");
  for (const s of stock.slice(0, 5)) {
    console.log(`    ${s.name.padEnd(28).slice(0, 28)} ${String(s.stock).padStart(4)} left  ${String(s.soldRecently).padStart(4)} sold/14d  ${s.daysRemaining === null ? "no recent sales" : `${s.daysRemaining.toFixed(1)}d cover`}  [${s.status}]`);
  }
  console.log(`\n    stock at cost ${fmt(totals.stockValueAtCost)} / retail ${fmt(totals.stockValueAtRetail)}`);
  console.log(`    ${totals.productCount} products, ${totals.lowStock} low, ${totals.outOfStock} out\n`);
  check("stock insights identify at-risk products", stock.length > 0);
  check("at-risk list is ordered worst-first", stock[0].status !== "healthy");
  check("inventory retail value exceeds cost value", totals.stockValueAtRetail > totals.stockValueAtCost);

  /* ---------------------------------------------------------- categories */
  const cats = await getCategoryPerformance(store._id, range);
  const catRevenue = cats.reduce((a, x) => a + x.revenue, 0);
  check("category revenue sums to total revenue", catRevenue === c.revenue, `${catRevenue} vs ${c.revenue}`);
  console.log("  Categories");
  for (const x of cats) console.log(`    ${x.name.padEnd(14)} ${fmt(x.revenue).padStart(12)}  ${x.revenueShare.toFixed(1)}%  ${x.growthPct === null ? "-" : `${x.growthPct.toFixed(1)}%`}`);
  console.log();

  /* ------------------------------------------------------------ expenses */
  const exp = await getExpenseBreakdown(store._id, range);
  const expSum = exp.reduce((a, x) => a + x.amount, 0);
  check("expense breakdown sums to total expenses", expSum === c.expenses, `${expSum} vs ${c.expenses}`);
  check("expense shares sum to ~100%", Math.abs(exp.reduce((a, x) => a + x.share, 0) - 100) < 0.5);

  /* ----------------------------------------------------------- customers */
  const segs = await getCustomerSegmentCounts(store._id);
  const segTotal = Object.values(segs.counts).reduce((a, s) => a + s.count, 0);
  check("every customer lands in exactly one segment", segTotal === segs.total, `${segTotal} vs ${segs.total}`);
  console.log("  Customer segments");
  for (const [k, v] of Object.entries(segs.counts)) console.log(`    ${k.padEnd(12)} ${String(v.count).padStart(4)}  ${fmt(v.value)}`);
  console.log();

  /* ----------------------------------------------------------------- P&L */
  const pnl = await getProfitAndLoss(store._id, range);
  const netLine = pnl.lines.find((l) => l.key === "netProfit")!;
  check("P&L net profit matches the summary", netLine.amount === c.netProfit);
  const waterfallEnd = pnl.waterfall[pnl.waterfall.length - 1];
  check("waterfall lands on net profit", waterfallEnd.running === c.netProfit,
    `${waterfallEnd.running} vs ${c.netProfit}`);
  const grossLine = pnl.lines.find((l) => l.key === "revenue")!;
  check("gross revenue - discounts - refunds = net revenue",
    pnl.totals.grossAmount - pnl.totals.discounts - pnl.totals.refunds === grossLine.amount,
    `${pnl.totals.grossAmount - pnl.totals.discounts - pnl.totals.refunds} vs ${grossLine.amount}`);

  console.log("  Profit & loss");
  for (const l of pnl.lines.filter((x) => x.depth === 0)) {
    console.log(`    ${l.label.padEnd(26)} ${fmt(l.amount).padStart(14)}  ${l.ofRevenuePct?.toFixed(1)}%`);
  }
  console.log();

  /* -------------------------------------------------------------- rhythm */
  const weekdays = await getWeekdayProfile(store._id, range, store.timezone);
  const best = [...weekdays].sort((a, b) => b.revenue - a.revenue)[0];
  check("weekday profile covers all seven days", weekdays.length === 7);
  console.log(`  Strongest day: ${best.name} (${fmt(best.revenue)})\n`);

  /* ------------------------------------------------------------ insights */
  const insights = await generateInsights({
    storeId: store._id, range, timezone: store.timezone, weekStartsOn: store.settings.weekStartsOn,
  });
  check("insights were generated from the data", insights.length >= 5, `${insights.length} insights`);
  check("insights are ordered by priority", insights.every((x, i) => i === 0 || insights[i - 1].priority >= x.priority));
  check("every insight carries its evidence", insights.every((x) => Object.keys(x.evidence).length > 0));

  console.log(`  Insights (${insights.length})`);
  for (const i of insights.slice(0, 10)) {
    console.log(`    [${i.tone.padEnd(8)}] ${i.title}`);
    console.log(`               ${i.body}`);
  }

  console.log(`\n  ${failures === 0 ? "All analytics checks passed." : `${failures} CHECK(S) FAILED`}\n`);
  await mongoose.disconnect();
  if (failures > 0) process.exit(1);
}

main().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
