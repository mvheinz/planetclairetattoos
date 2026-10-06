import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// P12.7 (U-14): „Angebote“ entfallen. Vor dem Entfernen der Tabellen und der Task-Kennung `revalidateEndedOffers`
// (nächste Migration, `p12_remove_offers`) räumen wir Daten weg, die darauf zeigen: eingereihte oder protokollierte
// Läufe dieses Tasks (sonst scheitert das Umwandeln der Enum-Spalte auf gefüllter Datenbank) und gespeicherte
// Listen-Einstellungen der Verwaltung. Die Angebote selbst fallen mit ihren Tabellen weg.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DELETE FROM "payload_jobs_log" WHERE "task_slug"::text = 'revalidateEndedOffers';
    DELETE FROM "payload_jobs" WHERE "task_slug"::text = 'revalidateEndedOffers';
    DELETE FROM "payload_locked_documents_rels" WHERE "tattoo_offers_id" IS NOT NULL;
    DELETE FROM "payload_preferences" WHERE "key" LIKE '%tattoo-offers%';`)
}

export async function down(_args: MigrateDownArgs): Promise<void> {
  // Gelöschte Läufe und Listen-Einstellungen sind nicht wiederherstellbar (und bedeutungslos).
}
