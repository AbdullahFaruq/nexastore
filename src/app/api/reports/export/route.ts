import { NextResponse } from "next/server";
import { getStoreContext } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { buildReport, toCsv, REPORT_TYPES, type ReportType } from "@/lib/reports/build";
import { rangeFromParams } from "@/lib/range-params";
import { slugify } from "@/lib/utils";

/**
 * CSV export.
 *
 * Re-checks the caller's permission and rebuilds the report server-side from
 * the same helpers the screen uses - the browser sends a report type and a date
 * range, never any data.
 */
export async function GET(request: Request) {
  const ctx = await getStoreContext();
  if (!ctx) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (!can(ctx.role, "reports:export")) {
    return NextResponse.json({ error: "You do not have permission to export reports." }, { status: 403 });
  }

  const url = new URL(request.url);
  const type = (url.searchParams.get("type") ?? "profit") as ReportType;
  if (!REPORT_TYPES.some((r) => r.value === type)) {
    return NextResponse.json({ error: "Unknown report type" }, { status: 400 });
  }

  const params: Record<string, string> = {};
  url.searchParams.forEach((v, k) => (params[k] = v));

  const range = rangeFromParams(params, ctx.timezone, ctx.weekStartsOn, "this_month");

  try {
    const report = await buildReport(ctx.storeId, type, range, {
      currency: ctx.currency,
      timezone: ctx.timezone,
      storeName: ctx.store.name,
    });

    const csv = toCsv(report, { currency: ctx.currency });
    const filename = `${slugify(ctx.store.name)}-${type}-${range.from.toISOString().slice(0, 10)}.csv`;

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[reports] export failed:", err);
    return NextResponse.json({ error: "Could not build that report." }, { status: 500 });
  }
}
