"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Shared chart chrome.
 *
 * Axes, gridlines and tooltips are deliberately recessive: the data is the
 * only thing that should carry weight. Grid is a hairline at low contrast,
 * ticks are muted ink, and there is no chart border, box shadow or background
 * fill competing with the marks.
 */

export const AXIS_PROPS = {
  stroke: "var(--axis)",
  tickLine: false,
  axisLine: false,
  tick: { fill: "var(--axis-ink)", fontSize: 11 },
} as const;

export const GRID_PROPS = {
  stroke: "var(--grid)",
  strokeDasharray: "0",
  vertical: false,
} as const;

export interface TooltipRow {
  label: string;
  value: string;
  color?: string;
  muted?: boolean;
  /** Rendered smaller, under the value. */
  sub?: string;
}

export function ChartTooltip({
  title,
  rows,
  footer,
  className,
}: {
  title: React.ReactNode;
  rows: TooltipRow[];
  footer?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "min-w-[168px] rounded-[9px] border border-[var(--line-strong)] bg-[var(--surface)]",
        "shadow-pop overflow-hidden pointer-events-none",
        className,
      )}
    >
      <div className="px-3 pt-2 pb-1.5 text-[11.5px] font-medium text-ink-2 border-b border-[var(--line)]">
        {title}
      </div>
      <div className="px-3 py-2 space-y-1.5">
        {rows.map((r, i) => (
          <div key={i} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 min-w-0">
              {r.color ? (
                <span
                  className="size-2 rounded-[2px] shrink-0"
                  style={{ background: r.color }}
                  aria-hidden
                />
              ) : null}
              <span className={cn("text-[12px] truncate", r.muted ? "text-ink-3" : "text-ink-2")}>
                {r.label}
              </span>
            </span>
            <span className="text-right shrink-0">
              <span className={cn("text-[12.5px] font-semibold tnum", r.muted ? "text-ink-3" : "text-ink")}>
                {r.value}
              </span>
              {r.sub ? <span className="block text-[11px] text-ink-3 tnum">{r.sub}</span> : null}
            </span>
          </div>
        ))}
      </div>
      {footer ? (
        <div className="px-3 py-1.5 border-t border-[var(--line)] bg-[var(--inset)] text-[11px] text-ink-3">
          {footer}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Identity is never carried by colour alone: every multi-series chart ships
 * this legend, and short series are direct-labelled as well.
 */
export function ChartLegend({
  items,
  className,
}: {
  items: { label: string; color: string; dashed?: boolean }[];
  className?: string;
}) {
  return (
    <ul className={cn("flex flex-wrap items-center gap-x-4 gap-y-1.5", className)}>
      {items.map((it) => (
        <li key={it.label} className="flex items-center gap-1.5 text-[11.5px] text-ink-3">
          {it.dashed ? (
            <svg width="14" height="8" aria-hidden className="shrink-0">
              <line
                x1="0" y1="4" x2="14" y2="4"
                stroke={it.color} strokeWidth="2" strokeDasharray="3 2.5" strokeLinecap="round"
              />
            </svg>
          ) : (
            <span className="size-2 rounded-[2px] shrink-0" style={{ background: it.color }} aria-hidden />
          )}
          {it.label}
        </li>
      ))}
    </ul>
  );
}

/** Series colours, read from the validated design tokens. */
export const SERIES_VARS = [
  "var(--s1)", "var(--s2)", "var(--s3)", "var(--s4)",
  "var(--s5)", "var(--s6)", "var(--s7)", "var(--s8)",
] as const;

export function seriesColor(slot: number) {
  return SERIES_VARS[slot % SERIES_VARS.length];
}
