"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { createExpense, updateExpense } from "@/actions/expenses";
import { EXPENSE_CATEGORY_META } from "@/lib/analytics/expense-meta";
import { PAYMENT_METHODS, type ExpenseCategory, type PaymentMethod } from "@/lib/db/models/enums";
import { currencyMeta } from "@/lib/format/currency";
import { useStore } from "@/components/providers/store-provider";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { FieldError, FieldHint, Input, Label, MoneyInput, NativeSelect, Textarea } from "@/components/ui/input";
import { Switch } from "@/components/ui/misc";

export interface ExpenseDraft {
  id?: string;
  category: ExpenseCategory;
  amount: string;
  description: string;
  vendor: string;
  date: string;
  paymentMethod: PaymentMethod;
  receiptUrl: string;
  notes: string;
  recurring: boolean;
  recurrenceInterval: "weekly" | "monthly" | "quarterly" | "yearly";
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

const EMPTY: ExpenseDraft = {
  category: "rent",
  amount: "",
  description: "",
  vendor: "",
  date: today(),
  paymentMethod: "bank_transfer",
  receiptUrl: "",
  notes: "",
  recurring: false,
  recurrenceInterval: "monthly",
};

export function ExpenseDialog({
  openByDefault,
  initial,
  trigger,
  onDone,
  onClose,
}: {
  openByDefault?: boolean;
  initial?: ExpenseDraft;
  trigger?: React.ReactNode;
  onDone?: () => void;
  /** Fired whenever the dialog closes, saved or not - lets a parent that is
      driving this in "edit" mode drop its draft state. */
  onClose?: () => void;
}) {
  const router = useRouter();
  const { currency } = useStore();
  const symbol = currencyMeta(currency).symbol;

  const [open, setOpen] = React.useState(Boolean(openByDefault));
  const [values, setValues] = React.useState<ExpenseDraft>(initial ?? EMPTY);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [pending, setPending] = React.useState(false);

  // No prop-to-state effect: callers that reuse this dialog for editing pass a
  // `key`, which remounts it with the right initial values.

  const set = <K extends keyof ExpenseDraft>(key: K, value: ExpenseDraft[K]) => {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => (e[key as string] ? { ...e, [key as string]: "" } : e));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPending(true);
    setErrors({});

    const payload = {
      category: values.category,
      amount: values.amount,
      description: values.description,
      vendor: values.vendor || undefined,
      date: values.date,
      paymentMethod: values.paymentMethod,
      receiptUrl: values.receiptUrl || undefined,
      notes: values.notes || undefined,
      recurring: values.recurring,
      recurrenceInterval: values.recurring ? values.recurrenceInterval : undefined,
    };

    const res = values.id ? await updateExpense(values.id, payload) : await createExpense(payload);
    setPending(false);

    if (!res.ok) {
      setErrors(res.fields ?? {});
      toast.error(res.error);
      return;
    }

    toast.success(values.id ? "Expense updated" : "Expense recorded");
    setOpen(false);
    setValues(EMPTY);
    onDone?.();
    router.refresh();
  };

