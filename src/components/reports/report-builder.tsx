"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { Download, FileText, Printer } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ReportResult, ReportType } from "@/lib/reports/build";
import { formatDateTime } from "@/lib/format/dates";
import { useStore } from "@/components/providers/store-provider";
import { useUrlFilters } from "@/components/shared/filter-bar";
import { DateRangePicker } from "@/components/shared/date-range-picker";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { Td, Th } from "@/components/sales/sales-table";
import { EmptyChartMark, EmptyState } from "@/components/ui/empty-state";
import { LogoMark } from "@/components/layout/logo";

const MAX_PREVIEW_ROWS = 200;

/**
 * Report builder and preview.
 *
 * The preview is the export: both come from the same builder, so what is on
 * screen is exactly what lands in the CSV. Printing uses the browser's own
 * dialogue, which every desktop browser can turn into a PDF.
 */
export function ReportBuilder({
  report, activeType, types, canExport, rangeLabel,
}: {
  report: ReportResult;
  activeType: ReportType;
  types: { value: ReportType; label: string; description: string }[];
  canExport: boolean;
  rangeLabel: string;
}) {
  const { set } = useUrlFilters();
  const { storeName, timezone } = useStore();
  const params = useSearchParams();

  const exportHref = React.useMemo(() => {
    const sp = new URLSearchParams(params.toString());
    sp.set("type", activeType);
    return `/api/reports/export?${sp.toString()}`;
  }, [params, activeType]);

  const truncated = report.rows.length > MAX_PREVIEW_ROWS;
  const preview = truncated ? report.rows.slice(0, MAX_PREVIEW_ROWS) : report.rows;

  return (
    <div className="space-y-4">
      {/* ------------------------------------------------------- controls */}
      <div className="no-print space-y-3">
        <div
          className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2"
          role="radiogroup"
          aria-label="Report type"
        >
          {types.map((t) => {
            const active = t.value === activeType;
            return (
              <button
                key={t.value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => set({ type: t.value })}
                className={cn(
                  "text-left rounded-[9px] border p-3.5 transition-all",
                  active
                    ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                    : "border-[var(--line)] bg-[var(--surface)] hover:border-[var(--line-strong)]",
                )}
              >
                <span className="flex items-center gap-2">
                  <FileText
                    className={cn("size-3.5 shrink-0", active ? "text-[var(--accent-ink)]" : "text-[var(--ink-3)]")}
                  />
                  <span
                    className={cn(
                      "text-[13px] font-medium",
                      active ? "text-[var(--accent-ink)]" : "text-ink",
                    )}
                  >
                    {t.label}
                  </span>
                </span>
                <span className="block text-[11.5px] text-ink-3 mt-1 leading-snug">{t.description}</span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-between gap-3 flex-wrap">
          <DateRangePicker defaultPreset="this_month" align="start" />
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => window.print()}>
              <Printer />
              Print / PDF
            </Button>
            {canExport ? (
              <Button asChild variant="primary" size="sm">
                <a href={exportHref} download>
                  <Download />
                  Export CSV
                </a>
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      {/* --------------------------------------------------------- report */}
      <Panel className="print:border-0">
        {/* Print-only letterhead: the export needs to identify itself on paper. */}
        <div className="hidden print-only px-5 pt-5 pb-3 border-b border-[var(--line)]">
          <div className="flex items-center gap-2.5">
            <LogoMark size={26} />
            <div>
              <p className="text-[15px] font-semibold text-ink">{storeName}</p>
              <p className="text-[11px] text-ink-3">{report.subtitle}</p>
            </div>
          </div>
        </div>

        <PanelHeader
          title={report.title}
          description={report.subtitle}
          className="no-print"
          actions={
            <span className="text-[11.5px] text-ink-3">
              {report.rows.length.toLocaleString()} row{report.rows.length === 1 ? "" : "s"}
            </span>
          }
        />

        {report.summary.length > 0 ? (
          <dl className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 divide-x divide-y sm:divide-y-0 divide-[var(--line)] border-b border-[var(--line)]">
            {report.summary.map((s) => (
              <div key={s.label} className="px-4 sm:px-5 py-3.5 first:border-l-0">
                <dt className="text-[11.5px] text-ink-3">{s.label}</dt>
                <dd className="text-[16px] font-semibold text-ink tnum mt-1">{s.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}

        {report.rows.length === 0 ? (
          <EmptyState
            icon={<EmptyChartMark />}
            title="Nothing to report for this period"
            description={`There is no activity in ${rangeLabel.toLowerCase()}. Try a wider date range.`}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[var(--line)]">
                  {report.columns.map((c, i) => (
                    <Th
                      key={c.key}
                      className={cn(
                        c.align === "right" && "text-right",
                        i === 0 && "pl-4 sm:pl-5",
                        i === report.columns.length - 1 && "pr-4 sm:pr-5",
                      )}
                    >
                      {c.label}
                    </Th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)]">
                {preview.map((row, ri) => {
                  const display = (row._display ?? {}) as Record<string, string>;
                  return (
                    <tr key={ri} className="hover:bg-[var(--inset)] transition-colors">
                      {report.columns.map((c, i) => (
                        <Td
                          key={c.key}
                          className={cn(
                            c.align === "right" && "text-right",
                            i === 0 && "pl-4 sm:pl-5",
                            i === report.columns.length - 1 && "pr-4 sm:pr-5",
                          )}
                        >
                          <span
                            className={cn(
                              "text-[12.5px]",
                              c.align === "right" ? "text-ink tnum" : "text-ink-2",
                              i === 0 && "font-medium text-ink whitespace-pre",
                            )}
                          >
                            {display[c.key] ?? String(row[c.key] ?? "")}
                          </span>
                        </Td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {truncated ? (
          <div className="px-4 sm:px-5 py-3 border-t border-[var(--line)] bg-[var(--inset)]">
            <p className="text-[12px] text-ink-3">
              Showing the first {MAX_PREVIEW_ROWS.toLocaleString()} of{" "}
              {report.rows.length.toLocaleString()} rows. The CSV export contains every row.
            </p>
          </div>
        ) : null}

        <div className="px-4 sm:px-5 py-2.5 border-t border-[var(--line)]">
          <p className="text-[11px] text-ink-3">
            Generated {formatDateTime(report.generatedAt, timezone)} from live store data.
          </p>
        </div>
      </Panel>
    </div>
  );
}
