import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full font-medium whitespace-nowrap border",
  {
    variants: {
      tone: {
        neutral: "bg-[var(--surface-2)] text-ink-2 border-[var(--line)]",
        accent: "bg-[var(--accent-soft)] text-[var(--accent-ink)] border-[var(--accent-soft-line)]",
        positive: "bg-[var(--pos-soft)] text-[var(--pos)] border-transparent",
        negative: "bg-[var(--neg-soft)] text-[var(--neg)] border-transparent",
        outline: "bg-transparent text-ink-2 border-[var(--line-strong)]",
      },
      size: {
        sm: "text-[10.5px] px-1.5 py-px [&_svg]:size-2.5",
        md: "text-[11.5px] px-2 py-0.5 [&_svg]:size-3",
      },
    },
    defaultVariants: { tone: "neutral", size: "md" },
  },
);

export function Badge({
  className,
  tone,
  size,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone, size }), className)} {...props} />;
}
