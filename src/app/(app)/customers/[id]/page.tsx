import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Types } from "mongoose";
import { ArrowLeft, Mail, MapPin, Phone, ShoppingBag } from "lucide-react";
import { requireStoreContext } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { getCustomerDetailStats, getVipFloor, segmentOf } from "@/lib/analytics/customers";
import { SEGMENT_META } from "@/lib/analytics/segments";
import { connectToDatabase } from "@/lib/db/connect";
import { Customer } from "@/lib/db/models/customer";
import { formatMoney } from "@/lib/format/currency";
import { formatDate, relativeTime } from "@/lib/format/dates";
import { PageBody, PageHeader } from "@/components/shared/page-header";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/misc";
import { ProductTile } from "@/components/shared/product-tile";
import { SalesTable, type SaleRow } from "@/components/sales/sales-table";
import { CustomerSpendChart } from "@/components/customers/customer-spend-chart";
import { EmptyState } from "@/components/ui/empty-state";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/customers/[id]">): Promise<Metadata> {
  const { id } = await params;
  if (!Types.ObjectId.isValid(id)) return { title: "Customer" };
  const ctx = await requireStoreContext();
  await connectToDatabase();
  const c = await Customer.findOne({ _id: new Types.ObjectId(id), storeId: ctx.storeId })
    .select({ name: 1 })
    .lean();
  return { title: c?.name ?? "Customer" };
}

