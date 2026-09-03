export const ROLES = ["admin", "manager", "procurement", "finance", "sales", "operations", "requester", "viewer"] as const;
export type Role = (typeof ROLES)[number];

export const PO_STATUSES = [
  "draft",
  "pending_approval",
  "approved",
  "rejected",
  "ordered",
  "received",
  "closed",
  "cancelled",
] as const;
export type PoStatus = (typeof PO_STATUSES)[number];

export const PO_STATUS_LABEL: Record<PoStatus, string> = {
  draft: "Draft",
  pending_approval: "Pending approval",
  approved: "Approved",
  rejected: "Rejected",
  ordered: "Ordered",
  received: "Received",
  closed: "Closed",
  cancelled: "Cancelled",
};

export const INVOICE_STATUSES = ["draft", "received", "matched", "approved", "paid", "disputed"] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];
export const INVOICE_STATUS_LABEL: Record<InvoiceStatus, string> = {
  draft: "Draft",
  received: "Received",
  matched: "Matched",
  approved: "Approved",
  paid: "Paid",
  disputed: "Disputed",
};

export const SKU_CATEGORIES = [
  "Terminals",
  "RF",
  "Networking",
  "Power",
  "Mounting",
  "Cabling",
  "Spares",
  "Tools",
] as const;

export const AGENT_KINDS = ["draft_po", "reorder", "invoice_match", "vendor_risk", "chat"] as const;
export type AgentKind = (typeof AGENT_KINDS)[number];

export const TASK_KINDS = [
  "low_stock_scan",
  "reorder_agent",
  "overdue_invoice_reminder",
  "asana_sync",
  "daily_digest",
  "webhook_retry",
] as const;
export type TaskKind = (typeof TASK_KINDS)[number];
export const TASK_KIND_LABEL: Record<TaskKind, string> = {
  low_stock_scan: "Low-stock scan",
  reorder_agent: "Reorder agent (DeepSeek)",
  overdue_invoice_reminder: "Overdue invoice reminder",
  asana_sync: "Asana sync",
  daily_digest: "Daily digest to managers",
  webhook_retry: "Webhook retry sweep",
};

export const WEBHOOK_EVENTS = [
  "po.created",
  "po.submitted",
  "po.approved",
  "po.rejected",
  "po.ordered",
  "po.received",
  "po.closed",
  "invoice.received",
  "invoice.matched",
  "invoice.paid",
  "stock.low",
  "test.ping",
] as const;
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

export const API_SCOPES = [
  "read:stock",
  "read:vendors",
  "read:po",
  "write:po",
  "approve:po",
  "read:invoices",
  "read:users",
  "impersonate",
] as const;
export type ApiScope = (typeof API_SCOPES)[number];

export const INTEGRATION_PROVIDERS = ["resend", "deepseek", "asana", "telegram"] as const;
export type IntegrationProvider = (typeof INTEGRATION_PROVIDERS)[number];

export const SESSION_COOKIE = "kacific_session";
export const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;
export const RESET_TOKEN_TTL_MINUTES = 30;
export const APPROVAL_TOKEN_TTL_HOURS = 72;
export const INVITE_TOKEN_TTL_HOURS = 72;
