"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/format/currency";
import type { PnlLine } from "@/lib/analytics/pnl";
import { useStore } from "@/components/providers/store-provider";

/**
 * The statement view.
 *
 * A common-size column ("% of revenue") sits next to every figure, because the
 * useful question about an expense line is not how big it is but how big it is
 * relative to what came in.
 */
export function PnlStatement({ lines }: { lines: PnlLine[] }) {
  const { currency } = useStore();

  return (
    <table className="w-full border-collapse">
      <caption className="sr-only">Profit and loss statement</caption>
      <thead>
        <tr className="border-b border-[var(--line)]">
          <th scope="col" className="text-left pb-2 px-4 sm:px-5 text-[10.5px] font-medium uppercase tracking-[0.07em] text-[var(--ink-3)]">
            Line
          </th>
          <th scope="col" className="text-right pb-2 px-3 text-[10.5px] font-medium uppercase tracking-[0.07em] text-[var(--ink-3)] w-[110px]">
            % of revenue
          </th>
          <th scope="col" className="text-right pb-2 px-4 sm:px-5 text-[10.5px] font-medium uppercase tracking-[0.07em] text-[var(--ink-3)] w-[150px]">
            Amount
          </th>
        </tr>
      </thead>
      <tbody>
        {lines.map((line) => {
          const isSubtotal = line.kind === "subtotal";
          const isTotal = line.kind === "total";
          const negative = line.amount < 0;

          return (
            <tr
              key={line.key}
              className={cn(
                "border-b border-[var(--line)] last:border-0",
                isTotal && "bg-[var(--accent-soft)]",
                isSubtotal && "bg-[var(--inset)]",
              )}
            >
              <td
                className="py-2.5 px-4 sm:px-5"
                style={{ paddingLeft: `calc(${line.depth * 16}px + 1rem)` }}
              >
                <span
                  className={cn(
                    "block",
                    isTotal ? "text-[14px] font-semibold text-ink"
                    : isSubtotal ? "text-[13px] font-semibold text-ink"
                    : "text-[13px] text-ink-2",
                  )}
                >
                  {line.label}
                </span>
                {line.hint ? (
                  <span className="block text-[11px] text-ink-3 mt-0.5">{line.hint}</span>
                ) : null}
              </td>

              <td className="py-2.5 px-3 text-right align-top">
                <span className="text-[12px] text-ink-3 tnum">
                  {line.ofRevenuePct === undefined || !Number.isFinite(line.ofRevenuePct)
                    ? "-"
                    : `${line.ofRevenuePct.toFixed(1)}%`}
                </span>
              </td>

              <td className="py-2.5 px-4 sm:px-5 text-right align-top">
                <span
                  className={cn(
                    "tnum",
                    isTotal ? "text-[16px] font-semibold" : isSubtotal ? "text-[14px] font-semibold" : "text-[13px]",
                    negative ? "text-[var(--neg)]" : isTotal || isSubtotal ? "text-ink" : "text-ink-2",
                  )}
                >
                  {negative ? "-" : ""}
                  {formatMoney(Math.abs(line.amount), currency)}
                </span>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
