"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CalendarDays, Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { RANGE_PRESETS, formatDate, type RangePreset } from "@/lib/format/dates";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar, type DateRange } from "./calendar";
import { useStore } from "@/components/providers/store-provider";

/**
 * Date range control.
 *
 * The selected range lives in the URL, so every server component on the page
 * re-renders from it, the choice survives a refresh, and a range is shareable
 * by copying the address.
 */
export function DateRangePicker({
  className,
  align = "end",
  /** Must match the fallback the page passes to rangeFromParams, or the label
      shown here will not be the range actually being rendered. */
  defaultPreset = "last_30",
}: {
  className?: string;
  align?: "start" | "end";
  defaultPreset?: RangePreset;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { timezone } = useStore();

  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  const current = (params.get("range") as RangePreset) || defaultPreset;
  const fromParam = params.get("from");
  const toParam = params.get("to");

  const [draft, setDraft] = React.useState<DateRange | undefined>(
    fromParam && toParam ? { from: new Date(fromParam), to: new Date(toParam) } : undefined,
  );

  const apply = React.useCallback(
    (next: Record<string, string | null>) => {
      const sp = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(next)) {
        if (v === null) sp.delete(k);
        else sp.set(k, v);
      }
      // Any change of window invalidates a paged list.
      sp.delete("page");
      startTransition(() => {
        router.push(`${pathname}?${sp.toString()}`, { scroll: false });
        setOpen(false);
      });
    },
    [params, pathname, router],
  );

  const label =
    current === "custom" && fromParam && toParam
      ? `${formatDate(fromParam, timezone)} - ${formatDate(toParam, timezone)}`
      : (RANGE_PRESETS.find((p) => p.value === current)?.label ?? "Custom range");

  const groups = React.useMemo(() => {
    const map = new Map<string, typeof RANGE_PRESETS>();
    for (const p of RANGE_PRESETS) {
      map.set(p.group, [...(map.get(p.group) ?? []), p]);
    }
    return [...map.entries()];
  }, []);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="secondary" size="sm" loading={pending} className={cn("gap-2", className)}>
          <CalendarDays className="text-[var(--ink-3)]" />
          <span className="max-w-[190px] truncate">{label}</span>
          <ChevronDown className="size-3.5 text-[var(--ink-3)]" />
        </Button>
      </PopoverTrigger>

      <PopoverContent align={align} className="p-0 w-[min(94vw,720px)]">
        <div className="flex flex-col sm:flex-row">
          <div className="sm:w-[186px] shrink-0 p-2 sm:border-r border-[var(--line)] max-h-[340px] overflow-y-auto">
            {groups.map(([group, presets], gi) => (
              <div key={group} className={gi > 0 ? "mt-2" : ""}>
                <p className="px-2 pt-1.5 pb-1 text-[10.5px] font-semibold uppercase tracking-[0.07em] text-[var(--ink-3)]">
                  {group}
                </p>
                {presets.map((p) => {
                  const active = current === p.value;
                  return (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => apply({ range: p.value, from: null, to: null })}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-[6px] px-2 h-8 text-[13px] transition-colors text-left",
                        active
                          ? "bg-[var(--accent-soft)] text-[var(--accent-ink)] font-medium"
                          : "text-ink-2 hover:bg-[var(--surface-2)] hover:text-ink",
                      )}
                    >
                      <span className="flex-1 truncate">{p.label}</span>
                      {active ? <Check className="size-3.5 shrink-0" /> : null}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          <div className="flex-1 min-w-0 border-t sm:border-t-0 border-[var(--line)]">
            <div className="px-3 pt-2.5 pb-0 flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-[0.07em] text-[var(--ink-3)]">
                Custom range
              </p>
              {draft?.from && draft?.to ? (
                <span className="text-[11.5px] text-ink-3 tnum">
                  {formatDate(draft.from, timezone)} - {formatDate(draft.to, timezone)}
                </span>
              ) : null}
            </div>
            <div className="overflow-x-auto">
              <Calendar
                selected={draft}
                onSelect={setDraft}
                numberOfMonths={2}
                disabled={(d) => d > new Date()}
                className="min-w-[440px] sm:min-w-0"
              />
            </div>
            <div className="flex justify-end gap-2 px-3 pb-3 pt-1 border-t border-[var(--line)]">
              <Button variant="ghost" size="sm" onClick={() => setDraft(undefined)}>
                Clear
              </Button>
              <Button
                variant="primary"
                size="sm"
                disabled={!draft?.from || !draft?.to}
                onClick={() =>
                  draft?.from && draft?.to
                    ? apply({
                        range: "custom",
                        from: draft.from.toISOString().slice(0, 10),
                        to: draft.to.toISOString().slice(0, 10),
                      })
                    : undefined
                }
              >
                Apply range
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
