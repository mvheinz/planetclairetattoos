import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_audit_log_action" AS ENUM('product_created', 'product_published', 'product_status_changed', 'product_price_changed', 'product_offline_sold', 'product_adopted', 'product_deleted', 'reservation_conflict', 'order_created', 'order_status_changed', 'order_address_changed', 'order_status_link_rotated', 'order_refund_created', 'order_refund_failed', 'packing_photo_skipped', 'carrier_consent_withdrawn', 'complaint_changed', 'invoice_issued', 'credit_note_issued', 'withdrawal_received', 'withdrawal_matched', 'withdrawal_status_changed', 'legal_text_activated', 'legal_text_superseded', 'legal_snippet_activated', 'legal_snippet_superseded', 'legal_review_confirmed', 'settings_changed', 'tax_mode_changed', 'gallery_published', 'gallery_consent_withdrawn', 'inquiry_status_changed', 'inquiry_deleted', 'private_upload_deleted', 'order_anonymized', 'data_exported', 'legal_hold_changed', 'processing_restricted', 'privacy_request_changed', 'retention_setting_changed', 'seed_imported', 'seed_removed', 'login_succeeded', 'password_reset_requested');
  CREATE TYPE "public"."enum_audit_log_actor_type" AS ENUM('admin', 'system', 'webhook', 'job', 'customer', 'seed');
  CREATE TYPE "public"."enum_email_log_template" AS ENUM('order_confirmation', 'prepayment_instructions', 'prepayment_reminder', 'prepayment_cancelled', 'prepayment_received', 'order_shipped', 'pickup_ready', 'withdrawal_receipt', 'refund_confirmation', 'oversold_apology', 'inquiry_receipt', 'complaint_repair_choice', 'dispute_vsbg', 'privacy_access_response', 'privacy_erasure_response', 'consent_withdrawal_confirmation', 'admin_order_placed', 'admin_prepayment_cancelled', 'admin_withdrawal_received', 'admin_inquiry_received', 'admin_oversold', 'admin_dispute_opened', 'admin_refund_failed', 'admin_revenue_guard', 'admin_legal_review_due', 'admin_monthly_close', 'admin_alert', 'admin_withdrawal_deadline', 'admin_password_reset', 'admin_privacy_request_due', 'admin_legal_hold_review', 'admin_compliance_docs_review');
  CREATE TYPE "public"."enum_email_log_locale" AS ENUM('de', 'en');
  CREATE TYPE "public"."enum_email_log_status" AS ENUM('queued', 'sent', 'failed', 'suppressed');
  CREATE TYPE "public"."enum_email_log_transport" AS ENUM('file', 'smtp', 'memory', 'log');
  CREATE TYPE "public"."enum_consent_log_purpose" AS ENUM('carrier_email_forwarding', 'deviation_agreement', 'inquiry_privacy_notice');
  CREATE TYPE "public"."enum_consent_log_locale" AS ENUM('de', 'en');
  CREATE TYPE "public"."enum_webhook_events_provider" AS ENUM('stripe', 'mock');
  CREATE TYPE "public"."enum_webhook_events_status" AS ENUM('processing', 'processed', 'failed', 'ignored');
  CREATE TYPE "public"."enum_deletion_log_action" AS ENUM('deleted', 'anonymized', 'restricted', 'files_deleted');
  CREATE TYPE "public"."enum_deletion_log_trigger" AS ENUM('job', 'privacy_request', 'admin', 'consent_withdrawn');
  CREATE TABLE "audit_log" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"action" "enum_audit_log_action" NOT NULL,
  	"actor_type" "enum_audit_log_actor_type" NOT NULL,
  	"actor_user_id" integer,
  	"entity_collection" varchar NOT NULL,
  	"entity_id" varchar NOT NULL,
  	"summary" varchar NOT NULL,
  	"changes" jsonb,
  	"retain_until" timestamp(3) with time zone NOT NULL,
  	"seed" boolean DEFAULT false,
  	"seed_key" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "email_log_attachments" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"filename" varchar NOT NULL,
  	"sha256" varchar NOT NULL,
  	"size_bytes" numeric NOT NULL
  );
  
  CREATE TABLE "email_log" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"template" "enum_email_log_template" NOT NULL,
  	"to" varchar NOT NULL,
  	"locale" "enum_email_log_locale" NOT NULL,
  	"subject" varchar NOT NULL,
  	"status" "enum_email_log_status" DEFAULT 'queued' NOT NULL,
  	"transport" "enum_email_log_transport",
  	"message_id" varchar,
  	"smtp_response" varchar,
  	"sent_at" timestamp(3) with time zone,
  	"attempts" numeric DEFAULT 0,
  	"last_error" varchar,
  	"template_version" varchar,
  	"body_sha256" varchar,
  	"retain_until" timestamp(3) with time zone NOT NULL,
  	"seed" boolean DEFAULT false,
  	"seed_key" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "consent_log" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"purpose" "enum_consent_log_purpose" NOT NULL,
  	"granted" boolean DEFAULT false NOT NULL,
  	"text_snapshot" varchar NOT NULL,
  	"text_sha256" varchar NOT NULL,
  	"snippet_key" varchar,
  	"snippet_version" varchar,
  	"locale" "enum_consent_log_locale" NOT NULL,
  	"email" varchar NOT NULL,
  	"withdrawn_at" timestamp(3) with time zone,
  	"retain_until" timestamp(3) with time zone NOT NULL,
  	"seed" boolean DEFAULT false,
  	"seed_key" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "webhook_events" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"provider" "enum_webhook_events_provider" NOT NULL,
  	"event_id" varchar NOT NULL,
  	"type" varchar NOT NULL,
  	"livemode" boolean DEFAULT false NOT NULL,
  	"status" "enum_webhook_events_status" NOT NULL,
  	"attempts" numeric DEFAULT 1 NOT NULL,
  	"received_at" timestamp(3) with time zone,
  	"processed_at" timestamp(3) with time zone,
  	"last_error" varchar,
  	"payload_sha256" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "deletion_log" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"entity_collection" varchar NOT NULL,
  	"entity_id" varchar NOT NULL,
  	"rule_id" varchar NOT NULL,
  	"action" "enum_deletion_log_action" NOT NULL,
  	"trigger" "enum_deletion_log_trigger" NOT NULL,
  	"task_slug" varchar,
  	"privacy_request_ref" varchar,
  	"storage_objects_count" numeric DEFAULT 0 NOT NULL,
  	"executed_at" timestamp(3) with time zone NOT NULL,
  	"retain_until" timestamp(3) with time zone NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "audit_log_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "email_log_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "consent_log_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "webhook_events_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "deletion_log_id" integer;
  ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "email_log_attachments" ADD CONSTRAINT "email_log_attachments_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."email_log"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "audit_log_action_idx" ON "audit_log" USING btree ("action");
  CREATE INDEX "audit_log_actor_user_idx" ON "audit_log" USING btree ("actor_user_id");
  CREATE INDEX "audit_log_retain_until_idx" ON "audit_log" USING btree ("retain_until");
  CREATE INDEX "audit_log_seed_idx" ON "audit_log" USING btree ("seed");
  CREATE INDEX "audit_log_seed_key_idx" ON "audit_log" USING btree ("seed_key");
  CREATE INDEX "audit_log_updated_at_idx" ON "audit_log" USING btree ("updated_at");
  CREATE INDEX "audit_log_created_at_idx" ON "audit_log" USING btree ("created_at");
  CREATE INDEX "entityCollection_entityId_idx" ON "audit_log" USING btree ("entity_collection","entity_id");
  CREATE INDEX "email_log_attachments_order_idx" ON "email_log_attachments" USING btree ("_order");
  CREATE INDEX "email_log_attachments_parent_id_idx" ON "email_log_attachments" USING btree ("_parent_id");
  CREATE INDEX "email_log_template_idx" ON "email_log" USING btree ("template");
  CREATE INDEX "email_log_status_idx" ON "email_log" USING btree ("status");
  CREATE INDEX "email_log_retain_until_idx" ON "email_log" USING btree ("retain_until");
  CREATE INDEX "email_log_seed_idx" ON "email_log" USING btree ("seed");
  CREATE INDEX "email_log_seed_key_idx" ON "email_log" USING btree ("seed_key");
  CREATE INDEX "email_log_updated_at_idx" ON "email_log" USING btree ("updated_at");
  CREATE INDEX "email_log_created_at_idx" ON "email_log" USING btree ("created_at");
  CREATE INDEX "consent_log_retain_until_idx" ON "consent_log" USING btree ("retain_until");
  CREATE INDEX "consent_log_seed_idx" ON "consent_log" USING btree ("seed");
  CREATE INDEX "consent_log_seed_key_idx" ON "consent_log" USING btree ("seed_key");
  CREATE INDEX "consent_log_updated_at_idx" ON "consent_log" USING btree ("updated_at");
  CREATE INDEX "consent_log_created_at_idx" ON "consent_log" USING btree ("created_at");
  CREATE UNIQUE INDEX "webhook_events_event_id_idx" ON "webhook_events" USING btree ("event_id");
  CREATE INDEX "webhook_events_status_idx" ON "webhook_events" USING btree ("status");
  CREATE INDEX "webhook_events_received_at_idx" ON "webhook_events" USING btree ("received_at");
  CREATE INDEX "webhook_events_updated_at_idx" ON "webhook_events" USING btree ("updated_at");
  CREATE INDEX "webhook_events_created_at_idx" ON "webhook_events" USING btree ("created_at");
  CREATE INDEX "deletion_log_executed_at_idx" ON "deletion_log" USING btree ("executed_at");
  CREATE INDEX "deletion_log_retain_until_idx" ON "deletion_log" USING btree ("retain_until");
  CREATE INDEX "deletion_log_updated_at_idx" ON "deletion_log" USING btree ("updated_at");
  CREATE INDEX "deletion_log_created_at_idx" ON "deletion_log" USING btree ("created_at");
  CREATE INDEX "entityCollection_entityId_1_idx" ON "deletion_log" USING btree ("entity_collection","entity_id");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_audit_log_fk" FOREIGN KEY ("audit_log_id") REFERENCES "public"."audit_log"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_email_log_fk" FOREIGN KEY ("email_log_id") REFERENCES "public"."email_log"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_consent_log_fk" FOREIGN KEY ("consent_log_id") REFERENCES "public"."consent_log"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_webhook_events_fk" FOREIGN KEY ("webhook_events_id") REFERENCES "public"."webhook_events"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_deletion_log_fk" FOREIGN KEY ("deletion_log_id") REFERENCES "public"."deletion_log"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_audit_log_id_idx" ON "payload_locked_documents_rels" USING btree ("audit_log_id");
  CREATE INDEX "payload_locked_documents_rels_email_log_id_idx" ON "payload_locked_documents_rels" USING btree ("email_log_id");
  CREATE INDEX "payload_locked_documents_rels_consent_log_id_idx" ON "payload_locked_documents_rels" USING btree ("consent_log_id");
  CREATE INDEX "payload_locked_documents_rels_webhook_events_id_idx" ON "payload_locked_documents_rels" USING btree ("webhook_events_id");
  CREATE INDEX "payload_locked_documents_rels_deletion_log_id_idx" ON "payload_locked_documents_rels" USING btree ("deletion_log_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "audit_log" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "email_log_attachments" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "email_log" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "consent_log" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "webhook_events" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "deletion_log" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "audit_log" CASCADE;
  DROP TABLE "email_log_attachments" CASCADE;
  DROP TABLE "email_log" CASCADE;
  DROP TABLE "consent_log" CASCADE;
  DROP TABLE "webhook_events" CASCADE;
  DROP TABLE "deletion_log" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_audit_log_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_email_log_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_consent_log_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_webhook_events_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_deletion_log_fk";
  
  DROP INDEX "payload_locked_documents_rels_audit_log_id_idx";
  DROP INDEX "payload_locked_documents_rels_email_log_id_idx";
  DROP INDEX "payload_locked_documents_rels_consent_log_id_idx";
  DROP INDEX "payload_locked_documents_rels_webhook_events_id_idx";
  DROP INDEX "payload_locked_documents_rels_deletion_log_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "audit_log_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "email_log_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "consent_log_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "webhook_events_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "deletion_log_id";
  DROP TYPE "public"."enum_audit_log_action";
  DROP TYPE "public"."enum_audit_log_actor_type";
  DROP TYPE "public"."enum_email_log_template";
  DROP TYPE "public"."enum_email_log_locale";
  DROP TYPE "public"."enum_email_log_status";
  DROP TYPE "public"."enum_email_log_transport";
  DROP TYPE "public"."enum_consent_log_purpose";
  DROP TYPE "public"."enum_consent_log_locale";
  DROP TYPE "public"."enum_webhook_events_provider";
  DROP TYPE "public"."enum_webhook_events_status";
  DROP TYPE "public"."enum_deletion_log_action";
  DROP TYPE "public"."enum_deletion_log_trigger";`)
}
