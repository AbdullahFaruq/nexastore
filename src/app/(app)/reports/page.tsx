import type { Metadata } from "next";
import { requireStoreContext } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { buildReport, REPORT_TYPES, type ReportType } from "@/lib/reports/build";
import { first, rangeFromParams } from "@/lib/range-params";
import { PageBody, PageHeader } from "@/components/shared/page-header";
import { ReportBuilder } from "@/components/reports/report-builder";

export const metadata: Metadata = { title: "Reports" };
export const dynamic = "force-dynamic";

export default async function ReportsPage({ searchParams }: PageProps<"/reports">) {
  const ctx = await requireStoreContext();
  if (!can(ctx.role, "reports:view")) {
    return (
      <PageBody className="pt-10">
        <p className="text-[13.5px] text-ink-2">
          Reports are limited to owners and managers.
        </p>
      </PageBody>
    );
  }

  const params = await searchParams;
  const requested = first(params, "type") as ReportType | undefined;
  const type: ReportType = REPORT_TYPES.some((r) => r.value === requested) ? requested! : "profit";
  const range = rangeFromParams(params, ctx.timezone, ctx.weekStartsOn, "this_month");

  const report = await buildReport(ctx.storeId, type, range, {
    currency: ctx.currency,
    timezone: ctx.timezone,
    storeName: ctx.store.name,
  });

  return (
    <>
      <PageHeader
        title="Reports"
        description="Build a report over any period, read it here, then export or print it."
        className="no-print"
      />
      <PageBody>
        <ReportBuilder
          report={report}
          activeType={type}
          types={REPORT_TYPES.filter((r) => can(ctx.role, r.permission))}
          canExport={can(ctx.role, "reports:export")}
          rangeLabel={range.label}
        />
      </PageBody>
    </>
  );
}
