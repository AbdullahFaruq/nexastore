"use client";

import * as React from "react";
import { Slot } from "radix-ui";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  [
    "relative inline-flex items-center justify-center gap-2 whitespace-nowrap",
    "font-medium select-none",
    "transition-[background-color,border-color,color,box-shadow,transform] duration-150",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]",
    "disabled:pointer-events-none disabled:opacity-45",
    "active:translate-y-px",
    "[&_svg]:shrink-0 [&_svg]:pointer-events-none",
  ].join(" "),
  {
    variants: {
      variant: {
        primary:
          "bg-[var(--accent)] text-[var(--accent-fg)] hover:bg-[var(--accent-hover)] active:bg-[var(--accent-active)] shadow-[0_1px_0_0_rgb(255_255_255/0.12)_inset]",
        secondary:
          "bg-[var(--surface)] text-ink border border-[var(--line-strong)] hover:bg-[var(--surface-2)] hover:border-[var(--ink-3)]",
        ghost: "text-ink-2 hover:bg-[var(--surface-2)] hover:text-ink",
        subtle: "bg-[var(--surface-2)] text-ink hover:bg-[var(--surface-3)]",
        danger:
          "bg-[var(--neg)] text-white hover:brightness-110 active:brightness-95",
        dangerGhost:
          "text-[var(--neg)] hover:bg-[var(--neg-soft)]",
        link: "text-[var(--accent-ink)] underline-offset-4 hover:underline p-0 h-auto",
      },
      size: {
        xs: "h-7 rounded-[5px] px-2 text-[12px] [&_svg]:size-3.5",
        sm: "h-8 rounded-[6px] px-2.5 text-[13px] [&_svg]:size-4",
        md: "h-9 rounded-[7px] px-3.5 text-[13.5px] [&_svg]:size-4",
        lg: "h-11 rounded-[9px] px-5 text-[15px] [&_svg]:size-[18px]",
        icon: "size-9 rounded-[7px] [&_svg]:size-4",
        iconSm: "size-8 rounded-[6px] [&_svg]:size-4",
      },
    },
    defaultVariants: { variant: "secondary", size: "md" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
  /** Rendered on the right, dimmed - e.g. a keyboard hint. */
  hint?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild, loading, hint, children, disabled, ...props }, ref) => {
    const classes = cn(buttonVariants({ variant, size }), className);

    // Slot forwards props onto exactly one element child, so in asChild mode the
    // caller's element IS the button - no spinner or hint wrapper may be added
    // around it, or Slot has two children and throws.
    if (asChild) {
      return (
        <Slot.Root ref={ref} className={classes} {...props}>
          {children}
        </Slot.Root>
      );
    }

    return (
      <button
        ref={ref}
        className={classes}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
        {children}
        {hint ? <kbd className="ml-1 text-[11px] opacity-55 font-mono">{hint}</kbd> : null}
      </button>
    );
  },
);
Button.displayName = "Button";

export { buttonVariants };
