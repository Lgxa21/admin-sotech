ALTER TABLE "orders" ADD COLUMN "pieces" jsonb DEFAULT '[]'::jsonb NOT NULL;
--> statement-breakpoint
CREATE TABLE "order_references" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "order_id" uuid NOT NULL,
  "piece_id" uuid,
  "name" text NOT NULL,
  "content_type" text NOT NULL,
  "data" bytea NOT NULL,
  CONSTRAINT "order_references_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX "order_references_order_idx" ON "order_references" ("order_id");
