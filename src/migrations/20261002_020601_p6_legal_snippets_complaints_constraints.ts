import { type MigrateDownArgs, type MigrateUpArgs, sql } from '@payloadcms/db-postgres'

// P6.1 – eigenes SQL zu `legal-snippets` und `complaints` (DATENMODELL §9.3, §10.1): genau eine aktive Fassung je
// Baustein-Schlüssel und der partielle UNIQUE-Index auf `seed_key` für `complaints`.

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE UNIQUE INDEX legal_snippets_one_active_per_key ON legal_snippets (key) WHERE status = 'active';
    CREATE UNIQUE INDEX complaints_seed_key_unique ON complaints (seed_key) WHERE seed_key IS NOT NULL;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS complaints_seed_key_unique;
    DROP INDEX IF EXISTS legal_snippets_one_active_per_key;
  `)
}
