"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, ArrowRight, Check, Coffee, Gem, Laptop, Package, PartyPopper,
  Pill, ShoppingBasket, Shirt, Sparkles, Store as StoreIcon, Utensils, Wrench,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { createStore, completeOnboarding, setOnboardingStep } from "@/actions/store";
import { createProduct } from "@/actions/products";
import { createSale } from "@/actions/sales";
import { loadDemoData } from "@/actions/demo";
import { Button } from "@/components/ui/button";
import { FieldError, FieldHint, Input, Label, MoneyInput, NativeSelect } from "@/components/ui/input";
import { Wordmark } from "@/components/layout/logo";
import { formatMoney } from "@/lib/format/currency";

const BUSINESS_TYPES = [
  { value: "retail", label: "General retail", icon: StoreIcon },
  { value: "electronics", label: "Electronics", icon: Laptop },
  { value: "fashion", label: "Fashion", icon: Shirt },
  { value: "grocery", label: "Grocery", icon: ShoppingBasket },
  { value: "cafe", label: "Cafe", icon: Coffee },
  { value: "restaurant", label: "Restaurant", icon: Utensils },
  { value: "pharmacy", label: "Pharmacy", icon: Pill },
  { value: "beauty", label: "Beauty", icon: Gem },
  { value: "hardware", label: "Hardware", icon: Wrench },
  { value: "other", label: "Something else", icon: Package },
] as const;

const STEPS = [
  { id: 0, title: "Welcome", blurb: "What NexaStore does" },
  { id: 1, title: "Your store", blurb: "Name and trade" },
  { id: 2, title: "Money and time", blurb: "Currency and timezone" },
  { id: 3, title: "First product", blurb: "Something to sell" },
  { id: 4, title: "First sale", blurb: "See the numbers move" },
  { id: 5, title: "Ready", blurb: "Open the dashboard" },
];

interface Existing {
  storeId: string;
  storeName: string;
  currency: string;
  productCount: number;
  saleCount: number;
  step: number;
  categories: { id: string; name: string }[];
}

