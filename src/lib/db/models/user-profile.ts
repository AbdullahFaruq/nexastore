import { Schema, model, models, type Model, type Types } from "mongoose";
import { baseSchemaOptions } from "./shared";
import type { RangePreset } from "@/lib/format/dates";

export interface UserPreferences {
  theme: "light" | "dark" | "system";
  defaultRange: RangePreset;
  sidebarCollapsed: boolean;
  /** Widget ids the user has hidden on the dashboard. */
  hiddenWidgets: string[];
  /** Dashboard widget order; unknown ids fall back to the default order. */
  widgetOrder: string[];
  numberFormat: "standard" | "compact";
}

export interface UserProfileDoc {
  _id: Types.ObjectId;
  userId: string;
  email?: string;
  displayName?: string;
  avatarUrl?: string;
  activeStoreId?: Types.ObjectId;
  preferences: UserPreferences;
  createdAt: Date;
  updatedAt: Date;
}

const UserProfileSchema = new Schema<UserProfileDoc>(
  {
    userId: { type: String, required: true },
    email: { type: String, lowercase: true, trim: true },
    displayName: String,
    avatarUrl: String,
    activeStoreId: { type: Schema.Types.ObjectId, ref: "Store" },
    preferences: {
      theme: { type: String, enum: ["light", "dark", "system"], default: "system" },
      defaultRange: { type: String, default: "last_30" },
      sidebarCollapsed: { type: Boolean, default: false },
      hiddenWidgets: { type: [String], default: [] },
      widgetOrder: { type: [String], default: [] },
      numberFormat: { type: String, enum: ["standard", "compact"], default: "standard" },
    },
  },
  baseSchemaOptions,
);

UserProfileSchema.index({ userId: 1 }, { unique: true });

export const UserProfile: Model<UserProfileDoc> =
  (models.UserProfile as Model<UserProfileDoc>) ||
  model<UserProfileDoc>("UserProfile", UserProfileSchema);
