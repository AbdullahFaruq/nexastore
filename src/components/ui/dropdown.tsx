"use client";

import * as React from "react";
import { DropdownMenu as M, Slot } from "radix-ui";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export const Dropdown = M.Root;
export const DropdownTrigger = M.Trigger;
export const DropdownGroup = M.Group;
export const DropdownSub = M.Sub;
export const DropdownSubTrigger = M.SubTrigger;

const contentClass = [
  "z-50 min-w-[190px] overflow-hidden p-1",
  "bg-[var(--surface)] border border-[var(--line-strong)] rounded-[9px] shadow-pop",
  "data-[state=open]:animate-pop-in origin-[var(--radix-dropdown-menu-content-transform-origin)]",
].join(" ");

export function DropdownContent({
  className,
  sideOffset = 6,
  ...props
}: React.ComponentProps<typeof M.Content>) {
  return (
    <M.Portal>
      <M.Content sideOffset={sideOffset} className={cn(contentClass, className)} {...props} />
    </M.Portal>
  );
}

const itemClass = [
  "relative flex items-center gap-2 select-none rounded-[6px] px-2 py-1.5",
  "text-[13px] text-ink-2 cursor-pointer outline-none",
  "data-[highlighted]:bg-[var(--surface-2)] data-[highlighted]:text-ink",
  "data-[disabled]:opacity-45 data-[disabled]:pointer-events-none",
  "[&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-[var(--ink-3)]",
  "data-[highlighted]:[&_svg]:text-ink-2",
].join(" ");

export function DropdownItem({
  className,
  destructive,
  shortcut,
  children,
  ...props
}: React.ComponentProps<typeof M.Item> & { destructive?: boolean; shortcut?: string }) {
  return (
    <M.Item
      className={cn(
        itemClass,
        destructive &&
          "text-[var(--neg)] data-[highlighted]:bg-[var(--neg-soft)] data-[highlighted]:text-[var(--neg)] [&_svg]:text-[var(--neg)] data-[highlighted]:[&_svg]:text-[var(--neg)]",
        className,
      )}
      {...props}
    >
      {/*
        In `asChild` mode the caller's element IS the item, so the shortcut may
        not be a sibling of it - Slot would then see two children and throw.
        `Slottable` marks which child to merge onto, and the kbd is rendered
        inside it. Outside `asChild` it is a passthrough.
      */}
      <Slot.Slottable>{children}</Slot.Slottable>
      {shortcut ? (
        <kbd className="ml-auto pl-3 text-[11px] font-mono text-[var(--ink-3)]">{shortcut}</kbd>
      ) : null}
    </M.Item>
  );
}

export function DropdownCheckItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof M.CheckboxItem>) {
  return (
    <M.CheckboxItem className={cn(itemClass, "pr-8", className)} {...props}>
      {children}
      <M.ItemIndicator className="absolute right-2">
        <Check className="size-3.5 text-[var(--accent-ink)]" />
      </M.ItemIndicator>
    </M.CheckboxItem>
  );
}

export function DropdownRadioItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof M.RadioItem>) {
  return (
    <M.RadioItem className={cn(itemClass, "pr-8", className)} {...props}>
      {children}
      <M.ItemIndicator className="absolute right-2">
        <Check className="size-3.5 text-[var(--accent-ink)]" />
      </M.ItemIndicator>
    </M.RadioItem>
  );
}

export const DropdownRadioGroup = M.RadioGroup;

export function DropdownLabel({ className, ...props }: React.ComponentProps<typeof M.Label>) {
  return (
    <M.Label
      className={cn("px-2 pt-2 pb-1 text-[10.5px] font-semibold uppercase tracking-[0.07em] text-[var(--ink-3)]", className)}
      {...props}
    />
  );
}

export function DropdownSeparator({ className, ...props }: React.ComponentProps<typeof M.Separator>) {
  return <M.Separator className={cn("my-1 h-px bg-[var(--line)]", className)} {...props} />;
}
