"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Banknote, Check, CreditCard, Landmark, Minus, Plus,
  Search, ShoppingCart, Smartphone, Trash2, Wallet, X,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { computeSaleTotals, type TaxMode } from "@/lib/sales/pricing";
import { currencyMeta, formatMoney, parseMoney } from "@/lib/format/currency";
import type { PaymentMethod } from "@/lib/db/models/enums";
import { createSale } from "@/actions/sales";
import { useStore } from "@/components/providers/store-provider";
import { Button } from "@/components/ui/button";
import { Input, MoneyInput, NativeSelect } from "@/components/ui/input";
import { ProductTile } from "@/components/shared/product-tile";
import { EmptySearchMark } from "@/components/ui/empty-state";
import { SaleSuccess } from "./sale-success";

export interface PosProduct {
  id: string;
  name: string;
  sku: string;
  barcode?: string;
  price: number;
  listPrice: number;
  stock: number;
  categoryId: string | null;
  image?: string;
  taxRateBps: number;
  unit: string;
}

export interface PosCustomer {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  totalOrders: number;
}

interface CartLine {
  productId: string;
  quantity: number;
  lineDiscount: number;
}

const METHODS: { value: PaymentMethod; label: string; icon: React.ComponentType<{ className?: string }>; key: string }[] = [
  { value: "cash", label: "Cash", icon: Banknote, key: "1" },
  { value: "card", label: "Card", icon: CreditCard, key: "2" },
  { value: "bank_transfer", label: "Transfer", icon: Landmark, key: "3" },
  { value: "mobile", label: "Mobile", icon: Smartphone, key: "4" },
  { value: "other", label: "Other", icon: Wallet, key: "5" },
];

