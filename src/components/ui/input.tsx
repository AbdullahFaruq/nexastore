"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

const base = [
  "w-full bg-[var(--surface)] text-ink placeholder:text-[var(--ink-3)]",
  "border border-[var(--line-strong)] rounded-[7px]",
  "transition-[border-color,box-shadow] duration-150",
  "hover:border-[var(--ink-3)]",
  "focus:outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/18",
  "disabled:opacity-55 disabled:cursor-not-allowed disabled:bg-[var(--surface-2)]",
  "aria-[invalid=true]:border-[var(--neg)] aria-[invalid=true]:ring-2 aria-[invalid=true]:ring-[var(--neg)]/15",
].join(" ");

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input ref={ref} className={cn(base, "h-9 px-3 text-[13.5px]", className)} {...props} />
  ),
);
Input.displayName = "Input";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea ref={ref} className={cn(base, "min-h-20 px-3 py-2 text-[13.5px] resize-y", className)} {...props} />
));
Textarea.displayName = "Textarea";

/** Native select styled to match; used where a listbox would be overkill. */
export const NativeSelect = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, children, ...props }, ref) => (
  <div className="relative">
    <select
      ref={ref}
      className={cn(base, "h-9 pl-3 pr-8 text-[13.5px] appearance-none cursor-pointer", className)}
      {...props}
    >
      {children}
    </select>
    <svg
      className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 size-3.5 text-[var(--ink-3)]"
      viewBox="0 0 16 16" fill="none" aria-hidden
    >
      <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  </div>
));
NativeSelect.displayName = "NativeSelect";

export function Label({
  className,
  required,
  children,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement> & { required?: boolean }) {
  return (
    <label className={cn("block text-[12.5px] font-medium text-ink-2 mb-1.5", className)} {...props}>
      {children}
      {required ? <span className="text-[var(--neg)] ml-0.5" aria-hidden>*</span> : null}
    </label>
  );
}

export function FieldError({ children }: { children?: React.ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="mt-1.5 text-[12px] text-[var(--neg)] flex items-start gap-1">
      <span aria-hidden className="mt-px">&#9888;</span>
      <span>{children}</span>
    </p>
  );
}

export function FieldHint({ children }: { children?: React.ReactNode }) {
  if (!children) return null;
  return <p className="mt-1.5 text-[12px] text-[var(--ink-3)] leading-relaxed">{children}</p>;
}

/**
 * A money field. The currency symbol is rendered as an adornment rather than
 * baked into the value, so what the user types stays a plain number.
 */
export const MoneyInput = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & { symbol: string }
>(({ className, symbol, ...props }, ref) => (
  <div className="relative">
    <span
      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-[var(--ink-3)] tabular-nums"
      aria-hidden
    >
      {symbol}
    </span>
    <input
      ref={ref}
      inputMode="decimal"
      autoComplete="off"
      className={cn(base, "h-9 pr-3 text-[13.5px] tnum", className)}
      style={{ paddingLeft: `${Math.max(2.2, symbol.length * 0.55 + 1.6)}rem` }}
      {...props}
    />
  </div>
));
MoneyInput.displayName = "MoneyInput";
