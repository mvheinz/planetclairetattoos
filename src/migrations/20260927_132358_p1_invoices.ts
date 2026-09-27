import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_invoices_type" AS ENUM('invoice', 'credit_note');
  CREATE TYPE "public"."enum_invoices_series" AS ENUM('RE', 'GS', 'BSP-RE', 'BSP-GS');
  CREATE TYPE "public"."enum_invoices_status" AS ENUM('pending_pdf', 'issued');
  CREATE TYPE "public"."enum_invoices_tax_mode" AS ENUM('kleinunternehmer', 'regelbesteuert');
  CREATE TYPE "public"."enum_invoices_reason" AS ENUM('withdrawal', 'goodwill', 'complaint', 'breakage', 'admin_cancellation', 'item_unavailable', 'dispute');
  CREATE TYPE "public"."enum_withdrawals_channel" AS ENUM('online_form', 'email', 'letter', 'other');
  CREATE TYPE "public"."enum_withdrawals_locale" AS ENUM('de', 'en');
  CREATE TYPE "public"."enum_withdrawals_match_status" AS ENUM('auto_matched', 'needs_manual_match', 'manually_matched', 'no_order');
  CREATE TYPE "public"."enum_withdrawals_status" AS ENUM('received', 'goods_returned', 'partially_refunded', 'refunded', 'rejected', 'closed');
  CREATE TYPE "public"."enum_withdrawals_close_reason" AS ENUM('unpaid_order_cancelled', 'duplicate', 'retracted', 'other');
  CREATE TABLE "invoices" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"number" varchar NOT NULL,
  	"type" "enum_invoices_type" NOT NULL,
  	"series" "enum_invoices_series" NOT NULL,
  	"year" numeric NOT NULL,
  	"sequence_number" numeric NOT NULL,
  	"status" "enum_invoices_status" DEFAULT 'pending_pdf' NOT NULL,
  	"order_id" integer NOT NULL,
  	"related_invoice_id" integer,
  	"issue_date" timestamp(3) with time zone NOT NULL,
  	"delivery_date" timestamp(3) with time zone NOT NULL,
  	"tax_mode" "enum_invoices_tax_mode" NOT NULL,
  	"is_kleinunternehmer" boolean,
  	"total_gross_cents" numeric NOT NULL,
  	"total_net_cents" numeric NOT NULL,
  	"total_tax_cents" numeric NOT NULL,
  	"data" jsonb NOT NULL,
  	"pdf_id" integer,
  	"sha256" varchar,
  	"rendered_at" timestamp(3) with time zone,
  	"reason" "enum_invoices_reason",
  	"retain_until" timestamp(3) with time zone NOT NULL,
  	"anonymized_at" timestamp(3) with time zone,
  	"seed" boolean DEFAULT false,
  	"seed_key" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "invoice_counters" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"series" varchar NOT NULL,
  	"year" numeric NOT NULL,
  	"last_number" numeric DEFAULT 0 NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "withdrawals" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"reference" varchar NOT NULL,
  	"channel" "enum_withdrawals_channel" DEFAULT 'online_form' NOT NULL,
  	"received_at" timestamp(3) with time zone NOT NULL,
  	"name" varchar,
  	"contract_identification" varchar,
  	"email" varchar,
  	"items_text" varchar,
  	"reason" varchar,
  	"locale" "enum_withdrawals_locale" NOT NULL,
  	"submission_snapshot" jsonb NOT NULL,
  	"order_id" integer,
  	"match_status" "enum_withdrawals_match_status" NOT NULL,
  	"affected_item_ids" jsonb,
  	"status" "enum_withdrawals_status" DEFAULT 'received' NOT NULL,
  	"confirmation_sent_at" timestamp(3) with time zone,
  	"confirmation_email_id" integer,
  	"refund_due_at" timestamp(3) with time zone NOT NULL,
  	"return_tracking_number" varchar,
  	"return_proof_received_at" timestamp(3) with time zone,
  	"goods_returned_at" timestamp(3) with time zone,
  	"refunded_at" timestamp(3) with time zone,
  	"closed_at" timestamp(3) with time zone,
  	"rejected_at" timestamp(3) with time zone,
  	"close_reason" "enum_withdrawals_close_reason",
  	"close_note" varchar,
  	"deadline_reminder_sent_at" timestamp(3) with time zone,
  	"spam_marked_at" timestamp(3) with time zone,
  	"spam_reason" varchar,
  	"admin_notes" varchar,
  	"privacy_processing_restricted" boolean DEFAULT false,
  	"privacy_restricted_at" timestamp(3) with time zone,
  	"privacy_legal_hold" boolean DEFAULT false,
  	"privacy_legal_hold_reason" varchar,
  	"privacy_legal_hold_since" timestamp(3) with time zone,
  	"privacy_legal_hold_reviewed_at" timestamp(3) with time zone,
  	"privacy_anonymized_at" timestamp(3) with time zone,
  	"retain_until" timestamp(3) with time zone,
  	"seed" boolean DEFAULT false,
  	"seed_key" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "orders_refunds" ADD COLUMN "credit_note_id" integer;
  ALTER TABLE "orders" ADD COLUMN "invoice_id" integer;
  ALTER TABLE "email_log" ADD COLUMN "withdrawal_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "invoices_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "invoice_counters_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "withdrawals_id" integer;
  ALTER TABLE "invoices" ADD CONSTRAINT "invoices_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "invoices" ADD CONSTRAINT "invoices_related_invoice_id_invoices_id_fk" FOREIGN KEY ("related_invoice_id") REFERENCES "public"."invoices"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "invoices" ADD CONSTRAINT "invoices_pdf_id_private_uploads_id_fk" FOREIGN KEY ("pdf_id") REFERENCES "public"."private_uploads"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "withdrawals" ADD CONSTRAINT "withdrawals_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "withdrawals" ADD CONSTRAINT "withdrawals_confirmation_email_id_email_log_id_fk" FOREIGN KEY ("confirmation_email_id") REFERENCES "public"."email_log"("id") ON DELETE set null ON UPDATE no action;
  CREATE UNIQUE INDEX "invoices_number_idx" ON "invoices" USING btree ("number");
  CREATE INDEX "invoices_order_idx" ON "invoices" USING btree ("order_id");
  CREATE INDEX "invoices_related_invoice_idx" ON "invoices" USING btree ("related_invoice_id");
  CREATE INDEX "invoices_issue_date_idx" ON "invoices" USING btree ("issue_date");
  CREATE INDEX "invoices_pdf_idx" ON "invoices" USING btree ("pdf_id");
  CREATE INDEX "invoices_seed_idx" ON "invoices" USING btree ("seed");
  CREATE INDEX "invoices_seed_key_idx" ON "invoices" USING btree ("seed_key");
  CREATE INDEX "invoices_updated_at_idx" ON "invoices" USING btree ("updated_at");
  CREATE INDEX "invoices_created_at_idx" ON "invoices" USING btree ("created_at");
  CREATE INDEX "year_type_idx" ON "invoices" USING btree ("year","type");
  CREATE INDEX "invoice_counters_updated_at_idx" ON "invoice_counters" USING btree ("updated_at");
  CREATE INDEX "invoice_counters_created_at_idx" ON "invoice_counters" USING btree ("created_at");
  CREATE UNIQUE INDEX "series_year_idx" ON "invoice_counters" USING btree ("series","year");
  CREATE UNIQUE INDEX "withdrawals_reference_idx" ON "withdrawals" USING btree ("reference");
  CREATE INDEX "withdrawals_received_at_idx" ON "withdrawals" USING btree ("received_at");
  CREATE INDEX "withdrawals_email_idx" ON "withdrawals" USING btree ("email");
  CREATE INDEX "withdrawals_order_idx" ON "withdrawals" USING btree ("order_id");
  CREATE INDEX "withdrawals_status_idx" ON "withdrawals" USING btree ("status");
  CREATE INDEX "withdrawals_confirmation_email_idx" ON "withdrawals" USING btree ("confirmation_email_id");
  CREATE INDEX "withdrawals_retain_until_idx" ON "withdrawals" USING btree ("retain_until");
  CREATE INDEX "withdrawals_seed_idx" ON "withdrawals" USING btree ("seed");
  CREATE INDEX "withdrawals_seed_key_idx" ON "withdrawals" USING btree ("seed_key");
  CREATE INDEX "withdrawals_updated_at_idx" ON "withdrawals" USING btree ("updated_at");
  CREATE INDEX "withdrawals_created_at_idx" ON "withdrawals" USING btree ("created_at");
  ALTER TABLE "orders_refunds" ADD CONSTRAINT "orders_refunds_credit_note_id_invoices_id_fk" FOREIGN KEY ("credit_note_id") REFERENCES "public"."invoices"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "orders" ADD CONSTRAINT "orders_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "email_log" ADD CONSTRAINT "email_log_withdrawal_id_withdrawals_id_fk" FOREIGN KEY ("withdrawal_id") REFERENCES "public"."withdrawals"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_invoices_fk" FOREIGN KEY ("invoices_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_invoice_counters_fk" FOREIGN KEY ("invoice_counters_id") REFERENCES "public"."invoice_counters"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_withdrawals_fk" FOREIGN KEY ("withdrawals_id") REFERENCES "public"."withdrawals"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "orders_refunds_credit_note_idx" ON "orders_refunds" USING btree ("credit_note_id");
  CREATE INDEX "orders_invoice_idx" ON "orders" USING btree ("invoice_id");
  CREATE INDEX "email_log_withdrawal_idx" ON "email_log" USING btree ("withdrawal_id");
  CREATE INDEX "payload_locked_documents_rels_invoices_id_idx" ON "payload_locked_documents_rels" USING btree ("invoices_id");
  CREATE INDEX "payload_locked_documents_rels_invoice_counters_id_idx" ON "payload_locked_documents_rels" USING btree ("invoice_counters_id");
  CREATE INDEX "payload_locked_documents_rels_withdrawals_id_idx" ON "payload_locked_documents_rels" USING btree ("withdrawals_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "invoices" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "invoice_counters" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "withdrawals" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "invoices" CASCADE;
  DROP TABLE "invoice_counters" CASCADE;
  DROP TABLE "withdrawals" CASCADE;
  ALTER TABLE "orders_refunds" DROP CONSTRAINT "orders_refunds_credit_note_id_invoices_id_fk";
  
  ALTER TABLE "orders" DROP CONSTRAINT "orders_invoice_id_invoices_id_fk";
  
  ALTER TABLE "email_log" DROP CONSTRAINT "email_log_withdrawal_id_withdrawals_id_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_invoices_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_invoice_counters_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_withdrawals_fk";
  
  DROP INDEX "orders_refunds_credit_note_idx";
  DROP INDEX "orders_invoice_idx";
  DROP INDEX "email_log_withdrawal_idx";
  DROP INDEX "payload_locked_documents_rels_invoices_id_idx";
  DROP INDEX "payload_locked_documents_rels_invoice_counters_id_idx";
  DROP INDEX "payload_locked_documents_rels_withdrawals_id_idx";
  ALTER TABLE "orders_refunds" DROP COLUMN "credit_note_id";
  ALTER TABLE "orders" DROP COLUMN "invoice_id";
  ALTER TABLE "email_log" DROP COLUMN "withdrawal_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "invoices_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "invoice_counters_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "withdrawals_id";
  DROP TYPE "public"."enum_invoices_type";
  DROP TYPE "public"."enum_invoices_series";
  DROP TYPE "public"."enum_invoices_status";
  DROP TYPE "public"."enum_invoices_tax_mode";
  DROP TYPE "public"."enum_invoices_reason";
  DROP TYPE "public"."enum_withdrawals_channel";
  DROP TYPE "public"."enum_withdrawals_locale";
  DROP TYPE "public"."enum_withdrawals_match_status";
  DROP TYPE "public"."enum_withdrawals_status";
  DROP TYPE "public"."enum_withdrawals_close_reason";`)
}
