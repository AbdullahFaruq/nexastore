import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Types } from "mongoose";
import { ArrowLeft } from "lucide-react";
import { requireStoreContext } from "@/lib/auth/context";
import { connectToDatabase } from "@/lib/db/connect";
import { Customer } from "@/lib/db/models/customer";
import { Sale } from "@/lib/db/models/sale";
import { SaleItem } from "@/lib/db/models/sale-item";
import { formatMoney } from "@/lib/format/currency";
import { formatDate, formatDateTime } from "@/lib/format/dates";
import { LogoMark } from "@/components/layout/logo";
import { PrintBar } from "@/components/sales/print-bar";
import { PAYMENT_METHODS } from "@/lib/db/models/enums";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/invoices/[id]">): Promise<Metadata> {
  const { id } = await params;
  if (!Types.ObjectId.isValid(id)) return { title: "Invoice" };
  const ctx = await requireStoreContext();
  await connectToDatabase();
  const sale = await Sale.findOne({ _id: new Types.ObjectId(id), storeId: ctx.storeId })
    .select({ orderNumber: 1 })
    .lean();
  return { title: sale ? `Invoice ${sale.orderNumber}` : "Invoice" };
}

const METHOD_LABEL: Record<(typeof PAYMENT_METHODS)[number], string> = {
  cash: "Cash",
  card: "Card",
  bank_transfer: "Bank transfer",
  mobile: "Mobile payment",
  other: "Other",
};

