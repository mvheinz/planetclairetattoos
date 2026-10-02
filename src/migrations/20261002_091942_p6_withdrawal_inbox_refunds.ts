import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "orders_refunds" ADD COLUMN "withdrawal_id" integer;
  ALTER TABLE "orders_refunds" ADD COLUMN "note" varchar;
  ALTER TABLE "withdrawals" ADD COLUMN "return_condition_note" varchar;
  ALTER TABLE "orders_refunds" ADD CONSTRAINT "orders_refunds_withdrawal_id_withdrawals_id_fk" FOREIGN KEY ("withdrawal_id") REFERENCES "public"."withdrawals"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "orders_refunds_withdrawal_idx" ON "orders_refunds" USING btree ("withdrawal_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "orders_refunds" DROP CONSTRAINT "orders_refunds_withdrawal_id_withdrawals_id_fk";
  
  DROP INDEX "orders_refunds_withdrawal_idx";
  ALTER TABLE "orders_refunds" DROP COLUMN "withdrawal_id";
  ALTER TABLE "orders_refunds" DROP COLUMN "note";
  ALTER TABLE "withdrawals" DROP COLUMN "return_condition_note";`)
}
