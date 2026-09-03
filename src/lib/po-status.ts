import type { PoStatus, Role } from "./constants";

export type PoAction = "submit" | "approve" | "reject" | "order" | "receive" | "close" | "cancel" | "reopen";

/* The PO state machine, as one table. `transition()` is the only way a status
   changes; the roles column is enforced again by rbac.can() in the service. */
const TRANSITIONS: Record<PoStatus, Partial<Record<PoAction, PoStatus>>> = {
  draft: { submit: "pending_approval", cancel: "cancelled" },
  pending_approval: { approve: "approved", reject: "rejected", cancel: "cancelled" },
  approved: { order: "ordered", cancel: "cancelled" },
  rejected: { reopen: "draft", cancel: "cancelled" },
  ordered: { receive: "received", cancel: "cancelled" },
  received: { close: "closed" },
  closed: {},
  cancelled: {},
};

export const ACTION_ROLES: Record<PoAction, Role[]> = {
  submit: ["admin", "manager", "procurement", "sales", "requester"],
  approve: ["admin", "manager"],
  reject: ["admin", "manager"],
  order: ["admin", "procurement"],
  receive: ["admin", "procurement", "operations"],
  close: ["admin", "finance"],
  cancel: ["admin", "manager", "procurement", "sales", "requester"],
  reopen: ["admin", "procurement", "sales", "requester"],
};

export const ACTION_LABEL: Record<PoAction, string> = {
  submit: "Submit for approval",
  approve: "Approve",
  reject: "Reject",
  order: "Mark as ordered",
  receive: "Receive goods",
  close: "Close",
  cancel: "Cancel",
  reopen: "Reopen as draft",
};

export function transition(status: PoStatus, action: PoAction): PoStatus | null {
  return TRANSITIONS[status][action] ?? null;
}

export function allowedActions(status: PoStatus, role: Role): PoAction[] {
  return (Object.keys(TRANSITIONS[status]) as PoAction[]).filter((a) => ACTION_ROLES[a].includes(role));
}

export const EDITABLE_STATUSES: PoStatus[] = ["draft", "rejected"];
export const OPEN_STATUSES: PoStatus[] = ["pending_approval", "approved", "ordered"];

/* Visual stepper stages (rejected/cancelled are shown as a branch). */
export const PO_STAGES: { key: PoStatus; label: string }[] = [
  { key: "draft", label: "Draft" },
  { key: "pending_approval", label: "Pending approval" },
  { key: "approved", label: "Approved" },
  { key: "ordered", label: "Ordered" },
  { key: "received", label: "Received" },
  { key: "closed", label: "Closed" },
];

export function stageIndex(status: PoStatus): number {
  if (status === "rejected") return 1;
  if (status === "cancelled") return -1;
  return PO_STAGES.findIndex((s) => s.key === status);
}

export function lineTotal(qty: number, unitCost: number) {
  return Math.round(qty * unitCost * 100) / 100;
}

export function poTotals(lines: { qty: number; unitCost: number }[], taxRate = 0) {
  const subtotal = Math.round(lines.reduce((s, l) => s + lineTotal(l.qty, l.unitCost), 0) * 100) / 100;
  const tax = Math.round(subtotal * taxRate * 100) / 100;
  return { subtotal, tax, total: Math.round((subtotal + tax) * 100) / 100 };
}
