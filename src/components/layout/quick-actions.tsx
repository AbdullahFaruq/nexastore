"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Boxes, Package, ScanLine, UserPlus, Wallet } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Permission } from "@/lib/auth/permissions";
import { useStore } from "@/components/providers/store-provider";

export interface QuickAction {
  label: string;
  href: string;
  icon: LucideIcon;
  permission: Permission;
  /** Single-letter shortcut, pressed after "N". */
  key: string;
  shortcut: string;
}

export const QUICK_ACTIONS: QuickAction[] = [
  { label: "New sale", href: "/pos", icon: ScanLine, permission: "sales:create", key: "s", shortcut: "N S" },
  { label: "Add product", href: "/products/new", icon: Package, permission: "products:write", key: "p", shortcut: "N P" },
  { label: "Add expense", href: "/expenses?new=1", icon: Wallet, permission: "expenses:write", key: "e", shortcut: "N E" },
  { label: "Add customer", href: "/customers?new=1", icon: UserPlus, permission: "customers:write", key: "c", shortcut: "N C" },
  { label: "Adjust inventory", href: "/inventory?adjust=1", icon: Boxes, permission: "inventory:adjust", key: "i", shortcut: "N I" },
];

const GOTO: { key: string; href: string; permission: Permission }[] = [
  { key: "d", href: "/dashboard", permission: "dashboard:view" },
  { key: "s", href: "/sales", permission: "sales:view" },
  { key: "p", href: "/products", permission: "products:view" },
  { key: "i", href: "/inventory", permission: "inventory:view" },
  { key: "c", href: "/customers", permission: "customers:view" },
  { key: "e", href: "/expenses", permission: "expenses:view" },
  { key: "a", href: "/analytics", permission: "analytics:view" },
  { key: "r", href: "/reports", permission: "reports:view" },
  { key: "n", href: "/pos", permission: "sales:create" },
];

/**
 * Two-key sequences, the pattern Linear and GitHub use:
 *   G then D -> dashboard,  N then S -> new sale.
 * The leader expires after a second so a stray G does not swallow the next
 * keystroke, and it never fires while the user is typing in a field.
 */
export function KeyboardShortcuts() {
  const router = useRouter();
  const { permissions } = useStore();
  const leader = React.useRef<"g" | "n" | null>(null);
  const timer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  React.useEffect(() => {
    const clear = () => {
      leader.current = null;
      if (timer.current) clearTimeout(timer.current);
    };

    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement;
      const typing =
        el instanceof HTMLInputElement ||
        el instanceof HTMLTextAreaElement ||
        el instanceof HTMLSelectElement ||
        (el as HTMLElement | null)?.isContentEditable;
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;

      const key = e.key.toLowerCase();

      if (leader.current === "g") {
        const target = GOTO.find((g) => g.key === key && permissions.includes(g.permission));
        clear();
        if (target) {
          e.preventDefault();
          router.push(target.href);
        }
        return;
      }

      if (leader.current === "n") {
        const target = QUICK_ACTIONS.find((a) => a.key === key && permissions.includes(a.permission));
        clear();
        if (target) {
          e.preventDefault();
          router.push(target.href);
        }
        return;
      }

      if (key === "g" || key === "n") {
        leader.current = key;
        timer.current = setTimeout(clear, 1100);
      }
    };

    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [router, permissions]);

  return null;
}
