import { allocate } from "@/lib/format/currency";

/**
 * The pricing engine. Every monetary total in the product is produced here and
 * nowhere else - the browser sends product ids, quantities and a discount, and
 * the server derives every figure from its own copy of the prices.
 *
 * All inputs and outputs are integer minor units.
 */

export interface PricingLineInput {
  productId: string;
  quantity: number;
  /** Server-resolved selling price, never client-supplied. */
  unitPrice: number;
  /** Server-resolved cost at the moment of sale. */
  unitCost: number;
  /** Discount on this line, in minor units (already validated <= gross). */
  lineDiscount?: number;
  taxRateBps?: number;
}

export interface PricedLine {
  productId: string;
  quantity: number;
  unitPrice: number;
  unitCost: number;
  taxRateBps: number;
  lineDiscount: number;
  allocatedOrderDiscount: number;
  /** unitPrice * quantity, before any discount. */
  grossAmount: number;
  /** Ex-tax revenue for this line, after all discounts. */
  netRevenue: number;
  taxAmount: number;
  cogsAmount: number;
}

export interface SaleTotals {
  lines: PricedLine[];
  grossAmount: number;
  lineDiscountTotal: number;
  orderDiscount: number;
  discountTotal: number;
  netRevenue: number;
  taxTotal: number;
  total: number;
  cogsTotal: number;
  itemCount: number;
  lineCount: number;
  grossProfit: number;
  marginPct: number;
}

export type TaxMode = "exclusive" | "inclusive";

/**
 * Split a tax-inclusive amount into its ex-tax base.
 * base = amount * 10000 / (10000 + bps), rounded to the nearest minor unit.
 */
function exTaxBase(amountInclusive: number, bps: number) {
  if (bps <= 0) return amountInclusive;
  return Math.round((amountInclusive * 10000) / (10000 + bps));
}

export function computeSaleTotals(
  input: PricingLineInput[],
  opts: { orderDiscount?: number; taxMode?: TaxMode } = {},
): SaleTotals {
  const taxMode: TaxMode = opts.taxMode ?? "exclusive";
  const lines = input.filter((l) => l.quantity > 0);

  // 1. Line gross and line-level discounts.
  const gross = lines.map((l) => l.unitPrice * l.quantity);
  const lineDiscounts = lines.map((l, i) => Math.min(Math.max(l.lineDiscount ?? 0, 0), gross[i]));
  const afterLineDiscount = gross.map((g, i) => g - lineDiscounts[i]);

  const subtotal = afterLineDiscount.reduce((a, b) => a + b, 0);

  // 2. The order-level discount is allocated across lines in proportion to
  //    their post-line-discount value, so per-line tax stays correct and the
  //    allocation sums back to exactly the discount given (largest remainder).
  const orderDiscount = Math.min(Math.max(opts.orderDiscount ?? 0, 0), subtotal);
  const allocated = allocate(orderDiscount, afterLineDiscount);

  const priced: PricedLine[] = lines.map((l, i) => {
    const bps = Math.max(l.taxRateBps ?? 0, 0);
    const lineNet = afterLineDiscount[i] - allocated[i];

    let netRevenue: number;
    let taxAmount: number;

    if (taxMode === "inclusive") {
      // The entered price already contains tax; back it out.
      netRevenue = exTaxBase(lineNet, bps);
      taxAmount = lineNet - netRevenue;
    } else {
      netRevenue = lineNet;
      taxAmount = Math.round((lineNet * bps) / 10000);
    }

    return {
      productId: l.productId,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      unitCost: l.unitCost,
      taxRateBps: bps,
      lineDiscount: lineDiscounts[i],
      allocatedOrderDiscount: allocated[i],
      grossAmount: gross[i],
      netRevenue,
      taxAmount,
      cogsAmount: l.unitCost * l.quantity,
    };
  });

  const sum = (f: (l: PricedLine) => number) => priced.reduce((a, l) => a + f(l), 0);

  const grossAmount = sum((l) => l.grossAmount);
  const lineDiscountTotal = sum((l) => l.lineDiscount);
  const netRevenue = sum((l) => l.netRevenue);
  const taxTotal = sum((l) => l.taxAmount);
  const cogsTotal = sum((l) => l.cogsAmount);
  const discountTotal = lineDiscountTotal + orderDiscount;

  // Under inclusive tax the customer pays the entered price, which already
  // contains the tax - so the total is the ex-tax revenue plus the tax we just
  // separated out. Both modes therefore agree on `total`.
  const total = netRevenue + taxTotal;

  const grossProfit = netRevenue - cogsTotal;

  return {
    lines: priced,
    grossAmount,
    lineDiscountTotal,
    orderDiscount,
    discountTotal,
    netRevenue,
    taxTotal,
    total,
    cogsTotal,
    itemCount: priced.reduce((a, l) => a + l.quantity, 0),
    lineCount: priced.length,
    grossProfit,
    marginPct: netRevenue > 0 ? (grossProfit / netRevenue) * 100 : 0,
  };
}

/** Profit metrics for a single product, used across product pages and tables. */
export function unitEconomics(price: number, cost: number, discountPrice?: number | null) {
  const effective = discountPrice != null && discountPrice > 0 && discountPrice < price ? discountPrice : price;
  const profit = effective - cost;
  return {
    effectivePrice: effective,
    profitPerUnit: profit,
    marginPct: effective > 0 ? (profit / effective) * 100 : 0,
    markupPct: cost > 0 ? (profit / cost) * 100 : 0,
    isDiscounted: effective !== price,
  };
}
