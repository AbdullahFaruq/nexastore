"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Palette, Store, User, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { can } from "@/lib/auth/permissions";
import type { Role } from "@/lib/db/models/enums";

const ITEMS = [
  { href: "/settings", label: "Store", icon: Store, permission: "settings:view" as const, exact: true },
  { href: "/settings/profile", label: "Profile", icon: User, permission: "settings:view" as const },
  { href: "/settings/appearance", label: "Appearance", icon: Palette, permission: "settings:view" as const },
  { href: "/team", label: "Team and roles", icon: Users, permission: "team:view" as const },
];

export function SettingsNav({ role }: { role: Role }) {
  const pathname = usePathname();
  const items = ITEMS.filter((i) => can(role, i.permission));

  return (
    <nav aria-label="Settings sections">
      {/* Horizontal on narrow screens, a rail on wide ones. */}
      <ul className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible pb-1 lg:pb-0">
        {items.map((item) => {
          const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
          return (
            <li key={item.href} className="shrink-0">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2.5 rounded-[7px] h-9 px-2.5 text-[13px] font-medium transition-colors whitespace-nowrap",
                  active
                    ? "bg-[var(--surface)] text-ink border border-[var(--line)] shadow-card"
                    : "text-ink-2 hover:bg-[var(--surface-2)] border border-transparent",
                )}
              >
                <item.icon
                  className={cn("size-4 shrink-0", active ? "text-[var(--accent-ink)]" : "text-[var(--ink-3)]")}
                />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
