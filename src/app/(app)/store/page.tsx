import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight, Boxes, Building2, Clock, Coins, Package, Receipt, Settings, Users,
} from "lucide-react";
import { requireStoreContext } from "@/lib/auth/context";
import { can, ROLE_LABELS } from "@/lib/auth/permissions";
import { connectToDatabase } from "@/lib/db/connect";
import { Category } from "@/lib/db/models/category";
import { Customer } from "@/lib/db/models/customer";
import { Membership } from "@/lib/db/models/membership";
import { Product } from "@/lib/db/models/product";
import { Sale } from "@/lib/db/models/sale";
import { getInventoryTotals } from "@/lib/analytics/inventory";
import { currencyMeta, formatMoney } from "@/lib/format/currency";
import { formatDate, relativeTime } from "@/lib/format/dates";
import { PageBody, PageHeader } from "@/components/shared/page-header";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/misc";

export const metadata: Metadata = { title: "Store" };
export const dynamic = "force-dynamic";

/**
 * The store overview: what this business is, at a glance.
 *
 * Deliberately not the settings form - this answers "what am I looking at",
 * and links to Settings for "change it".
 */
export default async function StorePage() {
  const ctx = await requireStoreContext();
  await connectToDatabase();

  const [products, categories, customers, orders, team, inventory, firstSale, lastSale] =
    await Promise.all([
      Product.countDocuments({ storeId: ctx.storeId, status: { $ne: "archived" } }),
      Category.countDocuments({ storeId: ctx.storeId }),
      Customer.countDocuments({ storeId: ctx.storeId }),
      Sale.countDocuments({ storeId: ctx.storeId, status: { $in: ["completed", "refunded"] } }),
      Membership.find({ storeId: ctx.storeId }).sort({ role: 1 }).limit(8).lean(),
      getInventoryTotals(ctx.storeId),
      Sale.findOne({ storeId: ctx.storeId }).sort({ soldAt: 1 }).select({ soldAt: 1 }).lean(),
      Sale.findOne({ storeId: ctx.storeId }).sort({ soldAt: -1 }).select({ soldAt: 1 }).lean(),
    ]);

  const currency = currencyMeta(ctx.currency);
  const canManage = can(ctx.role, "settings:manage");

  const facts: { icon: React.ReactNode; label: string; value: string; hint?: string }[] = [
    {
      icon: <Building2 />,
      label: "Business type",
      value: ctx.store.businessType.replace(/^\w/, (c) => c.toUpperCase()),
      hint: ctx.store.address || undefined,
    },
    {
      icon: <Coins />,
      label: "Currency",
      value: `${currency.code} ${currency.symbol}`,
      hint: `Example: ${formatMoney(2485000, ctx.currency)}`,
    },
    {
      icon: <Clock />,
      label: "Timezone",
      value: ctx.timezone.replace(/_/g, " "),
      hint: `Days are cut at midnight ${ctx.timezone.split("/").pop()?.replace(/_/g, " ")} time`,
    },
    {
      icon: <Receipt />,
      label: "Tax handling",
      value:
        ctx.store.settings?.taxMode === "inclusive"
          ? "Included in prices"
          : "Added at the till",
      hint: `Default rate ${((ctx.store.settings?.defaultTaxRateBps ?? 0) / 100).toFixed(2)}%`,
    },
  ];

  return (
    <>
      <PageHeader
        title={ctx.store.name}
        description="What this store is, and how much of it there is."
        actions={
          canManage ? (
            <Button asChild variant="secondary" size="sm">
              <Link href="/settings">
                <Settings />
                Store settings
              </Link>
            </Button>
          ) : null
        }
      />

      <PageBody className="space-y-4">
        {/* --------------------------------------------------------- scale */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Stat icon={<Package />} label="Products" value={products.toLocaleString()} href="/products"
            hint={`in ${categories} categor${categories === 1 ? "y" : "ies"}`} />
          <Stat icon={<Boxes />} label="Stock value" value={formatMoney(inventory.stockValueAtCost, ctx.currency, { compact: true })}
            href="/inventory" hint={`${inventory.totalUnits.toLocaleString()} units at cost`} />
          <Stat icon={<Receipt />} label="Orders" value={orders.toLocaleString()} href="/sales"
            hint={lastSale ? `last ${relativeTime(lastSale.soldAt)}` : "none yet"} />
          <Stat icon={<Users />} label="Customers" value={customers.toLocaleString()} href="/customers"
            hint={`${team.length} team member${team.length === 1 ? "" : "s"}`} />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
          {/* ------------------------------------------------------ facts */}
          <Panel>
            <PanelHeader
              title="How this store is configured"
              description="These settings shape every figure in the app"
            />
            <ul className="divide-y divide-[var(--line)]">
              {facts.map((f) => (
                <li key={f.label} className="flex items-start gap-3 px-4 sm:px-5 py-3">
                  <span className="size-8 grid place-items-center rounded-[8px] bg-[var(--surface-2)] shrink-0 [&_svg]:size-4 [&_svg]:text-[var(--ink-3)]">
                    {f.icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] text-ink-3">{f.label}</p>
                    <p className="text-[13.5px] font-medium text-ink mt-0.5">{f.value}</p>
                    {f.hint ? (
                      <p className="text-[11.5px] text-ink-3 mt-0.5 leading-snug">{f.hint}</p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
            {firstSale ? (
              <div className="px-4 sm:px-5 py-3 border-t border-[var(--line)] bg-[var(--inset)]">
                <p className="text-[12px] text-ink-3">
                  Trading on NexaStore since{" "}
                  <span className="text-ink-2 font-medium">
                    {formatDate(firstSale.soldAt, ctx.timezone)}
                  </span>
                  .
                </p>
              </div>
            ) : null}
          </Panel>

          {/* ------------------------------------------------------- team */}
          <Panel>
            <PanelHeader
              title="Who has access"
              description={`${team.length} ${team.length === 1 ? "person" : "people"}`}
              actions={
                can(ctx.role, "team:view") ? (
                  <Button asChild variant="ghost" size="xs">
                    <Link href="/team">
                      Manage
                      <ArrowRight />
                    </Link>
                  </Button>
                ) : null
              }
            />
            <ul className="divide-y divide-[var(--line)]">
              {team.map((m) => (
                <li key={String(m._id)} className="flex items-center gap-3 px-4 sm:px-5 py-2.5">
                  <Avatar name={m.displayName ?? m.email ?? "Member"} src={m.avatarUrl} size={30} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium text-ink truncate">
                      {m.displayName ?? m.email ?? "Team member"}
                      {m.userId === ctx.user.userId ? (
                        <span className="text-ink-3 font-normal ml-1.5">you</span>
                      ) : null}
                    </p>
                    <p className="text-[11.5px] text-ink-3 truncate">{m.email ?? "No email"}</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {m.status === "invited" ? <Badge tone="outline" size="sm">Invited</Badge> : null}
                    <Badge tone={m.role === "owner" ? "accent" : "neutral"} size="sm">
                      {ROLE_LABELS[m.role]}
                    </Badge>
                  </div>
                </li>
              ))}
            </ul>
          </Panel>
        </div>

        {ctx.memberships.length > 1 ? (
          <Panel>
            <PanelHeader
              title="Your other stores"
              description="Switch from the picker at the top of the sidebar"
            />
            <ul className="divide-y divide-[var(--line)]">
              {ctx.memberships
                .filter((m) => m.storeId !== String(ctx.storeId))
                .map((m) => (
                  <li key={m.storeId} className="flex items-center gap-3 px-4 sm:px-5 py-2.5">
                    <Avatar name={m.name} size={28} square colorSlot={m.colorSlot} />
                    <span className="text-[13px] font-medium text-ink flex-1 truncate">{m.name}</span>
                    <Badge tone="neutral" size="sm">{ROLE_LABELS[m.role]}</Badge>
                  </li>
                ))}
            </ul>
          </Panel>
        ) : null}
      </PageBody>
    </>
  );
}

function Stat({
  icon, label, value, hint, href,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-[9px] border border-[var(--line)] bg-[var(--surface)] p-4 transition-colors hover:border-[var(--line-strong)] hover:bg-[var(--inset)]"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-[12px] font-medium text-ink-2">
          <span className="text-[var(--ink-3)] [&_svg]:size-[15px]" aria-hidden>{icon}</span>
          {label}
        </span>
        <ArrowRight className="size-3.5 text-[var(--ink-3)] opacity-0 -translate-x-1 transition-all group-hover:opacity-100 group-hover:translate-x-0" aria-hidden />
      </div>
      <p className="num-hero text-[22px] font-semibold text-ink mt-2 leading-none tnum">{value}</p>
      {hint ? <p className="text-[11.5px] text-ink-3 mt-2">{hint}</p> : null}
    </Link>
  );
}
