/**
 * Domain enumerations.
 *
 * Deliberately free of any Mongoose import: these constants are used by forms,
 * badges and filters in the browser as well as by the schemas on the server,
 * and a single `import { Schema }` here would drag the entire Mongo driver
 * into the client bundle.
 */

export const ROLES = ["owner", "manager", "employee"] as const;
export type Role = (typeof ROLES)[number];

export const SALE_STATUSES = ["completed", "pending", "refunded", "cancelled"] as const;
export type SaleStatus = (typeof SALE_STATUSES)[number];

export const PAYMENT_METHODS = ["cash", "card", "bank_transfer", "mobile", "other"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_STATUSES = ["paid", "unpaid", "partial", "refunded"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PRODUCT_STATUSES = ["active", "draft", "archived"] as const;
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

export const EXPENSE_CATEGORIES = [
  "rent", "salaries", "utilities", "marketing", "shipping",
  "supplies", "maintenance", "taxes", "other",
] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const MOVEMENT_TYPES = [
  "initial", "purchase", "sale", "adjustment", "return", "damage", "transfer",
] as const;
export type MovementType = (typeof MOVEMENT_TYPES)[number];

export const BUSINESS_TYPES = [
  "retail", "grocery", "fashion", "electronics", "pharmacy",
  "restaurant", "cafe", "beauty", "hardware", "bookstore", "other",
] as const;
export type BusinessType = (typeof BUSINESS_TYPES)[number];

export const NOTIFICATION_PRIORITIES = ["critical", "high", "normal", "low"] as const;
export type NotificationPriority = (typeof NOTIFICATION_PRIORITIES)[number];
