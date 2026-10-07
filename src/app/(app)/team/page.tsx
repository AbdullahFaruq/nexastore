import type { Metadata } from "next";
import { requireStoreContext } from "@/lib/auth/context";
import { can, permissionsFor, ROLE_DESCRIPTIONS, ROLE_LABELS } from "@/lib/auth/permissions";
import { connectToDatabase } from "@/lib/db/connect";
import { Membership } from "@/lib/db/models/membership";
import { ROLES } from "@/lib/db/models/enums";
import { PageBody, PageHeader } from "@/components/shared/page-header";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { TeamList } from "@/components/settings/team-list";
import { InviteDialog } from "@/components/settings/invite-dialog";

export const metadata: Metadata = { title: "Team" };
export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const ctx = await requireStoreContext();
  if (!can(ctx.role, "team:view")) {
    return (
      <PageBody className="pt-10">
        <p className="text-[13.5px] text-ink-2">Only owners and managers can see the team.</p>
      </PageBody>
    );
  }

  await connectToDatabase();
  const members = await Membership.find({ storeId: ctx.storeId })
    .sort({ role: 1, createdAt: 1 })
    .lean();

  const canManage = can(ctx.role, "team:manage");

  return (
    <>
      <PageHeader
        title="Team"
        description="Who can get into this store, and what each of them is allowed to do."
        actions={canManage ? <InviteDialog /> : null}
      />

      <PageBody className="space-y-4">
        <Panel>
          <PanelHeader
            title="Members"
            description={`${members.length} ${members.length === 1 ? "person" : "people"} with access`}
          />
          <TeamList
            members={members.map((m) => ({
              id: String(m._id),
              userId: m.userId,
              displayName: m.displayName ?? m.email ?? "Team member",
              email: m.email,
              avatarUrl: m.avatarUrl,
              role: m.role,
              status: m.status,
              createdAt: new Date(m.createdAt).toISOString(),
            }))}
            currentUserId={ctx.user.userId}
            canManage={canManage}
          />
        </Panel>

        {/* The permission matrix, rendered from the same map the server enforces. */}
        <Panel>
          <PanelHeader
            title="What each role can do"
            description="These rules are enforced on the server for every action, not just hidden in the interface."
          />
          <div className="grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-[var(--line)]">
            {ROLES.map((role) => {
              const perms = permissionsFor(role);
              const groups = new Map<string, string[]>();
              for (const p of perms) {
                const [area, action] = p.split(":");
                groups.set(area, [...(groups.get(area) ?? []), action]);
              }

              return (
                <div key={role} className="p-4 sm:p-5">
                  <p className="text-[13.5px] font-semibold text-ink">{ROLE_LABELS[role]}</p>
                  <p className="text-[12px] text-ink-3 mt-1 leading-relaxed">{ROLE_DESCRIPTIONS[role]}</p>

                  <ul className="mt-3.5 space-y-1.5">
                    {[...groups.entries()].map(([area, actions]) => (
                      <li key={area} className="flex items-baseline justify-between gap-3">
                        <span className="text-[12px] text-ink-2 capitalize">{area}</span>
                        <span className="text-[11px] text-ink-3 text-right">
                          {actions.join(", ")}
                        </span>
                      </li>
                    ))}
                  </ul>

                  {role === "employee" ? (
                    <p className="text-[11.5px] text-ink-3 mt-3.5 pt-3 border-t border-[var(--line)] leading-relaxed">
                      Notably absent: revenue, margins and expenses. A till operator can record sales
                      without seeing what the business earns on them.
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>
        </Panel>
      </PageBody>
    </>
  );
}
