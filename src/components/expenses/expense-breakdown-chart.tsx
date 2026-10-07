"use client";

import * as React from "react";
import { formatMoney } from "@/lib/format/currency";
import type { ExpenseBreakdown } from "@/lib/analytics/expenses";
import { useStore } from "@/components/providers/store-provider";
import { seriesColor } from "@/components/charts/chart-parts";
import { Delta } from "@/components/shared/delta";
import { EmptyState, EmptyWalletMark } from "@/components/ui/empty-state";

/**
 * Expense composition.
 *
 * A ranked bar list rather than a pie: reading a category's share off an arc
 * is guesswork, and comparing two arcs is worse. Each row is direct-labelled
 * with its amount and share, so colour is decoration, not the encoding - which
 * is also what keeps it readable in greyscale.
 */
export function ExpenseBreakdownChart({ breakdown }: { breakdown: ExpenseBreakdown[] }) {
  const { currency } = useStore();
  const total = breakdown.reduce((a, b) => a + b.amount, 0);
  const max = Math.max(...breakdown.map((b) => b.amount), 1);

  if (breakdown.length === 0 || total === 0) {
    return (
      <EmptyState
        icon={<EmptyWalletMark />}
        title="No expenses recorded"
        description="Add rent, wages, utilities and the rest, and NexaStore will show you exactly where the money goes."
        action={{ label: "Add an expense", href: "/expenses?new=1" }}
        compact
      />
    );
  }

  return (
    <div>
      {/* Composition strip: the whole period in one line. */}
      <div className="flex h-2 rounded-full overflow-hidden bg-[var(--surface-3)] gap-[2px] mb-4">
        {breakdown.map((b) => (
          <div
            key={b.category}
            className="h-full first:rounded-l-full last:rounded-r-full transition-[width] duration-700"
            style={{ width: `${b.share}%`, background: seriesColor(b.colorSlot) }}
            aria-hidden
          />
        ))}
      </div>

      <ul className="space-y-2.5">
        {breakdown.map((b) => (
          <li key={b.category}>
            <div className="flex items-baseline justify-between gap-3 mb-1">
              <span className="flex items-center gap-1.5 min-w-0">
                <span
                  className="size-2 rounded-[2px] shrink-0"
                  style={{ background: seriesColor(b.colorSlot) }}
                  aria-hidden
                />
                <span className="text-[12.5px] text-ink-2 truncate">{b.label}</span>
                <span className="text-[11px] text-ink-3 shrink-0 tnum">{b.share.toFixed(0)}%</span>
              </span>
              <span className="flex items-baseline gap-2 shrink-0">
                <Delta value={b.changePct} invert size="sm" showZero={false} />
                <span className="text-[12.5px] font-semibold text-ink tnum">
                  {formatMoney(b.amount, currency)}
                </span>
              </span>
            </div>
            <div className="h-[5px] rounded-full bg-[var(--surface-3)] overflow-hidden">
              <div
                className="h-full rounded-full transition-[width] duration-700 ease-out"
                style={{ width: `${(b.amount / max) * 100}%`, background: seriesColor(b.colorSlot) }}
              />
            </div>
          </li>
        ))}
      </ul>

      <div className="flex items-baseline justify-between gap-3 mt-4 pt-3 border-t border-[var(--line)]">
        <span className="text-[12.5px] font-medium text-ink">Total</span>
        <span className="text-[14px] font-semibold text-ink tnum">{formatMoney(total, currency)}</span>
      </div>
    </div>
  );
}
