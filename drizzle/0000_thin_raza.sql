CREATE TYPE "public"."actor_type" AS ENUM('user', 'api_key', 'agent', 'system', 'token');--> statement-breakpoint
CREATE TYPE "public"."agent_kind" AS ENUM('draft_po', 'reorder', 'invoice_match', 'vendor_risk', 'chat');--> statement-breakpoint
CREATE TYPE "public"."agent_run_status" AS ENUM('running', 'proposed', 'applied', 'discarded', 'failed');--> statement-breakpoint
CREATE TYPE "public"."delivery_status" AS ENUM('pending', 'delivered', 'failed', 'exhausted');--> statement-breakpoint
CREATE TYPE "public"."integration_provider" AS ENUM('resend', 'deepseek', 'asana');--> statement-breakpoint
CREATE TYPE "public"."invoice_status" AS ENUM('draft', 'received', 'matched', 'approved', 'paid', 'disputed');--> statement-breakpoint
CREATE TYPE "public"."po_source" AS ENUM('manual', 'low_stock', 'agent', 'api');--> statement-breakpoint
CREATE TYPE "public"."po_status" AS ENUM('draft', 'pending_approval', 'approved', 'rejected', 'ordered', 'received', 'closed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."run_status" AS ENUM('running', 'ok', 'failed', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."stock_reason" AS ENUM('seed', 'receipt', 'adjustment', 'issue', 'transfer');--> statement-breakpoint
CREATE TYPE "public"."task_kind" AS ENUM('low_stock_scan', 'reorder_agent', 'overdue_invoice_reminder', 'asana_sync', 'daily_digest', 'webhook_retry');--> statement-breakpoint
CREATE TYPE "public"."token_purpose" AS ENUM('password_reset', 'po_approve', 'po_reject', 'invite');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('admin', 'manager', 'procurement', 'finance', 'requester', 'viewer');--> statement-breakpoint
CREATE TABLE "agent_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "agent_kind" NOT NULL,
	"status" "agent_run_status" DEFAULT 'running' NOT NULL,
	"requested_by" uuid,
	"input" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"proposal" jsonb DEFAULT 'null'::jsonb,
	"summary" text DEFAULT '' NOT NULL,
	"trace" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"model" text DEFAULT '' NOT NULL,
	"prompt_tokens" integer DEFAULT 0 NOT NULL,
	"completion_tokens" integer DEFAULT 0 NOT NULL,
	"duration_ms" integer DEFAULT 0 NOT NULL,
	"error" text,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"result_entity_type" text,
	"result_entity_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"prefix" text NOT NULL,
	"key_hash" text NOT NULL,
	"scopes" text[] DEFAULT '{}'::text[] NOT NULL,
	"service_user_id" uuid NOT NULL,
	"created_by" uuid,
	"last_used_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_type" "actor_type" DEFAULT 'system' NOT NULL,
	"actor_id" uuid,
	"actor_label" text DEFAULT 'System' NOT NULL,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text,
	"ip" text,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "company_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"name" text DEFAULT 'Kacific Broadband Satellites' NOT NULL,
	"legal_name" text DEFAULT 'Kacific Broadband Satellites Group' NOT NULL,
	"address" text DEFAULT '' NOT NULL,
	"country" text DEFAULT 'Singapore' NOT NULL,
	"timezone" text DEFAULT 'Asia/Singapore' NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"po_prefix" text DEFAULT 'PO' NOT NULL,
	"invoice_prefix" text DEFAULT 'INV' NOT NULL,
	"next_po_seq" integer DEFAULT 1 NOT NULL,
	"approval_threshold" numeric(14, 2) DEFAULT 0 NOT NULL,
	"price_tolerance_pct" numeric(5, 2) DEFAULT 2 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_outbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"to" text NOT NULL,
	"subject" text NOT NULL,
	"html" text NOT NULL,
	"links" text[] DEFAULT '{}'::text[] NOT NULL,
	"sent_via" text NOT NULL,
	"provider_id" text,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inbound_webhooks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" text NOT NULL,
	"endpoint_id" uuid,
	"headers" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"verified" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "integration_settings" (
	"provider" "integration_provider" PRIMARY KEY NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"secret_ciphertext" text,
	"secret_last4" text,
	"last_tested_at" timestamp with time zone,
	"last_test_ok" boolean,
	"last_test_message" text,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoice_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" uuid NOT NULL,
	"sku_id" uuid,
	"description" text NOT NULL,
	"qty" integer NOT NULL,
	"unit_cost" numeric(14, 2) NOT NULL,
	"line_total" numeric(14, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_number" text NOT NULL,
	"vendor_id" uuid NOT NULL,
	"po_id" uuid,
	"status" "invoice_status" DEFAULT 'draft' NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"subtotal" numeric(14, 2) DEFAULT 0 NOT NULL,
	"tax" numeric(14, 2) DEFAULT 0 NOT NULL,
	"total" numeric(14, 2) DEFAULT 0 NOT NULL,
	"issued_at" date,
	"due_at" date,
	"received_at" timestamp with time zone,
	"matched_at" timestamp with time zone,
	"paid_at" timestamp with time zone,
	"match" jsonb DEFAULT 'null'::jsonb,
	"notes" text DEFAULT '' NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "one_time_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token_hash" text NOT NULL,
	"purpose" "token_purpose" NOT NULL,
	"user_id" uuid,
	"po_id" uuid,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"used_ip" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "po_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"po_id" uuid NOT NULL,
	"type" text NOT NULL,
	"actor_type" "actor_type" DEFAULT 'system' NOT NULL,
	"actor_id" uuid,
	"actor_label" text DEFAULT 'System' NOT NULL,
	"message" text DEFAULT '' NOT NULL,
	"meta" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "purchase_order_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"po_id" uuid NOT NULL,
	"line_no" integer DEFAULT 1 NOT NULL,
	"sku_id" uuid,
	"description" text NOT NULL,
	"qty" integer NOT NULL,
	"unit_cost" numeric(14, 2) NOT NULL,
	"line_total" numeric(14, 2) NOT NULL,
	"qty_received" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "purchase_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"po_number" text NOT NULL,
	"status" "po_status" DEFAULT 'draft' NOT NULL,
	"source" "po_source" DEFAULT 'manual' NOT NULL,
	"vendor_id" uuid NOT NULL,
	"warehouse_id" uuid NOT NULL,
	"requester_id" uuid,
	"approver_id" uuid,
	"currency" text DEFAULT 'USD' NOT NULL,
	"subtotal" numeric(14, 2) DEFAULT 0 NOT NULL,
	"tax" numeric(14, 2) DEFAULT 0 NOT NULL,
	"total" numeric(14, 2) DEFAULT 0 NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"needed_by" date,
	"submitted_at" timestamp with time zone,
	"decided_at" timestamp with time zone,
	"decision_note" text DEFAULT '' NOT NULL,
	"ordered_at" timestamp with time zone,
	"received_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"asana_task_gid" text,
	"agent_run_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "purchase_orders_po_number_unique" UNIQUE("po_number")
);
--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"reset_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scheduled_task_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"status" "run_status" DEFAULT 'running' NOT NULL,
	"log" text DEFAULT '' NOT NULL,
	"trigger" text DEFAULT 'cron' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scheduled_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"kind" "task_kind" NOT NULL,
	"cron_expr" text NOT NULL,
	"timezone" text DEFAULT 'Asia/Singapore' NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"last_run_at" timestamp with time zone,
	"last_status" "run_status",
	"next_run_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "skus" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sku" text NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"unit" text DEFAULT 'ea' NOT NULL,
	"unit_cost" numeric(14, 2) DEFAULT 0 NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"reorder_level" integer DEFAULT 0 NOT NULL,
	"reorder_qty" integer DEFAULT 0 NOT NULL,
	"preferred_vendor_id" uuid,
	"lead_time_days" integer DEFAULT 14 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "skus_sku_unique" UNIQUE("sku")
);
--> statement-breakpoint
CREATE TABLE "stock_levels" (
	"sku_id" uuid NOT NULL,
	"warehouse_id" uuid NOT NULL,
	"qty" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stock_levels_sku_id_warehouse_id_pk" PRIMARY KEY("sku_id","warehouse_id")
);
--> statement-breakpoint
CREATE TABLE "stock_movements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sku_id" uuid NOT NULL,
	"warehouse_id" uuid NOT NULL,
	"delta" integer NOT NULL,
	"reason" "stock_reason" NOT NULL,
	"po_id" uuid,
	"actor_type" "actor_type" DEFAULT 'system' NOT NULL,
	"actor_id" uuid,
	"note" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"role" "user_role" DEFAULT 'viewer' NOT NULL,
	"password_hash" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_service_account" boolean DEFAULT false NOT NULL,
	"failed_logins" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"session_version" integer DEFAULT 1 NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vendors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"contact_name" text DEFAULT '' NOT NULL,
	"email" text DEFAULT '' NOT NULL,
	"phone" text DEFAULT '' NOT NULL,
	"country" text DEFAULT '' NOT NULL,
	"lead_time_days" integer DEFAULT 14 NOT NULL,
	"payment_terms_days" integer DEFAULT 30 NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"rating" integer DEFAULT 3 NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vendors_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "warehouses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"country" text NOT NULL,
	"city" text DEFAULT '' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "warehouses_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "webhook_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"endpoint_id" uuid NOT NULL,
	"event" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"attempt" integer DEFAULT 0 NOT NULL,
	"status" "delivery_status" DEFAULT 'pending' NOT NULL,
	"response_code" integer,
	"response_ms" integer,
	"response_body" text,
	"next_retry_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_endpoints" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"url" text NOT NULL,
	"secret_ciphertext" text NOT NULL,
	"events" text[] DEFAULT '{}'::text[] NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"inbound_key" text NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "webhook_endpoints_inbound_key_unique" UNIQUE("inbound_key")
);
--> statement-breakpoint
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_service_user_id_users_id_fk" FOREIGN KEY ("service_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inbound_webhooks" ADD CONSTRAINT "inbound_webhooks_endpoint_id_webhook_endpoints_id_fk" FOREIGN KEY ("endpoint_id") REFERENCES "public"."webhook_endpoints"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_settings" ADD CONSTRAINT "integration_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_sku_id_skus_id_fk" FOREIGN KEY ("sku_id") REFERENCES "public"."skus"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_po_id_purchase_orders_id_fk" FOREIGN KEY ("po_id") REFERENCES "public"."purchase_orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "one_time_tokens" ADD CONSTRAINT "one_time_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "po_events" ADD CONSTRAINT "po_events_po_id_purchase_orders_id_fk" FOREIGN KEY ("po_id") REFERENCES "public"."purchase_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_order_lines" ADD CONSTRAINT "purchase_order_lines_po_id_purchase_orders_id_fk" FOREIGN KEY ("po_id") REFERENCES "public"."purchase_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_order_lines" ADD CONSTRAINT "purchase_order_lines_sku_id_skus_id_fk" FOREIGN KEY ("sku_id") REFERENCES "public"."skus"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_requester_id_users_id_fk" FOREIGN KEY ("requester_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_approver_id_users_id_fk" FOREIGN KEY ("approver_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_task_runs" ADD CONSTRAINT "scheduled_task_runs_task_id_scheduled_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."scheduled_tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_tasks" ADD CONSTRAINT "scheduled_tasks_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skus" ADD CONSTRAINT "skus_preferred_vendor_id_vendors_id_fk" FOREIGN KEY ("preferred_vendor_id") REFERENCES "public"."vendors"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_levels" ADD CONSTRAINT "stock_levels_sku_id_skus_id_fk" FOREIGN KEY ("sku_id") REFERENCES "public"."skus"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_levels" ADD CONSTRAINT "stock_levels_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_sku_id_skus_id_fk" FOREIGN KEY ("sku_id") REFERENCES "public"."skus"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_endpoint_id_webhook_endpoints_id_fk" FOREIGN KEY ("endpoint_id") REFERENCES "public"."webhook_endpoints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_endpoints" ADD CONSTRAINT "webhook_endpoints_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_runs_created_idx" ON "agent_runs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "api_keys_prefix_idx" ON "api_keys" USING btree ("prefix");--> statement-breakpoint
CREATE INDEX "audit_entity_idx" ON "audit_log" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "audit_created_idx" ON "audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "outbox_created_idx" ON "email_outbox" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "invoice_lines_inv_idx" ON "invoice_lines" USING btree ("invoice_id");--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_vendor_number_idx" ON "invoices" USING btree ("vendor_id","invoice_number");--> statement-breakpoint
CREATE INDEX "invoices_po_idx" ON "invoices" USING btree ("po_id");--> statement-breakpoint
CREATE INDEX "invoices_status_idx" ON "invoices" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "ott_hash_idx" ON "one_time_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "ott_po_idx" ON "one_time_tokens" USING btree ("po_id");--> statement-breakpoint
CREATE INDEX "po_events_po_idx" ON "po_events" USING btree ("po_id","created_at");--> statement-breakpoint
CREATE INDEX "po_lines_po_idx" ON "purchase_order_lines" USING btree ("po_id");--> statement-breakpoint
CREATE INDEX "po_status_idx" ON "purchase_orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "po_vendor_idx" ON "purchase_orders" USING btree ("vendor_id");--> statement-breakpoint
CREATE INDEX "po_requester_idx" ON "purchase_orders" USING btree ("requester_id");--> statement-breakpoint
CREATE INDEX "po_created_idx" ON "purchase_orders" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "task_runs_task_idx" ON "scheduled_task_runs" USING btree ("task_id","started_at");--> statement-breakpoint
CREATE INDEX "stock_wh_idx" ON "stock_levels" USING btree ("warehouse_id");--> statement-breakpoint
CREATE INDEX "stock_mv_sku_idx" ON "stock_movements" USING btree ("sku_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "deliveries_endpoint_idx" ON "webhook_deliveries" USING btree ("endpoint_id","created_at");--> statement-breakpoint
CREATE INDEX "deliveries_retry_idx" ON "webhook_deliveries" USING btree ("status","next_retry_at");