  return (
    <>
      {trigger ? (
        <span onClick={() => setOpen(true)}>{trigger}</span>
      ) : (
        <Button variant="primary" size="sm" onClick={() => setOpen(true)}>
          <Plus />
          Add expense
        </Button>
      )}

      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) onClose?.();
        }}
      >
        <DialogContent size="md">
          <DialogHeader
            title={values.id ? "Edit expense" : "Record an expense"}
            description="Operating costs sit below gross profit. The cost of the stock you sold is tracked automatically and does not belong here."
          />
          <form onSubmit={submit}>
            <DialogBody className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="exp-amount" required>Amount</Label>
                  <MoneyInput
                    id="exp-amount"
                    symbol={symbol}
                    value={values.amount}
                    onChange={(e) => set("amount", e.target.value)}
                    placeholder="0.00"
                    required
                    autoFocus
                    aria-invalid={Boolean(errors.amount)}
                  />
                  <FieldError>{errors.amount}</FieldError>
                </div>
                <div>
                  <Label htmlFor="exp-date" required>Date</Label>
                  <Input
                    id="exp-date"
                    type="date"
                    value={values.date}
                    onChange={(e) => set("date", e.target.value)}
                    required
                    className="tnum"
                    aria-invalid={Boolean(errors.date)}
                  />
                  <FieldError>{errors.date}</FieldError>
                </div>
              </div>

              <div>
                <Label htmlFor="exp-desc" required>Description</Label>
                <Input
                  id="exp-desc"
                  value={values.description}
                  onChange={(e) => set("description", e.target.value)}
                  placeholder="Shop lease, October"
                  required
                  aria-invalid={Boolean(errors.description)}
                />
                <FieldError>{errors.description}</FieldError>
              </div>

              <div>
                <Label>Category</Label>
                <div className="grid grid-cols-3 gap-1.5 mt-1">
                  {(Object.keys(EXPENSE_CATEGORY_META) as ExpenseCategory[]).map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => set("category", c)}
                      aria-pressed={values.category === c}
                      className={`rounded-[7px] border px-2 h-8 text-[12px] font-medium transition-all ${
                        values.category === c
                          ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-ink)]"
                          : "border-[var(--line)] bg-[var(--surface)] text-ink-2 hover:border-[var(--line-strong)]"
                      }`}
                    >
                      {EXPENSE_CATEGORY_META[c].label}
                    </button>
                  ))}
                </div>
                <FieldHint>{EXPENSE_CATEGORY_META[values.category].hint}</FieldHint>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="exp-vendor">Paid to</Label>
                  <Input
                    id="exp-vendor"
                    value={values.vendor}
                    onChange={(e) => set("vendor", e.target.value)}
                    placeholder="Ardent Property"
                  />
                </div>
                <div>
                  <Label htmlFor="exp-method">Payment method</Label>
                  <NativeSelect
                    id="exp-method"
                    value={values.paymentMethod}
                    onChange={(e) => set("paymentMethod", e.target.value as PaymentMethod)}
                  >
                    {PAYMENT_METHODS.map((m) => (
                      <option key={m} value={m}>
                        {m.replace("_", " ").replace(/^\w/, (c) => c.toUpperCase())}
                      </option>
                    ))}
                  </NativeSelect>
                </div>
              </div>

              <div>
                <Label htmlFor="exp-receipt">Receipt link</Label>
                <Input
                  id="exp-receipt"
                  type="url"
                  value={values.receiptUrl}
                  onChange={(e) => set("receiptUrl", e.target.value)}
                  placeholder="https://..."
                  aria-invalid={Boolean(errors.receiptUrl)}
                />
                <FieldError>{errors.receiptUrl}</FieldError>
                <FieldHint>A link to the scanned receipt or supplier invoice.</FieldHint>
              </div>

              <div>
                <Label htmlFor="exp-notes">Notes</Label>
                <Textarea
                  id="exp-notes"
                  value={values.notes}
                  onChange={(e) => set("notes", e.target.value)}
                  rows={2}
                />
              </div>

              <div className="flex items-start justify-between gap-4 rounded-[8px] border border-[var(--line)] bg-[var(--surface-2)] px-3.5 py-3">
                <div className="min-w-0">
                  <Label htmlFor="exp-recurring" className="mb-0.5">This cost repeats</Label>
                  <p className="text-[11.5px] text-ink-3 leading-snug">
                    Flags it as a regular commitment. Each occurrence is still entered separately, so
                    nothing is counted before it happens.
                  </p>
                </div>
                <Switch
                  id="exp-recurring"
                  checked={values.recurring}
                  onCheckedChange={(v) => set("recurring", v)}
                />
              </div>

              {values.recurring ? (
                <div>
                  <Label htmlFor="exp-interval">How often</Label>
                  <NativeSelect
                    id="exp-interval"
                    value={values.recurrenceInterval}
                    onChange={(e) => set("recurrenceInterval", e.target.value as ExpenseDraft["recurrenceInterval"])}
                  >
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="yearly">Yearly</option>
                  </NativeSelect>
                </div>
              ) : null}
            </DialogBody>

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" variant="primary" loading={pending}>
                {values.id ? "Save changes" : "Record expense"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
