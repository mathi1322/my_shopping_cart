CREATE TYPE "public"."order_status" AS ENUM('placed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('cod');--> statement-breakpoint
CREATE TABLE "order_items" (
	"order_id" text NOT NULL,
	"product_id" text NOT NULL,
	"product_name" varchar(200) NOT NULL,
	"product_image" text,
	"vendor_id" text NOT NULL,
	"unit_price_in_cents" integer NOT NULL,
	"currency" varchar(3) DEFAULT 'INR' NOT NULL,
	"quantity" integer NOT NULL,
	CONSTRAINT "order_items_order_id_product_id_pk" PRIMARY KEY("order_id","product_id")
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" text PRIMARY KEY NOT NULL,
	"buyer_id" text NOT NULL,
	"buyer_email" text NOT NULL,
	"delivery_address" text NOT NULL,
	"delivery_phone" varchar(20) NOT NULL,
	"payment_method" "payment_method" DEFAULT 'cod' NOT NULL,
	"status" "order_status" DEFAULT 'placed' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_buyer_id_users_id_fk" FOREIGN KEY ("buyer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;