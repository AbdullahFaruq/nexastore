"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, MoreHorizontal, Pencil, Repeat, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { formatMoney } from "@/lib/format/currency";
import { formatDate } from "@/lib/format/dates";
import { EXPENSE_CATEGORY_META } from "@/lib/analytics/expense-meta";
import type { ExpenseCategory, PaymentMethod } from "@/lib/db/models/enums";
import { deleteExpense } from "@/actions/expenses";
import { useStore } from "@/components/providers/store-provider";
import { seriesColor } from "@/components/charts/chart-parts";
import { Td, Th } from "@/components/sales/sales-table";
import { EmptyState, EmptyWalletMark } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Dropdown, DropdownContent, DropdownItem, DropdownSeparator, DropdownTrigger } from "@/components/ui/dropdown";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { ExpenseDialog, type ExpenseDraft } from "./expense-dialog";
import { Tooltip } from "@/components/ui/popover";

export interface ExpenseRow {
  id: string;
  category: ExpenseCategory;
  amount: number;
  description: string;
  vendor?: string;
  date: string;
  paymentMethod: PaymentMethod;
  receiptUrl?: string;
  notes?: string;
  recurring: boolean;
  recurrenceInterval?: "weekly" | "monthly" | "quarterly" | "yearly";
  createdByName?: string;
}

