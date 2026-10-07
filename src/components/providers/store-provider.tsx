"use client";

import * as React from "react";
import type { Role } from "@/lib/db/models/enums";
import type { Permission } from "@/lib/auth/permissions";

export interface StoreClientContext {
  storeId: string;
  storeName: string;
  currency: string;
  timezone: string;
  weekStartsOn: number;
  colorSlot: number;
  role: Role;
  permissions: Permission[];
  taxMode: "exclusive" | "inclusive";
  orderPrefix: string;
  userId: string;
  userName: string;
  userEmail?: string;
  stores: { storeId: string; name: string; role: Role; colorSlot: number }[];
}

const Ctx = React.createContext<StoreClientContext | null>(null);

export function StoreProvider({
  value,
  children,
}: {
  value: StoreClientContext;
  children: React.ReactNode;
}) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): StoreClientContext {
  const ctx = React.useContext(Ctx);
  if (!ctx) {
    throw new Error("useStore must be used inside a StoreProvider (dashboard layout).");
  }
  return ctx;
}

/** Client-side permission check. Cosmetic only - the server re-checks everything. */
export function useCan(permission: Permission) {
  const { permissions } = useStore();
  return permissions.includes(permission);
}
