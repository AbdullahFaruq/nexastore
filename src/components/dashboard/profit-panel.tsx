"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/format/currency";
import { useStore } from "@/components/providers/store-provider";
import { AnimatedMoney } from "@/components/shared/animated-number";
import { Delta } from "@/components/shared/delta";
import { Sparkline } from "@/components/charts/sparkline";
import { Tooltip } from "@/components/ui/popover";

/**
 * The hero.
 *
 * Net profit gets a panel of its own at roughly three times the visual weight
 * of the metrics beside it, because it is the one number that answers "how did
 * we do". Everything else on this screen is context for it.
 */
export function ProfitPanel({
  netProfit,
  changePct,
  comparisonLabel,
  revenue,
  cogs,
  expenses,
  grossMarginPct,
  netMarginPct,
  marginPointChange,
  trend,
  canSeeAnalytics,
}: {
  netProfit: number;
  changePct: number | null;
  comparisonLabel: string;
  revenue: number;
  cogs: number;
  expenses: number;
  grossMarginPct: number;
  netMarginPct: number;
  marginPointChange: number;
  trend: number[];
  canSeeAnalytics: boolean;
}) {
  const { currency } = useStore();
  const loss = netProfit < 0;

  // The composition bar: what each unit of revenue was spent on.
  const total = Math.max(revenue, cogs + expenses + Math.max(0, netProfit), 1);
  const parts = [
    { key: "cogs", label: "Cost of goods", value: cogs, color: "var(--ink-3)" },
    { key: "expenses", label: "Operating costs", value: expenses, color: "var(--line-strong)" },
    {
      key: "profit",
      label: loss ? "Shortfall" : "Net profit",
      value: Math.abs(netProfit),
      color: loss ? "var(--neg)" : "var(--accent)",
    },
  ];

  return (
    <div className="relative flex flex-col justify-between h-full bg-[var(--surface)] border border-[var(--line)] rounded-[9px] p-5 overflow-hidden">
      {/* A faint brass wash marks this as the anchor panel without shouting. */}
      <div
        className="absolute inset-x-0 top-0 h-24 pointer-events-none opacity-[0.5]"
        style={{
          background: `linear-gradient(to bottom, color-mix(in oklab, var(--accent) 7%, transparent), transparent)`,
        }}
        aria-hidden
      />

      <div className="relative">
        <div className="flex items-center gap-1.5">
          <h2 className="text-[12.5px] font-medium text-ink-2">Net profit</h2>
          <Tooltip content="Revenue, less the cost of the goods you sold, less your operating expenses. Tax collected is excluded - it is not income.">
            <button type="button" className="text-[var(--ink-3)] hover:text-ink-2 transition-colors" aria-label="How net profit is calculated">
              <Info className="size-3.5" />
            </button>
          </Tooltip>
        </div>

        <div className="mt-2 flex items-end gap-3 flex-wrap">
          <span
            className={cn(
              "num-hero font-semibold leading-none text-[clamp(30px,5vw,42px)]",
              loss ? "text-[var(--neg)]" : "text-ink",
            )}
          >
            <AnimatedMoney value={netProfit} currency={currency} noDecimals={Math.abs(netProfit) >= 100_000} />
          </span>
          <span className="mb-1">
            <Delta value={changePct} suffix={`vs ${comparisonLabel}`} />
          </span>
        </div>
      </div>

      <div className="relative mt-5 flex items-center gap-4">
        <MarginGauge value={netMarginPct} />
        <div className="min-w-0 flex-1">
          <p className="text-[12px] text-ink-2 font-medium">Net margin</p>
          <p className="text-[11.5px] text-ink-3 mt-0.5 leading-snug">
            {grossMarginPct.toFixed(1)}% gross{" "}
            <span className={cn(Math.abs(marginPointChange) < 0.05 ? "text-ink-3" : marginPointChange > 0 ? "text-[var(--pos)]" : "text-[var(--neg)]")}>
              ({marginPointChange > 0 ? "+" : ""}{marginPointChange.toFixed(1)} pts)
            </span>
          </p>
        </div>
        {trend.length > 1 ? (
          <Sparkline
            data={trend}
            width={96}
            height={34}
            color={loss ? "var(--neg)" : "var(--accent)"}
            className="shrink-0 hidden sm:block"
          />
        ) : null}
      </div>

      {/* Where every unit of revenue went. */}
      <div className="relative mt-5">
        <div className="flex h-[7px] rounded-full overflow-hidden bg-[var(--surface-3)] gap-[2px]">
          {parts.map((p) =>
            p.value > 0 ? (
              <div
                key={p.key}
                className="h-full first:rounded-l-full last:rounded-r-full transition-[width] duration-700 ease-out"
                style={{ width: `${(p.value / total) * 100}%`, background: p.color }}
                aria-hidden
              />
            ) : null,
          )}
        </div>
        <dl className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2.5">
          {parts.map((p) => (
            <div key={p.key} className="flex items-center gap-1.5">
              <span className="size-2 rounded-[2px] shrink-0" style={{ background: p.color }} aria-hidden />
              <dt className="text-[11.5px] text-ink-3">{p.label}</dt>
              <dd className="text-[11.5px] font-medium text-ink-2 tnum">
                {formatMoney(p.value, currency, { compact: true })}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      {canSeeAnalytics ? (
        <Link
          href="/analytics"
          className="relative mt-4 inline-flex items-center gap-1 text-[12.5px] font-medium text-[var(--accent-ink)] hover:gap-1.5 transition-all w-fit"
        >
          Full profit &amp; loss
          <ArrowRight className="size-3.5" />
        </Link>
      ) : null}
    </div>
  );
}

/**
 * A 240-degree arc gauge. Chosen over a bar because margin is a rate with a
 * meaningful ceiling, and an arc communicates "out of a whole" at a glance.
 */
function MarginGauge({ value }: { value: number }) {
  const size = 62;
  const stroke = 6;
  const radius = (size - stroke) / 2;
  const sweep = 240;
  const startAngle = 150;
  const circumference = 2 * Math.PI * radius;
  const arcLength = (sweep / 360) * circumference;

  // Margins above 50% are exceptional in retail, so the scale tops out there.
  const clamped = Math.max(0, Math.min(50, value));
  const fraction = clamped / 50;

  const tone = value < 0 ? "var(--neg)" : value < 8 ? "var(--st-warn)" : "var(--accent)";

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <g transform={`rotate(${startAngle - 90} ${size / 2} ${size / 2})`}>
          <circle
            cx={size / 2} cy={size / 2} r={radius}
            fill="none" stroke="var(--surface-3)" strokeWidth={stroke}
            strokeDasharray={`${arcLength} ${circumference}`}
            strokeLinecap="round"
          />
          <circle
            cx={size / 2} cy={size / 2} r={radius}
            fill="none" stroke={tone} strokeWidth={stroke}
            strokeDasharray={`${arcLength * fraction} ${circumference}`}
            strokeLinecap="round"
            className="transition-[stroke-dasharray] duration-700 ease-out"
          />
        </g>
      </svg>
      <span className="absolute inset-0 grid place-items-center pt-1">
        <span className="text-[13px] font-semibold text-ink tnum leading-none">
          {Math.round(value)}
          <span className="text-[9px] font-medium text-ink-3">%</span>
        </span>
      </span>
    </div>
  );
}
