ALTER TABLE "cart_items" ADD COLUMN "product_image" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "name" varchar(200);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "phone" varchar(20);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "address" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "company_name" varchar(200);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "company_address" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "gst_number" varchar(15);