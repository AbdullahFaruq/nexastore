/**
 * Typed application errors. Server actions convert these into a friendly
 * message for the user; anything that is NOT an AppError is logged server-side
 * and reported to the browser as a generic failure, so stack traces and driver
 * messages never reach a customer's screen.
 */
export type AppErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NO_STORE"
  | "NOT_FOUND"
  | "VALIDATION"
  | "CONFLICT"
  | "INSUFFICIENT_STOCK"
  | "DUPLICATE_SKU"
  | "INVALID_STATE"
  | "DATABASE"
  | "RATE_LIMITED";

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly status: number;
  readonly fields?: Record<string, string>;

  constructor(
    code: AppErrorCode,
    message: string,
    opts: { status?: number; fields?: Record<string, string> } = {},
  ) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = opts.status ?? defaultStatus(code);
    this.fields = opts.fields;
  }
}

function defaultStatus(code: AppErrorCode) {
  switch (code) {
    case "UNAUTHENTICATED": return 401;
    case "FORBIDDEN": return 403;
    case "NO_STORE": return 409;
    case "NOT_FOUND": return 404;
    case "VALIDATION": return 422;
    case "CONFLICT":
    case "DUPLICATE_SKU":
    case "INSUFFICIENT_STOCK":
    case "INVALID_STATE": return 409;
    case "RATE_LIMITED": return 429;
    default: return 500;
  }
}

export const unauthorized = (m = "You need to sign in to continue.") =>
  new AppError("UNAUTHENTICATED", m);
export const forbidden = (m = "You do not have permission to do that.") =>
  new AppError("FORBIDDEN", m);
export const notFound = (what = "That record") =>
  new AppError("NOT_FOUND", `${what} could not be found.`);
export const invalid = (m: string, fields?: Record<string, string>) =>
  new AppError("VALIDATION", m, { fields });

/** Result envelope returned by every server action. */
export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string; code: AppErrorCode; fields?: Record<string, string> };

export function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function fail(error: unknown): ActionResult<never> {
  if (error instanceof AppError) {
    return { ok: false, error: error.message, code: error.code, fields: error.fields };
  }

  // Mongo duplicate-key: turn the driver's message into something a shop owner
  // can act on rather than leaking the index name.
  const e = error as { code?: number; keyPattern?: Record<string, unknown>; message?: string };
  if (e?.code === 11000) {
    const key = Object.keys(e.keyPattern ?? {}).find((k) => k !== "storeId");
    if (key === "sku") {
      return { ok: false, error: "A product with that SKU already exists in this store.", code: "DUPLICATE_SKU", fields: { sku: "Already in use" } };
    }
    return { ok: false, error: "That record already exists.", code: "CONFLICT" };
  }

  console.error("[nexastore] unhandled action error:", error);
  return {
    ok: false,
    error: "Something went wrong on our side. Please try again.",
    code: "DATABASE",
  };
}
