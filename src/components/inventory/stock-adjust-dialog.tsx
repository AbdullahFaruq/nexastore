"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { PackagePlus } from "lucide-react";
import { toast } from "sonner";
import { adjustStock } from "@/actions/inventory";
import { currencyMeta } from "@/lib/format/currency";
import { useStore } from "@/components/providers/store-provider";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { FieldError, FieldHint, Input, Label, MoneyInput, NativeSelect, Textarea } from "@/components/ui/input";

const TYPES = [
  { value: "purchase", label: "Stock received", hint: "A delivery arrived from a supplier.", sign: "+" },
  { value: "adjustment", label: "Count correction", hint: "The shelf does not match the system.", sign: "+/-" },
  { value: "damage", label: "Damaged or lost", hint: "Written off and cannot be sold.", sign: "-" },
  { value: "return", label: "Customer return", hint: "Came back and is resaleable.", sign: "+" },
] as const;

/**
 * Record a stock movement.
 *
 * Sales are deliberately not an option here: stock leaves through the till, and
 * letting it also leave through this form would double-count the same units.
 */
export function StockAdjustDialog({
  products,
  openByDefault,
}: {
  products: { id: string; name: string; sku: string; stock: number; unit: string }[];
  openByDefault?: boolean;
}) {
  const router = useRouter();
  const { currency } = useStore();
  const symbol = currencyMeta(currency).symbol;

  const [open, setOpen] = React.useState(Boolean(openByDefault));
  const [pending, setPending] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [productId, setProductId] = React.useState(products[0]?.id ?? "");
  const [type, setType] = React.useState<(typeof TYPES)[number]["value"]>("purchase");
  const [quantity, setQuantity] = React.useState("");
  const [unitCost, setUnitCost] = React.useState("");
  const [reason, setReason] = React.useState("");

  const product = products.find((p) => p.id === productId);
  const typeMeta = TYPES.find((t) => t.value === type)!;
  const qty = Number(quantity) || 0;
  const delta = type === "damage" ? -Math.abs(qty) : type === "adjustment" ? qty : Math.abs(qty);
  const projected = (product?.stock ?? 0) + delta;

  const submit = async () => {
    setPending(true);
    setErrors({});
    const res = await adjustStock({
      productId,
      type,
      quantity: qty,
      reason: reason || undefined,
      unitCost: type === "purchase" && unitCost ? unitCost : undefined,
    });
    setPending(false);

    if (!res.ok) {
      setErrors(res.fields ?? {});
      toast.error(res.error);
      return;
    }

    toast.success(`${product?.name} is now at ${res.data.stock} ${product?.unit ?? "units"}`);
    setOpen(false);
    setQuantity("");
    setReason("");
    setUnitCost("");
    router.refresh();
  };

  return (
    <>
      <Button variant="primary" size="sm" onClick={() => setOpen(true)}>
        <PackagePlus />
        Adjust stock
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent size="md">
          <DialogHeader
            title="Record a stock movement"
            description="Every change is written to the inventory ledger with its reason, so any count can be explained later."
          />
          <DialogBody className="space-y-4">
            <div>
              <Label htmlFor="adjust-product" required>Product</Label>
              <NativeSelect
                id="adjust-product"
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
              >
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.stock} in stock)
                  </option>
                ))}
              </NativeSelect>
            </div>

            <div>
              <Label>What happened?</Label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                {TYPES.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setType(t.value)}
                    aria-pressed={type === t.value}
                    className={`text-left rounded-[8px] border px-3 py-2 transition-all ${
                      type === t.value
                        ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                        : "border-[var(--line)] bg-[var(--surface)] hover:border-[var(--line-strong)]"
                    }`}
                  >
                    <span className={`block text-[12.5px] font-medium ${type === t.value ? "text-[var(--accent-ink)]" : "text-ink"}`}>
                      {t.label}
                    </span>
                    <span className="block text-[11px] text-ink-3 mt-0.5 leading-snug">{t.hint}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="adjust-qty" required>
                  Quantity {typeMeta.sign === "+/-" ? "(use a minus sign to reduce)" : ""}
                </Label>
                <Input
                  id="adjust-qty"
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="0"
                  className="tnum"
                  aria-invalid={Boolean(errors.quantity)}
                />
                <FieldError>{errors.quantity}</FieldError>
              </div>

              {type === "purchase" ? (
                <div>
                  <Label htmlFor="adjust-cost">New unit cost</Label>
                  <MoneyInput
                    id="adjust-cost"
                    symbol={symbol}
                    value={unitCost}
                    onChange={(e) => setUnitCost(e.target.value)}
                    placeholder="Optional"
                  />
                  <FieldHint>Updates the cost basis for future sales.</FieldHint>
                </div>
              ) : (
                <div className="flex flex-col justify-end pb-1">
                  <p className="text-[12px] text-ink-3">Stock after this change</p>
                  <p className={`text-[19px] font-semibold tnum ${projected < 0 ? "text-[var(--neg)]" : "text-ink"}`}>
                    {projected}
                  </p>
                </div>
              )}
            </div>

            {type === "purchase" ? (
              <p className="text-[12px] text-ink-3">
                Stock after this change:{" "}
                <span className="font-semibold text-ink tnum">{projected}</span>
              </p>
            ) : null}

            <div>
              <Label htmlFor="adjust-reason">Reason</Label>
              <Textarea
                id="adjust-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
                placeholder="Purchase order 4471, stocktake correction, water damage in the back room..."
              />
              <FieldHint>Written into the ledger next to this movement.</FieldHint>
            </div>
          </DialogBody>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              variant="primary"
              loading={pending}
              disabled={!productId || qty === 0}
              onClick={submit}
            >
              Record movement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
