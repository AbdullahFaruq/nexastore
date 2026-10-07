import { z } from "zod";
import {
  BUSINESS_TYPES, EXPENSE_CATEGORIES, MOVEMENT_TYPES, PAYMENT_METHODS,
  PRODUCT_STATUSES, ROLES, SALE_STATUSES,
} from "@/lib/db/models/enums";
import { CURRENCIES } from "@/lib/format/currency";
import { isValidTimezone } from "@/lib/format/dates";
import { isoDate, moneyInput, nonNegativeInt, objectId, optionalObjectId } from "./common";

const currencyCode = z
  .string()
  .toUpperCase()
  .refine((c) => c in CURRENCIES, { message: "Unsupported currency" });

const timezone = z.string().refine(isValidTimezone, { message: "Unknown timezone" });

/* ------------------------------------------------------------------ store */

export const createStoreSchema = z.object({
  name: z.string().trim().min(2, "Give your store a name").max(80),
  currency: currencyCode,
  timezone,
  businessType: z.enum(BUSINESS_TYPES).default("retail"),
});

export const updateStoreSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  currency: currencyCode.optional(),
  timezone: timezone.optional(),
  businessType: z.enum(BUSINESS_TYPES).optional(),
  address: z.string().max(240).optional(),
  phone: z.string().max(40).optional(),
  email: z.union([z.email(), z.literal("")]).optional(),
  logoUrl: z.union([z.url(), z.literal("")]).optional(),
});

export const storeSettingsSchema = z.object({
  defaultTaxRatePct: z.coerce.number().min(0).max(100).default(0),
  lowStockThreshold: nonNegativeInt.default(10),
  weekStartsOn: z.coerce.number().int().min(0).max(6).default(1),
  orderPrefix: z.string().trim().toUpperCase().min(1).max(6).default("NX"),
  taxMode: z.enum(["exclusive", "inclusive"]).default("exclusive"),
  receiptFooter: z.string().max(240).optional(),
});

/* --------------------------------------------------------------- category */

export const categorySchema = z.object({
  name: z.string().trim().min(1, "Name the category").max(60),
  description: z.string().max(240).optional(),
  colorSlot: z.coerce.number().int().min(0).max(7).default(0),
});

/* ---------------------------------------------------------------- product */

export const productSchema = z.object({
  name: z.string().trim().min(1, "Product name is required").max(140),
  sku: z
    .string()
    .trim()
    .toUpperCase()
    .min(1, "SKU is required")
    .max(40)
    .regex(/^[A-Z0-9][A-Z0-9._-]*$/, "Use letters, numbers, dots, dashes or underscores"),
  barcode: z.string().trim().max(60).optional(),
  description: z.string().max(2000).optional(),
  images: z.array(z.string()).max(6).default([]),
  categoryId: optionalObjectId,
  supplier: z.string().trim().max(120).optional(),
  costPrice: moneyInput,
  price: moneyInput,
  discountPrice: moneyInput.optional(),
  stock: z.coerce.number().int().min(0, "Stock cannot be negative").default(0),
  minStock: nonNegativeInt.default(5),
  taxRatePct: z.coerce.number().min(0).max(100).default(0),
  unit: z.string().trim().max(20).default("unit"),
  status: z.enum(PRODUCT_STATUSES).default("active"),
});

export const productFilterSchema = z.object({
  q: z.string().trim().max(120).optional(),
  categoryId: optionalObjectId,
  status: z.enum([...PRODUCT_STATUSES, "all"]).default("all"),
  stock: z.enum(["all", "healthy", "low", "critical", "out"]).default("all"),
  sort: z
    .enum(["name", "newest", "price_high", "price_low", "stock_low", "stock_high", "margin"])
    .default("newest"),
  page: z.coerce.number().int().min(1).default(1),
});

/* --------------------------------------------------------------- customer */

export const customerSchema = z.object({
  name: z.string().trim().min(1, "Customer name is required").max(120),
  email: z.union([z.email("Enter a valid email"), z.literal("")]).optional(),
  phone: z.string().trim().max(40).optional(),
  address: z.string().max(300).optional(),
  notes: z.string().max(2000).optional(),
  tags: z.array(z.string().max(24)).max(10).default([]),
});

/* ------------------------------------------------------------------- sale */

export const saleLineSchema = z.object({
  productId: objectId,
  quantity: z.coerce.number().int().min(1, "Quantity must be at least 1").max(100000),
  /** Optional per-line discount in MINOR units, validated server-side against the line total. */
  lineDiscount: z.coerce.number().int().min(0).default(0),
});

