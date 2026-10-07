"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/format/currency";
import type { CustomerSegment } from "@/lib/analytics/segments";
import { SEGMENT_META } from "@/lib/analytics/segments";
import { useStore } from "@/components/providers/store-provider";
import { seriesColor } from "@/components/charts/chart-parts";
import { useUrlFilters } from "@/components/shared/filter-bar";
import { Tooltip } from "@/components/ui/popover";

const ORDER: CustomerSegment[] = ["vip", "returning", "new", "at_risk", "inactive"];

/**
 * Behavioural segments, as filters.
 *
 * Each tile is a live filter rather than a read-only stat, because the useful
 * next move after "21 customers are at risk" is to see who they are.
 */
export function SegmentStrip({
  counts,
  total,
  active,
}: {
  counts: Record<CustomerSegment, { count: number; value: number }>;
  total: number;
  active?: CustomerSegment;
}) {
  const { currency } = useStore();
  const { set } = useUrlFilters();

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
      {ORDER.map((seg) => {
        const meta = SEGMENT_META[seg];
        const row = counts[seg];
        const isActive = active === seg;
        const share = total > 0 ? (row.count / total) * 100 : 0;

        return (
          <Tooltip key={seg} content={meta.description}>
            <button
              type="button"
              onClick={() => set({ segment: isActive ? null : seg })}
              aria-pressed={isActive}
              className={cn(
                "text-left rounded-[9px] border p-3.5 transition-all",
                isActive
                  ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                  : "border-[var(--line)] bg-[var(--surface)] hover:border-[var(--line-strong)]",
              )}
            >
              <span className="flex items-center gap-1.5">
                <span
                  className="size-2 rounded-[2px] shrink-0"
                  style={{ background: seriesColor(meta.colorSlot) }}
                  aria-hidden
                />
                <span
                  className={cn(
                    "text-[12px] font-medium truncate",
                    isActive ? "text-[var(--accent-ink)]" : "text-ink-2",
                  )}
                >
                  {meta.label}
                </span>
              </span>

              <span className="block num-hero text-[20px] font-semibold text-ink mt-1.5 leading-none tnum">
                {row.count}
              </span>

              <span className="flex items-baseline justify-between gap-2 mt-1.5">
                <span className="text-[11px] text-ink-3 tnum">{share.toFixed(0)}%</span>
                <span className="text-[11px] text-ink-3 tnum truncate">
                  {formatMoney(row.value, currency, { compact: true })}
                </span>
              </span>

              <span className="block mt-1.5 h-[3px] rounded-full bg-[var(--surface-3)] overflow-hidden">
                <span
                  className="block h-full rounded-full transition-[width] duration-500"
                  style={{ width: `${share}%`, background: seriesColor(meta.colorSlot) }}
                />
              </span>
            </button>
          </Tooltip>
        );
      })}
    </div>
  );
}
