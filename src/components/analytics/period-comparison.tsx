"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/format/currency";
import { pctChange } from "@/lib/utils";
import type { PeriodTotals } from "@/lib/analytics/summary";
import { useStore } from "@/components/providers/store-provider";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { Delta } from "@/components/shared/delta";

/**
 * Today, this week, this month, this year - side by side.
 *
 * Independent of the page's date picker on purpose: these four windows are the
 * ones a shop owner checks by reflex, and they should not move when the rest of
 * the page is filtered to something else.
 */
export function PeriodComparison({
  periods,
}: {
  periods: {
    key: string;
    label: string;
    previousLabel: string;
    current: PeriodTotals;
    previous: PeriodTotals;
  }[];
}) {
  const { currency } = useStore();
  const money = (n: number) => formatMoney(n, currency);

  return (
    <Panel>
      <PanelHeader
        title="At a glance"
        description="Fixed windows, independent of the date range above"
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-[var(--line)]">
        {periods.map((p) => {
          const loss = p.current.netProfit < 0;
          return (
            <div key={p.key} className="p-4 sm:p-5">
              <p className="text-[12px] font-medium text-ink-2">{p.label}</p>

              <p
                className={cn(
                  "num-hero text-[22px] font-semibold mt-2 leading-none tnum",
                  loss ? "text-[var(--neg)]" : "text-ink",
                )}
              >
                {money(p.current.netProfit)}
              </p>
              <p className="text-[11px] text-ink-3 mt-1">net profit</p>

              <div className="mt-2.5">
                <Delta
                  value={pctChange(p.current.netProfit, p.previous.netProfit)}
                  size="sm"
                  suffix={`vs ${p.previousLabel}`}
                />
              </div>

              <dl className="mt-3.5 pt-3 border-t border-[var(--line)] space-y-1.5">
                <Row label="Revenue" value={money(p.current.revenue)} />
                <Row label="Expenses" value={money(p.current.expenses)} />
                <Row label="Orders" value={p.current.orders.toLocaleString()} />
                <Row label="Items" value={p.current.items.toLocaleString()} />
                <Row
                  label="Margin"
                  value={p.current.revenue > 0 ? `${p.current.netMarginPct.toFixed(1)}%` : "-"}
                />
              </dl>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-[11.5px] text-ink-3">{label}</dt>
      <dd className="text-[12px] text-ink-2 tnum">{value}</dd>
    </div>
  );
}
