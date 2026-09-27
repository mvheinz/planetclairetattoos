import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_legal_texts_type" AS ENUM('impressum', 'datenschutz', 'agb', 'widerrufsbelehrung', 'widerrufsformular', 'versand-zahlung');
  CREATE TYPE "public"."enum_legal_texts_status" AS ENUM('draft', 'scheduled', 'active', 'superseded');
  CREATE TYPE "public"."enum_legal_texts_origin" AS ENUM('placeholder', 'draft', 'lawyer');
  CREATE TYPE "public"."enum_legal_texts_source" AS ENUM('manual', 'itrk_lti');
  CREATE TABLE "legal_texts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"type" "enum_legal_texts_type" NOT NULL,
  	"version" numeric,
  	"version_label" varchar,
  	"status" "enum_legal_texts_status" DEFAULT 'draft' NOT NULL,
  	"valid_from" timestamp(3) with time zone NOT NULL,
  	"origin" "enum_legal_texts_origin" DEFAULT 'draft' NOT NULL,
  	"is_placeholder" boolean DEFAULT false,
  	"source" "enum_legal_texts_source" DEFAULT 'manual' NOT NULL,
  	"source_note" varchar,
  	"change_note" varchar,
  	"pdf_de_id" integer,
  	"pdf_en_id" integer,
  	"content_sha256_de" varchar,
  	"content_sha256_en" varchar,
  	"activated_at" timestamp(3) with time zone,
  	"superseded_at" timestamp(3) with time zone,
  	"seed" boolean DEFAULT false,
  	"seed_key" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "legal_texts_locales" (
  	"content" jsonb,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  ALTER TABLE "checkouts" ADD COLUMN "legal_text_versions_agb_id" integer;
  ALTER TABLE "checkouts" ADD COLUMN "legal_text_versions_widerrufsbelehrung_id" integer;
  ALTER TABLE "checkouts" ADD COLUMN "legal_text_versions_widerrufsformular_id" integer;
  ALTER TABLE "checkouts" ADD COLUMN "legal_text_versions_datenschutz_id" integer;
  ALTER TABLE "checkouts" ADD COLUMN "legal_text_versions_versand_zahlung_id" integer;
  ALTER TABLE "orders" ADD COLUMN "legal_text_versions_agb_id" integer NOT NULL;
  ALTER TABLE "orders" ADD COLUMN "legal_text_versions_widerrufsbelehrung_id" integer NOT NULL;
  ALTER TABLE "orders" ADD COLUMN "legal_text_versions_widerrufsformular_id" integer NOT NULL;
  ALTER TABLE "orders" ADD COLUMN "legal_text_versions_datenschutz_id" integer NOT NULL;
  ALTER TABLE "orders" ADD COLUMN "legal_text_versions_versand_zahlung_id" integer NOT NULL;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "legal_texts_id" integer;
  ALTER TABLE "legal_texts" ADD CONSTRAINT "legal_texts_pdf_de_id_documents_id_fk" FOREIGN KEY ("pdf_de_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "legal_texts" ADD CONSTRAINT "legal_texts_pdf_en_id_documents_id_fk" FOREIGN KEY ("pdf_en_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "legal_texts_locales" ADD CONSTRAINT "legal_texts_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."legal_texts"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "legal_texts_type_idx" ON "legal_texts" USING btree ("type");
  CREATE INDEX "legal_texts_status_idx" ON "legal_texts" USING btree ("status");
  CREATE INDEX "legal_texts_pdf_de_idx" ON "legal_texts" USING btree ("pdf_de_id");
  CREATE INDEX "legal_texts_pdf_en_idx" ON "legal_texts" USING btree ("pdf_en_id");
  CREATE INDEX "legal_texts_seed_idx" ON "legal_texts" USING btree ("seed");
  CREATE INDEX "legal_texts_seed_key_idx" ON "legal_texts" USING btree ("seed_key");
  CREATE INDEX "legal_texts_updated_at_idx" ON "legal_texts" USING btree ("updated_at");
  CREATE INDEX "legal_texts_created_at_idx" ON "legal_texts" USING btree ("created_at");
  CREATE UNIQUE INDEX "type_version_idx" ON "legal_texts" USING btree ("type","version");
  CREATE UNIQUE INDEX "legal_texts_locales_locale_parent_id_unique" ON "legal_texts_locales" USING btree ("_locale","_parent_id");
  ALTER TABLE "checkouts" ADD CONSTRAINT "checkouts_legal_text_versions_agb_id_legal_texts_id_fk" FOREIGN KEY ("legal_text_versions_agb_id") REFERENCES "public"."legal_texts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "checkouts" ADD CONSTRAINT "checkouts_legal_text_versions_widerrufsbelehrung_id_legal_texts_id_fk" FOREIGN KEY ("legal_text_versions_widerrufsbelehrung_id") REFERENCES "public"."legal_texts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "checkouts" ADD CONSTRAINT "checkouts_legal_text_versions_widerrufsformular_id_legal_texts_id_fk" FOREIGN KEY ("legal_text_versions_widerrufsformular_id") REFERENCES "public"."legal_texts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "checkouts" ADD CONSTRAINT "checkouts_legal_text_versions_datenschutz_id_legal_texts_id_fk" FOREIGN KEY ("legal_text_versions_datenschutz_id") REFERENCES "public"."legal_texts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "checkouts" ADD CONSTRAINT "checkouts_legal_text_versions_versand_zahlung_id_legal_texts_id_fk" FOREIGN KEY ("legal_text_versions_versand_zahlung_id") REFERENCES "public"."legal_texts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "orders" ADD CONSTRAINT "orders_legal_text_versions_agb_id_legal_texts_id_fk" FOREIGN KEY ("legal_text_versions_agb_id") REFERENCES "public"."legal_texts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "orders" ADD CONSTRAINT "orders_legal_text_versions_widerrufsbelehrung_id_legal_texts_id_fk" FOREIGN KEY ("legal_text_versions_widerrufsbelehrung_id") REFERENCES "public"."legal_texts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "orders" ADD CONSTRAINT "orders_legal_text_versions_widerrufsformular_id_legal_texts_id_fk" FOREIGN KEY ("legal_text_versions_widerrufsformular_id") REFERENCES "public"."legal_texts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "orders" ADD CONSTRAINT "orders_legal_text_versions_datenschutz_id_legal_texts_id_fk" FOREIGN KEY ("legal_text_versions_datenschutz_id") REFERENCES "public"."legal_texts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "orders" ADD CONSTRAINT "orders_legal_text_versions_versand_zahlung_id_legal_texts_id_fk" FOREIGN KEY ("legal_text_versions_versand_zahlung_id") REFERENCES "public"."legal_texts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_legal_texts_fk" FOREIGN KEY ("legal_texts_id") REFERENCES "public"."legal_texts"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "checkouts_legal_text_versions_legal_text_versions_agb_idx" ON "checkouts" USING btree ("legal_text_versions_agb_id");
  CREATE INDEX "checkouts_legal_text_versions_legal_text_versions_widerr_idx" ON "checkouts" USING btree ("legal_text_versions_widerrufsbelehrung_id");
  CREATE INDEX "checkouts_legal_text_versions_legal_text_versions_wide_1_idx" ON "checkouts" USING btree ("legal_text_versions_widerrufsformular_id");
  CREATE INDEX "checkouts_legal_text_versions_legal_text_versions_datens_idx" ON "checkouts" USING btree ("legal_text_versions_datenschutz_id");
  CREATE INDEX "checkouts_legal_text_versions_legal_text_versions_versan_idx" ON "checkouts" USING btree ("legal_text_versions_versand_zahlung_id");
  CREATE INDEX "orders_legal_text_versions_legal_text_versions_agb_idx" ON "orders" USING btree ("legal_text_versions_agb_id");
  CREATE INDEX "orders_legal_text_versions_legal_text_versions_widerrufs_idx" ON "orders" USING btree ("legal_text_versions_widerrufsbelehrung_id");
  CREATE INDEX "orders_legal_text_versions_legal_text_versions_widerru_1_idx" ON "orders" USING btree ("legal_text_versions_widerrufsformular_id");
  CREATE INDEX "orders_legal_text_versions_legal_text_versions_datenschu_idx" ON "orders" USING btree ("legal_text_versions_datenschutz_id");
  CREATE INDEX "orders_legal_text_versions_legal_text_versions_versand_z_idx" ON "orders" USING btree ("legal_text_versions_versand_zahlung_id");
  CREATE INDEX "payload_locked_documents_rels_legal_texts_id_idx" ON "payload_locked_documents_rels" USING btree ("legal_texts_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "legal_texts" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "legal_texts_locales" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "legal_texts" CASCADE;
  DROP TABLE "legal_texts_locales" CASCADE;
  ALTER TABLE "checkouts" DROP CONSTRAINT "checkouts_legal_text_versions_agb_id_legal_texts_id_fk";
  
  ALTER TABLE "checkouts" DROP CONSTRAINT "checkouts_legal_text_versions_widerrufsbelehrung_id_legal_texts_id_fk";
  
  ALTER TABLE "checkouts" DROP CONSTRAINT "checkouts_legal_text_versions_widerrufsformular_id_legal_texts_id_fk";
  
  ALTER TABLE "checkouts" DROP CONSTRAINT "checkouts_legal_text_versions_datenschutz_id_legal_texts_id_fk";
  
  ALTER TABLE "checkouts" DROP CONSTRAINT "checkouts_legal_text_versions_versand_zahlung_id_legal_texts_id_fk";
  
  ALTER TABLE "orders" DROP CONSTRAINT "orders_legal_text_versions_agb_id_legal_texts_id_fk";
  
  ALTER TABLE "orders" DROP CONSTRAINT "orders_legal_text_versions_widerrufsbelehrung_id_legal_texts_id_fk";
  
  ALTER TABLE "orders" DROP CONSTRAINT "orders_legal_text_versions_widerrufsformular_id_legal_texts_id_fk";
  
  ALTER TABLE "orders" DROP CONSTRAINT "orders_legal_text_versions_datenschutz_id_legal_texts_id_fk";
  
  ALTER TABLE "orders" DROP CONSTRAINT "orders_legal_text_versions_versand_zahlung_id_legal_texts_id_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_legal_texts_fk";
  
  DROP INDEX "checkouts_legal_text_versions_legal_text_versions_agb_idx";
  DROP INDEX "checkouts_legal_text_versions_legal_text_versions_widerr_idx";
  DROP INDEX "checkouts_legal_text_versions_legal_text_versions_wide_1_idx";
  DROP INDEX "checkouts_legal_text_versions_legal_text_versions_datens_idx";
  DROP INDEX "checkouts_legal_text_versions_legal_text_versions_versan_idx";
  DROP INDEX "orders_legal_text_versions_legal_text_versions_agb_idx";
  DROP INDEX "orders_legal_text_versions_legal_text_versions_widerrufs_idx";
  DROP INDEX "orders_legal_text_versions_legal_text_versions_widerru_1_idx";
  DROP INDEX "orders_legal_text_versions_legal_text_versions_datenschu_idx";
  DROP INDEX "orders_legal_text_versions_legal_text_versions_versand_z_idx";
  DROP INDEX "payload_locked_documents_rels_legal_texts_id_idx";
  ALTER TABLE "checkouts" DROP COLUMN "legal_text_versions_agb_id";
  ALTER TABLE "checkouts" DROP COLUMN "legal_text_versions_widerrufsbelehrung_id";
  ALTER TABLE "checkouts" DROP COLUMN "legal_text_versions_widerrufsformular_id";
  ALTER TABLE "checkouts" DROP COLUMN "legal_text_versions_datenschutz_id";
  ALTER TABLE "checkouts" DROP COLUMN "legal_text_versions_versand_zahlung_id";
  ALTER TABLE "orders" DROP COLUMN "legal_text_versions_agb_id";
  ALTER TABLE "orders" DROP COLUMN "legal_text_versions_widerrufsbelehrung_id";
  ALTER TABLE "orders" DROP COLUMN "legal_text_versions_widerrufsformular_id";
  ALTER TABLE "orders" DROP COLUMN "legal_text_versions_datenschutz_id";
  ALTER TABLE "orders" DROP COLUMN "legal_text_versions_versand_zahlung_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "legal_texts_id";
  DROP TYPE "public"."enum_legal_texts_type";
  DROP TYPE "public"."enum_legal_texts_status";
  DROP TYPE "public"."enum_legal_texts_origin";
  DROP TYPE "public"."enum_legal_texts_source";`)
}
