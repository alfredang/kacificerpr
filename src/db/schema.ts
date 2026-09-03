import { relations, sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/* ------------------------------------------------------------------ enums */
export const userRoleEnum = pgEnum("user_role", [
  "admin",
  "manager",
  "procurement",
  "finance",
  "sales",
  "operations",
  "requester",
  "viewer",
]);
export const poStatusEnum = pgEnum("po_status", [
  "draft",
  "pending_approval",
  "approved",
  "rejected",
  "ordered",
  "received",
  "closed",
  "cancelled",
]);
export const poSourceEnum = pgEnum("po_source", ["manual", "low_stock", "agent", "api"]);
export const invoiceStatusEnum = pgEnum("invoice_status", [
  "draft",
  "received",
  "matched",
  "approved",
  "paid",
  "disputed",
]);
export const actorTypeEnum = pgEnum("actor_type", ["user", "api_key", "agent", "system", "token"]);
export const stockReasonEnum = pgEnum("stock_reason", ["seed", "receipt", "adjustment", "issue", "transfer"]);
export const agentKindEnum = pgEnum("agent_kind", ["draft_po", "reorder", "invoice_match", "vendor_risk", "chat"]);
export const chatChannelEnum = pgEnum("chat_channel", ["widget", "telegram"]);
export const agentRunStatusEnum = pgEnum("agent_run_status", ["running", "proposed", "applied", "discarded", "failed"]);
export const integrationProviderEnum = pgEnum("integration_provider", ["resend", "deepseek", "asana", "telegram"]);
export const tokenPurposeEnum = pgEnum("token_purpose", ["password_reset", "po_approve", "po_reject", "invite"]);
export const taskKindEnum = pgEnum("task_kind", [
  "low_stock_scan",
  "reorder_agent",
  "overdue_invoice_reminder",
  "asana_sync",
  "daily_digest",
  "webhook_retry",
]);
export const runStatusEnum = pgEnum("run_status", ["running", "ok", "failed", "skipped"]);
export const deliveryStatusEnum = pgEnum("delivery_status", ["pending", "delivered", "failed", "exhausted"]);

const money = (name: string) => numeric(name, { precision: 14, scale: 2, mode: "number" });
const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });
const timestamps = {
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
};

/* ------------------------------------------------------------------ people */
export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    name: text("name").notNull(),
    role: userRoleEnum("role").notNull().default("viewer"),
    passwordHash: text("password_hash"),
    isActive: boolean("is_active").notNull().default(true),
    isServiceAccount: boolean("is_service_account").notNull().default(false),
    failedLogins: integer("failed_logins").notNull().default(0),
    lockedUntil: ts("locked_until"),
    sessionVersion: integer("session_version").notNull().default(1),
    lastLoginAt: ts("last_login_at"),
    ...timestamps,
  },
  (t) => [uniqueIndex("users_email_idx").on(t.email)],
);

export const oneTimeTokens = pgTable(
  "one_time_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tokenHash: text("token_hash").notNull(),
    purpose: tokenPurposeEnum("purpose").notNull(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    poId: uuid("po_id"),
    expiresAt: ts("expires_at").notNull(),
    usedAt: ts("used_at"),
    usedIp: text("used_ip"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("ott_hash_idx").on(t.tokenHash), index("ott_po_idx").on(t.poId)],
);

export const rateLimits = pgTable("rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull().default(0),
  resetAt: ts("reset_at").notNull(),
});

