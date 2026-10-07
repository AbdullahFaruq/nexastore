import { z } from "zod";
import { Types } from "mongoose";
import { invalid } from "@/lib/errors";

export const objectId = z
  .string()
  .refine((v) => Types.ObjectId.isValid(v), { message: "Invalid identifier" });

export const optionalObjectId = z
  .union([objectId, z.literal(""), z.null(), z.undefined()])
  .transform((v) => (v ? String(v) : null));

/** A money amount typed by a human: "1,299.99". Converted to minor units later. */
export const moneyInput = z
  .union([z.string(), z.number()])
  .transform((v) => (typeof v === "number" ? String(v) : v.trim()))
  .refine((v) => v === "" || /^-?[\d,\s]*\.?\d*$/.test(v), { message: "Enter a valid amount" });

export const nonNegativeInt = z.coerce
  .number()
  .int("Must be a whole number")
  .min(0, "Cannot be negative");

export const isoDate = z
  .union([z.string(), z.date()])
  .transform((v) => new Date(v))
  .refine((d) => !Number.isNaN(d.getTime()), { message: "Enter a valid date" });

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

/**
 * Turn a Zod failure into an AppError carrying per-field messages, so forms can
 * highlight the offending input instead of showing one generic banner.
 */
export function parseOrThrow<T extends z.ZodType>(schema: T, data: unknown): z.infer<T> {
  const result = schema.safeParse(data);
  if (result.success) return result.data;

  const fields: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const key = issue.path.join(".") || "form";
    if (!fields[key]) fields[key] = issue.message;
  }
  const first = result.error.issues[0];
  throw invalid(first?.message ?? "Please check the form and try again.", fields);
}

/** Read a FormData into a plain object, dropping empty strings for optionals. */
export function formToObject(form: FormData): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of form.entries()) {
    if (value instanceof File) continue;
    if (key.endsWith("[]")) {
      const k = key.slice(0, -2);
      (out[k] as string[]) = [...((out[k] as string[]) ?? []), value];
    } else {
      out[key] = value;
    }
  }
  return out;
}
