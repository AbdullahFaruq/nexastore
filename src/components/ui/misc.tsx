"use client";

import * as React from "react";
import { Avatar as A, Checkbox as C, Progress as Pr, Separator as S, Switch as Sw, Tabs as Tb } from "radix-ui";
import { Check, Minus } from "lucide-react";
import { cn, hashIndex, initialsOf } from "@/lib/utils";

/* ------------------------------------------------------------------ avatar */

const SERIES = ["--s1", "--s2", "--s3", "--s4", "--s5", "--s6", "--s7", "--s8"];

export function Avatar({
  name,
  src,
  size = 32,
  square,
  className,
  colorSlot,
}: {
  name: string;
  src?: string | null;
  size?: number;
  square?: boolean;
  className?: string;
  colorSlot?: number;
}) {
  const slot = colorSlot ?? hashIndex(name || "?", 8);
  const hue = `var(${SERIES[slot % 8]})`;
  return (
    <A.Root
      className={cn(
        "relative inline-flex shrink-0 overflow-hidden select-none",
        square ? "rounded-[7px]" : "rounded-full",
        className,
      )}
      style={{ width: size, height: size }}
    >
      {src ? <A.Image src={src} alt="" className="size-full object-cover" /> : null}
      <A.Fallback
        className="size-full grid place-items-center font-semibold"
        style={{
          background: `color-mix(in oklab, ${hue} 16%, var(--surface))`,
          color: `color-mix(in oklab, ${hue} 78%, var(--ink))`,
          fontSize: Math.max(9, size * 0.36),
        }}
        delayMs={src ? 400 : 0}
      >
        {initialsOf(name) || "?"}
      </A.Fallback>
    </A.Root>
  );
}

/* --------------------------------------------------------------- separator */

export function Separator({
  className,
  orientation = "horizontal",
}: {
  className?: string;
  orientation?: "horizontal" | "vertical";
}) {
  return (
    <S.Root
      orientation={orientation}
      className={cn(
        "bg-[var(--line)] shrink-0",
        orientation === "horizontal" ? "h-px w-full" : "w-px h-full",
        className,
      )}
    />
  );
}

/* ---------------------------------------------------------------- checkbox */

export function Checkbox({
  className,
  indeterminate,
  ...props
}: React.ComponentProps<typeof C.Root> & { indeterminate?: boolean }) {
  return (
    <C.Root
      className={cn(
        "peer size-[16px] shrink-0 rounded-[4px] border border-[var(--line-strong)] bg-[var(--surface)]",
        "transition-colors duration-100 cursor-pointer",
        "hover:border-[var(--ink-3)]",
        "data-[state=checked]:bg-[var(--accent)] data-[state=checked]:border-[var(--accent)]",
        "data-[state=indeterminate]:bg-[var(--accent)] data-[state=indeterminate]:border-[var(--accent)]",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]",
        "disabled:opacity-45 disabled:cursor-not-allowed",
        className,
      )}
      checked={indeterminate ? "indeterminate" : props.checked}
      {...props}
    >
      <C.Indicator className="grid place-items-center text-[var(--accent-fg)]">
        {indeterminate ? <Minus className="size-3 stroke-[3]" /> : <Check className="size-3 stroke-[3]" />}
      </C.Indicator>
    </C.Root>
  );
}

/* ------------------------------------------------------------------ switch */

export function Switch({ className, ...props }: React.ComponentProps<typeof Sw.Root>) {
  return (
    <Sw.Root
      className={cn(
        "relative h-[20px] w-[34px] shrink-0 cursor-pointer rounded-full transition-colors duration-150",
        "bg-[var(--line-strong)] data-[state=checked]:bg-[var(--accent)]",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]",
        "disabled:opacity-45 disabled:cursor-not-allowed",
        className,
      )}
      {...props}
    >
      <Sw.Thumb className="block size-[16px] translate-x-[2px] rounded-full bg-white shadow-sm transition-transform duration-150 data-[state=checked]:translate-x-[16px]" />
    </Sw.Root>
  );
}

/* -------------------------------------------------------------------- tabs */

export const Tabs = Tb.Root;

export function TabsList({ className, ...props }: React.ComponentProps<typeof Tb.List>) {
  return (
    <Tb.List
      className={cn(
        "inline-flex items-center gap-0.5 p-0.5 rounded-[8px] bg-[var(--surface-2)] border border-[var(--line)]",
        className,
      )}
      {...props}
    />
  );
}

export function TabsTrigger({ className, ...props }: React.ComponentProps<typeof Tb.Trigger>) {
  return (
    <Tb.Trigger
      className={cn(
        "px-2.5 h-7 rounded-[6px] text-[12.5px] font-medium text-ink-3 whitespace-nowrap",
        "transition-colors duration-100 cursor-pointer",
        "hover:text-ink-2",
        "data-[state=active]:bg-[var(--surface)] data-[state=active]:text-ink data-[state=active]:shadow-card",
        "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--ring)]",
        className,
      )}
      {...props}
    />
  );
}

export const TabsContent = Tb.Content;

/** Underlined tabs, for page-level navigation where a segmented control is too heavy. */
export function TabsUnderline({ className, ...props }: React.ComponentProps<typeof Tb.List>) {
  return (
    <Tb.List
      className={cn("flex items-center gap-4 border-b border-[var(--line)] overflow-x-auto", className)}
      {...props}
    />
  );
}

export function TabsUnderlineTrigger({ className, ...props }: React.ComponentProps<typeof Tb.Trigger>) {
  return (
    <Tb.Trigger
      className={cn(
        "relative py-2.5 text-[13px] font-medium text-ink-3 whitespace-nowrap cursor-pointer",
        "transition-colors hover:text-ink-2",
        "data-[state=active]:text-ink",
        "after:absolute after:inset-x-0 after:-bottom-px after:h-[2px] after:rounded-full",
        "after:bg-transparent data-[state=active]:after:bg-[var(--accent)]",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]",
        className,
      )}
      {...props}
    />
  );
}

/* ---------------------------------------------------------------- progress */

export function Progress({
  value,
  className,
  tone = "accent",
}: {
  value: number;
  className?: string;
  tone?: "accent" | "positive" | "negative" | "neutral";
}) {
  const color = {
    accent: "var(--accent)",
    positive: "var(--pos)",
    negative: "var(--neg)",
    neutral: "var(--ink-3)",
  }[tone];
  return (
    <Pr.Root
      value={Math.max(0, Math.min(100, value))}
      className={cn("relative h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-3)]", className)}
    >
      <Pr.Indicator
        className="h-full rounded-full transition-[width] duration-500 ease-out"
        style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: color }}
      />
    </Pr.Root>
  );
}
