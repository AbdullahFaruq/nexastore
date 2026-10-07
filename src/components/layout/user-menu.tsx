"use client";

import * as React from "react";
import Link from "next/link";
import { HelpCircle, LogOut, Settings, User } from "lucide-react";
import { useStore } from "@/components/providers/store-provider";
import { Dropdown, DropdownContent, DropdownItem, DropdownLabel, DropdownSeparator, DropdownTrigger } from "@/components/ui/dropdown";
import { Avatar } from "@/components/ui/misc";
import { ROLE_LABELS } from "@/lib/auth/permissions";
import { devSignOut } from "@/actions/dev-auth";

export function UserMenu({
  authMode,
  clerkSlot,
}: {
  authMode: "clerk" | "dev" | "unconfigured";
  /** Clerk's own <UserButton/>, rendered by the server layout when configured. */
  clerkSlot?: React.ReactNode;
}) {
  const { userName, userEmail, role } = useStore();

  if (authMode === "clerk" && clerkSlot) {
    return <div className="flex items-center">{clerkSlot}</div>;
  }

  return (
    <Dropdown>
      <DropdownTrigger asChild>
        <button
          type="button"
          className="rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
          aria-label="Account menu"
        >
          <Avatar name={userName} size={28} />
        </button>
      </DropdownTrigger>
      <DropdownContent align="end" className="min-w-[230px]">
        <div className="px-2 py-2 flex items-center gap-2.5">
          <Avatar name={userName} size={32} />
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-ink truncate leading-tight">{userName}</p>
            <p className="text-[11.5px] text-ink-3 truncate leading-tight">{userEmail ?? ROLE_LABELS[role]}</p>
          </div>
        </div>
        <DropdownSeparator />
        <DropdownLabel>Account</DropdownLabel>
        <DropdownItem asChild>
          <Link href="/settings/profile">
            <User /> Profile
          </Link>
        </DropdownItem>
        <DropdownItem asChild>
          <Link href="/settings">
            <Settings /> Settings
          </Link>
        </DropdownItem>
        <DropdownItem asChild>
          <Link href="/insights">
            <HelpCircle /> What should I look at?
          </Link>
        </DropdownItem>
        <DropdownSeparator />
        <form action={devSignOut}>
          <DropdownItem
            destructive
            onSelect={(e) => {
              e.preventDefault();
              (e.currentTarget as HTMLElement).closest("form")?.requestSubmit();
            }}
          >
            <LogOut /> Sign out
          </DropdownItem>
        </form>
      </DropdownContent>
    </Dropdown>
  );
}
