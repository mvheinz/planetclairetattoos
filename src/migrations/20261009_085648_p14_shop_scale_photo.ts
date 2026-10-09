import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// P14.8 (U-57 d): optionales Größen-Vergleichsfoto je Stück (`products.scalePhoto` → media). Von Hand auf diese
// Änderung reduziert: Der Schnappschuss des Vorgängers (p12_ip_snippets) entstand parallel zu p12_tour_dates und kannte
// deren Tabellen nicht; die JSON-Datei hier ist wieder der vollständige aktuelle Stand.

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "scale_photo_id" integer;
  ALTER TABLE "products" ADD CONSTRAINT "products_scale_photo_id_media_id_fk" FOREIGN KEY ("scale_photo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX IF NOT EXISTS "products_scale_photo_idx" ON "products" USING btree ("scale_photo_id");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "products" DROP CONSTRAINT IF EXISTS "products_scale_photo_id_media_id_fk";
  DROP INDEX IF EXISTS "products_scale_photo_idx";
  ALTER TABLE "products" DROP COLUMN IF EXISTS "scale_photo_id";`)
}