/* ---------------------------------------------------------------- settings */
export const companySettings = pgTable("company_settings", {
  id: integer("id").primaryKey().default(1),
  name: text("name").notNull().default("Kacific Broadband Satellites"),
  legalName: text("legal_name").notNull().default("Kacific Broadband Satellites Group"),
  address: text("address").notNull().default(""),
  country: text("country").notNull().default("Singapore"),
  timezone: text("timezone").notNull().default("Asia/Singapore"),
  currency: text("currency").notNull().default("USD"),
  poPrefix: text("po_prefix").notNull().default("PO"),
  invoicePrefix: text("invoice_prefix").notNull().default("INV"),
  nextPoSeq: integer("next_po_seq").notNull().default(1),
  approvalThreshold: money("approval_threshold").notNull().default(0),
  priceTolerancePct: numeric("price_tolerance_pct", { precision: 5, scale: 2, mode: "number" }).notNull().default(2),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const integrationSettings = pgTable("integration_settings", {
  provider: integrationProviderEnum("provider").primaryKey(),
  enabled: boolean("enabled").notNull().default(false),
  config: jsonb("config").$type<Record<string, string>>().notNull().default({}),
  secretCiphertext: text("secret_ciphertext"),
  secretLast4: text("secret_last4"),
  lastTestedAt: ts("last_tested_at"),
  lastTestOk: boolean("last_test_ok"),
  lastTestMessage: text("last_test_message"),
  updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const apiKeys = pgTable(
  "api_keys",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    prefix: text("prefix").notNull(),
    keyHash: text("key_hash").notNull(),
    scopes: text("scopes").array().notNull().default(sql`'{}'::text[]`),
    serviceUserId: uuid("service_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    lastUsedAt: ts("last_used_at"),
    expiresAt: ts("expires_at"),
    revokedAt: ts("revoked_at"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("api_keys_prefix_idx").on(t.prefix)],
);

/* ----------------------------------------------------------------- masters */
export const warehouses = pgTable("warehouses", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  country: text("country").notNull(),
  city: text("city").notNull().default(""),
  isActive: boolean("is_active").notNull().default(true),
  ...timestamps,
});

export const vendors = pgTable("vendors", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  contactName: text("contact_name").notNull().default(""),
  email: text("email").notNull().default(""),
  phone: text("phone").notNull().default(""),
  country: text("country").notNull().default(""),
  leadTimeDays: integer("lead_time_days").notNull().default(14),
  paymentTermsDays: integer("payment_terms_days").notNull().default(30),
  currency: text("currency").notNull().default("USD"),
  rating: integer("rating").notNull().default(3),
  notes: text("notes").notNull().default(""),
  isActive: boolean("is_active").notNull().default(true),
  ...timestamps,
});

export const skus = pgTable("skus", {
  id: uuid("id").primaryKey().defaultRandom(),
  sku: text("sku").notNull().unique(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  unit: text("unit").notNull().default("ea"),
  unitCost: money("unit_cost").notNull().default(0),
  currency: text("currency").notNull().default("USD"),
  reorderLevel: integer("reorder_level").notNull().default(0),
  reorderQty: integer("reorder_qty").notNull().default(0),
  preferredVendorId: uuid("preferred_vendor_id").references(() => vendors.id, { onDelete: "set null" }),
  leadTimeDays: integer("lead_time_days").notNull().default(14),
  isActive: boolean("is_active").notNull().default(true),
  ...timestamps,
});

export const stockLevels = pgTable(
  "stock_levels",
  {
    skuId: uuid("sku_id")
      .notNull()
      .references(() => skus.id, { onDelete: "cascade" }),
    warehouseId: uuid("warehouse_id")
      .notNull()
      .references(() => warehouses.id, { onDelete: "cascade" }),
    qty: integer("qty").notNull().default(0),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.skuId, t.warehouseId] }), index("stock_wh_idx").on(t.warehouseId)],
);

export const stockMovements = pgTable(
  "stock_movements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    skuId: uuid("sku_id")
      .notNull()
      .references(() => skus.id, { onDelete: "cascade" }),
    warehouseId: uuid("warehouse_id")
      .notNull()
      .references(() => warehouses.id, { onDelete: "cascade" }),
    delta: integer("delta").notNull(),
    reason: stockReasonEnum("reason").notNull(),
    poId: uuid("po_id"),
    actorType: actorTypeEnum("actor_type").notNull().default("system"),
    actorId: uuid("actor_id"),
    note: text("note").notNull().default(""),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("stock_mv_sku_idx").on(t.skuId, t.createdAt)],
);

/* --------------------------------------------------------- purchase orders */
export const purchaseOrders = pgTable(
  "purchase_orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    poNumber: text("po_number").notNull().unique(),
    status: poStatusEnum("status").notNull().default("draft"),
    source: poSourceEnum("source").notNull().default("manual"),
    vendorId: uuid("vendor_id")
      .notNull()
      .references(() => vendors.id),
    warehouseId: uuid("warehouse_id")
      .notNull()
      .references(() => warehouses.id),
    requesterId: uuid("requester_id").references(() => users.id, { onDelete: "set null" }),
    approverId: uuid("approver_id").references(() => users.id, { onDelete: "set null" }),
    currency: text("currency").notNull().default("USD"),
    subtotal: money("subtotal").notNull().default(0),
    tax: money("tax").notNull().default(0),
    total: money("total").notNull().default(0),
    notes: text("notes").notNull().default(""),
    neededBy: date("needed_by", { mode: "string" }),
    submittedAt: ts("submitted_at"),
    decidedAt: ts("decided_at"),
    decisionNote: text("decision_note").notNull().default(""),
    orderedAt: ts("ordered_at"),
    receivedAt: ts("received_at"),
    closedAt: ts("closed_at"),
    asanaTaskGid: text("asana_task_gid"),
    agentRunId: uuid("agent_run_id"),
    ...timestamps,
  },
  (t) => [
    index("po_status_idx").on(t.status),
    index("po_vendor_idx").on(t.vendorId),
    index("po_requester_idx").on(t.requesterId),
    index("po_created_idx").on(t.createdAt),
  ],
);

