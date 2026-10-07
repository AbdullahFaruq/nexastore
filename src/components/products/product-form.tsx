"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Info, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { currencyMeta, formatMoney, parseMoney } from "@/lib/format/currency";
import { unitEconomics } from "@/lib/sales/pricing";
import { createProduct, deleteProduct, updateProduct } from "@/actions/products";
import { useStore } from "@/components/providers/store-provider";
import { Button } from "@/components/ui/button";
import { FieldError, FieldHint, Input, Label, MoneyInput, NativeSelect, Textarea } from "@/components/ui/input";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { ProductTile } from "@/components/shared/product-tile";
import { Tooltip } from "@/components/ui/popover";

export interface ProductFormValues {
  id?: string;
  name: string;
  sku: string;
  barcode: string;
  description: string;
  imageUrl: string;
  categoryId: string;
  supplier: string;
  costPrice: string;
  price: string;
  discountPrice: string;
  stock: string;
  minStock: string;
  taxRatePct: string;
  unit: string;
  status: "active" | "draft" | "archived";
}

export const EMPTY_PRODUCT: ProductFormValues = {
  name: "", sku: "", barcode: "", description: "", imageUrl: "", categoryId: "",
  supplier: "", costPrice: "", price: "", discountPrice: "", stock: "0",
  minStock: "5", taxRatePct: "0", unit: "unit", status: "active",
};

