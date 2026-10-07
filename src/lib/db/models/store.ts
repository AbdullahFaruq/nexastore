import { Schema, model, models, type Model, type Types } from "mongoose";
import { baseSchemaOptions } from "./shared";
import { BUSINESS_TYPES, type BusinessType } from "./enums";

export interface StoreSettings {
  /** Default tax rate applied to new products, in basis points (1250 = 12.5%). */
  defaultTaxRateBps: number;
  /** Products at or below this stock count are "running low" unless overridden. */
  lowStockThreshold: number;
  /** 0 = Sunday, 1 = Monday. Affects every weekly rollup. */
  weekStartsOn: number;
  /** Prefix for generated order numbers, e.g. "NX" -> NX-000142. */
  orderPrefix: string;
  /** Whether taxes are added on top of the price (exclusive) or already inside it. */
  taxMode: "exclusive" | "inclusive";
  receiptFooter?: string;
}

export interface StoreDoc {
  _id: Types.ObjectId;
  name: string;
  slug: string;
  ownerUserId: string;
  currency: string;
  timezone: string;
  businessType: BusinessType;
  logoUrl?: string;
  /** Accent seed 0-7, used for the store's avatar tile. */
  colorSlot: number;
  address?: string;
  phone?: string;
  email?: string;
  settings: StoreSettings;
  onboardingStep: number;
  onboardingCompleted: boolean;
  isDemo: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const StoreSchema = new Schema<StoreDoc>(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    slug: { type: String, required: true, lowercase: true, trim: true },
    ownerUserId: { type: String, required: true, index: true },
    currency: { type: String, required: true, default: "USD", uppercase: true },
    timezone: { type: String, required: true, default: "UTC" },
    businessType: { type: String, enum: BUSINESS_TYPES, default: "retail" },
    logoUrl: { type: String },
    colorSlot: { type: Number, default: 0, min: 0, max: 7 },
    address: { type: String, maxlength: 240 },
    phone: { type: String, maxlength: 40 },
    email: { type: String, maxlength: 160, lowercase: true, trim: true },
    settings: {
      defaultTaxRateBps: { type: Number, default: 0, min: 0, max: 10000 },
      lowStockThreshold: { type: Number, default: 10, min: 0 },
      weekStartsOn: { type: Number, default: 1, min: 0, max: 6 },
      orderPrefix: { type: String, default: "NX", maxlength: 6 },
      taxMode: { type: String, enum: ["exclusive", "inclusive"], default: "exclusive" },
      receiptFooter: { type: String, maxlength: 240 },
    },
    onboardingStep: { type: Number, default: 0 },
    onboardingCompleted: { type: Boolean, default: false },
    isDemo: { type: Boolean, default: false },
  },
  baseSchemaOptions,
);

StoreSchema.index({ slug: 1 }, { unique: true });

export const Store: Model<StoreDoc> =
  (models.Store as Model<StoreDoc>) || model<StoreDoc>("Store", StoreSchema);
