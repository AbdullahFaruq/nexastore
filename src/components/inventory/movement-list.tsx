"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowDownLeft, ArrowUpRight, PackageMinus, PackagePlus, RotateCcw, Sparkles, Truck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { relativeTime } from "@/lib/format/dates";
import type { MovementType } from "@/lib/db/models/enums";

export interface MovementRow {
  id: string;
  type: MovementType;
  quantity: number;
  stockAfter: number;
  reason?: string;
  orderNumber?: string;
  createdAt: string;
  createdByName?: string;
  productName?: string;
  productId?: string;
}

const META: Record<MovementType, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  initial: { label: "Opening stock", icon: Sparkles },
  purchase: { label: "Stock added", icon: PackagePlus },
  sale: { label: "Sold", icon: ArrowDownLeft },
  adjustment: { label: "Adjusted", icon: ArrowUpRight },
  return: { label: "Returned", icon: RotateCcw },
  damage: { label: "Damaged", icon: PackageMinus },
  transfer: { label: "Transferred", icon: Truck },
};

/**
 * The inventory ledger.
 *
 * Every row explains one change to a stock level and where it came from - a
 * sale links to its order, a purchase carries its reason. Nothing moves stock
 * without leaving a row here, which is what makes a count auditable.
 */
export function MovementList({
  movements,
  showProduct,
  emptyMessage = "No stock movements recorded yet.",
}: {
  movements: MovementRow[];
  showProduct?: boolean;
  emptyMessage?: string;
}) {
  if (movements.length === 0) {
    return (
      <p className="px-4 sm:px-5 py-8 text-center text-[12.5px] text-ink-3">{emptyMessage}</p>
    );
  }

  return (
    <ul className="divide-y divide-[var(--line)]">
      {movements.map((m) => {
        const meta = META[m.type] ?? META.adjustment;
        const Icon = meta.icon;
        const positive = m.quantity > 0;

        return (
          <li key={m.id} className="flex items-start gap-2.5 px-4 sm:px-5 py-2.5">
            <span
              className={cn(
                "size-7 grid place-items-center rounded-[7px] shrink-0 mt-px",
                positive ? "bg-[var(--pos-soft)] text-[var(--pos)]" : "bg-[var(--surface-2)] text-ink-3",
              )}
              aria-hidden
            >
              <Icon className="size-3.5" />
            </span>

            <div className="min-w-0 flex-1">
              <p className="text-[12.5px] text-ink-2">
                <span className="font-medium text-ink">{meta.label}</span>
                {showProduct && m.productName ? (
                  <>
                    {" "}
                    {m.productId ? (
                      <Link href={`/products/${m.productId}`} className="hover:text-[var(--accent-ink)] transition-colors">
                        {m.productName}
                      </Link>
                    ) : (
                      m.productName
                    )}
                  </>
                ) : null}
                {m.orderNumber ? (
                  <>
                    {" on "}
                    <span className="font-mono text-[11.5px]">{m.orderNumber}</span>
                  </>
                ) : null}
              </p>
              {m.reason ? (
                <p className="text-[11.5px] text-ink-3 mt-0.5 leading-snug">{m.reason}</p>
              ) : null}
              <p className="text-[11px] text-ink-3 mt-0.5">
                {relativeTime(m.createdAt)}
                {m.createdByName ? ` by ${m.createdByName}` : ""}
              </p>
            </div>

            <div className="text-right shrink-0">
              <p
                className={cn(
                  "text-[13px] font-semibold tnum",
                  positive ? "text-[var(--pos)]" : "text-ink-2",
                )}
              >
                {positive ? "+" : ""}
                {m.quantity}
              </p>
              <p className="text-[11px] text-ink-3 tnum mt-0.5">{m.stockAfter} left</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
