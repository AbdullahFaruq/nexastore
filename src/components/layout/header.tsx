"use client";

import * as React from "react";
import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDayLong } from "@/lib/format/dates";
import { useStore } from "@/components/providers/store-provider";
import { Button } from "@/components/ui/button";
import { Dropdown, DropdownContent, DropdownItem, DropdownLabel, DropdownTrigger } from "@/components/ui/dropdown";
import { ThemeSwitcher } from "@/components/providers/theme-provider";
import { NotificationCenter, type NotificationView } from "./notification-center";
import { MobileMenuButton } from "./mobile-nav";
import { UserMenu } from "./user-menu";
import { QUICK_ACTIONS } from "./quick-actions";

export function Header({
  notifications,
  authMode,
  clerkSlot,
  now,
}: {
  notifications: NotificationView[];
  authMode: "clerk" | "dev" | "unconfigured";
  clerkSlot?: React.ReactNode;
  now: string;
}) {
  const { storeName, timezone, permissions } = useStore();

  const openPalette = () => {
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true }),
    );
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }));
  };

  const actions = QUICK_ACTIONS.filter((a) => permissions.includes(a.permission));

  return (
    <header
      className={cn(
        "sticky top-0 z-30 h-14 shrink-0",
        "bg-[var(--page)]/85 backdrop-blur-md border-b border-[var(--line)]",
      )}
    >
      <div className="h-full px-3 sm:px-5 flex items-center gap-2">
        <MobileMenuButton />

        <div className="min-w-0 hidden sm:block">
          <h1 className="text-[14px] font-semibold text-ink tracking-[-0.015em] leading-tight truncate">
            {storeName}
          </h1>
          <p className="text-[11.5px] text-ink-3 leading-tight" suppressHydrationWarning>
            {formatDayLong(now, timezone)}
          </p>
        </div>

        {/* Search: a real control on desktop, an icon on mobile. */}
        <button
          type="button"
          onClick={openPalette}
          className={cn(
            "hidden md:flex items-center gap-2 ml-auto h-8 w-[240px] xl:w-[300px] px-2.5",
            "rounded-[7px] border border-[var(--line)] bg-[var(--surface)]",
            "text-[13px] text-[var(--ink-3)] text-left",
            "hover:border-[var(--line-strong)] hover:text-ink-2 transition-colors",
          )}
          aria-label="Search products, orders and customers"
        >
          <Search className="size-3.5 shrink-0" />
          <span className="flex-1 truncate">Search...</span>
          <kbd className="font-mono text-[10.5px] border border-[var(--line)] rounded-[4px] px-1 py-px">
            &#8984;K
          </kbd>
        </button>

        <div className="flex items-center gap-0.5 ml-auto md:ml-2">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={openPalette}
            aria-label="Search"
          >
            <Search />
          </Button>

          {actions.length > 0 ? (
            <Dropdown>
              <DropdownTrigger asChild>
                <Button variant="primary" size="sm" className="hidden sm:inline-flex mr-1">
                  <Plus />
                  <span className="hidden lg:inline">Create</span>
                </Button>
              </DropdownTrigger>
              <DropdownContent align="end">
                <DropdownLabel>Quick actions</DropdownLabel>
                {actions.map((a) => (
                  <DropdownItem key={a.href} asChild shortcut={a.shortcut}>
                    <Link href={a.href}>
                      <a.icon />
                      {a.label}
                    </Link>
                  </DropdownItem>
                ))}
              </DropdownContent>
            </Dropdown>
          ) : null}

          <NotificationCenter notifications={notifications} />
          <ThemeSwitcher />
          <div className="ml-1">
            <UserMenu authMode={authMode} clerkSlot={clerkSlot} />
          </div>
        </div>
      </div>
    </header>
  );
}