export function ProductForm({
  initial,
  categories,
  hasSalesHistory,
  defaultTaxRatePct,
}: {
  initial: ProductFormValues;
  categories: { id: string; name: string }[];
  hasSalesHistory?: boolean;
  defaultTaxRatePct?: number;
}) {
  const router = useRouter();
  const { currency } = useStore();
  const symbol = currencyMeta(currency).symbol;

  const isEdit = Boolean(initial.id);
  const [values, setValues] = React.useState<ProductFormValues>({
    ...initial,
    taxRatePct: initial.taxRatePct || String(defaultTaxRatePct ?? 0),
  });
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [pending, setPending] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);

  const set = <K extends keyof ProductFormValues>(key: K, value: ProductFormValues[K]) => {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => (e[key as string] ? { ...e, [key as string]: "" } : e));
  };

  /* Live unit economics - the whole point of entering both prices. */
  const cost = parseMoney(values.costPrice || "0", currency) ?? 0;
  const price = parseMoney(values.price || "0", currency) ?? 0;
  const discount = values.discountPrice ? parseMoney(values.discountPrice, currency) : null;
  const econ = unitEconomics(price, cost, discount);
  const stockNum = Number(values.stock) || 0;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPending(true);
    setErrors({});

    const payload = {
      name: values.name,
      sku: values.sku,
      barcode: values.barcode || undefined,
      description: values.description || undefined,
      images: values.imageUrl ? [values.imageUrl] : [],
      categoryId: values.categoryId || null,
      supplier: values.supplier || undefined,
      costPrice: values.costPrice || "0",
      price: values.price || "0",
      discountPrice: values.discountPrice || "",
      stock: values.stock || "0",
      minStock: values.minStock || "0",
      taxRatePct: values.taxRatePct || "0",
      unit: values.unit || "unit",
      status: values.status,
    };

    const res = isEdit ? await updateProduct(initial.id!, payload) : await createProduct(payload);
    setPending(false);

    if (!res.ok) {
      setErrors(res.fields ?? {});
      toast.error(res.error);
      return;
    }

    toast.success(isEdit ? "Product updated" : `${values.name} added to your catalogue`);
    router.push(`/products/${res.data.id}`);
    router.refresh();
  };

  return (
    <form onSubmit={submit} className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.75fr)_minmax(0,1fr)] gap-4 items-start">
      <div className="space-y-4">
        {/* ------------------------------------------------------ details */}
        <Panel>
          <PanelHeader title="Product details" />
          <div className="p-4 sm:p-5 space-y-4">
            <div>
              <Label htmlFor="name" required>Name</Label>
              <Input
                id="name"
                value={values.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="Wireless earbuds"
                required
                aria-invalid={Boolean(errors.name)}
              />
              <FieldError>{errors.name}</FieldError>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="sku" required>SKU</Label>
                <Input
                  id="sku"
                  value={values.sku}
                  onChange={(e) => set("sku", e.target.value.toUpperCase())}
                  placeholder="EAR-001"
                  required
                  className="font-mono"
                  aria-invalid={Boolean(errors.sku)}
                />
                <FieldError>{errors.sku}</FieldError>
                <FieldHint>Unique within this store.</FieldHint>
              </div>
              <div>
                <Label htmlFor="barcode">Barcode</Label>
                <Input
                  id="barcode"
                  value={values.barcode}
                  onChange={(e) => set("barcode", e.target.value)}
                  placeholder="5012345678900"
                  className="font-mono"
                />
                <FieldHint>Scanning this at the till finds the product instantly.</FieldHint>
              </div>
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={values.description}
                onChange={(e) => set("description", e.target.value)}
                rows={3}
                placeholder="What is it, and what makes it worth buying?"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="categoryId">Category</Label>
                <NativeSelect
                  id="categoryId"
                  value={values.categoryId}
                  onChange={(e) => set("categoryId", e.target.value)}
                >
                  <option value="">No category</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </NativeSelect>
              </div>
              <div>
                <Label htmlFor="supplier">Supplier</Label>
                <Input
                  id="supplier"
                  value={values.supplier}
                  onChange={(e) => set("supplier", e.target.value)}
                  placeholder="Baytree Wholesale"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="imageUrl">Image URL</Label>
              <Input
                id="imageUrl"
                type="url"
                value={values.imageUrl}
                onChange={(e) => set("imageUrl", e.target.value)}
                placeholder="https://..."
              />
              <FieldHint>
                Paste a link to a hosted image. Without one, NexaStore draws a monogram tile in the
                product&rsquo;s own colour.
              </FieldHint>
            </div>
          </div>
        </Panel>

        {/* ------------------------------------------------------- pricing */}
        <Panel>
          <PanelHeader
            title="Pricing"
            description="Profit and margin are worked out from these figures automatically."
          />
          <div className="p-4 sm:p-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="costPrice" required>Cost price</Label>
                <MoneyInput
                  id="costPrice"
                  symbol={symbol}
                  value={values.costPrice}
                  onChange={(e) => set("costPrice", e.target.value)}
                  placeholder="0.00"
                  required
                  aria-invalid={Boolean(errors.costPrice)}
                />
                <FieldError>{errors.costPrice}</FieldError>
                <FieldHint>What you pay for it.</FieldHint>
              </div>
              <div>
                <Label htmlFor="price" required>Selling price</Label>
                <MoneyInput
                  id="price"
                  symbol={symbol}
                  value={values.price}
                  onChange={(e) => set("price", e.target.value)}
                  placeholder="0.00"
                  required
                  aria-invalid={Boolean(errors.price)}
                />
                <FieldError>{errors.price}</FieldError>
                <FieldHint>Before any discount.</FieldHint>
              </div>
              <div>
                <Label htmlFor="discountPrice">Promotional price</Label>
                <MoneyInput
                  id="discountPrice"
                  symbol={symbol}
                  value={values.discountPrice}
                  onChange={(e) => set("discountPrice", e.target.value)}
                  placeholder="Optional"
                  aria-invalid={Boolean(errors.discountPrice)}
                />
                <FieldError>{errors.discountPrice}</FieldError>
                <FieldHint>Charged instead of the selling price.</FieldHint>
              </div>
            </div>

            <div>
              <Label htmlFor="taxRatePct">
                Tax rate
                <Tooltip content="Applied on top of the price at the till. Tax is collected for the tax authority and never counted as revenue.">
                  <span className="inline-block align-middle ml-1 text-[var(--ink-3)]">
                    <Info className="size-3.5" />
                  </span>
                </Tooltip>
              </Label>
              <div className="relative w-full sm:w-[180px]">
                <Input
                  id="taxRatePct"
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={values.taxRatePct}
                  onChange={(e) => set("taxRatePct", e.target.value)}
                  className="tnum pr-7"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[13px] text-[var(--ink-3)]">%</span>
              </div>
            </div>
          </div>
        </Panel>

        {/* --------------------------------------------------------- stock */}
        <Panel>
          <PanelHeader
            title="Inventory"
            description={
              isEdit
                ? "Changing the stock figure here records an adjustment in the inventory ledger."
                : "Opening stock is logged as the product's first inventory movement."
            }
          />
          <div className="p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="stock">Stock on hand</Label>
              <Input
                id="stock"
                type="number"
                min="0"
                value={values.stock}
                onChange={(e) => set("stock", e.target.value)}
                className="tnum"
                aria-invalid={Boolean(errors.stock)}
              />
              <FieldError>{errors.stock}</FieldError>
            </div>
            <div>
              <Label htmlFor="minStock">Reorder point</Label>
              <Input
                id="minStock"
                type="number"
                min="0"
                value={values.minStock}
                onChange={(e) => set("minStock", e.target.value)}
                className="tnum"
              />
              <FieldHint>Warn me at or below this.</FieldHint>
            </div>
            <div>
              <Label htmlFor="unit">Unit</Label>
              <Input
                id="unit"
                value={values.unit}
                onChange={(e) => set("unit", e.target.value)}
                placeholder="unit"
              />
              <FieldHint>unit, kg, litre, box...</FieldHint>
            </div>
          </div>
        </Panel>
      </div>

      {/* ------------------------------------------------------- side rail */}
      <div className="space-y-4 lg:sticky lg:top-[4.5rem]">
        <Panel>
          <PanelHeader title="Preview" />
          <div className="p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <ProductTile
                name={values.name || "New product"}
                sku={values.sku}
                image={values.imageUrl || undefined}
                size={46}
              />
              <div className="min-w-0">
                <p className="text-[14px] font-medium text-ink truncate">
                  {values.name || "Untitled product"}
                </p>
                <p className="text-[11.5px] text-ink-3 font-mono mt-0.5">{values.sku || "NO-SKU"}</p>
                <p className="text-[15px] font-semibold text-ink tnum mt-1.5">
                  {formatMoney(econ.effectivePrice, currency)}
                  {econ.isDiscounted ? (
                    <span className="text-[12px] text-ink-3 line-through ml-2 font-normal">
                      {formatMoney(price, currency)}
                    </span>
                  ) : null}
                </p>
              </div>
            </div>
          </div>
        </Panel>

        <Panel>
          <PanelHeader title="Unit economics" description="Recalculated as you type" />
          <div className="p-4 sm:p-5 space-y-2.5">
            <EconRow label="Profit per unit" value={formatMoney(econ.profitPerUnit, currency)}
              tone={econ.profitPerUnit < 0 ? "bad" : econ.profitPerUnit > 0 ? "good" : "flat"} />
            <EconRow label="Profit margin" value={`${econ.marginPct.toFixed(1)}%`}
              tone={econ.marginPct < 0 ? "bad" : econ.marginPct >= 25 ? "good" : "flat"} />
            <EconRow label="Markup on cost" value={`${econ.markupPct.toFixed(1)}%`} />
            <div className="pt-2.5 mt-1 border-t border-[var(--line)] space-y-2.5">
              <EconRow label="Stock value at cost" value={formatMoney(cost * stockNum, currency)} />
              <EconRow label="Stock value at retail" value={formatMoney(econ.effectivePrice * stockNum, currency)} />
            </div>

            {econ.profitPerUnit < 0 && price > 0 ? (
              <p className="text-[12px] text-[var(--neg)] leading-relaxed pt-2 border-t border-[var(--line)]">
                This product would lose money on every sale. Check the cost and selling prices.
              </p>
            ) : null}
          </div>
        </Panel>

        <Panel>
          <PanelHeader title="Availability" />
          <div className="p-4 sm:p-5">
            <Label htmlFor="status">Status</Label>
            <NativeSelect
              id="status"
              value={values.status}
              onChange={(e) => set("status", e.target.value as ProductFormValues["status"])}
            >
              <option value="active">Active - can be sold</option>
              <option value="draft">Draft - hidden from the till</option>
              <option value="archived">Archived - no longer stocked</option>
            </NativeSelect>
          </div>
        </Panel>

        <div className="flex flex-col gap-2">
          <Button type="submit" variant="primary" size="md" loading={pending} className="w-full">
            <Save />
            {isEdit ? "Save changes" : "Add product"}
          </Button>
          <Button asChild variant="ghost" size="md" className="w-full">
            <Link href={initial.id ? `/products/${initial.id}` : "/products"}>
              <ArrowLeft />
              Cancel
            </Link>
          </Button>

          {isEdit ? (
            <Button
              type="button"
              variant="dangerGhost"
              size="sm"
              className="w-full mt-2"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 />
              {hasSalesHistory ? "Archive product" : "Delete product"}
            </Button>
          ) : null}
        </div>
      </div>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={hasSalesHistory ? `Archive ${values.name}?` : `Delete ${values.name}?`}
        description={
          hasSalesHistory
            ? "This product has been sold, so it is archived rather than deleted - removing it would rewrite past orders and change revenue that has already been reported. It disappears from the till and stays in your history."
            : "This product has never been sold, so it can be removed completely along with its inventory history. This cannot be undone."
        }
        confirmLabel={hasSalesHistory ? "Archive it" : "Delete permanently"}
        destructive
        loading={pending}
        onConfirm={async () => {
          setPending(true);
          const res = await deleteProduct(initial.id!);
          setPending(false);
          if (res.ok) {
            toast.success(res.data.archived ? "Product archived" : "Product deleted");
            router.push("/products");
            router.refresh();
          } else {
            toast.error(res.error);
          }
        }}
      />
    </form>
  );
}

function EconRow({
  label, value, tone = "flat",
}: {
  label: string;
  value: string;
  tone?: "good" | "bad" | "flat";
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-[12.5px] text-ink-3">{label}</span>
      <span
        className={cn(
          "text-[13px] font-semibold tnum",
          tone === "good" ? "text-[var(--pos)]" : tone === "bad" ? "text-[var(--neg)]" : "text-ink",
        )}
      >
        {value}
      </span>
    </div>
  );
}
