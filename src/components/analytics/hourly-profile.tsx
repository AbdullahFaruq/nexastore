"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/format/currency";
import { useStore } from "@/components/providers/store-provider";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { Tooltip } from "@/components/ui/popover";

/**
 * Revenue by hour of day.
 *
 * A single-hue intensity ramp: hour is ordinal, so the colour carries "how
 * busy", and the reader sees the shape of the trading day without a legend.
 * Quiet hours recede rather than disappearing, so closed periods are visible
 * as gaps rather than being confused with missing data.
 */
export function HourlyProfile({
  hours,
}: {
  hours: { hour: number; label: string; revenue: number; orders: number }[];
}) {
  const { currency } = useStore();
  const max = Math.max(...hours.map((h) => h.revenue), 1);
  const trading = hours.filter((h) => h.orders > 0);
  const busiest = trading.length ? [...trading].sort((a, b) => b.revenue - a.revenue)[0] : null;
  const total = hours.reduce((a, h) => a + h.revenue, 0);

  // Brass sequential ramp, light to dark.
  const SEQ = ["--seq-1", "--seq-2", "--seq-3", "--seq-4", "--seq-5", "--seq-6", "--seq-7"];
  const stepFor = (v: number) => {
    if (v <= 0) return null;
    const idx = Math.min(SEQ.length - 1, Math.floor((v / max) * SEQ.length));
    return `var(${SEQ[idx]})`;
  };

  return (
    <Panel>
      <PanelHeader
        title="Trading day"
        description={busiest ? `Busiest around ${busiest.label}` : "Revenue by hour of day"}
      />
      <div className="p-4 sm:p-5">
        <div className="flex items-end gap-[3px] h-[104px]">
          {hours.map((h) => {
            const fill = stepFor(h.revenue);
            const height = (h.revenue / max) * 100;
            return (
              <Tooltip
                key={h.hour}
                content={
                  <span className="block">
                    <span className="block font-medium">{h.label}</span>
                    <span className="block tabular-nums">{formatMoney(h.revenue, currency)}</span>
                    <span className="block tabular-nums opacity-70">
                      {h.orders} order{h.orders === 1 ? "" : "s"}
                    </span>
                  </span>
                }
              >
                <div className="flex-1 h-full flex items-end cursor-default">
                  <div
                    className={cn(
                      "w-full rounded-t-[2px] transition-[height] duration-500 ease-out",
                      !fill && "bg-[var(--surface-3)]",
                    )}
                    style={{
                      height: fill ? `${Math.max(height, 4)}%` : "3px",
                      background: fill ?? undefined,
                    }}
                    aria-hidden
                  />
                </div>
              </Tooltip>
            );
          })}
        </div>

        <div className="flex justify-between mt-2 text-[10.5px] text-ink-3 tnum">
          <span>12a</span>
          <span>6a</span>
          <span>12p</span>
          <span>6p</span>
          <span>11p</span>
        </div>

        {busiest && total > 0 ? (
          <p className="text-[11.5px] text-ink-3 mt-3 pt-3 border-t border-[var(--line)] leading-relaxed">
            The three hours around{" "}
            <span className="text-ink-2 font-medium">{busiest.label}</span> account for{" "}
            <span className="text-ink-2 font-medium tnum">
              {(
                (hours
                  .slice(Math.max(0, busiest.hour - 1), busiest.hour + 2)
                  .reduce((a, h) => a + h.revenue, 0) /
                  total) *
                100
              ).toFixed(0)}
              %
            </span>{" "}
            of takings.
          </p>
        ) : null}
      </div>
    </Panel>
  );
}
