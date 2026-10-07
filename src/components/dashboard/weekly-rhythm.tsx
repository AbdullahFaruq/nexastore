"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/format/currency";
import { useStore } from "@/components/providers/store-provider";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { Tooltip } from "@/components/ui/popover";

/**
 * Which days of the week actually carry the business.
 *
 * A single-series comparison of seven named categories - so every bar takes the
 * SAME hue (identity is carried by the axis label, not by colour) and only the
 * best day is emphasised. Colouring seven bars seven different ways would spend
 * the identity channel re-encoding what bar length already shows.
 */
export function WeeklyRhythm({
  days,
}: {
  days: { weekday: number; name: string; short: string; revenue: number; orders: number }[];
}) {
  const { currency } = useStore();
  const max = Math.max(...days.map((d) => d.revenue), 1);
  const trading = days.filter((d) => d.orders > 0);
  const average = trading.length ? trading.reduce((a, d) => a + d.revenue, 0) / trading.length : 0;
  const best = trading.length ? [...trading].sort((a, b) => b.revenue - a.revenue)[0] : null;

  return (
    <Panel>
      <PanelHeader
        title="Weekly rhythm"
        description={
          best
            ? `${best.name} is your strongest day`
            : "Revenue by day of week across the period"
        }
      />
      <div className="p-4 sm:p-5 pt-4">
        <div className="relative flex items-end justify-between gap-1.5 h-[104px]">
          {/* The average line gives every bar something to be measured against. */}
          {average > 0 ? (
            <div
              className="absolute inset-x-0 border-t border-dashed border-[var(--line-strong)] pointer-events-none"
              style={{ bottom: `${(average / max) * 100}%` }}
              aria-hidden
            >
              <span className="absolute -top-[7px] right-0 text-[9.5px] text-ink-3 bg-[var(--surface)] pl-1">
                avg
              </span>
            </div>
          ) : null}

          {days.map((d) => {
            const height = (d.revenue / max) * 100;
            const isBest = best?.weekday === d.weekday && d.revenue > 0;
            return (
              <Tooltip
                key={d.weekday}
                content={
                  <span className="block">
                    <span className="block font-medium">{d.name}</span>
                    <span className="block tabular-nums">{formatMoney(d.revenue, currency)}</span>
                    <span className="block tabular-nums opacity-70">
                      {d.orders} order{d.orders === 1 ? "" : "s"}
                    </span>
                  </span>
                }
              >
                <div className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end cursor-default">
                  <div
                    className={cn(
                      "w-full rounded-t-[3px] transition-[height,background-color] duration-500 ease-out",
                      isBest ? "bg-[var(--accent)]" : d.revenue > 0 ? "bg-[var(--line-strong)]" : "bg-[var(--surface-3)]",
                    )}
                    style={{ height: `${Math.max(height, d.revenue > 0 ? 4 : 2)}%` }}
                    aria-hidden
                  />
                </div>
              </Tooltip>
            );
          })}
        </div>

        <div className="flex items-center justify-between gap-1.5 mt-2">
          {days.map((d) => {
            const isBest = best?.weekday === d.weekday && d.revenue > 0;
            return (
              <span
                key={d.weekday}
                className={cn(
                  "flex-1 text-center text-[10.5px]",
                  isBest ? "text-[var(--accent-ink)] font-semibold" : "text-ink-3",
                )}
              >
                {d.short}
              </span>
            );
          })}
        </div>

        {best && average > 0 ? (
          <p className="text-[11.5px] text-ink-3 mt-3 pt-3 border-t border-[var(--line)] leading-relaxed">
            {best.name}s bring in{" "}
            <span className="text-ink-2 font-medium tnum">
              {(((best.revenue - average) / average) * 100).toFixed(0)}% more
            </span>{" "}
            than an average trading day.
          </p>
        ) : null}
      </div>
    </Panel>
  );
}
