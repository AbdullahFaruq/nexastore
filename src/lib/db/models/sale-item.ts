import { Schema, model, models, type Model, type Types } from "mongoose";
import { baseSchemaOptions, tenantFields } from "./shared";
import { SALE_STATUSES, type SaleStatus } from "./enums";

/**
 * The line-item ledger. This is the source of truth for product- and
 * category-level analytics; Sale carries the denormalised header totals so a
 * revenue rollup does not have to touch this collection at all.
 *
 * `soldAt`, `status` and `categoryId` are copied down from the parent Sale so
 * product analytics is a single indexed range scan with no $lookup.
 * Both are written in the same transaction, so they cannot drift.
 */
export interface SaleItemDoc {
  _id: Types.ObjectId;
  storeId: Types.ObjectId;
  saleId: Types.ObjectId;
  orderNumber: string;

  productId: Types.ObjectId;
  categoryId?: Types.ObjectId | null;
  /** Snapshots - an order must still render after the product is renamed. */
  productName: string;
  sku: string;
  productImage?: string;

  quantity: number;
  /** Price charged per unit, pre-discount, ex-tax. */
  unitPrice: number;
  /** Cost per unit at the moment of sale. Never re-read from Product later. */
  unitCost: number;
  lineDiscount: number;
  /** Share of the order-level discount allocated to this line. */
  allocatedOrderDiscount: number;
  taxRateBps: number;

  grossAmount: number;
  netRevenue: number;
  taxAmount: number;
  cogsAmount: number;

  refundedQuantity: number;
  refundedRevenue: number;
  refundedCogs: number;

  status: SaleStatus;
  soldAt: Date;
  isDemo: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const SaleItemSchema = new Schema<SaleItemDoc>(
  {
    ...tenantFields,
    saleId: { type: Schema.Types.ObjectId, ref: "Sale", required: true, index: true },
    orderNumber: { type: String, required: true },

    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true, index: true },
    categoryId: { type: Schema.Types.ObjectId, ref: "Category", default: null },
    productName: { type: String, required: true },
    sku: { type: String, required: true },
    productImage: String,

    quantity: { type: Number, required: true, min: 0 },
    unitPrice: { type: Number, required: true, min: 0 },
    unitCost: { type: Number, required: true, min: 0 },
    lineDiscount: { type: Number, default: 0, min: 0 },
    allocatedOrderDiscount: { type: Number, default: 0, min: 0 },
    taxRateBps: { type: Number, default: 0, min: 0 },

    grossAmount: { type: Number, required: true, min: 0 },
    netRevenue: { type: Number, required: true, min: 0 },
    taxAmount: { type: Number, default: 0, min: 0 },
    cogsAmount: { type: Number, default: 0, min: 0 },

    refundedQuantity: { type: Number, default: 0, min: 0 },
    refundedRevenue: { type: Number, default: 0, min: 0 },
    refundedCogs: { type: Number, default: 0, min: 0 },

    status: { type: String, enum: SALE_STATUSES, default: "completed" },
    soldAt: { type: Date, required: true },
  },
  baseSchemaOptions,
);

// Product performance: storeId + productId + time window, covered.
SaleItemSchema.index({ storeId: 1, productId: 1, soldAt: -1 });
SaleItemSchema.index({ storeId: 1, categoryId: 1, soldAt: -1 });
SaleItemSchema.index({ storeId: 1, status: 1, soldAt: -1 });
SaleItemSchema.index({ storeId: 1, saleId: 1 });

export const SaleItem: Model<SaleItemDoc> =
  (models.SaleItem as Model<SaleItemDoc>) || model<SaleItemDoc>("SaleItem", SaleItemSchema);
