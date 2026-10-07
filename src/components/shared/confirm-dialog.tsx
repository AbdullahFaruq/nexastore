"use client";

import * as React from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog";

/**
 * Confirmation for anything hard to undo.
 *
 * The description says what will actually happen - "the goods go back into
 * stock and both records are kept" - rather than "are you sure?", which asks
 * the user to guess at consequences.
 */
export function ConfirmDialog({
  open, onOpenChange, title, description, confirmLabel = "Confirm",
  cancelLabel = "Cancel", destructive, loading, onConfirm, children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void | Promise<void>;
  children?: React.ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader title={title} />
        <DialogBody>
          <div className="flex gap-3">
            {destructive ? (
              <span className="size-8 grid place-items-center rounded-full bg-[var(--neg-soft)] shrink-0">
                <AlertTriangle className="size-4 text-[var(--neg)]" aria-hidden />
              </span>
            ) : null}
            <div className="min-w-0 flex-1">
              {description ? (
                <p className="text-[13px] text-ink-2 leading-relaxed">{description}</p>
              ) : null}
              {children}
            </div>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button
            variant={destructive ? "danger" : "primary"}
            loading={loading}
            onClick={() => void onConfirm()}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
