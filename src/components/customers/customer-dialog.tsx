"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";
import { toast } from "sonner";
import { createCustomer, updateCustomer } from "@/actions/customers";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { FieldError, FieldHint, Input, Label, Textarea } from "@/components/ui/input";

export interface CustomerDraft {
  id?: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  notes: string;
}

const EMPTY: CustomerDraft = { name: "", email: "", phone: "", address: "", notes: "" };

export function CustomerDialog({
  openByDefault,
  initial,
  trigger,
  onClose,
}: {
  openByDefault?: boolean;
  initial?: CustomerDraft;
  trigger?: React.ReactNode;
  onClose?: () => void;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(Boolean(openByDefault));
  const [values, setValues] = React.useState<CustomerDraft>(initial ?? EMPTY);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [pending, setPending] = React.useState(false);

  const set = <K extends keyof CustomerDraft>(key: K, value: CustomerDraft[K]) => {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => (e[key as string] ? { ...e, [key as string]: "" } : e));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPending(true);
    setErrors({});

    const payload = {
      name: values.name,
      email: values.email || undefined,
      phone: values.phone || undefined,
      address: values.address || undefined,
      notes: values.notes || undefined,
      tags: [],
    };

    const res = values.id ? await updateCustomer(values.id, payload) : await createCustomer(payload);
    setPending(false);

    if (!res.ok) {
      setErrors(res.fields ?? {});
      toast.error(res.error);
      return;
    }

    toast.success(values.id ? "Customer updated" : `${values.name} added`);
    setOpen(false);
    setValues(EMPTY);
    onClose?.();
    router.refresh();
  };

  return (
    <>
      {trigger ? (
        <span onClick={() => setOpen(true)}>{trigger}</span>
      ) : (
        <Button variant="primary" size="sm" onClick={() => setOpen(true)}>
          <UserPlus />
          Add customer
        </Button>
      )}

      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) onClose?.();
        }}
      >
        <DialogContent size="sm">
          <DialogHeader
            title={values.id ? "Edit customer" : "Add a customer"}
            description="Attaching a customer to a sale builds their purchase history and lifetime value automatically."
          />
          <form onSubmit={submit}>
            <DialogBody className="space-y-4">
              <div>
                <Label htmlFor="cust-name" required>Name</Label>
                <Input
                  id="cust-name"
                  value={values.name}
                  onChange={(e) => set("name", e.target.value)}
                  placeholder="Amara Okafor"
                  required
                  autoFocus
                  aria-invalid={Boolean(errors.name)}
                />
                <FieldError>{errors.name}</FieldError>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="cust-email">Email</Label>
                  <Input
                    id="cust-email"
                    type="email"
                    value={values.email}
                    onChange={(e) => set("email", e.target.value)}
                    placeholder="amara@example.com"
                    aria-invalid={Boolean(errors.email)}
                  />
                  <FieldError>{errors.email}</FieldError>
                </div>
                <div>
                  <Label htmlFor="cust-phone">Phone</Label>
                  <Input
                    id="cust-phone"
                    type="tel"
                    value={values.phone}
                    onChange={(e) => set("phone", e.target.value)}
                    placeholder="+1 555 0142"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="cust-address">Address</Label>
                <Textarea
                  id="cust-address"
                  value={values.address}
                  onChange={(e) => set("address", e.target.value)}
                  rows={2}
                />
                <FieldHint>Used on invoices when this customer is attached to an order.</FieldHint>
              </div>

              <div>
                <Label htmlFor="cust-notes">Notes</Label>
                <Textarea
                  id="cust-notes"
                  value={values.notes}
                  onChange={(e) => set("notes", e.target.value)}
                  rows={2}
                  placeholder="Preferences, account terms, anything worth remembering"
                />
              </div>
            </DialogBody>

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" variant="primary" loading={pending}>
                {values.id ? "Save changes" : "Add customer"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
