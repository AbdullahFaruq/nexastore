"use client";

import * as React from "react";
import {
  Bar, CartesianGrid, ComposedChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { formatMoney } from "@/lib/format/currency";
import { formatCount } from "@/lib/utils";
import { useStore } from "@/components/providers/store-provider";
import { AXIS_PROPS, ChartLegend, ChartTooltip, GRID_PROPS } from "@/components/charts/chart-parts";

/**
 * Units and revenue for one product.
 *
 * Two measures of different scale, so they never share an axis - units are the
 * bars against the left scale, and revenue is shown in the tooltip and legend
 * rather than plotted against a second y-axis. A dual-axis chart lets the
 * author decide where the lines cross, which is why this one does not have one.
 */
export function ProductTrendChart({
  points,
  showRevenue,
}: {
  points: { t: string; label: string; revenue: number; units: number }[];
  showRevenue: boolean;
}) {
  const { currency } = useStore();

  return (
    <div>
      <div className="h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={points} margin={{ top: 8, right: 6, bottom: 0, left: -18 }}>
            <CartesianGrid {...GRID_PROPS} />
            <XAxis dataKey="label" {...AXIS_PROPS} interval="preserveStartEnd" minTickGap={26} dy={6} />
            <YAxis {...AXIS_PROPS} width={46} tickFormatter={(v: number) => formatCount(v, true)} allowDecimals={false} />
            <Tooltip
              cursor={{ fill: "var(--surface-2)", fillOpacity: 0.6 }}
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const row = payload[0].payload as (typeof points)[number];
                return (
                  <ChartTooltip
                    title={String(label)}
                    rows={[
                      { label: "Units sold", value: formatCount(row.units), color: "var(--s1)" },
                      ...(showRevenue
                        ? [{ label: "Revenue", value: formatMoney(row.revenue, currency), muted: true }]
                        : []),
                    ]}
                  />
                );
              }}
            />
            <Bar dataKey="units" fill="var(--s1)" radius={[3, 3, 0, 0]} maxBarSize={30} animationDuration={520} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="pt-3 mt-1 border-t border-[var(--line)] flex items-center justify-between gap-3">
        <ChartLegend items={[{ label: "Units sold", color: "var(--s1)" }]} />
        {showRevenue ? (
          <span className="text-[11px] text-ink-3">Revenue shown on hover</span>
        ) : null}
      </div>
    </div>
  );
}
