"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { switchStore } from "@/actions/preferences";
import { useStore } from "@/components/providers/store-provider";
import { Dropdown, DropdownContent, DropdownItem, DropdownLabel, DropdownSeparator, DropdownTrigger } from "@/components/ui/dropdown";
import { Avatar } from "@/components/ui/misc";
import { ROLE_LABELS } from "@/lib/auth/permissions";

export function StoreSwitcher({ collapsed }: { collapsed?: boolean }) {
  const { storeId, storeName, stores, role, colorSlot } = useStore();
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  const onSwitch = (next: string) => {
    if (next === storeId) return;
    startTransition(async () => {
      const res = await switchStore(next);
      if (res.ok) {
        router.refresh();
        toast.success("Switched store");
      } else {
        toast.error(res.error);
      }
    });
  };

  // With a single store this is a label, not a control - a dropdown with one
  // option is noise.
  if (stores.length <= 1) {
    return (
      <div
        className={cn(
          "flex items-center gap-2 rounded-[8px] h-11",
          collapsed ? "justify-center" : "px-2",
        )}
      >
        <Avatar name={storeName} size={26} square colorSlot={colorSlot} />
        {!collapsed ? (
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-ink truncate leading-tight">{storeName}</p>
            <p className="text-[11px] text-ink-3 leading-tight">{ROLE_LABELS[role]}</p>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <Dropdown>
      <DropdownTrigger asChild>
        <button
          type="button"
          disabled={pending}
          className={cn(
            "flex items-center gap-2 rounded-[8px] h-11 w-full transition-colors",
            "hover:bg-[var(--surface-2)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]",
            collapsed ? "justify-center" : "px-2",
          )}
          aria-label={`Current store: ${storeName}. Switch store`}
        >
          <Avatar name={storeName} size={26} square colorSlot={colorSlot} />
          {!collapsed ? (
            <>
              <div className="min-w-0 text-left flex-1">
                <p className="text-[13px] font-semibold text-ink truncate leading-tight">{storeName}</p>
                <p className="text-[11px] text-ink-3 leading-tight">{ROLE_LABELS[role]}</p>
              </div>
              <ChevronsUpDown className="size-3.5 text-[var(--ink-3)] shrink-0" />
            </>
          ) : null}
        </button>
      </DropdownTrigger>

      <DropdownContent align="start" className="min-w-[228px]">
        <DropdownLabel>Your stores</DropdownLabel>
        {stores.map((s) => (
          <DropdownItem key={s.storeId} onSelect={() => onSwitch(s.storeId)}>
            <Avatar name={s.name} size={20} square colorSlot={s.colorSlot} />
            <span className="truncate flex-1">{s.name}</span>
            {s.storeId === storeId ? <Check className="size-3.5 !text-[var(--accent-ink)]" /> : null}
          </DropdownItem>
        ))}
        <DropdownSeparator />
        <DropdownItem onSelect={() => router.push("/onboarding?new=1")}>
          <Plus /> Create a store
        </DropdownItem>
      </DropdownContent>
    </Dropdown>
  );
}
