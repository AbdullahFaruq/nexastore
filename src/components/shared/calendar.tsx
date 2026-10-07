"use client";

import * as React from "react";
import { DayPicker, getDefaultClassNames, type DateRange } from "react-day-picker";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Calendar styled against the design tokens rather than the library's default
 * stylesheet, so it inherits the theme in both modes without a CSS import.
 */
export function Calendar({
  selected,
  onSelect,
  numberOfMonths = 2,
  disabled,
  className,
}: {
  selected?: DateRange;
  onSelect: (range: DateRange | undefined) => void;
  numberOfMonths?: number;
  disabled?: (date: Date) => boolean;
  className?: string;
}) {
  const d = getDefaultClassNames();

  return (
    <DayPicker
      mode="range"
      selected={selected}
      onSelect={onSelect}
      numberOfMonths={numberOfMonths}
      disabled={disabled}
      defaultMonth={selected?.from}
      showOutsideDays={false}
      className={cn("p-3 text-[13px]", className)}
      classNames={{
        [d.months]: "flex flex-col sm:flex-row gap-5",
        [d.month]: "space-y-2.5",
        [d.month_caption]: "flex items-center justify-center h-7",
        [d.caption_label]: "text-[13px] font-semibold text-ink",
        [d.nav]: "absolute inset-x-3 top-3 flex items-center justify-between pointer-events-none",
        [d.button_previous]:
          "pointer-events-auto size-7 grid place-items-center rounded-[6px] text-ink-3 hover:bg-[var(--surface-2)] hover:text-ink transition-colors disabled:opacity-30 disabled:pointer-events-none",
        [d.button_next]:
          "pointer-events-auto size-7 grid place-items-center rounded-[6px] text-ink-3 hover:bg-[var(--surface-2)] hover:text-ink transition-colors disabled:opacity-30 disabled:pointer-events-none",
        [d.month_grid]: "w-full border-collapse",
        [d.weekdays]: "flex",
        [d.weekday]: "w-8 text-[11px] font-medium text-[var(--ink-3)] pb-1",
        [d.week]: "flex w-full",
        [d.day]: "p-0 relative",
        [d.day_button]:
          "size-8 rounded-[6px] text-[12.5px] tnum text-ink-2 hover:bg-[var(--surface-2)] hover:text-ink transition-colors cursor-pointer disabled:opacity-30 disabled:pointer-events-none focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--ring)]",
        [d.selected]:
          "[&>button]:bg-[var(--accent-soft)] [&>button]:text-[var(--accent-ink)] [&>button]:font-semibold",
        [d.range_start]: "[&>button]:!bg-[var(--accent)] [&>button]:!text-[var(--accent-fg)] rounded-l-[6px]",
        [d.range_end]: "[&>button]:!bg-[var(--accent)] [&>button]:!text-[var(--accent-fg)] rounded-r-[6px]",
        [d.range_middle]: "bg-[var(--accent-soft)] [&>button]:!bg-transparent [&>button]:!text-[var(--accent-ink)]",
        [d.today]: "[&>button]:ring-1 [&>button]:ring-inset [&>button]:ring-[var(--line-strong)]",
        [d.outside]: "opacity-35",
        [d.disabled]: "opacity-30",
      }}
      components={{
        Chevron: ({ orientation }) =>
          orientation === "left" ? <ChevronLeft className="size-4" /> : <ChevronRight className="size-4" />,
      }}
    />
  );
}

export type { DateRange };
