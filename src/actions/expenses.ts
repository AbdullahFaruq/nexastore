"use server";

import { revalidatePath } from "next/cache";
import { requirePermission, toObjectId } from "@/lib/auth/context";
import { connectToDatabase } from "@/lib/db/connect";
import { Expense } from "@/lib/db/models/expense";
import { AppError, fail, notFound, ok, type ActionResult } from "@/lib/errors";
import { parseMoney } from "@/lib/format/currency";
import { expenseSchema } from "@/lib/validation/schemas";
import { parseOrThrow } from "@/lib/validation/common";

function amountFrom(value: string, currency: string) {
  const amount = parseMoney(value, currency);
  if (amount === null || amount < 0) {
    throw new AppError("VALIDATION", "Enter a valid expense amount.", { fields: { amount: "Invalid amount" } });
  }
  if (amount === 0) {
    throw new AppError("VALIDATION", "An expense needs an amount greater than zero.", {
      fields: { amount: "Must be more than zero" },
    });
  }
  return amount;
}

export async function createExpense(raw: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const ctx = await requirePermission("expenses:write");
    const input = parseOrThrow(expenseSchema, raw);
    const amount = amountFrom(String(input.amount), ctx.currency);
    await connectToDatabase();

    const created = await Expense.create({
      storeId: ctx.storeId,
      category: input.category,
      amount,
      description: input.description,
      vendor: input.vendor,
      date: input.date,
      paymentMethod: input.paymentMethod,
      receiptUrl: input.receiptUrl || undefined,
      notes: input.notes,
      recurring: input.recurring,
      recurrenceInterval: input.recurrenceInterval,
      createdBy: ctx.user.userId,
      createdByName: ctx.user.displayName,
    });

    revalidatePath("/expenses");
    revalidatePath("/dashboard");
    revalidatePath("/analytics");
    return ok({ id: String(created._id) });
  } catch (err) {
    return fail(err);
  }
}

export async function updateExpense(id: string, raw: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const ctx = await requirePermission("expenses:write");
    const input = parseOrThrow(expenseSchema, raw);
    const amount = amountFrom(String(input.amount), ctx.currency);
    await connectToDatabase();

    const expenseId = toObjectId(id);
    if (!expenseId) throw notFound("That expense");

    const r = await Expense.updateOne(
      { _id: expenseId, storeId: ctx.storeId },
      {
        $set: {
          category: input.category,
          amount,
          description: input.description,
          vendor: input.vendor,
          date: input.date,
          paymentMethod: input.paymentMethod,
          receiptUrl: input.receiptUrl || undefined,
          notes: input.notes,
          recurring: input.recurring,
          recurrenceInterval: input.recurrenceInterval,
        },
      },
    );
    if (r.matchedCount === 0) throw notFound("That expense");

    revalidatePath("/expenses");
    revalidatePath("/analytics");
    return ok({ id });
  } catch (err) {
    return fail(err);
  }
}

export async function deleteExpense(id: string): Promise<ActionResult<{ deleted: boolean }>> {
  try {
    const ctx = await requirePermission("expenses:write");
    await connectToDatabase();
    const expenseId = toObjectId(id);
    if (!expenseId) throw notFound("That expense");

    const r = await Expense.deleteOne({ _id: expenseId, storeId: ctx.storeId });
    if (r.deletedCount === 0) throw notFound("That expense");

    revalidatePath("/expenses");
    revalidatePath("/analytics");
    return ok({ deleted: true });
  } catch (err) {
    return fail(err);
  }
}
