CREATE TYPE "public"."chat_channel" AS ENUM('widget', 'telegram');--> statement-breakpoint
ALTER TYPE "public"."integration_provider" ADD VALUE 'telegram';--> statement-breakpoint
ALTER TYPE "public"."user_role" ADD VALUE 'sales' BEFORE 'requester';--> statement-breakpoint
ALTER TYPE "public"."user_role" ADD VALUE 'operations' BEFORE 'requester';--> statement-breakpoint
CREATE TABLE "chat_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"channel" "chat_channel" NOT NULL,
	"user_id" uuid,
	"external_chat_id" text,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"run_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chat_user_idx" ON "chat_messages" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "chat_ext_idx" ON "chat_messages" USING btree ("external_chat_id","created_at");