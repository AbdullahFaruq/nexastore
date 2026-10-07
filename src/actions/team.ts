"use server";

import { revalidatePath } from "next/cache";
import { requirePermission, toObjectId } from "@/lib/auth/context";
import { connectToDatabase } from "@/lib/db/connect";
import { Membership } from "@/lib/db/models/membership";
import { Notification } from "@/lib/db/models/notification";
import { AppError, fail, notFound, ok, type ActionResult } from "@/lib/errors";
import { inviteMemberSchema, updateMemberSchema } from "@/lib/validation/schemas";
import { parseOrThrow } from "@/lib/validation/common";

/**
 * Create an invited membership.
 *
 * The row is created in "invited" state keyed by email; it becomes active when
 * someone signs in with that address (see acceptPendingInvites). The store's
 * data is never reachable from an invited row, only from an active one.
 */
export async function inviteMember(raw: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const ctx = await requirePermission("team:manage");
    const input = parseOrThrow(inviteMemberSchema, raw);
    await connectToDatabase();

    const email = input.email.toLowerCase();
    const existing = await Membership.findOne({ storeId: ctx.storeId, email });
    if (existing) {
      throw new AppError("CONFLICT", "That person is already on your team.", {
        fields: { email: "Already invited" },
      });
    }

    const created = await Membership.create({
      storeId: ctx.storeId,
      // Placeholder id until they sign in; unique per store, never collides.
      userId: `invite:${email}:${ctx.storeId.toString()}`,
      role: input.role,
      status: "invited",
      email,
      displayName: input.displayName || email.split("@")[0],
      invitedBy: ctx.user.userId,
    });

    revalidatePath("/team");
    return ok({ id: String(created._id) });
  } catch (err) {
    return fail(err);
  }
}

export async function updateMember(raw: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const ctx = await requirePermission("team:manage");
    const input = parseOrThrow(updateMemberSchema, raw);
    await connectToDatabase();

    const membershipId = toObjectId(input.membershipId);
    if (!membershipId) throw notFound("That team member");

    const membership = await Membership.findOne({ _id: membershipId, storeId: ctx.storeId });
    if (!membership) throw notFound("That team member");

    // A store must always keep at least one owner who can administer it.
    if (membership.role === "owner" && input.role && input.role !== "owner") {
      const owners = await Membership.countDocuments({
        storeId: ctx.storeId,
        role: "owner",
        status: "active",
      });
      if (owners <= 1) {
        throw new AppError("INVALID_STATE", "A store must have at least one owner.");
      }
    }
    if (membership.userId === ctx.user.userId && input.role && input.role !== membership.role) {
      throw new AppError("INVALID_STATE", "You cannot change your own role.");
    }

    await Membership.updateOne(
      { _id: membershipId, storeId: ctx.storeId },
      { $set: { ...(input.role ? { role: input.role } : {}), ...(input.status ? { status: input.status } : {}) } },
    );

    revalidatePath("/team");
    return ok({ id: input.membershipId });
  } catch (err) {
    return fail(err);
  }
}

export async function removeMember(membershipId: string): Promise<ActionResult<{ removed: true }>> {
  try {
    const ctx = await requirePermission("team:manage");
    await connectToDatabase();

    const id = toObjectId(membershipId);
    if (!id) throw notFound("That team member");

    const membership = await Membership.findOne({ _id: id, storeId: ctx.storeId });
    if (!membership) throw notFound("That team member");
    if (membership.userId === ctx.user.userId) {
      throw new AppError("INVALID_STATE", "You cannot remove yourself from the store.");
    }
    if (membership.role === "owner") {
      const owners = await Membership.countDocuments({ storeId: ctx.storeId, role: "owner", status: "active" });
      if (owners <= 1) throw new AppError("INVALID_STATE", "A store must have at least one owner.");
    }

    await Membership.deleteOne({ _id: id, storeId: ctx.storeId });
    revalidatePath("/team");
    return ok({ removed: true });
  } catch (err) {
    return fail(err);
  }
}

/**
 * Claim any invitations addressed to this user's email.
 * Called on sign-in, so an invited teammate lands straight in the store.
 */
export async function acceptPendingInvites(userId: string, email?: string, displayName?: string) {
  if (!email) return 0;
  await connectToDatabase();

  const invites = await Membership.find({ email: email.toLowerCase(), status: "invited" });
  if (invites.length === 0) return 0;

  for (const invite of invites) {
    const alreadyIn = await Membership.findOne({ storeId: invite.storeId, userId, status: "active" });
    if (alreadyIn) {
      await Membership.deleteOne({ _id: invite._id });
      continue;
    }
    await Membership.updateOne(
      { _id: invite._id },
      { $set: { userId, status: "active", displayName: displayName || invite.displayName } },
    );
    await Notification.create({
      storeId: invite.storeId,
      type: "member_joined",
      priority: "normal",
      title: "New team member joined",
      body: `${displayName || email} accepted their invitation.`,
      href: "/team",
    }).catch(() => undefined);
  }
  return invites.length;
}
