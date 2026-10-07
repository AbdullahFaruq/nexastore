"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Ban, Check, MoreHorizontal, Pencil, Printer, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import type { SaleStatus } from "@/lib/db/models/enums";
import { cancelSale, markSalePaid, refundSale, updateSaleDetails } from "@/actions/sales";
import { Button } from "@/components/ui/button";
import {
  Dropdown, DropdownContent, DropdownItem, DropdownSeparator, DropdownTrigger,
} from "@/components/ui/dropdown";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { Label, Textarea } from "@/components/ui/input";

export function OrderActions({
  saleId, orderNumber, status, note, canRefund, canVoid, canEdit,
}: {
  saleId: string;
  orderNumber: string;
  status: SaleStatus;
  note: string;
  canRefund: boolean;
  canVoid: boolean;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [refundOpen, setRefundOpen] = React.useState(false);
  const [cancelOpen, setCancelOpen] = React.useState(false);
  const [editOpen, setEditOpen] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const [draftNote, setDraftNote] = React.useState(note);

  const run = async (fn: () => Promise<{ ok: boolean; error?: string }>, success: string) => {
    setPending(true);
    const res = await fn();
    setPending(false);
    if (res.ok) {
      toast.success(success);
      router.refresh();
      return true;
    }
    toast.error(res.error ?? "That did not work.");
    return false;
  };

  const isFinal = status === "refunded" || status === "cancelled";

  return (
    <>
      <Button asChild variant="secondary" size="sm">
        <Link href={`/invoices/${saleId}`}>
          <Printer />
          <span className="hidden sm:inline">Invoice</span>
        </Link>
      </Button>

      {status === "pending" ? (
        <Button
          variant="primary"
          size="sm"
          loading={pending}
          onClick={() => run(() => markSalePaid(saleId), `${orderNumber} marked as paid`)}
        >
          <Check />
          Mark paid
        </Button>
      ) : null}

      <Dropdown>
        <DropdownTrigger asChild>
          <Button variant="secondary" size="icon" aria-label="More actions">
            <MoreHorizontal />
          </Button>
        </DropdownTrigger>
        <DropdownContent align="end">
          {canEdit ? (
            <DropdownItem onSelect={() => setEditOpen(true)}>
              <Pencil /> Edit note
            </DropdownItem>
          ) : null}
          <DropdownItem asChild>
            <Link href={`/invoices/${saleId}`}>
              <Printer /> Print receipt
            </Link>
          </DropdownItem>

          {!isFinal && (canRefund || canVoid) ? <DropdownSeparator /> : null}

          {canVoid && status === "pending" ? (
            <DropdownItem destructive onSelect={() => setCancelOpen(true)}>
              <Ban /> Cancel order
            </DropdownItem>
          ) : null}
          {canRefund && status === "completed" ? (
            <DropdownItem destructive onSelect={() => setRefundOpen(true)}>
              <RotateCcw /> Refund order
            </DropdownItem>
          ) : null}
        </DropdownContent>
      </Dropdown>

      {/* --------------------------------------------------------- refund */}
      <ConfirmDialog
        open={refundOpen}
        onOpenChange={setRefundOpen}
        title={`Refund ${orderNumber}?`}
        description="The full amount is reversed, the goods go back into stock, and both the original sale and its reversal stay on the record. This cannot be undone."
        confirmLabel="Refund in full"
        destructive
        loading={pending}
        onConfirm={async () => {
          const done = await run(
            () => refundSale({ saleId, reason: reason || undefined, restock: true }),
            `${orderNumber} refunded and restocked`,
          );
          if (done) {
            setRefundOpen(false);
            setReason("");
          }
        }}
      >
        <div className="mt-3">
          <Label htmlFor="refund-reason">Reason (optional)</Label>
          <Textarea
            id="refund-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Faulty on arrival, customer changed their mind..."
            rows={2}
          />
        </div>
      </ConfirmDialog>

      {/* --------------------------------------------------------- cancel */}
      <ConfirmDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title={`Cancel ${orderNumber}?`}
        description="Nothing was earned on a pending order, so the reserved stock simply goes back on the shelf."
        confirmLabel="Cancel order"
        destructive
        loading={pending}
        onConfirm={async () => {
          const done = await run(
            () => cancelSale(saleId, reason || undefined),
            `${orderNumber} cancelled`,
          );
          if (done) setCancelOpen(false);
        }}
      />

      {/* ----------------------------------------------------------- edit */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent size="sm">
          <DialogHeader
            title="Edit order note"
            description="Amounts and line items cannot be edited. To correct a mistake, refund the order and ring it up again - that keeps the books honest."
          />
          <DialogBody>
            <Label htmlFor="order-note">Note</Label>
            <Textarea
              id="order-note"
              value={draftNote}
              onChange={(e) => setDraftNote(e.target.value)}
              rows={4}
              placeholder="Anything worth remembering about this order"
            />
          </DialogBody>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button
              variant="primary"
              loading={pending}
              onClick={async () => {
                const done = await run(
                  () => updateSaleDetails(saleId, { note: draftNote }),
                  "Note saved",
                );
                if (done) setEditOpen(false);
              }}
            >
              Save note
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
