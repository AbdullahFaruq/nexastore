"use server";

import { revalidatePath } from "next/cache";
import { requireStoreContext, toObjectId } from "@/lib/auth/context";
import { getAuthUser } from "@/lib/auth/provider";
import { connectToDatabase } from "@/lib/db/connect";
import { Membership } from "@/lib/db/models/membership";
import { UserProfile } from "@/lib/db/models/user-profile";
import { fail, forbidden, ok, unauthorized, type ActionResult } from "@/lib/errors";
import { preferencesSchema } from "@/lib/validation/schemas";
import { parseOrThrow } from "@/lib/validation/common";

export async function updatePreferences(raw: unknown): Promise<ActionResult<{ saved: true }>> {
  try {
    const user = await getAuthUser();
    if (!user) throw unauthorized();
    const input = parseOrThrow(preferencesSchema, raw);
    await connectToDatabase();

    const set: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input)) {
      if (value !== undefined) set[`preferences.${key}`] = value;
    }
    if (Object.keys(set).length > 0) {
      await UserProfile.updateOne({ userId: user.userId }, { $set: set }, { upsert: true });
    }
    return ok({ saved: true });
  } catch (err) {
    return fail(err);
  }
}

/** Switch the active tenant - only ever to a store the user actually belongs to. */
export async function switchStore(storeId: string): Promise<ActionResult<{ storeId: string }>> {
  try {
    const user = await getAuthUser();
    if (!user) throw unauthorized();
    await connectToDatabase();

    const id = toObjectId(storeId);
    if (!id) throw forbidden("Unknown store.");

    const membership = await Membership.findOne({
      storeId: id,
      userId: user.userId,
      status: "active",
    });
    if (!membership) throw forbidden("You do not have access to that store.");

    await UserProfile.updateOne(
      { userId: user.userId },
      { $set: { activeStoreId: id } },
      { upsert: true },
    );

    revalidatePath("/", "layout");
    return ok({ storeId });
  } catch (err) {
    return fail(err);
  }
}

/** Persist the sidebar collapse state so it survives a reload. */
export async function setSidebarCollapsed(collapsed: boolean): Promise<ActionResult<{ saved: true }>> {
  try {
    const ctx = await requireStoreContext();
    await UserProfile.updateOne(
      { userId: ctx.user.userId },
      { $set: { "preferences.sidebarCollapsed": collapsed } },
      { upsert: true },
    );
    return ok({ saved: true });
  } catch (err) {
    return fail(err);
  }
}

export async function setWidgetVisibility(
  hiddenWidgets: string[],
): Promise<ActionResult<{ saved: true }>> {
  try {
    const ctx = await requireStoreContext();
    await UserProfile.updateOne(
      { userId: ctx.user.userId },
      { $set: { "preferences.hiddenWidgets": hiddenWidgets.slice(0, 40) } },
      { upsert: true },
    );
    revalidatePath("/dashboard");
    return ok({ saved: true });
  } catch (err) {
    return fail(err);
  }
}
