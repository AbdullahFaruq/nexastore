import { Schema, model, models, type Model, type Types } from "mongoose";
import { baseSchemaOptions } from "./shared";
import { ROLES, type Role } from "./enums";

/**
 * The join between a Clerk user and a Store. This document - not anything the
 * browser sends - is what grants access to a tenant.
 */
export interface MembershipDoc {
  _id: Types.ObjectId;
  storeId: Types.ObjectId;
  userId: string;
  role: Role;
  status: "active" | "invited" | "suspended";
  /** Cached from Clerk so team lists render without an API round-trip. */
  displayName?: string;
  email?: string;
  avatarUrl?: string;
  invitedBy?: string;
  lastActiveAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const MembershipSchema = new Schema<MembershipDoc>(
  {
    storeId: { type: Schema.Types.ObjectId, ref: "Store", required: true, index: true },
    userId: { type: String, required: true, index: true },
    role: { type: String, enum: ROLES, required: true, default: "employee" },
    status: { type: String, enum: ["active", "invited", "suspended"], default: "active" },
    displayName: String,
    email: { type: String, lowercase: true, trim: true },
    avatarUrl: String,
    invitedBy: String,
    lastActiveAt: Date,
  },
  baseSchemaOptions,
);

MembershipSchema.index({ storeId: 1, userId: 1 }, { unique: true });
MembershipSchema.index({ userId: 1, status: 1 });
MembershipSchema.index({ storeId: 1, email: 1 });

export const Membership: Model<MembershipDoc> =
  (models.Membership as Model<MembershipDoc>) ||
  model<MembershipDoc>("Membership", MembershipSchema);
