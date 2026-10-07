import type { Metadata } from "next";
import { requireStoreContext } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { getExpenseBreakdown, getExpenseSeries, getTopExpenses } from "@/lib/analytics/expenses";
import { getPeriodTotals } from "@/lib/analytics/summary";
import { connectToDatabase } from "@/lib/db/connect";
import { Expense } from "@/lib/db/models/expense";
import { EXPENSE_CATEGORIES } from "@/lib/db/models/enums";
import { formatMoney } from "@/lib/format/currency";
import { pctChange, ratio } from "@/lib/utils";
import { first, grainFromParams, pageFromParams, rangeFromParams } from "@/lib/range-params";
import { PageBody, PageHeader } from "@/components/shared/page-header";
import { DateRangePicker } from "@/components/shared/date-range-picker";
import { ActiveFilters, Pagination, SearchFilter, SelectFilter } from "@/components/shared/filter-bar";
import { Panel, PanelFooter, PanelHeader } from "@/components/ui/panel";
import { ExpenseDialog } from "@/components/expenses/expense-dialog";
import { ExpenseTable, type ExpenseRow } from "@/components/expenses/expense-table";
import { ExpenseBreakdownChart } from "@/components/expenses/expense-breakdown-chart";
import { ExpenseTrendChart } from "@/components/expenses/expense-trend-chart";
import { Delta } from "@/components/shared/delta";

export const metadata: Metadata = { title: "Expenses" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

export default async function ExpensesPage({ searchParams }: PageProps<"/expenses">) {
  const ctx = await requireStoreContext();
  if (!can(ctx.role, "expenses:view")) {
    return (
      <PageBody className="pt-10">
        <p className="text-[13.5px] text-ink-2">
          Your role does not have access to expenses. Ask a store owner if you need it.
        </p>
      </PageBody>
    );
  }

  const params = await searchParams;
  await connectToDatabase();

  const range = rangeFromParams(params, ctx.timezone, ctx.weekStartsOn, "this_month");
  const grain = grainFromParams(params, range);
  const page = pageFromParams(params);
  const q = first(params, "q")?.trim();
  const category = first(params, "category");

  const filter: Record<string, unknown> = {
    storeId: ctx.storeId,
    date: { $gte: range.from, $lt: range.to },
  };
  if (category && EXPENSE_CATEGORIES.includes(category as never)) filter.category = category;
  if (q) {
    const safe = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const rx = new RegExp(safe, "i");
    filter.$or = [{ description: rx }, { vendor: rx }, { notes: rx }];
  }

  const [rows, total, breakdown, series, current, previous, biggest] = await Promise.all([
    Expense.find(filter).sort({ date: -1 }).skip((page - 1) * PAGE_SIZE).limit(PAGE_SIZE).lean(),
    Expense.countDocuments(filter),
    getExpenseBreakdown(ctx.storeId, range),
    getExpenseSeries(ctx.storeId, range, grain, ctx.timezone, ctx.weekStartsOn),
    getPeriodTotals(ctx.storeId, range),
    getPeriodTotals(ctx.storeId, range.previous),
    getTopExpenses(ctx.storeId, range, 4),
  ]);

  const expenses: ExpenseRow[] = rows.map((e) => ({
    id: String(e._id),
    category: e.category,
    amount: e.amount,
    description: e.description,
    vendor: e.vendor,
    date: new Date(e.date).toISOString(),
    paymentMethod: e.paymentMethod,
    receiptUrl: e.receiptUrl,
    notes: e.notes,
    recurring: e.recurring,
    recurrenceInterval: e.recurrenceInterval,
    createdByName: e.createdByName,
  }));

  const canWrite = can(ctx.role, "expenses:write");
  const money = (n: number) => formatMoney(n, ctx.currency);
  const changePct = pctChange(current.expenses, previous.expenses);
  const shareOfRevenue = ratio(current.expenses, current.revenue) * 100;

  const activeFilters = [
    q ? { key: "q", label: "Search", value: q } : null,
    category ? { key: "category", label: "Category", value: category } : null,
  ].filter(Boolean) as { key: string; label: string; value: string }[];

  return (
    <>
      <PageHeader
        title="Expenses"
        description="What it costs to keep the doors open. These sit below gross profit - the cost of the stock you sold is tracked separately."
        actions={
          <>
            <DateRangePicker defaultPreset="this_month" />
            {canWrite ? <ExpenseDialog openByDefault={first(params, "new") === "1"} /> : null}
          </>
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          <SearchFilter placeholder="Description or vendor" className="w-full sm:w-[240px]" />
          <SelectFilter
            paramKey="category"
            label="Category"
            options={[
              { value: "all", label: "All categories" },
              ...EXPENSE_CATEGORIES.map((c) => ({
                value: c,
                label: c[0].toUpperCase() + c.slice(1),
              })),
            ]}
          />
        </div>
        {activeFilters.length > 0 ? (
          <div className="mt-2.5">
            <ActiveFilters filters={activeFilters} />
          </div>
        ) : null}
      </PageHeader>

      <PageBody className="space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Stat
            label={`Total for ${range.label.toLowerCase()}`}
            value={money(current.expenses)}
            footer={<Delta value={changePct} invert size="sm" suffix={`vs ${range.previousShort}`} />}
          />
          <Stat
            label="Share of revenue"
            value={`${shareOfRevenue.toFixed(1)}%`}
            footer={<span className="text-[11.5px] text-ink-3">of {money(current.revenue)} earned</span>}
          />
          <Stat
            label="Largest single cost"
            value={biggest[0] ? money(biggest[0].amount) : money(0)}
            footer={
              <span className="text-[11.5px] text-ink-3 truncate block">
                {biggest[0]?.description ?? "Nothing recorded"}
              </span>
            }
          />
          <Stat
            label="Entries"
            value={total.toLocaleString()}
            footer={<span className="text-[11.5px] text-ink-3">across {breakdown.length} categories</span>}
          />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] gap-4 items-start">
          <Panel>
            <PanelHeader
              title="Where the money went"
              description={`By category, ${range.label.toLowerCase()}`}
            />
            <div className="p-4 sm:p-5">
              <ExpenseBreakdownChart breakdown={breakdown} />
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="Expense trend" description="How costs move over the period" />
            <div className="p-4 sm:p-5">
              <ExpenseTrendChart points={series as { t: string; label: string; amount: number }[]} grain={grain} />
            </div>
          </Panel>
        </div>

        <Panel>
          <PanelHeader
            title="All expenses"
            description={`${total.toLocaleString()} ${total === 1 ? "entry" : "entries"} in ${range.label.toLowerCase()}`}
          />
          <ExpenseTable expenses={expenses} canWrite={canWrite} filtered={activeFilters.length > 0} />
          {expenses.length > 0 ? (
            <PanelFooter>
              <Pagination
                page={page}
                pageCount={Math.max(1, Math.ceil(total / PAGE_SIZE))}
                total={total}
                label="expenses"
              />
            </PanelFooter>
          ) : null}
        </Panel>
      </PageBody>
    </>
  );
}

function Stat({
  label, value, footer,
}: {
  label: string;
  value: string;
  footer?: React.ReactNode;
}) {
  return (
    <div className="rounded-[9px] border border-[var(--line)] bg-[var(--surface)] p-4 min-w-0">
      <p className="text-[12px] text-ink-2 font-medium truncate">{label}</p>
      <p className="num-hero text-[22px] font-semibold text-ink mt-2 leading-none tnum">{value}</p>
      {footer ? <div className="mt-2 min-w-0">{footer}</div> : null}
    </div>
  );
}
