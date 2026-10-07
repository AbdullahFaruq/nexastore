import type { ExpenseCategory } from "@/lib/db/models/enums";

/**
 * Labels and chart slots for expense categories.
 *
 * Pure data, kept out of the analytics module so client components can import
 * it without pulling the Mongo driver into the browser bundle.
 */
export const EXPENSE_CATEGORY_META: Record<
  ExpenseCategory,
  { label: string; colorSlot: number; hint: string }
> = {
  rent: { label: "Rent", colorSlot: 0, hint: "Premises and leases" },
  salaries: { label: "Salaries", colorSlot: 1, hint: "Wages and payroll" },
  utilities: { label: "Utilities", colorSlot: 2, hint: "Power, water, internet" },
  marketing: { label: "Marketing", colorSlot: 3, hint: "Ads and promotion" },
  shipping: { label: "Shipping", colorSlot: 4, hint: "Delivery and courier" },
  supplies: { label: "Supplies", colorSlot: 5, hint: "Consumables and packaging" },
  maintenance: { label: "Maintenance", colorSlot: 6, hint: "Repairs and upkeep" },
  taxes: { label: "Taxes", colorSlot: 7, hint: "Duties and levies" },
  other: { label: "Other", colorSlot: 7, hint: "Anything uncategorised" },
};

