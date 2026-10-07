import type { Metadata } from "next";
import { requireStoreContext } from "@/lib/auth/context";
import { authMode, isClerkConfigured } from "@/lib/auth/provider";
import { ROLE_DESCRIPTIONS, ROLE_LABELS } from "@/lib/auth/permissions";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { Avatar } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { NotificationPreferences } from "@/components/settings/notification-preferences";

export const metadata: Metadata = { title: "Profile" };
export const dynamic = "force-dynamic";

export default async function ProfileSettingsPage() {
  const ctx = await requireStoreContext();
  const mode = authMode();

  let clerkProfile: React.ReactNode = null;
  if (isClerkConfigured()) {
    const { UserProfile } = await import("@clerk/nextjs");
    clerkProfile = (
      <UserProfile
        routing="hash"
        appearance={{ elements: { rootBox: "w-full", cardBox: "w-full shadow-none border-0" } }}
      />
    );
  }

  return (
    <>
      <Panel>
        <PanelHeader title="Your account" description="How you appear to the rest of the team." />
        <div className="p-4 sm:p-5">
          <div className="flex items-center gap-4">
            <Avatar name={ctx.user.displayName ?? "You"} src={ctx.user.avatarUrl} size={52} />
            <div className="min-w-0">
              <p className="text-[15px] font-semibold text-ink truncate">
                {ctx.user.displayName ?? "Team member"}
              </p>
              <p className="text-[12.5px] text-ink-3 truncate">{ctx.user.email ?? "No email on file"}</p>
              <div className="mt-2">
                <Badge tone={ctx.role === "owner" ? "accent" : "neutral"}>
                  {ROLE_LABELS[ctx.role]} of {ctx.store.name}
                </Badge>
              </div>
            </div>
          </div>

          <p className="text-[12.5px] text-ink-3 mt-4 pt-4 border-t border-[var(--line)] leading-relaxed">
            {ROLE_DESCRIPTIONS[ctx.role]}
          </p>
        </div>
      </Panel>

      {clerkProfile ? (
        <Panel>
          <PanelHeader
            title="Sign-in and security"
            description="Managed by Clerk: password, connected accounts, two-factor authentication and active sessions."
          />
          <div className="p-4 sm:p-5">{clerkProfile}</div>
        </Panel>
      ) : (
        <Panel>
          <PanelHeader title="Sign-in and security" />
          <div className="p-4 sm:p-5">
            <p className="text-[13px] text-ink-2 leading-relaxed">
              {mode === "dev"
                ? "This session is using the local development identity. Add your Clerk keys to .env.local to enable real accounts, passwords, two-factor authentication and session management."
                : "Authentication is handled by Clerk. Password and security settings appear here once Clerk is configured."}
            </p>
          </div>
        </Panel>
      )}

      <NotificationPreferences />
    </>
  );
}
