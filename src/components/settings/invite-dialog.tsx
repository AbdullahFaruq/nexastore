"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";
import { toast } from "sonner";
import { ROLE_DESCRIPTIONS, ROLE_LABELS } from "@/lib/auth/permissions";
import { ROLES, type Role } from "@/lib/db/models/enums";
import { inviteMember } from "@/actions/team";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { FieldError, FieldHint, Input, Label } from "@/components/ui/input";

export function InviteDialog() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [email, setEmail] = React.useState("");
  const [name, setName] = React.useState("");
  const [role, setRole] = React.useState<Role>("employee");
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [pending, setPending] = React.useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPending(true);
    setErrors({});
    const res = await inviteMember({ email, role, displayName: name || undefined });
    setPending(false);

    if (!res.ok) {
      setErrors(res.fields ?? {});
      toast.error(res.error);
      return;
    }

    toast.success(`Invitation created for ${email}`, {
      description: "They join the store the first time they sign in with that address.",
    });
    setOpen(false);
    setEmail("");
    setName("");
    router.refresh();
  };

  return (
    <>
      <Button variant="primary" size="sm" onClick={() => setOpen(true)}>
        <UserPlus />
        Invite someone
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent size="sm">
          <DialogHeader
            title="Invite a team member"
            description="They get access the first time they sign in with this email address. Until then the invitation grants nothing."
          />
          <form onSubmit={submit}>
            <DialogBody className="space-y-4">
              <div>
                <Label htmlFor="invite-email" required>Email address</Label>
                <Input
                  id="invite-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="sam@yourstore.com"
                  required
                  autoFocus
                  aria-invalid={Boolean(errors.email)}
                />
                <FieldError>{errors.email}</FieldError>
              </div>

              <div>
                <Label htmlFor="invite-name">Their name</Label>
                <Input
                  id="invite-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Sam Okafor"
                />
                <FieldHint>Shown on the team list until they sign in.</FieldHint>
              </div>

              <div>
                <Label>Role</Label>
                <div className="space-y-2 mt-1">
                  {ROLES.map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRole(r)}
                      aria-pressed={role === r}
                      className={`w-full text-left rounded-[8px] border px-3.5 py-2.5 transition-all ${
                        role === r
                          ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                          : "border-[var(--line)] bg-[var(--surface)] hover:border-[var(--line-strong)]"
                      }`}
                    >
                      <span
                        className={`block text-[13px] font-medium ${
                          role === r ? "text-[var(--accent-ink)]" : "text-ink"
                        }`}
                      >
                        {ROLE_LABELS[r]}
                      </span>
                      <span className="block text-[11.5px] text-ink-3 mt-0.5 leading-snug">
                        {ROLE_DESCRIPTIONS[r]}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </DialogBody>

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" variant="primary" loading={pending}>
                Create invitation
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
