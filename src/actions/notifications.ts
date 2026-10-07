"use server";

import { revalidatePath } from "next/cache";
import { requireStoreContext, toObjectId } from "@/lib/auth/context";
import { connectToDatabase } from "@/lib/db/connect";
import { Notification } from "@/lib/db/models/notification";
import { fail, ok, type ActionResult } from "@/lib/errors";

export async function markNotificationRead(id: string): Promise<ActionResult<{ id: string }>> {
  try {
    const ctx = await requireStoreContext();
    await connectToDatabase();
    const notificationId = toObjectId(id);
    if (!notificationId) return ok({ id });

    await Notification.updateOne(
      { _id: notificationId, storeId: ctx.storeId },
      { $addToSet: { readBy: ctx.user.userId } },
    );
    revalidatePath("/", "layout");
    return ok({ id });
  } catch (err) {
    return fail(err);
  }
}

export async function markAllNotificationsRead(): Promise<ActionResult<{ count: number }>> {
  try {
    const ctx = await requireStoreContext();
    await connectToDatabase();
    const r = await Notification.updateMany(
      { storeId: ctx.storeId, readBy: { $ne: ctx.user.userId } },
      { $addToSet: { readBy: ctx.user.userId } },
    );
    revalidatePath("/", "layout");
    return ok({ count: r.modifiedCount });
  } catch (err) {
    return fail(err);
  }
}

export async function dismissNotification(id: string): Promise<ActionResult<{ id: string }>> {
  try {
    const ctx = await requireStoreContext();
    await connectToDatabase();
    const notificationId = toObjectId(id);
    if (!notificationId) return ok({ id });
    await Notification.deleteOne({ _id: notificationId, storeId: ctx.storeId });
    revalidatePath("/", "layout");
    return ok({ id });
  } catch (err) {
    return fail(err);
  }
}
