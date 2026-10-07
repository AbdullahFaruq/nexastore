"use client";

import * as React from "react";
import {
  Area, Bar, CartesianGrid, ComposedChart, Line, ReferenceArea,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { Banknote, Boxes, Coins, Receipt, TrendingUp } from "lucide-react";
import type { SeriesPoint } from "@/lib/analytics/timeseries";
import type { Grain } from "@/lib/format/dates";
import { formatMoney } from "@/lib/format/currency";
import { cn, formatCount } from "@/lib/utils";
import { useStore } from "@/components/providers/store-provider";
import { AXIS_PROPS, ChartLegend, ChartTooltip, GRID_PROPS } from "./chart-parts";
import { EmptyChartMark, EmptyState } from "@/components/ui/empty-state";

export type ChartMetric = "revenue" | "profit" | "expenses" | "orders" | "items";

export const CHART_METRICS: {
  key: ChartMetric;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  money: boolean;
  hint: string;
}[] = [
  { key: "revenue", label: "Revenue", icon: Banknote, money: true, hint: "Net of discounts and refunds, before tax" },
  { key: "profit", label: "Profit", icon: TrendingUp, money: true, hint: "Revenue less cost of goods and operating expenses" },
  { key: "expenses", label: "Expenses", icon: Receipt, money: true, hint: "Operating expenses recorded in each period" },
  { key: "orders", label: "Orders", icon: Coins, money: false, hint: "Completed and refunded orders" },
  { key: "items", label: "Items sold", icon: Boxes, money: false, hint: "Units sold, net of refunds" },
];

const GRAIN_LABEL: Record<Grain, string> = {
  hour: "Hourly", day: "Daily", week: "Weekly", month: "Monthly", year: "Yearly",
};

interface Props {
  points: SeriesPoint[];
  previous?: SeriesPoint[];
  metric: ChartMetric;
  grain: Grain;
  comparisonLabel?: string;
  showComparison?: boolean;
  height?: number;
  className?: string;
  /** The last bucket is still running - shade it so it does not read as a fall. */
  partialLast?: boolean;
}

export function RevenueChart({
  points, previous = [], metric, grain,
  comparisonLabel = "Previous period", showComparison = true, height = 280, className,
  partialLast = false,
}: Props) {
  const { currency } = useStore();
  const meta = CHART_METRICS.find((m) => m.key === metric)!;
  const isMoney = meta.money;

  // Bars for discrete counts, an area for continuous money - a line between two
  // order counts would imply values that never existed.
  const asBars = metric === "orders" || metric === "items";

  const data = React.useMemo(
    () =>
      points.map((p, i) => ({
        ...p,
        prev: showComparison ? (previous[i]?.[metric] ?? null) : null,
        prevLabel: previous[i]?.label,
      })),
    [points, previous, metric, showComparison],
  );

  const hasData = points.some((p) => p[metric] !== 0);
  const hasPrevious = showComparison && previous.length > 0 && previous.some((p) => p[metric] !== 0);

  // No useCallback: the React Compiler memoises these, and hand-rolling it here
  // prevents it from doing so.
  const fmt = (v: number) =>
    isMoney ? formatMoney(v, currency, { compact: true }) : formatCount(v, true);
  const fmtFull = (v: number) => (isMoney ? formatMoney(v, currency) : formatCount(v));

  if (!hasData) {
    return (
      <div className={cn("flex items-center justify-center", className)} style={{ height }}>
        <EmptyState
          icon={<EmptyChartMark />}
          title={`No ${meta.label.toLowerCase()} in this period`}
          description="Once sales are recorded in this date range, the trend will appear here."
          action={{ label: "Open the till", href: "/pos" }}
          compact
        />
      </div>
    );
  }

  return (
    <div className={className}>
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 6, bottom: 0, left: -12 }}>
            <defs>
              <linearGradient id="nx-area" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--s1)" stopOpacity={0.24} />
                <stop offset="100%" stopColor="var(--s1)" stopOpacity={0.02} />
              </linearGradient>
            </defs>

            <CartesianGrid {...GRID_PROPS} />
            <XAxis
              dataKey="label"
              {...AXIS_PROPS}
              interval="preserveStartEnd"
              minTickGap={28}
              dy={6}
            />
            <YAxis {...AXIS_PROPS} tickFormatter={fmt} width={64} />

            <Tooltip
              cursor={{
                stroke: "var(--line-strong)",
                strokeWidth: 1,
                strokeDasharray: "3 3",
                ...(asBars ? { fill: "var(--surface-2)", fillOpacity: 0.6 } : {}),
              }}
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const row = payload[0].payload as (typeof data)[number];
                const rows = [
                  {
                    label: meta.label,
                    value: fmtFull(row[metric] as number),
                    color: "var(--s1)",
                  },
                ];
                if (hasPrevious && row.prev !== null && row.prev !== undefined) {
                  const change =
                    row.prev !== 0
                      ? (((row[metric] as number) - row.prev) / Math.abs(row.prev)) * 100
                      : null;
                  rows.push({
                    label: comparisonLabel,
                    value: fmtFull(row.prev),
                    color: "var(--ink-3)",
                    muted: true,
                    sub: change === null ? undefined : `${change > 0 ? "+" : ""}${change.toFixed(1)}%`,
                  } as (typeof rows)[number]);
                }
                return (
                  <ChartTooltip
                    title={String(label)}
                    rows={rows}
                    footer={
                      metric === "profit"
                        ? `Revenue ${formatMoney(row.revenue, currency, { compact: true })} - costs`
                        : undefined
                    }
                  />
                );
              }}
            />

            {partialLast && data.length > 1 ? (
              <ReferenceArea
                x1={data[data.length - 2].label}
                x2={data[data.length - 1].label}
                fill="var(--ink-3)"
                fillOpacity={0.06}
                strokeOpacity={0}
                ifOverflow="extendDomain"
              />
            ) : null}

            {hasPrevious ? (
              <Line
                type="monotone"
                dataKey="prev"
                stroke="var(--ink-3)"
                strokeWidth={1.75}
                strokeDasharray="4 3"
                dot={false}
                activeDot={false}
                isAnimationActive={false}
                connectNulls
              />
            ) : null}

            {asBars ? (
              <Bar
                dataKey={metric}
                fill="var(--s1)"
                radius={[3, 3, 0, 0]}
                maxBarSize={38}
                animationDuration={550}
              />
            ) : (
              <>
                <Area
                  type="monotone"
                  dataKey={metric}
                  stroke="none"
                  fill="url(#nx-area)"
                  animationDuration={650}
                />
                <Line
                  type="monotone"
                  dataKey={metric}
                  stroke="var(--s1)"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{
                    r: 4,
                    fill: "var(--s1)",
                    // A 2px surface ring keeps the marker readable where it
                    // overlaps the area fill.
                    stroke: "var(--surface)",
                    strokeWidth: 2,
                  }}
                  animationDuration={650}
                />
              </>
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="flex items-center justify-between gap-4 pt-3 mt-1 border-t border-[var(--line)]">
        <ChartLegend
          items={
            hasPrevious
              ? [
                  { label: meta.label, color: "var(--s1)" },
                  {
                    label: comparisonLabel.replace(/^the /, "").replace(/^\w/, (c) => c.toUpperCase()),
                    color: "var(--ink-3)",
                    dashed: true,
                  },
                ]
              : [{ label: meta.label, color: "var(--s1)" }]
          }
        />
        <span className="text-[11px] text-ink-3 shrink-0 text-right">
          {GRAIN_LABEL[grain]}
          {partialLast ? (
            <span className="ml-1">
              &middot; shaded {grain} still in progress
            </span>
          ) : null}
          {metric === "profit" ? (
            <span className="hidden sm:inline"> &middot; expenses land on the day recorded</span>
          ) : null}
        </span>
      </div>
    </div>
  );
}
