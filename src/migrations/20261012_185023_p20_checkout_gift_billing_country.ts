import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "checkouts" ALTER COLUMN "billing_address_country" SET DATA TYPE text;
  ALTER TABLE "checkouts" ALTER COLUMN "billing_address_country" SET DEFAULT 'DE'::text;
  DROP TYPE "public"."enum_checkouts_billing_address_country";
  CREATE TYPE "public"."enum_checkouts_billing_address_country" AS ENUM('DE', 'AT', 'BE', 'BG', 'CY', 'CZ', 'DK', 'EE', 'ES', 'FI', 'FR', 'GR', 'HR', 'HU', 'IE', 'IT', 'LT', 'LU', 'LV', 'MT', 'NL', 'PL', 'PT', 'RO', 'SE', 'SI', 'SK', 'IS', 'LI', 'NO');
  ALTER TABLE "checkouts" ALTER COLUMN "billing_address_country" SET DEFAULT 'DE'::"public"."enum_checkouts_billing_address_country";
  ALTER TABLE "checkouts" ALTER COLUMN "billing_address_country" SET DATA TYPE "public"."enum_checkouts_billing_address_country" USING "billing_address_country"::"public"."enum_checkouts_billing_address_country";
  ALTER TABLE "orders" ALTER COLUMN "billing_address_country" SET DATA TYPE text;
  ALTER TABLE "orders" ALTER COLUMN "billing_address_country" SET DEFAULT 'DE'::text;
  DROP TYPE "public"."enum_orders_billing_address_country";
  CREATE TYPE "public"."enum_orders_billing_address_country" AS ENUM('DE', 'AT', 'BE', 'BG', 'CY', 'CZ', 'DK', 'EE', 'ES', 'FI', 'FR', 'GR', 'HR', 'HU', 'IE', 'IT', 'LT', 'LU', 'LV', 'MT', 'NL', 'PL', 'PT', 'RO', 'SE', 'SI', 'SK', 'IS', 'LI', 'NO');
  ALTER TABLE "orders" ALTER COLUMN "billing_address_country" SET DEFAULT 'DE'::"public"."enum_orders_billing_address_country";
  ALTER TABLE "orders" ALTER COLUMN "billing_address_country" SET DATA TYPE "public"."enum_orders_billing_address_country" USING "billing_address_country"::"public"."enum_orders_billing_address_country";
  ALTER TABLE "checkouts" ADD COLUMN "gift_is_gift" boolean DEFAULT false;
  ALTER TABLE "checkouts" ADD COLUMN "gift_message" varchar;
  ALTER TABLE "orders" ADD COLUMN "gift_is_gift" boolean DEFAULT false;
  ALTER TABLE "orders" ADD COLUMN "gift_message" varchar;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "checkouts" ALTER COLUMN "billing_address_country" SET DATA TYPE text;
  ALTER TABLE "checkouts" ALTER COLUMN "billing_address_country" SET DEFAULT 'DE'::text;
  DROP TYPE "public"."enum_checkouts_billing_address_country";
  CREATE TYPE "public"."enum_checkouts_billing_address_country" AS ENUM('DE', 'AT', 'BE', 'BG', 'CY', 'CZ', 'DK', 'EE', 'ES', 'FI', 'FR', 'GR', 'HR', 'HU', 'IE', 'IT', 'LT', 'LU', 'LV', 'MT', 'NL', 'PL', 'PT', 'RO', 'SE', 'SI', 'SK', 'CH');
  ALTER TABLE "checkouts" ALTER COLUMN "billing_address_country" SET DEFAULT 'DE'::"public"."enum_checkouts_billing_address_country";
  ALTER TABLE "checkouts" ALTER COLUMN "billing_address_country" SET DATA TYPE "public"."enum_checkouts_billing_address_country" USING "billing_address_country"::"public"."enum_checkouts_billing_address_country";
  ALTER TABLE "orders" ALTER COLUMN "billing_address_country" SET DATA TYPE text;
  ALTER TABLE "orders" ALTER COLUMN "billing_address_country" SET DEFAULT 'DE'::text;
  DROP TYPE "public"."enum_orders_billing_address_country";
  CREATE TYPE "public"."enum_orders_billing_address_country" AS ENUM('DE', 'AT', 'BE', 'BG', 'CY', 'CZ', 'DK', 'EE', 'ES', 'FI', 'FR', 'GR', 'HR', 'HU', 'IE', 'IT', 'LT', 'LU', 'LV', 'MT', 'NL', 'PL', 'PT', 'RO', 'SE', 'SI', 'SK', 'CH');
  ALTER TABLE "orders" ALTER COLUMN "billing_address_country" SET DEFAULT 'DE'::"public"."enum_orders_billing_address_country";
  ALTER TABLE "orders" ALTER COLUMN "billing_address_country" SET DATA TYPE "public"."enum_orders_billing_address_country" USING "billing_address_country"::"public"."enum_orders_billing_address_country";
  ALTER TABLE "checkouts" DROP COLUMN "gift_is_gift";
  ALTER TABLE "checkouts" DROP COLUMN "gift_message";
  ALTER TABLE "orders" DROP COLUMN "gift_is_gift";
  ALTER TABLE "orders" DROP COLUMN "gift_message";`)
}
