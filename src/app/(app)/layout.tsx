import { redirect } from "next/navigation";
import { getStoreContext } from "@/lib/auth/context";
import { permissionsFor } from "@/lib/auth/permissions";
import { authMode, getAuthUser, isClerkConfigured } from "@/lib/auth/provider";
import { connectToDatabase } from "@/lib/db/connect";
import { Notification } from "@/lib/db/models/notification";
import { StoreProvider } from "@/components/providers/store-provider";
import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";
import { MobileTabBar } from "@/components/layout/mobile-nav";
import { CommandPalette } from "@/components/layout/command-palette";
import { KeyboardShortcuts } from "@/components/layout/quick-actions";
import type { NotificationView } from "@/components/layout/notification-center";

export const dynamic = "force-dynamic";

async function loadNotifications(
  storeId: import("mongoose").Types.ObjectId,
  userId: string,
): Promise<NotificationView[]> {
  await connectToDatabase();
  const rows = await Notification.find({
    storeId,
    $or: [{ userId: null }, { userId }],
  })
    .sort({ createdAt: -1 })
    .limit(25)
    .lean();

  return rows.map((n) => ({
    id: String(n._id),
    type: n.type,
    priority: n.priority,
    title: n.title,
    body: n.body,
    href: n.href,
    read: n.readBy?.includes(userId) ?? false,
    createdAt: new Date(n.createdAt).toISOString(),
  }));
}

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await getAuthUser();
  if (!user) redirect("/sign-in");

  const ctx = await getStoreContext();
  if (!ctx) redirect("/onboarding");
  if (!ctx.store.onboardingCompleted) redirect("/onboarding");

  const notifications = await loadNotifications(ctx.storeId, ctx.user.userId);

  // Clerk's own user button, rendered on the server so the client header does
  // not need to know whether Clerk exists.
  let clerkSlot: React.ReactNode = null;
  if (isClerkConfigured()) {
    const { UserButton } = await import("@clerk/nextjs");
    clerkSlot = <UserButton appearance={{ elements: { avatarBox: "w-7 h-7" } }} />;
  }

  return (
    <StoreProvider
      value={{
        storeId: String(ctx.storeId),
        storeName: ctx.store.name,
        currency: ctx.currency,
        timezone: ctx.timezone,
        weekStartsOn: ctx.weekStartsOn,
        colorSlot: ctx.store.colorSlot ?? 0,
        role: ctx.role,
        permissions: permissionsFor(ctx.role),
        taxMode: ctx.store.settings?.taxMode ?? "exclusive",
        orderPrefix: ctx.store.settings?.orderPrefix ?? "NX",
        userId: ctx.user.userId,
        userName: ctx.user.displayName ?? "Team member",
        userEmail: ctx.user.email,
        stores: ctx.memberships,
      }}
    >
      <div className="flex min-h-dvh">
        <Sidebar defaultCollapsed={ctx.profile.preferences?.sidebarCollapsed ?? false} />

        <div className="flex-1 min-w-0 flex flex-col">
          <Header
            notifications={notifications}
            authMode={authMode()}
            clerkSlot={clerkSlot}
            now={new Date().toISOString()}
          />
          <main id="main" className="flex-1 min-w-0 pb-[70px] lg:pb-0">
            {children}
          </main>
        </div>
      </div>

      <MobileTabBar />
      <CommandPalette />
      <KeyboardShortcuts />
    </StoreProvider>
  );
}
