import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * The structural container for everything on a page.
 * Structure comes from hairline borders, not shadows - shadows are reserved
 * for things that actually float above the page.
 */
export function Panel({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "bg-[var(--surface)] border border-[var(--line)] rounded-[9px] overflow-hidden",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function PanelHeader({
  title,
  description,
  actions,
  className,
  children,
}: {
  title?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-4 px-4 py-3 sm:px-5 border-b border-[var(--line)]",
        className,
      )}
    >
      <div className="min-w-0">
        {title ? (
          <h2 className="text-[13.5px] font-semibold text-ink tracking-[-0.01em] truncate">{title}</h2>
        ) : null}
        {description ? (
          <p className="text-[12.5px] text-ink-3 mt-0.5 leading-snug">{description}</p>
        ) : null}
        {children}
      </div>
      {actions ? <div className="flex items-center gap-1.5 shrink-0">{actions}</div> : null}
    </div>
  );
}

export function PanelBody({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("p-4 sm:p-5", className)}>{children}</div>;
}

export function PanelFooter({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("px-4 py-2.5 sm:px-5 border-t border-[var(--line)] bg-[var(--inset)]", className)}>
      {children}
    </div>
  );
}

/** The signature measurement-tick rule used between instrument regions. */
export function TickRule({ className }: { className?: string }) {
  return <div className={cn("tick-rule", className)} aria-hidden />;
}
