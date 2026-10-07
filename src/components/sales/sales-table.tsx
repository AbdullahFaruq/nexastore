"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Banknote, CreditCard, Landmark, Smartphone, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/format/currency";
import { formatDate, formatTime, relativeTime } from "@/lib/format/dates";
import type { PaymentMethod, SaleStatus } from "@/lib/db/models/enums";
import { useStore } from "@/components/providers/store-provider";
import { SaleStatusBadge } from "@/components/ui/status-badge";
import { Avatar } from "@/components/ui/misc";
import { EmptyReceiptMark, EmptyState } from "@/components/ui/empty-state";

export interface SaleRow {
  id: string;
  orderNumber: string;
  customerName?: string;
  customerId?: string;
  itemCount: number;
  lineCount: number;
  total: number;
  netRevenue: number;
  paymentMethod: PaymentMethod;
  status: SaleStatus;
  soldAt: string;
  channel: string;
}

export const PAYMENT_META: Record<
  PaymentMethod,
  { label: string; icon: React.ComponentType<{ className?: string }> }
> = {
  cash: { label: "Cash", icon: Banknote },
  card: { label: "Card", icon: CreditCard },
  bank_transfer: { label: "Bank transfer", icon: Landmark },
  mobile: { label: "Mobile", icon: Smartphone },
  other: { label: "Other", icon: Wallet },
};

/**
 * Transactions list.
 *
 * A real table on desktop where column alignment aids scanning, and a stack of
 * tappable rows on mobile - a horizontally scrolling table on a phone is a
 * table nobody reads.
 */
export function SalesTable({
  sales,
  emptyAction = true,
  showCustomer = true,
  compact,
  emptyTitle,
  emptyDescription,
}: {
  sales: SaleRow[];
  emptyAction?: boolean;
  showCustomer?: boolean;
  compact?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
}) {
  const { currency, timezone } = useStore();
  const router = useRouter();

  if (sales.length === 0) {
    return (
      <EmptyState
        icon={<EmptyReceiptMark />}
        title={emptyTitle ?? "No sales yet"}
        description={
          emptyDescription ??
          "Once you make your first sale, your orders and revenue analytics will appear here."
        }
        action={emptyAction ? { label: "Record a sale", href: "/pos" } : undefined}
        compact={compact}
      />
    );
  }

  return (
    <>
      {/* Desktop */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-[var(--line)]">
              <Th className="pl-4 sm:pl-5">Order</Th>
              {showCustomer ? <Th>Customer</Th> : null}
              <Th className="text-right">Items</Th>
              <Th className="text-right">Amount</Th>
              <Th>Payment</Th>
              <Th>Status</Th>
              <Th className="text-right pr-4 sm:pr-5">Date</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--line)]">
            {sales.map((s) => {
              const Pay = PAYMENT_META[s.paymentMethod]?.icon ?? Wallet;
              return (
                <tr
                  key={s.id}
                  tabIndex={0}
                  role="link"
                  aria-label={`Order ${s.orderNumber}`}
                  onClick={(e) => {
                    if ((e.target as HTMLElement).closest("a")) return;
                    router.push(`/sales/${s.id}`);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") router.push(`/sales/${s.id}`);
                  }}
                  className="group hover:bg-[var(--inset)] transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--ring)]"
                >
                  <Td className="pl-4 sm:pl-5">
                    <Link
                      href={`/sales/${s.id}`}
                      className="font-mono text-[12.5px] font-medium text-ink hover:text-[var(--accent-ink)] transition-colors"
                    >
                      {s.orderNumber}
                    </Link>
                  </Td>

                  {showCustomer ? (
                    <Td>
                      {s.customerName ? (
                        <span className="flex items-center gap-2 min-w-0">
                          <Avatar name={s.customerName} size={22} />
                          <span className="text-[13px] text-ink-2 truncate max-w-[160px]">
                            {s.customerName}
                          </span>
                        </span>
                      ) : (
                        <span className="text-[13px] text-ink-3">Walk-in</span>
                      )}
                    </Td>
                  ) : null}

                  <Td className="text-right whitespace-nowrap">
                    <span className="text-[13px] text-ink-2 tnum">{s.itemCount}</span>
                    <span className="text-[11.5px] text-ink-3 ml-1">
                      {s.itemCount === 1 ? "item" : "items"}
                    </span>
                  </Td>

                  <Td className="text-right">
                    <span className="text-[13px] font-semibold text-ink tnum">
                      {formatMoney(s.total, currency)}
                    </span>
                  </Td>

                  <Td>
                    <span className="flex items-center gap-1.5 text-[12.5px] text-ink-2 whitespace-nowrap">
                      <Pay className="size-3.5 text-[var(--ink-3)]" aria-hidden />
                      {PAYMENT_META[s.paymentMethod]?.label ?? "Other"}
                    </span>
                  </Td>

                  <Td>
                    <SaleStatusBadge status={s.status} />
                  </Td>

                  <Td className="text-right pr-4 sm:pr-5 whitespace-nowrap">
                    <span className="text-[12.5px] text-ink-2 tnum block">
                      {formatDate(s.soldAt, timezone)}
                    </span>
                    <span className="text-[11px] text-ink-3 tnum">
                      {formatTime(s.soldAt, timezone)}
                    </span>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile */}
      <ul className="md:hidden divide-y divide-[var(--line)]">
        {sales.map((s) => {
          const Pay = PAYMENT_META[s.paymentMethod]?.icon ?? Wallet;
          return (
            <li key={s.id}>
              <Link
                href={`/sales/${s.id}`}
                className="flex items-center gap-3 px-4 py-3 active:bg-[var(--surface-2)]"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[12.5px] font-medium text-ink">{s.orderNumber}</span>
                    <SaleStatusBadge status={s.status} />
                  </div>
                  <div className="flex items-center gap-1.5 mt-1 text-[11.5px] text-ink-3">
                    <span className="truncate">{s.customerName ?? "Walk-in"}</span>
                    <span className="opacity-50">&middot;</span>
                    <Pay className="size-3 shrink-0" aria-hidden />
                    <span className="opacity-50">&middot;</span>
                    <span className="tnum shrink-0">{relativeTime(s.soldAt)}</span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span className="block text-[14px] font-semibold text-ink tnum">
                    {formatMoney(s.total, currency)}
                  </span>
                  <span className="block text-[11px] text-ink-3 tnum">{s.itemCount} items</span>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </>
  );
}

export function Th({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <th
      scope="col"
      className={cn(
        "px-3 py-2 text-[11px] font-medium uppercase tracking-[0.05em] text-[var(--ink-3)] whitespace-nowrap",
        className,
      )}
    >
      {children}
    </th>
  );
}

export function Td({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <td className={cn("px-3 py-2.5 align-middle", className)}>{children}</td>;
}
