"use client";

import * as React from "react";
import { Popover as P, Tooltip as T } from "radix-ui";
import { cn } from "@/lib/utils";

export const Popover = P.Root;
export const PopoverTrigger = P.Trigger;
export const PopoverAnchor = P.Anchor;
export const PopoverClose = P.Close;

export function PopoverContent({
  className,
  sideOffset = 6,
  align = "start",
  ...props
}: React.ComponentProps<typeof P.Content>) {
  return (
    <P.Portal>
      <P.Content
        align={align}
        sideOffset={sideOffset}
        className={cn(
          "z-50 bg-[var(--surface)] border border-[var(--line-strong)] rounded-[10px] shadow-pop",
          "data-[state=open]:animate-pop-in origin-[var(--radix-popover-content-transform-origin)]",
          "max-h-[min(70dvh,32rem)] overflow-auto",
          className,
        )}
        {...props}
      />
    </P.Portal>
  );
}

export const TooltipProvider = T.Provider;

/** A tooltip is supplementary; never put information here that exists nowhere else. */
export function Tooltip({
  content,
  children,
  side = "top",
  delay = 250,
}: {
  content: React.ReactNode;
  children: React.ReactNode;
  side?: "top" | "right" | "bottom" | "left";
  delay?: number;
}) {
  if (!content) return <>{children}</>;
  return (
    <T.Root delayDuration={delay}>
      <T.Trigger asChild>{children}</T.Trigger>
      <T.Portal>
        <T.Content
          side={side}
          sideOffset={6}
          className={cn(
            "z-50 max-w-[260px] rounded-[7px] px-2.5 py-1.5",
            "bg-[var(--ink)] text-[var(--ink-invert)] text-[12px] leading-snug",
            "shadow-pop data-[state=delayed-open]:animate-pop-in",
          )}
        >
          {content}
          <T.Arrow className="fill-[var(--ink)]" width={10} height={5} />
        </T.Content>
      </T.Portal>
    </T.Root>
  );
}
