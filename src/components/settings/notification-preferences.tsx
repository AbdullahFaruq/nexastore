"use client";

import * as React from "react";
import { Bell } from "lucide-react";
import { Panel, PanelHeader } from "@/components/ui/panel";

const ALERTS = [
  { id: "low_stock", label: "Stock running low", hint: "When a product reaches its reorder point." },
  { id: "out_of_stock", label: "Out of stock", hint: "When something sells out completely." },
  { id: "large_sale", label: "Large sale", hint: "When an order is unusually big for your store." },
  { id: "report_ready", label: "Monthly report", hint: "When the month closes and the P&L is compiled." },
  { id: "member_joined", label: "Team changes", hint: "When someone accepts an invitation." },
];

/**
 * Which alerts the notification centre raises.
 *
 * Rules are currently store-wide and always on; this panel documents exactly
 * what triggers each one rather than offering switches that do nothing.
 */
export function NotificationPreferences() {
  return (
    <Panel>
      <PanelHeader
        title="Notifications"
        description="What the bell in the header will tell you about."
      />
      <ul className="divide-y divide-[var(--line)]">
        {ALERTS.map((a) => (
          <li key={a.id} className="flex items-start gap-3 px-4 sm:px-5 py-3">
            <span className="size-7 grid place-items-center rounded-[7px] bg-[var(--surface-2)] shrink-0 mt-px">
              <Bell className="size-3.5 text-[var(--ink-3)]" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-ink">{a.label}</p>
              <p className="text-[11.5px] text-ink-3 mt-0.5">{a.hint}</p>
            </div>
          </li>
        ))}
      </ul>
      <div className="px-4 sm:px-5 py-3 border-t border-[var(--line)] bg-[var(--inset)]">
        <p className="text-[12px] text-ink-3 leading-relaxed">
          Alerts are raised at most once per product per day, so a slow-selling item cannot fill your
          inbox. Per-person delivery preferences are not configurable yet.
        </p>
      </div>
    </Panel>
  );
}