export function OnboardingWizard({
  userName,
  existing,
  currencies,
  timezones,
}: {
  userName: string;
  existing: Existing | null;
  currencies: { code: string; name: string; symbol: string }[];
  timezones: string[];
}) {
  const router = useRouter();
  const [step, setStep] = React.useState(existing ? Math.max(3, existing.step) : 0);
  const [pending, setPending] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  const [storeName, setStoreName] = React.useState(existing?.storeName ?? "");
  const [businessType, setBusinessType] = React.useState<string>("retail");
  const [currency, setCurrency] = React.useState(existing?.currency ?? "USD");
  // Guessed once from the browser at mount. The user can still change it.
  const [timezone, setTimezone] = React.useState(() => {
    if (existing) return "UTC";
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    } catch {
      return "UTC";
    }
  });

  const categories = existing?.categories ?? [];
  const [firstProduct, setFirstProduct] = React.useState<{ id: string; name: string; price: number } | null>(null);
  const [saleResult, setSaleResult] = React.useState<{ orderNumber: string; total: number } | null>(null);

  const symbol = currencies.find((c) => c.code === currency)?.symbol ?? "$";

  const go = (next: number) => {
    setErrors({});
    setStep(next);
    if (existing) void setOnboardingStep(next);
  };

  /* ------------------------------------------------------------- actions */

  const submitStore = async () => {
    setPending(true);
    setErrors({});
    const res = await createStore({ name: storeName, currency, timezone, businessType });
    setPending(false);
    if (!res.ok) {
      setErrors(res.fields ?? { name: res.error });
      toast.error(res.error);
      return;
    }
    router.refresh();
    setStep(3);
  };

  const submitProduct = async (form: FormData) => {
    setPending(true);
    setErrors({});
    const raw = {
      name: String(form.get("name") ?? ""),
      sku: String(form.get("sku") ?? ""),
      price: String(form.get("price") ?? ""),
      costPrice: String(form.get("costPrice") ?? ""),
      stock: String(form.get("stock") ?? "0"),
      categoryId: String(form.get("categoryId") ?? ""),
      minStock: "5",
      taxRatePct: "0",
      unit: "unit",
      status: "active",
      images: [] as string[],
    };
    const res = await createProduct(raw);
    setPending(false);
    if (!res.ok) {
      setErrors(res.fields ?? { name: res.error });
      toast.error(res.error);
      return;
    }
    const priceMinor = Math.round(Number(raw.price.replace(/[^0-9.]/g, "")) * 100);
    setFirstProduct({ id: res.data.id, name: raw.name, price: priceMinor });
    toast.success(`${raw.name} added to your catalogue`);
    setStep(4);
  };

  const submitSale = async (quantity: number) => {
    if (!firstProduct) return;
    setPending(true);
    const res = await createSale({
      items: [{ productId: firstProduct.id, quantity, lineDiscount: 0 }],
      paymentMethod: "cash",
      status: "completed",
      orderDiscount: 0,
      amountPaid: 0,
    });
    setPending(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setSaleResult({ orderNumber: res.data.orderNumber, total: res.data.total });
    setStep(5);
  };

  const loadSample = async () => {
    setPending(true);
    const res = await loadDemoData(12);
    setPending(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(`Loaded ${res.data.sales.toLocaleString()} sample transactions`);
    await completeOnboarding();
    router.push("/dashboard");
  };

  const finish = async () => {
    setPending(true);
    await completeOnboarding();
    router.push("/dashboard");
  };

  /* --------------------------------------------------------------- render */

  const progress = (step / (STEPS.length - 1)) * 100;

  return (
    <div className="min-h-dvh flex flex-col bg-[var(--page)]">
      <header className="flex items-center justify-between px-5 sm:px-8 h-16 shrink-0">
        <Wordmark size={24} />
        <span className="text-[12.5px] text-ink-3 tabular-nums">
          Step {Math.min(step + 1, STEPS.length)} of {STEPS.length}
        </span>
      </header>

      <div className="px-5 sm:px-8">
        <div className="h-[2px] rounded-full bg-[var(--surface-3)] overflow-hidden max-w-5xl mx-auto">
          <div
            className="h-full bg-[var(--accent)] transition-[width] duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <main id="main" className="flex-1 grid place-items-center px-5 sm:px-8 py-8">
        <div key={step} className="w-full max-w-[560px] animate-rise">
          {/* ------------------------------------------------ 0: welcome */}
          {step === 0 ? (
            <div className="text-center">
              <div className="size-12 mx-auto grid place-items-center rounded-[12px] bg-[var(--accent-soft)] border border-[var(--accent-soft-line)] mb-5">
                <Sparkles className="size-5 text-[var(--accent-ink)]" />
              </div>
              <h1 className="text-[28px] font-semibold text-ink tracking-[-0.03em] leading-tight">
                Welcome, {userName}.
              </h1>
              <p className="text-[15px] text-ink-2 mt-3 leading-relaxed max-w-[44ch] mx-auto">
                Let&rsquo;s set up your store. It takes about a minute, and by the end you will have a
                dashboard that answers the only question that really matters: how is the business doing?
              </p>

              <ul className="mt-7 space-y-2.5 text-left max-w-[400px] mx-auto">
                {[
                  "Track revenue, costs and profit as they happen",
                  "Know what is selling and what is about to run out",
                  "Ring up sales from any device, including a tablet",
                ].map((t) => (
                  <li key={t} className="flex items-start gap-2.5 text-[13.5px] text-ink-2">
                    <span className="size-4 mt-px grid place-items-center rounded-full bg-[var(--pos-soft)] shrink-0">
                      <Check className="size-2.5 text-[var(--pos)] stroke-[3]" />
                    </span>
                    {t}
                  </li>
                ))}
              </ul>

              <Button variant="primary" size="lg" className="mt-8 w-full sm:w-auto sm:px-8" onClick={() => go(1)}>
                Get started
                <ArrowRight />
              </Button>
            </div>
          ) : null}

          {/* -------------------------------------------- 1: store details */}
          {step === 1 ? (
            <div>
              <StepHeading title="What is your store called?" blurb="This is what you and your team will see across the app." />

              <div className="mt-6">
                <Label htmlFor="storeName" required>Store name</Label>
                <Input
                  id="storeName"
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  placeholder="Northline Electronics"
                  autoFocus
                  className="h-11 text-[15px]"
                  aria-invalid={Boolean(errors.name)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && storeName.trim().length >= 2) go(2);
                  }}
                />
                <FieldError>{errors.name}</FieldError>
              </div>

              <div className="mt-6">
                <Label>What do you sell?</Label>
                <FieldHint>We use this to set up sensible starting categories. You can change them later.</FieldHint>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2.5">
                  {BUSINESS_TYPES.map((t) => {
                    const active = businessType === t.value;
                    return (
                      <button
                        key={t.value}
                        type="button"
                        onClick={() => setBusinessType(t.value)}
                        aria-pressed={active}
                        className={cn(
                          "flex items-center gap-2 rounded-[8px] border px-2.5 h-11 text-[13px] text-left transition-all",
                          active
                            ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-ink)] font-medium"
                            : "border-[var(--line)] bg-[var(--surface)] text-ink-2 hover:border-[var(--line-strong)]",
                        )}
                      >
                        <t.icon className={cn("size-4 shrink-0", active ? "text-[var(--accent-ink)]" : "text-[var(--ink-3)]")} />
                        <span className="truncate">{t.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <StepNav
                onBack={() => go(0)}
                onNext={() => go(2)}
                nextDisabled={storeName.trim().length < 2}
              />
            </div>
          ) : null}

          {/* ------------------------------------------ 2: currency + zone */}
          {step === 2 ? (
            <div>
              <StepHeading
                title="Money and time"
                blurb="Every figure in NexaStore is shown in your currency, and every daily total is cut at midnight in your timezone."
              />

              <div className="mt-6 space-y-5">
                <div>
                  <Label htmlFor="currency" required>Currency</Label>
                  <NativeSelect
                    id="currency"
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="h-11 text-[14px]"
                  >
                    {currencies.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.code} - {c.name} ({c.symbol})
                      </option>
                    ))}
                  </NativeSelect>
                  <FieldHint>
                    Example: {formatMoney(2485000, currency)} - this is how prices will appear.
                  </FieldHint>
                </div>

                <div>
                  <Label htmlFor="timezone" required>Timezone</Label>
                  <NativeSelect
                    id="timezone"
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    className="h-11 text-[14px]"
                  >
                    {[...new Set([timezone, ...timezones])].map((tz) => (
                      <option key={tz} value={tz}>{tz.replace(/_/g, " ")}</option>
                    ))}
                  </NativeSelect>
                  <FieldHint>
                    Detected from your browser. &ldquo;Today&rsquo;s revenue&rdquo; will mean today where your shop is.
                  </FieldHint>
                </div>
              </div>

              <StepNav
                onBack={() => go(1)}
                onNext={submitStore}
                nextLabel="Create my store"
                loading={pending}
              />
            </div>
          ) : null}

          {/* -------------------------------------------- 3: first product */}
          {step === 3 ? (
            <div>
              <StepHeading
                title="Add your first product"
                blurb="Just one is enough to get going - you can import the rest later."
              />

              <form
                action={submitProduct}
                className="mt-6 space-y-4"
              >
                <div>
                  <Label htmlFor="p-name" required>Product name</Label>
                  <Input id="p-name" name="name" required autoFocus placeholder="Wireless earbuds" aria-invalid={Boolean(errors.name)} />
                  <FieldError>{errors.name}</FieldError>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="p-sku" required>SKU</Label>
                    <Input id="p-sku" name="sku" required placeholder="EAR-001" aria-invalid={Boolean(errors.sku)} />
                    <FieldError>{errors.sku}</FieldError>
                  </div>
                  <div>
                    <Label htmlFor="p-stock">Stock on hand</Label>
                    <Input id="p-stock" name="stock" type="number" min="0" defaultValue="10" className="tnum" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="p-cost" required>Cost price</Label>
                    <MoneyInput id="p-cost" name="costPrice" symbol={symbol} required placeholder="0.00" aria-invalid={Boolean(errors.costPrice)} />
                    <FieldError>{errors.costPrice}</FieldError>
                  </div>
                  <div>
                    <Label htmlFor="p-price" required>Selling price</Label>
                    <MoneyInput id="p-price" name="price" symbol={symbol} required placeholder="0.00" aria-invalid={Boolean(errors.price)} />
                    <FieldError>{errors.price}</FieldError>
                  </div>
                </div>

                {categories.length > 0 ? (
                  <div>
                    <Label htmlFor="p-cat">Category</Label>
                    <NativeSelect id="p-cat" name="categoryId" defaultValue="">
                      <option value="">No category</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </NativeSelect>
                  </div>
                ) : null}

                <FieldHint>
                  NexaStore works out profit per unit and margin from these two prices automatically.
                </FieldHint>

                <div className="flex items-center justify-between gap-3 pt-2">
                  <Button type="button" variant="ghost" size="md" onClick={loadSample} loading={pending}>
                    <Sparkles />
                    Fill with sample data instead
                  </Button>
                  <Button type="submit" variant="primary" size="md" loading={pending}>
                    Add product
                    <ArrowRight />
                  </Button>
                </div>
              </form>
            </div>
          ) : null}

          {/* ----------------------------------------------- 4: first sale */}
          {step === 4 && firstProduct ? (
            <FirstSaleStep
              product={firstProduct}
              currency={currency}
              pending={pending}
              onSell={submitSale}
              onSkip={finish}
            />
          ) : null}

          {/* --------------------------------------------------- 5: finish */}
          {step === 5 ? (
            <div className="text-center">
              <div className="size-14 mx-auto grid place-items-center rounded-full bg-[var(--pos-soft)] mb-5 animate-pop-in">
                <PartyPopper className="size-6 text-[var(--pos)]" />
              </div>
              <h1 className="text-[26px] font-semibold text-ink tracking-[-0.03em]">
                Your store is ready.
              </h1>
              <p className="text-[15px] text-ink-2 mt-3 leading-relaxed max-w-[42ch] mx-auto">
                {saleResult
                  ? `Order ${saleResult.orderNumber} for ${formatMoney(saleResult.total, currency)} is on the books. Your dashboard is already counting.`
                  : "Everything is set up. Your dashboard will fill in as you trade."}
              </p>

              <Button variant="primary" size="lg" className="mt-8 w-full sm:w-auto sm:px-8" onClick={finish} loading={pending}>
                Open my dashboard
                <ArrowRight />
              </Button>
            </div>
          ) : null}
        </div>
      </main>
    </div>
  );
}

