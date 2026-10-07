"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/context";
import { generateDemoData } from "@/lib/seed/generate";
import { fail, ok, type ActionResult } from "@/lib/errors";

/**
 * Fill the current store with sample trading history.
 *
 * Offered during onboarding so a new store is not a blank dashboard. Every row
 * is written with isDemo: true and can be removed from Settings without
 * touching real records.
 */
export async function loadDemoData(months = 12): Promise<ActionResult<{ sales: number }>> {
  try {
    const ctx = await requirePermission("settings:manage");

    const result = await generateDemoData({
      storeId: ctx.storeId,
      currency: ctx.currency,
      timezone: ctx.timezone,
      taxMode: ctx.store.settings?.taxMode ?? "exclusive",
      taxRateBps: ctx.store.settings?.defaultTaxRateBps ?? 0,
      orderPrefix: ctx.store.settings?.orderPrefix ?? "NX",
      userId: ctx.user.userId,
      userName: ctx.user.displayName ?? "Owner",
      months: Math.min(Math.max(months, 3), 24),
      customerCount: 120,
    });

    revalidatePath("/", "layout");
    return ok({ sales: result.sales });
  } catch (err) {
    return fail(err);
  }
}
