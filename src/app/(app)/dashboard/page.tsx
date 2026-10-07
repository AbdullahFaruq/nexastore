import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import {
  Banknote, Boxes, Coins, Receipt, ScanLine, ShoppingCart, TrendingDown, Wallet,
} from "lucide-react";
import { requireStoreContext } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import {
  generateInsights, getFinancialSummary, getStockInsights,
  getTimeSeries, getTopProducts, getWeekdayProfile,
} from "@/lib/analytics";
import { Sale } from "@/lib/db/models/sale";
import { connectToDatabase } from "@/lib/db/connect";
import { grainFromParams, grainsFor, rangeFromParams } from "@/lib/range-params";
import { PageBody, PageHeader } from "@/components/shared/page-header";
import { DateRangePicker } from "@/components/shared/date-range-picker";
import { ProfitPanel } from "@/components/dashboard/profit-panel";
import { MetricCard } from "@/components/dashboard/metric-card";
import { RevenueAnalytics } from "@/components/dashboard/revenue-analytics";
import { TopProducts } from "@/components/dashboard/top-products";
import { StockIntelligence } from "@/components/dashboard/stock-intelligence";
import { WeeklyRhythm } from "@/components/dashboard/weekly-rhythm";
import { InsightCard, InsightFeedEmpty } from "@/components/dashboard/insight-card";
import { SalesTable, type SaleRow } from "@/components/sales/sales-table";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { SkeletonChart, SkeletonMetric, SkeletonRows } from "@/components/ui/skeleton";
import { EmployeeDashboardNote } from "@/components/dashboard/employee-note";

export const metadata: Metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

type Ctx = Awaited<ReturnType<typeof requireStoreContext>>;
type Range = ReturnType<typeof rangeFromParams>;
type GrainValue = ReturnType<typeof grainFromParams>;

export default async function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  const ctx = await requireStoreContext();
  const params = await searchParams;
  // The user's saved default is the fallback when the URL carries no range.
  const range = rangeFromParams(
    params,
    ctx.timezone,
    ctx.weekStartsOn,
    (ctx.profile.preferences?.defaultRange as Parameters<typeof rangeFromParams>[3]) ?? "last_30",
  );
  const grain = grainFromParams(params, range);
  const showFinancials = can(ctx.role, "analytics:view");

  // Panels the user has switched off in Settings > Appearance.
  const hidden = new Set(ctx.profile.preferences?.hiddenWidgets ?? []);
  const shows = (id: string) => !hidden.has(id);

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={`How ${ctx.store.name} is performing over ${range.label.toLowerCase()}.`}
        actions={
          <>
            <DateRangePicker
              defaultPreset={
                (ctx.profile.preferences?.defaultRange as "last_30" | undefined) ?? "last_30"
              }
            />
            {can(ctx.role, "sales:create") ? (
              <Button asChild variant="primary" size="sm">
                <Link href="/pos">
                  <ScanLine />
                  New sale
                </Link>
              </Button>
            ) : null}
          </>
        }
      />

      <PageBody className="space-y-4">
        {!showFinancials ? <EmployeeDashboardNote /> : null}

        <Suspense fallback={<HeroSkeleton />}>
          <Hero ctx={ctx} range={range} grain={grain} showFinancials={showFinancials} />
        </Suspense>

        {showFinancials && shows("chart") ? (
          <Suspense
            fallback={
              <Panel className="p-5">
                <SkeletonChart />
              </Panel>
            }
          >
            <Chart ctx={ctx} range={range} grain={grain} />
          </Suspense>
        ) : null}

        {shows("products") || shows("stock") ? (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
            {shows("products") ? (
              <Suspense fallback={<PanelSkeleton title="Top selling products" />}>
                <TopProductsSection ctx={ctx} range={range} />
              </Suspense>
            ) : null}
            {shows("stock") ? (
              <Suspense fallback={<PanelSkeleton title="Needs restocking" />}>
                <StockSection ctx={ctx} />
              </Suspense>
            ) : null}
          </div>
        ) : null}

        <div className="grid grid-cols-1 xl:grid-cols-[1.55fr_1fr] gap-4 items-start">
          {shows("recent") ? (
            <Suspense fallback={<PanelSkeleton title="Recent sales" rows={8} />}>
              <RecentSalesSection ctx={ctx} />
            </Suspense>
          ) : null}

          <div className="space-y-4">
            {showFinancials && shows("rhythm") ? (
              <Suspense fallback={<PanelSkeleton title="Weekly rhythm" rows={3} />}>
                <RhythmSection ctx={ctx} range={range} />
              </Suspense>
            ) : null}
            {showFinancials && shows("insights") ? (
              <Suspense fallback={<PanelSkeleton title="What to look at" rows={3} />}>
                <InsightsSection ctx={ctx} range={range} />
              </Suspense>
            ) : null}
          </div>
        </div>
      </PageBody>
    </>
  );
}

