import type { Metadata } from "next";
import { requireStoreContext } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { connectToDatabase } from "@/lib/db/connect";
import { Product } from "@/lib/db/models/product";
import { Sale } from "@/lib/db/models/sale";
import { CURRENCY_LIST } from "@/lib/format/currency";
import { COMMON_TIMEZONES } from "@/lib/format/dates";
import { StoreSettingsForm } from "@/components/settings/store-settings-form";
import { DangerZone } from "@/components/settings/danger-zone";

export const metadata: Metadata = { title: "Store settings" };
export const dynamic = "force-dynamic";

export default async function StoreSettingsPage() {
  const ctx = await requireStoreContext();
  await connectToDatabase();

  const [demoProducts, demoSales] = await Promise.all([
    Product.countDocuments({ storeId: ctx.storeId, isDemo: true }),
    Sale.countDocuments({ storeId: ctx.storeId, isDemo: true }),
  ]);

  return (
    <>
      <StoreSettingsForm
        canEdit={can(ctx.role, "settings:manage")}
        currencies={CURRENCY_LIST.map((c) => ({ code: c.code, name: c.name, symbol: c.symbol }))}
        timezones={COMMON_TIMEZONES}
        store={{
          name: ctx.store.name,
          currency: ctx.currency,
          timezone: ctx.timezone,
          businessType: ctx.store.businessType,
          address: ctx.store.address ?? "",
          phone: ctx.store.phone ?? "",
          email: ctx.store.email ?? "",
          logoUrl: ctx.store.logoUrl ?? "",
          settings: {
            defaultTaxRatePct: (ctx.store.settings?.defaultTaxRateBps ?? 0) / 100,
            lowStockThreshold: ctx.store.settings?.lowStockThreshold ?? 10,
            weekStartsOn: ctx.store.settings?.weekStartsOn ?? 1,
            orderPrefix: ctx.store.settings?.orderPrefix ?? "NX",
            taxMode: ctx.store.settings?.taxMode ?? "exclusive",
            receiptFooter: ctx.store.settings?.receiptFooter ?? "",
          },
        }}
      />

      {can(ctx.role, "settings:manage") ? (
        <DangerZone
          storeName={ctx.store.name}
          canDeleteStore={can(ctx.role, "store:delete")}
          demoCounts={{ products: demoProducts, sales: demoSales }}
        />
      ) : null}
    </>
  );
}
