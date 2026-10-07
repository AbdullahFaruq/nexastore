import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { authMode, getAuthUser } from "@/lib/auth/provider";
import { DevSignInForm } from "@/components/auth/dev-sign-in-form";
import { AuthNotConfigured } from "@/components/auth/not-configured";

export const metadata: Metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";

export default async function SignInPage() {
  const mode = authMode();

  if (mode === "unconfigured") return <AuthNotConfigured />;

  if (mode === "clerk") {
    const user = await getAuthUser();
    if (user) redirect("/dashboard");
    const { SignIn } = await import("@clerk/nextjs");
    return (
      <SignIn
        appearance={{
          elements: {
            rootBox: "w-full",
            cardBox: "w-full shadow-none border border-[var(--line)] rounded-[12px]",
          },
        }}
      />
    );
  }

  const user = await getAuthUser();
  if (user) redirect("/dashboard");
  return <DevSignInForm mode="sign-in" />;
}
