import type { Role } from "@/lib/constants";

/* The single permission matrix. Server Actions, route handlers, the external
   API and the sidebar all consult can() — nothing else decides authorization. */
export const ACTIONS = [
  "dashboard.view",
  "po.view",
  "po.create",
  "po.edit",
  "po.submit",
  "po.approve",
  "po.order",
  "po.receive",
  "po.close",
  "po.cancel",
  "invoice.view",
  "invoice.create",
  "invoice.edit",
  "invoice.match",
  "invoice.approve",
  "invoice.pay",
  "vendor.view",
  "vendor.manage",
  "sku.view",
  "sku.manage",
  "stock.adjust",
  "lowstock.view",
  "timeline.view",
  "asana.view",
  "asana.sync",
  "agents.run",
  "agents.apply",
  "settings.view",
  "settings.manage",
  "users.manage",
  "apikeys.manage",
  "audit.view",
] as const;
export type Action = (typeof ACTIONS)[number];

const ALL = [...ACTIONS] as Action[];
const READ: Action[] = [
  "dashboard.view",
  "po.view",
  "invoice.view",
  "vendor.view",
  "sku.view",
  "lowstock.view",
  "timeline.view",
];

const MATRIX: Record<Role, Action[]> = {
  admin: ALL,
  manager: [
    ...READ,
    "po.create",
    "po.edit",
    "po.submit",
    "po.approve",
    "po.cancel",
    "invoice.approve",
    "asana.view",
    "asana.sync",
    "agents.run",
    "agents.apply",
    "audit.view",
  ],
  procurement: [
    ...READ,
    "po.create",
    "po.edit",
    "po.submit",
    "po.order",
    "po.receive",
    "po.cancel",
    "invoice.create",
    "invoice.edit",
    "invoice.match",
    "vendor.manage",
    "sku.manage",
    "stock.adjust",
    "asana.view",
    "asana.sync",
    "agents.run",
    "agents.apply",
  ],
  finance: [
    ...READ,
    "invoice.create",
    "invoice.edit",
    "invoice.match",
    "invoice.approve",
    "invoice.pay",
    "po.close",
    "agents.run",
    "audit.view",
  ],
  sales: [...READ, "po.create", "po.edit", "po.submit", "po.cancel", "agents.run"],
  operations: [...READ, "po.receive", "stock.adjust", "sku.manage", "agents.run"],
  requester: [...READ, "po.create", "po.edit", "po.submit", "po.cancel", "agents.run"],
  viewer: READ,
};

export function can(role: Role, action: Action): boolean {
  return MATRIX[role]?.includes(action) ?? false;
}

export function permissionsFor(role: Role): Action[] {
  return MATRIX[role] ?? [];
}
