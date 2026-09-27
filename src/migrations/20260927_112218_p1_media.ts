import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_media_shows_person" AS ENUM('none', 'jutta', 'customer');
  CREATE TYPE "public"."enum_media_source" AS ENUM('upload', 'instagram_seed', 'instagram_export', 'placeholder', 'generated');
  CREATE TYPE "public"."enum_media_enhance" AS ENUM('auto', 'off');
  CREATE TABLE "media_locales" (
  	"alt" varchar,
  	"caption" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  ALTER TABLE "media" ADD COLUMN "shows_person" "enum_media_shows_person" DEFAULT 'none' NOT NULL;
  ALTER TABLE "media" ADD COLUMN "restricted" boolean DEFAULT false;
  ALTER TABLE "media" ADD COLUMN "source" "enum_media_source" DEFAULT 'upload' NOT NULL;
  ALTER TABLE "media" ADD COLUMN "source_ref" varchar;
  ALTER TABLE "media" ADD COLUMN "enhance" "enum_media_enhance" DEFAULT 'auto' NOT NULL;
  ALTER TABLE "media" ADD COLUMN "derivatives_version" numeric DEFAULT 1;
  ALTER TABLE "media" ADD COLUMN "placeholder_data_url" varchar;
  ALTER TABLE "media" ADD COLUMN "dominant_color" varchar;
  ALTER TABLE "media" ADD COLUMN "seed" boolean DEFAULT false;
  ALTER TABLE "media" ADD COLUMN "seed_key" varchar;
  ALTER TABLE "media" ADD COLUMN "sizes_thumb_url" varchar;
  ALTER TABLE "media" ADD COLUMN "sizes_thumb_width" numeric;
  ALTER TABLE "media" ADD COLUMN "sizes_thumb_height" numeric;
  ALTER TABLE "media" ADD COLUMN "sizes_thumb_mime_type" varchar;
  ALTER TABLE "media" ADD COLUMN "sizes_thumb_filesize" numeric;
  ALTER TABLE "media" ADD COLUMN "sizes_thumb_filename" varchar;
  ALTER TABLE "media" ADD COLUMN "sizes_card_url" varchar;
  ALTER TABLE "media" ADD COLUMN "sizes_card_width" numeric;
  ALTER TABLE "media" ADD COLUMN "sizes_card_height" numeric;
  ALTER TABLE "media" ADD COLUMN "sizes_card_mime_type" varchar;
  ALTER TABLE "media" ADD COLUMN "sizes_card_filesize" numeric;
  ALTER TABLE "media" ADD COLUMN "sizes_card_filename" varchar;
  ALTER TABLE "media" ADD COLUMN "sizes_detail_url" varchar;
  ALTER TABLE "media" ADD COLUMN "sizes_detail_width" numeric;
  ALTER TABLE "media" ADD COLUMN "sizes_detail_height" numeric;
  ALTER TABLE "media" ADD COLUMN "sizes_detail_mime_type" varchar;
  ALTER TABLE "media" ADD COLUMN "sizes_detail_filesize" numeric;
  ALTER TABLE "media" ADD COLUMN "sizes_detail_filename" varchar;
  ALTER TABLE "media" ADD COLUMN "sizes_zoom_url" varchar;
  ALTER TABLE "media" ADD COLUMN "sizes_zoom_width" numeric;
  ALTER TABLE "media" ADD COLUMN "sizes_zoom_height" numeric;
  ALTER TABLE "media" ADD COLUMN "sizes_zoom_mime_type" varchar;
  ALTER TABLE "media" ADD COLUMN "sizes_zoom_filesize" numeric;
  ALTER TABLE "media" ADD COLUMN "sizes_zoom_filename" varchar;
  ALTER TABLE "media" ADD COLUMN "sizes_og_url" varchar;
  ALTER TABLE "media" ADD COLUMN "sizes_og_width" numeric;
  ALTER TABLE "media" ADD COLUMN "sizes_og_height" numeric;
  ALTER TABLE "media" ADD COLUMN "sizes_og_mime_type" varchar;
  ALTER TABLE "media" ADD COLUMN "sizes_og_filesize" numeric;
  ALTER TABLE "media" ADD COLUMN "sizes_og_filename" varchar;
  ALTER TABLE "media_locales" ADD CONSTRAINT "media_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  CREATE UNIQUE INDEX "media_locales_locale_parent_id_unique" ON "media_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "media_restricted_idx" ON "media" USING btree ("restricted");
  CREATE INDEX "media_source_idx" ON "media" USING btree ("source");
  CREATE INDEX "media_seed_idx" ON "media" USING btree ("seed");
  CREATE INDEX "media_seed_key_idx" ON "media" USING btree ("seed_key");
  CREATE INDEX "media_sizes_thumb_sizes_thumb_filename_idx" ON "media" USING btree ("sizes_thumb_filename");
  CREATE INDEX "media_sizes_card_sizes_card_filename_idx" ON "media" USING btree ("sizes_card_filename");
  CREATE INDEX "media_sizes_detail_sizes_detail_filename_idx" ON "media" USING btree ("sizes_detail_filename");
  CREATE INDEX "media_sizes_zoom_sizes_zoom_filename_idx" ON "media" USING btree ("sizes_zoom_filename");
  CREATE INDEX "media_sizes_og_sizes_og_filename_idx" ON "media" USING btree ("sizes_og_filename");
  ALTER TABLE "media" DROP COLUMN "alt";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "media_locales" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "media_locales" CASCADE;
  DROP INDEX "media_restricted_idx";
  DROP INDEX "media_source_idx";
  DROP INDEX "media_seed_idx";
  DROP INDEX "media_seed_key_idx";
  DROP INDEX "media_sizes_thumb_sizes_thumb_filename_idx";
  DROP INDEX "media_sizes_card_sizes_card_filename_idx";
  DROP INDEX "media_sizes_detail_sizes_detail_filename_idx";
  DROP INDEX "media_sizes_zoom_sizes_zoom_filename_idx";
  DROP INDEX "media_sizes_og_sizes_og_filename_idx";
  ALTER TABLE "media" ADD COLUMN "alt" varchar NOT NULL;
  ALTER TABLE "media" DROP COLUMN "shows_person";
  ALTER TABLE "media" DROP COLUMN "restricted";
  ALTER TABLE "media" DROP COLUMN "source";
  ALTER TABLE "media" DROP COLUMN "source_ref";
  ALTER TABLE "media" DROP COLUMN "enhance";
  ALTER TABLE "media" DROP COLUMN "derivatives_version";
  ALTER TABLE "media" DROP COLUMN "placeholder_data_url";
  ALTER TABLE "media" DROP COLUMN "dominant_color";
  ALTER TABLE "media" DROP COLUMN "seed";
  ALTER TABLE "media" DROP COLUMN "seed_key";
  ALTER TABLE "media" DROP COLUMN "sizes_thumb_url";
  ALTER TABLE "media" DROP COLUMN "sizes_thumb_width";
  ALTER TABLE "media" DROP COLUMN "sizes_thumb_height";
  ALTER TABLE "media" DROP COLUMN "sizes_thumb_mime_type";
  ALTER TABLE "media" DROP COLUMN "sizes_thumb_filesize";
  ALTER TABLE "media" DROP COLUMN "sizes_thumb_filename";
  ALTER TABLE "media" DROP COLUMN "sizes_card_url";
  ALTER TABLE "media" DROP COLUMN "sizes_card_width";
  ALTER TABLE "media" DROP COLUMN "sizes_card_height";
  ALTER TABLE "media" DROP COLUMN "sizes_card_mime_type";
  ALTER TABLE "media" DROP COLUMN "sizes_card_filesize";
  ALTER TABLE "media" DROP COLUMN "sizes_card_filename";
  ALTER TABLE "media" DROP COLUMN "sizes_detail_url";
  ALTER TABLE "media" DROP COLUMN "sizes_detail_width";
  ALTER TABLE "media" DROP COLUMN "sizes_detail_height";
  ALTER TABLE "media" DROP COLUMN "sizes_detail_mime_type";
  ALTER TABLE "media" DROP COLUMN "sizes_detail_filesize";
  ALTER TABLE "media" DROP COLUMN "sizes_detail_filename";
  ALTER TABLE "media" DROP COLUMN "sizes_zoom_url";
  ALTER TABLE "media" DROP COLUMN "sizes_zoom_width";
  ALTER TABLE "media" DROP COLUMN "sizes_zoom_height";
  ALTER TABLE "media" DROP COLUMN "sizes_zoom_mime_type";
  ALTER TABLE "media" DROP COLUMN "sizes_zoom_filesize";
  ALTER TABLE "media" DROP COLUMN "sizes_zoom_filename";
  ALTER TABLE "media" DROP COLUMN "sizes_og_url";
  ALTER TABLE "media" DROP COLUMN "sizes_og_width";
  ALTER TABLE "media" DROP COLUMN "sizes_og_height";
  ALTER TABLE "media" DROP COLUMN "sizes_og_mime_type";
  ALTER TABLE "media" DROP COLUMN "sizes_og_filesize";
  ALTER TABLE "media" DROP COLUMN "sizes_og_filename";
  DROP TYPE "public"."enum_media_shows_person";
  DROP TYPE "public"."enum_media_source";
  DROP TYPE "public"."enum_media_enhance";`)
}
