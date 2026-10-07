import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Button } from "./button";

/**
 * Empty states explain what will appear here and how to make it appear.
 * "No data" is never enough - the owner needs to know the next move.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  secondaryAction,
  className,
  compact,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: React.ReactNode;
  action?: { label: string; href?: string; onClick?: () => void; icon?: React.ReactNode };
  secondaryAction?: { label: string; href: string };
  className?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        compact ? "py-8 px-4" : "py-14 px-6",
        className,
      )}
    >
      {icon ? (
        <div className="mb-4 text-[var(--ink-3)] [&_svg]:size-full" aria-hidden>
          <div className={compact ? "size-9" : "size-12"}>{icon}</div>
        </div>
      ) : null}
      <h3 className={cn("font-semibold text-ink tracking-[-0.01em]", compact ? "text-[13.5px]" : "text-[15px]")}>
        {title}
      </h3>
      {description ? (
        <p
          className={cn(
            "text-ink-3 mt-1.5 leading-relaxed",
            compact ? "text-[12.5px] max-w-[36ch]" : "text-[13.5px] max-w-[44ch]",
          )}
        >
          {description}
        </p>
      ) : null}
      {action || secondaryAction ? (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          {action ? (
            action.href ? (
              <Button asChild variant="primary" size={compact ? "sm" : "md"}>
                <Link href={action.href}>
                  {action.icon}
                  {action.label}
                </Link>
              </Button>
            ) : (
              <Button variant="primary" size={compact ? "sm" : "md"} onClick={action.onClick}>
                {action.icon}
                {action.label}
              </Button>
            )
          ) : null}
          {secondaryAction ? (
            <Button asChild variant="ghost" size={compact ? "sm" : "md"}>
              <Link href={secondaryAction.href}>{secondaryAction.label}</Link>
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/* --------------------------------------------------------------------------
   Line-drawn marks. Deliberately schematic rather than decorative - they read
   as instrument diagrams, which is the product's visual register.
   -------------------------------------------------------------------------- */

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.25,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function EmptyChartMark() {
  return (
    <svg viewBox="0 0 48 48" className="size-full" aria-hidden>
      <path d="M6 40h36" {...stroke} opacity={0.5} />
      <path d="M6 8v32" {...stroke} opacity={0.5} />
      <path d="M6 32l9-6 8 4 9-11 10 5" {...stroke} strokeDasharray="3 3" />
      <circle cx="15" cy="26" r="1.75" {...stroke} />
      <circle cx="32" cy="19" r="1.75" {...stroke} />
    </svg>
  );
}

export function EmptyBoxMark() {
  return (
    <svg viewBox="0 0 48 48" className="size-full" aria-hidden>
      <path d="M24 6l16 8v20l-16 8-16-8V14z" {...stroke} />
      <path d="M8 14l16 8 16-8M24 22v20" {...stroke} opacity={0.55} />
    </svg>
  );
}

export function EmptyReceiptMark() {
  return (
    <svg viewBox="0 0 48 48" className="size-full" aria-hidden>
      <path d="M12 6h24v34l-4-3-4 3-4-3-4 3-4-3-4 3z" {...stroke} />
      <path d="M18 16h12M18 22h12M18 28h7" {...stroke} opacity={0.6} />
    </svg>
  );
}

export function EmptyPeopleMark() {
  return (
    <svg viewBox="0 0 48 48" className="size-full" aria-hidden>
      <circle cx="19" cy="17" r="6" {...stroke} />
      <path d="M8 39c0-6.1 4.9-11 11-11s11 4.9 11 11" {...stroke} />
      <circle cx="33" cy="19" r="4.5" {...stroke} opacity={0.55} />
      <path d="M33 28c4.4 0 8 3.6 8 8" {...stroke} opacity={0.55} />
    </svg>
  );
}

export function EmptyWalletMark() {
  return (
    <svg viewBox="0 0 48 48" className="size-full" aria-hidden>
      <path d="M8 14a4 4 0 014-4h22v6" {...stroke} />
      <rect x="8" y="14" width="32" height="24" rx="4" {...stroke} />
      <path d="M40 22h-7a4 4 0 000 8h7" {...stroke} opacity={0.6} />
    </svg>
  );
}

export function EmptySearchMark() {
  return (
    <svg viewBox="0 0 48 48" className="size-full" aria-hidden>
      <circle cx="21" cy="21" r="12" {...stroke} />
      <path d="M30 30l10 10" {...stroke} />
      <path d="M16 21h10M21 16v10" {...stroke} opacity={0.4} />
    </svg>
  );
}
