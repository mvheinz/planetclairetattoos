import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_flash_status" AS ENUM('available', 'claimed');
  CREATE TYPE "public"."enum__flash_v_version_status" AS ENUM('available', 'claimed');
  CREATE TYPE "public"."enum_tattoo_offers_type" AS ENUM('flash_day', 'aktion');
  CREATE TYPE "public"."enum__tattoo_offers_v_version_type" AS ENUM('flash_day', 'aktion');
  CREATE TYPE "public"."enum_tattoo_gallery_kind" AS ENUM('fresh', 'healed');
  CREATE TYPE "public"."enum_tattoo_gallery_consent_scope" AS ENUM('tattoo_only', 'with_face');
  CREATE TABLE "flash" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"number" numeric,
  	"image_id" integer NOT NULL,
  	"size_cm" numeric NOT NULL,
  	"price_cents" numeric NOT NULL,
  	"repeatable" boolean DEFAULT false,
  	"status" "enum_flash_status" DEFAULT 'available' NOT NULL,
  	"claimed_at" timestamp(3) with time zone,
  	"published" boolean DEFAULT true,
  	"sort_order" numeric DEFAULT 100 NOT NULL,
  	"seed" boolean DEFAULT false,
  	"seed_key" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "flash_locales" (
  	"title" varchar NOT NULL,
  	"size_note" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "flash_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"media_id" integer
  );
  
  CREATE TABLE "_flash_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_number" numeric,
  	"version_image_id" integer NOT NULL,
  	"version_size_cm" numeric NOT NULL,
  	"version_price_cents" numeric NOT NULL,
  	"version_repeatable" boolean DEFAULT false,
  	"version_status" "enum__flash_v_version_status" DEFAULT 'available' NOT NULL,
  	"version_claimed_at" timestamp(3) with time zone,
  	"version_published" boolean DEFAULT true,
  	"version_sort_order" numeric DEFAULT 100 NOT NULL,
  	"version_seed" boolean DEFAULT false,
  	"version_seed_key" varchar,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "_flash_v_locales" (
  	"version_title" varchar NOT NULL,
  	"version_size_note" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "_flash_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"media_id" integer
  );
  
  CREATE TABLE "tattoo_offers" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"type" "enum_tattoo_offers_type" DEFAULT 'flash_day' NOT NULL,
  	"starts_at" timestamp(3) with time zone NOT NULL,
  	"ends_at" timestamp(3) with time zone NOT NULL,
  	"image_id" integer,
  	"published" boolean DEFAULT true,
  	"seed" boolean DEFAULT false,
  	"seed_key" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "tattoo_offers_locales" (
  	"title" varchar NOT NULL,
  	"description" varchar NOT NULL,
  	"location_note" varchar,
  	"price_note" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "tattoo_offers_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"flash_id" integer
  );
  
  CREATE TABLE "_tattoo_offers_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_type" "enum__tattoo_offers_v_version_type" DEFAULT 'flash_day' NOT NULL,
  	"version_starts_at" timestamp(3) with time zone NOT NULL,
  	"version_ends_at" timestamp(3) with time zone NOT NULL,
  	"version_image_id" integer,
  	"version_published" boolean DEFAULT true,
  	"version_seed" boolean DEFAULT false,
  	"version_seed_key" varchar,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "_tattoo_offers_v_locales" (
  	"version_title" varchar NOT NULL,
  	"version_description" varchar NOT NULL,
  	"version_location_note" varchar,
  	"version_price_note" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "_tattoo_offers_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"flash_id" integer
  );
  
  CREATE TABLE "tattoo_gallery" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"image_id" integer NOT NULL,
  	"kind" "enum_tattoo_gallery_kind" DEFAULT 'fresh' NOT NULL,
  	"healed_duration_months" numeric,
  	"flash_id" integer,
  	"shows_customer" boolean DEFAULT true,
  	"consent_given" boolean DEFAULT false,
  	"consent_scope" "enum_tattoo_gallery_consent_scope" DEFAULT 'tattoo_only',
  	"consent_date" timestamp(3) with time zone,
  	"consent_note" varchar,
  	"consent_evidence_id" integer,
  	"consent_withdrawn_at" timestamp(3) with time zone,
  	"credit_handle_allowed" boolean DEFAULT false,
  	"credit_handle" varchar,
  	"published" boolean DEFAULT false,
  	"featured" boolean DEFAULT false,
  	"sort_order" numeric DEFAULT 100 NOT NULL,
  	"seed" boolean DEFAULT false,
  	"seed_key" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "tattoo_gallery_locales" (
  	"healed_label" varchar,
  	"caption" varchar,
  	"placement" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "tattoo_gallery_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"media_id" integer
  );
  
  ALTER TABLE "private_uploads" ADD COLUMN "related_gallery_item_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "flash_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "tattoo_offers_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "tattoo_gallery_id" integer;
  ALTER TABLE "flash" ADD CONSTRAINT "flash_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "flash_locales" ADD CONSTRAINT "flash_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."flash"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "flash_rels" ADD CONSTRAINT "flash_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."flash"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "flash_rels" ADD CONSTRAINT "flash_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_flash_v" ADD CONSTRAINT "_flash_v_parent_id_flash_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."flash"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_flash_v" ADD CONSTRAINT "_flash_v_version_image_id_media_id_fk" FOREIGN KEY ("version_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_flash_v_locales" ADD CONSTRAINT "_flash_v_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_flash_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_flash_v_rels" ADD CONSTRAINT "_flash_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_flash_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_flash_v_rels" ADD CONSTRAINT "_flash_v_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "tattoo_offers" ADD CONSTRAINT "tattoo_offers_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "tattoo_offers_locales" ADD CONSTRAINT "tattoo_offers_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."tattoo_offers"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "tattoo_offers_rels" ADD CONSTRAINT "tattoo_offers_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."tattoo_offers"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "tattoo_offers_rels" ADD CONSTRAINT "tattoo_offers_rels_flash_fk" FOREIGN KEY ("flash_id") REFERENCES "public"."flash"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_tattoo_offers_v" ADD CONSTRAINT "_tattoo_offers_v_parent_id_tattoo_offers_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."tattoo_offers"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_tattoo_offers_v" ADD CONSTRAINT "_tattoo_offers_v_version_image_id_media_id_fk" FOREIGN KEY ("version_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_tattoo_offers_v_locales" ADD CONSTRAINT "_tattoo_offers_v_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_tattoo_offers_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_tattoo_offers_v_rels" ADD CONSTRAINT "_tattoo_offers_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_tattoo_offers_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_tattoo_offers_v_rels" ADD CONSTRAINT "_tattoo_offers_v_rels_flash_fk" FOREIGN KEY ("flash_id") REFERENCES "public"."flash"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "tattoo_gallery" ADD CONSTRAINT "tattoo_gallery_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "tattoo_gallery" ADD CONSTRAINT "tattoo_gallery_flash_id_flash_id_fk" FOREIGN KEY ("flash_id") REFERENCES "public"."flash"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "tattoo_gallery" ADD CONSTRAINT "tattoo_gallery_consent_evidence_id_private_uploads_id_fk" FOREIGN KEY ("consent_evidence_id") REFERENCES "public"."private_uploads"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "tattoo_gallery_locales" ADD CONSTRAINT "tattoo_gallery_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."tattoo_gallery"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "tattoo_gallery_rels" ADD CONSTRAINT "tattoo_gallery_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."tattoo_gallery"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "tattoo_gallery_rels" ADD CONSTRAINT "tattoo_gallery_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  CREATE UNIQUE INDEX "flash_number_idx" ON "flash" USING btree ("number");
  CREATE INDEX "flash_image_idx" ON "flash" USING btree ("image_id");
  CREATE INDEX "flash_sort_order_idx" ON "flash" USING btree ("sort_order");
  CREATE INDEX "flash_seed_idx" ON "flash" USING btree ("seed");
  CREATE INDEX "flash_seed_key_idx" ON "flash" USING btree ("seed_key");
  CREATE INDEX "flash_updated_at_idx" ON "flash" USING btree ("updated_at");
  CREATE INDEX "flash_created_at_idx" ON "flash" USING btree ("created_at");
  CREATE INDEX "published_status_idx" ON "flash" USING btree ("published","status");
  CREATE UNIQUE INDEX "flash_locales_locale_parent_id_unique" ON "flash_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "flash_rels_order_idx" ON "flash_rels" USING btree ("order");
  CREATE INDEX "flash_rels_parent_idx" ON "flash_rels" USING btree ("parent_id");
  CREATE INDEX "flash_rels_path_idx" ON "flash_rels" USING btree ("path");
  CREATE INDEX "flash_rels_media_id_idx" ON "flash_rels" USING btree ("media_id");
  CREATE INDEX "_flash_v_parent_idx" ON "_flash_v" USING btree ("parent_id");
  CREATE INDEX "_flash_v_version_version_number_idx" ON "_flash_v" USING btree ("version_number");
  CREATE INDEX "_flash_v_version_version_image_idx" ON "_flash_v" USING btree ("version_image_id");
  CREATE INDEX "_flash_v_version_version_sort_order_idx" ON "_flash_v" USING btree ("version_sort_order");
  CREATE INDEX "_flash_v_version_version_seed_idx" ON "_flash_v" USING btree ("version_seed");
  CREATE INDEX "_flash_v_version_version_seed_key_idx" ON "_flash_v" USING btree ("version_seed_key");
  CREATE INDEX "_flash_v_version_version_updated_at_idx" ON "_flash_v" USING btree ("version_updated_at");
  CREATE INDEX "_flash_v_version_version_created_at_idx" ON "_flash_v" USING btree ("version_created_at");
  CREATE INDEX "_flash_v_created_at_idx" ON "_flash_v" USING btree ("created_at");
  CREATE INDEX "_flash_v_updated_at_idx" ON "_flash_v" USING btree ("updated_at");
  CREATE INDEX "version_published_version_status_idx" ON "_flash_v" USING btree ("version_published","version_status");
  CREATE UNIQUE INDEX "_flash_v_locales_locale_parent_id_unique" ON "_flash_v_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_flash_v_rels_order_idx" ON "_flash_v_rels" USING btree ("order");
  CREATE INDEX "_flash_v_rels_parent_idx" ON "_flash_v_rels" USING btree ("parent_id");
  CREATE INDEX "_flash_v_rels_path_idx" ON "_flash_v_rels" USING btree ("path");
  CREATE INDEX "_flash_v_rels_media_id_idx" ON "_flash_v_rels" USING btree ("media_id");
  CREATE INDEX "tattoo_offers_starts_at_idx" ON "tattoo_offers" USING btree ("starts_at");
  CREATE INDEX "tattoo_offers_ends_at_idx" ON "tattoo_offers" USING btree ("ends_at");
  CREATE INDEX "tattoo_offers_image_idx" ON "tattoo_offers" USING btree ("image_id");
  CREATE INDEX "tattoo_offers_published_idx" ON "tattoo_offers" USING btree ("published");
  CREATE INDEX "tattoo_offers_seed_idx" ON "tattoo_offers" USING btree ("seed");
  CREATE INDEX "tattoo_offers_seed_key_idx" ON "tattoo_offers" USING btree ("seed_key");
  CREATE INDEX "tattoo_offers_updated_at_idx" ON "tattoo_offers" USING btree ("updated_at");
  CREATE INDEX "tattoo_offers_created_at_idx" ON "tattoo_offers" USING btree ("created_at");
  CREATE UNIQUE INDEX "tattoo_offers_locales_locale_parent_id_unique" ON "tattoo_offers_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "tattoo_offers_rels_order_idx" ON "tattoo_offers_rels" USING btree ("order");
  CREATE INDEX "tattoo_offers_rels_parent_idx" ON "tattoo_offers_rels" USING btree ("parent_id");
  CREATE INDEX "tattoo_offers_rels_path_idx" ON "tattoo_offers_rels" USING btree ("path");
  CREATE INDEX "tattoo_offers_rels_flash_id_idx" ON "tattoo_offers_rels" USING btree ("flash_id");
  CREATE INDEX "_tattoo_offers_v_parent_idx" ON "_tattoo_offers_v" USING btree ("parent_id");
  CREATE INDEX "_tattoo_offers_v_version_version_starts_at_idx" ON "_tattoo_offers_v" USING btree ("version_starts_at");
  CREATE INDEX "_tattoo_offers_v_version_version_ends_at_idx" ON "_tattoo_offers_v" USING btree ("version_ends_at");
  CREATE INDEX "_tattoo_offers_v_version_version_image_idx" ON "_tattoo_offers_v" USING btree ("version_image_id");
  CREATE INDEX "_tattoo_offers_v_version_version_published_idx" ON "_tattoo_offers_v" USING btree ("version_published");
  CREATE INDEX "_tattoo_offers_v_version_version_seed_idx" ON "_tattoo_offers_v" USING btree ("version_seed");
  CREATE INDEX "_tattoo_offers_v_version_version_seed_key_idx" ON "_tattoo_offers_v" USING btree ("version_seed_key");
  CREATE INDEX "_tattoo_offers_v_version_version_updated_at_idx" ON "_tattoo_offers_v" USING btree ("version_updated_at");
  CREATE INDEX "_tattoo_offers_v_version_version_created_at_idx" ON "_tattoo_offers_v" USING btree ("version_created_at");
  CREATE INDEX "_tattoo_offers_v_created_at_idx" ON "_tattoo_offers_v" USING btree ("created_at");
  CREATE INDEX "_tattoo_offers_v_updated_at_idx" ON "_tattoo_offers_v" USING btree ("updated_at");
  CREATE UNIQUE INDEX "_tattoo_offers_v_locales_locale_parent_id_unique" ON "_tattoo_offers_v_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_tattoo_offers_v_rels_order_idx" ON "_tattoo_offers_v_rels" USING btree ("order");
  CREATE INDEX "_tattoo_offers_v_rels_parent_idx" ON "_tattoo_offers_v_rels" USING btree ("parent_id");
  CREATE INDEX "_tattoo_offers_v_rels_path_idx" ON "_tattoo_offers_v_rels" USING btree ("path");
  CREATE INDEX "_tattoo_offers_v_rels_flash_id_idx" ON "_tattoo_offers_v_rels" USING btree ("flash_id");
  CREATE INDEX "tattoo_gallery_image_idx" ON "tattoo_gallery" USING btree ("image_id");
  CREATE INDEX "tattoo_gallery_flash_idx" ON "tattoo_gallery" USING btree ("flash_id");
  CREATE INDEX "tattoo_gallery_consent_evidence_idx" ON "tattoo_gallery" USING btree ("consent_evidence_id");
  CREATE INDEX "tattoo_gallery_published_idx" ON "tattoo_gallery" USING btree ("published");
  CREATE INDEX "tattoo_gallery_sort_order_idx" ON "tattoo_gallery" USING btree ("sort_order");
  CREATE INDEX "tattoo_gallery_seed_idx" ON "tattoo_gallery" USING btree ("seed");
  CREATE INDEX "tattoo_gallery_seed_key_idx" ON "tattoo_gallery" USING btree ("seed_key");
  CREATE INDEX "tattoo_gallery_updated_at_idx" ON "tattoo_gallery" USING btree ("updated_at");
  CREATE INDEX "tattoo_gallery_created_at_idx" ON "tattoo_gallery" USING btree ("created_at");
  CREATE UNIQUE INDEX "tattoo_gallery_locales_locale_parent_id_unique" ON "tattoo_gallery_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "tattoo_gallery_rels_order_idx" ON "tattoo_gallery_rels" USING btree ("order");
  CREATE INDEX "tattoo_gallery_rels_parent_idx" ON "tattoo_gallery_rels" USING btree ("parent_id");
  CREATE INDEX "tattoo_gallery_rels_path_idx" ON "tattoo_gallery_rels" USING btree ("path");
  CREATE INDEX "tattoo_gallery_rels_media_id_idx" ON "tattoo_gallery_rels" USING btree ("media_id");
  ALTER TABLE "private_uploads" ADD CONSTRAINT "private_uploads_related_gallery_item_id_tattoo_gallery_id_fk" FOREIGN KEY ("related_gallery_item_id") REFERENCES "public"."tattoo_gallery"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_flash_fk" FOREIGN KEY ("flash_id") REFERENCES "public"."flash"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_tattoo_offers_fk" FOREIGN KEY ("tattoo_offers_id") REFERENCES "public"."tattoo_offers"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_tattoo_gallery_fk" FOREIGN KEY ("tattoo_gallery_id") REFERENCES "public"."tattoo_gallery"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "private_uploads_related_gallery_item_idx" ON "private_uploads" USING btree ("related_gallery_item_id");
  CREATE INDEX "payload_locked_documents_rels_flash_id_idx" ON "payload_locked_documents_rels" USING btree ("flash_id");
  CREATE INDEX "payload_locked_documents_rels_tattoo_offers_id_idx" ON "payload_locked_documents_rels" USING btree ("tattoo_offers_id");
  CREATE INDEX "payload_locked_documents_rels_tattoo_gallery_id_idx" ON "payload_locked_documents_rels" USING btree ("tattoo_gallery_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "flash" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "flash_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "flash_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_flash_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_flash_v_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_flash_v_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "tattoo_offers" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "tattoo_offers_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "tattoo_offers_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_tattoo_offers_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_tattoo_offers_v_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_tattoo_offers_v_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "tattoo_gallery" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "tattoo_gallery_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "tattoo_gallery_rels" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "flash" CASCADE;
  DROP TABLE "flash_locales" CASCADE;
  DROP TABLE "flash_rels" CASCADE;
  DROP TABLE "_flash_v" CASCADE;
  DROP TABLE "_flash_v_locales" CASCADE;
  DROP TABLE "_flash_v_rels" CASCADE;
  DROP TABLE "tattoo_offers" CASCADE;
  DROP TABLE "tattoo_offers_locales" CASCADE;
  DROP TABLE "tattoo_offers_rels" CASCADE;
  DROP TABLE "_tattoo_offers_v" CASCADE;
  DROP TABLE "_tattoo_offers_v_locales" CASCADE;
  DROP TABLE "_tattoo_offers_v_rels" CASCADE;
  DROP TABLE "tattoo_gallery" CASCADE;
  DROP TABLE "tattoo_gallery_locales" CASCADE;
  DROP TABLE "tattoo_gallery_rels" CASCADE;
  ALTER TABLE "private_uploads" DROP CONSTRAINT "private_uploads_related_gallery_item_id_tattoo_gallery_id_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_flash_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_tattoo_offers_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_tattoo_gallery_fk";
  
  DROP INDEX "private_uploads_related_gallery_item_idx";
  DROP INDEX "payload_locked_documents_rels_flash_id_idx";
  DROP INDEX "payload_locked_documents_rels_tattoo_offers_id_idx";
  DROP INDEX "payload_locked_documents_rels_tattoo_gallery_id_idx";
  ALTER TABLE "private_uploads" DROP COLUMN "related_gallery_item_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "flash_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "tattoo_offers_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "tattoo_gallery_id";
  DROP TYPE "public"."enum_flash_status";
  DROP TYPE "public"."enum__flash_v_version_status";
  DROP TYPE "public"."enum_tattoo_offers_type";
  DROP TYPE "public"."enum__tattoo_offers_v_version_type";
  DROP TYPE "public"."enum_tattoo_gallery_kind";
  DROP TYPE "public"."enum_tattoo_gallery_consent_scope";`)
}
