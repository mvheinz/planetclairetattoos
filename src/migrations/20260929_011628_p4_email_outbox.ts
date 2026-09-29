import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "email_log" ADD COLUMN "idempotency_key" varchar;
  CREATE UNIQUE INDEX "email_log_idempotency_key_idx" ON "email_log" USING btree ("idempotency_key");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX "email_log_idempotency_key_idx";
  ALTER TABLE "email_log" DROP COLUMN "idempotency_key";`)
}
