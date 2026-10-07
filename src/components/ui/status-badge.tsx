import * as React from "react";
import {
  AlertTriangle, Ban, CheckCircle2, CircleDashed, Clock, PackageX, RotateCcw, TrendingDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { SaleStatus } from "@/lib/db/models/enums";
import type { StockStatus } from "@/lib/inventory/status";

/**
 * Status is never carried by colour alone - every badge pairs its hue with an
 * icon and a word, which is what makes them readable in greyscale, under
 * colour-vision deficiency, and in forced-colours mode.
 */
type Tone = "good" | "warning" | "serious" | "critical" | "neutral" | "muted";

const TONE_CLASS: Record<Tone, string> = {
  good: "text-[var(--pos)] bg-[var(--pos-soft)] border-transparent",
  warning: "text-[#8a5d00] dark:text-[var(--st-warn)] bg-[color-mix(in_oklab,var(--st-warn)_14%,transparent)] border-transparent",
  serious: "text-[#9c4a22] dark:text-[var(--st-serious)] bg-[color-mix(in_oklab,var(--st-serious)_16%,transparent)] border-transparent",
  critical: "text-[var(--neg)] bg-[var(--neg-soft)] border-transparent",
  neutral: "text-ink-2 bg-[var(--surface-2)] border-[var(--line)]",
  muted: "text-ink-3 bg-transparent border-[var(--line-strong)]",
};

function Chip({
  tone, icon: Icon, label, className, dot,
}: {
  tone: Tone;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  className?: string;
  dot?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11.5px] font-medium whitespace-nowrap",
        TONE_CLASS[tone],
        className,
      )}
    >
      {dot ? (
        <span className="size-1.5 rounded-full bg-current" aria-hidden />
      ) : (
        <Icon className="size-3" aria-hidden />
      )}
      {label}
    </span>
  );
}

const SALE_META: Record<SaleStatus, { tone: Tone; icon: typeof CheckCircle2; label: string }> = {
  completed: { tone: "good", icon: CheckCircle2, label: "Completed" },
  pending: { tone: "warning", icon: Clock, label: "Pending" },
  refunded: { tone: "serious", icon: RotateCcw, label: "Refunded" },
  cancelled: { tone: "muted", icon: Ban, label: "Cancelled" },
};

export function SaleStatusBadge({ status, className }: { status: SaleStatus; className?: string }) {
  const m = SALE_META[status] ?? SALE_META.completed;
  return <Chip tone={m.tone} icon={m.icon} label={m.label} className={className} />;
}

const STOCK_META: Record<StockStatus, { tone: Tone; icon: typeof CheckCircle2; label: string }> = {
  healthy: { tone: "good", icon: CheckCircle2, label: "Healthy" },
  low: { tone: "warning", icon: TrendingDown, label: "Running low" },
  critical: { tone: "critical", icon: AlertTriangle, label: "Critical" },
  out: { tone: "muted", icon: PackageX, label: "Out of stock" },
};

export function StockStatusBadge({ status, className }: { status: StockStatus; className?: string }) {
  const m = STOCK_META[status] ?? STOCK_META.healthy;
  return <Chip tone={m.tone} icon={m.icon} label={m.label} className={className} />;
}

const PRODUCT_META = {
  active: { tone: "good" as Tone, icon: CheckCircle2, label: "Active" },
  draft: { tone: "neutral" as Tone, icon: CircleDashed, label: "Draft" },
  archived: { tone: "muted" as Tone, icon: Ban, label: "Archived" },
};

export function ProductStatusBadge({ status }: { status: "active" | "draft" | "archived" }) {
  const m = PRODUCT_META[status] ?? PRODUCT_META.active;
  return <Chip tone={m.tone} icon={m.icon} label={m.label} />;
}

export { Chip as StatusChip };
