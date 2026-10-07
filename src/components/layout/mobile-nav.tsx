"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { MOBILE_PRIMARY, NAVIGATION, isActivePath } from "@/lib/navigation";
import { useStore } from "@/components/providers/store-provider";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/misc";
import { Wordmark } from "./logo";
import { ROLE_LABELS } from "@/lib/auth/permissions";

/**
 * Mobile navigation is designed for thumbs, not shrunk from the desktop rail:
 * a fixed bottom bar holds the five things a shop floor actually taps, with
 * everything else behind a full-height sheet. The centre "Sell" action is
 * raised, because on a phone it is the reason the app is open.
 */
export function MobileTabBar() {
  const pathname = usePathname();
  const { permissions } = useStore();
  const items = MOBILE_PRIMARY.filter((i) => permissions.includes(i.permission));

  // The till is a focused mode: its cart sheet owns the bottom of the screen,
  // and a global tab bar sitting on top of the running total would be both
  // ugly and a mis-tap waiting to happen. The header menu is still the way out.
  if (pathname === "/pos") return null;

  return (
    <nav
      className={cn(
        "lg:hidden fixed bottom-0 inset-x-0 z-40",
        "bg-[var(--surface)]/95 backdrop-blur-md border-t border-[var(--line)]",
        "pb-[env(safe-area-inset-bottom)]",
      )}
      aria-label="Primary"
    >
      <ul className="grid" style={{ gridTemplateColumns: `repeat(${items.length}, 1fr)` }}>
        {items.map((item) => {
          const active = isActivePath(pathname, item);
          const isSell = item.href === "/pos";
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 h-[54px] relative",
                  "transition-colors",
                  active ? "text-[var(--accent-ink)]" : "text-ink-3",
                )}
              >
                {isSell ? (
                  <span className="grid place-items-center size-9 rounded-full bg-[var(--accent)] text-[var(--accent-fg)] -mt-3 shadow-pop">
                    <item.icon className="size-[18px]" />
                  </span>
                ) : (
                  <item.icon className="size-[19px]" strokeWidth={active ? 2.2 : 1.8} />
                )}
                <span className={cn("text-[10px] font-medium", isSell && "-mt-0.5")}>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function MobileMenuButton() {
  const [open, setOpen] = React.useState(false);
  const pathname = usePathname();
  const { permissions, storeName, colorSlot, userName, role } = useStore();

  // Navigating closes the sheet. Derived during render so the new page is never
  // painted with the old menu still over it.
  const [lastPath, setLastPath] = React.useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    if (open) setOpen(false);
  }

  const sections = NAVIGATION.map((s) => ({
    ...s,
    items: s.items.filter((i) => permissions.includes(i.permission)),
  })).filter((s) => s.items.length > 0);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
      >
        <Menu />
      </Button>

      <DialogContent
        size="sm"
        className="sm:!left-0 sm:!top-0 sm:!translate-x-0 sm:!translate-y-0 sm:!h-dvh sm:!max-h-none sm:!rounded-none sm:!w-[300px] !inset-x-0 !bottom-0 !top-0 !rounded-none max-h-none h-dvh"
      >
        <div className="flex items-center justify-between px-4 h-14 border-b border-[var(--line)] shrink-0">
          <Wordmark size={22} />
          <Button variant="ghost" size="iconSm" onClick={() => setOpen(false)} aria-label="Close menu">
            <X />
          </Button>
        </div>

        <div className="flex items-center gap-2.5 px-4 py-3 border-b border-[var(--line)] shrink-0">
          <Avatar name={storeName} size={32} square colorSlot={colorSlot} />
          <div className="min-w-0">
            <p className="text-[13.5px] font-semibold text-ink truncate">{storeName}</p>
            <p className="text-[11.5px] text-ink-3">
              {userName} - {ROLE_LABELS[role]}
            </p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto p-3" aria-label="All sections">
          {sections.map((section, si) => (
            <div key={section.id} className={si > 0 ? "mt-5" : ""}>
              {section.label ? (
                <h2 className="px-2 mb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--ink-3)]">
                  {section.label}
                </h2>
              ) : null}
              <ul className="space-y-0.5">
                {section.items.map((item) => {
                  const active = isActivePath(pathname, item);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "flex items-center gap-3 rounded-[8px] h-10 px-2.5 text-[14px] font-medium transition-colors",
                          active
                            ? "bg-[var(--accent-soft)] text-[var(--accent-ink)]"
                            : "text-ink-2 hover:bg-[var(--surface-2)]",
                        )}
                      >
                        <item.icon className="size-[18px] shrink-0" />
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
      </DialogContent>
    </Dialog>
  );
}
