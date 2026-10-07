import type { LucideIcon } from "lucide-react";
import {
  BarChart3, Boxes, FileText, LayoutDashboard, Lightbulb, Package,
  Receipt, ScanLine, Settings, ShoppingCart, Store, Tags, Users, Wallet,
} from "lucide-react";

// "New sale" is deliberately absent from this list: the sidebar already ends
// with a prominent New sale button, and the mobile bar has its own. It stays
// reachable by keyboard (G then N) and from the command palette.
import type { Permission } from "@/lib/auth/permissions";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Hidden entirely when the role lacks this. */
  permission: Permission;
  /** Extra path prefixes that should light this item up. */
  match?: string[];
  shortcut?: string;
}

export interface NavSection {
  id: string;
  label?: string;
  items: NavItem[];
}

export const NAVIGATION: NavSection[] = [
  {
    id: "operate",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, permission: "dashboard:view", shortcut: "G D" },
      { href: "/sales", label: "Sales", icon: ShoppingCart, permission: "sales:view", match: ["/sales"], shortcut: "G S" },
      { href: "/products", label: "Products", icon: Package, permission: "products:view", match: ["/products"], shortcut: "G P" },
      { href: "/inventory", label: "Inventory", icon: Boxes, permission: "inventory:view", shortcut: "G I" },
      { href: "/customers", label: "Customers", icon: Users, permission: "customers:view", match: ["/customers"], shortcut: "G C" },
      { href: "/expenses", label: "Expenses", icon: Wallet, permission: "expenses:view", shortcut: "G E" },
    ],
  },
  {
    id: "understand",
    label: "Understand",
    items: [
      { href: "/analytics", label: "Analytics", icon: BarChart3, permission: "analytics:view", shortcut: "G A" },
      { href: "/categories", label: "Categories", icon: Tags, permission: "products:view" },
      { href: "/reports", label: "Reports", icon: FileText, permission: "reports:view", shortcut: "G R" },
      { href: "/insights", label: "Insights", icon: Lightbulb, permission: "insights:view" },
    ],
  },
  {
    id: "manage",
    label: "Manage",
    items: [
      { href: "/store", label: "Store", icon: Store, permission: "settings:view" },
      { href: "/team", label: "Team", icon: Users, permission: "team:view" },
      { href: "/settings", label: "Settings", icon: Settings, permission: "settings:view", match: ["/settings"] },
    ],
  },
];

/** The five destinations that get a dedicated mobile bar. */
export const MOBILE_PRIMARY: { href: string; label: string; icon: LucideIcon; permission: Permission }[] = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard, permission: "dashboard:view" },
  { href: "/sales", label: "Sales", icon: Receipt, permission: "sales:view" },
  { href: "/pos", label: "Sell", icon: ScanLine, permission: "sales:create" },
  { href: "/products", label: "Products", icon: Package, permission: "products:view" },
  { href: "/inventory", label: "Stock", icon: Boxes, permission: "inventory:view" },
];

export function isActivePath(pathname: string, item: { href: string; match?: string[] }) {
  if (pathname === item.href) return true;
  const prefixes = item.match ?? [];
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}
