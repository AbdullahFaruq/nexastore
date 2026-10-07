import { Schema, model, models, type Model, type Types } from "mongoose";
import { baseSchemaOptions, tenantFields } from "./shared";
import { MOVEMENT_TYPES, type MovementType } from "./enums";

/**
 * Append-only audit log. Every single change to Product.stock writes one of
 * these in the same transaction, so any stock level can be reconstructed and
 * explained. Nothing mutates stock without leaving a row here.
 */
export interface InventoryMovementDoc {
  _id: Types.ObjectId;
  storeId: Types.ObjectId;
  productId: Types.ObjectId;
  productName: string;
  sku: string;
  type: MovementType;
  /** Signed: negative for sales and damage, positive for purchases and returns. */
  quantity: number;
  stockBefore: number;
  stockAfter: number;
  /** Unit cost involved, when the movement has one (purchases, sales). */
  unitCost?: number;
  saleId?: Types.ObjectId | null;
  orderNumber?: string;
  reason?: string;
  createdBy: string;
  createdByName?: string;
  isDemo: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const InventoryMovementSchema = new Schema<InventoryMovementDoc>(
  {
    ...tenantFields,
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true, index: true },
    productName: { type: String, required: true },
    sku: { type: String, required: true },
    type: { type: String, enum: MOVEMENT_TYPES, required: true, index: true },
    quantity: { type: Number, required: true },
    stockBefore: { type: Number, required: true },
    stockAfter: { type: Number, required: true },
    unitCost: Number,
    saleId: { type: Schema.Types.ObjectId, ref: "Sale", default: null },
    orderNumber: String,
    reason: { type: String, maxlength: 300 },
    createdBy: { type: String, required: true },
    createdByName: String,
  },
  baseSchemaOptions,
);

InventoryMovementSchema.index({ storeId: 1, createdAt: -1 });
InventoryMovementSchema.index({ storeId: 1, productId: 1, createdAt: -1 });
InventoryMovementSchema.index({ storeId: 1, type: 1, createdAt: -1 });

export const InventoryMovement: Model<InventoryMovementDoc> =
  (models.InventoryMovement as Model<InventoryMovementDoc>) ||
  model<InventoryMovementDoc>("InventoryMovement", InventoryMovementSchema);
