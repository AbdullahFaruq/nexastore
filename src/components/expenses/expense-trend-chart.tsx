"use client";

import * as React from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatMoney } from "@/lib/format/currency";
import type { Grain } from "@/lib/format/dates";
import { useStore } from "@/components/providers/store-provider";
import { AXIS_PROPS, ChartLegend, ChartTooltip, GRID_PROPS } from "@/components/charts/chart-parts";
import { EmptyChartMark, EmptyState } from "@/components/ui/empty-state";

/**
 * Expenses over time as bars, not a line.
 *
 * Costs are discrete events - rent lands on one day - so a continuous line
 * would imply spending in between that never happened.
 */
export function ExpenseTrendChart({
  points,
  grain,
}: {
  points: { t: string; label: string; amount: number }[];
  grain: Grain;
}) {
  const { currency } = useStore();
  const hasData = points.some((p) => p.amount > 0);

  if (!hasData) {
    return (
      <EmptyState
        icon={<EmptyChartMark />}
        title="No expenses in this period"
        description="Record a cost and the trend will build up here."
        compact
      />
    );
  }

  return (
    <div>
      <div className="h-[216px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={points} margin={{ top: 8, right: 6, bottom: 0, left: -12 }}>
            <CartesianGrid {...GRID_PROPS} />
            <XAxis dataKey="label" {...AXIS_PROPS} interval="preserveStartEnd" minTickGap={26} dy={6} />
            <YAxis
              {...AXIS_PROPS}
              width={60}
              tickFormatter={(v: number) => formatMoney(v, currency, { compact: true })}
            />
            <Tooltip
              cursor={{ fill: "var(--surface-2)", fillOpacity: 0.6 }}
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const row = payload[0].payload as (typeof points)[number];
                return (
                  <ChartTooltip
                    title={String(label)}
                    rows={[{ label: "Expenses", value: formatMoney(row.amount, currency), color: "var(--s4)" }]}
                  />
                );
              }}
            />
            <Bar dataKey="amount" fill="var(--s4)" radius={[3, 3, 0, 0]} maxBarSize={34} animationDuration={520} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="pt-3 mt-1 border-t border-[var(--line)] flex items-center justify-between gap-3">
        <ChartLegend items={[{ label: "Operating expenses", color: "var(--s4)" }]} />
        <span className="text-[11px] text-ink-3 capitalize">{grain} totals</span>
      </div>
    </div>
  );
}
