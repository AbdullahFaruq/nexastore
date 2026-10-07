import { Schema, type Types } from "mongoose";

/** Every tenant-scoped document carries this. Queries MUST filter on storeId. */
export interface TenantScoped {
  storeId: Types.ObjectId;
  /** Marks rows created by the seed script so demo data can be purged wholesale. */
  isDemo: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export const tenantFields = {
  storeId: { type: Schema.Types.ObjectId, ref: "Store", required: true, index: true },
  isDemo: { type: Boolean, default: false, index: true },
};

export const baseSchemaOptions = {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
} as const;

// Enumerations live in ./enums, which imports nothing - client components use
// them for forms and badges and must not pull Mongoose into the browser.
export * from "./enums";
