"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle, Bell, CheckCheck, FileText, PackageX, TrendingUp, UserPlus, Wallet, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { relativeTime } from "@/lib/format/dates";
import { markAllNotificationsRead, markNotificationRead } from "@/actions/notifications";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { NotificationPriority } from "@/lib/db/models/enums";

export interface NotificationView {
  id: string;
  type: string;
  priority: NotificationPriority;
  title: string;
  body: string;
  href?: string;
  read: boolean;
  createdAt: string;
}

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  low_stock: AlertTriangle,
  out_of_stock: PackageX,
  large_sale: TrendingUp,
  refund: Wallet,
  expense_spike: Wallet,
  report_ready: FileText,
  member_joined: UserPlus,
  goal_reached: TrendingUp,
};

/** Priority drives the accent, and is always paired with the icon and text. */
const PRIORITY_STYLE: Record<NotificationPriority, string> = {
  critical: "text-[var(--neg)] bg-[var(--neg-soft)]",
  high: "text-[#8a5d00] dark:text-[var(--st-warn)] bg-[color-mix(in_oklab,var(--st-warn)_14%,transparent)]",
  normal: "text-[var(--accent-ink)] bg-[var(--accent-soft)]",
  low: "text-ink-3 bg-[var(--surface-2)]",
};

export function NotificationCenter({ notifications }: { notifications: NotificationView[] }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [items, setItems] = React.useState(notifications);

  // Server refreshes hand down a new list; adopt it during render so a newly
  // arrived notice is not missing for a frame.
  const [lastServer, setLastServer] = React.useState(notifications);
  if (notifications !== lastServer) {
    setLastServer(notifications);
    setItems(notifications);
  }

  const unread = items.filter((n) => !n.read).length;

  const onRead = (id: string) => {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    void markNotificationRead(id);
  };

  const onReadAll = () => {
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    void markAllNotificationsRead().then(() => router.refresh());
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
        >
          <Bell />
          {unread > 0 ? (
            <span
              className="absolute top-1.5 right-1.5 min-w-[15px] h-[15px] px-1 grid place-items-center rounded-full bg-[var(--accent)] text-[var(--accent-fg)] text-[9.5px] font-bold tabular-nums"
              aria-hidden
            >
              {unread > 9 ? "9+" : unread}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-[min(94vw,380px)] p-0">
        <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-[var(--line)]">
          <h2 className="text-[13px] font-semibold text-ink">
            Notifications
            {unread > 0 ? <span className="text-ink-3 font-normal ml-1.5">{unread} new</span> : null}
          </h2>
          {unread > 0 ? (
            <Button variant="ghost" size="xs" onClick={onReadAll}>
              <CheckCheck />
              Mark all read
            </Button>
          ) : null}
        </div>

        <div className="max-h-[380px] overflow-y-auto">
          {items.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <Bell className="size-7 mx-auto text-[var(--ink-3)] mb-3" strokeWidth={1.25} />
              <p className="text-[13px] font-medium text-ink">You are all caught up</p>
              <p className="text-[12.5px] text-ink-3 mt-1 max-w-[30ch] mx-auto leading-relaxed">
                Stock warnings, large sales and monthly reports will show up here.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-[var(--line)]">
              {items.map((n) => {
                const Icon = ICONS[n.type] ?? Bell;
                const content = (
                  <>
                    <span
                      className={cn(
                        "size-7 grid place-items-center rounded-[7px] shrink-0 mt-px",
                        PRIORITY_STYLE[n.priority],
                      )}
                      aria-hidden
                    >
                      <Icon className="size-3.5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className={cn("text-[13px] truncate", n.read ? "text-ink-2" : "text-ink font-medium")}>
                          {n.title}
                        </span>
                        {!n.read ? (
                          <span className="size-1.5 rounded-full bg-[var(--accent)] shrink-0" aria-label="Unread" />
                        ) : null}
                      </span>
                      <span className="block text-[12px] text-ink-3 mt-0.5 leading-snug line-clamp-2">{n.body}</span>
                      <span className="block text-[11px] text-ink-3 mt-1">{relativeTime(n.createdAt)}</span>
                    </span>
                  </>
                );

                return (
                  <li key={n.id} className="relative group">
                    {n.href ? (
                      <Link
                        href={n.href}
                        onClick={() => {
                          onRead(n.id);
                          setOpen(false);
                        }}
                        className="flex gap-2.5 px-3.5 py-3 hover:bg-[var(--surface-2)] transition-colors"
                      >
                        {content}
                      </Link>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onRead(n.id)}
                        className="flex gap-2.5 px-3.5 py-3 w-full text-left hover:bg-[var(--surface-2)] transition-colors"
                      >
                        {content}
                      </button>
                    )}
                    {!n.read ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRead(n.id);
                        }}
                        className="absolute right-2 top-2 size-6 grid place-items-center rounded-[5px] text-ink-3 opacity-0 group-hover:opacity-100 hover:bg-[var(--surface-3)] transition-opacity"
                        aria-label="Mark as read"
                      >
                        <X className="size-3" />
                      </button>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
