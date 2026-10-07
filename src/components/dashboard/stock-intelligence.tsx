"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, PackageCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import type { StockInsight } from "@/lib/analytics/inventory";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { ProductTile } from "@/components/shared/product-tile";
import { StockStatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";

/**
 * Stock intelligence.
 *
 * Not "here are your quantities" but "here is what will run out, when, and how
 * much to order". Days of cover comes from actual sales velocity over the last
 * two weeks, so a product with 40 units is flagged when the shop sells 30 a day
 * and left alone when it sells one a month.
 */
export function StockIntelligence({ items }: { items: StockInsight[] }) {
  return (
    <Panel className="h-full flex flex-col">
      <PanelHeader
        title="Needs restocking"
        description="Ordered by how soon it runs out"
        actions={
          <Button asChild variant="ghost" size="xs">
            <Link href="/inventory?view=restock">
              Restock list
              <ArrowRight />
            </Link>
          </Button>
        }
      />

      {items.length === 0 ? (
        <EmptyState
          icon={<PackageCheck strokeWidth={1.25} />}
          title="Every product is well stocked"
          description="Nothing is below its reorder point or running short at the current sales rate."
          compact
          className="flex-1"
        />
      ) : (
        <ul className="divide-y divide-[var(--line)] flex-1">
          {items.map((item) => {
            const days = item.daysRemaining;
            const urgent = days !== null && days <= 3;

            return (
              <li key={item.productId}>
                <Link
                  href={`/products/${item.productId}`}
                  className="flex items-center gap-3 px-4 sm:px-5 py-2.5 hover:bg-[var(--inset)] transition-colors"
                >
                  <ProductTile name={item.name} sku={item.sku} image={item.image} size={34} />

                  <span className="min-w-0 flex-1">
                    <span className="text-[13px] font-medium text-ink truncate block">{item.name}</span>
                    <span className="flex items-center gap-1.5 mt-1 flex-wrap">
                      <StockStatusBadge status={item.status} />
                      <span className="text-[11.5px] text-ink-3 tnum">
                        {item.stock} left
                        {item.minStock > 0 ? ` / ${item.minStock} min` : ""}
                      </span>
                    </span>
                  </span>

                  <span className="text-right shrink-0">
                    {days === null ? (
                      <span className="block text-[11.5px] text-ink-3 max-w-[92px] leading-tight">
                        No sales in the last 14 days
                      </span>
                    ) : (
                      <>
                        <span
                          className={cn(
                            "block text-[13px] font-semibold tnum",
                            urgent ? "text-[var(--neg)]" : "text-ink",
                          )}
                        >
                          {days < 1 ? "<1" : Math.round(days)}
                          <span className="font-normal text-[11px] text-ink-3 ml-0.5">
                            day{Math.round(days) === 1 ? "" : "s"}
                          </span>
                        </span>
                        <span className="block text-[11px] text-ink-3 tnum mt-0.5">
                          {item.soldRecently} sold / 14d
                        </span>
                      </>
                    )}
                    {item.suggestedReorder > 0 ? (
                      <span className="block text-[11px] text-[var(--accent-ink)] font-medium mt-0.5 tnum">
                        order {item.suggestedReorder}
                      </span>
                    ) : null}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
