import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_tour_dates_status" AS ENUM('planned', 'cancelled', 'past');
  CREATE TABLE "tour_dates" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"starts_at" timestamp(3) with time zone NOT NULL,
  	"ends_at" timestamp(3) with time zone,
  	"address" varchar,
  	"link" varchar,
  	"stand_number" varchar,
  	"time_from" varchar,
  	"time_to" varchar,
  	"image_id" integer,
  	"status" "enum_tour_dates_status" DEFAULT 'planned' NOT NULL,
  	"published" boolean DEFAULT true,
  	"seed" boolean DEFAULT false,
  	"seed_key" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "tour_dates_locales" (
  	"name" varchar NOT NULL,
  	"place" varchar NOT NULL,
  	"note" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "tour_dates_id" integer;
  ALTER TABLE "tour_dates" ADD CONSTRAINT "tour_dates_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "tour_dates_locales" ADD CONSTRAINT "tour_dates_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."tour_dates"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "tour_dates_starts_at_idx" ON "tour_dates" USING btree ("starts_at");
  CREATE INDEX "tour_dates_ends_at_idx" ON "tour_dates" USING btree ("ends_at");
  CREATE INDEX "tour_dates_image_idx" ON "tour_dates" USING btree ("image_id");
  CREATE INDEX "tour_dates_published_idx" ON "tour_dates" USING btree ("published");
  CREATE INDEX "tour_dates_seed_idx" ON "tour_dates" USING btree ("seed");
  CREATE INDEX "tour_dates_seed_key_idx" ON "tour_dates" USING btree ("seed_key");
  CREATE INDEX "tour_dates_updated_at_idx" ON "tour_dates" USING btree ("updated_at");
  CREATE INDEX "tour_dates_created_at_idx" ON "tour_dates" USING btree ("created_at");
  CREATE INDEX "published_endsAt_idx" ON "tour_dates" USING btree ("published","ends_at");
  CREATE UNIQUE INDEX "tour_dates_locales_locale_parent_id_unique" ON "tour_dates_locales" USING btree ("_locale","_parent_id");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_tour_dates_fk" FOREIGN KEY ("tour_dates_id") REFERENCES "public"."tour_dates"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_tour_dates_id_idx" ON "payload_locked_documents_rels" USING btree ("tour_dates_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "tour_dates" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "tour_dates_locales" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "tour_dates" CASCADE;
  DROP TABLE "tour_dates_locales" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_tour_dates_fk";
  
  DROP INDEX "payload_locked_documents_rels_tour_dates_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "tour_dates_id";
  DROP TYPE "public"."enum_tour_dates_status";`)
}
