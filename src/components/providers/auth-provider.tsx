import * as React from "react";
import { isClerkConfigured } from "@/lib/auth/provider";

/**
 * Mounts ClerkProvider only when keys are present.
 *
 * ClerkProvider throws without a publishable key, which would make the whole
 * app unrunnable before setup. This keeps the first-run experience working
 * while leaving Clerk as the only production path.
 */
export async function AuthProvider({ children }: { children: React.ReactNode }) {
  if (!isClerkConfigured()) return <>{children}</>;

  const { ClerkProvider } = await import("@clerk/nextjs");
  return (
    <ClerkProvider
      appearance={{
        variables: {
          colorPrimary: "#b8802e",
          borderRadius: "7px",
          fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
        },
      }}
    >
      {children}
    </ClerkProvider>
  );
}
