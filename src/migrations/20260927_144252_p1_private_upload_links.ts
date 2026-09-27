import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "private_uploads" ADD COLUMN "related_order_id" integer;
  ALTER TABLE "private_uploads" ADD COLUMN "related_product_id" integer;
  ALTER TABLE "private_uploads" ADD COLUMN "related_invoice_id" integer;
  ALTER TABLE "private_uploads" ADD CONSTRAINT "private_uploads_related_order_id_orders_id_fk" FOREIGN KEY ("related_order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "private_uploads" ADD CONSTRAINT "private_uploads_related_product_id_products_id_fk" FOREIGN KEY ("related_product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "private_uploads" ADD CONSTRAINT "private_uploads_related_invoice_id_invoices_id_fk" FOREIGN KEY ("related_invoice_id") REFERENCES "public"."invoices"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "private_uploads_related_order_idx" ON "private_uploads" USING btree ("related_order_id");
  CREATE INDEX "private_uploads_related_product_idx" ON "private_uploads" USING btree ("related_product_id");
  CREATE INDEX "private_uploads_related_invoice_idx" ON "private_uploads" USING btree ("related_invoice_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "private_uploads" DROP CONSTRAINT "private_uploads_related_order_id_orders_id_fk";
  
  ALTER TABLE "private_uploads" DROP CONSTRAINT "private_uploads_related_product_id_products_id_fk";
  
  ALTER TABLE "private_uploads" DROP CONSTRAINT "private_uploads_related_invoice_id_invoices_id_fk";
  
  DROP INDEX "private_uploads_related_order_idx";
  DROP INDEX "private_uploads_related_product_idx";
  DROP INDEX "private_uploads_related_invoice_idx";
  ALTER TABLE "private_uploads" DROP COLUMN "related_order_id";
  ALTER TABLE "private_uploads" DROP COLUMN "related_product_id";
  ALTER TABLE "private_uploads" DROP COLUMN "related_invoice_id";`)
}
