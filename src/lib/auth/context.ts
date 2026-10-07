import { cache } from "react";
import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/db/connect";
import { Store, type StoreDoc } from "@/lib/db/models/store";
import { Membership, type MembershipDoc } from "@/lib/db/models/membership";
import { UserProfile, type UserProfileDoc } from "@/lib/db/models/user-profile";
import type { Role } from "@/lib/db/models/shared";
import { can, type Permission } from "./permissions";
import { AppError, forbidden, unauthorized } from "@/lib/errors";
import { getAuthUser, type AuthUser } from "./provider";

export interface StoreContext {
  user: AuthUser;
  profile: UserProfileDoc;
  store: StoreDoc;
  storeId: Types.ObjectId;
  role: Role;
  membership: MembershipDoc;
  currency: string;
  timezone: string;
  weekStartsOn: number;
  /** All stores this user belongs to, for the store switcher. */
  memberships: { storeId: string; name: string; role: Role; colorSlot: number }[];
}

/**
 * Resolve the caller's tenant.
 *
 * The active store is whatever the user's profile points at, but that pointer
 * is ALWAYS re-validated against a live Membership row - a stale or tampered
 * activeStoreId can never grant access. Everything downstream filters on
 * ctx.storeId, which only ever comes from here.
 *
 * Wrapped in React's cache() so one request resolves it once no matter how many
 * server components ask.
 */
export const getStoreContext = cache(async (): Promise<StoreContext | null> => {
  const user = await getAuthUser();
  if (!user) return null;

  await connectToDatabase();

  const [profile, memberships] = await Promise.all([
    UserProfile.findOneAndUpdate(
      { userId: user.userId },
      {
        $setOnInsert: { userId: user.userId },
        $set: {
          email: user.email,
          displayName: user.displayName,
          avatarUrl: user.avatarUrl,
        },
      },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
    ).lean<UserProfileDoc>(),
    Membership.find({ userId: user.userId, status: "active" })
      .sort({ createdAt: 1 })
      .lean<MembershipDoc[]>(),
  ]);

  if (!profile || memberships.length === 0) return null;

  // Prefer the user's chosen store, but only if they still belong to it.
  const preferred = profile.activeStoreId?.toString();
  const membership =
    memberships.find((m) => m.storeId.toString() === preferred) ?? memberships[0];

  const store = await Store.findById(membership.storeId).lean<StoreDoc>();
  if (!store) return null;

  const storeDocs = await Store.find({ _id: { $in: memberships.map((m) => m.storeId) } })
    .select({ name: 1, colorSlot: 1 })
    .lean<Pick<StoreDoc, "_id" | "name" | "colorSlot">[]>();
  const nameById = new Map(storeDocs.map((s) => [s._id.toString(), s]));

  return {
    user,
    profile,
    store,
    storeId: store._id,
    role: membership.role,
    membership,
    currency: store.currency,
    timezone: store.timezone,
    weekStartsOn: store.settings?.weekStartsOn ?? 1,
    memberships: memberships.map((m) => ({
      storeId: m.storeId.toString(),
      name: nameById.get(m.storeId.toString())?.name ?? "Store",
      role: m.role,
      colorSlot: nameById.get(m.storeId.toString())?.colorSlot ?? 0,
    })),
  };
});

/** Same as getStoreContext but throws - use inside every server action. */
export async function requireStoreContext(): Promise<StoreContext> {
  const user = await getAuthUser();
  if (!user) throw unauthorized();
  const ctx = await getStoreContext();
  if (!ctx) {
    throw new AppError("NO_STORE", "You do not have a store yet. Finish onboarding first.");
  }
  return ctx;
}

/**
 * The gate every mutating server action passes through.
 * Frontend hiding is cosmetic; this is the control.
 */
export async function requirePermission(permission: Permission): Promise<StoreContext> {
  const ctx = await requireStoreContext();
  if (!can(ctx.role, permission)) {
    throw forbidden(
      `Your role (${ctx.role}) cannot perform this action. Ask a store owner for access.`,
    );
  }
  return ctx;
}

export async function hasPermission(permission: Permission): Promise<boolean> {
  const ctx = await getStoreContext();
  return ctx ? can(ctx.role, permission) : false;
}

/**
 * Parse a client-supplied id and confirm it is well formed.
 * Ownership is still enforced by including storeId in the query - never by
 * trusting that an id "looks like" one of ours.
 */
export function toObjectId(id: string | Types.ObjectId | null | undefined): Types.ObjectId | null {
  if (!id) return null;
  if (id instanceof Types.ObjectId) return id;
  return Types.ObjectId.isValid(id) ? new Types.ObjectId(id) : null;
}

/** Convenience: the tenant filter that every query must start from. */
export function scoped(ctx: StoreContext, extra: Record<string, unknown> = {}) {
  return { storeId: ctx.storeId, ...extra };
}
