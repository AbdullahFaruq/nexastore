/**
 * Stock classification.
 *
 * Pure, dependency-free, and therefore safe to import from client components -
 * the analytics module that computes these server-side re-exports it rather
 * than owning it, so a table badge cannot drag the Mongo driver into the
 * browser bundle.
 */
export type StockStatus = "healthy" | "low" | "critical" | "out";

export const STOCK_STATUS_META: Record<
  StockStatus,
  { label: string; tone: "good" | "warning" | "serious" | "critical" | "neutral"; description: string }
> = {
  healthy: { label: "Healthy", tone: "good", description: "Comfortably above the reorder point." },
  low: { label: "Running low", tone: "warning", description: "At or below the reorder point." },
  critical: { label: "Critical", tone: "critical", description: "Days from selling out at the current rate." },
  out: { label: "Out of stock", tone: "neutral", description: "Nothing left to sell." },
};

/** Worst first, for the restock queue. */
export const STOCK_STATUS_RANK: Record<StockStatus, number> = {
  out: 0, critical: 1, low: 2, healthy: 3,
};

/**
 * Velocity beats a static threshold: 40 units is not "healthy" if the shop
 * sells 30 a day, and 4 units is fine if it sells one a month. The reorder
 * point is the floor, not the whole story.
 */
export function classifyStock(
  stock: number,
  minStock: number,
  daysRemaining: number | null,
): StockStatus {
  if (stock <= 0) return "out";
  if (daysRemaining !== null && daysRemaining <= 3) return "critical";
  if (stock <= minStock) return daysRemaining !== null && daysRemaining <= 7 ? "critical" : "low";
  if (daysRemaining !== null && daysRemaining <= 7) return "low";
  return "healthy";
}
