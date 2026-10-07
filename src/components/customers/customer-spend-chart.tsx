"use client";

import * as React from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatMoney } from "@/lib/format/currency";
import { useStore } from "@/components/providers/store-provider";
import { AXIS_PROPS, ChartLegend, ChartTooltip, GRID_PROPS } from "@/components/charts/chart-parts";

/** One customer's spend by month. Single series, so no legend box is needed
    beyond naming it - the title already does. */
export function CustomerSpendChart({
  points,
}: {
  points: { t: string; label: string; spent: number; orders: number }[];
}) {
  const { currency } = useStore();

  return (
    <div>
      <div className="h-[180px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={points} margin={{ top: 8, right: 6, bottom: 0, left: -12 }}>
            <defs>
              <linearGradient id="nx-cust" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--s2)" stopOpacity={0.24} />
                <stop offset="100%" stopColor="var(--s2)" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid {...GRID_PROPS} />
            <XAxis dataKey="label" {...AXIS_PROPS} interval="preserveStartEnd" minTickGap={26} dy={6} />
            <YAxis
              {...AXIS_PROPS}
              width={58}
              tickFormatter={(v: number) => formatMoney(v, currency, { compact: true })}
            />
            <Tooltip
              cursor={{ stroke: "var(--line-strong)", strokeWidth: 1, strokeDasharray: "3 3" }}
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const row = payload[0].payload as (typeof points)[number];
                return (
                  <ChartTooltip
                    title={String(label)}
                    rows={[
                      { label: "Spent", value: formatMoney(row.spent, currency), color: "var(--s2)" },
                      { label: "Orders", value: String(row.orders), muted: true },
                    ]}
                  />
                );
              }}
            />
            <Area
              type="monotone"
              dataKey="spent"
              stroke="var(--s2)"
              strokeWidth={2}
              fill="url(#nx-cust)"
              dot={false}
              activeDot={{ r: 4, fill: "var(--s2)", stroke: "var(--surface)", strokeWidth: 2 }}
              animationDuration={600}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="pt-3 mt-1 border-t border-[var(--line)]">
        <ChartLegend items={[{ label: "Monthly spend", color: "var(--s2)" }]} />
      </div>
    </div>
  );
}
