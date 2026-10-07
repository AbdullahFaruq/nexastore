/**
 * Customer segment definitions.
 *
 * Pure data with no database dependency, so the segment filter strip can
 * import it in the browser.
 */
export type CustomerSegment = "new" | "returning" | "vip" | "inactive" | "at_risk";

export const SEGMENT_META: Record<
  CustomerSegment,
  { label: string; description: string; colorSlot: number }
> = {
  vip: { label: "VIP", description: "Top 10% by lifetime spend, still active.", colorSlot: 0 },
  returning: { label: "Returning", description: "More than one order and active recently.", colorSlot: 1 },
  new: { label: "New", description: "First order within the last 30 days.", colorSlot: 2 },
  at_risk: { label: "At risk", description: "Used to buy regularly; quiet for 60-120 days.", colorSlot: 3 },
  inactive: { label: "Inactive", description: "No purchase in over 120 days.", colorSlot: 7 },
};

