"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, ArrowUpDown } from "lucide-react";
import { formatMoney } from "@/lib/format/currency";
import type { ProductPerformance, ProductSortKey } from "@/lib/analytics/products";
import { useStore } from "@/components/providers/store-provider";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { ProductTile } from "@/components/shared/product-tile";
import { Delta } from "@/components/shared/delta";
import { EmptyBoxMark, EmptyState } from "@/components/ui/empty-state";
import { Dropdown, DropdownContent, DropdownLabel, DropdownRadioGroup, DropdownRadioItem, DropdownTrigger } from "@/components/ui/dropdown";
import { Button } from "@/components/ui/button";

const SORTS: { value: ProductSortKey; label: string }[] = [
  { value: "revenue", label: "Revenue" },
  { value: "units", label: "Units sold" },
  { value: "profit", label: "Profit" },
  { value: "margin", label: "Margin" },
  { value: "growth", label: "Growth" },
];

/**
 * Top sellers.
 *
 * The contribution bar is the point: it shows at a glance whether the business
 * rests on one product or spreads across many, which a plain sorted table
 * cannot convey.
 */
export function TopProducts({ products }: { products: ProductPerformance[] }) {
  const { currency } = useStore();
  const [sort, setSort] = React.useState<ProductSortKey>("revenue");

  const sorted = React.useMemo(() => {
    const rows = [...products];
    switch (sort) {
      case "units": return rows.sort((a, b) => b.unitsSold - a.unitsSold);
      case "profit": return rows.sort((a, b) => b.profit - a.profit);
      case "margin": return rows.sort((a, b) => b.marginPct - a.marginPct);
      case "growth": return rows.sort((a, b) => (b.growthPct ?? -Infinity) - (a.growthPct ?? -Infinity));
      default: return rows.sort((a, b) => b.revenue - a.revenue);
    }
  }, [products, sort]);

  const maxShare = Math.max(...sorted.map((p) => p.revenueShare), 1);

  return (
    <Panel className="h-full flex flex-col">
      <PanelHeader
        title="Top selling products"
        description="Ranked over the selected period"
        actions={
          <Dropdown>
            <DropdownTrigger asChild>
              <Button variant="ghost" size="xs">
                <ArrowUpDown />
                {SORTS.find((s) => s.value === sort)?.label}
              </Button>
            </DropdownTrigger>
            <DropdownContent align="end">
              <DropdownLabel>Sort by</DropdownLabel>
              <DropdownRadioGroup value={sort} onValueChange={(v) => setSort(v as ProductSortKey)}>
                {SORTS.map((s) => (
                  <DropdownRadioItem key={s.value} value={s.value}>{s.label}</DropdownRadioItem>
                ))}
              </DropdownRadioGroup>
            </DropdownContent>
          </Dropdown>
        }
      />

      {sorted.length === 0 ? (
        <EmptyState
          icon={<EmptyBoxMark />}
          title="Nothing sold yet"
          description="Once you record a sale, your best performers will be ranked here by revenue, profit and growth."
          action={{ label: "Open the till", href: "/pos" }}
          compact
          className="flex-1"
        />
      ) : (
        <>
          <ul className="divide-y divide-[var(--line)] flex-1">
            {sorted.map((p, i) => (
              <li key={p.productId}>
                <Link
                  href={`/products/${p.productId}`}
                  className="group flex items-center gap-3 px-4 sm:px-5 py-2.5 hover:bg-[var(--inset)] transition-colors"
                >
                  <span className="w-4 text-[11px] font-medium text-ink-3 tnum shrink-0 text-right">
                    {i + 1}
                  </span>
                  <ProductTile name={p.name} sku={p.sku} image={p.image} size={34} />

                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="text-[13px] font-medium text-ink truncate">{p.name}</span>
                    </span>
                    <span className="flex items-center gap-1.5 mt-0.5 text-[11.5px] text-ink-3">
                      {p.categoryName ? <span className="truncate">{p.categoryName}</span> : null}
                      {p.categoryName ? <span className="opacity-50">&middot;</span> : null}
                      <span className="tnum">{p.unitsSold.toLocaleString()} sold</span>
                    </span>
                    {/* Contribution bar - share of period revenue. */}
                    <span className="block mt-1.5 h-[3px] rounded-full bg-[var(--surface-3)] overflow-hidden max-w-[190px]">
                      <span
                        className="block h-full rounded-full bg-[var(--accent)] transition-[width] duration-700 ease-out"
                        style={{ width: `${(p.revenueShare / maxShare) * 100}%` }}
                      />
                    </span>
                  </span>

                  <span className="text-right shrink-0">
                    <span className="block text-[13px] font-semibold text-ink tnum">
                      {formatMoney(p.revenue, currency, { compact: true })}
                    </span>
                    <span className="block text-[11.5px] text-ink-3 tnum mt-0.5">
                      {formatMoney(p.profit, currency, { compact: true })} profit
                    </span>
                    <span className="block mt-0.5">
                      <Delta value={p.growthPct} size="sm" showZero={false} />
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>

          <div className="px-4 sm:px-5 py-2.5 border-t border-[var(--line)]">
            <Link
              href="/products"
              className="inline-flex items-center gap-1 text-[12.5px] font-medium text-[var(--accent-ink)] hover:gap-1.5 transition-all"
            >
              All products
              <ArrowRight className="size-3.5" />
            </Link>
          </div>
        </>
      )}
    </Panel>
  );
}
