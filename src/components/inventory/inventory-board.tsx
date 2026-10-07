"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, ListChecks, Package } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/format/currency";
import type { StockInsight } from "@/lib/analytics/inventory";
import type { StockStatus } from "@/lib/inventory/status";
import { useStore } from "@/components/providers/store-provider";
import { Panel } from "@/components/ui/panel";
import { ProductTile } from "@/components/shared/product-tile";
import { StockStatusBadge } from "@/components/ui/status-badge";
import { SearchFilter, SelectFilter, useUrlFilters } from "@/components/shared/filter-bar";
import { EmptyState } from "@/components/ui/empty-state";
import { Td, Th } from "@/components/sales/sales-table";

/**
 * The stock board.
 *
 * "Restock needed" is the default lens because that is the question a shop
 * owner actually opens this screen with. Days of cover is derived from real
 * sales velocity, and the suggested order quantity targets three weeks of
 * cover - so the answer is a number to put on a purchase order, not homework.
 */
export function InventoryBoard({
  items, categories, view, statusFilter, query, categoryId, sort, canAdjust,
}: {
  items: StockInsight[];
  categories: { id: string; name: string }[];
  view: string;
  statusFilter: string;
  query: string;
  categoryId: string;
  sort: string;
  canAdjust: boolean;
}) {
  const { currency } = useStore();
  const { set } = useUrlFilters();

  const filtered = React.useMemo(() => {
    let rows = items;
    if (statusFilter !== "all") rows = rows.filter((r) => r.status === (statusFilter as StockStatus));
    if (categoryId !== "all") {
      rows = rows.filter((r) =>
        categoryId === "none" ? !r.categoryName : r.categoryName === categories.find((c) => c.id === categoryId)?.name,
      );
    }
    if (query) {
      const q = query.toLowerCase();
      rows = rows.filter((r) => r.name.toLowerCase().includes(q) || r.sku.toLowerCase().includes(q));
    }

    const sorted = [...rows];
    switch (sort) {
      case "value": return sorted.sort((a, b) => b.stockValue - a.stockValue);
      case "fastest": return sorted.sort((a, b) => b.velocityPerDay - a.velocityPerDay);
      case "slowest": return sorted.sort((a, b) => a.velocityPerDay - b.velocityPerDay);
      case "stock_low": return sorted.sort((a, b) => a.stock - b.stock);
      case "name": return sorted.sort((a, b) => a.name.localeCompare(b.name));
      default: return sorted; // already ordered by urgency server-side
    }
  }, [items, statusFilter, categoryId, query, sort, categories]);

  const restockTotal = filtered.reduce((a, r) => a + r.suggestedReorder * r.costPrice, 0);
  const restocking = view === "restock";

  return (
    <Panel>
      <div className="flex flex-col gap-3 px-4 sm:px-5 pt-4 pb-3 border-b border-[var(--line)]">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div
            className="inline-flex items-center gap-0.5 p-0.5 rounded-[8px] bg-[var(--surface-2)] border border-[var(--line)]"
            role="group"
            aria-label="Inventory view"
          >
            <button
              type="button"
              onClick={() => set({ view: null })}
              aria-pressed={!restocking}
              className={cn(
                "flex items-center gap-1.5 px-2.5 h-7 rounded-[6px] text-[12.5px] font-medium transition-colors",
                !restocking ? "bg-[var(--surface)] text-ink shadow-card" : "text-ink-3 hover:text-ink-2",
              )}
            >
              <Package className="size-3.5" />
              All stock
            </button>
            <button
              type="button"
              onClick={() => set({ view: "restock" })}
              aria-pressed={restocking}
              className={cn(
                "flex items-center gap-1.5 px-2.5 h-7 rounded-[6px] text-[12.5px] font-medium transition-colors",
                restocking ? "bg-[var(--surface)] text-ink shadow-card" : "text-ink-3 hover:text-ink-2",
              )}
            >
              <ListChecks className="size-3.5" />
              Restock needed
            </button>
          </div>

          {restocking && restockTotal > 0 ? (
            <p className="text-[12.5px] text-ink-2">
              Suggested order value{" "}
              <span className="font-semibold text-ink tnum">{formatMoney(restockTotal, currency)}</span>
              <span className="text-ink-3"> at cost</span>
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <SearchFilter placeholder="Product or SKU" className="w-full sm:w-[220px]" />
          <SelectFilter
            paramKey="status"
            label="Stock status"
            options={[
              { value: "all", label: "All statuses" },
              { value: "critical", label: "Critical" },
              { value: "low", label: "Running low" },
              { value: "out", label: "Out of stock" },
              { value: "healthy", label: "Healthy" },
            ]}
          />
          <SelectFilter
            paramKey="categoryId"
            label="Category"
            options={[
              { value: "all", label: "All categories" },
              ...categories.map((c) => ({ value: c.id, label: c.name })),
              { value: "none", label: "Uncategorised" },
            ]}
          />
          <SelectFilter
            paramKey="sort"
            label="Sort"
            options={[
              { value: "urgency", label: "Most urgent" },
              { value: "stock_low", label: "Least stock" },
              { value: "value", label: "Highest value" },
              { value: "fastest", label: "Fastest moving" },
              { value: "slowest", label: "Slowest moving" },
              { value: "name", label: "Name A-Z" },
            ]}
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={restocking ? <ListChecks strokeWidth={1.25} /> : <Package strokeWidth={1.25} />}
          title={restocking ? "Nothing needs restocking" : "No products match"}
          description={
            restocking
              ? "Every product is comfortably above its reorder point at the current rate of sale."
              : "Try clearing a filter or searching for something else."
          }
          compact
        />
      ) : (
        <>
          {/* Desktop */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[var(--line)]">
                  <Th className="pl-4 sm:pl-5">Product</Th>
                  <Th className="text-right">In stock</Th>
                  <Th className="text-right">Reorder at</Th>
                  <Th className="text-right">Sold / 14d</Th>
                  <Th className="text-right">Cover</Th>
                  <Th>Status</Th>
                  <Th className="text-right pr-4 sm:pr-5">Suggested order</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)]">
                {filtered.map((r) => {
                  const urgent = r.daysRemaining !== null && r.daysRemaining <= 3;
                  return (
                    <tr key={r.productId} className="hover:bg-[var(--inset)] transition-colors">
                      <Td className="pl-4 sm:pl-5">
                        <span className="flex items-center gap-2.5 min-w-0">
                          <ProductTile name={r.name} sku={r.sku} image={r.image} size={32} />
                          <span className="min-w-0">
                            <Link
                              href={`/products/${r.productId}`}
                              className="block text-[13px] font-medium text-ink hover:text-[var(--accent-ink)] transition-colors truncate max-w-[240px]"
                            >
                              {r.name}
                            </Link>
                            <span className="block text-[11px] text-ink-3">
                              {r.categoryName ?? "Uncategorised"}
                            </span>
                          </span>
                        </span>
                      </Td>

                      <Td className="text-right">
                        <span className="text-[13px] font-semibold text-ink tnum">{r.stock}</span>
                      </Td>

                      <Td className="text-right">
                        <span className="text-[12.5px] text-ink-3 tnum">{r.minStock}</span>
                      </Td>

                      <Td className="text-right">
                        <span className="text-[12.5px] text-ink-2 tnum">{r.soldRecently}</span>
                        {r.velocityPerDay > 0 ? (
                          <span className="block text-[10.5px] text-ink-3 tnum">
                            {r.velocityPerDay.toFixed(1)}/day
                          </span>
                        ) : null}
                      </Td>

                      <Td className="text-right">
                        {r.daysRemaining === null ? (
                          <span className="text-[12px] text-ink-3">no recent sales</span>
                        ) : (
                          <span
                            className={cn(
                              "text-[13px] font-medium tnum",
                              urgent ? "text-[var(--neg)]" : "text-ink-2",
                            )}
                          >
                            {r.daysRemaining < 1 ? "<1" : Math.round(r.daysRemaining)}
                            <span className="text-[10.5px] text-ink-3 font-normal ml-0.5">
                              day{Math.round(r.daysRemaining) === 1 ? "" : "s"}
                            </span>
                          </span>
                        )}
                      </Td>

                      <Td><StockStatusBadge status={r.status} /></Td>

                      <Td className="text-right pr-4 sm:pr-5">
                        {r.suggestedReorder > 0 ? (
                          <>
                            <span className="text-[13px] font-semibold text-[var(--accent-ink)] tnum">
                              {r.suggestedReorder}
                            </span>
                            <span className="block text-[11px] text-ink-3 tnum">
                              {formatMoney(r.suggestedReorder * r.costPrice, currency)}
                            </span>
                          </>
                        ) : (
                          <span className="text-[12px] text-ink-3">&mdash;</span>
                        )}
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile */}
          <ul className="lg:hidden divide-y divide-[var(--line)]">
            {filtered.map((r) => (
              <li key={r.productId}>
                <Link href={`/products/${r.productId}`} className="flex items-start gap-3 px-4 py-3 active:bg-[var(--surface-2)]">
                  <ProductTile name={r.name} sku={r.sku} image={r.image} size={38} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13.5px] font-medium text-ink line-clamp-1">{r.name}</p>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <StockStatusBadge status={r.status} />
                      <span className="text-[11.5px] text-ink-3 tnum">
                        {r.stock} left &middot; {r.soldRecently} sold /14d
                      </span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    {r.daysRemaining !== null ? (
                      <p className={cn("text-[13px] font-semibold tnum", r.daysRemaining <= 3 ? "text-[var(--neg)]" : "text-ink")}>
                        {r.daysRemaining < 1 ? "<1" : Math.round(r.daysRemaining)}d
                      </p>
                    ) : null}
                    {r.suggestedReorder > 0 ? (
                      <p className="text-[11.5px] text-[var(--accent-ink)] font-medium tnum mt-0.5">
                        order {r.suggestedReorder}
                      </p>
                    ) : null}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}

      {restocking && filtered.length > 0 && canAdjust ? (
        <div className="px-4 sm:px-5 py-3 border-t border-[var(--line)] bg-[var(--inset)] flex items-start gap-2.5">
          <AlertTriangle className="size-4 text-[var(--ink-3)] shrink-0 mt-px" aria-hidden />
          <p className="text-[12px] text-ink-3 leading-relaxed">
            Suggested quantities target about three weeks of cover at the current rate of sale.
            Record what you actually receive with{" "}
            <span className="text-ink-2 font-medium">Adjust stock</span> so the ledger stays accurate.
          </p>
        </div>
      ) : null}
    </Panel>
  );
}
