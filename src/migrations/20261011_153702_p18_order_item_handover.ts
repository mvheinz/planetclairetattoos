import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// P18.5 (Prüfung, Rest-Lieferung): Übergabe je Position (`orders.items[].handedOverAt`), gesetzt bei „Versendet“ (O7)
// bzw. „Abgeholt“ (O9). Altbestellungen bleiben leer (dann entscheiden die Zeitstempel der Bestellung).

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "orders_items" ADD COLUMN "handed_over_at" timestamp(3) with time zone;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "orders_items" DROP COLUMN "handed_over_at";`)
}
