import { Schema, model, models, type Model, type Types } from "mongoose";
import { baseSchemaOptions, tenantFields } from "./shared";
import { NOTIFICATION_PRIORITIES, type NotificationPriority } from "./enums";

export type NotificationType =
  | "low_stock" | "out_of_stock" | "large_sale" | "refund"
  | "expense_spike" | "report_ready" | "member_joined" | "goal_reached";

export interface NotificationDoc {
  _id: Types.ObjectId;
  storeId: Types.ObjectId;
  /** null = everyone in the store with permission to see it. */
  userId?: string | null;
  type: NotificationType;
  priority: NotificationPriority;
  title: string;
  body: string;
  href?: string;
  /** Clerk ids that have read it. Cheaper than a row per user per notice. */
  readBy: string[];
  /** Stops the same alert being raised twice for the same fact. */
  dedupeKey?: string;
  isDemo: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationSchema = new Schema<NotificationDoc>(
  {
    ...tenantFields,
    userId: { type: String, default: null },
    type: { type: String, required: true },
    priority: { type: String, enum: NOTIFICATION_PRIORITIES, default: "normal" },
    title: { type: String, required: true, maxlength: 160 },
    body: { type: String, required: true, maxlength: 400 },
    href: String,
    readBy: { type: [String], default: [] },
    dedupeKey: String,
  },
  baseSchemaOptions,
);

NotificationSchema.index({ storeId: 1, createdAt: -1 });
NotificationSchema.index({ storeId: 1, dedupeKey: 1 }, { unique: true, sparse: true });

export const Notification: Model<NotificationDoc> =
  (models.Notification as Model<NotificationDoc>) ||
  model<NotificationDoc>("Notification", NotificationSchema);