export const createSaleSchema = z.object({
  items: z.array(saleLineSchema).min(1, "Add at least one product to the sale"),
  customerId: optionalObjectId,
  orderDiscount: z.coerce.number().int().min(0).default(0),
  paymentMethod: z.enum(PAYMENT_METHODS).default("cash"),
  status: z.enum(["completed", "pending"]).default("completed"),
  amountPaid: z.coerce.number().int().min(0).default(0),
  note: z.string().max(1000).optional(),
  /** Backdating is allowed for manual entry; the server still records createdAt. */
  soldAt: isoDate.optional(),
});

export const refundSaleSchema = z.object({
  saleId: objectId,
  reason: z.string().trim().max(400).optional(),
  restock: z.coerce.boolean().default(true),
});

export const saleFilterSchema = z.object({
  q: z.string().trim().max(120).optional(),
  status: z.enum([...SALE_STATUSES, "all"]).default("all"),
  paymentMethod: z.enum([...PAYMENT_METHODS, "all"]).default("all"),
  customerId: optionalObjectId,
  from: z.string().optional(),
  to: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  sort: z.enum(["newest", "oldest", "amount_high", "amount_low"]).default("newest"),
});

/* ---------------------------------------------------------------- expense */

export const expenseSchema = z.object({
  category: z.enum(EXPENSE_CATEGORIES),
  amount: moneyInput,
  description: z.string().trim().min(1, "Describe the expense").max(200),
  vendor: z.string().trim().max(120).optional(),
  date: isoDate,
  paymentMethod: z.enum(PAYMENT_METHODS).default("bank_transfer"),
  receiptUrl: z.union([z.url("Enter a valid URL"), z.literal("")]).optional(),
  notes: z.string().max(2000).optional(),
  recurring: z.coerce.boolean().default(false),
  recurrenceInterval: z.enum(["weekly", "monthly", "quarterly", "yearly"]).optional(),
});

export const expenseFilterSchema = z.object({
  q: z.string().trim().max(120).optional(),
  category: z.enum([...EXPENSE_CATEGORIES, "all"]).default("all"),
  from: z.string().optional(),
  to: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
});

/* -------------------------------------------------------------- inventory */

export const stockAdjustmentSchema = z.object({
  productId: objectId,
  type: z.enum(MOVEMENT_TYPES).refine((t) => t !== "sale", {
    message: "Stock sold is recorded by completing a sale, not by adjusting inventory",
  }),
  /** Signed for adjustments; the action clamps the resulting stock at zero. */
  quantity: z.coerce.number().int().refine((n) => n !== 0, { message: "Enter a quantity" }),
  reason: z.string().trim().max(300).optional(),
  unitCost: moneyInput.optional(),
});

export const bulkStockSchema = z.object({
  productIds: z.array(objectId).min(1).max(200),
  action: z.enum(["archive", "activate", "set_min_stock", "set_category", "delete"]),
  minStock: nonNegativeInt.optional(),
  categoryId: optionalObjectId,
});

/* ------------------------------------------------------------------- team */

export const inviteMemberSchema = z.object({
  email: z.email("Enter a valid email address"),
  role: z.enum(ROLES),
  displayName: z.string().trim().max(120).optional(),
});

export const updateMemberSchema = z.object({
  membershipId: objectId,
  role: z.enum(ROLES).optional(),
  status: z.enum(["active", "invited", "suspended"]).optional(),
});

/* ------------------------------------------------------------ preferences */

export const preferencesSchema = z.object({
  theme: z.enum(["light", "dark", "system"]).optional(),
  defaultRange: z.string().max(24).optional(),
  sidebarCollapsed: z.coerce.boolean().optional(),
  hiddenWidgets: z.array(z.string().max(40)).max(40).optional(),
  widgetOrder: z.array(z.string().max(40)).max(40).optional(),
  numberFormat: z.enum(["standard", "compact"]).optional(),
});

/* ---------------------------------------------------------------- reports */

export const reportSchema = z.object({
  type: z.enum(["sales", "revenue", "expenses", "profit", "inventory", "products", "customers"]),
  preset: z.string().max(24).default("last_30"),
  from: z.string().optional(),
  to: z.string().optional(),
  format: z.enum(["csv", "json"]).default("csv"),
});

export type CreateStoreInput = z.infer<typeof createStoreSchema>;
export type ProductInput = z.infer<typeof productSchema>;
export type CreateSaleInput = z.infer<typeof createSaleSchema>;
export type ExpenseInput = z.infer<typeof expenseSchema>;
export type CustomerInput = z.infer<typeof customerSchema>;
export type StockAdjustmentInput = z.infer<typeof stockAdjustmentSchema>;
