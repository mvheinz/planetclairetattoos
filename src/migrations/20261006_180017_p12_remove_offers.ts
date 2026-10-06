import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Handarbeit gegenüber der Vorlage: `DROP CONSTRAINT IF EXISTS` (DROP TABLE … CASCADE entfernt den Fremdschlüssel schon).
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "tattoo_offers" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "tattoo_offers_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "tattoo_offers_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_tattoo_offers_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_tattoo_offers_v_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_tattoo_offers_v_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pages_blocks_offers_list" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pages_blocks_offers_list_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_pages_v_blocks_offers_list" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_pages_v_blocks_offers_list_locales" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "tattoo_offers" CASCADE;
  DROP TABLE "tattoo_offers_locales" CASCADE;
  DROP TABLE "tattoo_offers_rels" CASCADE;
  DROP TABLE "_tattoo_offers_v" CASCADE;
  DROP TABLE "_tattoo_offers_v_locales" CASCADE;
  DROP TABLE "_tattoo_offers_v_rels" CASCADE;
  DROP TABLE "pages_blocks_offers_list" CASCADE;
  DROP TABLE "pages_blocks_offers_list_locales" CASCADE;
  DROP TABLE "_pages_v_blocks_offers_list" CASCADE;
  DROP TABLE "_pages_v_blocks_offers_list_locales" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_tattoo_offers_fk";
  
  ALTER TABLE "payload_jobs_log" ALTER COLUMN "task_slug" SET DATA TYPE text;
  DROP TYPE "public"."enum_payload_jobs_log_task_slug";
  CREATE TYPE "public"."enum_payload_jobs_log_task_slug" AS ENUM('inline', 'releaseExpiredReservations', 'prepaymentReminders', 'cancelOverduePrepayments', 'sendEmail', 'renderInvoicePdf', 'renderLegalTextPdf', 'markDelivered', 'withdrawalDeadlines', 'revenueGuardCheck', 'monthlyClose', 'invoiceIntegrityCheck', 'complianceDocsReview', 'activateScheduledLegalTexts', 'retentionAbandonedCheckouts', 'retentionOrderMinimize', 'retentionOrders', 'retentionInvoices', 'retentionWithdrawals', 'retentionCommissionInquiries', 'retentionEmailLog', 'retentionPrivacyRequests', 'retentionConsentEvidence', 'retentionDeletionLog', 'retentionTechnical', 'legalHoldReview', 'legalReviewReminder', 'privacyRequestsDeadlineReminder');
  ALTER TABLE "payload_jobs_log" ALTER COLUMN "task_slug" SET DATA TYPE "public"."enum_payload_jobs_log_task_slug" USING "task_slug"::"public"."enum_payload_jobs_log_task_slug";
  ALTER TABLE "payload_jobs" ALTER COLUMN "task_slug" SET DATA TYPE text;
  DROP TYPE "public"."enum_payload_jobs_task_slug";
  CREATE TYPE "public"."enum_payload_jobs_task_slug" AS ENUM('inline', 'releaseExpiredReservations', 'prepaymentReminders', 'cancelOverduePrepayments', 'sendEmail', 'renderInvoicePdf', 'renderLegalTextPdf', 'markDelivered', 'withdrawalDeadlines', 'revenueGuardCheck', 'monthlyClose', 'invoiceIntegrityCheck', 'complianceDocsReview', 'activateScheduledLegalTexts', 'retentionAbandonedCheckouts', 'retentionOrderMinimize', 'retentionOrders', 'retentionInvoices', 'retentionWithdrawals', 'retentionCommissionInquiries', 'retentionEmailLog', 'retentionPrivacyRequests', 'retentionConsentEvidence', 'retentionDeletionLog', 'retentionTechnical', 'legalHoldReview', 'legalReviewReminder', 'privacyRequestsDeadlineReminder');
  ALTER TABLE "payload_jobs" ALTER COLUMN "task_slug" SET DATA TYPE "public"."enum_payload_jobs_task_slug" USING "task_slug"::"public"."enum_payload_jobs_task_slug";
  DROP INDEX "payload_locked_documents_rels_tattoo_offers_id_idx";
  ALTER TABLE "pages_blocks_contact_links" DROP COLUMN "show_instagram";
  ALTER TABLE "_pages_v_blocks_contact_links" DROP COLUMN "show_instagram";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "tattoo_offers_id";
  DROP TYPE "public"."enum_tattoo_offers_type";
  DROP TYPE "public"."enum__tattoo_offers_v_version_type";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_tattoo_offers_type" AS ENUM('flash_day', 'aktion');
  CREATE TYPE "public"."enum__tattoo_offers_v_version_type" AS ENUM('flash_day', 'aktion');
  ALTER TYPE "public"."enum_payload_jobs_log_task_slug" ADD VALUE 'revalidateEndedOffers' BEFORE 'retentionAbandonedCheckouts';
  ALTER TYPE "public"."enum_payload_jobs_task_slug" ADD VALUE 'revalidateEndedOffers' BEFORE 'retentionAbandonedCheckouts';
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
  
  CREATE TABLE "pages_blocks_offers_list" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_offers_list_locales" (
  	"heading" varchar,
  	"empty_text" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "_pages_v_blocks_offers_list" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_offers_list_locales" (
  	"heading" varchar,
  	"empty_text" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  ALTER TABLE "pages_blocks_contact_links" ADD COLUMN "show_instagram" boolean DEFAULT true;
  ALTER TABLE "_pages_v_blocks_contact_links" ADD COLUMN "show_instagram" boolean DEFAULT true;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "tattoo_offers_id" integer;
  ALTER TABLE "tattoo_offers" ADD CONSTRAINT "tattoo_offers_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "tattoo_offers_locales" ADD CONSTRAINT "tattoo_offers_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."tattoo_offers"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "tattoo_offers_rels" ADD CONSTRAINT "tattoo_offers_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."tattoo_offers"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "tattoo_offers_rels" ADD CONSTRAINT "tattoo_offers_rels_flash_fk" FOREIGN KEY ("flash_id") REFERENCES "public"."flash"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_tattoo_offers_v" ADD CONSTRAINT "_tattoo_offers_v_parent_id_tattoo_offers_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."tattoo_offers"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_tattoo_offers_v" ADD CONSTRAINT "_tattoo_offers_v_version_image_id_media_id_fk" FOREIGN KEY ("version_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_tattoo_offers_v_locales" ADD CONSTRAINT "_tattoo_offers_v_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_tattoo_offers_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_tattoo_offers_v_rels" ADD CONSTRAINT "_tattoo_offers_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_tattoo_offers_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_tattoo_offers_v_rels" ADD CONSTRAINT "_tattoo_offers_v_rels_flash_fk" FOREIGN KEY ("flash_id") REFERENCES "public"."flash"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_offers_list" ADD CONSTRAINT "pages_blocks_offers_list_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_offers_list_locales" ADD CONSTRAINT "pages_blocks_offers_list_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_offers_list"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_offers_list" ADD CONSTRAINT "_pages_v_blocks_offers_list_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_offers_list_locales" ADD CONSTRAINT "_pages_v_blocks_offers_list_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v_blocks_offers_list"("id") ON DELETE cascade ON UPDATE no action;
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
  CREATE INDEX "pages_blocks_offers_list_order_idx" ON "pages_blocks_offers_list" USING btree ("_order");
  CREATE INDEX "pages_blocks_offers_list_parent_id_idx" ON "pages_blocks_offers_list" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_offers_list_path_idx" ON "pages_blocks_offers_list" USING btree ("_path");
  CREATE UNIQUE INDEX "pages_blocks_offers_list_locales_locale_parent_id_unique" ON "pages_blocks_offers_list_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_pages_v_blocks_offers_list_order_idx" ON "_pages_v_blocks_offers_list" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_offers_list_parent_id_idx" ON "_pages_v_blocks_offers_list" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_offers_list_path_idx" ON "_pages_v_blocks_offers_list" USING btree ("_path");
  CREATE UNIQUE INDEX "_pages_v_blocks_offers_list_locales_locale_parent_id_unique" ON "_pages_v_blocks_offers_list_locales" USING btree ("_locale","_parent_id");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_tattoo_offers_fk" FOREIGN KEY ("tattoo_offers_id") REFERENCES "public"."tattoo_offers"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_tattoo_offers_id_idx" ON "payload_locked_documents_rels" USING btree ("tattoo_offers_id");`)
}
