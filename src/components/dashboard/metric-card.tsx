"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Delta } from "@/components/shared/delta";
import { Sparkline } from "@/components/charts/sparkline";
import { AnimatedCount, AnimatedMoney } from "@/components/shared/animated-number";
import { useStore } from "@/components/providers/store-provider";

export interface MetricCardProps {
  label: string;
  value: number;
  /** How to render the figure. */
  format: "money" | "count";
  icon?: React.ReactNode;
  changePct?: number | null;
  comparisonLabel?: string;
  /** Up is bad (expenses, cost of goods). */
  invertDelta?: boolean;
  trend?: number[];
  href?: string;
  className?: string;
  compact?: boolean;
  hint?: string;
}

/**
 * A compact metric row. Deliberately NOT the same shape as the profit panel -
 * a grid of six identical boxes gives the reader no hierarchy, and the whole
 * point of the hero strip is that one number matters more than the others.
 */
export function MetricCard({
  label, value, format, icon, changePct, comparisonLabel,
  invertDelta, trend, href, className, compact, hint,
}: MetricCardProps) {
  const { currency } = useStore();

  const className_ = cn(
        "group relative flex flex-col justify-between",
        "bg-[var(--surface)] border border-[var(--line)] rounded-[9px]",
        compact ? "p-3.5" : "p-4",
    href && "transition-colors hover:border-[var(--line-strong)] hover:bg-[var(--inset)]",
    className,
  );

  const body = (
    <>
      {/* Label and sparkline share the top row, so the change caption below gets
          the full card width and never wraps onto three lines. */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          {icon ? (
            <span className="text-[var(--ink-3)] [&_svg]:size-[15px] shrink-0" aria-hidden>
              {icon}
            </span>
          ) : null}
          <span className="text-[12px] font-medium text-ink-2 truncate" title={hint}>
            {label}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {trend && trend.length > 1 ? (
            <Sparkline
              data={trend}
              width={compact ? 48 : 58}
              height={16}
              color="var(--ink-3)"
              fill={false}
              strokeWidth={1.25}
              className="opacity-60 transition-opacity group-hover:opacity-100"
            />
          ) : null}
          {href ? (
            <ArrowRight
              className="size-3.5 text-[var(--ink-3)] opacity-0 -translate-x-1 transition-all group-hover:opacity-100 group-hover:translate-x-0"
              aria-hidden
            />
          ) : null}
        </div>
      </div>

      <div className={cn("min-w-0", compact ? "mt-2.5" : "mt-3")}>
        <div
          className={cn(
            "num-hero font-semibold text-ink leading-none",
            compact ? "text-[20px]" : "text-[23px]",
          )}
        >
          {format === "money" ? (
            <AnimatedMoney value={value} currency={currency} noDecimals={Math.abs(value) >= 100_000} />
          ) : (
            <AnimatedCount value={value} />
          )}
        </div>
        {changePct !== undefined ? (
          <div className="mt-2 min-w-0">
            <Delta value={changePct} invert={invertDelta} size="sm" suffix={comparisonLabel} />
          </div>
        ) : (
          hint ? <p className="mt-2 text-[11.5px] text-ink-3 truncate">{hint}</p> : null
        )}
      </div>
    </>
  );

  return href ? (
    <Link href={href} className={className_}>
      {body}
    </Link>
  ) : (
    <div className={className_}>{body}</div>
  );
}
