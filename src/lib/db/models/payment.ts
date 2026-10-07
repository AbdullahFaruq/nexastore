import { Schema, model, models, type Model, type Types } from "mongoose";
import { baseSchemaOptions, tenantFields } from "./shared";
import { PAYMENT_METHODS, type PaymentMethod } from "./enums";

/**
 * The cash ledger, kept separate from the Sale header so an order can be
 * settled across several tenders and so refunds are recorded as their own
 * negative movement rather than by editing history.
 */
export interface PaymentDoc {
  _id: Types.ObjectId;
  storeId: Types.ObjectId;
  saleId: Types.ObjectId;
  orderNumber: string;
  method: PaymentMethod;
  /** Positive for a capture, negative for a refund. Integer minor units. */
  amount: number;
  kind: "capture" | "refund";
  reference?: string;
  createdBy: string;
  isDemo: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const PaymentSchema = new Schema<PaymentDoc>(
  {
    ...tenantFields,
    saleId: { type: Schema.Types.ObjectId, ref: "Sale", required: true, index: true },
    orderNumber: { type: String, required: true },
    method: { type: String, enum: PAYMENT_METHODS, required: true },
    amount: { type: Number, required: true },
    kind: { type: String, enum: ["capture", "refund"], default: "capture" },
    reference: String,
    createdBy: { type: String, required: true },
  },
  baseSchemaOptions,
);

PaymentSchema.index({ storeId: 1, createdAt: -1 });
PaymentSchema.index({ storeId: 1, method: 1, createdAt: -1 });

export const Payment: Model<PaymentDoc> =
  (models.Payment as Model<PaymentDoc>) || model<PaymentDoc>("Payment", PaymentSchema);
