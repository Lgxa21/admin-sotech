CREATE TABLE "studio_brand_assets" (
	"guide_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"name" text NOT NULL,
	"content_type" text NOT NULL,
	"data" "bytea" NOT NULL
);
--> statement-breakpoint
ALTER TABLE "brand_guides" ADD COLUMN "studio_shape" text DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "studio_brand_assets" ADD CONSTRAINT "studio_brand_assets_guide_id_brand_guides_id_fk" FOREIGN KEY ("guide_id") REFERENCES "public"."brand_guides"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "studio_brand_assets_guide_kind_idx" ON "studio_brand_assets" USING btree ("guide_id","kind");