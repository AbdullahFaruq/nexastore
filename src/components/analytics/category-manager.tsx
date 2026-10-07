"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { MoreHorizontal, Pencil, Plus, Tag, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { formatMoney } from "@/lib/format/currency";
import { createCategory, deleteCategory, updateCategory } from "@/actions/categories";
import { useStore } from "@/components/providers/store-provider";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { FieldError, FieldHint, Input, Label, Textarea } from "@/components/ui/input";
import { Dropdown, DropdownContent, DropdownItem, DropdownSeparator, DropdownTrigger } from "@/components/ui/dropdown";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { seriesColor, SERIES_VARS } from "@/components/charts/chart-parts";
import { EmptyState } from "@/components/ui/empty-state";

export interface CategoryItem {
  id: string;
  name: string;
  description?: string;
  colorSlot: number;
  productCount: number;
  revenue: number;
  unitsSold: number;
}

export function CategoryManager({
  categories, canEdit, canDelete,
}: {
  categories: CategoryItem[];
  canEdit: boolean;
  canDelete: boolean;
}) {
  const { currency } = useStore();
  const router = useRouter();

  const [editing, setEditing] = React.useState<CategoryItem | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [deleting, setDeleting] = React.useState<CategoryItem | null>(null);
  const [pending, setPending] = React.useState(false);

  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [colorSlot, setColorSlot] = React.useState(0);
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  const openCreate = () => {
    setName("");
    setDescription("");
    setColorSlot(categories.length % 8);
    setErrors({});
    setCreating(true);
  };

  const openEdit = (c: CategoryItem) => {
    setName(c.name);
    setDescription(c.description ?? "");
    setColorSlot(c.colorSlot);
    setErrors({});
    setEditing(c);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPending(true);
    setErrors({});
    const payload = { name, description: description || undefined, colorSlot };
    const res = editing ? await updateCategory(editing.id, payload) : await createCategory(payload);
    setPending(false);

    if (!res.ok) {
      setErrors(res.fields ?? {});
      toast.error(res.error);
      return;
    }
    toast.success(editing ? "Category updated" : `${name} created`);
    setCreating(false);
    setEditing(null);
    router.refresh();
  };

  const open = creating || Boolean(editing);

  return (
    <>
      <Panel>
        <PanelHeader
          title="Manage categories"
          description="Renaming a category updates it everywhere; deleting one leaves its products in place."
          actions={
            canEdit ? (
              <Button variant="secondary" size="sm" onClick={openCreate}>
                <Plus />
                New category
              </Button>
            ) : null
          }
        />

        {categories.length === 0 ? (
          <EmptyState
            icon={<Tag strokeWidth={1.25} />}
            title="No categories yet"
            description="Categories are how you find out whether it is the accessories or the phones carrying the month."
            action={canEdit ? { label: "Create a category", onClick: openCreate } : undefined}
            compact
          />
        ) : (
          <ul className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-px bg-[var(--line)]">
            {categories.map((c) => (
              <li key={c.id} className="bg-[var(--surface)] p-4 flex items-start gap-3">
                <span
                  className="size-8 rounded-[7px] shrink-0 grid place-items-center"
                  style={{ background: `color-mix(in oklab, ${seriesColor(c.colorSlot)} 15%, var(--surface))` }}
                  aria-hidden
                >
                  <Tag className="size-3.5" style={{ color: seriesColor(c.colorSlot) }} />
                </span>

                <div className="min-w-0 flex-1">
                  <p className="text-[13.5px] font-medium text-ink truncate">{c.name}</p>
                  {c.description ? (
                    <p className="text-[11.5px] text-ink-3 mt-0.5 line-clamp-2">{c.description}</p>
                  ) : null}
                  <div className="flex items-center gap-2 mt-2 text-[11.5px] text-ink-3 tnum flex-wrap">
                    <Link
                      href={`/products?categoryId=${c.id}`}
                      className="hover:text-[var(--accent-ink)] transition-colors"
                    >
                      {c.productCount} product{c.productCount === 1 ? "" : "s"}
                    </Link>
                    <span className="opacity-50">&middot;</span>
                    <span>{c.unitsSold.toLocaleString()} sold</span>
                    <span className="opacity-50">&middot;</span>
                    <span className="text-ink-2 font-medium">
                      {formatMoney(c.revenue, currency, { compact: true })}
                    </span>
                  </div>
                </div>

                {canEdit ? (
                  <Dropdown>
                    <DropdownTrigger asChild>
                      <Button variant="ghost" size="iconSm" aria-label={`Actions for ${c.name}`}>
                        <MoreHorizontal />
                      </Button>
                    </DropdownTrigger>
                    <DropdownContent align="end">
                      <DropdownItem onSelect={() => openEdit(c)}>
                        <Pencil /> Edit
                      </DropdownItem>
                      <DropdownItem asChild>
                        <Link href={`/products?categoryId=${c.id}`}>
                          <Tag /> View products
                        </Link>
                      </DropdownItem>
                      {canDelete ? (
                        <>
                          <DropdownSeparator />
                          <DropdownItem destructive onSelect={() => setDeleting(c)}>
                            <Trash2 /> Delete
                          </DropdownItem>
                        </>
                      ) : null}
                    </DropdownContent>
                  </Dropdown>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next) {
            setCreating(false);
            setEditing(null);
          }
        }}
      >
        <DialogContent size="sm">
          <DialogHeader title={editing ? "Edit category" : "New category"} />
          <form onSubmit={submit}>
            <DialogBody className="space-y-4">
              <div>
                <Label htmlFor="cat-name" required>Name</Label>
                <Input
                  id="cat-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Accessories"
                  required
                  autoFocus
                  aria-invalid={Boolean(errors.name)}
                />
                <FieldError>{errors.name}</FieldError>
              </div>

              <div>
                <Label htmlFor="cat-desc">Description</Label>
                <Textarea
                  id="cat-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                />
              </div>

              <div>
                <Label>Chart colour</Label>
                <FieldHint>
                  Used wherever this category appears in a chart. The palette is fixed so colours
                  stay distinguishable, including for colour-blind readers.
                </FieldHint>
                <div className="flex flex-wrap gap-2 mt-2">
                  {SERIES_VARS.map((_, slot) => (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => setColorSlot(slot)}
                      aria-label={`Colour ${slot + 1}`}
                      aria-pressed={colorSlot === slot}
                      className={`size-7 rounded-[7px] transition-all ${
                        colorSlot === slot
                          ? "ring-2 ring-offset-2 ring-offset-[var(--surface)] ring-[var(--ink-3)] scale-105"
                          : "hover:scale-105"
                      }`}
                      style={{ background: seriesColor(slot) }}
                    />
                  ))}
                </div>
              </div>
            </DialogBody>

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setCreating(false);
                  setEditing(null);
                }}
              >
                Cancel
              </Button>
              <Button type="submit" variant="primary" loading={pending}>
                {editing ? "Save changes" : "Create category"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Delete ${deleting?.name}?`}
        description={
          deleting && deleting.productCount > 0
            ? `${deleting.productCount} product${deleting.productCount === 1 ? "" : "s"} will become uncategorised. Nothing is deleted with it, and past sales keep their history.`
            : "This category has no products in it."
        }
        confirmLabel="Delete category"
        destructive
        loading={pending}
        onConfirm={async () => {
          if (!deleting) return;
          setPending(true);
          const res = await deleteCategory(deleting.id);
          setPending(false);
          if (res.ok) {
            toast.success(
              res.data.detached > 0
                ? `Category deleted, ${res.data.detached} products left uncategorised`
                : "Category deleted",
            );
            setDeleting(null);
            router.refresh();
          } else {
            toast.error(res.error);
          }
        }}
      />
    </>
  );
}
