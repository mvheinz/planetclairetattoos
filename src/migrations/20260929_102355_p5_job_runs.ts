import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Eigene SQL-Migration (DATENMODELL §11, §10.1; PLAN P5.3): Lauf-Protokoll `job_runs`, keine Payload-Collection.
// Ein Eintrag je Task-Lauf; `counts` nur Zähler/IDs; Fehlertexte geschwärzt (R-137); Löschung nach 90 Tagen (L-13 g).
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  CREATE TABLE IF NOT EXISTS "job_runs" (
    "id" bigserial PRIMARY KEY,
    "task" text NOT NULL,
    "started_at" timestamptz NOT NULL,
    "finished_at" timestamptz,
    "status" text NOT NULL CHECK ("status" IN ('ok', 'failed', 'skipped')),
    "counts" jsonb,
    "error" text CHECK ("error" IS NULL OR char_length("error") <= 1000)
  );
  CREATE INDEX IF NOT EXISTS "job_runs_task_started_at_idx" ON "job_runs" USING btree ("task", "started_at");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  DROP TABLE IF EXISTS "job_runs";`)
}
