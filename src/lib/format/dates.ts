/**
 * Timezone-correct date handling.
 *
 * Every store has an IANA timezone. "Today's revenue" for a store in Istanbul
 * must mean Istanbul's today, not the server's. All range boundaries are
 * computed in the store timezone and then expressed as UTC instants, which is
 * what Mongo stores and what $dateTrunc buckets against (with `timezone`).
 */

export type RangePreset =
  | "today"
  | "yesterday"
  | "this_week"
  | "last_week"
  | "this_month"
  | "last_month"
  | "this_quarter"
  | "this_year"
  | "last_year"
  | "last_7"
  | "last_30"
  | "last_90"
  | "custom";

export interface DateRange {
  /** Inclusive start instant (UTC). */
  from: Date;
  /** Exclusive end instant (UTC). */
  to: Date;
}

export interface ResolvedRange extends DateRange {
  preset: RangePreset;
  label: string;
  /** How to name the comparison window in prose, e.g. "last month". */
  previousLabel: string;
  /** Compact form for metric-card captions, e.g. "prev. 30 days". */
  previousShort: string;
  /** The window extends past now - this month, today, this year so far. */
  isPartial: boolean;
  /** How much of the window has actually elapsed, in ms. */
  elapsedMs: number;
  /** The immediately preceding window of equal length, for comparisons. */
  previous: DateRange;
  timezone: string;
  /** Suggested bucket size for charting this span. */
  grain: Grain;
}

export type Grain = "hour" | "day" | "week" | "month" | "year";

export const RANGE_PRESETS: { value: RangePreset; label: string; group: string }[] = [
  { value: "today", label: "Today", group: "Day" },
  { value: "yesterday", label: "Yesterday", group: "Day" },
  { value: "this_week", label: "This week", group: "Week" },
  { value: "last_week", label: "Last week", group: "Week" },
  { value: "last_7", label: "Last 7 days", group: "Week" },
  { value: "this_month", label: "This month", group: "Month" },
  { value: "last_month", label: "Last month", group: "Month" },
  { value: "last_30", label: "Last 30 days", group: "Month" },
  { value: "last_90", label: "Last 90 days", group: "Month" },
  { value: "this_quarter", label: "This quarter", group: "Year" },
  { value: "this_year", label: "This year", group: "Year" },
  { value: "last_year", label: "Last year", group: "Year" },
];

const PART_CACHE = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string) {
  let f = PART_CACHE.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    PART_CACHE.set(timeZone, f);
  }
  return f;
}

export interface ZonedParts {
  year: number;
  month: number; // 1-12
  day: number; // 1-31
  hour: number;
  minute: number;
  second: number;
  /** 0 = Sunday */
  weekday: number;
}

/** Break a UTC instant into its wall-clock parts in `timeZone`. */
export function zonedParts(date: Date, timeZone: string): ZonedParts {
  const parts = formatterFor(timeZone).formatToParts(date);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  const hour = get("hour");
  const asUtc = new Date(
    Date.UTC(get("year"), get("month") - 1, get("day"), hour === 24 ? 0 : hour, get("minute"), get("second")),
  );
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: hour === 24 ? 0 : hour,
    minute: get("minute"),
    second: get("second"),
    weekday: asUtc.getUTCDay(),
  };
}

