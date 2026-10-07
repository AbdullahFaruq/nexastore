"use client";

import * as React from "react";
import { formatMoney, type FormatMoneyOptions } from "@/lib/format/currency";
import { cn } from "@/lib/utils";
import { useStore } from "@/components/providers/store-provider";

/**
 * Renders an integer minor-unit amount in the store's currency.
 * Nothing in the product formats money by hand - there is no "$" anywhere.
 */
export function Money({
  value,
  className,
  compact,
  noDecimals,
  signed,
  tone,
  currency: overrideCurrency,
}: {
  value: number;
  className?: string;
  compact?: boolean;
  noDecimals?: boolean;
  signed?: boolean;
  /** Colour by sign; use only where the sign carries meaning. */
  tone?: "auto" | "none" | "positive" | "negative";
  currency?: string;
}) {
  const store = useStore();
  const currency = overrideCurrency ?? store.currency;
  const opts: FormatMoneyOptions = { compact, noDecimals, signed };

  const toneClass =
    tone === "positive"
      ? "text-[var(--pos)]"
      : tone === "negative"
        ? "text-[var(--neg)]"
        : tone === "auto"
          ? value > 0
            ? "text-[var(--pos)]"
            : value < 0
              ? "text-[var(--neg)]"
              : "text-ink-3"
          : undefined;

  return (
    <span className={cn("tnum", toneClass, className)}>{formatMoney(value, currency, opts)}</span>
  );
}

/** Server-safe formatter for places that cannot use the client context. */
export function formatStoreMoney(value: number, currency: string, opts?: FormatMoneyOptions) {
  return formatMoney(value, currency, opts);
}