export const purchaseOrderLines = pgTable(
  "purchase_order_lines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    poId: uuid("po_id")
      .notNull()
      .references(() => purchaseOrders.id, { onDelete: "cascade" }),
    lineNo: integer("line_no").notNull().default(1),
    skuId: uuid("sku_id").references(() => skus.id, { onDelete: "set null" }),
    description: text("description").notNull(),
    qty: integer("qty").notNull(),
    unitCost: money("unit_cost").notNull(),
    lineTotal: money("line_total").notNull(),
    qtyReceived: integer("qty_received").notNull().default(0),
  },
  (t) => [index("po_lines_po_idx").on(t.poId)],
);

export const poEvents = pgTable(
  "po_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    poId: uuid("po_id")
      .notNull()
      .references(() => purchaseOrders.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    actorType: actorTypeEnum("actor_type").notNull().default("system"),
    actorId: uuid("actor_id"),
    actorLabel: text("actor_label").notNull().default("System"),
    message: text("message").notNull().default(""),
    meta: jsonb("meta").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("po_events_po_idx").on(t.poId, t.createdAt)],
);

/* ---------------------------------------------------------------- invoices */
export const invoices = pgTable(
  "invoices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    invoiceNumber: text("invoice_number").notNull(),
    vendorId: uuid("vendor_id")
      .notNull()
      .references(() => vendors.id),
    poId: uuid("po_id").references(() => purchaseOrders.id, { onDelete: "set null" }),
    status: invoiceStatusEnum("status").notNull().default("draft"),
    currency: text("currency").notNull().default("USD"),
    subtotal: money("subtotal").notNull().default(0),
    tax: money("tax").notNull().default(0),
    total: money("total").notNull().default(0),
    issuedAt: date("issued_at", { mode: "string" }),
    dueAt: date("due_at", { mode: "string" }),
    receivedAt: ts("received_at"),
    matchedAt: ts("matched_at"),
    paidAt: ts("paid_at"),
    match: jsonb("match")
      .$type<{
        poMatch: boolean;
        receiptMatch: boolean;
        priceMatch: boolean;
        qtyMatch: boolean;
        variance: number;
        notes: string[];
        checkedAt: string;
      } | null>()
      .default(null),
    notes: text("notes").notNull().default(""),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("invoices_vendor_number_idx").on(t.vendorId, t.invoiceNumber),
    index("invoices_po_idx").on(t.poId),
    index("invoices_status_idx").on(t.status),
  ],
);

export const invoiceLines = pgTable(
  "invoice_lines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),
    skuId: uuid("sku_id").references(() => skus.id, { onDelete: "set null" }),
    description: text("description").notNull(),
    qty: integer("qty").notNull(),
    unitCost: money("unit_cost").notNull(),
    lineTotal: money("line_total").notNull(),
  },
  (t) => [index("invoice_lines_inv_idx").on(t.invoiceId)],
);

/* ------------------------------------------------------------ audit / agents */
export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorType: actorTypeEnum("actor_type").notNull().default("system"),
    actorId: uuid("actor_id"),
    actorLabel: text("actor_label").notNull().default("System"),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id"),
    ip: text("ip"),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("audit_entity_idx").on(t.entityType, t.entityId), index("audit_created_idx").on(t.createdAt)],
);

export const agentRuns = pgTable(
  "agent_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    kind: agentKindEnum("kind").notNull(),
    status: agentRunStatusEnum("status").notNull().default("running"),
    requestedBy: uuid("requested_by").references(() => users.id, { onDelete: "set null" }),
    input: jsonb("input").$type<Record<string, unknown>>().notNull().default({}),
    proposal: jsonb("proposal").$type<Record<string, unknown> | null>().default(null),
    summary: text("summary").notNull().default(""),
    trace: jsonb("trace").$type<Array<Record<string, unknown>>>().notNull().default([]),
    model: text("model").notNull().default(""),
    promptTokens: integer("prompt_tokens").notNull().default(0),
    completionTokens: integer("completion_tokens").notNull().default(0),
    durationMs: integer("duration_ms").notNull().default(0),
    error: text("error"),
    reviewedBy: uuid("reviewed_by").references(() => users.id, { onDelete: "set null" }),
    reviewedAt: ts("reviewed_at"),
    resultEntityType: text("result_entity_type"),
    resultEntityId: text("result_entity_id"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("agent_runs_created_idx").on(t.createdAt)],
);

