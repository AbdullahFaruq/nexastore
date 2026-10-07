import type { Metadata } from "next";
import Link from "next/link";
import { Boxes, PackageX, TrendingDown, Wallet } from "lucide-react";
import { requireStoreContext } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { getInventoryTotals, getStockInsights } from "@/lib/analytics/inventory";
import { connectToDatabase } from "@/lib/db/connect";
import { Category } from "@/lib/db/models/category";
import { InventoryMovement } from "@/lib/db/models/inventory-movement";
import { Product } from "@/lib/db/models/product";
import { formatMoney } from "@/lib/format/currency";
import { first } from "@/lib/range-params";
import { PageBody, PageHeader } from "@/components/shared/page-header";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { MovementList } from "@/components/inventory/movement-list";
import { InventoryBoard } from "@/components/inventory/inventory-board";
import { StockAdjustDialog } from "@/components/inventory/stock-adjust-dialog";

export const metadata: Metadata = { title: "Inventory" };
export const dynamic = "force-dynamic";

export default async function InventoryPage({ searchParams }: PageProps<"/inventory">) {
  const ctx = await requireStoreContext();
  const params = await searchParams;
  await connectToDatabase();

  const view = first(params, "view") ?? "all";
  const statusFilter = first(params, "status") ?? "all";
  const q = first(params, "q")?.trim() ?? "";
  const categoryId = first(params, "categoryId") ?? "all";
  const sort = first(params, "sort") ?? "urgency";

  const [insights, totals, categories, movements, products] = await Promise.all([
    getStockInsights(ctx.storeId, { onlyAtRisk: view === "restock" }),
    getInventoryTotals(ctx.storeId),
    Category.find({ storeId: ctx.storeId }).sort({ sortOrder: 1, name: 1 }).select({ name: 1 }).lean(),
    InventoryMovement.find({ storeId: ctx.storeId })
      .sort({ createdAt: -1 })
      .limit(25)
      .lean(),
    Product.find({ storeId: ctx.storeId, status: { $ne: "archived" } })
      .sort({ name: 1 })
      .select({ name: 1, sku: 1, stock: 1, costPrice: 1, unit: 1 })
      .lean(),
  ]);

  const money = (n: number) => formatMoney(n, ctx.currency);
  const canAdjust = can(ctx.role, "inventory:adjust");

  return (
    <>
      <PageHeader
        title="Inventory"
        description="What you hold, what it is worth, and what is about to run out."
        actions={
          canAdjust ? (
            <StockAdjustDialog
              products={products.map((p) => ({
                id: String(p._id),
                name: p.name,
                sku: p.sku,
                stock: p.stock,
                unit: p.unit,
              }))}
              openByDefault={first(params, "adjust") === "1"}
            />
          ) : null
        }
      />

      <PageBody className="space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Stat
            icon={<Wallet />}
            label="Stock value at cost"
            value={money(totals.stockValueAtCost)}
            sub={`${totals.totalUnits.toLocaleString()} units across ${totals.productCount} products`}
          />
          <Stat
            icon={<Boxes />}
            label="Value at retail"
            value={money(totals.stockValueAtRetail)}
            sub={`${money(totals.potentialProfit)} profit if it all sells`}
          />
          <Stat
            icon={<TrendingDown />}
            label="At or below reorder"
            value={String(totals.lowStock)}
            sub="products need attention"
            tone={totals.lowStock > 0 ? "warn" : undefined}
          />
          <Stat
            icon={<PackageX />}
            label="Out of stock"
            value={String(totals.outOfStock)}
            sub="cannot be sold right now"
            tone={totals.outOfStock > 0 ? "bad" : undefined}
          />
        </div>

        <InventoryBoard
          items={insights}
          categories={categories.map((c) => ({ id: String(c._id), name: c.name }))}
          view={view}
          statusFilter={statusFilter}
          query={q}
          categoryId={categoryId}
          sort={sort}
          canAdjust={canAdjust}
        />

        <Panel>
          <PanelHeader
            title="Inventory movement history"
            description="Every change to a stock level, and what caused it"
            actions={
              <Button asChild variant="ghost" size="xs">
                <Link href="/reports?type=inventory">Export</Link>
              </Button>
            }
          />
          <MovementList
            showProduct
            movements={movements.map((m) => ({
              id: String(m._id),
              type: m.type,
              quantity: m.quantity,
              stockAfter: m.stockAfter,
              reason: m.reason,
              orderNumber: m.orderNumber,
              createdAt: new Date(m.createdAt).toISOString(),
              createdByName: m.createdByName,
              productName: m.productName,
              productId: String(m.productId),
            }))}
            emptyMessage="No stock has moved yet. Adding a product or making a sale records the first movement."
          />
        </Panel>
      </PageBody>
    </>
  );
}

function Stat({
  icon, label, value, sub, tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  tone?: "warn" | "bad";
}) {
  return (
    <div className="rounded-[9px] border border-[var(--line)] bg-[var(--surface)] p-4">
      <div className="flex items-center gap-1.5 text-[12px] font-medium text-ink-2">
        <span className="text-[var(--ink-3)] [&_svg]:size-[15px]" aria-hidden>{icon}</span>
        {label}
      </div>
      <p
        className={`num-hero text-[22px] font-semibold mt-2 leading-none tnum ${
          tone === "bad" ? "text-[var(--neg)]" : tone === "warn" ? "text-[#8a5d00] dark:text-[var(--st-warn)]" : "text-ink"
        }`}
      >
        {value}
      </p>
      <p className="text-[11.5px] text-ink-3 mt-2 leading-snug">{sub}</p>
    </div>
  );
}
