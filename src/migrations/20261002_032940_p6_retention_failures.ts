import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Eigene SQL-Migration (LOESCHKONZEPT §4 Regel 2, DATENMODELL §11, P6.14): Fehlschläge der Löschjobs je Datensatz.
// Scheitert das Löschen eines Speicherobjekts bzw. Datensatzes, bleibt er stehen und der nächste Lauf versucht es
// erneut; nach 3 Fehlschlägen geht A12 (`admin_alert`). Nur IDs und geschwärzte Fehlertexte, keine Inhalte.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  CREATE TABLE IF NOT EXISTS "retention_failures" (
    "task" text NOT NULL,
    "entity_collection" text NOT NULL,
    "entity_id" text NOT NULL,
    "failures" integer NOT NULL DEFAULT 1 CHECK ("failures" >= 1),
    "last_error" text,
    "last_failed_at" timestamptz NOT NULL,
    "alerted_at" timestamptz,
    PRIMARY KEY ("task", "entity_collection", "entity_id")
  );`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  DROP TABLE IF EXISTS "retention_failures";`)
}
