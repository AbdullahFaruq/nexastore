"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import type { SeriesPoint } from "@/lib/analytics/timeseries";
import type { Grain } from "@/lib/format/dates";
import { formatMoney } from "@/lib/format/currency";
import { formatCount } from "@/lib/utils";
import { useStore } from "@/components/providers/store-provider";
import { CHART_METRICS, RevenueChart, type ChartMetric } from "@/components/charts/revenue-chart";
import { Panel } from "@/components/ui/panel";
import { Delta } from "@/components/shared/delta";

const GRAINS: { value: Grain; label: string; short: string }[] = [
  { value: "hour", label: "Hourly", short: "H" },
  { value: "day", label: "Daily", short: "D" },
  { value: "week", label: "Weekly", short: "W" },
  { value: "month", label: "Monthly", short: "M" },
  { value: "year", label: "Yearly", short: "Y" },
];

/**
 * The main chart.
 *
 * Switching metric is instant because a single fetch returns every measure per
 * bucket. Switching the time grain changes the query, so it goes through the
 * URL and re-renders on the server - which also makes the view shareable.
 */
export function RevenueAnalytics({
  points,
  previous,
  grain,
  comparisonLabel,
  totals,
  previousTotals,
  availableGrains,
  partialLast,
}: {
  points: SeriesPoint[];
  previous: SeriesPoint[];
  grain: Grain;
  comparisonLabel: string;
  totals: Record<ChartMetric, number>;
  previousTotals: Record<ChartMetric, number>;
  availableGrains: Grain[];
  partialLast?: boolean;
}) {
  const { currency } = useStore();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [metric, setMetric] = React.useState<ChartMetric>("revenue");
  const [pending, startTransition] = React.useTransition();

  const setGrain = (g: Grain) => {
    const sp = new URLSearchParams(params.toString());
    sp.set("grain", g);
    startTransition(() => router.push(`${pathname}?${sp.toString()}`, { scroll: false }));
  };

  const meta = CHART_METRICS.find((m) => m.key === metric)!;
  const current = totals[metric];
  const prev = previousTotals[metric];
  const changePct = prev === 0 ? (current === 0 ? 0 : null) : ((current - prev) / Math.abs(prev)) * 100;

  return (
    <Panel>
      <div className="flex flex-col gap-3 px-4 sm:px-5 pt-4 pb-3 border-b border-[var(--line)]">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-[13.5px] font-semibold text-ink tracking-[-0.01em]">
                {meta.label} over time
              </h2>
            </div>
            <div className="flex items-baseline gap-2.5 mt-1.5 flex-wrap">
              <span className="num-hero text-[26px] font-semibold text-ink leading-none">
                {meta.money ? formatMoney(current, currency) : formatCount(current)}
              </span>
              <Delta value={changePct} invert={metric === "expenses"} suffix={`vs ${comparisonLabel}`} />
            </div>
            <p className="text-[11.5px] text-ink-3 mt-1.5">{meta.hint}</p>
          </div>

          {/* Grain switcher: only offers grains the window can actually support. */}
          <div
            className={cn(
              "inline-flex items-center gap-0.5 p-0.5 rounded-[8px] bg-[var(--surface-2)] border border-[var(--line)] shrink-0",
              pending && "opacity-60",
            )}
            role="group"
            aria-label="Time grouping"
          >
            {GRAINS.filter((g) => availableGrains.includes(g.value)).map((g) => (
              <button
                key={g.value}
                type="button"
                onClick={() => setGrain(g.value)}
                aria-pressed={grain === g.value}
                className={cn(
                  "px-2.5 h-7 rounded-[6px] text-[12px] font-medium transition-colors",
                  grain === g.value
                    ? "bg-[var(--surface)] text-ink shadow-card"
                    : "text-ink-3 hover:text-ink-2",
                )}
              >
                <span className="hidden sm:inline">{g.label}</span>
                <span className="sm:hidden">{g.short}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Metric switcher: a scrollable row of pills on narrow screens. */}
        <div
          className="flex items-center gap-1 overflow-x-auto -mx-1 px-1 pb-0.5"
          role="tablist"
          aria-label="Chart metric"
        >
          {CHART_METRICS.map((m) => {
            const active = metric === m.key;
            const value = totals[m.key];
            return (
              <button
                key={m.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setMetric(m.key)}
                className={cn(
                  "group flex items-center gap-2 rounded-[7px] border px-2.5 h-9 shrink-0 transition-all",
                  active
                    ? "border-[var(--accent-soft-line)] bg-[var(--accent-soft)]"
                    : "border-transparent hover:bg-[var(--surface-2)]",
                )}
              >
                <m.icon
                  className={cn(
                    "size-3.5 shrink-0",
                    active ? "text-[var(--accent-ink)]" : "text-[var(--ink-3)]",
                  )}
                />
                <span className="text-left">
                  <span
                    className={cn(
                      "block text-[11px] leading-tight",
                      active ? "text-[var(--accent-ink)]" : "text-ink-3",
                    )}
                  >
                    {m.label}
                  </span>
                  <span
                    className={cn(
                      "block text-[12.5px] font-semibold leading-tight tnum",
                      active ? "text-[var(--accent-ink)]" : "text-ink-2",
                    )}
                  >
                    {m.money
                      ? formatMoney(totals[m.key], currency, { compact: true })
                      : formatCount(value, true)}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="p-4 sm:p-5 pt-4">
        <RevenueChart
          points={points}
          previous={previous}
          metric={metric}
          grain={grain}
          comparisonLabel={comparisonLabel}
          partialLast={partialLast}
          height={288}
        />
      </div>
    </Panel>
  );
}
