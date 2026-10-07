"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatMoney } from "@/lib/format/currency";
import { relativeTime } from "@/lib/format/dates";
import { SEGMENT_META, type CustomerSegment } from "@/lib/analytics/segments";
import { useStore } from "@/components/providers/store-provider";
import { Avatar } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { Td, Th } from "@/components/sales/sales-table";
import { EmptyPeopleMark, EmptyState } from "@/components/ui/empty-state";
import { seriesColor } from "@/components/charts/chart-parts";

export interface CustomerRow {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  totalOrders: number;
  totalSpent: number;
  averageOrderValue: number;
  lastPurchaseAt?: string;
  createdAt: string;
  segment: CustomerSegment;
}

export function CustomerTable({
  customers, canWrite, filtered,
}: {
  customers: CustomerRow[];
  canWrite: boolean;
  filtered?: boolean;
}) {
  const { currency } = useStore();
  const router = useRouter();

  if (customers.length === 0) {
    return (
      <EmptyState
        icon={<EmptyPeopleMark />}
        title={filtered ? "No customers match" : "No customers yet"}
        description={
          filtered
            ? "Try a different search, or clear the segment filter."
            : "Attach a customer at the till and NexaStore starts building their purchase history and lifetime value."
        }
        action={!filtered && canWrite ? { label: "Add a customer", href: "/customers?new=1" } : undefined}
      />
    );
  }

  return (
    <>
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-[var(--line)]">
              <Th className="pl-4 sm:pl-5">Customer</Th>
              <Th>Segment</Th>
              <Th className="text-right">Orders</Th>
              <Th className="text-right">Total spent</Th>
              <Th className="text-right">Average order</Th>
              <Th className="text-right pr-4 sm:pr-5">Last purchase</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--line)]">
            {customers.map((c) => (
              <tr
                key={c.id}
                tabIndex={0}
                role="link"
                aria-label={c.name}
                onClick={(e) => {
                  if ((e.target as HTMLElement).closest("a")) return;
                  router.push(`/customers/${c.id}`);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") router.push(`/customers/${c.id}`);
                }}
                className="group hover:bg-[var(--inset)] transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--ring)]"
              >
                <Td className="pl-4 sm:pl-5">
                  <span className="flex items-center gap-2.5 min-w-0">
                    <Avatar name={c.name} size={30} />
                    <span className="min-w-0">
                      <Link
                        href={`/customers/${c.id}`}
                        className="block text-[13px] font-medium text-ink hover:text-[var(--accent-ink)] transition-colors truncate max-w-[220px]"
                      >
                        {c.name}
                      </Link>
                      <span className="block text-[11.5px] text-ink-3 truncate max-w-[220px]">
                        {c.email ?? c.phone ?? "No contact details"}
                      </span>
                    </span>
                  </span>
                </Td>

                <Td>
                  <span className="inline-flex items-center gap-1.5 text-[12px] text-ink-2">
                    <span
                      className="size-2 rounded-[2px]"
                      style={{ background: seriesColor(SEGMENT_META[c.segment].colorSlot) }}
                      aria-hidden
                    />
                    {SEGMENT_META[c.segment].label}
                  </span>
                </Td>

                <Td className="text-right">
                  <span className="text-[13px] text-ink-2 tnum">{c.totalOrders}</span>
                </Td>

                <Td className="text-right">
                  <span className="text-[13px] font-semibold text-ink tnum">
                    {formatMoney(c.totalSpent, currency)}
                  </span>
                </Td>

                <Td className="text-right">
                  <span className="text-[12.5px] text-ink-2 tnum">
                    {formatMoney(c.averageOrderValue, currency)}
                  </span>
                </Td>

                <Td className="text-right pr-4 sm:pr-5">
                  <span className="text-[12.5px] text-ink-2 whitespace-nowrap">
                    {c.lastPurchaseAt ? relativeTime(c.lastPurchaseAt) : <span className="text-ink-3">Never</span>}
                  </span>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="md:hidden divide-y divide-[var(--line)]">
        {customers.map((c) => (
          <li key={c.id}>
            <Link href={`/customers/${c.id}`} className="flex items-center gap-3 px-4 py-3 active:bg-[var(--surface-2)]">
              <Avatar name={c.name} size={36} />
              <div className="min-w-0 flex-1">
                <p className="text-[13.5px] font-medium text-ink truncate">{c.name}</p>
                <p className="text-[11.5px] text-ink-3 mt-0.5">
                  {c.totalOrders} order{c.totalOrders === 1 ? "" : "s"}
                  {c.lastPurchaseAt ? ` · ${relativeTime(c.lastPurchaseAt)}` : ""}
                </p>
                <div className="mt-1">
                  <Badge tone="neutral" size="sm">{SEGMENT_META[c.segment].label}</Badge>
                </div>
              </div>
              <span className="text-[14px] font-semibold text-ink tnum shrink-0">
                {formatMoney(c.totalSpent, currency)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
