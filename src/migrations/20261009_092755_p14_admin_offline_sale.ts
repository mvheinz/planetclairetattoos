import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// U-60 (P14.11): Markt-Verkauf einem Tour-Termin zuordnen, optional mit Preis (zählt im Umsatz-Wächter). Neue Spalten
// `products.offline_sale_tour_date_id` (FK auf `tour_dates`, beim Löschen des Termins NULL) und
// `products.offline_sale_price_cents` (ganze Cent ≥ 0, CHECK wie alle Cent-Spalten, DATENMODELL §9.2). Die bisherigen
// Freitexte `offline_sale_note` bleiben unverändert erhalten.
//
// Hinweis: Der Schnappschuss (.json) dieser Migration ist neu erzeugt und bildet das vollständige aktuelle Schema ab; der
// vorherige Schnappschuss (p12_ip_snippets) enthielt `tour_dates` und das Entfernen der Angebote (P12) noch nicht. Die
// SQL-Anweisungen hier enthalten deshalb nur die Änderungen dieser Aufgabe – der Rest ist längst per Migration da.

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "offline_sale_tour_date_id" integer;
  ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "offline_sale_price_cents" numeric;
  ALTER TABLE "products" ADD CONSTRAINT "products_offline_sale_tour_date_id_tour_dates_id_fk" FOREIGN KEY ("offline_sale_tour_date_id") REFERENCES "public"."tour_dates"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX IF NOT EXISTS "products_offline_sale_tour_date_idx" ON "products" USING btree ("offline_sale_tour_date_id");
  ALTER TABLE "products" ADD CONSTRAINT "products_offline_sale_price_cents_ck" CHECK ("offline_sale_price_cents" >= 0 AND "offline_sale_price_cents" = trunc("offline_sale_price_cents"));`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "products" DROP CONSTRAINT IF EXISTS "products_offline_sale_price_cents_ck";
  ALTER TABLE "products" DROP CONSTRAINT IF EXISTS "products_offline_sale_tour_date_id_tour_dates_id_fk";
  DROP INDEX IF EXISTS "products_offline_sale_tour_date_idx";
  ALTER TABLE "products" DROP COLUMN IF EXISTS "offline_sale_tour_date_id";
  ALTER TABLE "products" DROP COLUMN IF EXISTS "offline_sale_price_cents";`)
}