/** Offset of `timeZone` from UTC at `date`, in minutes. */
function offsetMinutes(date: Date, timeZone: string) {
  const p = zonedParts(date, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return (asUtc - Math.floor(date.getTime() / 1000) * 1000) / 60000;
}

/**
 * Build the UTC instant for a wall-clock time in `timeZone`.
 * Two-pass so DST transitions resolve correctly.
 */
export function zonedTimeToUtc(
  timeZone: string,
  year: number,
  month: number, // 1-12
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
): Date {
  const naive = Date.UTC(year, month - 1, day, hour, minute, second);
  let guess = new Date(naive - offsetMinutes(new Date(naive), timeZone) * 60000);
  // Second pass corrects the case where the first guess landed on the other
  // side of a DST boundary.
  guess = new Date(naive - offsetMinutes(guess, timeZone) * 60000);
  return guess;
}

/** Midnight (start of day) in `timeZone` for the day containing `date`. */
export function startOfZonedDay(date: Date, timeZone: string, dayOffset = 0) {
  const p = zonedParts(date, timeZone);
  return zonedTimeToUtc(timeZone, p.year, p.month, p.day + dayOffset);
}

export function startOfZonedMonth(date: Date, timeZone: string, monthOffset = 0) {
  const p = zonedParts(date, timeZone);
  return zonedTimeToUtc(timeZone, p.year, p.month + monthOffset, 1);
}

export function startOfZonedYear(date: Date, timeZone: string, yearOffset = 0) {
  const p = zonedParts(date, timeZone);
  return zonedTimeToUtc(timeZone, p.year + yearOffset, 1, 1);
}

/** `weekStartsOn`: 0 = Sunday, 1 = Monday. */
export function startOfZonedWeek(date: Date, timeZone: string, weekStartsOn = 1, weekOffset = 0) {
  const p = zonedParts(date, timeZone);
  const diff = (p.weekday - weekStartsOn + 7) % 7;
  return zonedTimeToUtc(timeZone, p.year, p.month, p.day - diff + weekOffset * 7);
}

function pickGrain(from: Date, to: Date): Grain {
  const days = (to.getTime() - from.getTime()) / 86_400_000;
  if (days <= 2) return "hour";
  if (days <= 92) return "day";      // up to a quarter reads well as daily bars
  if (days <= 186) return "week";
  if (days <= 366 * 4) return "month"; // a full year is 12 bars, not 52
  return "year";
}

/**
 * Resolve a preset (or explicit custom bounds) into concrete UTC instants plus
 * the matching previous-period window.
 */
export function resolveRange(
  preset: RangePreset,
  timeZone: string,
  opts: { from?: Date | string | null; to?: Date | string | null; now?: Date; weekStartsOn?: number } = {},
): ResolvedRange {
  const now = opts.now ?? new Date();
  const weekStartsOn = opts.weekStartsOn ?? 1;
  const DAY = 86_400_000;

  let from: Date;
  let to: Date;
  let label: string;
  let previous: DateRange | null = null;

  switch (preset) {
    case "today":
      from = startOfZonedDay(now, timeZone);
      to = startOfZonedDay(now, timeZone, 1);
      label = "Today";
      break;
    case "yesterday":
      from = startOfZonedDay(now, timeZone, -1);
      to = startOfZonedDay(now, timeZone);
      label = "Yesterday";
      break;
    case "this_week":
      from = startOfZonedWeek(now, timeZone, weekStartsOn);
      to = startOfZonedWeek(now, timeZone, weekStartsOn, 1);
      label = "This week";
      break;
    case "last_week":
      from = startOfZonedWeek(now, timeZone, weekStartsOn, -1);
      to = startOfZonedWeek(now, timeZone, weekStartsOn);
      label = "Last week";
      break;
    case "this_month":
      from = startOfZonedMonth(now, timeZone);
      to = startOfZonedMonth(now, timeZone, 1);
      label = "This month";
      break;
    case "last_month":
      from = startOfZonedMonth(now, timeZone, -1);
      to = startOfZonedMonth(now, timeZone);
      label = "Last month";
      break;
    case "this_quarter": {
      const p = zonedParts(now, timeZone);
      const qStartMonth = Math.floor((p.month - 1) / 3) * 3 + 1;
      from = zonedTimeToUtc(timeZone, p.year, qStartMonth, 1);
      to = zonedTimeToUtc(timeZone, p.year, qStartMonth + 3, 1);
      label = `Q${Math.floor((p.month - 1) / 3) + 1} ${p.year}`;
      break;
    }
    case "this_year":
      from = startOfZonedYear(now, timeZone);
      to = startOfZonedYear(now, timeZone, 1);
      label = "This year";
      break;
    case "last_year":
      from = startOfZonedYear(now, timeZone, -1);
      to = startOfZonedYear(now, timeZone);
      label = "Last year";
      break;
    case "last_7":
      to = startOfZonedDay(now, timeZone, 1);
      from = startOfZonedDay(now, timeZone, -6);
      label = "Last 7 days";
      break;
    case "last_30":
      to = startOfZonedDay(now, timeZone, 1);
      from = startOfZonedDay(now, timeZone, -29);
      label = "Last 30 days";
      break;
    case "last_90":
      to = startOfZonedDay(now, timeZone, 1);
      from = startOfZonedDay(now, timeZone, -89);
      label = "Last 90 days";
      break;
    case "custom": {
      const f = opts.from ? new Date(opts.from) : startOfZonedDay(now, timeZone, -29);
      const t = opts.to ? new Date(opts.to) : now;
      const fp = zonedParts(f, timeZone);
      const tp = zonedParts(t, timeZone);
      from = zonedTimeToUtc(timeZone, fp.year, fp.month, fp.day);
      to = zonedTimeToUtc(timeZone, tp.year, tp.month, tp.day + 1);
      if (to <= from) to = new Date(from.getTime() + DAY);
      label = "Custom range";
      break;
    }
  }

  // Previous period: for calendar presets use the true previous calendar
  // window (so "this month" compares against last month, not "30 days ago").
  switch (preset) {
    case "this_month":
      previous = { from: startOfZonedMonth(now, timeZone, -1), to: startOfZonedMonth(now, timeZone) };
      break;
    case "last_month":
      previous = { from: startOfZonedMonth(now, timeZone, -2), to: startOfZonedMonth(now, timeZone, -1) };
      break;
    case "this_year":
      previous = { from: startOfZonedYear(now, timeZone, -1), to: startOfZonedYear(now, timeZone) };
      break;
    case "last_year":
      previous = { from: startOfZonedYear(now, timeZone, -2), to: startOfZonedYear(now, timeZone, -1) };
      break;
    case "this_week":
      previous = {
        from: startOfZonedWeek(now, timeZone, weekStartsOn, -1),
        to: startOfZonedWeek(now, timeZone, weekStartsOn),
      };
      break;
    case "last_week":
      previous = {
        from: startOfZonedWeek(now, timeZone, weekStartsOn, -2),
        to: startOfZonedWeek(now, timeZone, weekStartsOn, -1),
      };
      break;
    default: {
      const span = to.getTime() - from.getTime();
      previous = { from: new Date(from.getTime() - span), to: new Date(from.getTime()) };
    }
  }

  // A period still in progress must be compared against the SAME elapsed slice
  // of the previous one. Measuring five days of August against the whole of
  // July reports a 60% collapse in a business that is doing fine, and that is
  // the single most common way a dashboard lies to its owner.
  const isPartial = to.getTime() > now.getTime();
  const elapsedMs = Math.max(0, Math.min(now.getTime(), to.getTime()) - from.getTime());

  if (isPartial && elapsedMs > 0) {
    previous = {
      from: previous.from,
      to: new Date(Math.min(previous.from.getTime() + elapsedMs, previous.to.getTime())),
    };
  }

  return {
    from, to, previous, preset, label,
    previousLabel: isPartial
      ? (PARTIAL_LABEL[preset] ?? "the same point in the previous period")
      : (PREVIOUS_LABEL[preset] ?? "the previous period"),
    // Deliberately NOT suffixed with "to date": this string sits inside narrow
    // metric cards where it would clip. The full nuance is carried by
    // previousLabel, which is used where there is room for it.
    previousShort: PREVIOUS_SHORT[preset] ?? "prev. period",
    isPartial,
    elapsedMs,
    timezone: timeZone,
    grain: pickGrain(from, to),
  };
}

/**
 * Names for the comparison window. Written out rather than derived, because
 * "the previous this year" is what derivation produces and it reads terribly.
 */
/** How to name the comparison when the current window is still running. */
const PARTIAL_LABEL: Record<RangePreset, string> = {
  today: "the same time yesterday",
  yesterday: "the day before",
  this_week: "the same point last week",
  last_week: "the week before",
  this_month: "the same point last month",
  last_month: "the month before",
  this_quarter: "the same point last quarter",
  this_year: "the same point last year",
  last_year: "the year before",
  last_7: "the previous 7 days",
  last_30: "the previous 30 days",
  last_90: "the previous 90 days",
  custom: "the preceding period",
};

const PREVIOUS_SHORT: Record<RangePreset, string> = {
  today: "yesterday",
  yesterday: "day before",
  this_week: "last week",
  last_week: "week before",
  this_month: "last month",
  last_month: "month before",
  this_quarter: "last quarter",
  this_year: "last year",
  last_year: "year before",
  last_7: "prev. 7 days",
  last_30: "prev. 30 days",
  last_90: "prev. 90 days",
  custom: "prev. period",
};

const PREVIOUS_LABEL: Record<RangePreset, string> = {
  today: "yesterday",
  yesterday: "the day before",
  this_week: "last week",
  last_week: "the week before",
  this_month: "last month",
  last_month: "the month before",
  this_quarter: "last quarter",
  this_year: "last year",
  last_year: "the year before",
  last_7: "the previous 7 days",
  last_30: "the previous 30 days",
  last_90: "the previous 90 days",
  custom: "the preceding period",
};

const DATE_FMT_CACHE = new Map<string, Intl.DateTimeFormat>();
function fmt(key: string, timeZone: string, options: Intl.DateTimeFormatOptions) {
  const k = `${key}|${timeZone}`;
  let f = DATE_FMT_CACHE.get(k);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", { timeZone, ...options });
    DATE_FMT_CACHE.set(k, f);
  }
  return f;
}

