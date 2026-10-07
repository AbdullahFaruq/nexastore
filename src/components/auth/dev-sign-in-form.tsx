"use client";

import * as React from "react";
import Link from "next/link";
import { TriangleAlert } from "lucide-react";
import { devSignIn } from "@/actions/dev-auth";
import { Button } from "@/components/ui/button";
import { FieldHint, Input, Label } from "@/components/ui/input";

/**
 * Local development sign-in. Rendered only when Clerk is unconfigured and
 * NEXASTORE_DEV_AUTH=1, so a developer can run the product before keys exist.
 */
export function DevSignInForm({ mode }: { mode: "sign-in" | "sign-up" }) {
  const [pending, setPending] = React.useState(false);

  return (
    <div>
      <h1 className="text-[22px] font-semibold text-ink tracking-[-0.025em]">
        {mode === "sign-up" ? "Create your account" : "Welcome back"}
      </h1>
      <p className="text-[13.5px] text-ink-3 mt-1.5">
        {mode === "sign-up"
          ? "Set up your store in about a minute."
          : "Sign in to pick up where you left off."}
      </p>

      <div className="mt-4 flex gap-2.5 rounded-[9px] border border-[var(--accent-soft-line)] bg-[var(--accent-soft)] px-3 py-2.5">
        <TriangleAlert className="size-4 text-[var(--accent-ink)] shrink-0 mt-px" aria-hidden />
        <p className="text-[12px] text-[var(--accent-ink)] leading-relaxed">
          <strong className="font-semibold">Development mode.</strong> Clerk is not configured, so
          this form signs you in locally with no password. Add your Clerk keys to{" "}
          <code className="font-mono text-[11px]">.env.local</code> to use real authentication.
        </p>
      </div>

      <form
        action={async (fd) => {
          setPending(true);
          try {
            await devSignIn(fd);
          } finally {
            setPending(false);
          }
        }}
        className="mt-5 space-y-3.5"
      >
        <div>
          <Label htmlFor="email" required>Email address</Label>
          <Input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            autoFocus
            placeholder="you@yourstore.com"
          />
          <FieldHint>The same address always returns to the same account.</FieldHint>
        </div>

        {mode === "sign-up" ? (
          <div>
            <Label htmlFor="displayName">Your name</Label>
            <Input id="displayName" name="displayName" autoComplete="name" placeholder="Alex Rivera" />
          </div>
        ) : null}

        <Button type="submit" variant="primary" size="lg" className="w-full" loading={pending}>
          {mode === "sign-up" ? "Create account" : "Continue"}
        </Button>
      </form>

      <p className="text-[13px] text-ink-3 mt-5 text-center">
        {mode === "sign-up" ? "Already have an account? " : "New to NexaStore? "}
        <Link
          href={mode === "sign-up" ? "/sign-in" : "/sign-up"}
          className="text-[var(--accent-ink)] font-medium hover:underline underline-offset-4"
        >
          {mode === "sign-up" ? "Sign in" : "Create an account"}
        </Link>
      </p>
    </div>
  );
}