export function ExpenseTable({
  expenses, canWrite, filtered,
}: {
  expenses: ExpenseRow[];
  canWrite: boolean;
  filtered?: boolean;
}) {
  const { currency, timezone } = useStore();
  const router = useRouter();
  const [editing, setEditing] = React.useState<ExpenseDraft | null>(null);
  const [deleting, setDeleting] = React.useState<ExpenseRow | null>(null);
  const [pending, setPending] = React.useState(false);

  if (expenses.length === 0) {
    return (
      <EmptyState
        icon={<EmptyWalletMark />}
        title={filtered ? "No expenses match those filters" : "No expenses recorded yet"}
        description={
          filtered
            ? "Try a wider date range or clear a filter."
            : "Record rent, wages, utilities and the rest so your profit figure reflects what the business actually costs to run."
        }
        action={!filtered && canWrite ? { label: "Add an expense", href: "/expenses?new=1" } : undefined}
      />
    );
  }

  const toDraft = (e: ExpenseRow): ExpenseDraft => ({
    id: e.id,
    category: e.category,
    amount: String(formatMoney(e.amount, currency).replace(/[^0-9.]/g, "")),
    description: e.description,
    vendor: e.vendor ?? "",
    date: e.date.slice(0, 10),
    paymentMethod: e.paymentMethod,
    receiptUrl: e.receiptUrl ?? "",
    notes: e.notes ?? "",
    recurring: e.recurring,
    recurrenceInterval: e.recurrenceInterval ?? "monthly",
  });

  const rowActions = (e: ExpenseRow) =>
    canWrite ? (
      <Dropdown>
        <DropdownTrigger asChild>
          <Button variant="ghost" size="iconSm" aria-label={`Actions for ${e.description}`}>
            <MoreHorizontal />
          </Button>
        </DropdownTrigger>
        <DropdownContent align="end">
          <DropdownItem onSelect={() => setEditing(toDraft(e))}>
            <Pencil /> Edit
          </DropdownItem>
          {e.receiptUrl ? (
            <DropdownItem asChild>
              <a href={e.receiptUrl} target="_blank" rel="noreferrer noopener">
                <ExternalLink /> Open receipt
              </a>
            </DropdownItem>
          ) : null}
          <DropdownSeparator />
          <DropdownItem destructive onSelect={() => setDeleting(e)}>
            <Trash2 /> Delete
          </DropdownItem>
        </DropdownContent>
      </Dropdown>
    ) : null;

  return (
    <>
      {/* Desktop */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-[var(--line)]">
              <Th className="pl-4 sm:pl-5">Description</Th>
              <Th>Category</Th>
              <Th>Paid to</Th>
              <Th>Date</Th>
              <Th className="text-right">Amount</Th>
              <Th className="pr-4 sm:pr-5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--line)]">
            {expenses.map((e) => (
              <tr key={e.id} className="group hover:bg-[var(--inset)] transition-colors">
                <Td className="pl-4 sm:pl-5">
                  <span className="flex items-center gap-2">
                    <span className="text-[13px] text-ink">{e.description}</span>
                    {e.recurring ? (
                      <Tooltip content={`Repeats ${e.recurrenceInterval ?? "monthly"}`}>
                        <span className="text-[var(--ink-3)]">
                          <Repeat className="size-3" aria-label="Recurring cost" />
                        </span>
                      </Tooltip>
                    ) : null}
                  </span>
                  {e.notes ? (
                    <span className="block text-[11.5px] text-ink-3 mt-0.5 truncate max-w-[320px]">
                      {e.notes}
                    </span>
                  ) : null}
                </Td>

                <Td>
                  <span className="inline-flex items-center gap-1.5 text-[12.5px] text-ink-2">
                    <span
                      className="size-2 rounded-[2px]"
                      style={{ background: seriesColor(EXPENSE_CATEGORY_META[e.category].colorSlot) }}
                      aria-hidden
                    />
                    {EXPENSE_CATEGORY_META[e.category].label}
                  </span>
                </Td>

                <Td>
                  <span className="text-[12.5px] text-ink-2">
                    {e.vendor ?? <span className="text-ink-3">&mdash;</span>}
                  </span>
                </Td>

                <Td>
                  <span className="text-[12.5px] text-ink-2 tnum whitespace-nowrap">
                    {formatDate(e.date, timezone)}
                  </span>
                </Td>

                <Td className="text-right">
                  <span className="text-[13px] font-semibold text-ink tnum">
                    {formatMoney(e.amount, currency)}
                  </span>
                </Td>

                <Td className="pr-4 sm:pr-5 text-right">
                  <span className="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity inline-block">
                    {rowActions(e)}
                  </span>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile */}
      <ul className="md:hidden divide-y divide-[var(--line)]">
        {expenses.map((e) => (
          <li key={e.id} className="flex items-start gap-3 px-4 py-3">
            <span
              className="size-2 rounded-[2px] mt-1.5 shrink-0"
              style={{ background: seriesColor(EXPENSE_CATEGORY_META[e.category].colorSlot) }}
              aria-hidden
            />
            <div className="min-w-0 flex-1">
              <p className="text-[13.5px] text-ink">{e.description}</p>
              <p className="text-[11.5px] text-ink-3 mt-0.5">
                {EXPENSE_CATEGORY_META[e.category].label}
                {e.vendor ? ` · ${e.vendor}` : ""} · {formatDate(e.date, timezone)}
              </p>
            </div>
            <div className="text-right shrink-0 flex items-start gap-1">
              <span className="text-[14px] font-semibold text-ink tnum">
                {formatMoney(e.amount, currency)}
              </span>
              {rowActions(e)}
            </div>
          </li>
        ))}
      </ul>

      {editing ? (
        <ExpenseDialog
          key={editing.id}
          initial={editing}
          openByDefault
          trigger={<span className="hidden" />}
          onDone={() => setEditing(null)}
          onClose={() => setEditing(null)}
        />
      ) : null}

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete this expense?"
        description={
          deleting
            ? `"${deleting.description}" for ${formatMoney(deleting.amount, currency)} will be removed, and your profit figures for that period will change to match.`
            : undefined
        }
        confirmLabel="Delete expense"
        destructive
        loading={pending}
        onConfirm={async () => {
          if (!deleting) return;
          setPending(true);
          const res = await deleteExpense(deleting.id);
          setPending(false);
          if (res.ok) {
            toast.success("Expense deleted");
            setDeleting(null);
            router.refresh();
          } else {
            toast.error(res.error);
          }
        }}
      />
    </>
  );
}
