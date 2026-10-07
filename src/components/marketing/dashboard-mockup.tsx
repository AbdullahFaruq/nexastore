"use client";

import * as React from "react";
import { ArrowUpRight, Banknote, ShoppingCart } from "lucide-react";

/**
 * The hero mockup.
 *
 * Rebuilt from the product's own tokens rather than pasted in as a screenshot,
 * so it follows the visitor's theme, stays sharp at any density, and cannot
 * drift out of date when the real dashboard changes. Figures are illustrative
 * and the caption says so.
 */
const SERIES = [
  38, 52, 44, 61, 47, 73, 66, 58, 79, 62, 88, 71, 94, 83, 76, 97,
  86, 104, 91, 112, 98, 121, 108, 96, 129, 114, 137, 122, 145, 131,
];

const PREVIOUS = [
  31, 44, 39, 48, 43, 57, 52, 49, 61, 54, 66, 58, 71, 63, 60, 74,
  67, 78, 71, 84, 76, 88, 81, 74, 92, 85, 96, 89, 101, 94,
];

export function DashboardMockup() {
  const max = Math.max(...SERIES, ...PREVIOUS);
  const toPath = (data: number[]) =>
    data
      .map((v, i) => {
        const x = (i / (data.length - 1)) * 100;
        const y = 100 - (v / max) * 92;
        return `${i === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
      })
      .join(" ");

  return (
    <figure className="relative">
      <div className="rounded-[14px] border border-[var(--line-strong)] bg-[var(--surface)] shadow-pop overflow-hidden">
        {/* Window chrome */}
        <div className="flex items-center gap-2 px-4 h-10 border-b border-[var(--line)] bg-[var(--inset)]">
          <span className="flex gap-1.5" aria-hidden>
            <span className="size-2.5 rounded-full bg-[var(--line-strong)]" />
            <span className="size-2.5 rounded-full bg-[var(--line-strong)]" />
            <span className="size-2.5 rounded-full bg-[var(--line-strong)]" />
          </span>
          <span className="mx-auto text-[11.5px] text-ink-3 font-mono">
            nexastore.app/dashboard
          </span>
        </div>

        <div className="p-3 sm:p-5">
          {/* Hero row */}
          <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] gap-3">
            {/* Profit panel */}
            <div className="rounded-[9px] border border-[var(--line)] bg-[var(--surface)] p-4 relative overflow-hidden">
              <div
                className="absolute inset-x-0 top-0 h-20 opacity-50 pointer-events-none"
                style={{
                  background:
                    "linear-gradient(to bottom, color-mix(in oklab, var(--accent) 8%, transparent), transparent)",
                }}
                aria-hidden
              />
              <p className="relative text-[11.5px] font-medium text-ink-2">Net profit</p>
              <p className="relative num-hero text-[clamp(26px,3.4vw,34px)] font-semibold text-ink leading-none mt-2">
                22,844
              </p>
              <p className="relative mt-2 inline-flex items-center gap-0.5 text-[12px] font-medium text-[var(--pos)] tnum">
                <ArrowUpRight className="size-3.5" aria-hidden />
                +8.6%
                <span className="text-ink-3 font-normal ml-1">vs last month to date</span>
              </p>

              <div className="relative mt-4 flex h-[7px] rounded-full overflow-hidden bg-[var(--surface-3)] gap-[2px]">
                <div className="h-full rounded-l-full bg-[var(--ink-3)]" style={{ width: "58%" }} aria-hidden />
                <div className="h-full bg-[var(--line-strong)]" style={{ width: "18%" }} aria-hidden />
                <div className="h-full rounded-r-full bg-[var(--accent)]" style={{ width: "24%" }} aria-hidden />
              </div>
              <div className="relative flex flex-wrap gap-x-3 gap-y-1 mt-2.5 text-[10.5px] text-ink-3">
                <span className="flex items-center gap-1">
                  <span className="size-1.5 rounded-[2px] bg-[var(--ink-3)]" aria-hidden />
                  Cost of goods
                </span>
                <span className="flex items-center gap-1">
                  <span className="size-1.5 rounded-[2px] bg-[var(--line-strong)]" aria-hidden />
                  Operating
                </span>
                <span className="flex items-center gap-1">
                  <span className="size-1.5 rounded-[2px] bg-[var(--accent)]" aria-hidden />
                  Profit
                </span>
              </div>
            </div>

            {/* Metric grid */}
            <div className="grid grid-cols-2 sm:grid-cols-1 gap-3">
              {[
                { icon: Banknote, label: "Revenue", value: "98,120", delta: "+3.0%", good: true },
                { icon: ShoppingCart, label: "Orders", value: "377", delta: "+4.2%", good: true },
              ].map((m) => (
                <div key={m.label} className="rounded-[9px] border border-[var(--line)] bg-[var(--surface)] p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 min-w-0">
                      <m.icon className="size-3.5 text-[var(--ink-3)] shrink-0" aria-hidden />
                      <span className="text-[12px] font-medium text-ink-2">{m.label}</span>
                    </span>
                  </div>
                  <p className="num-hero text-[18px] font-semibold text-ink mt-2 leading-none">{m.value}</p>
                  <p
                    className={`text-[12px] font-medium tnum mt-1.5 ${
                      m.good ? "text-[var(--pos)]" : "text-[var(--neg)]"
                    }`}
                  >
                    {m.delta}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Chart */}
          <div className="mt-3 rounded-[9px] border border-[var(--line)] bg-[var(--surface)] p-4">
            <div className="flex items-baseline justify-between gap-3 flex-wrap">
              <div>
                <p className="text-[12px] font-semibold text-ink">Revenue over time</p>
                <p className="num-hero text-[22px] font-semibold text-ink mt-1 leading-none">98,120</p>
              </div>
              <span className="text-[12px] text-ink-3">This month</span>
            </div>

            <div className="mt-3 h-[96px] sm:h-[132px]">
              <svg
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                className="w-full h-full overflow-visible"
                aria-hidden
              >
                <defs>
                  <linearGradient id="nx-mock-area" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--s1)" stopOpacity="0.26" />
                    <stop offset="100%" stopColor="var(--s1)" stopOpacity="0.01" />
                  </linearGradient>
                </defs>

                {[0, 25, 50, 75].map((y) => (
                  <line key={y} x1="0" y1={y} x2="100" y2={y} stroke="var(--grid)" strokeWidth="0.35" />
                ))}

                <path d={`${toPath(SERIES)} L100 100 L0 100 Z`} fill="url(#nx-mock-area)" />
                <path
                  d={toPath(PREVIOUS)}
                  fill="none"
                  stroke="var(--ink-3)"
                  strokeWidth="1.6"
                  strokeDasharray="3 2.5"
                  vectorEffect="non-scaling-stroke"
                  strokeLinecap="round"
                />
                <path
                  d={toPath(SERIES)}
                  fill="none"
                  stroke="var(--s1)"
                  strokeWidth="2"
                  vectorEffect="non-scaling-stroke"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>

            <div className="flex items-center gap-4 mt-3 pt-3 border-t border-[var(--line)]">
              <span className="flex items-center gap-1.5 text-[10.5px] text-ink-3">
                <span className="size-2 rounded-[2px] bg-[var(--s1)]" aria-hidden />
                Revenue
              </span>
              <span className="flex items-center gap-1.5 text-[10.5px] text-ink-3">
                <svg width="14" height="8" aria-hidden>
                  <line x1="0" y1="4" x2="14" y2="4" stroke="var(--ink-3)" strokeWidth="2" strokeDasharray="3 2.5" strokeLinecap="round" />
                </svg>
                Last month
              </span>
            </div>
          </div>
        </div>
      </div>

      <figcaption className="mt-3 text-center text-[11.5px] text-ink-3">
        Your profit, sales, and orders at a glance. Illustrative figures.
      </figcaption>
    </figure>
  );
}
