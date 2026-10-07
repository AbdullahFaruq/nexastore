import type { Role } from "@/lib/db/models/shared";

export const PERMISSIONS = [
  "dashboard:view",
  "sales:view", "sales:create", "sales:refund", "sales:void",
  "products:view", "products:write", "products:delete",
  "inventory:view", "inventory:adjust",
  "customers:view", "customers:write",
  "expenses:view", "expenses:write",
  "analytics:view",
  "reports:view", "reports:export",
  "insights:view",
  "team:view", "team:manage",
  "settings:view", "settings:manage",
  "store:delete",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

/**
 * The authoritative permission matrix.
 *
 * Note what an employee does NOT have: analytics:view. The dashboard renders
 * from this map, so a till operator sees order counts and their own sales but
 * never the store's margins - and because every server action re-checks the
 * same map, hiding the panel is a courtesy, not the control.
 */
const MATRIX: Record<Role, Permission[]> = {
  owner: [...PERMISSIONS],

  manager: [
    "dashboard:view",
    "sales:view", "sales:create", "sales:refund", "sales:void",
    "products:view", "products:write", "products:delete",
    "inventory:view", "inventory:adjust",
    "customers:view", "customers:write",
    "expenses:view", "expenses:write",
    "analytics:view",
    "reports:view", "reports:export",
    "insights:view",
    "team:view",
    "settings:view",
  ],

  employee: [
    "dashboard:view",
    "sales:view", "sales:create",
    "products:view",
    "inventory:view",
    "customers:view", "customers:write",
  ],
};

const SETS: Record<Role, Set<Permission>> = {
  owner: new Set(MATRIX.owner),
  manager: new Set(MATRIX.manager),
  employee: new Set(MATRIX.employee),
};

export function can(role: Role, permission: Permission): boolean {
  return SETS[role]?.has(permission) ?? false;
}

export function permissionsFor(role: Role): Permission[] {
  return MATRIX[role] ?? [];
}

export const ROLE_LABELS: Record<Role, string> = {
  owner: "Owner",
  manager: "Manager",
  employee: "Employee",
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  owner: "Full access, including billing, team management and deleting the store.",
  manager: "Runs day-to-day trading: products, inventory, sales, expenses and reports.",
  employee: "Works the till: records sales and manages customers. No financial reporting.",
};
