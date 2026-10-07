import { Schema, model, models, type Model, type Types } from "mongoose";
import { baseSchemaOptions, tenantFields } from "./shared";
import { PAYMENT_METHODS, PAYMENT_STATUSES, SALE_STATUSES, type PaymentMethod, type PaymentStatus, type SaleStatus } from "./enums";

/**
 * ===========================================================================
 * MONEY DEFINITIONS - the single authority for this product.
 * All fields are INTEGER minor units of the store currency.
 * ---------------------------------------------------------------------------
 *  grossAmount        SUM(unitPrice * quantity)          list price, pre-discount
 *  lineDiscountTotal  SUM(per-line discounts)
 *  orderDiscount      one discount applied to the whole order
 *  discountTotal      lineDiscountTotal + orderDiscount
 *  netRevenue         grossAmount - discountTotal        <-- THIS IS "REVENUE"
 *  taxTotal           tax charged on netRevenue          NOT revenue: a liability
 *  total              netRevenue + taxTotal              what the customer pays
 *  cogsTotal          SUM(unitCost * quantity)           cost snapshot at sale time
 *  refundedRevenue    ex-tax revenue reversed
 *  refundedCogs       cost reversed alongside it
 *
 * Recognised revenue for one sale = netRevenue - refundedRevenue, and only
 * when status is "completed" or "refunded". "pending" and "cancelled" sales
 * contribute nothing; pending is reported separately as committed-but-unearned.
 *
 * Tax is EXCLUSIVE by default (added on top). Under inclusive mode the entered
 * price already contains tax and netRevenue is backed out of it - the split is
 * always performed server-side in lib/sales/pricing.ts, never in the browser.
 * ===========================================================================
 */
export interface SaleDoc {
  _id: Types.ObjectId;
  storeId: Types.ObjectId;
  orderNumber: string;
  /** Monotonic per-store sequence behind orderNumber; used for stable sorting. */
  sequence: number;

  customerId?: Types.ObjectId | null;
  /** Snapshot so a deleted customer never breaks order history. */
  customerName?: string;

  grossAmount: number;
  lineDiscountTotal: number;
  orderDiscount: number;
  discountTotal: number;
  netRevenue: number;
  taxTotal: number;
  total: number;
  cogsTotal: number;

  refundedRevenue: number;
  refundedTax: number;
  refundedCogs: number;
  refundedAt?: Date | null;
  refundReason?: string;

  itemCount: number;
  lineCount: number;

  status: SaleStatus;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  amountPaid: number;
  changeGiven: number;

  channel: "pos" | "online" | "manual";
  note?: string;
  /** When the sale is recognised. Every financial rollup buckets on this. */
  soldAt: Date;
  createdBy: string;
  createdByName?: string;
  isDemo: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const SaleSchema = new Schema<SaleDoc>(
  {
    ...tenantFields,
    orderNumber: { type: String, required: true },
    sequence: { type: Number, required: true },

    customerId: { type: Schema.Types.ObjectId, ref: "Customer", default: null, index: true },
    customerName: String,

    grossAmount: { type: Number, required: true, min: 0 },
    lineDiscountTotal: { type: Number, required: true, min: 0, default: 0 },
    orderDiscount: { type: Number, required: true, min: 0, default: 0 },
    discountTotal: { type: Number, required: true, min: 0, default: 0 },
    netRevenue: { type: Number, required: true, min: 0 },
    taxTotal: { type: Number, required: true, min: 0, default: 0 },
    total: { type: Number, required: true, min: 0 },
    cogsTotal: { type: Number, required: true, min: 0, default: 0 },

    refundedRevenue: { type: Number, default: 0, min: 0 },
    refundedTax: { type: Number, default: 0, min: 0 },
    refundedCogs: { type: Number, default: 0, min: 0 },
    refundedAt: { type: Date, default: null },
    refundReason: { type: String, maxlength: 400 },

    itemCount: { type: Number, required: true, min: 0 },
    lineCount: { type: Number, required: true, min: 0 },

    status: { type: String, enum: SALE_STATUSES, default: "completed", index: true },
    paymentMethod: { type: String, enum: PAYMENT_METHODS, default: "cash" },
    paymentStatus: { type: String, enum: PAYMENT_STATUSES, default: "paid" },
    amountPaid: { type: Number, default: 0, min: 0 },
    changeGiven: { type: Number, default: 0, min: 0 },

    channel: { type: String, enum: ["pos", "online", "manual"], default: "pos" },
    note: { type: String, maxlength: 1000 },
    soldAt: { type: Date, required: true, index: true },
    createdBy: { type: String, required: true },
    createdByName: String,
  },
  baseSchemaOptions,
);

SaleSchema.index({ storeId: 1, orderNumber: 1 }, { unique: true });
SaleSchema.index({ storeId: 1, sequence: -1 });
// The workhorse index: every dashboard rollup is a range scan on this.
SaleSchema.index({ storeId: 1, status: 1, soldAt: -1 });
SaleSchema.index({ storeId: 1, soldAt: -1 });
SaleSchema.index({ storeId: 1, customerId: 1, soldAt: -1 });
SaleSchema.index({ storeId: 1, paymentMethod: 1, soldAt: -1 });

export const Sale: Model<SaleDoc> =
  (models.Sale as Model<SaleDoc>) || model<SaleDoc>("Sale", SaleSchema);