export const emailOutbox = pgTable(
  "email_outbox",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    to: text("to").notNull(),
    subject: text("subject").notNull(),
    html: text("html").notNull(),
    links: text("links").array().notNull().default(sql`'{}'::text[]`),
    sentVia: text("sent_via").notNull(),
    providerId: text("provider_id"),
    error: text("error"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("outbox_created_idx").on(t.createdAt)],
);

export const chatMessages = pgTable(
  "chat_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    channel: chatChannelEnum("channel").notNull(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    externalChatId: text("external_chat_id"),
    role: text("role").notNull(), // user | assistant
    content: text("content").notNull(),
    runId: uuid("run_id"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("chat_user_idx").on(t.userId, t.createdAt), index("chat_ext_idx").on(t.externalChatId, t.createdAt)],
);

export const asanaTasks = pgTable(
  "asana_tasks",
  {
    gid: text("gid").primaryKey(),
    name: text("name").notNull(),
    notes: text("notes").notNull().default(""),
    completed: boolean("completed").notNull().default(false),
    completedAt: ts("completed_at"),
    dueOn: date("due_on", { mode: "string" }),
    assignee: text("assignee").notNull().default(""),
    section: text("section").notNull().default(""),
    permalinkUrl: text("permalink_url").notNull().default(""),
    projectGid: text("project_gid").notNull().default(""),
    poId: uuid("po_id").references(() => purchaseOrders.id, { onDelete: "set null" }),
    modifiedAt: ts("modified_at"),
    syncedAt: ts("synced_at").notNull().defaultNow(),
  },
  (t) => [index("asana_tasks_po_idx").on(t.poId), index("asana_tasks_synced_idx").on(t.syncedAt)],
);

/* --------------------------------------------------------- crons / webhooks */
export const scheduledTasks = pgTable("scheduled_tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  kind: taskKindEnum("kind").notNull(),
  cronExpr: text("cron_expr").notNull(),
  timezone: text("timezone").notNull().default("Asia/Singapore"),
  enabled: boolean("enabled").notNull().default(true),
  config: jsonb("config").$type<Record<string, unknown>>().notNull().default({}),
  lastRunAt: ts("last_run_at"),
  lastStatus: runStatusEnum("last_status"),
  nextRunAt: ts("next_run_at"),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  ...timestamps,
});

export const scheduledTaskRuns = pgTable(
  "scheduled_task_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    taskId: uuid("task_id")
      .notNull()
      .references(() => scheduledTasks.id, { onDelete: "cascade" }),
    startedAt: ts("started_at").notNull().defaultNow(),
    finishedAt: ts("finished_at"),
    status: runStatusEnum("status").notNull().default("running"),
    log: text("log").notNull().default(""),
    trigger: text("trigger").notNull().default("cron"),
  },
  (t) => [index("task_runs_task_idx").on(t.taskId, t.startedAt)],
);

export const webhookEndpoints = pgTable("webhook_endpoints", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  url: text("url").notNull(),
  secretCiphertext: text("secret_ciphertext").notNull(),
  events: text("events").array().notNull().default(sql`'{}'::text[]`),
  enabled: boolean("enabled").notNull().default(true),
  inboundKey: text("inbound_key").notNull().unique(),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  ...timestamps,
});

export const webhookDeliveries = pgTable(
  "webhook_deliveries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    endpointId: uuid("endpoint_id")
      .notNull()
      .references(() => webhookEndpoints.id, { onDelete: "cascade" }),
    event: text("event").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
    attempt: integer("attempt").notNull().default(0),
    status: deliveryStatusEnum("status").notNull().default("pending"),
    responseCode: integer("response_code"),
    responseMs: integer("response_ms"),
    responseBody: text("response_body"),
    nextRetryAt: ts("next_retry_at"),
    deliveredAt: ts("delivered_at"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("deliveries_endpoint_idx").on(t.endpointId, t.createdAt), index("deliveries_retry_idx").on(t.status, t.nextRetryAt)],
);

export const inboundWebhooks = pgTable("inbound_webhooks", {
  id: uuid("id").primaryKey().defaultRandom(),
  source: text("source").notNull(),
  endpointId: uuid("endpoint_id").references(() => webhookEndpoints.id, { onDelete: "set null" }),
  headers: jsonb("headers").$type<Record<string, string>>().notNull().default({}),
  payload: jsonb("payload").$type<unknown>().notNull().default({}),
  verified: boolean("verified").notNull().default(false),
  createdAt: ts("created_at").notNull().defaultNow(),
});

