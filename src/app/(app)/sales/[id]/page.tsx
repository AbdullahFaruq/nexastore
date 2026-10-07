import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Types } from "mongoose";
import { ArrowLeft, ExternalLink, Receipt, User } from "lucide-react";
import { requireStoreContext } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { connectToDatabase } from "@/lib/db/connect";
import { Payment } from "@/lib/db/models/payment";
import { Sale } from "@/lib/db/models/sale";
import { SaleItem } from "@/lib/db/models/sale-item";
import { formatMoney } from "@/lib/format/currency";
import { formatDateTime, relativeTime } from "@/lib/format/dates";
import { PageBody, PageHeader } from "@/components/shared/page-header";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { SaleStatusBadge } from "@/components/ui/status-badge";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { ProductTile } from "@/components/shared/product-tile";
import { OrderActions } from "@/components/sales/order-actions";
import { PAYMENT_META } from "@/components/sales/sales-table";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/sales/[id]">): Promise<Metadata> {
  const { id } = await params;
  if (!Types.ObjectId.isValid(id)) return { title: "Order" };
  const ctx = await requireStoreContext();
  await connectToDatabase();
  const sale = await Sale.findOne({ _id: new Types.ObjectId(id), storeId: ctx.storeId })
    .select({ orderNumber: 1 })
    .lean();
  return { title: sale ? `Order ${sale.orderNumber}` : "Order" };
}

