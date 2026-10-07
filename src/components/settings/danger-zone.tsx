"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { clearDemoData, deleteStore } from "@/actions/store";
import { loadDemoData } from "@/actions/demo";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Input, Label } from "@/components/ui/input";

/**
 * Destructive and demo-data actions, kept together and visually separated from
 * everything else so nobody reaches them by accident.
 */
export function DangerZone({
  storeName,
  canDeleteStore,
  demoCounts,
}: {
  storeName: string;
  canDeleteStore: boolean;
  demoCounts: { products: number; sales: number };
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [clearOpen, setClearOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [confirmName, setConfirmName] = React.useState("");

  const hasDemo = demoCounts.products > 0 || demoCounts.sales > 0;

  return (
    <>
      <Panel>
        <PanelHeader
          title="Sample data"
          description="Demo records are tagged separately and can be removed without touching anything real."
        />
        <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <p className="text-[12.5px] text-ink-2 leading-relaxed">
            {hasDemo ? (
              <>
                This store currently holds{" "}
                <span className="font-medium text-ink tnum">
                  {demoCounts.products.toLocaleString()} sample products
                </span>{" "}
                and{" "}
                <span className="font-medium text-ink tnum">
                  {demoCounts.sales.toLocaleString()} sample sales
                </span>
                . Removing them leaves everything you entered yourself intact.
              </>
            ) : (
              "There is no sample data in this store. You can load a year of realistic trading history to explore the reports."
            )}
          </p>

          {hasDemo ? (
            <Button variant="secondary" size="sm" onClick={() => setClearOpen(true)} className="shrink-0">
              <Trash2 />
              Remove sample data
            </Button>
          ) : (
            <Button
              variant="secondary"
              size="sm"
              loading={pending}
              className="shrink-0"
              onClick={async () => {
                setPending(true);
                const res = await loadDemoData(12);
                setPending(false);
                if (res.ok) {
                  toast.success(`Loaded ${res.data.sales.toLocaleString()} sample transactions`);
                  router.refresh();
                } else toast.error(res.error);
              }}
            >
              <Sparkles />
              Load sample data
            </Button>
          )}
        </div>
      </Panel>

      {canDeleteStore ? (
        <Panel className="border-[var(--neg)]/35">
          <div className="px-4 sm:px-5 py-3 border-b border-[var(--neg)]/25 bg-[var(--neg-soft)]">
            <h2 className="text-[13.5px] font-semibold text-[var(--neg)] flex items-center gap-2">
              <AlertTriangle className="size-4" aria-hidden />
              Danger zone
            </h2>
          </div>
          <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <p className="text-[12.5px] text-ink-2 leading-relaxed">
              Deleting <span className="font-medium text-ink">{storeName}</span> permanently removes
              every product, sale, customer, expense and report in it. This cannot be undone and
              there is no backup.
            </p>
            <Button variant="danger" size="sm" onClick={() => setDeleteOpen(true)} className="shrink-0">
              <Trash2 />
              Delete this store
            </Button>
          </div>
        </Panel>
      ) : null}

      <ConfirmDialog
        open={clearOpen}
        onOpenChange={setClearOpen}
        title="Remove all sample data?"
        description="Every record tagged as demo will be deleted: products, sales, customers, expenses and inventory movements. Anything you entered yourself is untouched."
        confirmLabel="Remove sample data"
        destructive
        loading={pending}
        onConfirm={async () => {
          setPending(true);
          const res = await clearDemoData();
          setPending(false);
          if (res.ok) {
            toast.success(`Removed ${res.data.removed.toLocaleString()} sample records`);
            setClearOpen(false);
            router.refresh();
          } else toast.error(res.error);
        }}
      />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Delete ${storeName}?`}
        description="This removes the store and everything in it, for every member of the team. There is no way back."
        confirmLabel="Delete permanently"
        destructive
        loading={pending}
        onConfirm={async () => {
          setPending(true);
          const res = await deleteStore(confirmName);
          setPending(false);
          // A successful delete redirects, so reaching here means it failed.
          if (res && !res.ok) toast.error(res.error);
        }}
      >
        <div className="mt-3">
          <Label htmlFor="confirm-store-name">
            Type <span className="font-mono text-ink">{storeName}</span> to confirm
          </Label>
          <Input
            id="confirm-store-name"
            value={confirmName}
            onChange={(e) => setConfirmName(e.target.value)}
            placeholder={storeName}
            autoComplete="off"
          />
        </div>
      </ConfirmDialog>
    </>
  );
}
