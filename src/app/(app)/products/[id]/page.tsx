import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Types } from "mongoose";
import { ArrowLeft, Boxes, Coins, Pencil, ScanLine, TrendingUp } from "lucide-react";
import { requireStoreContext } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { getProductStats } from "@/lib/analytics/products";
import { classifyStock } from "@/lib/analytics/inventory";
import { connectToDatabase } from "@/lib/db/connect";
import { Category } from "@/lib/db/models/category";
import { InventoryMovement } from "@/lib/db/models/inventory-movement";
import { Product } from "@/lib/db/models/product";
import { SaleItem } from "@/lib/db/models/sale-item";
import { formatMoney } from "@/lib/format/currency";
import { formatDate, relativeTime } from "@/lib/format/dates";
import { unitEconomics } from "@/lib/sales/pricing";
import { grainFromParams, rangeFromParams } from "@/lib/range-params";
import { PageBody, PageHeader } from "@/components/shared/page-header";
import { DateRangePicker } from "@/components/shared/date-range-picker";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ProductTile } from "@/components/shared/product-tile";
import { ProductStatusBadge, StockStatusBadge } from "@/components/ui/status-badge";
import { ProductTrendChart } from "@/components/products/product-trend-chart";
import { MovementList } from "@/components/inventory/movement-list";
import { EmptyState, EmptyChartMark } from "@/components/ui/empty-state";

export const dynamic = "force-dynamic";

/**
 * Units sold in the last fortnight - the same window the dashboard's stock
 * intelligence uses, so days-of-cover agrees across both screens.
 */
async function unitsSoldInLastTwoWeeks(storeId: Types.ObjectId, productId: Types.ObjectId) {
  const rows = await SaleItem.aggregate([
    {
      $match: {
        storeId,
        productId,
        status: { $in: ["completed", "refunded"] },
        soldAt: { $gte: new Date(Date.now() - 14 * 86_400_000) },
      },
    },
    { $group: { _id: null, units: { $sum: { $subtract: ["$quantity", "$refundedQuantity"] } } } },
  ]);
  return (rows[0]?.units as number | undefined) ?? 0;
}

export async function generateMetadata({ params }: PageProps<"/products/[id]">): Promise<Metadata> {
  const { id } = await params;
  if (!Types.ObjectId.isValid(id)) return { title: "Product" };
  const ctx = await requireStoreContext();
  await connectToDatabase();
  const p = await Product.findOne({ _id: new Types.ObjectId(id), storeId: ctx.storeId })
    .select({ name: 1 })
    .lean();
  return { title: p?.name ?? "Product" };
}

