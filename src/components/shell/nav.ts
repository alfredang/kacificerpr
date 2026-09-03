import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  Bot,
  Boxes,
  FileText,
  GitBranch,
  LayoutDashboard,
  ListChecks,
  Settings,
  ShoppingCart,
  Store,
} from "lucide-react";
import type { Action } from "@/server/auth/rbac";

export type NavItem = { href: string; label: string; icon: LucideIcon; action: Action; badge?: "approvals" };

/* One nav config; the sidebar filters it through rbac.can() for the user. */
export const NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, action: "dashboard.view" },
  { href: "/purchase-orders", label: "Purchase orders", icon: ShoppingCart, action: "po.view", badge: "approvals" },
  { href: "/invoices", label: "Invoices", icon: FileText, action: "invoice.view" },
  { href: "/vendors", label: "Vendors", icon: Store, action: "vendor.view" },
  { href: "/skus", label: "SKUs & stock", icon: Boxes, action: "sku.view" },
  { href: "/low-stock", label: "Low stock", icon: AlertTriangle, action: "lowstock.view" },
  { href: "/timeline", label: "Process timeline", icon: GitBranch, action: "timeline.view" },
  { href: "/asana", label: "Asana", icon: ListChecks, action: "asana.view" },
  { href: "/agents", label: "AI agents", icon: Bot, action: "agents.run" },
  { href: "/settings", label: "Settings", icon: Settings, action: "settings.view" },
];
