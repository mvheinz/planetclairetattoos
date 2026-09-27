import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_checkouts_items_category" AS ENUM('keramik', 'textil', 'cap', 'zeichnung', 'schmuck', 'sonstiges');
  CREATE TYPE "public"."enum_checkouts_items_vat_category" AS ENUM('standard', 'reduced_art');
  CREATE TYPE "public"."enum_checkouts_items_shipping_class" AS ENUM('brief', 'paket_klein', 'keramik', 'nur_abholung');
  CREATE TYPE "public"."enum_checkouts_status" AS ENUM('open', 'confirming', 'completed', 'expired', 'cancelled', 'failed');
  CREATE TYPE "public"."enum_checkouts_locale" AS ENUM('de', 'en');
  CREATE TYPE "public"."enum_checkouts_fulfillment_method" AS ENUM('shipping', 'pickup');
  CREATE TYPE "public"."enum_checkouts_shipping_zone" AS ENUM('DE', 'EU', 'CH');
  CREATE TYPE "public"."enum_checkouts_shipping_class" AS ENUM('brief', 'paket_klein', 'keramik', 'nur_abholung');
  CREATE TYPE "public"."enum_checkouts_payment_choice" AS ENUM('stripe', 'prepayment');
  CREATE TYPE "public"."enum_checkouts_shipping_address_country" AS ENUM('DE', 'AT', 'BE', 'BG', 'CY', 'CZ', 'DK', 'EE', 'ES', 'FI', 'FR', 'GR', 'HR', 'HU', 'IE', 'IT', 'LT', 'LU', 'LV', 'MT', 'NL', 'PL', 'PT', 'RO', 'SE', 'SI', 'SK', 'CH');
  CREATE TYPE "public"."enum_checkouts_billing_address_country" AS ENUM('DE', 'AT', 'BE', 'BG', 'CY', 'CZ', 'DK', 'EE', 'ES', 'FI', 'FR', 'GR', 'HR', 'HU', 'IE', 'IT', 'LT', 'LU', 'LV', 'MT', 'NL', 'PL', 'PT', 'RO', 'SE', 'SI', 'SK', 'CH');
  CREATE TYPE "public"."enum_checkouts_close_reason" AS ENUM('reservation_expired', 'cart_changed', 'replaced', 'payment_failed', 'checkout_error', 'sold_offline');
  CREATE TYPE "public"."enum_reservations_source" AS ENUM('checkout_session', 'prepayment');
  CREATE TYPE "public"."enum_reservations_status" AS ENUM('active', 'converted', 'released');
  CREATE TYPE "public"."enum_reservations_release_reason" AS ENUM('session_expired', 'payment_failed', 'customer_cancelled', 'prepayment_overdue', 'order_cancelled', 'checkout_error', 'admin');
  CREATE TYPE "public"."enum_orders_status_history_from" AS ENUM('awaiting_prepayment', 'paid', 'packed', 'shipped', 'ready_for_pickup', 'picked_up', 'delivered', 'cancelled', 'withdrawal_received', 'return_received', 'refunded', 'partially_refunded', 'disputed');
  CREATE TYPE "public"."enum_orders_status_history_to" AS ENUM('awaiting_prepayment', 'paid', 'packed', 'shipped', 'ready_for_pickup', 'picked_up', 'delivered', 'cancelled', 'withdrawal_received', 'return_received', 'refunded', 'partially_refunded', 'disputed');
  CREATE TYPE "public"."enum_orders_status_history_actor_type" AS ENUM('admin', 'system', 'webhook', 'job', 'customer', 'seed');
  CREATE TYPE "public"."enum_orders_items_category" AS ENUM('keramik', 'textil', 'cap', 'zeichnung', 'schmuck', 'sonstiges');
  CREATE TYPE "public"."enum_orders_items_vat_category" AS ENUM('standard', 'reduced_art');
  CREATE TYPE "public"."enum_orders_items_shipping_class" AS ENUM('brief', 'paket_klein', 'keramik', 'nur_abholung');
  CREATE TYPE "public"."enum_orders_items_food_contact" AS ENUM('deko', 'lebensmittelecht');
  CREATE TYPE "public"."enum_orders_items_status" AS ENUM('active', 'withdrawn', 'returned', 'refunded');
  CREATE TYPE "public"."enum_orders_packaging_components_material" AS ENUM('paper_cardboard', 'plastic', 'other');
  CREATE TYPE "public"."enum_orders_refunds_reason" AS ENUM('withdrawal', 'goodwill', 'complaint', 'breakage', 'admin_cancellation', 'item_unavailable', 'dispute');
  CREATE TYPE "public"."enum_orders_refunds_status" AS ENUM('pending', 'succeeded', 'failed');
  CREATE TYPE "public"."enum_orders_status" AS ENUM('awaiting_prepayment', 'paid', 'packed', 'shipped', 'ready_for_pickup', 'picked_up', 'delivered', 'cancelled', 'withdrawal_received', 'return_received', 'refunded', 'partially_refunded', 'disputed');
  CREATE TYPE "public"."enum_orders_status_before_withdrawal" AS ENUM('awaiting_prepayment', 'paid', 'packed', 'shipped', 'ready_for_pickup', 'picked_up', 'delivered', 'cancelled', 'withdrawal_received', 'return_received', 'refunded', 'partially_refunded', 'disputed');
  CREATE TYPE "public"."enum_orders_status_before_dispute" AS ENUM('awaiting_prepayment', 'paid', 'packed', 'shipped', 'ready_for_pickup', 'picked_up', 'delivered', 'cancelled', 'withdrawal_received', 'return_received', 'refunded', 'partially_refunded', 'disputed');
  CREATE TYPE "public"."enum_orders_cancel_reason" AS ENUM('payment_timeout', 'admin', 'withdrawn');
  CREATE TYPE "public"."enum_orders_locale" AS ENUM('de', 'en');
  CREATE TYPE "public"."enum_orders_fulfillment_method" AS ENUM('shipping', 'pickup');
  CREATE TYPE "public"."enum_orders_shipping_address_country" AS ENUM('DE', 'AT', 'BE', 'BG', 'CY', 'CZ', 'DK', 'EE', 'ES', 'FI', 'FR', 'GR', 'HR', 'HU', 'IE', 'IT', 'LT', 'LU', 'LV', 'MT', 'NL', 'PL', 'PT', 'RO', 'SE', 'SI', 'SK', 'CH');
  CREATE TYPE "public"."enum_orders_billing_address_country" AS ENUM('DE', 'AT', 'BE', 'BG', 'CY', 'CZ', 'DK', 'EE', 'ES', 'FI', 'FR', 'GR', 'HR', 'HU', 'IE', 'IT', 'LT', 'LU', 'LV', 'MT', 'NL', 'PL', 'PT', 'RO', 'SE', 'SI', 'SK', 'CH');
  CREATE TYPE "public"."enum_orders_shipping_zone" AS ENUM('DE', 'EU', 'CH');
  CREATE TYPE "public"."enum_orders_shipping_class" AS ENUM('brief', 'paket_klein', 'keramik', 'nur_abholung');
  CREATE TYPE "public"."enum_orders_currency" AS ENUM('EUR');
  CREATE TYPE "public"."enum_orders_tax_mode_at_order" AS ENUM('kleinunternehmer', 'regelbesteuert');
  CREATE TYPE "public"."enum_orders_payment_method" AS ENUM('card', 'paypal', 'prepayment');
  CREATE TYPE "public"."enum_orders_payment_provider" AS ENUM('stripe', 'mock', 'bank_transfer');
  CREATE TYPE "public"."enum_orders_shipment_carrier" AS ENUM('dhl', 'deutsche_post', 'other');
  CREATE TYPE "public"."enum_orders_shipment_delivered_source" AS ENUM('manual', 'auto');
  CREATE TYPE "public"."enum_orders_dispute_status" AS ENUM('none', 'open', 'won', 'lost');
  CREATE TYPE "public"."enum_orders_admin_attention_reason" AS ENUM('oversold', 'dispute_open', 'refund_failed', 'webhook_error', 'payment_amount_mismatch', 'conformity_revoked', 'manual');
  CREATE TABLE "checkouts_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"product_id" integer NOT NULL,
  	"item_number" numeric NOT NULL,
  	"title_de" varchar NOT NULL,
  	"title_en" varchar,
  	"category" "enum_checkouts_items_category" NOT NULL,
  	"price_cents" numeric NOT NULL,
  	"vat_category" "enum_checkouts_items_vat_category" NOT NULL,
  	"shipping_class" "enum_checkouts_items_shipping_class" NOT NULL,
  	"characteristics_de" varchar,
  	"characteristics_en" varchar,
  	"deviation_text" varchar
  );
  
  CREATE TABLE "checkouts_deviation_agreements" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"product_id" integer NOT NULL,
  	"agreed_at" timestamp(3) with time zone NOT NULL
  );
  
  CREATE TABLE "checkouts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"token_hash" varchar NOT NULL,
  	"status" "enum_checkouts_status" DEFAULT 'open' NOT NULL,
  	"locale" "enum_checkouts_locale" NOT NULL,
  	"reservation_ref" varchar NOT NULL,
  	"fulfillment_method" "enum_checkouts_fulfillment_method" NOT NULL,
  	"shipping_zone" "enum_checkouts_shipping_zone",
  	"shipping_class" "enum_checkouts_shipping_class",
  	"subtotal_cents" numeric NOT NULL,
  	"shipping_cents" numeric NOT NULL,
  	"total_cents" numeric NOT NULL,
  	"expires_at" timestamp(3) with time zone NOT NULL,
  	"display_expires_at" timestamp(3) with time zone NOT NULL,
  	"payment_choice" "enum_checkouts_payment_choice",
  	"customer_email" varchar,
  	"shipping_address_name" varchar,
  	"shipping_address_address_line1" varchar,
  	"shipping_address_address_line2" varchar,
  	"shipping_address_postal_code" varchar,
  	"shipping_address_city" varchar,
  	"shipping_address_country" "enum_checkouts_shipping_address_country" DEFAULT 'DE',
  	"billing_address_differs" boolean DEFAULT false,
  	"billing_address_name" varchar,
  	"billing_address_address_line1" varchar,
  	"billing_address_address_line2" varchar,
  	"billing_address_postal_code" varchar,
  	"billing_address_city" varchar,
  	"billing_address_country" "enum_checkouts_billing_address_country" DEFAULT 'DE',
  	"carrier_email_consent" boolean DEFAULT false,
  	"legal_snippet_versions" jsonb,
  	"submitted_at" timestamp(3) with time zone,
  	"stripe_checkout_session_id" varchar,
  	"stripe_session_expires_at" timestamp(3) with time zone,
  	"stripe_session_seq" numeric DEFAULT 0,
  	"stripe_livemode" boolean DEFAULT false,
  	"mock_state" jsonb,
  	"order_id" integer,
  	"close_reason" "enum_checkouts_close_reason",
  	"timestamps_confirming_at" timestamp(3) with time zone,
  	"timestamps_completed_at" timestamp(3) with time zone,
  	"timestamps_expired_at" timestamp(3) with time zone,
  	"timestamps_cancelled_at" timestamp(3) with time zone,
  	"timestamps_failed_at" timestamp(3) with time zone,
  	"seed" boolean DEFAULT false,
  	"seed_key" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "reservations" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"ref" varchar NOT NULL,
  	"checkout_id" integer NOT NULL,
  	"product_id" integer NOT NULL,
  	"source" "enum_reservations_source" DEFAULT 'checkout_session' NOT NULL,
  	"status" "enum_reservations_status" DEFAULT 'active' NOT NULL,
  	"expires_at" timestamp(3) with time zone NOT NULL,
  	"display_expires_at" timestamp(3) with time zone,
  	"order_id" integer,
  	"converted_at" timestamp(3) with time zone,
  	"released_at" timestamp(3) with time zone,
  	"release_reason" "enum_reservations_release_reason",
  	"seed" boolean DEFAULT false,
  	"seed_key" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "orders_status_history" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"from" "enum_orders_status_history_from",
  	"to" "enum_orders_status_history_to" NOT NULL,
  	"at" timestamp(3) with time zone NOT NULL,
  	"actor_type" "enum_orders_status_history_actor_type" NOT NULL,
  	"transition" varchar,
  	"note" varchar
  );
  
  CREATE TABLE "orders_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"product_id" integer NOT NULL,
  	"item_number" numeric NOT NULL,
  	"title_de" varchar NOT NULL,
  	"title_en" varchar,
  	"category" "enum_orders_items_category" NOT NULL,
  	"characteristics_de" varchar NOT NULL,
  	"characteristics_en" varchar,
  	"price_cents" numeric NOT NULL,
  	"vat_category" "enum_orders_items_vat_category" NOT NULL,
  	"shipping_class" "enum_orders_items_shipping_class" NOT NULL,
  	"cover_image_id" integer,
  	"cover_image_url" varchar,
  	"food_contact" "enum_orders_items_food_contact",
  	"deviation_text" varchar,
  	"deviation_agreed_at" timestamp(3) with time zone,
  	"status" "enum_orders_items_status" DEFAULT 'active' NOT NULL,
  	"refunded_cents" numeric DEFAULT 0 NOT NULL
  );
  
  CREATE TABLE "orders_packaging_components" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"material" "enum_orders_packaging_components_material" NOT NULL,
  	"grams" numeric NOT NULL
  );
  
  CREATE TABLE "orders_refunds" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"amount_cents" numeric NOT NULL,
  	"reason" "enum_orders_refunds_reason" NOT NULL,
  	"item_ids" jsonb,
  	"includes_shipping" boolean DEFAULT false,
  	"status" "enum_orders_refunds_status" DEFAULT 'pending' NOT NULL,
  	"stripe_refund_id" varchar,
  	"manual_transfer_confirmed_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone NOT NULL
  );
  
  CREATE TABLE "orders" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order_number" varchar NOT NULL,
  	"checkout_id" integer,
  	"status" "enum_orders_status" NOT NULL,
  	"status_before_withdrawal" "enum_orders_status_before_withdrawal",
  	"status_before_dispute" "enum_orders_status_before_dispute",
  	"cancel_reason" "enum_orders_cancel_reason",
  	"cancel_note" varchar,
  	"locale" "enum_orders_locale" NOT NULL,
  	"customer_name" varchar,
  	"customer_email" varchar NOT NULL,
  	"fulfillment_method" "enum_orders_fulfillment_method" NOT NULL,
  	"shipping_address_name" varchar,
  	"shipping_address_address_line1" varchar,
  	"shipping_address_address_line2" varchar,
  	"shipping_address_postal_code" varchar,
  	"shipping_address_city" varchar,
  	"shipping_address_country" "enum_orders_shipping_address_country" DEFAULT 'DE',
  	"billing_address_differs" boolean DEFAULT false,
  	"billing_address_name" varchar,
  	"billing_address_address_line1" varchar,
  	"billing_address_address_line2" varchar,
  	"billing_address_postal_code" varchar,
  	"billing_address_city" varchar,
  	"billing_address_country" "enum_orders_billing_address_country" DEFAULT 'DE',
  	"shipping_zone" "enum_orders_shipping_zone",
  	"shipping_class" "enum_orders_shipping_class",
  	"subtotal_cents" numeric NOT NULL,
  	"shipping_cents" numeric NOT NULL,
  	"total_cents" numeric NOT NULL,
  	"currency" "enum_orders_currency" DEFAULT 'EUR' NOT NULL,
  	"tax_mode_at_order" "enum_orders_tax_mode_at_order" NOT NULL,
  	"payment_method" "enum_orders_payment_method" NOT NULL,
  	"payment_provider" "enum_orders_payment_provider" NOT NULL,
  	"stripe_checkout_session_id" varchar,
  	"stripe_payment_intent_id" varchar,
  	"stripe_charge_id" varchar,
  	"stripe_payment_method_type" varchar,
  	"stripe_livemode" boolean DEFAULT false,
  	"stripe_amount_received_cents" numeric,
  	"stripe_fee_cents" numeric,
  	"prepayment_due_at" timestamp(3) with time zone,
  	"prepayment_reminder_due_at" timestamp(3) with time zone,
  	"prepayment_reminder_sent_at" timestamp(3) with time zone,
  	"prepayment_received_at" timestamp(3) with time zone,
  	"prepayment_received_amount_cents" numeric,
  	"shipment_carrier" "enum_orders_shipment_carrier",
  	"shipment_tracking_number" varchar,
  	"shipment_tracking_url" varchar,
  	"shipment_delivered_source" "enum_orders_shipment_delivered_source",
  	"packaging_template_key" varchar,
  	"packaging_template_name" varchar,
  	"packaging_recorded_at" timestamp(3) with time zone,
  	"pickup_message_text" varchar,
  	"packing_checklist_state" jsonb DEFAULT '{}'::jsonb,
  	"legal_snippet_versions" jsonb NOT NULL,
  	"carrier_email_consent" boolean DEFAULT false,
  	"carrier_email_consent_revoked_at" timestamp(3) with time zone,
  	"dispute_status" "enum_orders_dispute_status" DEFAULT 'none',
  	"dispute_stripe_dispute_id" varchar,
  	"admin_attention_flag" boolean DEFAULT false,
  	"admin_attention_reason" "enum_orders_admin_attention_reason",
  	"admin_attention_note" varchar,
  	"timestamps_placed_at" timestamp(3) with time zone NOT NULL,
  	"timestamps_paid_at" timestamp(3) with time zone,
  	"timestamps_packed_at" timestamp(3) with time zone,
  	"timestamps_shipped_at" timestamp(3) with time zone,
  	"timestamps_delivered_at" timestamp(3) with time zone,
  	"timestamps_ready_for_pickup_at" timestamp(3) with time zone,
  	"timestamps_picked_up_at" timestamp(3) with time zone,
  	"timestamps_withdrawal_received_at" timestamp(3) with time zone,
  	"timestamps_return_received_at" timestamp(3) with time zone,
  	"timestamps_refunded_at" timestamp(3) with time zone,
  	"timestamps_cancelled_at" timestamp(3) with time zone,
  	"timestamps_disputed_at" timestamp(3) with time zone,
  	"timestamps_final_status_at" timestamp(3) with time zone,
  	"status_token_hash" varchar,
  	"status_token_sealed" varchar,
  	"status_token_issued_at" timestamp(3) with time zone,
  	"notes" varchar,
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
  
  CREATE TABLE "orders_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"private_uploads_id" integer
  );
  
  ALTER TABLE "products" ADD COLUMN "current_order_id" integer;
  ALTER TABLE "email_log" ADD COLUMN "order_id" integer;
  ALTER TABLE "consent_log" ADD COLUMN "checkout_id" integer;
  ALTER TABLE "consent_log" ADD COLUMN "order_id" integer;
  ALTER TABLE "consent_log" ADD COLUMN "product_id" integer;
  ALTER TABLE "webhook_events" ADD COLUMN "related_checkout_id" integer;
  ALTER TABLE "webhook_events" ADD COLUMN "related_order_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "checkouts_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "reservations_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "orders_id" integer;
  ALTER TABLE "checkouts_items" ADD CONSTRAINT "checkouts_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "checkouts_items" ADD CONSTRAINT "checkouts_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."checkouts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "checkouts_deviation_agreements" ADD CONSTRAINT "checkouts_deviation_agreements_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "checkouts_deviation_agreements" ADD CONSTRAINT "checkouts_deviation_agreements_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."checkouts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "checkouts" ADD CONSTRAINT "checkouts_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "reservations" ADD CONSTRAINT "reservations_checkout_id_checkouts_id_fk" FOREIGN KEY ("checkout_id") REFERENCES "public"."checkouts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "reservations" ADD CONSTRAINT "reservations_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "reservations" ADD CONSTRAINT "reservations_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "orders_status_history" ADD CONSTRAINT "orders_status_history_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "orders_items" ADD CONSTRAINT "orders_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "orders_items" ADD CONSTRAINT "orders_items_cover_image_id_media_id_fk" FOREIGN KEY ("cover_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "orders_items" ADD CONSTRAINT "orders_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "orders_packaging_components" ADD CONSTRAINT "orders_packaging_components_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "orders_refunds" ADD CONSTRAINT "orders_refunds_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "orders" ADD CONSTRAINT "orders_checkout_id_checkouts_id_fk" FOREIGN KEY ("checkout_id") REFERENCES "public"."checkouts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "orders_rels" ADD CONSTRAINT "orders_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "orders_rels" ADD CONSTRAINT "orders_rels_private_uploads_fk" FOREIGN KEY ("private_uploads_id") REFERENCES "public"."private_uploads"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "checkouts_items_order_idx" ON "checkouts_items" USING btree ("_order");
  CREATE INDEX "checkouts_items_parent_id_idx" ON "checkouts_items" USING btree ("_parent_id");
  CREATE INDEX "checkouts_items_product_idx" ON "checkouts_items" USING btree ("product_id");
  CREATE INDEX "checkouts_deviation_agreements_order_idx" ON "checkouts_deviation_agreements" USING btree ("_order");
  CREATE INDEX "checkouts_deviation_agreements_parent_id_idx" ON "checkouts_deviation_agreements" USING btree ("_parent_id");
  CREATE INDEX "checkouts_deviation_agreements_product_idx" ON "checkouts_deviation_agreements" USING btree ("product_id");
  CREATE UNIQUE INDEX "checkouts_token_hash_idx" ON "checkouts" USING btree ("token_hash");
  CREATE UNIQUE INDEX "checkouts_reservation_ref_idx" ON "checkouts" USING btree ("reservation_ref");
  CREATE UNIQUE INDEX "checkouts_stripe_stripe_checkout_session_id_idx" ON "checkouts" USING btree ("stripe_checkout_session_id");
  CREATE INDEX "checkouts_order_idx" ON "checkouts" USING btree ("order_id");
  CREATE INDEX "checkouts_timestamps_timestamps_confirming_at_idx" ON "checkouts" USING btree ("timestamps_confirming_at");
  CREATE INDEX "checkouts_seed_idx" ON "checkouts" USING btree ("seed");
  CREATE INDEX "checkouts_seed_key_idx" ON "checkouts" USING btree ("seed_key");
  CREATE INDEX "checkouts_updated_at_idx" ON "checkouts" USING btree ("updated_at");
  CREATE INDEX "checkouts_created_at_idx" ON "checkouts" USING btree ("created_at");
  CREATE INDEX "status_expiresAt_idx" ON "checkouts" USING btree ("status","expires_at");
  CREATE INDEX "reservations_ref_idx" ON "reservations" USING btree ("ref");
  CREATE INDEX "reservations_checkout_idx" ON "reservations" USING btree ("checkout_id");
  CREATE INDEX "reservations_product_idx" ON "reservations" USING btree ("product_id");
  CREATE INDEX "reservations_order_idx" ON "reservations" USING btree ("order_id");
  CREATE INDEX "reservations_converted_at_idx" ON "reservations" USING btree ("converted_at");
  CREATE INDEX "reservations_released_at_idx" ON "reservations" USING btree ("released_at");
  CREATE INDEX "reservations_seed_idx" ON "reservations" USING btree ("seed");
  CREATE INDEX "reservations_seed_key_idx" ON "reservations" USING btree ("seed_key");
  CREATE INDEX "reservations_updated_at_idx" ON "reservations" USING btree ("updated_at");
  CREATE INDEX "reservations_created_at_idx" ON "reservations" USING btree ("created_at");
  CREATE INDEX "status_expiresAt_1_idx" ON "reservations" USING btree ("status","expires_at");
  CREATE INDEX "orders_status_history_order_idx" ON "orders_status_history" USING btree ("_order");
  CREATE INDEX "orders_status_history_parent_id_idx" ON "orders_status_history" USING btree ("_parent_id");
  CREATE INDEX "orders_items_order_idx" ON "orders_items" USING btree ("_order");
  CREATE INDEX "orders_items_parent_id_idx" ON "orders_items" USING btree ("_parent_id");
  CREATE INDEX "orders_items_product_idx" ON "orders_items" USING btree ("product_id");
  CREATE INDEX "orders_items_cover_image_idx" ON "orders_items" USING btree ("cover_image_id");
  CREATE INDEX "orders_packaging_components_order_idx" ON "orders_packaging_components" USING btree ("_order");
  CREATE INDEX "orders_packaging_components_parent_id_idx" ON "orders_packaging_components" USING btree ("_parent_id");
  CREATE INDEX "orders_refunds_order_idx" ON "orders_refunds" USING btree ("_order");
  CREATE INDEX "orders_refunds_parent_id_idx" ON "orders_refunds" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "orders_order_number_idx" ON "orders" USING btree ("order_number");
  CREATE UNIQUE INDEX "orders_checkout_idx" ON "orders" USING btree ("checkout_id");
  CREATE INDEX "orders_status_idx" ON "orders" USING btree ("status");
  CREATE INDEX "orders_customer_customer_email_idx" ON "orders" USING btree ("customer_email");
  CREATE UNIQUE INDEX "orders_stripe_stripe_checkout_session_id_idx" ON "orders" USING btree ("stripe_checkout_session_id");
  CREATE UNIQUE INDEX "orders_stripe_stripe_payment_intent_id_idx" ON "orders" USING btree ("stripe_payment_intent_id");
  CREATE INDEX "orders_prepayment_prepayment_due_at_idx" ON "orders" USING btree ("prepayment_due_at");
  CREATE INDEX "orders_prepayment_prepayment_reminder_due_at_idx" ON "orders" USING btree ("prepayment_reminder_due_at");
  CREATE INDEX "orders_timestamps_timestamps_placed_at_idx" ON "orders" USING btree ("timestamps_placed_at");
  CREATE INDEX "orders_timestamps_timestamps_shipped_at_idx" ON "orders" USING btree ("timestamps_shipped_at");
  CREATE INDEX "orders_timestamps_timestamps_final_status_at_idx" ON "orders" USING btree ("timestamps_final_status_at");
  CREATE UNIQUE INDEX "orders_status_token_hash_idx" ON "orders" USING btree ("status_token_hash");
  CREATE INDEX "orders_retain_until_idx" ON "orders" USING btree ("retain_until");
  CREATE INDEX "orders_seed_idx" ON "orders" USING btree ("seed");
  CREATE INDEX "orders_seed_key_idx" ON "orders" USING btree ("seed_key");
  CREATE INDEX "orders_updated_at_idx" ON "orders" USING btree ("updated_at");
  CREATE INDEX "orders_created_at_idx" ON "orders" USING btree ("created_at");
  CREATE INDEX "privacy_legalHold_idx" ON "orders" USING btree ("privacy_legal_hold");
  CREATE INDEX "orders_rels_order_idx" ON "orders_rels" USING btree ("order");
  CREATE INDEX "orders_rels_parent_idx" ON "orders_rels" USING btree ("parent_id");
  CREATE INDEX "orders_rels_path_idx" ON "orders_rels" USING btree ("path");
  CREATE INDEX "orders_rels_private_uploads_id_idx" ON "orders_rels" USING btree ("private_uploads_id");
  ALTER TABLE "products" ADD CONSTRAINT "products_current_order_id_orders_id_fk" FOREIGN KEY ("current_order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "email_log" ADD CONSTRAINT "email_log_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "consent_log" ADD CONSTRAINT "consent_log_checkout_id_checkouts_id_fk" FOREIGN KEY ("checkout_id") REFERENCES "public"."checkouts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "consent_log" ADD CONSTRAINT "consent_log_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "consent_log" ADD CONSTRAINT "consent_log_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "webhook_events" ADD CONSTRAINT "webhook_events_related_checkout_id_checkouts_id_fk" FOREIGN KEY ("related_checkout_id") REFERENCES "public"."checkouts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "webhook_events" ADD CONSTRAINT "webhook_events_related_order_id_orders_id_fk" FOREIGN KEY ("related_order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_checkouts_fk" FOREIGN KEY ("checkouts_id") REFERENCES "public"."checkouts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_reservations_fk" FOREIGN KEY ("reservations_id") REFERENCES "public"."reservations"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_orders_fk" FOREIGN KEY ("orders_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "products_current_order_idx" ON "products" USING btree ("current_order_id");
  CREATE INDEX "email_log_order_idx" ON "email_log" USING btree ("order_id");
  CREATE INDEX "consent_log_checkout_idx" ON "consent_log" USING btree ("checkout_id");
  CREATE INDEX "consent_log_order_idx" ON "consent_log" USING btree ("order_id");
  CREATE INDEX "consent_log_product_idx" ON "consent_log" USING btree ("product_id");
  CREATE INDEX "webhook_events_related_checkout_idx" ON "webhook_events" USING btree ("related_checkout_id");
  CREATE INDEX "webhook_events_related_order_idx" ON "webhook_events" USING btree ("related_order_id");
  CREATE INDEX "payload_locked_documents_rels_checkouts_id_idx" ON "payload_locked_documents_rels" USING btree ("checkouts_id");
  CREATE INDEX "payload_locked_documents_rels_reservations_id_idx" ON "payload_locked_documents_rels" USING btree ("reservations_id");
  CREATE INDEX "payload_locked_documents_rels_orders_id_idx" ON "payload_locked_documents_rels" USING btree ("orders_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "checkouts_items" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "checkouts_deviation_agreements" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "checkouts" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "reservations" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "orders_status_history" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "orders_items" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "orders_packaging_components" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "orders_refunds" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "orders" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "orders_rels" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "checkouts_items" CASCADE;
  DROP TABLE "checkouts_deviation_agreements" CASCADE;
  DROP TABLE "checkouts" CASCADE;
  DROP TABLE "reservations" CASCADE;
  DROP TABLE "orders_status_history" CASCADE;
  DROP TABLE "orders_items" CASCADE;
  DROP TABLE "orders_packaging_components" CASCADE;
  DROP TABLE "orders_refunds" CASCADE;
  DROP TABLE "orders" CASCADE;
  DROP TABLE "orders_rels" CASCADE;
  ALTER TABLE "products" DROP CONSTRAINT "products_current_order_id_orders_id_fk";
  
  ALTER TABLE "email_log" DROP CONSTRAINT "email_log_order_id_orders_id_fk";
  
  ALTER TABLE "consent_log" DROP CONSTRAINT "consent_log_checkout_id_checkouts_id_fk";
  
  ALTER TABLE "consent_log" DROP CONSTRAINT "consent_log_order_id_orders_id_fk";
  
  ALTER TABLE "consent_log" DROP CONSTRAINT "consent_log_product_id_products_id_fk";
  
  ALTER TABLE "webhook_events" DROP CONSTRAINT "webhook_events_related_checkout_id_checkouts_id_fk";
  
  ALTER TABLE "webhook_events" DROP CONSTRAINT "webhook_events_related_order_id_orders_id_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_checkouts_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_reservations_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_orders_fk";
  
  DROP INDEX "products_current_order_idx";
  DROP INDEX "email_log_order_idx";
  DROP INDEX "consent_log_checkout_idx";
  DROP INDEX "consent_log_order_idx";
  DROP INDEX "consent_log_product_idx";
  DROP INDEX "webhook_events_related_checkout_idx";
  DROP INDEX "webhook_events_related_order_idx";
  DROP INDEX "payload_locked_documents_rels_checkouts_id_idx";
  DROP INDEX "payload_locked_documents_rels_reservations_id_idx";
  DROP INDEX "payload_locked_documents_rels_orders_id_idx";
  ALTER TABLE "products" DROP COLUMN "current_order_id";
  ALTER TABLE "email_log" DROP COLUMN "order_id";
  ALTER TABLE "consent_log" DROP COLUMN "checkout_id";
  ALTER TABLE "consent_log" DROP COLUMN "order_id";
  ALTER TABLE "consent_log" DROP COLUMN "product_id";
  ALTER TABLE "webhook_events" DROP COLUMN "related_checkout_id";
  ALTER TABLE "webhook_events" DROP COLUMN "related_order_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "checkouts_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "reservations_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "orders_id";
  DROP TYPE "public"."enum_checkouts_items_category";
  DROP TYPE "public"."enum_checkouts_items_vat_category";
  DROP TYPE "public"."enum_checkouts_items_shipping_class";
  DROP TYPE "public"."enum_checkouts_status";
  DROP TYPE "public"."enum_checkouts_locale";
  DROP TYPE "public"."enum_checkouts_fulfillment_method";
  DROP TYPE "public"."enum_checkouts_shipping_zone";
  DROP TYPE "public"."enum_checkouts_shipping_class";
  DROP TYPE "public"."enum_checkouts_payment_choice";
  DROP TYPE "public"."enum_checkouts_shipping_address_country";
  DROP TYPE "public"."enum_checkouts_billing_address_country";
  DROP TYPE "public"."enum_checkouts_close_reason";
  DROP TYPE "public"."enum_reservations_source";
  DROP TYPE "public"."enum_reservations_status";
  DROP TYPE "public"."enum_reservations_release_reason";
  DROP TYPE "public"."enum_orders_status_history_from";
  DROP TYPE "public"."enum_orders_status_history_to";
  DROP TYPE "public"."enum_orders_status_history_actor_type";
  DROP TYPE "public"."enum_orders_items_category";
  DROP TYPE "public"."enum_orders_items_vat_category";
  DROP TYPE "public"."enum_orders_items_shipping_class";
  DROP TYPE "public"."enum_orders_items_food_contact";
  DROP TYPE "public"."enum_orders_items_status";
  DROP TYPE "public"."enum_orders_packaging_components_material";
  DROP TYPE "public"."enum_orders_refunds_reason";
  DROP TYPE "public"."enum_orders_refunds_status";
  DROP TYPE "public"."enum_orders_status";
  DROP TYPE "public"."enum_orders_status_before_withdrawal";
  DROP TYPE "public"."enum_orders_status_before_dispute";
  DROP TYPE "public"."enum_orders_cancel_reason";
  DROP TYPE "public"."enum_orders_locale";
  DROP TYPE "public"."enum_orders_fulfillment_method";
  DROP TYPE "public"."enum_orders_shipping_address_country";
  DROP TYPE "public"."enum_orders_billing_address_country";
  DROP TYPE "public"."enum_orders_shipping_zone";
  DROP TYPE "public"."enum_orders_shipping_class";
  DROP TYPE "public"."enum_orders_currency";
  DROP TYPE "public"."enum_orders_tax_mode_at_order";
  DROP TYPE "public"."enum_orders_payment_method";
  DROP TYPE "public"."enum_orders_payment_provider";
  DROP TYPE "public"."enum_orders_shipment_carrier";
  DROP TYPE "public"."enum_orders_shipment_delivered_source";
  DROP TYPE "public"."enum_orders_dispute_status";
  DROP TYPE "public"."enum_orders_admin_attention_reason";`)
}
