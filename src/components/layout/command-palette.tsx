"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import {
  ArrowRight, Boxes, CornerDownLeft, Loader2, Moon, Package, Plus,
  Receipt, ScanLine, Search, Sun, User, Wallet,
} from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import { NAVIGATION } from "@/lib/navigation";
import { useStore } from "@/components/providers/store-provider";
import { Avatar } from "@/components/ui/misc";
import type { SearchHit } from "@/app/api/search/route";
import { EmptySearchMark } from "@/components/ui/empty-state";

const TYPE_META = {
  product: { label: "Products", icon: Package },
  order: { label: "Orders", icon: Receipt },
  customer: { label: "Customers", icon: User },
} as const;

export function CommandPalette() {
  const router = useRouter();
  const { permissions } = useStore();
  const { setTheme } = useTheme();

  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [hits, setHits] = React.useState<SearchHit[]>([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === "/" && !open) {
        const el = document.activeElement;
        const typing =
          el instanceof HTMLInputElement ||
          el instanceof HTMLTextAreaElement ||
          (el as HTMLElement | null)?.isContentEditable;
        if (!typing) {
          e.preventDefault();
          setOpen(true);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Debounced, abortable search - a fast typist should not race their own
  // results. State is only ever set from the timer or the response, never
  // synchronously in the effect body.
  const searching = query.trim().length >= 2;

  React.useEffect(() => {
    if (!searching) return;

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`, {
          signal: controller.signal,
        });
        if (res.ok) setHits((await res.json()).hits ?? []);
      } catch {
        // Aborted or offline: keep the previous results rather than blanking.
      } finally {
        setLoading(false);
      }
    }, 180);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, searching]);

  const go = React.useCallback(
    (href: string) => {
      setOpen(false);
      setQuery("");
      router.push(href);
    },
    [router],
  );

  const navItems = NAVIGATION.flatMap((s) => s.items).filter((i) => permissions.includes(i.permission));

  const quickActions = [
    { label: "New sale", icon: ScanLine, href: "/pos", permission: "sales:create" as const },
    { label: "Add product", icon: Plus, href: "/products/new", permission: "products:write" as const },
    { label: "Add expense", icon: Wallet, href: "/expenses?new=1", permission: "expenses:write" as const },
    { label: "Add customer", icon: User, href: "/customers?new=1", permission: "customers:write" as const },
    { label: "Adjust inventory", icon: Boxes, href: "/inventory?adjust=1", permission: "inventory:adjust" as const },
  ].filter((a) => permissions.includes(a.permission));

  const grouped = React.useMemo(() => {
    const map = new Map<SearchHit["type"], SearchHit[]>();
    // Stale hits from a previous query are ignored rather than cleared in an
    // effect, so the list never flashes empty between keystrokes.
    if (searching) for (const h of hits) map.set(h.type, [...(map.get(h.type) ?? []), h]);
    return [...map.entries()];
  }, [hits, searching]);

  return (
    <Command.Dialog
      open={open}
      onOpenChange={setOpen}
      label="Search and commands"
      shouldFilter={!searching}
      className={cn(
        "fixed z-[60] left-1/2 top-[12vh] -translate-x-1/2 w-[min(94vw,600px)]",
        "bg-[var(--surface)] border border-[var(--line-strong)] rounded-[12px] shadow-pop overflow-hidden",
        "data-[state=open]:animate-pop-in",
      )}
      overlayClassName="fixed inset-0 z-[59] bg-[rgb(20_18_16/0.42)] backdrop-blur-[2px] data-[state=open]:animate-fade"
    >
      <div className="flex items-center gap-2.5 px-3.5 border-b border-[var(--line)]">
        {loading ? (
          <Loader2 className="size-4 text-[var(--ink-3)] animate-spin shrink-0" />
        ) : (
          <Search className="size-4 text-[var(--ink-3)] shrink-0" />
        )}
        <Command.Input
          value={query}
          onValueChange={setQuery}
          placeholder="Search products, orders, customers, or jump to a page..."
          className="flex-1 h-12 bg-transparent text-[14px] text-ink placeholder:text-[var(--ink-3)] outline-none"
        />
        <kbd className="hidden sm:block text-[10.5px] font-mono text-[var(--ink-3)] border border-[var(--line)] rounded-[4px] px-1.5 py-0.5">
          ESC
        </kbd>
      </div>

      <Command.List className="max-h-[min(58vh,420px)] overflow-y-auto p-2 scroll-py-2">
        <Command.Empty>
          <div className="flex flex-col items-center py-9 px-4 text-center">
            <div className="size-9 text-[var(--ink-3)] mb-3">
              <EmptySearchMark />
            </div>
            <p className="text-[13px] font-medium text-ink">No matches for &ldquo;{query}&rdquo;</p>
            <p className="text-[12.5px] text-ink-3 mt-1">
              Try a product name, an order number, or a customer.
            </p>
          </div>
        </Command.Empty>

        {searching
          ? grouped.map(([type, rows]) => (
              <Group key={type} heading={TYPE_META[type].label}>
                {rows.map((hit) => (
                  <Item key={hit.id} onSelect={() => go(hit.href)}>
                    {hit.type === "product" && hit.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={hit.image} alt="" className="size-6 rounded-[5px] object-cover shrink-0" />
                    ) : hit.type === "customer" ? (
                      <Avatar name={hit.title} size={24} />
                    ) : (
                      <span className="size-6 grid place-items-center rounded-[5px] bg-[var(--surface-2)] shrink-0">
                        {React.createElement(TYPE_META[hit.type].icon, {
                          className: "size-3.5 text-[var(--ink-3)]",
                        })}
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] text-ink truncate">{hit.title}</span>
                      <span className="block text-[11.5px] text-ink-3 truncate">{hit.subtitle}</span>
                    </span>
                    {hit.meta ? (
                      <span className="text-[11.5px] text-ink-3 tnum shrink-0 hidden sm:block">{hit.meta}</span>
                    ) : null}
                  </Item>
                ))}
              </Group>
            ))
          : (
            <>
              {quickActions.length > 0 ? (
                <Group heading="Quick actions">
                  {quickActions.map((a) => (
                    <Item key={a.href} onSelect={() => go(a.href)}>
                      <span className="size-6 grid place-items-center rounded-[5px] bg-[var(--accent-soft)] shrink-0">
                        <a.icon className="size-3.5 text-[var(--accent-ink)]" />
                      </span>
                      <span className="flex-1 text-[13px] text-ink">{a.label}</span>
                      <CornerDownLeft className="size-3 text-[var(--ink-3)] opacity-0 group-data-[selected=true]:opacity-100" />
                    </Item>
                  ))}
                </Group>
              ) : null}

              <Group heading="Go to">
                {navItems.map((item) => (
                  <Item key={item.href} value={`goto ${item.label}`} onSelect={() => go(item.href)}>
                    <span className="size-6 grid place-items-center rounded-[5px] bg-[var(--surface-2)] shrink-0">
                      <item.icon className="size-3.5 text-[var(--ink-3)]" />
                    </span>
                    <span className="flex-1 text-[13px] text-ink">{item.label}</span>
                    <ArrowRight className="size-3 text-[var(--ink-3)] opacity-0 group-data-[selected=true]:opacity-100" />
                  </Item>
                ))}
              </Group>

              <Group heading="Appearance">
                <Item value="theme light" onSelect={() => { setTheme("light"); setOpen(false); }}>
                  <span className="size-6 grid place-items-center rounded-[5px] bg-[var(--surface-2)] shrink-0">
                    <Sun className="size-3.5 text-[var(--ink-3)]" />
                  </span>
                  <span className="flex-1 text-[13px] text-ink">Switch to light theme</span>
                </Item>
                <Item value="theme dark" onSelect={() => { setTheme("dark"); setOpen(false); }}>
                  <span className="size-6 grid place-items-center rounded-[5px] bg-[var(--surface-2)] shrink-0">
                    <Moon className="size-3.5 text-[var(--ink-3)]" />
                  </span>
                  <span className="flex-1 text-[13px] text-ink">Switch to dark theme</span>
                </Item>
              </Group>
            </>
          )}
      </Command.List>

      <div className="hidden sm:flex items-center gap-4 px-3.5 py-2 border-t border-[var(--line)] bg-[var(--inset)] text-[11px] text-ink-3">
        <span className="flex items-center gap-1">
          <Key>&#8593;</Key><Key>&#8595;</Key> navigate
        </span>
        <span className="flex items-center gap-1">
          <Key>&#8629;</Key> open
        </span>
        <span className="flex items-center gap-1 ml-auto">
          <Key>&#8984;</Key><Key>K</Key> toggle
        </span>
      </div>
    </Command.Dialog>
  );
}

function Key({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-grid place-items-center min-w-[17px] h-[17px] px-1 rounded-[4px] border border-[var(--line-strong)] bg-[var(--surface)] font-mono text-[10px]">
      {children}
    </kbd>
  );
}

function Group({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <Command.Group
      heading={heading}
      className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:text-[10.5px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.07em] [&_[cmdk-group-heading]]:text-[var(--ink-3)]"
    >
      {children}
    </Command.Group>
  );
}

function Item({
  children,
  onSelect,
  value,
}: {
  children: React.ReactNode;
  onSelect: () => void;
  value?: string;
}) {
  return (
    <Command.Item
      value={value}
      onSelect={onSelect}
      className={cn(
        "group flex items-center gap-2.5 rounded-[7px] px-2 py-1.5 cursor-pointer",
        "data-[selected=true]:bg-[var(--surface-2)]",
      )}
    >
      {children}
    </Command.Item>
  );
}
