import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "settings" ADD COLUMN "tattoo_prices_confirmed_at" timestamp(3) with time zone;
  ALTER TABLE "settings" ADD COLUMN "tattoo_inquiries_open" boolean DEFAULT true;
  ALTER TABLE "settings" ADD COLUMN "tattoo_booked_until" varchar;
  ALTER TABLE "settings_locales" ADD COLUMN "tattoo_booked_note" varchar;
  ALTER TABLE "_settings_v" ADD COLUMN "version_tattoo_prices_confirmed_at" timestamp(3) with time zone;
  ALTER TABLE "_settings_v" ADD COLUMN "version_tattoo_inquiries_open" boolean DEFAULT true;
  ALTER TABLE "_settings_v" ADD COLUMN "version_tattoo_booked_until" varchar;
  ALTER TABLE "_settings_v_locales" ADD COLUMN "version_tattoo_booked_note" varchar;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "settings" DROP COLUMN "tattoo_prices_confirmed_at";
  ALTER TABLE "settings" DROP COLUMN "tattoo_inquiries_open";
  ALTER TABLE "settings" DROP COLUMN "tattoo_booked_until";
  ALTER TABLE "settings_locales" DROP COLUMN "tattoo_booked_note";
  ALTER TABLE "_settings_v" DROP COLUMN "version_tattoo_prices_confirmed_at";
  ALTER TABLE "_settings_v" DROP COLUMN "version_tattoo_inquiries_open";
  ALTER TABLE "_settings_v" DROP COLUMN "version_tattoo_booked_until";
  ALTER TABLE "_settings_v_locales" DROP COLUMN "version_tattoo_booked_note";`)
}
