import * as React from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Every page opens with the same three things: where you are, what this page
 * is, and what you can do here. Consistency here is what makes the product
 * feel like one system rather than a collection of screens.
 */
export function PageHeader({
  title,
  description,
  breadcrumbs,
  actions,
  children,
  className,
  sticky,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  breadcrumbs?: { label: string; href?: string }[];
  actions?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  sticky?: boolean;
}) {
  return (
    <div
      className={cn(
        "px-4 sm:px-6 pt-5 pb-4",
        sticky && "sticky top-14 z-20 bg-[var(--page)]/90 backdrop-blur-md border-b border-[var(--line)]",
        className,
      )}
    >
      {breadcrumbs?.length ? (
        <nav aria-label="Breadcrumb" className="mb-2">
          <ol className="flex items-center gap-1 text-[12px] text-ink-3 flex-wrap">
            {breadcrumbs.map((c, i) => (
              <li key={i} className="flex items-center gap-1">
                {i > 0 ? <ChevronRight className="size-3 opacity-60" aria-hidden /> : null}
                {c.href ? (
                  <Link href={c.href} className="hover:text-ink-2 transition-colors rounded-[3px]">
                    {c.label}
                  </Link>
                ) : (
                  <span className="text-ink-2">{c.label}</span>
                )}
              </li>
            ))}
          </ol>
        </nav>
      ) : null}

      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[20px] sm:text-[22px] font-semibold text-ink tracking-[-0.025em] leading-tight">
            {title}
          </h1>
          {description ? (
            <p className="text-[13.5px] text-ink-3 mt-1 leading-relaxed max-w-[68ch]">{description}</p>
          ) : null}
        </div>
        {actions ? (
          <div className="flex items-center gap-2 shrink-0 flex-wrap">{actions}</div>
        ) : null}
      </div>

      {children ? <div className="mt-4">{children}</div> : null}
    </div>
  );
}

export function PageBody({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("px-4 sm:px-6 pb-10", className)}>{children}</div>;
}