function StepHeading({ title, blurb }: { title: string; blurb: string }) {
  return (
    <div>
      <h1 className="text-[24px] font-semibold text-ink tracking-[-0.028em] leading-tight">{title}</h1>
      <p className="text-[14px] text-ink-3 mt-2 leading-relaxed">{blurb}</p>
    </div>
  );
}

function StepNav({
  onBack, onNext, nextLabel = "Continue", nextDisabled, loading,
}: {
  onBack: () => void;
  onNext: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  loading?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 mt-8">
      <Button variant="ghost" size="md" onClick={onBack}>
        <ArrowLeft />
        Back
      </Button>
      <Button variant="primary" size="md" onClick={onNext} disabled={nextDisabled} loading={loading}>
        {nextLabel}
        <ArrowRight />
      </Button>
    </div>
  );
}

function FirstSaleStep({
  product, currency, pending, onSell, onSkip,
}: {
  product: { id: string; name: string; price: number };
  currency: string;
  pending: boolean;
  onSell: (qty: number) => void;
  onSkip: () => void;
}) {
  const [qty, setQty] = React.useState(1);

  return (
    <div>
      <StepHeading
        title="Record your first sale"
        blurb="This is exactly how a sale is rung up at the till - and it will show up in your analytics immediately."
      />

      <div className="mt-6 rounded-[10px] border border-[var(--line)] bg-[var(--surface)] overflow-hidden">
        <div className="flex items-center gap-3 p-4">
          <div className="size-11 rounded-[8px] bg-[var(--accent-soft)] grid place-items-center shrink-0">
            <Package className="size-5 text-[var(--accent-ink)]" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-medium text-ink truncate">{product.name}</p>
            <p className="text-[12.5px] text-ink-3 tnum">{formatMoney(product.price, currency)} each</p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button variant="secondary" size="iconSm" onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Decrease quantity">
              &minus;
            </Button>
            <span className="w-8 text-center text-[14px] font-semibold text-ink tnum" aria-live="polite">{qty}</span>
            <Button variant="secondary" size="iconSm" onClick={() => setQty((q) => q + 1)} aria-label="Increase quantity">
              +
            </Button>
          </div>
        </div>
        <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--line)] bg-[var(--inset)]">
          <span className="text-[13px] text-ink-2">Total</span>
          <span className="text-[17px] font-semibold text-ink tnum">
            {formatMoney(product.price * qty, currency)}
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 mt-8">
        <Button variant="ghost" size="md" onClick={onSkip}>
          Skip for now
        </Button>
        <Button variant="primary" size="md" onClick={() => onSell(qty)} loading={pending}>
          Complete sale
          <ArrowRight />
        </Button>
      </div>
    </div>
  );
}
