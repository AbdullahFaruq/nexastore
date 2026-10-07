"use client";

import * as React from "react";
import Link from "next/link";
import { Plus, Printer, Receipt } from "lucide-react";
import { formatMoney } from "@/lib/format/currency";
import { useStore } from "@/components/providers/store-provider";
import { Button } from "@/components/ui/button";

/**
 * Sale confirmation.
 *
 * The order number and total are the two things a till operator reads out
 * loud, so they get the weight. The animation is a single stroke-draw on a
 * tick - enough to register that something completed, short enough that the
 * next customer is not waiting on it.
 */
export function SaleSuccess({
  orderNumber,
  total,
  change,
  itemCount,
  id,
  onNewSale,
}: {
  orderNumber: string;
  total: number;
  change: number;
  itemCount: number;
  id: string;
  onNewSale: () => void;
}) {
  const { currency } = useStore();

  // "N" for a new sale, so the operator never has to reach for the mouse.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key.toLowerCase() === "n") {
        e.preventDefault();
        onNewSale();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onNewSale]);

  return (
    <div className="min-h-[calc(100dvh-3.5rem)] grid place-items-center px-5 py-10">
      <div className="w-full max-w-[400px] text-center animate-rise">
        <div className="relative mx-auto size-16 mb-6">
          <span className="absolute inset-0 rounded-full bg-[var(--pos-soft)] animate-pop-in" aria-hidden />
          <svg viewBox="0 0 64 64" className="relative size-16" role="img" aria-label="Sale completed">
            <circle
              cx="32" cy="32" r="26"
              fill="none" stroke="var(--pos)" strokeWidth="2" opacity="0.28"
            />
            <path
              d="M21 33l7.5 7.5L43 25"
              fill="none"
              stroke="var(--pos)"
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ strokeDasharray: 44, ["--dash" as string]: 44 }}
              className="animate-draw"
            />
          </svg>
        </div>

        <h1 className="text-[24px] font-semibold text-ink tracking-[-0.028em]">Sale completed</h1>
        <p className="text-[13.5px] text-ink-3 mt-1.5">
          {itemCount} {itemCount === 1 ? "item" : "items"} &middot;{" "}
          <span className="font-mono">{orderNumber}</span>
        </p>

        <div className="mt-6 rounded-[10px] border border-[var(--line)] bg-[var(--surface)] overflow-hidden">
          <div className="px-5 py-4">
            <p className="text-[12px] text-ink-3">Total charged</p>
            <p className="text-[34px] font-semibold text-ink tnum num-hero leading-none mt-1">
              {formatMoney(total, currency)}
            </p>
          </div>
          {change > 0 ? (
            <div className="flex items-center justify-between gap-3 px-5 py-3 border-t border-[var(--line)] bg-[var(--accent-soft)]">
              <span className="text-[13px] font-medium text-[var(--accent-ink)]">Change due</span>
              <span className="text-[19px] font-semibold text-[var(--accent-ink)] tnum">
                {formatMoney(change, currency)}
              </span>
            </div>
          ) : null}
        </div>

        <div className="mt-5 space-y-2">
          <Button variant="primary" size="lg" className="w-full" onClick={onNewSale} autoFocus>
            <Plus />
            New sale
            <kbd className="ml-1 text-[10.5px] font-mono opacity-70">N</kbd>
          </Button>

          <div className="grid grid-cols-2 gap-2">
            <Button asChild variant="secondary" size="md">
              <Link href={`/invoices/${id}`}>
                <Printer />
                Receipt
              </Link>
            </Button>
            <Button asChild variant="secondary" size="md">
              <Link href={`/sales/${id}`}>
                <Receipt />
                Order
              </Link>
            </Button>
          </div>
        </div>

        <p className="text-[12px] text-ink-3 mt-5">
          Stock and analytics have already been updated.
        </p>
      </div>
    </div>
  );
}
