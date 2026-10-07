/**
 * Money handling.
 *
 * INVARIANT: every monetary value that touches MongoDB is an INTEGER in the
 * currency's minor unit (cents for USD, fils for AED, yen for JPY). Floating
 * point never stores money. Conversion to a float happens only at the display
 * boundary, and only inside this module.
 */

export type CurrencyCode =
  | "USD" | "EUR" | "GBP" | "TRY" | "AED" | "SAR"
  | "JPY" | "CAD" | "AUD" | "INR" | "EGP" | "NGN" | "ZAR" | "CHF" | "SEK";

export interface CurrencyMeta {
  code: CurrencyCode;
  name: string;
  symbol: string;
  /** Number of decimal places in the minor unit. */
  exponent: number;
  /** Default locale used for grouping/placement when the store has none. */
  locale: string;
}

export const CURRENCIES: Record<CurrencyCode, CurrencyMeta> = {
  USD: { code: "USD", name: "US Dollar", symbol: "$", exponent: 2, locale: "en-US" },
  EUR: { code: "EUR", name: "Euro", symbol: "€", exponent: 2, locale: "de-DE" },
  GBP: { code: "GBP", name: "British Pound", symbol: "£", exponent: 2, locale: "en-GB" },
  TRY: { code: "TRY", name: "Turkish Lira", symbol: "₺", exponent: 2, locale: "tr-TR" },
  AED: { code: "AED", name: "UAE Dirham", symbol: "د.إ", exponent: 2, locale: "en-AE" },
  SAR: { code: "SAR", name: "Saudi Riyal", symbol: "ر.س", exponent: 2, locale: "en-SA" },
  JPY: { code: "JPY", name: "Japanese Yen", symbol: "¥", exponent: 0, locale: "ja-JP" },
  CAD: { code: "CAD", name: "Canadian Dollar", symbol: "CA$", exponent: 2, locale: "en-CA" },
  AUD: { code: "AUD", name: "Australian Dollar", symbol: "A$", exponent: 2, locale: "en-AU" },
  INR: { code: "INR", name: "Indian Rupee", symbol: "₹", exponent: 2, locale: "en-IN" },
  EGP: { code: "EGP", name: "Egyptian Pound", symbol: "E£", exponent: 2, locale: "en-EG" },
  NGN: { code: "NGN", name: "Nigerian Naira", symbol: "₦", exponent: 2, locale: "en-NG" },
  ZAR: { code: "ZAR", name: "South African Rand", symbol: "R", exponent: 2, locale: "en-ZA" },
  CHF: { code: "CHF", name: "Swiss Franc", symbol: "CHF", exponent: 2, locale: "de-CH" },
  SEK: { code: "SEK", name: "Swedish Krona", symbol: "kr", exponent: 2, locale: "sv-SE" },
};

export const CURRENCY_LIST = Object.values(CURRENCIES);

export function currencyMeta(code: string): CurrencyMeta {
  return CURRENCIES[code as CurrencyCode] ?? CURRENCIES.USD;
}

export function minorUnitFactor(code: string) {
  return 10 ** currencyMeta(code).exponent;
}

/** Parse user input ("1,234.56") into integer minor units. Returns null if invalid. */
export function parseMoney(input: string | number, code: string): number | null {
  if (typeof input === "number") {
    if (!Number.isFinite(input)) return null;
    return Math.round(input * minorUnitFactor(code));
  }
  const cleaned = input.replace(/[\s, ]/g, "").replace(/[^0-9.\-]/g, "");
  if (cleaned === "" || cleaned === "-" || cleaned === ".") return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * minorUnitFactor(code));
}

/** Integer minor units -> major-unit float. Display boundary only. */
export function toMajor(minor: number, code: string) {
  return minor / minorUnitFactor(code);
}

export interface FormatMoneyOptions {
  /** Render as "$24.9K" instead of "$24,850.00". */
  compact?: boolean;
  /** Drop the fraction ("$24,850"). */
  noDecimals?: boolean;
  /** Prefix a "+" on positive values (deltas). */
  signed?: boolean;
  locale?: string;
}

/**
 * Format integer minor units for display.
 * Always pass the store's currency code - there is no hardcoded "$" anywhere
 * in the product.
 */
export function formatMoney(minor: number, code: string, opts: FormatMoneyOptions = {}) {
  const meta = currencyMeta(code);
  const locale = opts.locale ?? meta.locale;
  const value = toMajor(minor, code);

  const fraction = opts.noDecimals || opts.compact ? 0 : meta.exponent;
  const formatted = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: meta.code,
    notation: opts.compact ? "compact" : "standard",
    minimumFractionDigits: opts.compact ? 0 : fraction,
    maximumFractionDigits: opts.compact ? 1 : fraction,
    currencyDisplay: "narrowSymbol",
  }).format(value);

  if (opts.signed && minor > 0) return `+${formatted}`;
  return formatted;
}

/** Just the number, no currency symbol - for table columns with a unit header. */
export function formatMoneyPlain(minor: number, code: string) {
  const meta = currencyMeta(code);
  return new Intl.NumberFormat(meta.locale, {
    minimumFractionDigits: meta.exponent,
    maximumFractionDigits: meta.exponent,
  }).format(toMajor(minor, code));
}

/**
 * Distribute `total` minor units across `weights` without losing or inventing a
 * unit. Used to allocate an order-level discount across lines so per-line tax
 * stays correct. The remainder goes to the largest weights (largest-remainder
 * method), which is the standard accounting allocation.
 */
export function allocate(total: number, weights: number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (sum <= 0 || total === 0) return weights.map(() => 0);

  const exact = weights.map((w) => (total * w) / sum);
  const floored = exact.map((n) => Math.floor(n));
  let remainder = total - floored.reduce((a, b) => a + b, 0);

  const order = exact
    .map((n, i) => ({ i, frac: n - Math.floor(n) }))
    .sort((a, b) => b.frac - a.frac);

  const out = [...floored];
  for (let k = 0; remainder > 0 && k < order.length; k++, remainder--) {
    out[order[k].i] += 1;
  }
  return out;
}