export function formatDate(d: Date | string, timeZone = "UTC") {
  return fmt("d", timeZone, { month: "short", day: "numeric", year: "numeric" }).format(new Date(d));
}

export function formatDateTime(d: Date | string, timeZone = "UTC") {
  return fmt("dt", timeZone, {
    month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit",
  }).format(new Date(d));
}

export function formatTime(d: Date | string, timeZone = "UTC") {
  return fmt("t", timeZone, { hour: "numeric", minute: "2-digit" }).format(new Date(d));
}

export function formatDayLong(d: Date | string, timeZone = "UTC") {
  return fmt("dl", timeZone, { weekday: "long", month: "long", day: "numeric" }).format(new Date(d));
}

/** "3 minutes ago", "in 2 days" - for activity feeds and notifications. */
export function relativeTime(d: Date | string, now = new Date()) {
  const then = new Date(d).getTime();
  const diff = then - now.getTime();
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat("en-US", { numeric: "auto" });
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 31_536_000_000],
    ["month", 2_592_000_000],
    ["week", 604_800_000],
    ["day", 86_400_000],
    ["hour", 3_600_000],
    ["minute", 60_000],
  ];
  for (const [unit, ms] of units) {
    if (abs >= ms) return rtf.format(Math.round(diff / ms), unit);
  }
  return "just now";
}

