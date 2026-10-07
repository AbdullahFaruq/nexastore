"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronsLeft, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { NAVIGATION, isActivePath } from "@/lib/navigation";
import { useStore } from "@/components/providers/store-provider";
import { setSidebarCollapsed } from "@/actions/preferences";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/popover";
import { Wordmark } from "./logo";
import { StoreSwitcher } from "./store-switcher";

export function Sidebar({ defaultCollapsed }: { defaultCollapsed: boolean }) {
  const pathname = usePathname();
  const { permissions } = useStore();
  const [collapsed, setCollapsed] = React.useState(defaultCollapsed);

  const toggle = React.useCallback(() => {
    setCollapsed((c) => {
      const next = !c;
      // Persisted so the choice survives a reload; failure is not worth a toast.
      void setSidebarCollapsed(next);
      return next;
    });
  }, []);

  // Cmd/Ctrl + B, the near-universal sidebar shortcut.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "b" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        toggle();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle]);

  const sections = NAVIGATION.map((s) => ({
    ...s,
    items: s.items.filter((i) => permissions.includes(i.permission)),
  })).filter((s) => s.items.length > 0);

  return (
    <aside
      data-collapsed={collapsed || undefined}
      className={cn(
        "hidden lg:flex flex-col shrink-0 h-dvh sticky top-0",
        "bg-[var(--inset)] border-r border-[var(--line)]",
        "transition-[width] duration-200 ease-out",
        collapsed ? "w-[60px]" : "w-[236px]",
      )}
    >
      <div className={cn("flex items-center h-14 shrink-0", collapsed ? "justify-center px-2" : "px-4")}>
        <Link
          href="/dashboard"
          className="rounded-[6px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
          aria-label="NexaStore dashboard"
        >
          <Wordmark size={24} hideText={collapsed} />
        </Link>
      </div>

      <div className={cn("shrink-0", collapsed ? "px-2" : "px-3")}>
        <StoreSwitcher collapsed={collapsed} />
      </div>

      <nav
        className={cn("flex-1 overflow-y-auto overflow-x-hidden py-3", collapsed ? "px-2" : "px-3")}
        aria-label="Main"
      >
        {sections.map((section, si) => (
          <div key={section.id} className={si > 0 ? "mt-5" : ""}>
            {section.label && !collapsed ? (
              <h2 className="px-2 mb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--ink-3)]">
                {section.label}
              </h2>
            ) : null}
            {section.label && collapsed ? <div className="tick-rule mx-1 my-3" aria-hidden /> : null}

            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const active = isActivePath(pathname, item);
                const link = (
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "group relative flex items-center gap-2.5 rounded-[7px] h-8 text-[13px] font-medium",
                      "transition-colors duration-100",
                      collapsed ? "justify-center px-0 w-9 mx-auto" : "px-2",
                      active
                        ? "bg-[var(--surface)] text-ink shadow-card"
                        : "text-ink-2 hover:bg-[var(--surface-2)] hover:text-ink",
                    )}
                  >
                    {/* Active indicator: a brass rule on the leading edge. */}
                    <span
                      className={cn(
                        "absolute left-0 top-1/2 -translate-y-1/2 w-[2.5px] rounded-r-full bg-[var(--accent)]",
                        "transition-all duration-150",
                        active ? "h-4 opacity-100" : "h-0 opacity-0",
                        collapsed && "left-[-6px]",
                      )}
                      aria-hidden
                    />
                    <item.icon
                      className={cn(
                        "size-[16px] shrink-0 transition-colors",
                        active ? "text-[var(--accent-ink)]" : "text-[var(--ink-3)] group-hover:text-ink-2",
                      )}
                    />
                    {!collapsed ? <span className="truncate">{item.label}</span> : null}
                  </Link>
                );

                return (
                  <li key={item.href}>
                    {collapsed ? (
                      <Tooltip content={item.label} side="right">
                        {link}
                      </Tooltip>
                    ) : (
                      link
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className={cn("shrink-0 border-t border-[var(--line)] py-2.5", collapsed ? "px-2" : "px-3")}>
        {permissions.includes("sales:create") ? (
          collapsed ? (
            <Tooltip content="New sale" side="right">
              <Button asChild variant="primary" size="icon" className="mx-auto flex">
                <Link href="/pos" aria-label="New sale">
                  <Plus />
                </Link>
              </Button>
            </Tooltip>
          ) : (
            <Button asChild variant="primary" size="sm" className="w-full mb-2">
              <Link href="/pos">
                <Plus />
                New sale
              </Link>
            </Button>
          )
        ) : null}

        <button
          type="button"
          onClick={toggle}
          className={cn(
            "flex items-center gap-2 rounded-[6px] h-7 text-[12px] text-ink-3",
            "hover:text-ink-2 hover:bg-[var(--surface-2)] transition-colors w-full",
            collapsed ? "justify-center" : "px-2",
          )}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!collapsed}
        >
          <ChevronsLeft className={cn("size-4 transition-transform duration-200", collapsed && "rotate-180")} />
          {!collapsed ? (
            <>
              <span>Collapse</span>
              <kbd className="ml-auto font-mono text-[10.5px] opacity-60">&#8984;B</kbd>
            </>
          ) : null}
        </button>
      </div>
    </aside>
  );
}