export default async function SaleDetailPage({ params }: PageProps<"/sales/[id]">) {
  const { id } = await params;
  const ctx = await requireStoreContext();
  if (!Types.ObjectId.isValid(id)) notFound();

  await connectToDatabase();
  // Scoped by storeId: an order id from another tenant simply does not resolve.
  const sale = await Sale.findOne({ _id: new Types.ObjectId(id), storeId: ctx.storeId }).lean();
  if (!sale) notFound();

  const [items, payments] = await Promise.all([
    SaleItem.find({ saleId: sale._id, storeId: ctx.storeId }).lean(),
    Payment.find({ saleId: sale._id, storeId: ctx.storeId }).sort({ createdAt: 1 }).lean(),
  ]);

  const money = (n: number) => formatMoney(n, ctx.currency);
  const showMargins = can(ctx.role, "analytics:view");
  const grossProfit = sale.netRevenue - sale.cogsTotal;

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Sales", href: "/sales" }, { label: sale.orderNumber }]}
        title={
          <span className="flex items-center gap-3 flex-wrap">
            <span className="font-mono">{sale.orderNumber}</span>
            <SaleStatusBadge status={sale.status} />
            {sale.channel !== "pos" ? <Badge tone="outline" size="sm">{sale.channel}</Badge> : null}
          </span>
        }
        description={
          <>
            {formatDateTime(sale.soldAt, ctx.timezone)}
            <span className="text-ink-3"> &middot; {relativeTime(sale.soldAt)}</span>
            {sale.createdByName ? <span className="text-ink-3"> &middot; by {sale.createdByName}</span> : null}
          </>
        }
        actions={
          <OrderActions
            saleId={String(sale._id)}
            orderNumber={sale.orderNumber}
            status={sale.status}
            note={sale.note ?? ""}
            canRefund={can(ctx.role, "sales:refund")}
            canVoid={can(ctx.role, "sales:void")}
            canEdit={can(ctx.role, "sales:create")}
          />
        }
      />

      <PageBody>
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.9fr)_minmax(0,1fr)] gap-4 items-start">
          {/* ------------------------------------------------------- items */}
          <div className="space-y-4">
            <Panel>
              <PanelHeader
                title={`${sale.lineCount} ${sale.lineCount === 1 ? "product" : "products"}`}
                description={`${sale.itemCount} ${sale.itemCount === 1 ? "unit" : "units"} in total`}
              />

              <ul className="divide-y divide-[var(--line)]">
                {items.map((item) => {
                  const lineNet = item.netRevenue;
                  const discounted = item.lineDiscount + item.allocatedOrderDiscount;
                  return (
                    <li key={String(item._id)} className="flex items-start gap-3 px-4 sm:px-5 py-3">
                      <ProductTile name={item.productName} sku={item.sku} image={item.productImage} size={38} />

                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/products/${String(item.productId)}`}
                          className="text-[13.5px] font-medium text-ink hover:text-[var(--accent-ink)] transition-colors block truncate"
                        >
                          {item.productName}
                        </Link>
                        <p className="text-[11.5px] text-ink-3 font-mono mt-0.5">{item.sku}</p>
                        <p className="text-[12px] text-ink-2 mt-1 tnum">
                          {item.quantity} &times; {money(item.unitPrice)}
                          {discounted > 0 ? (
                            <span className="text-[var(--neg)] ml-2">&minus;{money(discounted)} discount</span>
                          ) : null}
                        </p>
                      </div>

                      <div className="text-right shrink-0">
                        <p className="text-[13.5px] font-semibold text-ink tnum">{money(lineNet)}</p>
                        {item.taxAmount > 0 ? (
                          <p className="text-[11px] text-ink-3 tnum mt-0.5">+{money(item.taxAmount)} tax</p>
                        ) : null}
                        {showMargins ? (
                          <p className="text-[11px] text-ink-3 tnum mt-0.5">
                            {money(lineNet - item.cogsAmount)} profit
                          </p>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </Panel>

            {/* --------------------------------------------------- totals */}
            <Panel>
              <PanelHeader title="Order total" />
              <div className="px-4 sm:px-5 py-4">
                <dl className="space-y-2">
                  <Row label="Subtotal" value={money(sale.grossAmount)} hint="Before discounts, excluding tax" />
                  {sale.lineDiscountTotal > 0 ? (
                    <Row label="Line discounts" value={`-${money(sale.lineDiscountTotal)}`} negative />
                  ) : null}
                  {sale.orderDiscount > 0 ? (
                    <Row label="Order discount" value={`-${money(sale.orderDiscount)}`} negative />
                  ) : null}
                  <Row label="Net revenue" value={money(sale.netRevenue)} emphasis hint="What the business earned, excluding tax" />
                  {sale.taxTotal > 0 ? (
                    <Row label="Tax" value={money(sale.taxTotal)} hint="Collected on behalf of the tax authority" />
                  ) : null}

                  <div className="pt-2 mt-1 border-t border-[var(--line)]">
                    <div className="flex items-baseline justify-between gap-4">
                      <dt className="text-[14px] font-semibold text-ink">Total charged</dt>
                      <dd className="text-[20px] font-semibold text-ink tnum num-hero">{money(sale.total)}</dd>
                    </div>
                  </div>

                  {sale.status === "refunded" ? (
                    <div className="pt-2 mt-1 border-t border-[var(--line)]">
                      <Row
                        label="Refunded"
                        value={`-${money(sale.refundedRevenue + sale.refundedTax)}`}
                        negative
                        hint={sale.refundReason ?? "Reversed in full"}
                      />
                    </div>
                  ) : null}

                  {showMargins ? (
                    <div className="pt-2 mt-1 border-t border-[var(--line)] space-y-2">
                      <Row label="Cost of goods" value={money(sale.cogsTotal)} muted />
                      <Row
                        label="Gross profit on this order"
                        value={money(grossProfit)}
                        emphasis
                        hint={`${sale.netRevenue > 0 ? ((grossProfit / sale.netRevenue) * 100).toFixed(1) : "0.0"}% margin`}
                      />
                    </div>
                  ) : null}
                </dl>
              </div>
            </Panel>
          </div>

          {/* ------------------------------------------------------ sidebar */}
          <div className="space-y-4">
            <Panel>
              <PanelHeader title="Customer" />
              <div className="px-4 sm:px-5 py-4">
                {sale.customerId && sale.customerName ? (
                  <Link
                    href={`/customers/${String(sale.customerId)}`}
                    className="flex items-center gap-3 group"
                  >
                    <Avatar name={sale.customerName} size={38} />
                    <div className="min-w-0">
                      <p className="text-[13.5px] font-medium text-ink group-hover:text-[var(--accent-ink)] transition-colors truncate">
                        {sale.customerName}
                      </p>
                      <p className="text-[12px] text-ink-3 flex items-center gap-1">
                        View history
                        <ExternalLink className="size-3" />
                      </p>
                    </div>
                  </Link>
                ) : (
                  <div className="flex items-center gap-3">
                    <span className="size-9 grid place-items-center rounded-full bg-[var(--surface-2)]">
                      <User className="size-4 text-[var(--ink-3)]" />
                    </span>
                    <div>
                      <p className="text-[13.5px] text-ink-2">Walk-in customer</p>
                      <p className="text-[12px] text-ink-3">No account attached</p>
                    </div>
                  </div>
                )}
              </div>
            </Panel>

            <Panel>
              <PanelHeader title="Payment" />
              <div className="px-4 sm:px-5 py-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[12.5px] text-ink-3">Method</span>
                  <span className="flex items-center gap-1.5 text-[13px] text-ink-2">
                    {(() => {
                      const Icon = PAYMENT_META[sale.paymentMethod]?.icon;
                      return Icon ? <Icon className="size-3.5 text-[var(--ink-3)]" /> : null;
                    })()}
                    {PAYMENT_META[sale.paymentMethod]?.label ?? "Other"}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[12.5px] text-ink-3">Status</span>
                  <Badge tone={sale.paymentStatus === "paid" ? "positive" : sale.paymentStatus === "refunded" ? "negative" : "neutral"}>
                    {sale.paymentStatus.replace(/^\w/, (c) => c.toUpperCase())}
                  </Badge>
                </div>
                {sale.amountPaid > 0 ? (
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[12.5px] text-ink-3">Amount paid</span>
                    <span className="text-[13px] text-ink-2 tnum">{money(sale.amountPaid)}</span>
                  </div>
                ) : null}
                {sale.changeGiven > 0 ? (
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[12.5px] text-ink-3">Change given</span>
                    <span className="text-[13px] text-ink-2 tnum">{money(sale.changeGiven)}</span>
                  </div>
                ) : null}
              </div>

              {payments.length > 0 ? (
                <div className="border-t border-[var(--line)] px-4 sm:px-5 py-3">
                  <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--ink-3)] mb-2">
                    Ledger
                  </p>
                  <ul className="space-y-1.5">
                    {payments.map((p) => (
                      <li key={String(p._id)} className="flex items-center justify-between gap-3 text-[12px]">
                        <span className="text-ink-3">
                          {p.kind === "refund" ? "Refund" : "Payment"} &middot;{" "}
                          {relativeTime(p.createdAt)}
                        </span>
                        <span className={`tnum font-medium ${p.amount < 0 ? "text-[var(--neg)]" : "text-ink-2"}`}>
                          {formatMoney(p.amount, ctx.currency, { signed: true })}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </Panel>

            {sale.note ? (
              <Panel>
                <PanelHeader title="Note" />
                <div className="px-4 sm:px-5 py-4">
                  <p className="text-[13px] text-ink-2 leading-relaxed whitespace-pre-wrap">{sale.note}</p>
                </div>
              </Panel>
            ) : null}

            <Button asChild variant="secondary" size="sm" className="w-full">
              <Link href={`/invoices/${String(sale._id)}`}>
                <Receipt />
                Open invoice
              </Link>
            </Button>

            <Button asChild variant="ghost" size="sm" className="w-full">
              <Link href="/sales">
                <ArrowLeft />
                Back to all sales
              </Link>
            </Button>
          </div>
        </div>
      </PageBody>
    </>
  );
}

function Row({
  label, value, hint, negative, emphasis, muted,
}: {
  label: string;
  value: string;
  hint?: string;
  negative?: boolean;
  emphasis?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className={`text-[13px] ${emphasis ? "font-medium text-ink" : muted ? "text-ink-3" : "text-ink-2"}`}>
        {label}
        {hint ? <span className="block text-[11px] text-ink-3 font-normal mt-0.5">{hint}</span> : null}
      </dt>
      <dd
        className={`text-[13px] tnum shrink-0 ${
          negative ? "text-[var(--neg)]" : emphasis ? "font-semibold text-ink" : muted ? "text-ink-3" : "text-ink-2"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
