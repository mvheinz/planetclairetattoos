import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// P14.9 (U-58 a): Zahlungen ohne Bestellung an der Kasse (`checkouts.strayPayments`) und Audit-Aktion
// `stray_payment_refunded` für den Knopf „Erstatten“.

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_checkouts_stray_payments_kind" AS ENUM('late', 'double');
  CREATE TYPE "public"."enum_checkouts_stray_payments_refund_status" AS ENUM('none', 'pending', 'succeeded', 'failed');
  ALTER TYPE "public"."enum_audit_log_action" ADD VALUE 'stray_payment_refunded' BEFORE 'packing_photo_skipped';
  CREATE TABLE "checkouts_stray_payments" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"kind" "enum_checkouts_stray_payments_kind" NOT NULL,
  	"payment_intent_id" varchar NOT NULL,
  	"session_id" varchar,
  	"amount_cents" numeric,
  	"received_at" timestamp(3) with time zone NOT NULL,
  	"refund_status" "enum_checkouts_stray_payments_refund_status" DEFAULT 'none',
  	"refund_id" varchar,
  	"refund_attempts" numeric DEFAULT 0,
  	"refunded_at" timestamp(3) with time zone
  );
  
  ALTER TABLE "checkouts_stray_payments" ADD CONSTRAINT "checkouts_stray_payments_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."checkouts"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "checkouts_stray_payments_order_idx" ON "checkouts_stray_payments" USING btree ("_order");
  CREATE INDEX "checkouts_stray_payments_parent_id_idx" ON "checkouts_stray_payments" USING btree ("_parent_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "checkouts_stray_payments" CASCADE;
  ALTER TABLE "audit_log" ALTER COLUMN "action" SET DATA TYPE text;
  DROP TYPE "public"."enum_audit_log_action";
  CREATE TYPE "public"."enum_audit_log_action" AS ENUM('product_created', 'product_published', 'product_status_changed', 'product_price_changed', 'product_offline_sold', 'product_adopted', 'product_deleted', 'reservation_conflict', 'order_created', 'order_status_changed', 'order_address_changed', 'order_status_link_rotated', 'order_refund_created', 'order_refund_failed', 'packing_photo_skipped', 'carrier_consent_withdrawn', 'complaint_changed', 'invoice_issued', 'credit_note_issued', 'withdrawal_received', 'withdrawal_matched', 'withdrawal_status_changed', 'legal_text_activated', 'legal_text_superseded', 'legal_snippet_activated', 'legal_snippet_superseded', 'legal_review_confirmed', 'settings_changed', 'tax_mode_changed', 'gallery_published', 'gallery_consent_withdrawn', 'inquiry_status_changed', 'inquiry_deleted', 'private_upload_deleted', 'order_anonymized', 'data_exported', 'legal_hold_changed', 'processing_restricted', 'privacy_request_changed', 'retention_setting_changed', 'seed_imported', 'seed_removed', 'login_succeeded', 'password_reset_requested');
  ALTER TABLE "audit_log" ALTER COLUMN "action" SET DATA TYPE "public"."enum_audit_log_action" USING "action"::"public"."enum_audit_log_action";
  DROP TYPE "public"."enum_checkouts_stray_payments_kind";
  DROP TYPE "public"."enum_checkouts_stray_payments_refund_status";`)
}
