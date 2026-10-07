import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * The mark: a stepped ascent inside an aperture. It reads as a rising bar
 * chart at small sizes and as a ledger column at large ones, which is the
 * product in one glyph.
 */
export function LogoMark({ size = 26, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      className={cn("shrink-0", className)}
      aria-hidden
    >
      <rect width="32" height="32" rx="8" fill="var(--accent)" />
      <path
        d="M8 22.5V17.5M14 22.5V13M20 22.5V9.5"
        stroke="var(--accent-fg)"
        strokeWidth="2.75"
        strokeLinecap="round"
        opacity="0.95"
      />
      <path
        d="M8.5 12.5L14 8L20 11.5L24.5 7"
        stroke="var(--accent-fg)"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.5"
      />
      <circle cx="24" cy="22.5" r="1.6" fill="var(--accent-fg)" opacity="0.95" />
    </svg>
  );
}

export function Wordmark({
  size = 26,
  className,
  hideText,
}: {
  size?: number;
  className?: string;
  hideText?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark size={size} />
      {hideText ? null : (
        <span
          className="font-semibold text-ink tracking-[-0.022em]"
          style={{ fontSize: size * 0.62 }}
        >
          Nexa<span className="text-[var(--accent-ink)]">Store</span>
        </span>
      )}
    </span>
  );
}
