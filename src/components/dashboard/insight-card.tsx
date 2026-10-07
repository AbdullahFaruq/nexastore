"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertTriangle, ArrowRight, CircleAlert, Info, Lightbulb, TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Insight, InsightTone } from "@/lib/analytics/insights";
import { formatMoney } from "@/lib/format/currency";
import { useStore } from "@/components/providers/store-provider";

const TONE: Record<
  InsightTone,
  { icon: React.ComponentType<{ className?: string }>; chip: string; rule: string; label: string }
> = {
  positive: {
    icon: TrendingUp,
    chip: "bg-[var(--pos-soft)] text-[var(--pos)]",
    rule: "bg-[var(--pos)]",
    label: "Good news",
  },
  warning: {
    icon: AlertTriangle,
    chip: "bg-[color-mix(in_oklab,var(--st-warn)_16%,transparent)] text-[#8a5d00] dark:text-[var(--st-warn)]",
    rule: "bg-[var(--st-warn)]",
    label: "Worth a look",
  },
  critical: {
    icon: CircleAlert,
    chip: "bg-[var(--neg-soft)] text-[var(--neg)]",
    rule: "bg-[var(--neg)]",
    label: "Needs attention",
  },
  neutral: {
    icon: Info,
    chip: "bg-[var(--surface-2)] text-ink-2",
    rule: "bg-[var(--line-strong)]",
    label: "Observation",
  },
};

/**
 * One computed insight.
 *
 * The figures shown are the same ones the generator used to decide the insight
 * was worth raising - so the claim and its evidence can never disagree.
 */
export function InsightCard({
  insight,
  compact,
}: {
  insight: Insight;
  compact?: boolean;
}) {
  const { currency } = useStore();
  const tone = TONE[insight.tone];
  const Icon = tone.icon;

  const amounts = Object.entries(insight.amounts ?? {});

  return (
    <article
      className={cn(
        "relative flex gap-3 bg-[var(--surface)] border border-[var(--line)] rounded-[9px] overflow-hidden",
        compact ? "p-3.5" : "p-4",
      )}
    >
      {/* A hairline in the tone colour - status is never colour alone, the icon
          and the "Needs attention" label carry it too. */}
      <span className={cn("absolute left-0 inset-y-0 w-[2.5px]", tone.rule)} aria-hidden />

      <span className={cn("size-7 grid place-items-center rounded-[7px] shrink-0 mt-px", tone.chip)}>
        <Icon className="size-3.5" aria-hidden />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="text-[13px] font-semibold text-ink tracking-[-0.005em]">{insight.title}</h3>
          <span className="text-[10.5px] font-medium uppercase tracking-[0.06em] text-ink-3">
            {tone.label}
          </span>
        </div>

        <p className="text-[12.5px] text-ink-2 mt-1 leading-relaxed">{insight.body}</p>

        {amounts.length > 0 ? (
          <dl className="flex flex-wrap items-baseline gap-x-4 gap-y-1 mt-2">
            {amounts.map(([key, value]) => (
              <div key={key} className="flex items-baseline gap-1.5">
                <dt className="text-[11px] text-ink-3">{humanise(key)}</dt>
                <dd className="text-[12.5px] font-semibold text-ink tnum">
                  {formatMoney(value, currency, { compact: Math.abs(value) >= 1_000_00 })}
                </dd>
              </div>
            ))}
          </dl>
        ) : null}

        {insight.href ? (
          <Link
            href={insight.href}
            className="inline-flex items-center gap-1 mt-2.5 text-[12px] font-medium text-[var(--accent-ink)] hover:gap-1.5 transition-all"
          >
            {insight.actionLabel ?? "Take a look"}
            <ArrowRight className="size-3" />
          </Link>
        ) : null}
      </div>
    </article>
  );
}

/** "revenueLast30Days" -> "Revenue last 30 days" */
function humanise(key: string) {
  return key
    .replace(/([A-Z])/g, " $1")
    // Digits need their own boundary, or "Last30Days" keeps the number glued on.
    .replace(/([a-zA-Z])(\d)/g, "$1 $2")
    .replace(/(\d)([a-zA-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .toLowerCase()
    .replace(/^./, (c) => c.toUpperCase())
    .replace(/\bpct\b/, "%")
    .trim();
}

export function InsightFeedEmpty() {
  return (
    <div className="flex flex-col items-center text-center py-9 px-5">
      <Lightbulb className="size-8 text-[var(--ink-3)] mb-3" strokeWidth={1.25} />
      <p className="text-[13.5px] font-medium text-ink">Not enough trading history yet</p>
      <p className="text-[12.5px] text-ink-3 mt-1.5 max-w-[38ch] leading-relaxed">
        Insights are calculated from your own sales, stock and costs. Once there is a week or two of
        activity, patterns worth acting on will show up here.
      </p>
    </div>
  );
}