/** Human label for a bucket boundary at a given grain. */
export function bucketLabel(d: Date | string, grain: Grain, timeZone = "UTC") {
  const date = new Date(d);
  switch (grain) {
    case "hour":
      return fmt("bh", timeZone, { hour: "numeric" }).format(date);
    case "day":
      return fmt("bd", timeZone, { month: "short", day: "numeric" }).format(date);
    case "week":
      return `Wk of ${fmt("bw", timeZone, { month: "short", day: "numeric" }).format(date)}`;
    case "month":
      return fmt("bm", timeZone, { month: "short", year: "2-digit" }).format(date);
    case "year":
      return fmt("by", timeZone, { year: "numeric" }).format(date);
  }
}

export const COMMON_TIMEZONES = [
  "UTC",
  "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles",
  "America/Toronto", "America/Sao_Paulo", "Europe/London", "Europe/Dublin",
  "Europe/Paris", "Europe/Berlin", "Europe/Madrid", "Europe/Rome",
  "Europe/Amsterdam", "Europe/Stockholm", "Europe/Istanbul", "Europe/Moscow",
  "Africa/Cairo", "Africa/Lagos", "Africa/Johannesburg", "Africa/Nairobi",
  "Asia/Dubai", "Asia/Riyadh", "Asia/Karachi", "Asia/Kolkata", "Asia/Dhaka",
  "Asia/Bangkok", "Asia/Singapore", "Asia/Shanghai", "Asia/Tokyo", "Asia/Seoul",
  "Australia/Sydney", "Australia/Perth", "Pacific/Auckland",
];

export function isValidTimezone(tz: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}
