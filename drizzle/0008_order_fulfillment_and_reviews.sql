CREATE TYPE "public"."fulfillment_status" AS ENUM('placed', 'shipped', 'delivered');--> statement-breakpoint
ALTER TYPE "public"."order_status" ADD VALUE 'shipped';--> statement-breakpoint
ALTER TYPE "public"."order_status" ADD VALUE 'delivered';--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "fulfillment_status" "fulfillment_status" DEFAULT 'placed' NOT NULL;--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN "author_id" text;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "order_items_product_id_idx" ON "order_items" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "products_created_at_idx" ON "products" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "reviews_product_id_author_id_unique" ON "reviews" USING btree ("product_id","author_id");--> statement-breakpoint
CREATE INDEX "reviews_product_id_created_at_idx" ON "reviews" USING btree ("product_id","created_at");