/* ------------------------------------------------------------------- hero */

async function Hero({
  ctx, range, grain, showFinancials,
}: {
  ctx: Ctx;
  range: Range;
  grain: GrainValue;
  showFinancials: boolean;
}) {
  const [summary, series] = await Promise.all([
    getFinancialSummary(ctx.storeId, range),
    getTimeSeries(ctx.storeId, range, grain, ctx.timezone, ctx.weekStartsOn),
  ]);

  const { current, deltas } = summary;
  const trend = (key: "revenue" | "expenses" | "profit" | "orders" | "items") =>
    series.points.map((p) => p[key]);

  if (!showFinancials) {
    // An employee sees activity, never margins.
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard
          label="Orders" value={current.orders} format="count" icon={<ShoppingCart />}
          changePct={deltas.orders.changePct} comparisonLabel={`vs ${range.previousShort}`}
          trend={trend("orders")} href="/sales"
        />
        <MetricCard
          label="Items sold" value={current.items} format="count" icon={<Boxes />}
          changePct={deltas.items.changePct} comparisonLabel={`vs ${range.previousShort}`}
          trend={trend("items")}
        />
        <MetricCard
          label="Average basket" value={current.averageOrderValue} format="money" icon={<Coins />}
          changePct={deltas.averageOrderValue.changePct} comparisonLabel={`vs ${range.previousShort}`}
        />
        <MetricCard
          label="Taken at the till" value={current.revenue + current.tax} format="money" icon={<Receipt />}
          hint="Total collected from customers, including tax"
        />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1.85fr)] gap-3">
      <ProfitPanel
        netProfit={current.netProfit}
        changePct={deltas.netProfit.changePct}
        comparisonLabel={range.previousLabel}
        revenue={current.revenue}
        cogs={current.cogs}
        expenses={current.expenses}
        grossMarginPct={current.grossMarginPct}
        netMarginPct={current.netMarginPct}
        marginPointChange={current.grossMarginPct - summary.previous.grossMarginPct}
        trend={trend("profit")}
        canSeeAnalytics={can(ctx.role, "analytics:view")}
      />

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <MetricCard
          label="Revenue" value={current.revenue} format="money" icon={<Banknote />}
          changePct={deltas.revenue.changePct} comparisonLabel={`vs ${range.previousShort}`}
          trend={trend("revenue")} compact
          hint="Net of discounts and refunds, excluding tax"
        />
        <MetricCard
          label="Expenses" value={current.expenses} format="money" icon={<Wallet />}
          changePct={deltas.expenses.changePct} comparisonLabel={`vs ${range.previousShort}`}
          invertDelta trend={trend("expenses")} href="/expenses" compact
        />
        <MetricCard
          label="Cost of goods" value={current.cogs} format="money" icon={<TrendingDown />}
          changePct={deltas.cogs.changePct} comparisonLabel={`vs ${range.previousShort}`}
          invertDelta compact
          hint="What the stock you sold cost you"
        />
        <MetricCard
          label="Orders" value={current.orders} format="count" icon={<ShoppingCart />}
          changePct={deltas.orders.changePct} comparisonLabel={`vs ${range.previousShort}`}
          trend={trend("orders")} href="/sales" compact
        />
        <MetricCard
          label="Average order" value={current.averageOrderValue} format="money" icon={<Coins />}
          changePct={deltas.averageOrderValue.changePct} comparisonLabel={`vs ${range.previousShort}`}
          compact
        />
        <MetricCard
          label="Items sold" value={current.items} format="count" icon={<Boxes />}
          changePct={deltas.items.changePct} comparisonLabel={`vs ${range.previousShort}`}
          trend={trend("items")} compact
        />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ chart */