export default async function ProductDetailPage({ params, searchParams }: PageProps<"/products/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const ctx = await requireStoreContext();
  if (!Types.ObjectId.isValid(id)) notFound();

  await connectToDatabase();
  const product = await Product.findOne({ _id: new Types.ObjectId(id), storeId: ctx.storeId }).lean();
  if (!product) notFound();

  const range = rangeFromParams(sp, ctx.timezone, ctx.weekStartsOn, "last_90");
  const grain = grainFromParams(sp, range);
  const showFinancials = can(ctx.role, "analytics:view");

  const [stats, category, recentSales, movements] = await Promise.all([
    getProductStats(ctx.storeId, product._id, range, grain, ctx.timezone, ctx.weekStartsOn),
    product.categoryId
      ? Category.findOne({ _id: product.categoryId, storeId: ctx.storeId }).select({ name: 1 }).lean()
      : Promise.resolve(null),
    SaleItem.find({ storeId: ctx.storeId, productId: product._id })
      .sort({ soldAt: -1 })
      .limit(8)
      .select({ orderNumber: 1, saleId: 1, quantity: 1, netRevenue: 1, soldAt: 1, status: 1 })
      .lean(),
    InventoryMovement.find({ storeId: ctx.storeId, productId: product._id })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean(),
  ]);

  const econ = unitEconomics(product.price, product.costPrice, product.discountPrice);
  const money = (n: number) => formatMoney(n, ctx.currency);

  const soldRecently = await unitsSoldInLastTwoWeeks(ctx.storeId, product._id);
  const velocity = soldRecently / 14;
  const daysRemaining = velocity > 0 ? product.stock / velocity : null;
  const stockStatus = classifyStock(product.stock, product.minStock, daysRemaining);

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Products", href: "/products" }, { label: product.name }]}
        title={
          <span className="flex items-center gap-3">
            <ProductTile name={product.name} sku={product.sku} image={product.images?.[0]} size={38} />
            <span className="min-w-0 truncate">{product.name}</span>
          </span>
        }
        description={
          <span className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-[12.5px]">{product.sku}</span>
            {category ? <Badge tone="outline" size="sm">{category.name}</Badge> : null}
            {product.status !== "active" ? <ProductStatusBadge status={product.status} /> : null}
            {product.supplier ? <span className="text-ink-3">from {product.supplier}</span> : null}
          </span>
        }
        actions={
          <>
            <DateRangePicker defaultPreset="last_90" />
            {can(ctx.role, "products:write") ? (
              <Button asChild variant="secondary" size="sm">
                <Link href={`/products/${id}/edit`}>
                  <Pencil />
                  Edit
                </Link>
              </Button>
            ) : null}
            {can(ctx.role, "sales:create") && product.stock > 0 ? (
              <Button asChild variant="primary" size="sm">
                <Link href="/pos">
                  <ScanLine />
                  Sell
                </Link>
              </Button>
            ) : null}
          </>
        }
      />

      <PageBody className="space-y-4">
        {/* ------------------------------------------------------- metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Metric
            icon={<Boxes />}
            label="In stock"
            value={`${product.stock}`}
            sub={
              daysRemaining !== null
                ? `about ${daysRemaining < 1 ? "<1" : Math.round(daysRemaining)} day${Math.round(daysRemaining) === 1 ? "" : "s"} of cover`
                : "no sales in the last 14 days"
            }
            badge={<StockStatusBadge status={stockStatus} />}
          />
          <Metric
            icon={<Coins />}
            label="Units sold"
            value={stats.period.unitsSold.toLocaleString()}
            sub={`${stats.period.orders} order${stats.period.orders === 1 ? "" : "s"} in ${range.label.toLowerCase()}`}
          />
          {showFinancials ? (
            <>
              <Metric
                icon={<TrendingUp />}
                label="Revenue"
                value={money(stats.period.revenue)}
                sub={`${money(stats.lifetime.revenue)} lifetime`}
              />
              <Metric
                icon={<TrendingUp />}
                label="Profit"
                value={money(stats.period.profit)}
                sub={`${stats.period.marginPct.toFixed(1)}% margin`}
                tone={stats.period.profit < 0 ? "bad" : "good"}
              />
            </>
          ) : (
            <>
              <Metric icon={<Coins />} label="Price" value={money(econ.effectivePrice)} sub={product.unit} />
              <Metric icon={<Boxes />} label="Reorder point" value={String(product.minStock)} sub="warn at or below" />
            </>
          )}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.9fr)_minmax(0,1fr)] gap-4 items-start">
          <div className="space-y-4">
            {/* ------------------------------------------------- trend */}
            <Panel>
              <PanelHeader
                title="Sales trend"
                description={`Units and revenue over ${range.label.toLowerCase()}`}
              />
              <div className="p-4 sm:p-5">
                {stats.period.unitsSold === 0 ? (
                  <EmptyState
                    icon={<EmptyChartMark />}
                    title="No sales in this period"
                    description="Try a wider date range, or sell one at the till to see the chart come alive."
                    compact
                  />
                ) : (
                  <ProductTrendChart points={stats.points} showRevenue={showFinancials} />
                )}
              </div>
            </Panel>

            {/* ------------------------------------------- recent orders */}
            <Panel>
              <PanelHeader title="Recent orders" description="The latest times this product sold" />
              {recentSales.length === 0 ? (
                <EmptyState title="Never sold" description="This product has not appeared on an order yet." compact />
              ) : (
                <ul className="divide-y divide-[var(--line)]">
                  {recentSales.map((s) => (
                    <li key={String(s._id)}>
                      <Link
                        href={`/sales/${String(s.saleId)}`}
                        className="flex items-center justify-between gap-3 px-4 sm:px-5 py-2.5 hover:bg-[var(--inset)] transition-colors"
                      >
                        <span className="min-w-0">
                          <span className="block font-mono text-[12.5px] font-medium text-ink">
                            {s.orderNumber}
                          </span>
                          <span className="block text-[11.5px] text-ink-3 mt-0.5">
                            {formatDate(s.soldAt, ctx.timezone)} &middot; {relativeTime(s.soldAt)}
                          </span>
                        </span>
                        <span className="text-right shrink-0">
                          <span className="block text-[13px] text-ink-2 tnum">
                            {s.quantity} {s.quantity === 1 ? product.unit : `${product.unit}s`}
                          </span>
                          {showFinancials ? (
                            <span className="block text-[11.5px] text-ink-3 tnum mt-0.5">
                              {money(s.netRevenue)}
                            </span>
                          ) : null}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>

          {/* ----------------------------------------------------- rail */}
          <div className="space-y-4">
            {showFinancials ? (
              <Panel>
                <PanelHeader title="Unit economics" />
                <div className="p-4 sm:p-5 space-y-2.5">
                  <Row label="Cost price" value={money(product.costPrice)} />
                  <Row label="Selling price" value={money(product.price)} />
                  {econ.isDiscounted ? (
                    <Row label="Promotional price" value={money(econ.effectivePrice)} accent />
                  ) : null}
                  <div className="pt-2.5 border-t border-[var(--line)] space-y-2.5">
                    <Row label="Profit per unit" value={money(econ.profitPerUnit)} strong />
                    <Row label="Margin" value={`${econ.marginPct.toFixed(1)}%`} strong />
                    {product.taxRateBps > 0 ? (
                      <Row label="Tax rate" value={`${(product.taxRateBps / 100).toFixed(2)}%`} />
                    ) : null}
                  </div>
                  <div className="pt-2.5 border-t border-[var(--line)] space-y-2.5">
                    <Row label="Stock value at cost" value={money(product.stock * product.costPrice)} />
                    <Row label="If it all sells" value={money(product.stock * econ.effectivePrice)} />
                  </div>
                </div>
              </Panel>
            ) : null}

            <Panel>
              <PanelHeader title="Inventory history" description="Every change, and why" />
              <MovementList movements={movements.map((m) => ({
                id: String(m._id),
                type: m.type,
                quantity: m.quantity,
                stockAfter: m.stockAfter,
                reason: m.reason,
                orderNumber: m.orderNumber,
                createdAt: new Date(m.createdAt).toISOString(),
                createdByName: m.createdByName,
              }))} />
            </Panel>

            {product.description ? (
              <Panel>
                <PanelHeader title="Description" />
                <div className="p-4 sm:p-5">
                  <p className="text-[13px] text-ink-2 leading-relaxed whitespace-pre-wrap">
                    {product.description}
                  </p>
                </div>
              </Panel>
            ) : null}

            <Button asChild variant="ghost" size="sm" className="w-full">
              <Link href="/products">
                <ArrowLeft />
                All products
              </Link>
            </Button>
          </div>
        </div>
      </PageBody>
    </>
  );
}

function Metric({
  icon, label, value, sub, badge, tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  badge?: React.ReactNode;
  tone?: "good" | "bad";
}) {
  return (
    <div className="rounded-[9px] border border-[var(--line)] bg-[var(--surface)] p-4">
      <div className="flex items-center gap-1.5 text-[12px] font-medium text-ink-2">
        <span className="text-[var(--ink-3)] [&_svg]:size-[15px]" aria-hidden>{icon}</span>
        {label}
      </div>
      <p
        className={`num-hero text-[22px] font-semibold mt-2 leading-none tnum ${
          tone === "bad" ? "text-[var(--neg)]" : "text-ink"
        }`}
      >
        {value}
      </p>
      {badge ? <div className="mt-2">{badge}</div> : null}
      {sub ? <p className="text-[11.5px] text-ink-3 mt-2 leading-snug">{sub}</p> : null}
    </div>
  );
}

function Row({
  label, value, strong, accent,
}: {
  label: string;
  value: string;
  strong?: boolean;
  accent?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-[12.5px] text-ink-3">{label}</span>
      <span
        className={`text-[13px] tnum ${
          accent ? "text-[var(--accent-ink)] font-medium" : strong ? "font-semibold text-ink" : "text-ink-2"
        }`}
      >
        {value}
      </span>
    </div>
  );
}
