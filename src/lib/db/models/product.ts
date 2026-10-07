import { Schema, model, models, type Model, type Types } from "mongoose";
import { baseSchemaOptions, tenantFields } from "./shared";
import { PRODUCT_STATUSES, type ProductStatus } from "./enums";

export interface ProductDoc {
  _id: Types.ObjectId;
  storeId: Types.ObjectId;
  name: string;
  sku: string;
  barcode?: string;
  description?: string;
  images: string[];
  categoryId?: Types.ObjectId | null;
  supplier?: string;
  /** All money fields are integer minor units of the store currency. */
  costPrice: number;
  price: number;
  /** Promotional price; when set and < price it is the price actually charged. */
  discountPrice?: number | null;
  stock: number;
  minStock: number;
  /** Basis points: 1250 = 12.5%. */
  taxRateBps: number;
  unit: string;
  status: ProductStatus;
  isDemo: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ProductSchema = new Schema<ProductDoc>(
  {
    ...tenantFields,
    name: { type: String, required: true, trim: true, maxlength: 140 },
    sku: { type: String, required: true, trim: true, uppercase: true, maxlength: 40 },
    barcode: { type: String, trim: true, maxlength: 60 },
    description: { type: String, maxlength: 2000 },
    images: { type: [String], default: [] },
    categoryId: { type: Schema.Types.ObjectId, ref: "Category", index: true },
    supplier: { type: String, trim: true, maxlength: 120 },
    costPrice: { type: Number, required: true, min: 0, default: 0 },
    price: { type: Number, required: true, min: 0, default: 0 },
    discountPrice: { type: Number, min: 0, default: null },
    stock: { type: Number, required: true, default: 0 },
    minStock: { type: Number, required: true, default: 5, min: 0 },
    taxRateBps: { type: Number, default: 0, min: 0, max: 10000 },
    unit: { type: String, default: "unit", maxlength: 20 },
    status: { type: String, enum: PRODUCT_STATUSES, default: "active", index: true },
  },
  baseSchemaOptions,
);

// SKUs are unique per store, never globally.
ProductSchema.index({ storeId: 1, sku: 1 }, { unique: true });
ProductSchema.index({ storeId: 1, status: 1, name: 1 });
ProductSchema.index({ storeId: 1, categoryId: 1 });
ProductSchema.index({ storeId: 1, stock: 1 });
ProductSchema.index({ storeId: 1, createdAt: -1 });
// Text search for the command palette and product search.
ProductSchema.index(
  { name: "text", sku: "text", description: "text", supplier: "text" },
  { weights: { name: 10, sku: 8, supplier: 3, description: 1 }, name: "product_text" },
);

/** The price a customer actually pays, before discounts entered at the till. */
export function effectivePrice(p: Pick<ProductDoc, "price" | "discountPrice">) {
  return p.discountPrice != null && p.discountPrice > 0 && p.discountPrice < p.price
    ? p.discountPrice
    : p.price;
}

export const Product: Model<ProductDoc> =
  (models.Product as Model<ProductDoc>) || model<ProductDoc>("Product", ProductSchema);
