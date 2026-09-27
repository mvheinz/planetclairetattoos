import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Eigene SQL-Migration (ARCHITEKTUR §3.9): Rate-Limit-Zähler, keine Payload-Collection. Zeilen ≤ 24 h (R-134, L-13a).
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  CREATE TABLE IF NOT EXISTS "rate_limit_hits" (
    "bucket" text NOT NULL,
    "key_hash" text NOT NULL,
    "window_start" timestamptz NOT NULL,
    "count" integer NOT NULL DEFAULT 1 CHECK ("count" >= 1),
    PRIMARY KEY ("bucket", "key_hash", "window_start")
  );
  CREATE INDEX IF NOT EXISTS "rate_limit_hits_window_start_idx" ON "rate_limit_hits" USING btree ("window_start");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  DROP TABLE IF EXISTS "rate_limit_hits";`)
}
