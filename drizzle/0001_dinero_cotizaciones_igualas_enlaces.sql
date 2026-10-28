CREATE TYPE "public"."approval_status" AS ENUM('PENDIENTE', 'APROBADO', 'CAMBIOS', 'ANULADO');--> statement-breakpoint
CREATE TYPE "public"."cost_kind" AS ENUM('PROVEEDOR', 'GASTO');--> statement-breakpoint
CREATE TYPE "public"."cost_status" AS ENUM('PENDIENTE', 'PAGADO');--> statement-breakpoint
CREATE TYPE "public"."quote_status" AS ENUM('BORRADOR', 'ENVIADA', 'APROBADA', 'RECHAZADA');--> statement-breakpoint
CREATE TABLE "approval_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"token" text NOT NULL,
	"piece_url" text,
	"message" text,
	"round" integer DEFAULT 1 NOT NULL,
	"status" "approval_status" DEFAULT 'PENDIENTE' NOT NULL,
	"client_name" text,
	"client_comment" text,
	"responded_at" timestamp with time zone,
	"created_by_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "approval_links_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "costs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"kind" "cost_kind" NOT NULL,
	"supplier_id" uuid,
	"concept" text NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"currency" "currency" NOT NULL,
	"rate" numeric(16, 4),
	"amount_usd" numeric(14, 2) NOT NULL,
	"status" "cost_status" DEFAULT 'PENDIENTE' NOT NULL,
	"paid_on" date,
	"method" text,
	"reference" text,
	"created_by_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exchange_rates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"day" date NOT NULL,
	"rate" numeric(16, 4) NOT NULL,
	"source" text,
	"created_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "exchange_rates_day_unique" UNIQUE("day")
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"order_id" uuid,
	"amount" numeric(14, 2) NOT NULL,
	"currency" "currency" NOT NULL,
	"rate" numeric(16, 4),
	"amount_usd" numeric(14, 2) NOT NULL,
	"method" text NOT NULL,
	"reference" text,
	"paid_on" date NOT NULL,
	"notes" text,
	"created_by_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quote_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quote_id" uuid NOT NULL,
	"description" text NOT NULL,
	"qty" numeric(10, 2) DEFAULT '1' NOT NULL,
	"unit_price" numeric(14, 2) NOT NULL,
	"position" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quotes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"number" serial NOT NULL,
	"client_id" uuid NOT NULL,
	"title" text NOT NULL,
	"status" "quote_status" DEFAULT 'BORRADOR' NOT NULL,
	"currency" "currency" DEFAULT 'USD' NOT NULL,
	"valid_until" date,
	"notes" text,
	"order_id" uuid,
	"created_by_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quotes_number_unique" UNIQUE("number")
);
--> statement-breakpoint
CREATE TABLE "retainers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"title" text NOT NULL,
	"service_type" "service_type" DEFAULT 'REDES_SOCIALES' NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"currency" "currency" DEFAULT 'USD' NOT NULL,
	"items" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"owner_id" uuid,
	"due_day" integer DEFAULT 28 NOT NULL,
	"revision_rounds" integer DEFAULT 2 NOT NULL,
	"start_period" text NOT NULL,
	"end_period" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "suppliers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"kind" text DEFAULT 'PROVEEDOR' NOT NULL,
	"user_id" uuid,
	"contact" text,
	"notes" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "request_token" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "retainer_id" uuid;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "period" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "source" text DEFAULT 'interno' NOT NULL;--> statement-breakpoint
ALTER TABLE "approval_links" ADD CONSTRAINT "approval_links_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_links" ADD CONSTRAINT "approval_links_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "costs" ADD CONSTRAINT "costs_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "costs" ADD CONSTRAINT "costs_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "costs" ADD CONSTRAINT "costs_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exchange_rates" ADD CONSTRAINT "exchange_rates_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_items" ADD CONSTRAINT "quote_items_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "retainers" ADD CONSTRAINT "retainers_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "retainers" ADD CONSTRAINT "retainers_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "approval_links_order_idx" ON "approval_links" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "costs_order_idx" ON "costs" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "costs_status_idx" ON "costs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "payments_order_idx" ON "payments" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "payments_client_idx" ON "payments" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "payments_day_idx" ON "payments" USING btree ("paid_on");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_retainer_period_idx" ON "orders" USING btree ("retainer_id","period");--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_request_token_unique" UNIQUE("request_token");