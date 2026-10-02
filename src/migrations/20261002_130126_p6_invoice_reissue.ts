import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TYPE "public"."enum_orders_refunds_reason" ADD VALUE 'correction';
  ALTER TYPE "public"."enum_invoices_reason" ADD VALUE 'correction';
  ALTER TABLE "invoices" ADD COLUMN "replaces_invoice_id" integer;
  ALTER TABLE "invoices" ADD CONSTRAINT "invoices_replaces_invoice_id_invoices_id_fk" FOREIGN KEY ("replaces_invoice_id") REFERENCES "public"."invoices"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "invoices_replaces_invoice_idx" ON "invoices" USING btree ("replaces_invoice_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "invoices" DROP CONSTRAINT "invoices_replaces_invoice_id_invoices_id_fk";
  
  ALTER TABLE "orders_refunds" ALTER COLUMN "reason" SET DATA TYPE text;
  DROP TYPE "public"."enum_orders_refunds_reason";
  CREATE TYPE "public"."enum_orders_refunds_reason" AS ENUM('withdrawal', 'goodwill', 'complaint', 'breakage', 'admin_cancellation', 'item_unavailable', 'dispute');
  ALTER TABLE "orders_refunds" ALTER COLUMN "reason" SET DATA TYPE "public"."enum_orders_refunds_reason" USING "reason"::"public"."enum_orders_refunds_reason";
  ALTER TABLE "invoices" ALTER COLUMN "reason" SET DATA TYPE text;
  DROP TYPE "public"."enum_invoices_reason";
  CREATE TYPE "public"."enum_invoices_reason" AS ENUM('withdrawal', 'goodwill', 'complaint', 'breakage', 'admin_cancellation', 'item_unavailable', 'dispute');
  ALTER TABLE "invoices" ALTER COLUMN "reason" SET DATA TYPE "public"."enum_invoices_reason" USING "reason"::"public"."enum_invoices_reason";
  DROP INDEX "invoices_replaces_invoice_idx";
  ALTER TABLE "invoices" DROP COLUMN "replaces_invoice_id";`)
}
