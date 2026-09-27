import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_categories_key" AS ENUM('keramik', 'textil', 'cap', 'zeichnung', 'schmuck', 'sonstiges');
  CREATE TYPE "public"."enum__categories_v_version_key" AS ENUM('keramik', 'textil', 'cap', 'zeichnung', 'schmuck', 'sonstiges');
  CREATE TYPE "public"."enum_conformity_declarations_status" AS ENUM('active', 'revoked');
  CREATE TYPE "public"."enum__conformity_declarations_v_version_status" AS ENUM('active', 'revoked');
  CREATE TABLE "categories" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" "enum_categories_key" NOT NULL,
  	"cover_image_id" integer,
  	"sort_order" numeric DEFAULT 100 NOT NULL,
  	"show_in_navigation" boolean,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "categories_locales" (
  	"name" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"intro" varchar,
  	"seo_meta_title" varchar,
  	"seo_meta_description" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "_categories_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_key" "enum__categories_v_version_key" NOT NULL,
  	"version_cover_image_id" integer,
  	"version_sort_order" numeric DEFAULT 100 NOT NULL,
  	"version_show_in_navigation" boolean,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "_categories_v_locales" (
  	"version_name" varchar NOT NULL,
  	"version_slug" varchar NOT NULL,
  	"version_intro" varchar,
  	"version_seo_meta_title" varchar,
  	"version_seo_meta_description" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "conformity_declarations" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"glaze_manufacturer" varchar,
  	"glaze_product" varchar,
  	"lead_cadmium_free_by_manufacturer" boolean DEFAULT false,
  	"lab_name" varchar NOT NULL,
  	"lab_report_date" timestamp(3) with time zone NOT NULL,
  	"lab_report_id" integer NOT NULL,
  	"declaration_pdf_id" integer NOT NULL,
  	"valid_from" timestamp(3) with time zone NOT NULL,
  	"status" "enum_conformity_declarations_status" DEFAULT 'active' NOT NULL,
  	"notes" varchar,
  	"seed" boolean DEFAULT false,
  	"seed_key" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "conformity_declarations_locales" (
  	"name" varchar NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "_conformity_declarations_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_glaze_manufacturer" varchar,
  	"version_glaze_product" varchar,
  	"version_lead_cadmium_free_by_manufacturer" boolean DEFAULT false,
  	"version_lab_name" varchar NOT NULL,
  	"version_lab_report_date" timestamp(3) with time zone NOT NULL,
  	"version_lab_report_id" integer NOT NULL,
  	"version_declaration_pdf_id" integer NOT NULL,
  	"version_valid_from" timestamp(3) with time zone NOT NULL,
  	"version_status" "enum__conformity_declarations_v_version_status" DEFAULT 'active' NOT NULL,
  	"version_notes" varchar,
  	"version_seed" boolean DEFAULT false,
  	"version_seed_key" varchar,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "_conformity_declarations_v_locales" (
  	"version_name" varchar NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  ALTER TABLE "private_uploads" ADD COLUMN "related_declaration_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "categories_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "conformity_declarations_id" integer;
  ALTER TABLE "categories" ADD CONSTRAINT "categories_cover_image_id_media_id_fk" FOREIGN KEY ("cover_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "categories_locales" ADD CONSTRAINT "categories_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_categories_v" ADD CONSTRAINT "_categories_v_parent_id_categories_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_categories_v" ADD CONSTRAINT "_categories_v_version_cover_image_id_media_id_fk" FOREIGN KEY ("version_cover_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_categories_v_locales" ADD CONSTRAINT "_categories_v_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_categories_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "conformity_declarations" ADD CONSTRAINT "conformity_declarations_lab_report_id_private_uploads_id_fk" FOREIGN KEY ("lab_report_id") REFERENCES "public"."private_uploads"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "conformity_declarations" ADD CONSTRAINT "conformity_declarations_declaration_pdf_id_documents_id_fk" FOREIGN KEY ("declaration_pdf_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "conformity_declarations_locales" ADD CONSTRAINT "conformity_declarations_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."conformity_declarations"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_conformity_declarations_v" ADD CONSTRAINT "_conformity_declarations_v_parent_id_conformity_declarations_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."conformity_declarations"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_conformity_declarations_v" ADD CONSTRAINT "_conformity_declarations_v_version_lab_report_id_private_uploads_id_fk" FOREIGN KEY ("version_lab_report_id") REFERENCES "public"."private_uploads"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_conformity_declarations_v" ADD CONSTRAINT "_conformity_declarations_v_version_declaration_pdf_id_documents_id_fk" FOREIGN KEY ("version_declaration_pdf_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_conformity_declarations_v_locales" ADD CONSTRAINT "_conformity_declarations_v_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_conformity_declarations_v"("id") ON DELETE cascade ON UPDATE no action;
  CREATE UNIQUE INDEX "categories_key_idx" ON "categories" USING btree ("key");
  CREATE INDEX "categories_cover_image_idx" ON "categories" USING btree ("cover_image_id");
  CREATE INDEX "categories_sort_order_idx" ON "categories" USING btree ("sort_order");
  CREATE INDEX "categories_updated_at_idx" ON "categories" USING btree ("updated_at");
  CREATE INDEX "categories_created_at_idx" ON "categories" USING btree ("created_at");
  CREATE UNIQUE INDEX "categories_slug_idx" ON "categories_locales" USING btree ("slug","_locale");
  CREATE UNIQUE INDEX "categories_locales_locale_parent_id_unique" ON "categories_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_categories_v_parent_idx" ON "_categories_v" USING btree ("parent_id");
  CREATE INDEX "_categories_v_version_version_key_idx" ON "_categories_v" USING btree ("version_key");
  CREATE INDEX "_categories_v_version_version_cover_image_idx" ON "_categories_v" USING btree ("version_cover_image_id");
  CREATE INDEX "_categories_v_version_version_sort_order_idx" ON "_categories_v" USING btree ("version_sort_order");
  CREATE INDEX "_categories_v_version_version_updated_at_idx" ON "_categories_v" USING btree ("version_updated_at");
  CREATE INDEX "_categories_v_version_version_created_at_idx" ON "_categories_v" USING btree ("version_created_at");
  CREATE INDEX "_categories_v_created_at_idx" ON "_categories_v" USING btree ("created_at");
  CREATE INDEX "_categories_v_updated_at_idx" ON "_categories_v" USING btree ("updated_at");
  CREATE INDEX "_categories_v_version_version_slug_idx" ON "_categories_v_locales" USING btree ("version_slug","_locale");
  CREATE UNIQUE INDEX "_categories_v_locales_locale_parent_id_unique" ON "_categories_v_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "conformity_declarations_lab_report_idx" ON "conformity_declarations" USING btree ("lab_report_id");
  CREATE INDEX "conformity_declarations_declaration_pdf_idx" ON "conformity_declarations" USING btree ("declaration_pdf_id");
  CREATE INDEX "conformity_declarations_status_idx" ON "conformity_declarations" USING btree ("status");
  CREATE INDEX "conformity_declarations_seed_idx" ON "conformity_declarations" USING btree ("seed");
  CREATE INDEX "conformity_declarations_seed_key_idx" ON "conformity_declarations" USING btree ("seed_key");
  CREATE INDEX "conformity_declarations_updated_at_idx" ON "conformity_declarations" USING btree ("updated_at");
  CREATE INDEX "conformity_declarations_created_at_idx" ON "conformity_declarations" USING btree ("created_at");
  CREATE UNIQUE INDEX "conformity_declarations_locales_locale_parent_id_unique" ON "conformity_declarations_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_conformity_declarations_v_parent_idx" ON "_conformity_declarations_v" USING btree ("parent_id");
  CREATE INDEX "_conformity_declarations_v_version_version_lab_report_idx" ON "_conformity_declarations_v" USING btree ("version_lab_report_id");
  CREATE INDEX "_conformity_declarations_v_version_version_declaration_p_idx" ON "_conformity_declarations_v" USING btree ("version_declaration_pdf_id");
  CREATE INDEX "_conformity_declarations_v_version_version_status_idx" ON "_conformity_declarations_v" USING btree ("version_status");
  CREATE INDEX "_conformity_declarations_v_version_version_seed_idx" ON "_conformity_declarations_v" USING btree ("version_seed");
  CREATE INDEX "_conformity_declarations_v_version_version_seed_key_idx" ON "_conformity_declarations_v" USING btree ("version_seed_key");
  CREATE INDEX "_conformity_declarations_v_version_version_updated_at_idx" ON "_conformity_declarations_v" USING btree ("version_updated_at");
  CREATE INDEX "_conformity_declarations_v_version_version_created_at_idx" ON "_conformity_declarations_v" USING btree ("version_created_at");
  CREATE INDEX "_conformity_declarations_v_created_at_idx" ON "_conformity_declarations_v" USING btree ("created_at");
  CREATE INDEX "_conformity_declarations_v_updated_at_idx" ON "_conformity_declarations_v" USING btree ("updated_at");
  CREATE UNIQUE INDEX "_conformity_declarations_v_locales_locale_parent_id_unique" ON "_conformity_declarations_v_locales" USING btree ("_locale","_parent_id");
  ALTER TABLE "private_uploads" ADD CONSTRAINT "private_uploads_related_declaration_id_conformity_declarations_id_fk" FOREIGN KEY ("related_declaration_id") REFERENCES "public"."conformity_declarations"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_categories_fk" FOREIGN KEY ("categories_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_conformity_declarations_fk" FOREIGN KEY ("conformity_declarations_id") REFERENCES "public"."conformity_declarations"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "private_uploads_related_declaration_idx" ON "private_uploads" USING btree ("related_declaration_id");
  CREATE INDEX "payload_locked_documents_rels_categories_id_idx" ON "payload_locked_documents_rels" USING btree ("categories_id");
  CREATE INDEX "payload_locked_documents_rels_conformity_declarations_id_idx" ON "payload_locked_documents_rels" USING btree ("conformity_declarations_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "categories" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "categories_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_categories_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_categories_v_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "conformity_declarations" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "conformity_declarations_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_conformity_declarations_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_conformity_declarations_v_locales" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "categories" CASCADE;
  DROP TABLE "categories_locales" CASCADE;
  DROP TABLE "_categories_v" CASCADE;
  DROP TABLE "_categories_v_locales" CASCADE;
  DROP TABLE "conformity_declarations" CASCADE;
  DROP TABLE "conformity_declarations_locales" CASCADE;
  DROP TABLE "_conformity_declarations_v" CASCADE;
  DROP TABLE "_conformity_declarations_v_locales" CASCADE;
  ALTER TABLE "private_uploads" DROP CONSTRAINT "private_uploads_related_declaration_id_conformity_declarations_id_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_categories_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_conformity_declarations_fk";
  
  DROP INDEX "private_uploads_related_declaration_idx";
  DROP INDEX "payload_locked_documents_rels_categories_id_idx";
  DROP INDEX "payload_locked_documents_rels_conformity_declarations_id_idx";
  ALTER TABLE "private_uploads" DROP COLUMN "related_declaration_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "categories_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "conformity_declarations_id";
  DROP TYPE "public"."enum_categories_key";
  DROP TYPE "public"."enum__categories_v_version_key";
  DROP TYPE "public"."enum_conformity_declarations_status";
  DROP TYPE "public"."enum__conformity_declarations_v_version_status";`)
}