export function PosTerminal({
  products,
  categories,
  customers,
  taxMode,
}: {
  products: PosProduct[];
  categories: { id: string; name: string }[];
  customers: PosCustomer[];
  taxMode: TaxMode;
}) {
  const { currency } = useStore();
  const symbol = currencyMeta(currency).symbol;
  const router = useRouter();

  const [query, setQuery] = React.useState("");
  const [category, setCategory] = React.useState<string>("all");
  const [cart, setCart] = React.useState<CartLine[]>([]);
  const [customerId, setCustomerId] = React.useState<string>("");
  const [method, setMethod] = React.useState<PaymentMethod>("cash");
  const [discountInput, setDiscountInput] = React.useState("");
  const [tenderedInput, setTenderedInput] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [highlight, setHighlight] = React.useState(0);
  const [cartOpen, setCartOpen] = React.useState(false);
  const [completed, setCompleted] = React.useState<{
    orderNumber: string; total: number; change: number; itemCount: number; id: string;
  } | null>(null);

  const searchRef = React.useRef<HTMLInputElement>(null);
  const byId = React.useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  /* ---------------------------------------------------------- filtering */

  const results = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = products;
    if (category !== "all") list = list.filter((p) => p.categoryId === category);
    if (q) {
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          p.barcode?.toLowerCase().includes(q),
      );
      // Exact SKU or barcode first - that is a scanner, and it should win.
      list = [...list].sort((a, b) => {
        const aExact = a.sku.toLowerCase() === q || a.barcode?.toLowerCase() === q ? 0 : 1;
        const bExact = b.sku.toLowerCase() === q || b.barcode?.toLowerCase() === q ? 0 : 1;
        if (aExact !== bExact) return aExact - bExact;
        return a.name.localeCompare(b.name);
      });
    }
    return list.slice(0, 60);
  }, [products, query, category]);

  // A new query means a new result list, so the keyboard cursor goes back to
  // the top. Derived during render so the first keystroke after typing never
  // lands on a stale row.
  const [lastQueryKey, setLastQueryKey] = React.useState(`${query}|${category}`);
  const queryKey = `${query}|${category}`;
  if (queryKey !== lastQueryKey) {
    setLastQueryKey(queryKey);
    setHighlight(0);
  }

  /* -------------------------------------------------------------- cart */

  const addToCart = React.useCallback(
    (productId: string, qty = 1) => {
      const product = byId.get(productId);
      if (!product) return;

      setCart((prev) => {
        const existing = prev.find((l) => l.productId === productId);
        const nextQty = (existing?.quantity ?? 0) + qty;

        if (nextQty > product.stock) {
          toast.error(
            product.stock <= 0
              ? `${product.name} is out of stock`
              : `Only ${product.stock} of ${product.name} left`,
          );
          return prev;
        }
        if (existing) {
          return prev.map((l) => (l.productId === productId ? { ...l, quantity: nextQty } : l));
        }
        return [...prev, { productId, quantity: qty, lineDiscount: 0 }];
      });
    },
    [byId],
  );

  const setQuantity = (productId: string, qty: number) => {
    const product = byId.get(productId);
    if (!product) return;
    if (qty <= 0) {
      setCart((prev) => prev.filter((l) => l.productId !== productId));
      return;
    }
    if (qty > product.stock) {
      toast.error(`Only ${product.stock} of ${product.name} in stock`);
      return;
    }
    setCart((prev) => prev.map((l) => (l.productId === productId ? { ...l, quantity: qty } : l)));
  };

  const clearCart = () => {
    setCart([]);
    setDiscountInput("");
    setTenderedInput("");
    setCustomerId("");
  };

  /* ------------------------------------------------------------ totals */

  const orderDiscount = React.useMemo(
    () => Math.max(0, parseMoney(discountInput || "0", currency) ?? 0),
    [discountInput, currency],
  );

  // Priced with the very same function the server uses. The server still
  // recomputes from its own prices on submit - this is a preview, not a claim.
  const totals = React.useMemo(
    () =>
      computeSaleTotals(
        cart.map((l) => {
          const p = byId.get(l.productId)!;
          return {
            productId: l.productId,
            quantity: l.quantity,
            unitPrice: p.price,
            unitCost: 0,
            lineDiscount: l.lineDiscount,
            taxRateBps: p.taxRateBps,
          };
        }),
        { orderDiscount, taxMode },
      ),
    [cart, byId, orderDiscount, taxMode],
  );

  const tendered = parseMoney(tenderedInput || "0", currency) ?? 0;
  const change = method === "cash" && tendered > 0 ? Math.max(0, tendered - totals.total) : 0;
  const short = method === "cash" && tendered > 0 && tendered < totals.total;

  /* ------------------------------------------------------------ submit */

  const complete = React.useCallback(async () => {
    if (cart.length === 0 || pending) return;
    setPending(true);

    const res = await createSale({
      items: cart.map((l) => ({
        productId: l.productId,
        quantity: l.quantity,
        lineDiscount: l.lineDiscount,
      })),
      customerId: customerId || null,
      orderDiscount,
      paymentMethod: method,
      status: "completed",
      amountPaid: method === "cash" && tendered > 0 ? tendered : 0,
    });

    setPending(false);

    if (!res.ok) {
      toast.error(res.error);
      return;
    }

    setCompleted({
      id: res.data.id,
      orderNumber: res.data.orderNumber,
      total: res.data.total,
      change: res.data.changeGiven,
      itemCount: res.data.itemCount,
    });
    clearCart();
    setCartOpen(false);

    if (res.data.lowStock.length > 0) {
      const names = res.data.lowStock.map((p) => p.name).join(", ");
      toast.warning("Running low after this sale", { description: names, duration: 6000 });
    }
    router.refresh();
  }, [cart, pending, customerId, orderDiscount, method, tendered, router]);

  /* --------------------------------------------------------- shortcuts */

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (completed) return;
      const el = document.activeElement;
      const inSearch = el === searchRef.current;
      const typingElsewhere =
        !inSearch &&
        (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement);

      // F9 completes from anywhere - the till operator never has to reach for
      // the mouse to take money.
      if (e.key === "F9") {
        e.preventDefault();
        void complete();
        return;
      }
      if (e.key === "F2") {
        e.preventDefault();
        document.getElementById("pos-discount")?.focus();
        return;
      }
      if (e.key === "Escape" && !typingElsewhere) {
        if (query) setQuery("");
        else searchRef.current?.blur();
        return;
      }

      if (typingElsewhere) return;

      if (inSearch) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setHighlight((h) => Math.min(h + 1, results.length - 1));
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          setHighlight((h) => Math.max(h - 1, 0));
        } else if (e.key === "Enter") {
          e.preventDefault();
          const target = results[highlight];
          if (target) {
            addToCart(target.id);
            setQuery("");
          }
        }
        return;
      }

      // Bare "/" jumps to search, as it does everywhere else in the app.
      if (e.key === "/") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [results, highlight, addToCart, complete, query, completed]);

  React.useEffect(() => {
    if (!completed) searchRef.current?.focus();
  }, [completed]);

  /* ------------------------------------------------------------ render */

  if (completed) {
    return (
      <SaleSuccess
        {...completed}
        onNewSale={() => {
          setCompleted(null);
          setTimeout(() => searchRef.current?.focus(), 50);
        }}
      />
    );
  }

  const cartCount = cart.reduce((a, l) => a + l.quantity, 0);

  return (
    <div className="lg:h-[calc(100dvh-3.5rem)] flex flex-col lg:flex-row">
      {/* ----------------------------------------------------- catalogue */}
      <section className="flex-1 min-w-0 flex flex-col lg:overflow-hidden" aria-label="Product catalogue">
        <div className="px-4 sm:px-6 pt-5 pb-3 shrink-0">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div>
              <h1 className="text-[20px] font-semibold text-ink tracking-[-0.025em]">New sale</h1>
              <p className="text-[12.5px] text-ink-3 mt-0.5">
                Scan or search, then press{" "}
                <Kbd>Enter</Kbd> to add. <Kbd>F9</Kbd> completes the sale.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[var(--ink-3)] pointer-events-none" aria-hidden />
              <Input
                ref={searchRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Scan a barcode, or search by name or SKU"
                aria-label="Search products"
                autoComplete="off"
                className="pl-9 h-11 text-[14px]"
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--ink-3)] hover:text-ink-2"
                  aria-label="Clear search"
                >
                  <X className="size-4" />
                </button>
              ) : null}
            </div>

            <NativeSelect
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              aria-label="Filter by category"
              className="h-11 w-auto min-w-[130px] text-[13.5px]"
            >
              <option value="all">All categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </NativeSelect>
          </div>
        </div>

        <div className="flex-1 lg:overflow-y-auto px-4 sm:px-6 pb-[calc(78px+env(safe-area-inset-bottom))] lg:pb-6">
          {results.length === 0 ? (
            <div className="flex flex-col items-center text-center py-16">
              <div className="size-10 text-[var(--ink-3)] mb-3">
                <EmptySearchMark />
              </div>
              <p className="text-[13.5px] font-medium text-ink">No products match</p>
              <p className="text-[12.5px] text-ink-3 mt-1 max-w-[34ch]">
                Try a different search, or{" "}
                <Link href="/products/new" className="text-[var(--accent-ink)] hover:underline">
                  add a new product
                </Link>
                .
              </p>
            </div>
          ) : (
            <ul
              className="grid gap-2 grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5"
              role="listbox"
              aria-label="Products"
            >
              {results.map((p, i) => {
                const inCart = cart.find((l) => l.productId === p.id)?.quantity ?? 0;
                const out = p.stock <= 0;
                const isHighlighted = i === highlight && query.length > 0;

                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => addToCart(p.id)}
                      disabled={out}
                      aria-selected={isHighlighted}
                      role="option"
                      className={cn(
                        "group relative w-full text-left rounded-[9px] border p-2.5 transition-all",
                        "min-h-[92px] flex flex-col justify-between",
                        out
                          ? "border-[var(--line)] bg-[var(--surface-2)] opacity-55 cursor-not-allowed"
                          : "border-[var(--line)] bg-[var(--surface)] hover:border-[var(--accent)] hover:shadow-card active:scale-[0.985]",
                        isHighlighted && "border-[var(--accent)] ring-2 ring-[var(--accent)]/20",
                      )}
                    >
                      <div className="flex items-start gap-2">
                        <ProductTile name={p.name} sku={p.sku} image={p.image} size={30} />
                        <span className="min-w-0 flex-1">
                          <span className="block text-[12.5px] font-medium text-ink leading-snug line-clamp-2">
                            {p.name}
                          </span>
                        </span>
                        {inCart > 0 ? (
                          <span className="absolute -top-1.5 -right-1.5 min-w-[19px] h-[19px] px-1 grid place-items-center rounded-full bg-[var(--accent)] text-[var(--accent-fg)] text-[10.5px] font-bold tabular-nums shadow-card">
                            {inCart}
                          </span>
                        ) : null}
                      </div>

                      <div className="flex items-end justify-between gap-2 mt-2">
                        <span className="text-[13px] font-semibold text-ink tnum">
                          {formatMoney(p.price, currency)}
                        </span>
                        <span
                          className={cn(
                            "text-[10.5px] tnum",
                            out ? "text-[var(--neg)]" : p.stock <= 5 ? "text-[#8a5d00] dark:text-[var(--st-warn)]" : "text-ink-3",
                          )}
                        >
                          {out ? "Out of stock" : `${p.stock} left`}
                        </span>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      {/* ---------------------------------------------------------- cart */}
      <aside
        className={cn(
          "lg:w-[380px] xl:w-[420px] shrink-0 bg-[var(--surface)] border-[var(--line)] flex flex-col",
          "lg:border-l lg:h-full",
          // On phones the cart is a sheet raised from the bottom bar.
          "fixed lg:static inset-x-0 bottom-0 z-40 lg:z-auto border-t lg:border-t-0 shadow-pop lg:shadow-none",
          "transition-transform duration-250 ease-out lg:transition-none",
          cartOpen
            ? "translate-y-0 h-[85dvh] rounded-t-[16px]"
            : "translate-y-[calc(100%-var(--pos-peek))] h-[85dvh] lg:translate-y-0 lg:h-full lg:rounded-none",
        )}
        style={{ ["--pos-peek" as string]: "calc(62px + env(safe-area-inset-bottom))" }}
      >
        {/* Mobile handle */}
        <button
          type="button"
          onClick={() => setCartOpen((o) => !o)}
          className="lg:hidden flex items-center justify-between gap-3 px-4 min-h-[62px] shrink-0 w-full text-left"
          aria-expanded={cartOpen}
        >
          <span className="flex items-center gap-2">
            <span className="relative">
              <ShoppingCart className="size-5 text-ink-2" />
              {cartCount > 0 ? (
                <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 grid place-items-center rounded-full bg-[var(--accent)] text-[var(--accent-fg)] text-[10px] font-bold tabular-nums">
                  {cartCount}
                </span>
              ) : null}
            </span>
            <span className="text-[13.5px] font-medium text-ink">
              {cartCount === 0 ? "Cart is empty" : `${cartCount} item${cartCount === 1 ? "" : "s"}`}
            </span>
          </span>
          <span className="text-[17px] font-semibold text-ink tnum">
            {formatMoney(totals.total, currency)}
          </span>
        </button>

        <div className="hidden lg:flex items-center justify-between gap-3 px-5 h-14 border-b border-[var(--line)] shrink-0">
          <h2 className="text-[13.5px] font-semibold text-ink flex items-center gap-2">
            <ShoppingCart className="size-4 text-[var(--ink-3)]" />
            Current sale
            {cartCount > 0 ? <span className="text-ink-3 font-normal">{cartCount}</span> : null}
          </h2>
          {cart.length > 0 ? (
            <Button variant="ghost" size="xs" onClick={clearCart}>
              <Trash2 />
              Clear
            </Button>
          ) : null}
        </div>

        {/* Lines */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center h-full py-12 px-6">
              <ShoppingCart className="size-8 text-[var(--ink-3)] mb-3" strokeWidth={1.25} />
              <p className="text-[13.5px] font-medium text-ink">Nothing scanned yet</p>
              <p className="text-[12.5px] text-ink-3 mt-1.5 max-w-[30ch] leading-relaxed">
                Search or scan a product to start the sale. Everything totals up here as you go.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-[var(--line)]">
              {cart.map((line) => {
                const p = byId.get(line.productId);
                if (!p) return null;
                return (
                  <li key={line.productId} className="flex items-start gap-2.5 px-4 sm:px-5 py-2.5">
                    <ProductTile name={p.name} sku={p.sku} image={p.image} size={32} />

                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-medium text-ink leading-snug line-clamp-2">{p.name}</p>
                      <p className="text-[11.5px] text-ink-3 tnum mt-0.5">
                        {formatMoney(p.price, currency)} each
                      </p>

                      <div className="flex items-center gap-1 mt-1.5">
                        <button
                          type="button"
                          onClick={() => setQuantity(line.productId, line.quantity - 1)}
                          className="size-6 grid place-items-center rounded-[5px] border border-[var(--line-strong)] text-ink-2 hover:bg-[var(--surface-2)] transition-colors"
                          aria-label={`Decrease ${p.name}`}
                        >
                          <Minus className="size-3" />
                        </button>
                        <input
                          type="number"
                          value={line.quantity}
                          min={1}
                          max={p.stock}
                          onChange={(e) => setQuantity(line.productId, Number(e.target.value))}
                          className="w-11 h-6 text-center text-[12.5px] font-medium text-ink tnum bg-transparent border border-[var(--line)] rounded-[5px] focus:outline-none focus:border-[var(--accent)]"
                          aria-label={`Quantity of ${p.name}`}
                        />
                        <button
                          type="button"
                          onClick={() => setQuantity(line.productId, line.quantity + 1)}
                          disabled={line.quantity >= p.stock}
                          className="size-6 grid place-items-center rounded-[5px] border border-[var(--line-strong)] text-ink-2 hover:bg-[var(--surface-2)] transition-colors disabled:opacity-40"
                          aria-label={`Increase ${p.name}`}
                        >
                          <Plus className="size-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setQuantity(line.productId, 0)}
                          className="size-6 grid place-items-center rounded-[5px] text-[var(--ink-3)] hover:text-[var(--neg)] hover:bg-[var(--neg-soft)] transition-colors ml-0.5"
                          aria-label={`Remove ${p.name}`}
                        >
                          <Trash2 className="size-3" />
                        </button>
                      </div>
                    </div>

                    <p className="text-[13px] font-semibold text-ink tnum shrink-0 pt-0.5">
                      {formatMoney(p.price * line.quantity, currency)}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Checkout */}
        <div className="shrink-0 border-t border-[var(--line)] bg-[var(--inset)]">
          <div className="px-4 sm:px-5 py-3 space-y-2.5">
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="text-[11px] text-ink-3 block mb-1">Customer</span>
                <NativeSelect
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                  className="h-8 text-[12.5px]"
                  aria-label="Attach a customer"
                >
                  <option value="">Walk-in</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </NativeSelect>
              </label>

              <label className="block">
                <span className="text-[11px] text-ink-3 mb-1 flex items-center gap-1">
                  Discount <Kbd small>F2</Kbd>
                </span>
                <MoneyInput
                  id="pos-discount"
                  symbol={symbol}
                  value={discountInput}
                  onChange={(e) => setDiscountInput(e.target.value)}
                  placeholder="0.00"
                  className="h-8 text-[12.5px]"
                  aria-label="Order discount"
                />
              </label>
            </div>

            <div>
              <span className="text-[11px] text-ink-3 block mb-1">Payment method</span>
              <div className="grid grid-cols-5 gap-1" role="radiogroup" aria-label="Payment method">
                {METHODS.map((m) => (
                  <button
                    key={m.value}
                    type="button"
                    role="radio"
                    aria-checked={method === m.value}
                    onClick={() => setMethod(m.value)}
                    className={cn(
                      "flex flex-col items-center gap-1 rounded-[7px] border py-1.5 transition-all",
                      method === m.value
                        ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-ink)]"
                        : "border-[var(--line)] bg-[var(--surface)] text-ink-3 hover:border-[var(--line-strong)]",
                    )}
                  >
                    <m.icon className="size-3.5" />
                    <span className="text-[10px] font-medium">{m.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {method === "cash" && cart.length > 0 ? (
              <div className="grid grid-cols-2 gap-2 items-end">
                <label className="block">
                  <span className="text-[11px] text-ink-3 block mb-1">Cash tendered</span>
                  <MoneyInput
                    symbol={symbol}
                    value={tenderedInput}
                    onChange={(e) => setTenderedInput(e.target.value)}
                    placeholder={formatMoney(totals.total, currency)}
                    className="h-8 text-[12.5px]"
                    aria-label="Cash tendered"
                    aria-invalid={short}
                  />
                </label>
                <div className="text-right pb-1">
                  <span className="text-[11px] text-ink-3 block">Change</span>
                  <span
                    className={cn(
                      "text-[15px] font-semibold tnum",
                      short ? "text-[var(--neg)]" : "text-ink",
                    )}
                  >
                    {short ? "Short" : formatMoney(change, currency)}
                  </span>
                </div>
              </div>
            ) : null}
          </div>

          <div className="px-4 sm:px-5 pb-3 pt-1 space-y-1">
            <Row label="Subtotal" value={formatMoney(totals.grossAmount, currency)} />
            {totals.discountTotal > 0 ? (
              <Row label="Discount" value={`-${formatMoney(totals.discountTotal, currency)}`} negative />
            ) : null}
            {totals.taxTotal > 0 ? (
              <Row label="Tax" value={formatMoney(totals.taxTotal, currency)} />
            ) : null}
            <div className="flex items-baseline justify-between gap-3 pt-2 mt-1 border-t border-[var(--line)]">
              <span className="text-[13.5px] font-semibold text-ink">Total</span>
              <span className="text-[22px] font-semibold text-ink tnum num-hero">
                {formatMoney(totals.total, currency)}
              </span>
            </div>
          </div>

          <div className="px-4 sm:px-5 pb-[max(0.875rem,env(safe-area-inset-bottom))] lg:pb-4">
            <Button
              variant="primary"
              size="lg"
              className="w-full"
              disabled={cart.length === 0 || short}
              loading={pending}
              onClick={complete}
            >
              <Check />
              Complete sale
              <Kbd small className="ml-1 opacity-70">F9</Kbd>
            </Button>
          </div>
        </div>
      </aside>
    </div>
  );
}

function Row({ label, value, negative }: { label: string; value: string; negative?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-[12px] text-ink-3">{label}</span>
      <span className={cn("text-[12.5px] tnum", negative ? "text-[var(--neg)]" : "text-ink-2")}>{value}</span>
    </div>
  );
}

function Kbd({
  children, small, className,
}: {
  children: React.ReactNode;
  small?: boolean;
  className?: string;
}) {
  return (
    <kbd
      className={cn(
        "inline-grid place-items-center rounded-[4px] border border-current/25 font-mono",
        small ? "px-1 py-px text-[9.5px]" : "px-1 py-px text-[10.5px]",
        className,
      )}
    >
      {children}
    </kbd>
  );
}
