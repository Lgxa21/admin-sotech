CREATE TABLE "brand_guides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"is_company" boolean DEFAULT false NOT NULL,
	"name" text NOT NULL,
	"colors" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"shapes" text,
	"typography" text,
	"logo_rules" text,
	"notes" text,
	"file_name" text,
	"file_type" text,
	"file_data" "bytea"
);
--> statement-breakpoint
ALTER TABLE "brand_guides" ADD CONSTRAINT "brand_guides_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "brand_guides_company_idx" ON "brand_guides" USING btree ("client_id") WHERE "brand_guides"."is_company";--> statement-breakpoint
CREATE UNIQUE INDEX "brand_guides_subbrand_idx" ON "brand_guides" USING btree ("client_id",lower("name")) WHERE not "brand_guides"."is_company";