import { type MigrateDownArgs, type MigrateUpArgs, sql } from '@payloadcms/db-postgres'

// P12.8 – eigenes SQL zu `tour-dates` (DATENMODELL §6.30, §9.2, §9.3): partieller UNIQUE-Index auf `seed_key` (wie jede
// Tabelle mit `seedField()`) und CHECK „Ende nicht vor Beginn“.

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE UNIQUE INDEX tour_dates_seed_key_unique ON tour_dates (seed_key) WHERE seed_key IS NOT NULL;
    ALTER TABLE tour_dates ADD CONSTRAINT tour_dates_range CHECK (ends_at IS NULL OR ends_at >= starts_at);
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE tour_dates DROP CONSTRAINT IF EXISTS tour_dates_range;
    DROP INDEX IF EXISTS tour_dates_seed_key_unique;
  `)
}
