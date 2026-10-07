import type { Metadata } from "next";
import { Lightbulb } from "lucide-react";
import { requireStoreContext } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { generateInsights, type Insight } from "@/lib/analytics/insights";
import { rangeFromParams } from "@/lib/range-params";
import { PageBody, PageHeader } from "@/components/shared/page-header";
import { DateRangePicker } from "@/components/shared/date-range-picker";
import { InsightCard, InsightFeedEmpty } from "@/components/dashboard/insight-card";
import { Panel } from "@/components/ui/panel";

export const metadata: Metadata = { title: "Insights" };
export const dynamic = "force-dynamic";

const GROUP_LABELS: Record<Insight["group"], string> = {
  revenue: "Revenue and margin",
  inventory: "Inventory",
  products: "Products",
  costs: "Costs",
  customers: "Customers",
  operations: "Operations",
};

const GROUP_ORDER: Insight["group"][] = [
  "revenue", "costs", "inventory", "products", "customers", "operations",
];

export default async function InsightsPage({ searchParams }: PageProps<"/insights">) {
  const ctx = await requireStoreContext();
  if (!can(ctx.role, "insights:view")) {
    return (
      <PageBody className="pt-10">
        <p className="text-[13.5px] text-ink-2">
          Insights are limited to owners and managers, because they describe the store&rsquo;s financial
          position.
        </p>
      </PageBody>
    );
  }

  const params = await searchParams;
  const range = rangeFromParams(params, ctx.timezone, ctx.weekStartsOn, "this_month");

  const insights = await generateInsights({
    storeId: ctx.storeId,
    range,
    timezone: ctx.timezone,
    weekStartsOn: ctx.weekStartsOn,
  });

  const byGroup = new Map<Insight["group"], Insight[]>();
  for (const i of insights) byGroup.set(i.group, [...(byGroup.get(i.group) ?? []), i]);

  const needsAttention = insights.filter((i) => i.tone === "critical");
  const worthKnowing = insights.filter((i) => i.tone !== "critical");

  return (
    <>
      <PageHeader
        title="Insights"
        description="Patterns worth acting on, computed from your own sales, stock and costs. Every figure quoted here is one you can check."
        actions={<DateRangePicker defaultPreset="this_month" />}
      />

      <PageBody className="space-y-5">
        {insights.length === 0 ? (
          <Panel>
            <InsightFeedEmpty />
          </Panel>
        ) : (
          <>
            {needsAttention.length > 0 ? (
              <section aria-labelledby="needs-attention">
                <h2
                  id="needs-attention"
                  className="text-[13px] font-semibold text-ink mb-2.5 flex items-center gap-2"
                >
                  Needs attention
                  <span className="text-[11px] font-normal text-ink-3 tnum">
                    {needsAttention.length}
                  </span>
                </h2>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  {needsAttention.map((insight) => (
                    <InsightCard key={insight.id} insight={insight} />
                  ))}
                </div>
              </section>
            ) : null}

            {GROUP_ORDER.map((group) => {
              const rows = (byGroup.get(group) ?? []).filter((i) => i.tone !== "critical");
              if (rows.length === 0) return null;
              return (
                <section key={group} aria-labelledby={`group-${group}`}>
                  <h2
                    id={`group-${group}`}
                    className="text-[13px] font-semibold text-ink mb-2.5 flex items-center gap-2"
                  >
                    {GROUP_LABELS[group]}
                    <span className="text-[11px] font-normal text-ink-3 tnum">{rows.length}</span>
                  </h2>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    {rows.map((insight) => (
                      <InsightCard key={insight.id} insight={insight} />
                    ))}
                  </div>
                </section>
              );
            })}

            {worthKnowing.length === 0 && needsAttention.length > 0 ? null : null}
          </>
        )}

        <div className="flex items-start gap-2.5 rounded-[9px] border border-[var(--line)] bg-[var(--surface-2)] px-4 py-3.5">
          <Lightbulb className="size-4 text-[var(--ink-3)] shrink-0 mt-px" aria-hidden />
          <div>
            <p className="text-[12.5px] text-ink-2 leading-relaxed">
              <strong className="font-medium">How these are produced.</strong> Each insight is a
              deterministic reading of your own data - a comparison, a rate, or a threshold - and it
              carries the figures it was derived from. Nothing here is generated text, and nothing is
              estimated beyond what is stated.
            </p>
            <p className="text-[12px] text-ink-3 mt-1.5 leading-relaxed">
              Insights recalculate whenever the date range changes, so a quiet period genuinely
              produces fewer of them rather than filler.
            </p>
          </div>
        </div>
      </PageBody>
    </>
  );
}