async function Chart({ ctx, range, grain }: { ctx: Ctx; range: Range; grain: GrainValue }) {
  const series = await getTimeSeries(
    ctx.storeId, range, grain, ctx.timezone, ctx.weekStartsOn, { includePrevious: true },
  );

  const sum = (rows: typeof series.points, key: "revenue" | "profit" | "expenses" | "orders" | "items") =>
    rows.reduce((a, p) => a + p[key], 0);

  return (
    <RevenueAnalytics
      points={series.points}
      previous={series.previous}
      grain={grain}
      comparisonLabel={range.previousLabel}
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
  );
}

/* --------------------------------------------------------------- sections */

async function TopProductsSection({ ctx, range }: { ctx: Ctx; range: Range }) {
  const products = await getTopProducts(ctx.storeId, range, { limit: 6 });
  return <TopProducts products={products} />;
}

async function StockSection({ ctx }: { ctx: Ctx }) {
  const items = await getStockInsights(ctx.storeId, { onlyAtRisk: true, limit: 6 });
  return <StockIntelligence items={items} />;
}

async function RhythmSection({ ctx, range }: { ctx: Ctx; range: Range }) {
  const days = await getWeekdayProfile(ctx.storeId, range, ctx.timezone);
  return <WeeklyRhythm days={days} />;
}

async function InsightsSection({ ctx, range }: { ctx: Ctx; range: Range }) {
  const insights = await generateInsights({
    storeId: ctx.storeId,
    range,
    timezone: ctx.timezone,
    weekStartsOn: ctx.weekStartsOn,
  });

  return (
    <Panel>
      <PanelHeader
        title="What to look at"
        description="Computed from your own data"
        actions={
          <Button asChild variant="ghost" size="xs">
            <Link href="/insights">All insights</Link>
          </Button>
        }
      />
      {insights.length === 0 ? (
        <InsightFeedEmpty />
      ) : (
        <div className="p-3 space-y-2.5">
          {insights.slice(0, 4).map((insight) => (
            <InsightCard key={insight.id} insight={insight} compact />
          ))}
        </div>
      )}
    </Panel>
  );
}

async function RecentSalesSection({ ctx }: { ctx: Ctx }) {
  await connectToDatabase();
  const rows = await Sale.find({ storeId: ctx.storeId })
    .sort({ soldAt: -1 })
    .limit(9)
    .select({
      orderNumber: 1, customerName: 1, customerId: 1, itemCount: 1, lineCount: 1,
      total: 1, netRevenue: 1, paymentMethod: 1, status: 1, soldAt: 1, channel: 1,
    })
    .lean();

  const sales: SaleRow[] = rows.map((s) => ({
    id: String(s._id),
    orderNumber: s.orderNumber,
    customerName: s.customerName,
    customerId: s.customerId ? String(s.customerId) : undefined,
    itemCount: s.itemCount,
    lineCount: s.lineCount,
    total: s.total,
    netRevenue: s.netRevenue,
    paymentMethod: s.paymentMethod,
    status: s.status,
    soldAt: new Date(s.soldAt).toISOString(),
    channel: s.channel,
  }));

  return (
    <Panel>
      <PanelHeader
        title="Recent sales"
        description="The latest transactions across the store"
        actions={
          <Button asChild variant="ghost" size="xs">
            <Link href="/sales">View all</Link>
          </Button>
        }
      />
      <SalesTable sales={sales} compact />
    </Panel>
  );
}

/* -------------------------------------------------------------- skeletons */

function HeroSkeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1.85fr)] gap-3">
      <div className="min-h-[236px] rounded-[9px] border border-[var(--line)] bg-[var(--surface)] p-5">
        <SkeletonChart className="min-h-[160px]" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonMetric key={i} />
        ))}
      </div>
    </div>
  );
}

function PanelSkeleton({ title, rows = 6 }: { title: string; rows?: number }) {
  return (
    <Panel>
      <PanelHeader title={title} />
      <SkeletonRows rows={rows} cols={4} />
    </Panel>
  );
}