export default async function CustomerDetailPage({ params }: PageProps<"/customers/[id]">) {
  const { id } = await params;
  const ctx = await requireStoreContext();
  if (!Types.ObjectId.isValid(id)) notFound();

  await connectToDatabase();
  const customer = await Customer.findOne({ _id: new Types.ObjectId(id), storeId: ctx.storeId }).lean();
  if (!customer) notFound();

  const [stats, vipFloor] = await Promise.all([
    getCustomerDetailStats(ctx.storeId, customer._id),
    getVipFloor(ctx.storeId),
  ]);

  const segment = segmentOf(customer, vipFloor);
  const money = (n: number) => formatMoney(n, ctx.currency);
  const showFinancials = can(ctx.role, "analytics:view");

  const orders: SaleRow[] = stats.orders.map((s) => ({
    id: String(s._id),
    orderNumber: s.orderNumber,
    customerName: s.customerName,
    itemCount: s.itemCount,
    lineCount: s.lineCount,
    total: s.total,
    netRevenue: s.netRevenue,
    paymentMethod: s.paymentMethod,
    status: s.status,
    soldAt: new Date(s.soldAt).toISOString(),
    channel: s.channel,
  }));

  const aov = customer.totalOrders > 0 ? Math.round(customer.totalSpent / customer.totalOrders) : 0;

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Customers", href: "/customers" }, { label: customer.name }]}
        title={
          <span className="flex items-center gap-3">
            <Avatar name={customer.name} size={38} />
            <span className="truncate">{customer.name}</span>
          </span>
        }
        description={
          <span className="flex items-center gap-3 flex-wrap text-[12.5px]">
            <Badge tone="neutral">{SEGMENT_META[segment].label}</Badge>
            <span className="text-ink-3">
              Customer since {formatDate(customer.createdAt, ctx.timezone)}
            </span>
          </span>
        }
        actions={
          <Button asChild variant="secondary" size="sm">
            <Link href="/customers">
              <ArrowLeft />
              All customers
            </Link>
          </Button>
        }
      />

      <PageBody className="space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Stat label="Total orders" value={customer.totalOrders.toLocaleString()} />
          <Stat label="Lifetime value" value={money(customer.totalSpent)} emphasis />
          <Stat label="Average order" value={money(aov)} />
          <Stat
            label="Last purchase"
            value={customer.lastPurchaseAt ? relativeTime(customer.lastPurchaseAt) : "Never"}
            sub={customer.lastPurchaseAt ? formatDate(customer.lastPurchaseAt, ctx.timezone) : undefined}
          />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)] gap-4 items-start">
          <div className="space-y-4">
            {showFinancials && stats.monthly.length > 1 ? (
              <Panel>
                <PanelHeader title="Spending over time" description="Monthly totals across their whole history" />
                <div className="p-4 sm:p-5">
                  <CustomerSpendChart
                    points={stats.monthly.map((m) => ({
                      t: new Date(m._id).toISOString(),
                      label: new Intl.DateTimeFormat("en-US", {
                        month: "short", year: "2-digit", timeZone: ctx.timezone,
                      }).format(new Date(m._id)),
                      spent: m.spent,
                      orders: m.orders,
                    }))}
                  />
                </div>
              </Panel>
            ) : null}

            <Panel>
              <PanelHeader
                title="Purchase history"
                description={`${orders.length} order${orders.length === 1 ? "" : "s"} on file`}
              />
              <SalesTable sales={orders} showCustomer={false} emptyAction={false} compact
                emptyTitle="No orders yet"
                emptyDescription="Attach this customer to a sale at the till and it will show up here."
              />
            </Panel>
          </div>

          <div className="space-y-4">
            <Panel>
              <PanelHeader title="Contact" />
              <div className="p-4 sm:p-5 space-y-3">
                {customer.email ? (
                  <ContactRow icon={<Mail />} value={customer.email} href={`mailto:${customer.email}`} />
                ) : null}
                {customer.phone ? (
                  <ContactRow icon={<Phone />} value={customer.phone} href={`tel:${customer.phone}`} />
                ) : null}
                {customer.address ? <ContactRow icon={<MapPin />} value={customer.address} /> : null}
                {!customer.email && !customer.phone && !customer.address ? (
                  <p className="text-[12.5px] text-ink-3">No contact details on file.</p>
                ) : null}
              </div>
            </Panel>

            <Panel>
              <PanelHeader title="Favourite products" description="What they buy most" />
              {stats.favourites.length === 0 ? (
                <EmptyState
                  icon={<ShoppingBag strokeWidth={1.25} />}
                  title="Nothing bought yet"
                  compact
                />
              ) : (
                <ul className="divide-y divide-[var(--line)]">
                  {stats.favourites.map((f) => (
                    <li key={String(f._id)} className="flex items-center gap-2.5 px-4 sm:px-5 py-2.5">
                      <ProductTile name={f.name} image={f.image} size={30} />
                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/products/${String(f._id)}`}
                          className="text-[12.5px] font-medium text-ink hover:text-[var(--accent-ink)] transition-colors truncate block"
                        >
                          {f.name}
                        </Link>
                        <p className="text-[11px] text-ink-3 tnum">{f.units} bought</p>
                      </div>
                      {showFinancials ? (
                        <span className="text-[12.5px] font-medium text-ink-2 tnum shrink-0">
                          {money(f.spent)}
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel>
              <PanelHeader title="Segment" />
              <div className="p-4 sm:p-5">
                <p className="text-[13px] font-medium text-ink">{SEGMENT_META[segment].label}</p>
                <p className="text-[12.5px] text-ink-3 mt-1.5 leading-relaxed">
                  {SEGMENT_META[segment].description}
                </p>
                <p className="text-[11.5px] text-ink-3 mt-3 pt-3 border-t border-[var(--line)] leading-relaxed">
                  Segments are worked out from actual buying behaviour, not from a label anyone
                  typed. VIP means the top 10% of your own customers by lifetime spend.
                </p>
              </div>
            </Panel>

            {customer.notes ? (
              <Panel>
                <PanelHeader title="Notes" />
                <div className="p-4 sm:p-5">
                  <p className="text-[13px] text-ink-2 leading-relaxed whitespace-pre-wrap">
                    {customer.notes}
                  </p>
                </div>
              </Panel>
            ) : null}
          </div>
        </div>
      </PageBody>
    </>
  );
}

function Stat({
  label, value, sub, emphasis,
}: {
  label: string;
  value: string;
  sub?: string;
  emphasis?: boolean;
}) {
  return (
    <div className="rounded-[9px] border border-[var(--line)] bg-[var(--surface)] p-4">
      <p className="text-[12px] text-ink-2 font-medium">{label}</p>
      <p
        className={`num-hero font-semibold mt-2 leading-none tnum ${
          emphasis ? "text-[24px] text-ink" : "text-[21px] text-ink"
        }`}
      >
        {value}
      </p>
      {sub ? <p className="text-[11.5px] text-ink-3 mt-2">{sub}</p> : null}
    </div>
  );
}

function ContactRow({
  icon, value, href,
}: {
  icon: React.ReactNode;
  value: string;
  href?: string;
}) {
  const content = (
    <span className="flex items-start gap-2.5 min-w-0">
      <span className="text-[var(--ink-3)] [&_svg]:size-4 shrink-0 mt-px" aria-hidden>{icon}</span>
      <span className="text-[12.5px] text-ink-2 break-words min-w-0">{value}</span>
    </span>
  );
  return href ? (
    <a href={href} className="block hover:text-ink transition-colors">{content}</a>
  ) : (
    <div>{content}</div>
  );
}
