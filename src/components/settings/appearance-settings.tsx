"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { Check, Monitor, Moon, Sun } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { RANGE_PRESETS } from "@/lib/format/dates";
import { updatePreferences, setWidgetVisibility } from "@/actions/preferences";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { NativeSelect, FieldHint, Label } from "@/components/ui/input";
import { Switch } from "@/components/ui/misc";
import { useHydrated } from "@/hooks/use-hydrated";

/** Dashboard panels a user may hide. Ids match the dashboard's own sections. */
const WIDGETS = [
  { id: "chart", label: "Revenue chart", hint: "The large trend chart below the hero figures." },
  { id: "products", label: "Top selling products", hint: "Your best performers for the period." },
  { id: "stock", label: "Needs restocking", hint: "What is about to run out." },
  { id: "recent", label: "Recent sales", hint: "The latest transactions." },
  { id: "rhythm", label: "Weekly rhythm", hint: "Which days carry the week." },
  { id: "insights", label: "What to look at", hint: "Computed insights." },
];

const THEMES = [
  { value: "light", label: "Light", icon: Sun, hint: "Warm paper, for daylight." },
  { value: "dark", label: "Dark", icon: Moon, hint: "Amber on near-black." },
  { value: "system", label: "System", icon: Monitor, hint: "Follow the device." },
];

export function AppearanceSettings({
  defaultRange, numberFormat, hiddenWidgets,
}: {
  defaultRange: string;
  numberFormat: "standard" | "compact";
  hiddenWidgets: string[];
}) {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const hydrated = useHydrated();
  const [range, setRange] = React.useState(defaultRange);
  const [format, setFormat] = React.useState(numberFormat);
  const [hidden, setHidden] = React.useState<string[]>(hiddenWidgets);

  const savePref = async (patch: Record<string, unknown>) => {
    const res = await updatePreferences(patch);
    if (!res.ok) toast.error(res.error);
  };

  const toggleWidget = async (id: string, visible: boolean) => {
    const next = visible ? hidden.filter((w) => w !== id) : [...hidden, id];
    setHidden(next);
    const res = await setWidgetVisibility(next);
    if (res.ok) router.refresh();
    else toast.error(res.error);
  };

  return (
    <>
      <Panel>
        <PanelHeader
          title="Theme"
          description="Dark mode is designed, not inverted - it uses its own palette, validated for contrast."
        />
        <div className="p-4 sm:p-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5" role="radiogroup" aria-label="Theme">
            {THEMES.map((t) => {
              const active = hydrated && theme === t.value;
              return (
                <button
                  key={t.value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => {
                    setTheme(t.value);
                    void savePref({ theme: t.value });
                  }}
                  className={cn(
                    "text-left rounded-[9px] border p-3.5 transition-all",
                    active
                      ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                      : "border-[var(--line)] bg-[var(--surface)] hover:border-[var(--line-strong)]",
                  )}
                >
                  <span className="flex items-center justify-between gap-2">
                    <t.icon
                      className={cn("size-4", active ? "text-[var(--accent-ink)]" : "text-[var(--ink-3)]")}
                    />
                    {active ? <Check className="size-3.5 text-[var(--accent-ink)]" /> : null}
                  </span>
                  <span
                    className={cn(
                      "block text-[13px] font-medium mt-2",
                      active ? "text-[var(--accent-ink)]" : "text-ink",
                    )}
                  >
                    {t.label}
                  </span>
                  <span className="block text-[11.5px] text-ink-3 mt-0.5">{t.hint}</span>
                </button>
              );
            })}
          </div>
        </div>
      </Panel>

      <Panel>
        <PanelHeader title="Defaults" description="How the dashboard opens for you." />
        <div className="p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="pref-range">Default date range</Label>
            <NativeSelect
              id="pref-range"
              value={range}
              onChange={(e) => {
                setRange(e.target.value);
                void savePref({ defaultRange: e.target.value });
              }}
            >
              {RANGE_PRESETS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </NativeSelect>
            <FieldHint>Used when you open the dashboard without a range in the address.</FieldHint>
          </div>

          <div>
            <Label htmlFor="pref-numbers">Large numbers</Label>
            <NativeSelect
              id="pref-numbers"
              value={format}
              onChange={(e) => {
                const v = e.target.value as "standard" | "compact";
                setFormat(v);
                void savePref({ numberFormat: v });
              }}
            >
              <option value="standard">Full (24,850)</option>
              <option value="compact">Compact (24.9K)</option>
            </NativeSelect>
            <FieldHint>Applies to chart axes and summary tiles.</FieldHint>
          </div>
        </div>
      </Panel>

      <Panel>
        <PanelHeader
          title="Dashboard panels"
          description="Hide anything you do not use. This only affects your own view."
        />
        <ul className="divide-y divide-[var(--line)]">
          {WIDGETS.map((w) => {
            const visible = !hidden.includes(w.id);
            return (
              <li key={w.id} className="flex items-start justify-between gap-4 px-4 sm:px-5 py-3">
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-ink">{w.label}</p>
                  <p className="text-[11.5px] text-ink-3 mt-0.5">{w.hint}</p>
                </div>
                <Switch
                  checked={visible}
                  onCheckedChange={(v) => toggleWidget(w.id, v)}
                  aria-label={`Show ${w.label}`}
                />
              </li>
            );
          })}
        </ul>
      </Panel>
    </>
  );
}
