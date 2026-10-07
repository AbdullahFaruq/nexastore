"use client";

import * as React from "react";
import { Dialog as D } from "radix-ui";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

export const Dialog = D.Root;
export const DialogTrigger = D.Trigger;
export const DialogClose = D.Close;

export function DialogContent({
  className,
  children,
  size = "md",
  ...props
}: React.ComponentProps<typeof D.Content> & { size?: "sm" | "md" | "lg" | "xl" }) {
  const width = {
    sm: "sm:max-w-[400px]",
    md: "sm:max-w-[540px]",
    lg: "sm:max-w-[720px]",
    xl: "sm:max-w-[960px]",
  }[size];

  return (
    <D.Portal>
      <D.Overlay
        className={cn(
          "fixed inset-0 z-50 bg-[rgb(20_18_16/0.42)] backdrop-blur-[2px]",
          "data-[state=open]:animate-fade data-[state=closed]:opacity-0",
        )}
      />
      <D.Content
        className={cn(
          "fixed z-50 bg-[var(--surface)] shadow-pop",
          // Mobile: a sheet from the bottom. Desktop: a centred dialog.
          "inset-x-0 bottom-0 rounded-t-[16px] max-h-[92dvh]",
          "sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2",
          "sm:rounded-[12px] sm:max-h-[88dvh] sm:w-[calc(100vw-3rem)]",
          "border border-[var(--line-strong)] flex flex-col",
          "data-[state=open]:animate-pop-in",
          width,
          className,
        )}
        {...props}
      >
        {children}
      </D.Content>
    </D.Portal>
  );
}

export function DialogHeader({
  title,
  description,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-4 px-5 pt-4 pb-3.5 border-b border-[var(--line)]", className)}>
      <div className="min-w-0">
        <D.Title className="text-[15px] font-semibold text-ink tracking-[-0.015em]">{title}</D.Title>
        {description ? (
          <D.Description className="text-[13px] text-ink-3 mt-1 leading-snug">{description}</D.Description>
        ) : (
          <D.Description className="sr-only">Dialog</D.Description>
        )}
      </div>
      <D.Close asChild>
        <Button variant="ghost" size="iconSm" aria-label="Close">
          <X />
        </Button>
      </D.Close>
    </div>
  );
}

export function DialogBody({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("px-5 py-4 overflow-y-auto flex-1 min-h-0", className)}>{children}</div>;
}

export function DialogFooter({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "flex flex-col-reverse sm:flex-row sm:justify-end gap-2 px-5 py-3.5",
        "border-t border-[var(--line)] bg-[var(--inset)]",
        "pb-[max(0.875rem,env(safe-area-inset-bottom))] sm:pb-3.5",
        className,
      )}
    >
      {children}
    </div>
  );
}
