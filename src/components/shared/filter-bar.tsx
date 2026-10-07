"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input, NativeSelect } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

/**
 * Filters live in the URL.
 *
 * That makes a filtered view shareable and bookmarkable, survives a refresh,
 * and lets the server component do the querying - no client-side filtering of
 * a partially loaded list, which is how filtered counts end up lying.
 */
export function useUrlFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = React.useTransition();

  const set = React.useCallback(
    (updates: Record<string, string | null>) => {
      const sp = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(updates)) {
        if (v === null || v === "" || v === "all") sp.delete(k);
        else sp.set(k, v);
      }
      sp.delete("page");
      startTransition(() => router.push(`${pathname}?${sp.toString()}`, { scroll: false }));
    },
    [params, pathname, router],
  );

  const clearAll = React.useCallback(() => {
    startTransition(() => router.push(pathname, { scroll: false }));
  }, [pathname, router]);

  return { set, clearAll, params, pending };
}

/** Debounced search box. Typing does not fire a query on every keystroke. */
export function SearchFilter({
  placeholder = "Search...",
  paramKey = "q",
  className,
}: {
  placeholder?: string;
  paramKey?: string;
  className?: string;
}) {
  const { set, params } = useUrlFilters();
  const initial = params.get(paramKey) ?? "";
  const [value, setValue] = React.useState(initial);
  const first = React.useRef(true);

  // Adjust during render rather than in an effect: when the URL changes under
  // us (back button, a cleared filter chip) the input should already show the
  // new value on the very first paint, not one frame later.
  const [lastInitial, setLastInitial] = React.useState(initial);
  if (initial !== lastInitial) {
    setLastInitial(initial);
    setValue(initial);
  }

  React.useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (value === initial) return;
    const t = setTimeout(() => set({ [paramKey]: value || null }), 320);
    return () => clearTimeout(t);
    // `set` and `initial` are stable enough for this debounce window.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <div className={cn("relative", className)}>
      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-[var(--ink-3)] pointer-events-none" aria-hidden />
      <Input
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="pl-8 pr-8 h-8 text-[13px]"
      />
      {value ? (
        <button
          type="button"
          onClick={() => {
            setValue("");
            set({ [paramKey]: null });
          }}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--ink-3)] hover:text-ink-2 transition-colors"
          aria-label="Clear search"
        >
          <X className="size-3.5" />
        </button>
      ) : null}
    </div>
  );
}

export function SelectFilter({
  paramKey,
  label,
  options,
  className,
}: {
  paramKey: string;
  label: string;
  options: { value: string; label: string }[];
  className?: string;
}) {
  const { set, params } = useUrlFilters();
  const value = params.get(paramKey) ?? options[0]?.value ?? "all";

  return (
    <NativeSelect
      aria-label={label}
      value={value}
      onChange={(e) => set({ [paramKey]: e.target.value })}
      className={cn("h-8 text-[13px] w-auto min-w-[124px]", className)}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </NativeSelect>
  );
}

export function ActiveFilters({
  filters,
}: {
  filters: { key: string; label: string; value: string }[];
}) {
  const { set, clearAll } = useUrlFilters();
  if (filters.length === 0) return null;

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {filters.map((f) => (
        <button
          key={f.key}
          type="button"
          onClick={() => set({ [f.key]: null })}
          className="inline-flex items-center gap-1 rounded-full border border-[var(--line-strong)] bg-[var(--surface-2)] pl-2 pr-1.5 py-0.5 text-[11.5px] text-ink-2 hover:border-[var(--ink-3)] transition-colors"
        >
          <span className="text-ink-3">{f.label}:</span>
          {f.value}
          <X className="size-3 text-[var(--ink-3)]" aria-hidden />
          <span className="sr-only">Remove filter</span>
        </button>
      ))}
      <Button variant="ghost" size="xs" onClick={clearAll}>
        Clear all
      </Button>
    </div>
  );
}

/** Page navigation. Server-rendered lists always know the true total. */
export function Pagination({
  page,
  pageCount,
  total,
  label = "items",
}: {
  page: number;
  pageCount: number;
  total: number;
  label?: string;
}) {
  const { set, pending } = useUrlFilters();
  if (pageCount <= 1) {
    return (
      <p className="text-[12px] text-ink-3 tnum">
        {total.toLocaleString()} {label}
      </p>
    );
  }

  return (
    <div className="flex items-center justify-between gap-3 w-full">
      <p className="text-[12px] text-ink-3 tnum">
        Page {page} of {pageCount} &middot; {total.toLocaleString()} {label}
      </p>
      <div className="flex items-center gap-1.5">
        <Button
          variant="secondary"
          size="sm"
          disabled={page <= 1 || pending}
          onClick={() => set({ page: String(page - 1) })}
        >
          Previous
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={page >= pageCount || pending}
          onClick={() => set({ page: String(page + 1) })}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
