"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, RefreshCw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";

/** Error boundary inside the app shell, so navigation stays available. */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error("[nexastore] page error:", error);
  }, [error]);

  return (
    <div className="px-4 sm:px-6 py-10">
      <Panel className="max-w-[520px] mx-auto">
        <div className="p-6 text-center">
          <div className="size-11 mx-auto grid place-items-center rounded-[11px] bg-[var(--neg-soft)] mb-4">
            <TriangleAlert className="size-5 text-[var(--neg)]" aria-hidden />
          </div>

          <h1 className="text-[17px] font-semibold text-ink tracking-[-0.02em]">
            This page could not be loaded
          </h1>
          <p className="text-[13px] text-ink-2 mt-2 leading-relaxed">
            Something failed while fetching your store data. Nothing was changed - your records are
            exactly as they were.
          </p>

          <div className="mt-5 flex flex-col sm:flex-row items-center justify-center gap-2">
            <Button variant="primary" size="sm" onClick={reset} className="w-full sm:w-auto">
              <RefreshCw />
              Try again
            </Button>
            <Button asChild variant="ghost" size="sm" className="w-full sm:w-auto">
              <Link href="/dashboard">
                <ArrowLeft />
                Back to dashboard
              </Link>
            </Button>
          </div>

          {error.digest ? (
            <p className="mt-5 text-[11.5px] text-ink-3">
              Reference{" "}
              <code className="font-mono text-ink-2 bg-[var(--surface-2)] px-1.5 py-0.5 rounded-[4px]">
                {error.digest}
              </code>
            </p>
          ) : null}
        </div>
      </Panel>
    </div>
  );
}
