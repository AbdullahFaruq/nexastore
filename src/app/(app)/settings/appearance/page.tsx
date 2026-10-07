import type { Metadata } from "next";
import { requireStoreContext } from "@/lib/auth/context";
import { AppearanceSettings } from "@/components/settings/appearance-settings";

export const metadata: Metadata = { title: "Appearance" };
export const dynamic = "force-dynamic";

export default async function AppearanceSettingsPage() {
  const ctx = await requireStoreContext();
  const prefs = ctx.profile.preferences;

  return (
    <AppearanceSettings
      defaultRange={prefs?.defaultRange ?? "last_30"}
      numberFormat={prefs?.numberFormat ?? "standard"}
      hiddenWidgets={prefs?.hiddenWidgets ?? []}
    />
  );
}
