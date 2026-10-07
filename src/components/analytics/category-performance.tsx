"use client";

import * as React from "react";
import Link from "next/link";
import { formatMoney } from "@/lib/format/currency";
import type { CategoryPerformance } from "@/lib/analytics/categories";
import { useStore } from "@/components/providers/store-provider";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { Delta } from "@/components/shared/delta";
import { seriesColor } from "@/components/charts/chart-parts";
import { Td, Th } from "@/components/sales/sales-table";
import { EmptyState, EmptyBoxMark } from "@/components/ui/empty-state";

export function CategoryPerformanceTable({ categories }: { categories: CategoryPerformance[] }) {
  const { currency } = useStore();
  const trading = categories.filter((c) => c.revenue > 0 || c.productCount > 0);
  const max = Math.max(...trading.map((c) => c.revenue), 1);

  return (
    <Panel>
      <PanelHeader
        title="Category performance"
        description="Which parts of the catalogue carry the business"
        actions={
          <Link
            href="/categories"
            className="text-[12.5px] font-medium text-[var(--accent-ink)] hover:underline underline-offset-4"
          >
            Manage categories
          </Link>
        }
      />

      {trading.length === 0 ? (
        <EmptyState
          icon={<EmptyBoxMark />}
          title="No category activity yet"
          description="Assign your products to categories and this becomes the fastest way to see what is working."
          action={{ label: "Manage categories", href: "/categories" }}
          compact
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[var(--line)]">
                <Th className="pl-4 sm:pl-5">Category</Th>
                <Th className="text-right">Products</Th>
                <Th className="text-right">Units</Th>
                <Th className="text-right">Revenue</Th>
                <Th className="text-right">Profit</Th>
                <Th className="text-right">Margin</Th>
                <Th className="text-right pr-4 sm:pr-5">Growth</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line)]">
              {trading.map((c) => (
                <tr key={c.categoryId ?? "none"} className="hover:bg-[var(--inset)] transition-colors">
                  <Td className="pl-4 sm:pl-5">
                    <span className="flex items-center gap-2 min-w-0">
                      <span
                        className="size-2.5 rounded-[3px] shrink-0"
                        style={{ background: seriesColor(c.colorSlot) }}
                        aria-hidden
                      />
                      <span className="min-w-0">
                        <span className="block text-[13px] font-medium text-ink truncate">{c.name}</span>
                        <span className="block mt-1 h-[3px] w-[110px] rounded-full bg-[var(--surface-3)] overflow-hidden">
                          <span
                            className="block h-full rounded-full transition-[width] duration-700"
                            style={{
                              width: `${(c.revenue / max) * 100}%`,
                              background: seriesColor(c.colorSlot),
                            }}
                          />
                        </span>
                      </span>
                    </span>
                  </Td>
                  <Td className="text-right"><span className="text-[12.5px] text-ink-3 tnum">{c.productCount}</span></Td>
                  <Td className="text-right"><span className="text-[12.5px] text-ink-2 tnum">{c.unitsSold.toLocaleString()}</span></Td>
                  <Td className="text-right">
                    <span className="text-[13px] font-semibold text-ink tnum">
                      {formatMoney(c.revenue, currency)}
                    </span>
                    <span className="block text-[11px] text-ink-3 tnum">{c.revenueShare.toFixed(1)}% of total</span>
                  </Td>
                  <Td className="text-right"><span className="text-[12.5px] text-ink-2 tnum">{formatMoney(c.profit, currency)}</span></Td>
                  <Td className="text-right"><span className="text-[12.5px] text-ink-2 tnum">{c.marginPct.toFixed(1)}%</span></Td>
                  <Td className="text-right pr-4 sm:pr-5"><Delta value={c.growthPct} size="sm" /></Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
