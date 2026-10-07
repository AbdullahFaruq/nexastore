"use server";

import { revalidatePath } from "next/cache";
import { requirePermission, toObjectId } from "@/lib/auth/context";
import { connectToDatabase } from "@/lib/db/connect";
import { Customer } from "@/lib/db/models/customer";
import { Sale } from "@/lib/db/models/sale";
import { AppError, fail, notFound, ok, type ActionResult } from "@/lib/errors";
import { customerSchema } from "@/lib/validation/schemas";
import { parseOrThrow } from "@/lib/validation/common";

export async function createCustomer(raw: unknown): Promise<ActionResult<{ id: string; name: string }>> {
  try {
    const ctx = await requirePermission("customers:write");
    const input = parseOrThrow(customerSchema, raw);
    await connectToDatabase();

    if (input.email) {
      const clash = await Customer.exists({ storeId: ctx.storeId, email: input.email });
      if (clash) {
        throw new AppError("CONFLICT", "A customer with that email already exists.", {
          fields: { email: "Already on file" },
        });
      }
    }

    const created = await Customer.create({
      storeId: ctx.storeId,
      name: input.name,
      email: input.email || undefined,
      phone: input.phone || undefined,
      address: input.address,
      notes: input.notes,
      tags: input.tags ?? [],
    });

    revalidatePath("/customers");
    return ok({ id: String(created._id), name: created.name });
  } catch (err) {
    return fail(err);
  }
}

export async function updateCustomer(id: string, raw: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const ctx = await requirePermission("customers:write");
    const input = parseOrThrow(customerSchema, raw);
    await connectToDatabase();

    const customerId = toObjectId(id);
    if (!customerId) throw notFound("That customer");

    if (input.email) {
      const clash = await Customer.exists({
        storeId: ctx.storeId,
        email: input.email,
        _id: { $ne: customerId },
      });
      if (clash) {
        throw new AppError("CONFLICT", "Another customer already uses that email.", {
          fields: { email: "Already on file" },
        });
      }
    }

    const r = await Customer.updateOne(
      { _id: customerId, storeId: ctx.storeId },
      {
        $set: {
          name: input.name,
          email: input.email || undefined,
          phone: input.phone || undefined,
          address: input.address,
          notes: input.notes,
          tags: input.tags ?? [],
        },
      },
    );
    if (r.matchedCount === 0) throw notFound("That customer");

    revalidatePath("/customers");
    revalidatePath(`/customers/${id}`);
    return ok({ id });
  } catch (err) {
    return fail(err);
  }
}

/** A customer with orders is kept, so their purchase history stays intact. */
export async function deleteCustomer(id: string): Promise<ActionResult<{ deleted: boolean }>> {
  try {
    const ctx = await requirePermission("customers:write");
    await connectToDatabase();
    const customerId = toObjectId(id);
    if (!customerId) throw notFound("That customer");

    const orderCount = await Sale.countDocuments({ storeId: ctx.storeId, customerId });
    if (orderCount > 0) {
      throw new AppError(
        "INVALID_STATE",
        `This customer has ${orderCount} order${orderCount === 1 ? "" : "s"} on file. Deleting them would break that history.`,
      );
    }

    const r = await Customer.deleteOne({ _id: customerId, storeId: ctx.storeId });
    if (r.deletedCount === 0) throw notFound("That customer");

    revalidatePath("/customers");
    return ok({ deleted: true });
  } catch (err) {
    return fail(err);
  }
}
