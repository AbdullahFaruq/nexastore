import { requireStoreContext } from "@/lib/auth/context";
import { PageHeader } from "@/components/shared/page-header";
import { SettingsNav } from "@/components/settings/settings-nav";

export const dynamic = "force-dynamic";

export default async function SettingsLayout({ children }: LayoutProps<"/settings">) {
  const ctx = await requireStoreContext();

  return (
    <>
      <PageHeader
        title="Settings"
        description={`Configure ${ctx.store.name} and how NexaStore behaves for you.`}
      />
      <div className="px-4 sm:px-6 pb-10">
        <div className="grid grid-cols-1 lg:grid-cols-[200px_minmax(0,1fr)] gap-5 items-start">
          <SettingsNav role={ctx.role} />
          <div className="min-w-0 space-y-4">{children}</div>
        </div>
      </div>
    </>
  );
}
