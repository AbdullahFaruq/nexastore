"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Clock, MoreHorizontal, Shield, Trash2, UserMinus } from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/format/dates";
import { ROLE_LABELS } from "@/lib/auth/permissions";
import type { Role } from "@/lib/db/models/enums";
import { ROLES } from "@/lib/db/models/enums";
import { removeMember, updateMember } from "@/actions/team";
import { useStore } from "@/components/providers/store-provider";
import { Avatar } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dropdown, DropdownContent, DropdownLabel, DropdownRadioGroup, DropdownRadioItem,
  DropdownSeparator, DropdownItem, DropdownTrigger,
} from "@/components/ui/dropdown";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";

export interface TeamMember {
  id: string;
  userId: string;
  displayName: string;
  email?: string;
  avatarUrl?: string;
  role: Role;
  status: "active" | "invited" | "suspended";
  createdAt: string;
}

export function TeamList({
  members, currentUserId, canManage,
}: {
  members: TeamMember[];
  currentUserId: string;
  canManage: boolean;
}) {
  const { timezone } = useStore();
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [removing, setRemoving] = React.useState<TeamMember | null>(null);

  const changeRole = async (member: TeamMember, role: Role) => {
    if (role === member.role) return;
    setPending(true);
    const res = await updateMember({ membershipId: member.id, role });
    setPending(false);
    if (res.ok) {
      toast.success(`${member.displayName} is now a ${ROLE_LABELS[role].toLowerCase()}`);
      router.refresh();
    } else {
      toast.error(res.error);
    }
  };

  return (
    <>
      <ul className="divide-y divide-[var(--line)]">
        {members.map((m) => {
          const isSelf = m.userId === currentUserId;
          return (
            <li key={m.id} className="flex items-center gap-3 px-4 sm:px-5 py-3">
              <Avatar name={m.displayName} src={m.avatarUrl} size={36} />

              <div className="min-w-0 flex-1">
                <p className="text-[13.5px] font-medium text-ink truncate">
                  {m.displayName}
                  {isSelf ? <span className="text-ink-3 font-normal ml-1.5">you</span> : null}
                </p>
                <p className="text-[11.5px] text-ink-3 truncate">
                  {m.email ?? "No email on file"}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {m.status === "invited" ? (
                  <Badge tone="outline" size="sm">
                    <Clock className="size-2.5" />
                    Invited
                  </Badge>
                ) : m.status === "suspended" ? (
                  <Badge tone="negative" size="sm">Suspended</Badge>
                ) : null}

                <Badge tone={m.role === "owner" ? "accent" : "neutral"} size="sm">
                  {m.role === "owner" ? <Shield className="size-2.5" /> : null}
                  {ROLE_LABELS[m.role]}
                </Badge>

                <span className="hidden sm:block text-[11.5px] text-ink-3 tnum w-[92px] text-right">
                  {formatDate(m.createdAt, timezone)}
                </span>

                {canManage && !isSelf ? (
                  <Dropdown>
                    <DropdownTrigger asChild>
                      <Button variant="ghost" size="iconSm" aria-label={`Manage ${m.displayName}`} disabled={pending}>
                        <MoreHorizontal />
                      </Button>
                    </DropdownTrigger>
                    <DropdownContent align="end">
                      <DropdownLabel>Role</DropdownLabel>
                      <DropdownRadioGroup
                        value={m.role}
                        onValueChange={(v) => changeRole(m, v as Role)}
                      >
                        {ROLES.map((r) => (
                          <DropdownRadioItem key={r} value={r}>
                            {ROLE_LABELS[r]}
                          </DropdownRadioItem>
                        ))}
                      </DropdownRadioGroup>

                      <DropdownSeparator />
                      {m.status === "active" ? (
                        <DropdownItem
                          onSelect={async () => {
                            const res = await updateMember({ membershipId: m.id, status: "suspended" });
                            if (res.ok) {
                              toast.success(`${m.displayName} suspended`);
                              router.refresh();
                            } else toast.error(res.error);
                          }}
                        >
                          <UserMinus /> Suspend access
                        </DropdownItem>
                      ) : (
                        <DropdownItem
                          onSelect={async () => {
                            const res = await updateMember({ membershipId: m.id, status: "active" });
                            if (res.ok) {
                              toast.success(`${m.displayName} restored`);
                              router.refresh();
                            } else toast.error(res.error);
                          }}
                        >
                          <Shield /> Restore access
                        </DropdownItem>
                      )}
                      <DropdownItem destructive onSelect={() => setRemoving(m)}>
                        <Trash2 /> Remove from store
                      </DropdownItem>
                    </DropdownContent>
                  </Dropdown>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>

      <ConfirmDialog
        open={Boolean(removing)}
        onOpenChange={(o) => !o && setRemoving(null)}
        title={`Remove ${removing?.displayName}?`}
        description="They lose access to this store immediately. Any sales they recorded stay on the books with their name attached."
        confirmLabel="Remove"
        destructive
        loading={pending}
        onConfirm={async () => {
          if (!removing) return;
          setPending(true);
          const res = await removeMember(removing.id);
          setPending(false);
          if (res.ok) {
            toast.success(`${removing.displayName} removed`);
            setRemoving(null);
            router.refresh();
          } else {
            toast.error(res.error);
          }
        }}
      />
    </>
  );
}
