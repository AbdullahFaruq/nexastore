import type { Metadata } from "next";
import Link from "next/link";
import { FileText } from "lucide-react";
import { requireStoreContext } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import {
  getCategoryPerformance, getHourlyProfile, getProfitAndLoss, getTimeSeries, getWeekdayProfile,
} from "@/lib/analytics";
import { resolveRange } from "@/lib/format/dates";
import { formatMoney } from "@/lib/format/currency";
import { grainFromParams, grainsFor, rangeFromParams } from "@/lib/range-params";
import { PageBody, PageHeader } from "@/components/shared/page-header";
import { DateRangePicker } from "@/components/shared/date-range-picker";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { Delta, DeltaPoints } from "@/components/shared/delta";
import { PnlWaterfall } from "@/components/analytics/pnl-waterfall";
import { PnlStatement } from "@/components/analytics/pnl-statement";
import { RevenueAnalytics } from "@/components/dashboard/revenue-analytics";
import { WeeklyRhythm } from "@/components/dashboard/weekly-rhythm";
import { HourlyProfile } from "@/components/analytics/hourly-profile";
import { CategoryPerformanceTable } from "@/components/analytics/category-performance";
import { PeriodComparison } from "@/components/analytics/period-comparison";

export const metadata: Metadata = { title: "Analytics" };
export const dynamic = "force-dynamic";

