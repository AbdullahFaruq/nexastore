"use client";

import * as React from "react";
import { ArrowDown, ArrowUp, Equal } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/format/currency";
import type { WaterfallStep } from "@/lib/analytics/pnl";
import { useStore } from "@/components/providers/store-provider";
import { Tooltip } from "@/components/ui/popover";

/**
 * The profit waterfall.
 *
 * Reads left to right as a sentence: this much came in, this much was taken
 * out by each cost, and this is what is left. Polarity is the encoding, so it
 * uses the diverging pair (money in / money out) with a neutral bar for the
 * result - and every bar is direct-labelled and carries a direction icon, so
 * the meaning survives greyscale and colour-vision deficiency.
 *
 * Built as positioned divs rather than through the chart library: a floating
 * waterfall in Recharts needs a transparent stacked base, which fights every
 * tooltip and label it touches.
 */
export function PnlWaterfall({ steps }: { steps: WaterfallStep[] }) {
  const { currency } = useStore();

  const max = Math.max(...steps.map((s) => Math.max(s.base + s.height, s.running)), 1);
  const min = Math.min(0, ...steps.map((s) => s.base));
  const span = max - min || 1;

  const pct = (v: number) => ((v - min) / span) * 100;

  return (
    <div>
      <div className="relative h-[260px] flex items-end gap-1.5 sm:gap-3">
        {/* Zero line, when any bar dips below it. */}
        {min < 0 ? (
          <div
            className="absolute inset-x-0 border-t border-[var(--line-strong)] pointer-events-none"
            style={{ bottom: `${pct(0)}%` }}
            aria-hidden
          />
        ) : null}

        {steps.map((step, i) => {
          const isTotal = step.kind === "total";
          const isIncrease = step.kind === "increase";
          const loss = isTotal && step.running < 0;

          const bottom = pct(step.base);
          const height = (step.height / span) * 100;

          const color = isTotal
            ? loss
              ? "var(--neg)"
              : "var(--accent)"
            : isIncrease
              ? "var(--pos)"
              : "var(--neg)";

          const Icon = isTotal ? Equal : isIncrease ? ArrowUp : ArrowDown;

          return (
            <div key={step.key} className="relative flex-1 h-full min-w-0">
              {/* Connector to the next bar - what makes it read as a flow. */}
              {i < steps.length - 1 ? (
                <div
                  className="absolute border-t border-dashed border-[var(--line-strong)] pointer-events-none z-0"
                  style={{
                    bottom: `${pct(step.running)}%`,
                    left: "50%",
                    right: "-50%",
                  }}
                  aria-hidden
                />
              ) : null}

              <Tooltip
                content={
                  <span className="block">
                    <span className="block font-medium">{step.label}</span>
                    <span className="block tabular-nums">
                      {isTotal ? "" : step.delta > 0 ? "+" : ""}
                      {formatMoney(isTotal ? step.running : step.delta, currency)}
                    </span>
                    {!isTotal ? (
                      <span className="block tabular-nums opacity-70">
                        running total {formatMoney(step.running, currency)}
                      </span>
                    ) : null}
                  </span>
                }
              >
                <div
                  className="absolute inset-x-[14%] sm:inset-x-[18%] rounded-[4px] transition-[height,bottom] duration-700 ease-out cursor-default z-10"
                  style={{
                    bottom: `${bottom}%`,
                    height: `${Math.max(height, 1.2)}%`,
                    background: color,
                    opacity: isTotal ? 1 : 0.92,
                  }}
                  aria-hidden
                />
              </Tooltip>

              {/* Value label, above or below the bar depending on room. */}
              <div
                className="absolute inset-x-0 text-center pointer-events-none z-20"
                style={{ bottom: `calc(${bottom + Math.max(height, 1.2)}% + 5px)` }}
              >
                <span
                  className={cn(
                    "inline-flex items-center gap-0.5 text-[10.5px] font-semibold tnum whitespace-nowrap",
                    isTotal ? (loss ? "text-[var(--neg)]" : "text-[var(--accent-ink)]") : "text-ink-2",
                  )}
                >
                  <Icon className="size-2.5" aria-hidden />
                  {formatMoney(Math.abs(isTotal ? step.running : step.delta), currency, {
                    compact: true,
                  })}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Axis labels */}
      <div className="flex gap-1.5 sm:gap-3 mt-2 pt-2 border-t border-[var(--line)]">
        {steps.map((step) => (
          <div key={step.key} className="flex-1 min-w-0 text-center">
            <span
              className={cn(
                "block text-[10.5px] leading-tight",
                step.kind === "total" ? "text-ink font-semibold" : "text-ink-3",
              )}
            >
              {step.label}
            </span>
          </div>
        ))}
      </div>

      <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-3">
        <LegendItem color="var(--pos)" icon={<ArrowUp className="size-2.5" />} label="Money in" />
        <LegendItem color="var(--neg)" icon={<ArrowDown className="size-2.5" />} label="Money out" />
        <LegendItem color="var(--accent)" icon={<Equal className="size-2.5" />} label="What is left" />
      </ul>
    </div>
  );
}

function LegendItem({
  color, icon, label,
}: {
  color: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <li className="flex items-center gap-1.5 text-[11.5px] text-ink-3">
      <span className="size-2 rounded-[2px] shrink-0" style={{ background: color }} aria-hidden />
      <span className="text-[var(--ink-3)]" aria-hidden>{icon}</span>
      {label}
    </li>
  );
}
