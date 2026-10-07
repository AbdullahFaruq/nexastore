import * as React from "react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn, formatPercent } from "@/lib/utils";

/**
 * A change indicator.
 *
 * `invert` is important: for expenses and cost of goods, going UP is bad. The
 * arrow always points the way the number moved; the colour reflects whether
 * that movement is good for the business.
 */
export function Delta({
  value,
  invert = false,
  className,
  size = "md",
  suffix,
  showZero = true,
}: {
  value: number | null;
  invert?: boolean;
  className?: string;
  size?: "sm" | "md";
  suffix?: React.ReactNode;
  showZero?: boolean;
}) {
  if (value === null) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 text-ink-3",
          size === "sm" ? "text-[11.5px]" : "text-[12.5px]",
          className,
        )}
        title="No activity in the comparison period"
      >
        <Minus className={size === "sm" ? "size-3" : "size-3.5"} aria-hidden />
        No prior data
      </span>
    );
  }

  const flat = Math.abs(value) < 0.05;
  if (flat && !showZero) return null;

  const good = invert ? value < 0 : value > 0;
  const Icon = value > 0 ? ArrowUpRight : value < 0 ? ArrowDownRight : Minus;

  return (
    <span
      className={cn(
        "inline-flex items-baseline flex-wrap gap-x-1 gap-y-0.5 font-medium tnum",
        size === "sm" ? "text-[11.5px]" : "text-[12.5px]",
        flat ? "text-ink-3" : good ? "text-[var(--pos)]" : "text-[var(--neg)]",
        className,
      )}
    >
      <span className="inline-flex items-center gap-0.5 shrink-0">
        <Icon className={cn(size === "sm" ? "size-3" : "size-3.5", "shrink-0")} aria-hidden />
        {formatPercent(value)}
      </span>
      {suffix ? <span className="text-ink-3 font-normal">{suffix}</span> : null}
    </span>
  );
}

/** Change expressed in percentage points (for margins), not percent. */
export function DeltaPoints({
  value,
  invert = false,
  className,
}: {
  value: number;
  invert?: boolean;
  className?: string;
}) {
  const flat = Math.abs(value) < 0.05;
  const good = invert ? value < 0 : value > 0;
  const Icon = value > 0 ? ArrowUpRight : value < 0 ? ArrowDownRight : Minus;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-[12.5px] font-medium tnum",
        flat ? "text-ink-3" : good ? "text-[var(--pos)]" : "text-[var(--neg)]",
        className,
      )}
    >
      <Icon className="size-3.5 shrink-0" aria-hidden />
      {Math.abs(value).toFixed(1)} pts
    </span>
  );
}