export default async function AnalyticsPage({ searchParams }: PageProps<"/analytics">) {
  const ctx = await requireStoreContext();
  if (!can(ctx.role, "analytics:view")) {
    return (
      <PageBody className="pt-10">
        <p className="text-[13.5px] text-ink-2">
          Financial analytics is limited to owners and managers. Ask a store owner if you need access.
        </p>
      </PageBody>
    );
  }

  const params = await searchParams;
  const range = rangeFromParams(params, ctx.timezone, ctx.weekStartsOn, "this_month");
  const grain = grainFromParams(params, range);
  const now = new Date();

  const [pnl, series, weekdays, hours, categories] = await Promise.all([
    getProfitAndLoss(ctx.storeId, range),
    getTimeSeries(ctx.storeId, range, grain, ctx.timezone, ctx.weekStartsOn, { includePrevious: true }),
    getWeekdayProfile(ctx.storeId, range, ctx.timezone),
    getHourlyProfile(ctx.storeId, range, ctx.timezone),
    getCategoryPerformance(ctx.storeId, range),
  ]);

  // Daily / weekly / monthly / yearly, always computed from the ledger.
  const windows = (["today", "this_week", "this_month", "this_year"] as const).map((preset) => ({
    key: preset,
    range: resolveRange(preset, ctx.timezone, { now, weekStartsOn: ctx.weekStartsOn }),
  }));
  const periodTotals = await Promise.all(
    windows.map(async (w) => {
      const { getPeriodTotals } = await import("@/lib/analytics/summary");
      const [current, previous] = await Promise.all([
        getPeriodTotals(ctx.storeId, w.range),
        getPeriodTotals(ctx.storeId, w.range.previous),
      ]);
      return { key: w.key, label: w.range.label, previousLabel: w.range.previousShort, current, previous };
    }),
  );

  const money = (n: number) => formatMoney(n, ctx.currency);
  const sum = (rows: typeof series.points, key: "revenue" | "profit" | "expenses" | "orders" | "items") =>
    rows.reduce((a, p) => a + p[key], 0);

  return (
    <>
      <PageHeader
        title="Analytics"
        description="Where the money comes from, where it goes, and what is left."
        actions={
          <>
            <DateRangePicker defaultPreset="this_month" />
            <Button asChild variant="secondary" size="sm">
              <Link href="/reports?type=profit">
                <FileText />
                Export
              </Link>
            </Button>
          </>
        }
      />

      <PageBody className="space-y-4">
        {/* ------------------------------------------------- headline row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Headline
            label="Net revenue"
            value={money(pnl.totals.revenue)}
            footer={<Delta value={pnl.deltas.revenue} size="sm" suffix={`vs ${range.previousShort}`} />}
          />
          <Headline
            label="Gross profit"
            value={money(pnl.totals.grossProfit)}
            footer={
              <span className="flex items-center gap-2 flex-wrap">
                <span className="text-[11.5px] text-ink-3 tnum">
                  {pnl.totals.grossMarginPct.toFixed(1)}% margin
                </span>
                <DeltaPoints value={pnl.deltas.grossMarginPts} />
              </span>
            }
          />
          <Headline
            label="Operating expenses"
            value={money(pnl.totals.expenses)}
            footer={<Delta value={pnl.deltas.expenses} invert size="sm" suffix={`vs ${range.previousShort}`} />}
          />
          <Headline
            label="Net profit"
            value={money(pnl.totals.netProfit)}
            emphasis
            negative={pnl.totals.netProfit < 0}
            footer={<Delta value={pnl.deltas.netProfit} size="sm" suffix={`vs ${range.previousShort}`} />}
          />
        </div>

        {/* ------------------------------------------------------ waterfall */}
        <Panel>
          <PanelHeader
            title="From takings to profit"
            description={`Every step between what customers paid and what the business kept, over ${range.label.toLowerCase()}.`}
          />
          <div className="p-4 sm:p-6">
            <PnlWaterfall steps={pnl.waterfall} />
          </div>
          <div className="px-4 sm:px-6 py-3 border-t border-[var(--line)] bg-[var(--inset)]">
            <p className="text-[12px] text-ink-3 leading-relaxed">
              Tax collected from customers is not shown: it is money held for the tax authority, never
              income. Cost of goods is the cost of the stock actually sold in this period, taken from
              each sale at the moment it happened.
            </p>
          </div>
        </Panel>

        {/* ---------------------------------------------------------- trend */}
        <RevenueAnalytics
          points={series.points}
          previous={series.previous}
          grain={grain}
          comparisonLabel={range.previousShort}
          availableGrains={grainsFor(range)}
          partialLast={series.partialLast}
          totals={{
            revenue: sum(series.points, "revenue"),
            profit: sum(series.points, "profit"),
            expenses: sum(series.points, "expenses"),
            orders: sum(series.points, "orders"),
            items: sum(series.points, "items"),
          }}
          previousTotals={{
            revenue: sum(series.previous, "revenue"),
            profit: sum(series.previous, "profit"),
            expenses: sum(series.previous, "expenses"),
            orders: sum(series.previous, "orders"),
            items: sum(series.previous, "items"),
          }}
        />

        {/* ------------------------------------------------------ statement */}
        <Panel>
          <PanelHeader
            title="Profit and loss"
            description={`${range.label}${range.isPartial ? " so far" : ""}`}
          />
          <div className="overflow-x-auto">
            <PnlStatement lines={pnl.lines} />
          </div>
        </Panel>

        {/* --------------------------------------------------- period stack */}
        <PeriodComparison periods={periodTotals} />

        {/* ------------------------------------------------------- patterns */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
          <WeeklyRhythm days={weekdays} />
          <HourlyProfile hours={hours} />
        </div>

        <CategoryPerformanceTable categories={categories} />
      </PageBody>
    </>
  );
}

function Headline({
  label, value, footer, emphasis, negative,
}: {
  label: string;
  value: string;
  footer?: React.ReactNode;
  emphasis?: boolean;
  negative?: boolean;
}) {
  return (
    <div
      className={`rounded-[9px] border p-4 ${
        emphasis
          ? "border-[var(--accent-soft-line)] bg-[var(--accent-soft)]"
          : "border-[var(--line)] bg-[var(--surface)]"
      }`}
    >
      <p className={`text-[12px] font-medium ${emphasis ? "text-[var(--accent-ink)]" : "text-ink-2"}`}>
        {label}
      </p>
      <p
        className={`num-hero text-[24px] font-semibold mt-2 leading-none tnum ${
          negative ? "text-[var(--neg)]" : "text-ink"
        }`}
      >
        {value}
      </p>
      {footer ? <div className="mt-2.5 min-w-0">{footer}</div> : null}
    </div>
  );
}
