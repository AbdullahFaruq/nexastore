"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { DEV_COOKIE, isDevAuthEnabled, signDevIdentity } from "@/lib/auth/provider";
import { connectToDatabase } from "@/lib/db/connect";
import { UserProfile } from "@/lib/db/models/user-profile";
import { acceptPendingInvites } from "./team";

/**
 * Local development identity.
 *
 * Only reachable when Clerk is unconfigured AND NEXASTORE_DEV_AUTH=1 AND the
 * build is not production. It exists so the app can be run and seeded before
 * Clerk keys are issued; it is not an alternative auth system and grants
 * nothing that a signed-in Clerk user would not also have.
 */
function assertDevAuth() {
  if (!isDevAuthEnabled()) {
    throw new Error("Development sign-in is disabled. Configure Clerk to sign in.");
  }
}

export async function devSignIn(formData: FormData) {
  assertDevAuth();

  const email = String(formData.get("email") || "").trim().toLowerCase();
  const displayName = String(formData.get("displayName") || "").trim();
  if (!email) throw new Error("Enter an email address.");

  // Stable id per email, so signing in twice returns to the same account.
  const userId = `dev_${Buffer.from(email).toString("base64url").slice(0, 24)}`;
  const name = displayName || email.split("@")[0];

  const token = signDevIdentity(JSON.stringify({ userId, email, displayName: name }));
  const jar = await cookies();
  jar.set(DEV_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  await connectToDatabase();
  await UserProfile.updateOne(
    { userId },
    { $setOnInsert: { userId }, $set: { email, displayName: name } },
    { upsert: true },
  );
  await acceptPendingInvites(userId, email, name);

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function devSignOut() {
  const jar = await cookies();
  jar.delete(DEV_COOKIE);
  revalidatePath("/", "layout");
  redirect("/");
}
