import { Schema, model, models, type Model, type Types } from "mongoose";
import { baseSchemaOptions, tenantFields } from "./shared";

export interface CategoryDoc {
  _id: Types.ObjectId;
  storeId: Types.ObjectId;
  name: string;
  slug: string;
  description?: string;
  /** Index into the validated categorical chart palette (0-7). */
  colorSlot: number;
  sortOrder: number;
  isDemo: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CategorySchema = new Schema<CategoryDoc>(
  {
    ...tenantFields,
    name: { type: String, required: true, trim: true, maxlength: 60 },
    slug: { type: String, required: true, lowercase: true, trim: true },
    description: { type: String, maxlength: 240 },
    colorSlot: { type: Number, default: 0, min: 0, max: 7 },
    sortOrder: { type: Number, default: 0 },
  },
  baseSchemaOptions,
);

CategorySchema.index({ storeId: 1, slug: 1 }, { unique: true });
CategorySchema.index({ storeId: 1, name: 1 });

export const Category: Model<CategoryDoc> =
  (models.Category as Model<CategoryDoc>) || model<CategoryDoc>("Category", CategorySchema);
