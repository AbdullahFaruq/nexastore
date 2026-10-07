import type { Metadata } from "next";
import { requireStoreContext } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { getCustomerSegmentCounts, getCustomerStats, segmentOf, type CustomerSegment } from "@/lib/analytics/customers";
import { connectToDatabase } from "@/lib/db/connect";
import { Customer } from "@/lib/db/models/customer";
import { formatMoney } from "@/lib/format/currency";
import { first, pageFromParams, rangeFromParams } from "@/lib/range-params";
import { PageBody, PageHeader } from "@/components/shared/page-header";
import { SearchFilter, SelectFilter } from "@/components/shared/filter-bar";
import { Pagination } from "@/components/shared/filter-bar";
import { Panel, PanelFooter } from "@/components/ui/panel";
import { CustomerDialog } from "@/components/customers/customer-dialog";
import { CustomerTable, type CustomerRow } from "@/components/customers/customer-table";
import { SegmentStrip } from "@/components/customers/segment-strip";

export const metadata: Metadata = { title: "Customers" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 30;

export default async function CustomersPage({ searchParams }: PageProps<"/customers">) {
  const ctx = await requireStoreContext();
  const params = await searchParams;
  await connectToDatabase();

  const page = pageFromParams(params);
  const q = first(params, "q")?.trim();
  const segment = first(params, "segment") as CustomerSegment | undefined;
  const sort = first(params, "sort") ?? "spent";
  const range = rangeFromParams(params, ctx.timezone, ctx.weekStartsOn, "last_30");

  const filter: Record<string, unknown> = { storeId: ctx.storeId };
  if (q) {
    const safe = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const rx = new RegExp(safe, "i");
    filter.$or = [{ name: rx }, { email: rx }, { phone: rx }];
  }

  const sortSpec: Record<string, 1 | -1> =
    sort === "recent" ? { lastPurchaseAt: -1 }
    : sort === "orders" ? { totalOrders: -1 }
    : sort === "name" ? { name: 1 }
    : sort === "newest" ? { createdAt: -1 }
    : { totalSpent: -1 };

  const [segments, stats] = await Promise.all([
    getCustomerSegmentCounts(ctx.storeId),
    getCustomerStats(ctx.storeId, range),
  ]);

  // Segments are behavioural, not a stored field, so filtering by one means
  // classifying the matching set rather than adding a query condition.
  const allMatching = await Customer.find(filter).sort(sortSpec).lean();
  const classified = allMatching.map((c) => ({
    doc: c,
    segment: segmentOf(c, segments.vipFloor),
  }));
  const visible = segment ? classified.filter((c) => c.segment === segment) : classified;
  const total = visible.length;
  const rows = visible.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const customers: CustomerRow[] = rows.map(({ doc, segment: seg }) => ({
    id: String(doc._id),
    name: doc.name,
    email: doc.email,
    phone: doc.phone,
    totalOrders: doc.totalOrders,
    totalSpent: doc.totalSpent,
    averageOrderValue: doc.totalOrders > 0 ? Math.round(doc.totalSpent / doc.totalOrders) : 0,
    lastPurchaseAt: doc.lastPurchaseAt ? new Date(doc.lastPurchaseAt).toISOString() : undefined,
    createdAt: new Date(doc.createdAt).toISOString(),
    segment: seg,
  }));

  const canWrite = can(ctx.role, "customers:write");

  return (
    <>
      <PageHeader
        title="Customers"
        description="Who buys from you, how often, and what they are worth."
        actions={canWrite ? <CustomerDialog openByDefault={first(params, "new") === "1"} /> : null}
      >
        <div className="flex flex-wrap items-center gap-2">
          <SearchFilter placeholder="Name, email or phone" className="w-full sm:w-[240px]" />
          <SelectFilter
            paramKey="sort"
            label="Sort"
            options={[
              { value: "spent", label: "Highest spend" },
              { value: "recent", label: "Most recent" },
              { value: "orders", label: "Most orders" },
              { value: "newest", label: "Newest" },
              { value: "name", label: "Name A-Z" },
            ]}
          />
        </div>
      </PageHeader>

      <PageBody className="space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Stat label="Customers on file" value={stats.total.toLocaleString()} sub={`${stats.purchasing} have bought something`} />
          <Stat
            label="Average lifetime value"
            value={formatMoney(stats.averageLifetimeValue, ctx.currency)}
            sub="per purchasing customer"
          />
          <Stat label="Repeat rate" value={`${stats.repeatRate.toFixed(1)}%`} sub={`${stats.repeatCustomers} have bought more than once`} />
          <Stat label="New this period" value={stats.newInPeriod.toLocaleString()} sub={`first order in ${range.label.toLowerCase()}`} />
        </div>

        <SegmentStrip counts={segments.counts} total={segments.total} active={segment} />

        <Panel>
          <CustomerTable
            customers={customers}
            canWrite={canWrite}
            filtered={Boolean(q || segment)}
          />
          {customers.length > 0 ? (
            <PanelFooter>
              <Pagination
                page={page}
                pageCount={Math.max(1, Math.ceil(total / PAGE_SIZE))}
                total={total}
                label="customers"
              />
            </PanelFooter>
          ) : null}
        </Panel>
      </PageBody>
    </>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-[9px] border border-[var(--line)] bg-[var(--surface)] p-4">
      <p className="text-[12px] text-ink-2 font-medium">{label}</p>
      <p className="num-hero text-[22px] font-semibold text-ink mt-2 leading-none tnum">{value}</p>
      <p className="text-[11.5px] text-ink-3 mt-2 leading-snug">{sub}</p>
    </div>
  );
}
