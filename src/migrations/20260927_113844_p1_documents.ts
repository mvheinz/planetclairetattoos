import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_documents_kind" AS ENUM('legal_text_pdf', 'conformity_declaration', 'aftercare_pdf', 'other');
  CREATE TYPE "public"."enum_documents_language" AS ENUM('de', 'en');
  CREATE TYPE "public"."enum_private_uploads_purpose" AS ENUM('commission_reference', 'packing_photo', 'return_photo', 'complaint_photo', 'nickel_evidence', 'lab_report', 'consent_evidence', 'supplier_document', 'technical_file', 'invoice_pdf', 'credit_note_pdf', 'monthly_export', 'data_export', 'processor_agreement');
  CREATE TYPE "public"."enum_private_uploads_status" AS ENUM('pending', 'attached');
  CREATE TYPE "public"."enum_private_uploads_compliance_category" AS ENUM('keramik', 'textil', 'cap', 'zeichnung', 'schmuck', 'sonstiges');
  CREATE TABLE "documents" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"kind" "enum_documents_kind" DEFAULT 'other' NOT NULL,
  	"language" "enum_documents_language",
  	"sha256" varchar,
  	"seed" boolean DEFAULT false,
  	"seed_key" varchar,
  	"prefix" varchar DEFAULT 'documents',
  	"_objectkey" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"url" varchar,
  	"thumbnail_u_r_l" varchar,
  	"filename" varchar,
  	"mime_type" varchar,
  	"filesize" numeric,
  	"width" numeric,
  	"height" numeric,
  	"focal_x" numeric,
  	"focal_y" numeric
  );
  
  CREATE TABLE "documents_locales" (
  	"title" varchar NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "private_uploads" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"purpose" "enum_private_uploads_purpose" NOT NULL,
  	"status" "enum_private_uploads_status" DEFAULT 'attached' NOT NULL,
  	"delete_after" timestamp(3) with time zone,
  	"retain_until" timestamp(3) with time zone,
  	"sha256" varchar,
  	"compliance_category" "enum_private_uploads_compliance_category",
  	"document_version" varchar,
  	"document_date" timestamp(3) with time zone,
  	"note" varchar,
  	"seed" boolean DEFAULT false,
  	"seed_key" varchar,
  	"prefix" varchar DEFAULT 'private',
  	"_objectkey" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"url" varchar,
  	"thumbnail_u_r_l" varchar,
  	"filename" varchar,
  	"mime_type" varchar,
  	"filesize" numeric,
  	"width" numeric,
  	"height" numeric,
  	"focal_x" numeric,
  	"focal_y" numeric,
  	"sizes_thumb_url" varchar,
  	"sizes_thumb_width" numeric,
  	"sizes_thumb_height" numeric,
  	"sizes_thumb_mime_type" varchar,
  	"sizes_thumb_filesize" numeric,
  	"sizes_thumb_filename" varchar
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "documents_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "private_uploads_id" integer;
  ALTER TABLE "documents_locales" ADD CONSTRAINT "documents_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "documents_kind_idx" ON "documents" USING btree ("kind");
  CREATE INDEX "documents_seed_idx" ON "documents" USING btree ("seed");
  CREATE INDEX "documents_seed_key_idx" ON "documents" USING btree ("seed_key");
  CREATE INDEX "documents_updated_at_idx" ON "documents" USING btree ("updated_at");
  CREATE INDEX "documents_created_at_idx" ON "documents" USING btree ("created_at");
  CREATE UNIQUE INDEX "documents_filename_idx" ON "documents" USING btree ("filename");
  CREATE UNIQUE INDEX "documents_locales_locale_parent_id_unique" ON "documents_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "private_uploads_purpose_idx" ON "private_uploads" USING btree ("purpose");
  CREATE INDEX "private_uploads_status_idx" ON "private_uploads" USING btree ("status");
  CREATE INDEX "private_uploads_delete_after_idx" ON "private_uploads" USING btree ("delete_after");
  CREATE INDEX "private_uploads_seed_idx" ON "private_uploads" USING btree ("seed");
  CREATE INDEX "private_uploads_seed_key_idx" ON "private_uploads" USING btree ("seed_key");
  CREATE INDEX "private_uploads_updated_at_idx" ON "private_uploads" USING btree ("updated_at");
  CREATE INDEX "private_uploads_created_at_idx" ON "private_uploads" USING btree ("created_at");
  CREATE UNIQUE INDEX "private_uploads_filename_idx" ON "private_uploads" USING btree ("filename");
  CREATE INDEX "private_uploads_sizes_thumb_sizes_thumb_filename_idx" ON "private_uploads" USING btree ("sizes_thumb_filename");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_documents_fk" FOREIGN KEY ("documents_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_private_uploads_fk" FOREIGN KEY ("private_uploads_id") REFERENCES "public"."private_uploads"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_documents_id_idx" ON "payload_locked_documents_rels" USING btree ("documents_id");
  CREATE INDEX "payload_locked_documents_rels_private_uploads_id_idx" ON "payload_locked_documents_rels" USING btree ("private_uploads_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "documents" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "documents_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "private_uploads" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "documents" CASCADE;
  DROP TABLE "documents_locales" CASCADE;
  DROP TABLE "private_uploads" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_documents_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_private_uploads_fk";
  
  DROP INDEX "payload_locked_documents_rels_documents_id_idx";
  DROP INDEX "payload_locked_documents_rels_private_uploads_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "documents_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "private_uploads_id";
  DROP TYPE "public"."enum_documents_kind";
  DROP TYPE "public"."enum_documents_language";
  DROP TYPE "public"."enum_private_uploads_purpose";
  DROP TYPE "public"."enum_private_uploads_status";
  DROP TYPE "public"."enum_private_uploads_compliance_category";`)
}
