import type { Metadata } from "next";
import Link from "next/link";
import { ScanLine } from "lucide-react";
import { requireStoreContext } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { connectToDatabase } from "@/lib/db/connect";
import { Sale } from "@/lib/db/models/sale";
import { PAYMENT_METHODS, SALE_STATUSES } from "@/lib/db/models/enums";
import { formatMoney } from "@/lib/format/currency";
import { first, pageFromParams, rangeFromParams } from "@/lib/range-params";
import { PageBody, PageHeader } from "@/components/shared/page-header";
import { DateRangePicker } from "@/components/shared/date-range-picker";
import { ActiveFilters, Pagination, SearchFilter, SelectFilter } from "@/components/shared/filter-bar";
import { SalesTable, type SaleRow } from "@/components/sales/sales-table";
import { Panel, PanelFooter } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Sales" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

export default async function SalesPage({ searchParams }: PageProps<"/sales">) {
  const ctx = await requireStoreContext();
  const params = await searchParams;
  await connectToDatabase();

  const range = rangeFromParams(params, ctx.timezone, ctx.weekStartsOn, "last_90");
  const page = pageFromParams(params);
  const q = first(params, "q")?.trim();
  const status = first(params, "status");
  const method = first(params, "paymentMethod");
  const sort = first(params, "sort") ?? "newest";

  const filter: Record<string, unknown> = {
    storeId: ctx.storeId,
    soldAt: { $gte: range.from, $lt: range.to },
  };
  if (status && SALE_STATUSES.includes(status as never)) filter.status = status;
  if (method && PAYMENT_METHODS.includes(method as never)) filter.paymentMethod = method;
  if (q) {
    const safe = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.$or = [{ orderNumber: new RegExp(safe, "i") }, { customerName: new RegExp(safe, "i") }];
  }

  const sortSpec: Record<string, 1 | -1> =
    sort === "oldest" ? { soldAt: 1 }
    : sort === "amount_high" ? { total: -1 }
    : sort === "amount_low" ? { total: 1 }
    : { soldAt: -1 };

  const [rows, total, totals] = await Promise.all([
    Sale.find(filter)
      .sort(sortSpec)
      .skip((page - 1) * PAGE_SIZE)
      .limit(PAGE_SIZE)
      .select({
        orderNumber: 1, customerName: 1, customerId: 1, itemCount: 1, lineCount: 1,
        total: 1, netRevenue: 1, paymentMethod: 1, status: 1, soldAt: 1, channel: 1,
      })
      .lean(),
    Sale.countDocuments(filter),
    // Totals reflect the whole filtered set, not just the visible page - a
    // footer that only sums 25 rows is worse than no footer at all.
    Sale.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          collected: { $sum: { $cond: [{ $in: ["$status", ["completed", "refunded"]] }, "$total", 0] } },
          revenue: { $sum: { $subtract: ["$netRevenue", "$refundedRevenue"] } },
          items: { $sum: "$itemCount" },
        },
      },
    ]),
  ]);

  const sales: SaleRow[] = rows.map((s) => ({
    id: String(s._id),
    orderNumber: s.orderNumber,
    customerName: s.customerName,
    customerId: s.customerId ? String(s.customerId) : undefined,
    itemCount: s.itemCount,
    lineCount: s.lineCount,
    total: s.total,
    netRevenue: s.netRevenue,
    paymentMethod: s.paymentMethod,
    status: s.status,
    soldAt: new Date(s.soldAt).toISOString(),
    channel: s.channel,
  }));

  const t = totals[0] ?? { collected: 0, revenue: 0, items: 0 };
  const activeFilters = [
    q ? { key: "q", label: "Search", value: q } : null,
    status ? { key: "status", label: "Status", value: status } : null,
    method ? { key: "paymentMethod", label: "Payment", value: method.replace("_", " ") } : null,
  ].filter(Boolean) as { key: string; label: string; value: string }[];

  return (
    <>
      <PageHeader
        title="Sales"
        description={`Every transaction recorded in ${range.label.toLowerCase()}.`}
        actions={
          <>
            <DateRangePicker defaultPreset="last_90" />
            {can(ctx.role, "sales:create") ? (
              <Button asChild variant="primary" size="sm">
                <Link href="/pos">
                  <ScanLine />
                  New sale
                </Link>
              </Button>
            ) : null}
          </>
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          <SearchFilter placeholder="Order number or customer" className="w-full sm:w-[260px]" />
          <SelectFilter
            paramKey="status"
            label="Status"
            options={[
              { value: "all", label: "All statuses" },
              ...SALE_STATUSES.map((s) => ({ value: s, label: s[0].toUpperCase() + s.slice(1) })),
            ]}
          />
          <SelectFilter
            paramKey="paymentMethod"
            label="Payment method"
            options={[
              { value: "all", label: "All payments" },
              ...PAYMENT_METHODS.map((m) => ({
                value: m,
                label: m.replace("_", " ").replace(/^\w/, (c) => c.toUpperCase()),
              })),
            ]}
          />
          <SelectFilter
            paramKey="sort"
            label="Sort"
            options={[
              { value: "newest", label: "Newest first" },
              { value: "oldest", label: "Oldest first" },
              { value: "amount_high", label: "Highest amount" },
              { value: "amount_low", label: "Lowest amount" },
            ]}
          />
        </div>
        {activeFilters.length > 0 ? (
          <div className="mt-2.5">
            <ActiveFilters filters={activeFilters} />
          </div>
        ) : null}
      </PageHeader>

      <PageBody>
        {can(ctx.role, "analytics:view") ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
            <Stat label="Orders" value={total.toLocaleString()} />
            <Stat label="Revenue" value={formatMoney(t.revenue, ctx.currency)} hint="Net of tax, discounts and refunds" />
            <Stat label="Collected" value={formatMoney(t.collected, ctx.currency)} hint="Including tax" className="col-span-2 sm:col-span-1" />
          </div>
        ) : null}

        <Panel>
          <SalesTable
            sales={sales}
            emptyTitle={activeFilters.length > 0 ? "No orders match those filters" : "No sales yet"}
            emptyDescription={
              activeFilters.length > 0
                ? "Try widening the date range or clearing a filter."
                : "Once you make your first sale, your orders and revenue analytics will appear here."
            }
            emptyAction={activeFilters.length === 0}
          />
          {sales.length > 0 ? (
            <PanelFooter>
              <Pagination
                page={page}
                pageCount={Math.max(1, Math.ceil(total / PAGE_SIZE))}
                total={total}
                label="orders"
              />
            </PanelFooter>
          ) : null}
        </Panel>
      </PageBody>
    </>
  );
}

function Stat({
  label, value, hint, className,
}: {
  label: string;
  value: string;
  hint?: string;
  className?: string;
}) {
  return (
    <div className={`rounded-[9px] border border-[var(--line)] bg-[var(--surface)] p-3.5 ${className ?? ""}`}>
      <p className="text-[12px] text-ink-3">{label}</p>
      <p className="text-[19px] font-semibold text-ink tnum mt-1 leading-none">{value}</p>
      {hint ? <p className="text-[11px] text-ink-3 mt-1.5">{hint}</p> : null}
    </div>
  );
}