export default async function InvoicePage({ params }: PageProps<"/invoices/[id]">) {
  const { id } = await params;
  const ctx = await requireStoreContext();
  if (!Types.ObjectId.isValid(id)) notFound();

  await connectToDatabase();
  const sale = await Sale.findOne({ _id: new Types.ObjectId(id), storeId: ctx.storeId }).lean();
  if (!sale) notFound();

  const [items, customer] = await Promise.all([
    SaleItem.find({ saleId: sale._id, storeId: ctx.storeId }).lean(),
    sale.customerId
      ? Customer.findOne({ _id: sale.customerId, storeId: ctx.storeId }).lean()
      : Promise.resolve(null),
  ]);

  const money = (n: number) => formatMoney(n, ctx.currency);
  const store = ctx.store;
  const refunded = sale.status === "refunded";

  return (
    <div className="mx-auto max-w-[820px] px-4 py-6 print:p-0 print:max-w-none">
      <PrintBar backHref={`/sales/${String(sale._id)}`} orderNumber={sale.orderNumber} />

      <article className="bg-white dark:bg-[var(--surface)] border border-[var(--line)] rounded-[10px] print:border-0 print:rounded-none overflow-hidden">
        {/* ------------------------------------------------------- header */}
        <header className="flex items-start justify-between gap-6 p-7 sm:p-9 pb-6 border-b border-[var(--line)]">
          <div className="flex items-start gap-3 min-w-0">
            <LogoMark size={38} />
            <div className="min-w-0">
              <p className="text-[17px] font-semibold text-ink tracking-[-0.02em] truncate">{store.name}</p>
              {store.address ? (
                <p className="text-[12px] text-ink-3 mt-1 leading-relaxed whitespace-pre-line">{store.address}</p>
              ) : null}
              <p className="text-[12px] text-ink-3 leading-relaxed">
                {[store.phone, store.email].filter(Boolean).join(" · ")}
              </p>
            </div>
          </div>

          <div className="text-right shrink-0">
            <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-ink-3">
              {refunded ? "Credit note" : "Invoice"}
            </p>
            <p className="text-[19px] font-semibold text-ink font-mono tracking-tight mt-1">
              {sale.orderNumber}
            </p>
            <p className="text-[12px] text-ink-3 mt-1.5">{formatDate(sale.soldAt, ctx.timezone)}</p>
            {refunded ? (
              <p className="mt-2 inline-block rounded-full bg-[var(--neg-soft)] px-2 py-0.5 text-[11px] font-medium text-[var(--neg)]">
                Refunded in full
              </p>
            ) : sale.status === "pending" ? (
              <p className="mt-2 inline-block rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-[11px] font-medium text-ink-2">
                Awaiting payment
              </p>
            ) : null}
          </div>
        </header>

        {/* --------------------------------------------------- parties row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 p-7 sm:p-9 py-6 border-b border-[var(--line)]">
          <div>
            <p className="text-[10.5px] font-medium uppercase tracking-[0.08em] text-ink-3 mb-1.5">
              Billed to
            </p>
            <p className="text-[13px] font-medium text-ink">
              {customer?.name ?? sale.customerName ?? "Walk-in customer"}
            </p>
            {customer?.email ? <p className="text-[12px] text-ink-3 mt-0.5">{customer.email}</p> : null}
            {customer?.phone ? <p className="text-[12px] text-ink-3">{customer.phone}</p> : null}
            {customer?.address ? (
              <p className="text-[12px] text-ink-3 mt-0.5 leading-relaxed">{customer.address}</p>
            ) : null}
          </div>

          <div>
            <p className="text-[10.5px] font-medium uppercase tracking-[0.08em] text-ink-3 mb-1.5">
              Issued
            </p>
            <p className="text-[13px] text-ink-2">{formatDateTime(sale.soldAt, ctx.timezone)}</p>
            {sale.createdByName ? (
              <p className="text-[12px] text-ink-3 mt-0.5">Served by {sale.createdByName}</p>
            ) : null}
          </div>

          <div>
            <p className="text-[10.5px] font-medium uppercase tracking-[0.08em] text-ink-3 mb-1.5">
              Payment
            </p>
            <p className="text-[13px] text-ink-2">{METHOD_LABEL[sale.paymentMethod] ?? "Other"}</p>
            <p className="text-[12px] text-ink-3 mt-0.5 capitalize">{sale.paymentStatus}</p>
          </div>
        </div>

        {/* ---------------------------------------------------------- lines */}
        <div className="px-7 sm:px-9 py-6">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-[var(--line-strong)]">
                <th scope="col" className="text-left pb-2 text-[10.5px] font-medium uppercase tracking-[0.07em] text-ink-3">
                  Description
                </th>
                <th scope="col" className="text-right pb-2 text-[10.5px] font-medium uppercase tracking-[0.07em] text-ink-3 w-16">
                  Qty
                </th>
                <th scope="col" className="text-right pb-2 text-[10.5px] font-medium uppercase tracking-[0.07em] text-ink-3 w-28">
                  Unit price
                </th>
                <th scope="col" className="text-right pb-2 text-[10.5px] font-medium uppercase tracking-[0.07em] text-ink-3 w-24">
                  Discount
                </th>
                <th scope="col" className="text-right pb-2 text-[10.5px] font-medium uppercase tracking-[0.07em] text-ink-3 w-28">
                  Amount
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line)]">
              {items.map((item) => (
                <tr key={String(item._id)}>
                  <td className="py-2.5 pr-3">
                    <p className="text-[13px] text-ink">{item.productName}</p>
                    <p className="text-[11px] text-ink-3 font-mono mt-0.5">{item.sku}</p>
                  </td>
                  <td className="py-2.5 text-right text-[13px] text-ink-2 tnum align-top">{item.quantity}</td>
                  <td className="py-2.5 text-right text-[13px] text-ink-2 tnum align-top">
                    {money(item.unitPrice)}
                  </td>
                  <td className="py-2.5 text-right text-[13px] tnum align-top">
                    {item.lineDiscount + item.allocatedOrderDiscount > 0 ? (
                      <span className="text-[var(--neg)]">
                        &minus;{money(item.lineDiscount + item.allocatedOrderDiscount)}
                      </span>
                    ) : (
                      <span className="text-ink-3">&mdash;</span>
                    )}
                  </td>
                  <td className="py-2.5 text-right text-[13px] font-medium text-ink tnum align-top">
                    {money(item.netRevenue)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* --------------------------------------------------- totals */}
          <div className="flex justify-end mt-5">
            <dl className="w-full sm:w-[300px] space-y-1.5">
              <TotalRow label="Subtotal" value={money(sale.grossAmount)} />
              {sale.discountTotal > 0 ? (
                <TotalRow label="Discounts" value={`-${money(sale.discountTotal)}`} negative />
              ) : null}
              <TotalRow label="Net" value={money(sale.netRevenue)} />
              {sale.taxTotal > 0 ? <TotalRow label="Tax" value={money(sale.taxTotal)} /> : null}

              <div className="flex items-baseline justify-between gap-4 pt-2.5 mt-1.5 border-t-2 border-[var(--ink)]">
                <dt className="text-[14px] font-semibold text-ink">Total</dt>
                <dd className="text-[18px] font-semibold text-ink tnum">{money(sale.total)}</dd>
              </div>

              {refunded ? (
                <div className="flex items-baseline justify-between gap-4 pt-2 mt-1 border-t border-[var(--line)]">
                  <dt className="text-[13px] text-[var(--neg)]">Refunded</dt>
                  <dd className="text-[13px] text-[var(--neg)] tnum font-medium">
                    &minus;{money(sale.refundedRevenue + sale.refundedTax)}
                  </dd>
                </div>
              ) : null}
            </dl>
          </div>
        </div>

        {/* --------------------------------------------------------- footer */}
        <footer className="px-7 sm:px-9 py-5 border-t border-[var(--line)] bg-[var(--inset)] print:bg-transparent">
          {sale.note ? (
            <p className="text-[12px] text-ink-2 mb-2 leading-relaxed whitespace-pre-wrap">{sale.note}</p>
          ) : null}
          <p className="text-[12px] text-ink-3 leading-relaxed">
            {store.settings?.receiptFooter ?? "Thank you for your business."}
          </p>
          <p className="text-[11px] text-ink-3 mt-3">
            {store.name}
            {store.email ? ` · ${store.email}` : ""}
            {" · "}
            Invoice {sale.orderNumber}
          </p>
        </footer>
      </article>

      <p className="no-print text-center mt-5">
        <Link
          href={`/sales/${String(sale._id)}`}
          className="inline-flex items-center gap-1.5 text-[12.5px] text-ink-3 hover:text-ink-2 transition-colors"
        >
          <ArrowLeft className="size-3.5" />
          Back to the order
        </Link>
      </p>
    </div>
  );
}

function TotalRow({ label, value, negative }: { label: string; value: string; negative?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-[12.5px] text-ink-2">{label}</dt>
      <dd className={`text-[12.5px] tnum ${negative ? "text-[var(--neg)]" : "text-ink-2"}`}>{value}</dd>
    </div>
  );
}
