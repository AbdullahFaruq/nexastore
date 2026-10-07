"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, RefreshCw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Global error boundary.
 *
 * Shows what the user can do, never the stack. Next passes a `digest` for
 * server errors, which is the id in the server log - quoting it lets support
 * find the exact failure without exposing anything about it.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error("[nexastore] render error:", error);
  }, [error]);

  return (
    <div className="min-h-dvh grid place-items-center px-5 py-12 bg-[var(--page)]">
      <div className="w-full max-w-[440px] text-center">
        <div className="size-12 mx-auto grid place-items-center rounded-[12px] bg-[var(--neg-soft)] mb-5">
          <TriangleAlert className="size-5 text-[var(--neg)]" aria-hidden />
        </div>

        <h1 className="text-[21px] font-semibold text-ink tracking-[-0.025em]">
          Something went wrong on our side
        </h1>
        <p className="text-[13.5px] text-ink-2 mt-2.5 leading-relaxed">
          This page could not be loaded. Your data is safe - nothing was changed by this error.
        </p>

        <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-2">
          <Button variant="primary" size="md" onClick={reset} className="w-full sm:w-auto">
            <RefreshCw />
            Try again
          </Button>
          <Button asChild variant="secondary" size="md" className="w-full sm:w-auto">
            <Link href="/dashboard">
              <ArrowLeft />
              Back to dashboard
            </Link>
          </Button>
        </div>

        {error.digest ? (
          <p className="mt-6 text-[11.5px] text-ink-3">
            Reference{" "}
            <code className="font-mono text-ink-2 bg-[var(--surface-2)] px-1.5 py-0.5 rounded-[4px]">
              {error.digest}
            </code>
          </p>
        ) : null}
      </div>
    </div>
  );
}
