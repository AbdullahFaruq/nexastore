/**
 * Assertions over the two pieces of logic everything else trusts:
 * the pricing engine and timezone-aware range resolution.
 * Run with: npm run check:math
 */
import assert from "node:assert/strict";
import { computeSaleTotals } from "../src/lib/sales/pricing";
import { allocate, parseMoney, formatMoney } from "../src/lib/format/currency";
import { resolveRange, zonedTimeToUtc, zonedParts, startOfZonedDay } from "../src/lib/format/dates";

let passed = 0;
function t(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ok  ${name}`);
  } catch (err) {
    console.error(`  FAIL ${name}`);
    console.error("       ", (err as Error).message);
    process.exitCode = 1;
  }
}

console.log("\nallocate()");
t("distributes without losing a unit", () => {
  const out = allocate(100, [1, 1, 1]);
  assert.equal(out.reduce((a, b) => a + b, 0), 100);
  assert.deepEqual(out.sort(), [33, 33, 34].sort());
});
t("handles a zero total", () => assert.deepEqual(allocate(0, [5, 5]), [0, 0]));
t("handles zero weights", () => assert.deepEqual(allocate(50, [0, 0]), [0, 0]));
t("weights proportionally", () => assert.deepEqual(allocate(300, [100, 200]), [100, 200]));

console.log("\nparseMoney()");
t("parses a decimal string to minor units", () => assert.equal(parseMoney("1,234.56", "USD"), 123456));
t("respects a 0-exponent currency", () => assert.equal(parseMoney("1234", "JPY"), 1234));
t("rejects garbage", () => assert.equal(parseMoney("abc", "USD"), null));
t("rounds half up", () => assert.equal(parseMoney("0.005", "USD"), 1));

console.log("\ncomputeSaleTotals() - exclusive tax");
t("no discount, no tax", () => {
  const r = computeSaleTotals([
    { productId: "a", quantity: 2, unitPrice: 1000, unitCost: 600 },
    { productId: "b", quantity: 1, unitPrice: 2500, unitCost: 1500 },
  ]);
  assert.equal(r.grossAmount, 4500);
  assert.equal(r.netRevenue, 4500);
  assert.equal(r.taxTotal, 0);
  assert.equal(r.total, 4500);
  assert.equal(r.cogsTotal, 2700);
  assert.equal(r.grossProfit, 1800);
  assert.equal(r.itemCount, 3);
});

t("line discount reduces revenue but not gross", () => {
  const r = computeSaleTotals([
    { productId: "a", quantity: 1, unitPrice: 1000, unitCost: 400, lineDiscount: 200 },
  ]);
  assert.equal(r.grossAmount, 1000);
  assert.equal(r.discountTotal, 200);
  assert.equal(r.netRevenue, 800);
  assert.equal(r.grossProfit, 400);
});

t("order discount is allocated and sums exactly", () => {
  const r = computeSaleTotals(
    [
      { productId: "a", quantity: 1, unitPrice: 1000, unitCost: 500 },
      { productId: "b", quantity: 1, unitPrice: 2000, unitCost: 900 },
    ],
    { orderDiscount: 101 },
  );
  const allocatedSum = r.lines.reduce((a, l) => a + l.allocatedOrderDiscount, 0);
  assert.equal(allocatedSum, 101, "allocation must equal the discount exactly");
  assert.equal(r.netRevenue, 3000 - 101);
  assert.equal(r.total, 2899);
});

t("order discount cannot exceed the subtotal", () => {
  const r = computeSaleTotals(
    [{ productId: "a", quantity: 1, unitPrice: 1000, unitCost: 500 }],
    { orderDiscount: 99999 },
  );
  assert.equal(r.orderDiscount, 1000);
  assert.equal(r.netRevenue, 0);
});

t("tax is charged on post-discount revenue, not on gross", () => {
  const r = computeSaleTotals(
    [{ productId: "a", quantity: 1, unitPrice: 10000, unitCost: 4000, taxRateBps: 2000 }],
    { orderDiscount: 2000 },
  );
  assert.equal(r.netRevenue, 8000);
  assert.equal(r.taxTotal, 1600, "20% of 8000, not of 10000");
  assert.equal(r.total, 9600);
});

t("tax is excluded from revenue", () => {
  const r = computeSaleTotals([
    { productId: "a", quantity: 1, unitPrice: 10000, unitCost: 0, taxRateBps: 2500 },
  ]);
  assert.equal(r.netRevenue, 10000, "revenue is ex-tax");
  assert.equal(r.total, 12500, "customer pays revenue + tax");
});

console.log("\ncomputeSaleTotals() - inclusive tax");
t("backs tax out of an inclusive price", () => {
  const r = computeSaleTotals(
    [{ productId: "a", quantity: 1, unitPrice: 12000, unitCost: 5000, taxRateBps: 2000 }],
    { taxMode: "inclusive" },
  );
  assert.equal(r.netRevenue, 10000, "12000 inclusive of 20% -> 10000 base");
  assert.equal(r.taxTotal, 2000);
  assert.equal(r.total, 12000, "customer still pays the entered price");
});

t("line totals always reconcile to the header", () => {
  for (const taxMode of ["exclusive", "inclusive"] as const) {
    const r = computeSaleTotals(
      [
        { productId: "a", quantity: 3, unitPrice: 1999, unitCost: 800, taxRateBps: 1250, lineDiscount: 300 },
        { productId: "b", quantity: 7, unitPrice: 449, unitCost: 210, taxRateBps: 500 },
        { productId: "c", quantity: 1, unitPrice: 89999, unitCost: 62000, taxRateBps: 2000 },
      ],
      { orderDiscount: 777, taxMode },
    );
    const sum = (f: (l: (typeof r.lines)[number]) => number) => r.lines.reduce((a, l) => a + f(l), 0);
    assert.equal(sum((l) => l.netRevenue), r.netRevenue, `${taxMode}: revenue reconciles`);
    assert.equal(sum((l) => l.taxAmount), r.taxTotal, `${taxMode}: tax reconciles`);
    assert.equal(sum((l) => l.cogsAmount), r.cogsTotal, `${taxMode}: cogs reconciles`);
    assert.equal(r.total, r.netRevenue + r.taxTotal, `${taxMode}: total reconciles`);
    assert.equal(sum((l) => l.allocatedOrderDiscount), r.orderDiscount, `${taxMode}: discount reconciles`);
  }
});

t("zero-quantity lines are dropped", () => {
  const r = computeSaleTotals([
    { productId: "a", quantity: 0, unitPrice: 1000, unitCost: 500 },
    { productId: "b", quantity: 2, unitPrice: 1000, unitCost: 500 },
  ]);
  assert.equal(r.lineCount, 1);
  assert.equal(r.netRevenue, 2000);
});

console.log("\ntimezone handling");
t("zonedTimeToUtc round-trips", () => {
  const tz = "Europe/Istanbul";
  const d = zonedTimeToUtc(tz, 2026, 3, 15, 9, 30);
  const p = zonedParts(d, tz);
  assert.equal(p.year, 2026);
  assert.equal(p.month, 3);
  assert.equal(p.day, 15);
  assert.equal(p.hour, 9);
  assert.equal(p.minute, 30);
});

t("survives a spring-forward DST boundary", () => {
  const tz = "America/New_York";
  // 2026-03-08 is the US DST transition.
  const before = zonedTimeToUtc(tz, 2026, 3, 8, 0, 0);
  const after = zonedTimeToUtc(tz, 2026, 3, 9, 0, 0);
  const hours = (after.getTime() - before.getTime()) / 3_600_000;
  assert.equal(hours, 23, "the day the clocks go forward is 23 hours long");
});

t("survives a fall-back DST boundary", () => {
  const tz = "America/New_York";
  const before = zonedTimeToUtc(tz, 2026, 11, 1, 0, 0);
  const after = zonedTimeToUtc(tz, 2026, 11, 2, 0, 0);
  assert.equal((after.getTime() - before.getTime()) / 3_600_000, 25);
});

t("start of day differs by timezone", () => {
  const now = new Date("2026-08-31T02:00:00Z");
  const tokyo = startOfZonedDay(now, "Asia/Tokyo");
  const la = startOfZonedDay(now, "America/Los_Angeles");
  assert.notEqual(tokyo.getTime(), la.getTime());
  // At 02:00 UTC it is already the 31st in Tokyo but still the 30th in LA.
  assert.equal(zonedParts(tokyo, "Asia/Tokyo").day, 31);
  assert.equal(zonedParts(la, "America/Los_Angeles").day, 30);
});

console.log("\nresolveRange()");
t("today is exactly one day long", () => {
  const r = resolveRange("today", "Europe/Istanbul", { now: new Date("2026-08-31T12:00:00Z") });
  assert.equal((r.to.getTime() - r.from.getTime()) / 3_600_000, 24);
  assert.equal(r.grain, "hour");
});

t("a month in progress compares against the same point last month", () => {
  const now = new Date("2026-08-15T12:00:00Z");
  const r = resolveRange("this_month", "UTC", { now });
  assert.equal(r.from.toISOString(), "2026-08-01T00:00:00.000Z");
  assert.equal(r.to.toISOString(), "2026-09-01T00:00:00.000Z");
  assert.equal(r.isPartial, true);
  assert.equal(r.previous.from.toISOString(), "2026-07-01T00:00:00.000Z");
  // Half of August must NOT be measured against the whole of July.
  assert.equal(r.previous.to.toISOString(), "2026-07-15T12:00:00.000Z");
  assert.equal(
    r.previous.to.getTime() - r.previous.from.getTime(),
    r.elapsedMs,
    "the comparison window matches the elapsed window exactly",
  );
});

t("a finished month compares against the whole previous month", () => {
  const now = new Date("2026-09-15T12:00:00Z");
  const r = resolveRange("last_month", "UTC", { now });
  assert.equal(r.isPartial, false);
  assert.equal(r.from.toISOString(), "2026-08-01T00:00:00.000Z");
  assert.equal(r.to.toISOString(), "2026-09-01T00:00:00.000Z");
  assert.equal(r.previous.from.toISOString(), "2026-07-01T00:00:00.000Z");
  assert.equal(r.previous.to.toISOString(), "2026-08-01T00:00:00.000Z");
});

t("a year in progress compares against the same point last year", () => {
  const now = new Date("2026-04-01T00:00:00Z");
  const r = resolveRange("this_year", "UTC", { now });
  assert.equal(r.isPartial, true);
  assert.equal(r.previous.from.toISOString(), "2025-01-01T00:00:00.000Z");
  assert.equal(r.previous.to.toISOString(), "2025-04-01T00:00:00.000Z");
});

t("rolling ranges compare against an equal-length elapsed window", () => {
  const r = resolveRange("last_30", "UTC", { now: new Date("2026-08-31T12:00:00Z") });
  // "Last 30 days" includes today, which is only half over, so the comparison
  // window is trimmed to the same elapsed length rather than a full 30 days.
  assert.equal(r.previous.from.getTime(), r.from.getTime() - 30 * 86_400_000);
  assert.equal(
    r.previous.to.getTime() - r.previous.from.getTime(),
    r.elapsedMs,
    "both windows cover the same elapsed time",
  );
});

t("comparison windows never overlap the current one", () => {
  for (const preset of ["today", "this_week", "this_month", "this_year", "last_7", "last_30"] as const) {
    const r = resolveRange(preset, "UTC", { now: new Date("2026-08-15T09:30:00Z") });
    assert.ok(
      r.previous.to.getTime() <= r.from.getTime(),
      `${preset}: previous window must end at or before the current one starts`,
    );
    assert.ok(r.previous.from.getTime() < r.previous.to.getTime(), `${preset}: previous window has width`);
  }
});

t("weeks respect weekStartsOn", () => {
  const now = new Date("2026-08-31T12:00:00Z"); // a Monday
  const mon = resolveRange("this_week", "UTC", { now, weekStartsOn: 1 });
  const sun = resolveRange("this_week", "UTC", { now, weekStartsOn: 0 });
  assert.equal(mon.from.getUTCDay(), 1);
  assert.equal(sun.from.getUTCDay(), 0);
});

t("year range covers the whole year and picks a month grain", () => {
  const r = resolveRange("this_year", "UTC", { now: new Date("2026-06-01T00:00:00Z") });
  assert.equal(r.from.toISOString(), "2026-01-01T00:00:00.000Z");
  assert.equal(r.to.toISOString(), "2027-01-01T00:00:00.000Z");
  assert.equal(r.grain, "month");
});

t("custom range includes the final day", () => {
  const r = resolveRange("custom", "UTC", { from: "2026-08-01", to: "2026-08-07" });
  assert.equal(r.from.toISOString(), "2026-08-01T00:00:00.000Z");
  assert.equal(r.to.toISOString(), "2026-08-08T00:00:00.000Z", "end is exclusive, so the 7th is included");
});

console.log("\ncurrency formatting");
t("never hardcodes a dollar sign", () => {
  assert.match(formatMoney(2485000, "EUR"), /24\.850|24,850/);
  assert.ok(formatMoney(2485000, "TRY").length > 0);
  assert.equal(formatMoney(1234, "JPY").replace(/[^0-9]/g, ""), "1234", "JPY has no minor unit");
});

console.log(`\n${passed} assertions passed${process.exitCode ? " (with failures above)" : ""}\n`);
