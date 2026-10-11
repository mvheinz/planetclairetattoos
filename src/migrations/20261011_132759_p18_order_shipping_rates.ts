import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// P18.5 (Prüfung, KA-32): Versandtarife bei der Bestellanlage (`orders.shippingRatesAtOrder`) für die Versanddifferenz
// beim Teil-Widerruf. Altbestellungen bleiben leer (der Vorschlag nimmt dann die aktuellen Tarife).

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "orders" ADD COLUMN "shipping_rates_at_order" jsonb;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "orders" DROP COLUMN "shipping_rates_at_order";`)
}
