import { Schema, model, models, type Model, type Types } from "mongoose";
import { baseSchemaOptions, tenantFields } from "./shared";

export interface CustomerDoc {
  _id: Types.ObjectId;
  storeId: Types.ObjectId;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  notes?: string;
  /**
   * Denormalised lifetime stats. Recomputed inside the same transaction as any
   * sale write, so they can never drift from the SaleItem ledger.
   */
  totalOrders: number;
  totalSpent: number;
  firstPurchaseAt?: Date;
  lastPurchaseAt?: Date;
  tags: string[];
  isDemo: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CustomerSchema = new Schema<CustomerDoc>(
  {
    ...tenantFields,
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, lowercase: true, trim: true, maxlength: 160 },
    phone: { type: String, trim: true, maxlength: 40 },
    address: { type: String, maxlength: 300 },
    notes: { type: String, maxlength: 2000 },
    totalOrders: { type: Number, default: 0, min: 0 },
    totalSpent: { type: Number, default: 0, min: 0 },
    firstPurchaseAt: Date,
    lastPurchaseAt: Date,
    tags: { type: [String], default: [] },
  },
  baseSchemaOptions,
);

CustomerSchema.index({ storeId: 1, name: 1 });
CustomerSchema.index({ storeId: 1, email: 1 });
CustomerSchema.index({ storeId: 1, phone: 1 });
CustomerSchema.index({ storeId: 1, totalSpent: -1 });
CustomerSchema.index({ storeId: 1, lastPurchaseAt: -1 });
CustomerSchema.index(
  { name: "text", email: "text", phone: "text" },
  { weights: { name: 10, email: 5, phone: 5 }, name: "customer_text" },
);

export const Customer: Model<CustomerDoc> =
  (models.Customer as Model<CustomerDoc>) || model<CustomerDoc>("Customer", CustomerSchema);
