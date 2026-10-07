import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

/**
 * Auth provider boundary.
 *
 * Clerk is the real provider and the only one permitted in production. A
 * cookie-based dev identity exists so the app can be run and seeded locally
 * before Clerk keys are issued; it is gated on BOTH a non-production build and
 * an explicit env flag, and getAuthUser() throws rather than degrading if that
 * combination is ever attempted in production.
 */

export interface AuthUser {
  userId: string;
  email?: string;
  displayName?: string;
  avatarUrl?: string;
}

export const DEV_COOKIE = "nexastore_dev_identity";

export function isClerkConfigured() {
  return Boolean(
    process.env.CLERK_SECRET_KEY && process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
  );
}

export function isDevAuthEnabled() {
  return (
    process.env.NODE_ENV !== "production" &&
    process.env.NEXASTORE_DEV_AUTH === "1" &&
    !isClerkConfigured()
  );
}

export function authMode(): "clerk" | "dev" | "unconfigured" {
  if (isClerkConfigured()) return "clerk";
  if (isDevAuthEnabled()) return "dev";
  return "unconfigured";
}

function devSecret() {
  return process.env.NEXASTORE_DEV_AUTH_SECRET || "nexastore-local-development-only";
}

export function signDevIdentity(payload: string) {
  const sig = createHmac("sha256", devSecret()).update(payload).digest("base64url");
  return `${Buffer.from(payload).toString("base64url")}.${sig}`;
}

export function verifyDevIdentity(token: string): AuthUser | null {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  let payload: string;
  try {
    payload = Buffer.from(body, "base64url").toString("utf8");
  } catch {
    return null;
  }
  const expected = createHmac("sha256", devSecret()).update(payload).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    return JSON.parse(payload) as AuthUser;
  } catch {
    return null;
  }
}

/** The authenticated user, or null. Never throws for "not signed in". */
export async function getAuthUser(): Promise<AuthUser | null> {
  const mode = authMode();

  if (mode === "clerk") {
    const { currentUser } = await import("@clerk/nextjs/server");
    const user = await currentUser();
    if (!user) return null;
    const email = user.primaryEmailAddress?.emailAddress ?? user.emailAddresses[0]?.emailAddress;
    const displayName =
      user.fullName ||
      [user.firstName, user.lastName].filter(Boolean).join(" ") ||
      user.username ||
      email ||
      "Team member";
    return { userId: user.id, email, displayName, avatarUrl: user.imageUrl };
  }

  if (mode === "dev") {
    const jar = await cookies();
    const token = jar.get(DEV_COOKIE)?.value;
    if (!token) return null;
    return verifyDevIdentity(token);
  }

  throw new Error(
    "No authentication provider is configured. Set NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY and " +
      "CLERK_SECRET_KEY in .env.local, or set NEXASTORE_DEV_AUTH=1 for local development.",
  );
}

/** Just the id - cheaper than getAuthUser() when the profile is not needed. */
export async function getAuthUserId(): Promise<string | null> {
  const mode = authMode();
  if (mode === "clerk") {
    const { auth } = await import("@clerk/nextjs/server");
    const { userId } = await auth();
    return userId ?? null;
  }
  return (await getAuthUser())?.userId ?? null;
}
