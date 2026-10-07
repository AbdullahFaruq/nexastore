import { RANGE_PRESETS, resolveRange, type Grain, type RangePreset, type ResolvedRange } from "@/lib/format/dates";

const VALID_PRESETS = new Set<string>([...RANGE_PRESETS.map((p) => p.value), "custom"]);
const VALID_GRAINS: Grain[] = ["hour", "day", "week", "month", "year"];

export type SearchParams = Record<string, string | string[] | undefined>;

export function first(params: SearchParams | undefined, key: string): string | undefined {
  const v = params?.[key];
  return Array.isArray(v) ? v[0] : v;
}

/**
 * Turn URL search params into a resolved date window.
 *
 * Anything unrecognised falls back to the default rather than erroring - a
 * hand-edited or stale URL should still render a dashboard.
 */
export function rangeFromParams(
  params: SearchParams | undefined,
  timezone: string,
  weekStartsOn = 1,
  fallback: RangePreset = "last_30",
): ResolvedRange {
  const raw = first(params, "range");
  const preset = (raw && VALID_PRESETS.has(raw) ? raw : fallback) as RangePreset;
  return resolveRange(preset, timezone, {
    from: first(params, "from"),
    to: first(params, "to"),
    weekStartsOn,
  });
}

/** Grains that make sense for a window - a year in hourly buckets is 8,760 bars. */
export function grainsFor(range: ResolvedRange): Grain[] {
  const days = (range.to.getTime() - range.from.getTime()) / 86_400_000;
  const out: Grain[] = [];
  if (days <= 3) out.push("hour");
  if (days <= 200) out.push("day");
  if (days >= 10 && days <= 800) out.push("week");
  if (days >= 45) out.push("month");
  if (days >= 500) out.push("year");
  return out.length ? out : ["day"];
}

export function grainFromParams(params: SearchParams | undefined, range: ResolvedRange): Grain {
  const raw = first(params, "grain") as Grain | undefined;
  const allowed = grainsFor(range);
  if (raw && VALID_GRAINS.includes(raw) && allowed.includes(raw)) return raw;
  return allowed.includes(range.grain) ? range.grain : allowed[allowed.length - 1];
}

export function pageFromParams(params: SearchParams | undefined, key = "page") {
  const n = Number(first(params, key) ?? 1);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}
