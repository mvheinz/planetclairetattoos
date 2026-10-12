import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TYPE "public"."enum_settings_care_templates_category" ADD VALUE 'keramik';
  ALTER TYPE "public"."enum_settings_care_templates_category" ADD VALUE 'schmuck';
  ALTER TYPE "public"."enum__settings_v_version_care_templates_category" ADD VALUE 'keramik';
  ALTER TYPE "public"."enum__settings_v_version_care_templates_category" ADD VALUE 'schmuck';
  ALTER TABLE "products_locales" ADD COLUMN "jutta_says_suggestion" varchar;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "settings_care_templates" ALTER COLUMN "category" SET DATA TYPE text;
  DROP TYPE "public"."enum_settings_care_templates_category";
  CREATE TYPE "public"."enum_settings_care_templates_category" AS ENUM('textil', 'cap');
  ALTER TABLE "settings_care_templates" ALTER COLUMN "category" SET DATA TYPE "public"."enum_settings_care_templates_category" USING "category"::"public"."enum_settings_care_templates_category";
  ALTER TABLE "_settings_v_version_care_templates" ALTER COLUMN "category" SET DATA TYPE text;
  DROP TYPE "public"."enum__settings_v_version_care_templates_category";
  CREATE TYPE "public"."enum__settings_v_version_care_templates_category" AS ENUM('textil', 'cap');
  ALTER TABLE "_settings_v_version_care_templates" ALTER COLUMN "category" SET DATA TYPE "public"."enum__settings_v_version_care_templates_category" USING "category"::"public"."enum__settings_v_version_care_templates_category";
  ALTER TABLE "products_locales" DROP COLUMN "jutta_says_suggestion";`)
}
