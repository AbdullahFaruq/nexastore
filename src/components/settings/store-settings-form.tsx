"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import { toast } from "sonner";
import { updateStore, updateStoreSettings } from "@/actions/store";
import { formatMoney } from "@/lib/format/currency";
import { BUSINESS_TYPES } from "@/lib/db/models/enums";
import { Panel, PanelFooter, PanelHeader } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { FieldError, FieldHint, Input, Label, NativeSelect, Textarea } from "@/components/ui/input";

interface StoreValues {
  name: string;
  currency: string;
  timezone: string;
  businessType: string;
  address: string;
  phone: string;
  email: string;
  logoUrl: string;
  settings: {
    defaultTaxRatePct: number;
    lowStockThreshold: number;
    weekStartsOn: number;
    orderPrefix: string;
    taxMode: "exclusive" | "inclusive";
    receiptFooter: string;
  };
}

export function StoreSettingsForm({
  store, currencies, timezones, canEdit,
}: {
  store: StoreValues;
  currencies: { code: string; name: string; symbol: string }[];
  timezones: string[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [values, setValues] = React.useState(store);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [pending, setPending] = React.useState(false);

  const set = <K extends keyof StoreValues>(key: K, value: StoreValues[K]) =>
    setValues((v) => ({ ...v, [key]: value }));
  const setSetting = <K extends keyof StoreValues["settings"]>(
    key: K,
    value: StoreValues["settings"][K],
  ) => setValues((v) => ({ ...v, settings: { ...v.settings, [key]: value } }));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setPending(true);
    setErrors({});

    // Store profile and operational settings are separate actions with
    // separate validation, so save both and report the first failure.
    const [profile, settings] = await Promise.all([
      updateStore({
        name: values.name,
        currency: values.currency,
        timezone: values.timezone,
        businessType: values.businessType,
        address: values.address,
        phone: values.phone,
        email: values.email,
        logoUrl: values.logoUrl,
      }),
      updateStoreSettings(values.settings),
    ]);

    setPending(false);

    if (!profile.ok) {
      setErrors(profile.fields ?? {});
      toast.error(profile.error);
      return;
    }
    if (!settings.ok) {
      setErrors(settings.fields ?? {});
      toast.error(settings.error);
      return;
    }

    toast.success("Store settings saved");
    router.refresh();
  };

  const sample = 2485000;

  return (
    <form onSubmit={save} className="space-y-4">
      <fieldset disabled={!canEdit} className="space-y-4">
        {!canEdit ? (
          <p className="text-[12.5px] text-ink-3 rounded-[8px] border border-[var(--line)] bg-[var(--surface-2)] px-3.5 py-2.5">
            Only a store owner can change these settings. You can see them but not edit them.
          </p>
        ) : null}

        {/* ------------------------------------------------------ profile */}
        <Panel>
          <PanelHeader title="Store profile" description="Shown on invoices and receipts." />
          <div className="p-4 sm:p-5 space-y-4">
            <div>
              <Label htmlFor="store-name" required>Store name</Label>
              <Input
                id="store-name"
                value={values.name}
                onChange={(e) => set("name", e.target.value)}
                aria-invalid={Boolean(errors.name)}
              />
              <FieldError>{errors.name}</FieldError>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="store-type">Business type</Label>
                <NativeSelect
                  id="store-type"
                  value={values.businessType}
                  onChange={(e) => set("businessType", e.target.value)}
                >
                  {BUSINESS_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t.replace(/^\w/, (c) => c.toUpperCase())}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <div>
                <Label htmlFor="store-email">Contact email</Label>
                <Input
                  id="store-email"
                  type="email"
                  value={values.email}
                  onChange={(e) => set("email", e.target.value)}
                  aria-invalid={Boolean(errors.email)}
                />
                <FieldError>{errors.email}</FieldError>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="store-phone">Phone</Label>
                <Input
                  id="store-phone"
                  value={values.phone}
                  onChange={(e) => set("phone", e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="store-logo">Logo URL</Label>
                <Input
                  id="store-logo"
                  type="url"
                  value={values.logoUrl}
                  onChange={(e) => set("logoUrl", e.target.value)}
                  placeholder="https://..."
                  aria-invalid={Boolean(errors.logoUrl)}
                />
                <FieldError>{errors.logoUrl}</FieldError>
              </div>
            </div>

            <div>
              <Label htmlFor="store-address">Address</Label>
              <Textarea
                id="store-address"
                value={values.address}
                onChange={(e) => set("address", e.target.value)}
                rows={2}
              />
            </div>
          </div>
        </Panel>

        {/* ------------------------------------------- money and calendar */}
        <Panel>
          <PanelHeader
            title="Currency and time"
            description="Every figure in the app is formatted with these, and every daily total is cut at midnight in this timezone."
          />
          <div className="p-4 sm:p-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="store-currency">Currency</Label>
                <NativeSelect
                  id="store-currency"
                  value={values.currency}
                  onChange={(e) => set("currency", e.target.value)}
                >
                  {currencies.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code} - {c.name} ({c.symbol})
                    </option>
                  ))}
                </NativeSelect>
                <FieldHint>
                  Example: {formatMoney(sample, values.currency)}
                </FieldHint>
              </div>
              <div>
                <Label htmlFor="store-timezone">Timezone</Label>
                <NativeSelect
                  id="store-timezone"
                  value={values.timezone}
                  onChange={(e) => set("timezone", e.target.value)}
                >
                  {[...new Set([values.timezone, ...timezones])].map((tz) => (
                    <option key={tz} value={tz}>{tz.replace(/_/g, " ")}</option>
                  ))}
                </NativeSelect>
              </div>
            </div>

            <div className="rounded-[8px] border border-[var(--line)] bg-[var(--surface-2)] px-3.5 py-2.5">
              <p className="text-[12px] text-ink-3 leading-relaxed">
                Changing the currency changes how amounts are displayed, not what they are worth.
                Existing figures are stored as whole units of the currency they were recorded in and
                are not converted.
              </p>
            </div>

            <div>
              <Label htmlFor="store-week">Week starts on</Label>
              <NativeSelect
                id="store-week"
                value={String(values.settings.weekStartsOn)}
                onChange={(e) => setSetting("weekStartsOn", Number(e.target.value))}
                className="sm:w-[220px]"
              >
                <option value="1">Monday</option>
                <option value="0">Sunday</option>
              </NativeSelect>
              <FieldHint>Affects every weekly rollup and the weekly rhythm chart.</FieldHint>
            </div>
          </div>
        </Panel>

        {/* ----------------------------------------------------- trading */}
        <Panel>
          <PanelHeader title="Trading defaults" description="Applied to new products and to sales at the till." />
          <div className="p-4 sm:p-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="store-tax">Default tax rate</Label>
                <div className="relative">
                  <Input
                    id="store-tax"
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={values.settings.defaultTaxRatePct}
                    onChange={(e) => setSetting("defaultTaxRatePct", Number(e.target.value))}
                    className="tnum pr-7"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[13px] text-[var(--ink-3)]">%</span>
                </div>
                <FieldHint>Pre-filled on new products.</FieldHint>
              </div>

              <div>
                <Label htmlFor="store-lowstock">Low stock threshold</Label>
                <Input
                  id="store-lowstock"
                  type="number"
                  min="0"
                  value={values.settings.lowStockThreshold}
                  onChange={(e) => setSetting("lowStockThreshold", Number(e.target.value))}
                  className="tnum"
                />
                <FieldHint>Default reorder point for new products.</FieldHint>
              </div>

              <div>
                <Label htmlFor="store-prefix">Order number prefix</Label>
                <Input
                  id="store-prefix"
                  value={values.settings.orderPrefix}
                  onChange={(e) => setSetting("orderPrefix", e.target.value.toUpperCase())}
                  maxLength={6}
                  className="font-mono"
                />
                <FieldHint>Next order: {values.settings.orderPrefix || "NX"}-000123</FieldHint>
              </div>
            </div>

            <div>
              <Label htmlFor="store-taxmode">How prices include tax</Label>
              <NativeSelect
                id="store-taxmode"
                value={values.settings.taxMode}
                onChange={(e) => setSetting("taxMode", e.target.value as "exclusive" | "inclusive")}
                className="sm:w-[320px]"
              >
                <option value="exclusive">Tax is added on top of the price</option>
                <option value="inclusive">Prices already include tax</option>
              </NativeSelect>
              <FieldHint>
                {values.settings.taxMode === "exclusive"
                  ? "The customer pays the price plus tax. Revenue is the price."
                  : "The customer pays the price shown. Revenue is the price with tax backed out of it."}
              </FieldHint>
            </div>

            <div>
              <Label htmlFor="store-footer">Receipt footer</Label>
              <Textarea
                id="store-footer"
                value={values.settings.receiptFooter}
                onChange={(e) => setSetting("receiptFooter", e.target.value)}
                rows={2}
                placeholder="Thanks for shopping with us. Returns accepted within 30 days with a receipt."
              />
              <FieldHint>Printed at the bottom of every invoice and receipt.</FieldHint>
            </div>
          </div>

          {canEdit ? (
            <PanelFooter className="flex justify-end">
              <Button type="submit" variant="primary" size="sm" loading={pending}>
                <Save />
                Save changes
              </Button>
            </PanelFooter>
          ) : null}
        </Panel>
      </fieldset>
    </form>
  );
}
