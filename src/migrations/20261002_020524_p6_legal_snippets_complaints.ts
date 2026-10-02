import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_legal_snippets_key" AS ENUM('price.kleinunternehmerNote', 'price.shippingNote', 'price.tattooNote', 'delivery.timeShipping', 'delivery.timePickup', 'cart.paymentAndDeliveryInfo', 'checkout.legalNotice', 'checkout.dhlEmailConsent', 'checkout.deviationAgreement', 'checkout.vorkasseInfo', 'product.ceramicsDecorative', 'product.ceramicsFoodSafe', 'product.jewelrySmallParts', 'product.jewelryNickel', 'product.textileSecondHand', 'product.textileLabelMissing', 'product.noSpecialWarnings', 'product.glassFrame', 'email.orderConfirmation.contractSentence', 'email.vorkasse.paymentInstructions', 'email.vorkasse.reminder', 'email.vorkasse.cancellation', 'email.shipping.damageNotice', 'email.pickup.ready', 'withdrawal.intro', 'withdrawal.receiptNotice', 'withdrawal.returnInfo', 'withdrawal.returnCostsNote', 'complaint.repairChoice', 'dispute.vsbg37', 'inquiry.privacyNotice', 'inquiry.autoReply', 'commission.offer', 'translation.disclaimer', 'privacyRequest.accessResponse', 'privacyRequest.erasureResponse');
  CREATE TYPE "public"."enum_legal_snippets_status" AS ENUM('draft', 'scheduled', 'active', 'superseded');
  CREATE TYPE "public"."enum_legal_snippets_origin" AS ENUM('placeholder', 'draft', 'lawyer');
  CREATE TYPE "public"."enum_complaints_kind" AS ENUM('transport_damage', 'defect');
  CREATE TYPE "public"."enum_complaints_remedy" AS ENUM('repair', 'replacement', 'refund', 'price_reduction', 'none');
  CREATE TYPE "public"."enum_complaints_customer_choice" AS ENUM('repair', 'replacement', 'refund', 'price_reduction');
  CREATE TYPE "public"."enum_complaints_status" AS ENUM('open', 'waiting_customer', 'resolved', 'rejected');
  CREATE TABLE "legal_snippets" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" "enum_legal_snippets_key" NOT NULL,
  	"version" numeric,
  	"status" "enum_legal_snippets_status" DEFAULT 'draft' NOT NULL,
  	"valid_from" timestamp(3) with time zone NOT NULL,
  	"origin" "enum_legal_snippets_origin" DEFAULT 'draft' NOT NULL,
  	"change_note" varchar,
  	"sha256_de" varchar,
  	"sha256_en" varchar,
  	"activated_at" timestamp(3) with time zone,
  	"superseded_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "legal_snippets_locales" (
  	"text" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "complaints" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order_id" integer NOT NULL,
  	"kind" "enum_complaints_kind" DEFAULT 'transport_damage' NOT NULL,
  	"received_at" timestamp(3) with time zone NOT NULL,
  	"description" varchar,
  	"affected_item_ids" jsonb,
  	"carrier_claim_due_at" timestamp(3) with time zone,
  	"carrier_claim_filed_at" timestamp(3) with time zone,
  	"remedy" "enum_complaints_remedy",
  	"repair_choice_sent_at" timestamp(3) with time zone,
  	"customer_choice" "enum_complaints_customer_choice",
  	"customer_choice_at" timestamp(3) with time zone,
  	"warranty_ends_at" timestamp(3) with time zone,
  	"vsbg_notice_sent_at" timestamp(3) with time zone,
  	"status" "enum_complaints_status" DEFAULT 'open' NOT NULL,
  	"notes" varchar,
  	"seed" boolean DEFAULT false,
  	"seed_key" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "complaints_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"private_uploads_id" integer
  );
  
  ALTER TABLE "private_uploads" ADD COLUMN "related_complaint_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "legal_snippets_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "complaints_id" integer;
  ALTER TABLE "legal_snippets_locales" ADD CONSTRAINT "legal_snippets_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."legal_snippets"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "complaints" ADD CONSTRAINT "complaints_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "complaints_rels" ADD CONSTRAINT "complaints_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."complaints"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "complaints_rels" ADD CONSTRAINT "complaints_rels_private_uploads_fk" FOREIGN KEY ("private_uploads_id") REFERENCES "public"."private_uploads"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "legal_snippets_key_idx" ON "legal_snippets" USING btree ("key");
  CREATE INDEX "legal_snippets_status_idx" ON "legal_snippets" USING btree ("status");
  CREATE INDEX "legal_snippets_updated_at_idx" ON "legal_snippets" USING btree ("updated_at");
  CREATE INDEX "legal_snippets_created_at_idx" ON "legal_snippets" USING btree ("created_at");
  CREATE UNIQUE INDEX "key_version_idx" ON "legal_snippets" USING btree ("key","version");
  CREATE UNIQUE INDEX "legal_snippets_locales_locale_parent_id_unique" ON "legal_snippets_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "complaints_order_idx" ON "complaints" USING btree ("order_id");
  CREATE INDEX "complaints_status_idx" ON "complaints" USING btree ("status");
  CREATE INDEX "complaints_seed_idx" ON "complaints" USING btree ("seed");
  CREATE INDEX "complaints_seed_key_idx" ON "complaints" USING btree ("seed_key");
  CREATE INDEX "complaints_updated_at_idx" ON "complaints" USING btree ("updated_at");
  CREATE INDEX "complaints_created_at_idx" ON "complaints" USING btree ("created_at");
  CREATE INDEX "complaints_rels_order_idx" ON "complaints_rels" USING btree ("order");
  CREATE INDEX "complaints_rels_parent_idx" ON "complaints_rels" USING btree ("parent_id");
  CREATE INDEX "complaints_rels_path_idx" ON "complaints_rels" USING btree ("path");
  CREATE INDEX "complaints_rels_private_uploads_id_idx" ON "complaints_rels" USING btree ("private_uploads_id");
  ALTER TABLE "private_uploads" ADD CONSTRAINT "private_uploads_related_complaint_id_complaints_id_fk" FOREIGN KEY ("related_complaint_id") REFERENCES "public"."complaints"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_legal_snippets_fk" FOREIGN KEY ("legal_snippets_id") REFERENCES "public"."legal_snippets"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_complaints_fk" FOREIGN KEY ("complaints_id") REFERENCES "public"."complaints"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "private_uploads_related_complaint_idx" ON "private_uploads" USING btree ("related_complaint_id");
  CREATE INDEX "payload_locked_documents_rels_legal_snippets_id_idx" ON "payload_locked_documents_rels" USING btree ("legal_snippets_id");
  CREATE INDEX "payload_locked_documents_rels_complaints_id_idx" ON "payload_locked_documents_rels" USING btree ("complaints_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "legal_snippets" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "legal_snippets_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "complaints" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "complaints_rels" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "legal_snippets" CASCADE;
  DROP TABLE "legal_snippets_locales" CASCADE;
  DROP TABLE "complaints" CASCADE;
  DROP TABLE "complaints_rels" CASCADE;
  ALTER TABLE "private_uploads" DROP CONSTRAINT "private_uploads_related_complaint_id_complaints_id_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_legal_snippets_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_complaints_fk";
  
  DROP INDEX "private_uploads_related_complaint_idx";
  DROP INDEX "payload_locked_documents_rels_legal_snippets_id_idx";
  DROP INDEX "payload_locked_documents_rels_complaints_id_idx";
  ALTER TABLE "private_uploads" DROP COLUMN "related_complaint_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "legal_snippets_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "complaints_id";
  DROP TYPE "public"."enum_legal_snippets_key";
  DROP TYPE "public"."enum_legal_snippets_status";
  DROP TYPE "public"."enum_legal_snippets_origin";
  DROP TYPE "public"."enum_complaints_kind";
  DROP TYPE "public"."enum_complaints_remedy";
  DROP TYPE "public"."enum_complaints_customer_choice";
  DROP TYPE "public"."enum_complaints_status";`)
}
