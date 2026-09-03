CREATE TABLE "asana_tasks" (
	"gid" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"completed" boolean DEFAULT false NOT NULL,
	"completed_at" timestamp with time zone,
	"due_on" date,
	"assignee" text DEFAULT '' NOT NULL,
	"section" text DEFAULT '' NOT NULL,
	"permalink_url" text DEFAULT '' NOT NULL,
	"project_gid" text DEFAULT '' NOT NULL,
	"po_id" uuid,
	"modified_at" timestamp with time zone,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "asana_tasks" ADD CONSTRAINT "asana_tasks_po_id_purchase_orders_id_fk" FOREIGN KEY ("po_id") REFERENCES "public"."purchase_orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "asana_tasks_po_idx" ON "asana_tasks" USING btree ("po_id");--> statement-breakpoint
CREATE INDEX "asana_tasks_synced_idx" ON "asana_tasks" USING btree ("synced_at");