/* -------------------------------------------------------------- relations */
export const usersRelations = relations(users, ({ many }) => ({
  requestedPos: many(purchaseOrders, { relationName: "requester" }),
}));

export const vendorsRelations = relations(vendors, ({ many }) => ({
  skus: many(skus),
  purchaseOrders: many(purchaseOrders),
  invoices: many(invoices),
}));

export const skusRelations = relations(skus, ({ one, many }) => ({
  preferredVendor: one(vendors, { fields: [skus.preferredVendorId], references: [vendors.id] }),
  stock: many(stockLevels),
}));

export const stockLevelsRelations = relations(stockLevels, ({ one }) => ({
  sku: one(skus, { fields: [stockLevels.skuId], references: [skus.id] }),
  warehouse: one(warehouses, { fields: [stockLevels.warehouseId], references: [warehouses.id] }),
}));

export const purchaseOrdersRelations = relations(purchaseOrders, ({ one, many }) => ({
  vendor: one(vendors, { fields: [purchaseOrders.vendorId], references: [vendors.id] }),
  warehouse: one(warehouses, { fields: [purchaseOrders.warehouseId], references: [warehouses.id] }),
  requester: one(users, { fields: [purchaseOrders.requesterId], references: [users.id], relationName: "requester" }),
  approver: one(users, { fields: [purchaseOrders.approverId], references: [users.id], relationName: "approver" }),
  lines: many(purchaseOrderLines),
  events: many(poEvents),
  invoices: many(invoices),
}));

export const purchaseOrderLinesRelations = relations(purchaseOrderLines, ({ one }) => ({
  po: one(purchaseOrders, { fields: [purchaseOrderLines.poId], references: [purchaseOrders.id] }),
  sku: one(skus, { fields: [purchaseOrderLines.skuId], references: [skus.id] }),
}));

export const poEventsRelations = relations(poEvents, ({ one }) => ({
  po: one(purchaseOrders, { fields: [poEvents.poId], references: [purchaseOrders.id] }),
}));

export const invoicesRelations = relations(invoices, ({ one, many }) => ({
  vendor: one(vendors, { fields: [invoices.vendorId], references: [vendors.id] }),
  po: one(purchaseOrders, { fields: [invoices.poId], references: [purchaseOrders.id] }),
  lines: many(invoiceLines),
}));

export const invoiceLinesRelations = relations(invoiceLines, ({ one }) => ({
  invoice: one(invoices, { fields: [invoiceLines.invoiceId], references: [invoices.id] }),
  sku: one(skus, { fields: [invoiceLines.skuId], references: [skus.id] }),
}));

export const scheduledTasksRelations = relations(scheduledTasks, ({ many }) => ({
  runs: many(scheduledTaskRuns),
}));
export const scheduledTaskRunsRelations = relations(scheduledTaskRuns, ({ one }) => ({
  task: one(scheduledTasks, { fields: [scheduledTaskRuns.taskId], references: [scheduledTasks.id] }),
}));
export const webhookEndpointsRelations = relations(webhookEndpoints, ({ many }) => ({
  deliveries: many(webhookDeliveries),
}));
export const webhookDeliveriesRelations = relations(webhookDeliveries, ({ one }) => ({
  endpoint: one(webhookEndpoints, { fields: [webhookDeliveries.endpointId], references: [webhookEndpoints.id] }),
}));
export const apiKeysRelations = relations(apiKeys, ({ one }) => ({
  serviceUser: one(users, { fields: [apiKeys.serviceUserId], references: [users.id] }),
}));

export type User = typeof users.$inferSelect;
export type Vendor = typeof vendors.$inferSelect;
export type Sku = typeof skus.$inferSelect;
export type Warehouse = typeof warehouses.$inferSelect;
export type PurchaseOrder = typeof purchaseOrders.$inferSelect;
export type PurchaseOrderLine = typeof purchaseOrderLines.$inferSelect;
export type PoEvent = typeof poEvents.$inferSelect;
export type Invoice = typeof invoices.$inferSelect;
export type AgentRun = typeof agentRuns.$inferSelect;
export type ScheduledTask = typeof scheduledTasks.$inferSelect;
export type WebhookEndpoint = typeof webhookEndpoints.$inferSelect;
export type AsanaTaskRow = typeof asanaTasks.$inferSelect;
