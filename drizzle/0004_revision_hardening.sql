ALTER TABLE "orders" ADD CONSTRAINT "orders_retainer_id_retainers_id_fk" FOREIGN KEY ("retainer_id") REFERENCES "public"."retainers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "orders_due_idx" ON "orders" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "orders_status_changed_idx" ON "orders" USING btree ("status_changed_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "quotes_client_idx" ON "quotes" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "quote_items_quote_idx" ON "quote_items" USING btree ("quote_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "retainers_client_idx" ON "retainers" USING btree ("client_id");--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"actor_id" uuid,
	"entity_type" text,
	"entity_id" text,
	"detail" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_events_kind_idx" ON "audit_events" USING btree ("kind","created_at");
