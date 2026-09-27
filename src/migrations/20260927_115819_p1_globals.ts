import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_settings_tax_modes_mode" AS ENUM('kleinunternehmer', 'regelbesteuert');
  CREATE TYPE "public"."enum_settings_shipping_enabled_countries" AS ENUM('DE', 'AT', 'BE', 'BG', 'CY', 'CZ', 'DK', 'EE', 'ES', 'FI', 'FR', 'GR', 'HR', 'HU', 'IE', 'IT', 'LT', 'LU', 'LV', 'MT', 'NL', 'PL', 'PT', 'RO', 'SE', 'SI', 'SK', 'CH');
  CREATE TYPE "public"."enum_settings_shipping_rates_zone" AS ENUM('DE', 'EU', 'CH');
  CREATE TYPE "public"."enum_settings_rates_class" AS ENUM('brief', 'paket_klein', 'keramik');
  CREATE TYPE "public"."enum_settings_tracking_carrier" AS ENUM('dhl', 'deutsche_post', 'other');
  CREATE TYPE "public"."enum_settings_pkg_material" AS ENUM('paper_cardboard', 'plastic', 'other');
  CREATE TYPE "public"."enum_settings_pkg_class" AS ENUM('brief', 'paket_klein', 'keramik');
  CREATE TYPE "public"."enum_settings_legal_reviews_type" AS ENUM('impressum', 'datenschutz', 'agb', 'widerrufsbelehrung', 'widerrufsformular', 'versand-zahlung');
  CREATE TYPE "public"."enum_settings_safety_templates_category" AS ENUM('keramik', 'textil', 'cap', 'zeichnung', 'schmuck', 'sonstiges');
  CREATE TYPE "public"."enum_settings_care_templates_category" AS ENUM('textil', 'cap');
  CREATE TYPE "public"."enum_settings_packing_checklists_shipping_class" AS ENUM('brief', 'paket_klein', 'keramik', 'nur_abholung');
  CREATE TYPE "public"."enum_settings_business_country" AS ENUM('DE', 'AT', 'BE', 'BG', 'CY', 'CZ', 'DK', 'EE', 'ES', 'FI', 'FR', 'GR', 'HR', 'HU', 'IE', 'IT', 'LT', 'LU', 'LV', 'MT', 'NL', 'PL', 'PT', 'RO', 'SE', 'SI', 'SK', 'CH');
  CREATE TYPE "public"."enum_settings_retention_invoice_years" AS ENUM('8', '10');
  CREATE TYPE "public"."enum__settings_v_version_tax_modes_mode" AS ENUM('kleinunternehmer', 'regelbesteuert');
  CREATE TYPE "public"."enum__settings_v_version_shipping_enabled_countries" AS ENUM('DE', 'AT', 'BE', 'BG', 'CY', 'CZ', 'DK', 'EE', 'ES', 'FI', 'FR', 'GR', 'HR', 'HU', 'IE', 'IT', 'LT', 'LU', 'LV', 'MT', 'NL', 'PL', 'PT', 'RO', 'SE', 'SI', 'SK', 'CH');
  CREATE TYPE "public"."enum__settings_v_version_shipping_rates_zone" AS ENUM('DE', 'EU', 'CH');
  CREATE TYPE "public"."enum__settings_v_version_legal_reviews_type" AS ENUM('impressum', 'datenschutz', 'agb', 'widerrufsbelehrung', 'widerrufsformular', 'versand-zahlung');
  CREATE TYPE "public"."enum__settings_v_version_safety_templates_category" AS ENUM('keramik', 'textil', 'cap', 'zeichnung', 'schmuck', 'sonstiges');
  CREATE TYPE "public"."enum__settings_v_version_care_templates_category" AS ENUM('textil', 'cap');
  CREATE TYPE "public"."enum__settings_v_version_packing_checklists_shipping_class" AS ENUM('brief', 'paket_klein', 'keramik', 'nur_abholung');
  CREATE TYPE "public"."enum__settings_v_version_business_country" AS ENUM('DE', 'AT', 'BE', 'BG', 'CY', 'CZ', 'DK', 'EE', 'ES', 'FI', 'FR', 'GR', 'HR', 'HU', 'IE', 'IT', 'LT', 'LU', 'LV', 'MT', 'NL', 'PL', 'PT', 'RO', 'SE', 'SI', 'SK', 'CH');
  CREATE TYPE "public"."enum__settings_v_version_retention_invoice_years" AS ENUM('8', '10');
  CREATE TYPE "public"."enum_site_texts_navigation_main_links_target" AS ENUM('home', 'shop', 'archive', 'category', 'tattoo', 'tattoo_aftercare', 'about', 'commissions', 'contact', 'conformity', 'instagram', 'email');
  CREATE TYPE "public"."enum_site_texts_navigation_main_links_category" AS ENUM('keramik', 'textil', 'cap', 'zeichnung', 'schmuck', 'sonstiges');
  CREATE TYPE "public"."enum_site_texts_navigation_menu_links_target" AS ENUM('home', 'shop', 'archive', 'category', 'tattoo', 'tattoo_aftercare', 'about', 'commissions', 'contact', 'conformity', 'instagram', 'email');
  CREATE TYPE "public"."enum_site_texts_navigation_menu_links_category" AS ENUM('keramik', 'textil', 'cap', 'zeichnung', 'schmuck', 'sonstiges');
  CREATE TYPE "public"."enum_site_texts_emails_templates_template" AS ENUM('order_confirmation', 'prepayment_instructions', 'prepayment_reminder', 'prepayment_cancelled', 'prepayment_received', 'order_shipped', 'pickup_ready', 'withdrawal_receipt', 'refund_confirmation', 'oversold_apology', 'inquiry_receipt', 'complaint_repair_choice', 'dispute_vsbg', 'privacy_access_response', 'privacy_erasure_response', 'consent_withdrawal_confirmation', 'admin_order_placed', 'admin_prepayment_cancelled', 'admin_withdrawal_received', 'admin_inquiry_received', 'admin_oversold', 'admin_dispute_opened', 'admin_refund_failed', 'admin_revenue_guard', 'admin_legal_review_due', 'admin_monthly_close', 'admin_alert', 'admin_withdrawal_deadline', 'admin_password_reset', 'admin_privacy_request_due', 'admin_legal_hold_review', 'admin_compliance_docs_review');
  CREATE TYPE "public"."enum__site_texts_v_version_navigation_main_links_target" AS ENUM('home', 'shop', 'archive', 'category', 'tattoo', 'tattoo_aftercare', 'about', 'commissions', 'contact', 'conformity', 'instagram', 'email');
  CREATE TYPE "public"."enum__site_texts_v_version_navigation_main_links_category" AS ENUM('keramik', 'textil', 'cap', 'zeichnung', 'schmuck', 'sonstiges');
  CREATE TYPE "public"."enum__site_texts_v_version_navigation_menu_links_target" AS ENUM('home', 'shop', 'archive', 'category', 'tattoo', 'tattoo_aftercare', 'about', 'commissions', 'contact', 'conformity', 'instagram', 'email');
  CREATE TYPE "public"."enum__site_texts_v_version_navigation_menu_links_category" AS ENUM('keramik', 'textil', 'cap', 'zeichnung', 'schmuck', 'sonstiges');
  CREATE TYPE "public"."enum__site_texts_v_version_emails_templates_template" AS ENUM('order_confirmation', 'prepayment_instructions', 'prepayment_reminder', 'prepayment_cancelled', 'prepayment_received', 'order_shipped', 'pickup_ready', 'withdrawal_receipt', 'refund_confirmation', 'oversold_apology', 'inquiry_receipt', 'complaint_repair_choice', 'dispute_vsbg', 'privacy_access_response', 'privacy_erasure_response', 'consent_withdrawal_confirmation', 'admin_order_placed', 'admin_prepayment_cancelled', 'admin_withdrawal_received', 'admin_inquiry_received', 'admin_oversold', 'admin_dispute_opened', 'admin_refund_failed', 'admin_revenue_guard', 'admin_legal_review_due', 'admin_monthly_close', 'admin_alert', 'admin_withdrawal_deadline', 'admin_password_reset', 'admin_privacy_request_due', 'admin_legal_hold_review', 'admin_compliance_docs_review');
  CREATE TABLE "settings_tax_modes" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"mode" "enum_settings_tax_modes_mode" NOT NULL,
  	"valid_from" timestamp(3) with time zone NOT NULL,
  	"reason" varchar,
  	"confirmed_with_tax_advisor" boolean DEFAULT false
  );
  
  CREATE TABLE "settings_revenue_guard_manual_year_totals" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"year" numeric NOT NULL,
  	"amount_cents" numeric NOT NULL,
  	"note" varchar
  );
  
  CREATE TABLE "settings_costs_monthly_entries" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"month" varchar NOT NULL,
  	"amount_cents" numeric NOT NULL,
  	"note" varchar
  );
  
  CREATE TABLE "settings_shipping_enabled_countries" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_settings_shipping_enabled_countries",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "settings_shipping_rates" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"zone" "enum_settings_shipping_rates_zone" NOT NULL,
  	"shipping_class" "enum_settings_rates_class" NOT NULL,
  	"price_cents" numeric NOT NULL
  );
  
  CREATE TABLE "settings_tracking" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"carrier" "enum_settings_tracking_carrier" NOT NULL,
  	"url_template" varchar NOT NULL
  );
  
  CREATE TABLE "settings_pkg_components" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"material" "enum_settings_pkg_material" NOT NULL,
  	"grams" numeric NOT NULL
  );
  
  CREATE TABLE "settings_pkg_templates" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"key" varchar NOT NULL,
  	"name" varchar NOT NULL
  );
  
  CREATE TABLE "settings_pkg_defaults" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"shipping_class" "enum_settings_pkg_class" NOT NULL,
  	"template_key" varchar NOT NULL
  );
  
  CREATE TABLE "settings_legal_reviews" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"type" "enum_settings_legal_reviews_type" NOT NULL,
  	"reviewed_at" timestamp(3) with time zone,
  	"last_reminder_sent_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "settings_safety_templates" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"category" "enum_settings_safety_templates_category" NOT NULL
  );
  
  CREATE TABLE "settings_safety_templates_locales" (
  	"text" varchar NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "settings_care_templates" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"category" "enum_settings_care_templates_category" NOT NULL
  );
  
  CREATE TABLE "settings_care_templates_locales" (
  	"text" varchar NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "settings_packing_checklists_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"text" varchar NOT NULL
  );
  
  CREATE TABLE "settings_packing_checklists" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"shipping_class" "enum_settings_packing_checklists_shipping_class" NOT NULL
  );
  
  CREATE TABLE "settings_processor_agreements" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"service_id" varchar NOT NULL,
  	"signed_at" timestamp(3) with time zone,
  	"document_version" varchar,
  	"url" varchar,
  	"file_id" integer
  );
  
  CREATE TABLE "settings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"shop_is_open" boolean DEFAULT true,
  	"shop_max_items_per_checkout" numeric DEFAULT 10,
  	"business_legal_name" varchar DEFAULT '[Name folgt]' NOT NULL,
  	"business_trade_name" varchar DEFAULT 'Planet Claire',
  	"business_street" varchar DEFAULT '[Adresse folgt]' NOT NULL,
  	"business_postal_code" varchar DEFAULT '00000',
  	"business_city" varchar DEFAULT 'Berlin' NOT NULL,
  	"business_country" "enum_settings_business_country" DEFAULT 'DE',
  	"business_email" varchar DEFAULT 'jutta@planetclairetattoos.com' NOT NULL,
  	"business_phone" varchar DEFAULT '[Telefon folgt]',
  	"business_vat_id" varchar,
  	"business_economic_id" varchar,
  	"business_tax_number" varchar,
  	"business_return_address" varchar,
  	"business_lucid_number" varchar,
  	"business_packaging_scheme_name" varchar,
  	"business_packaging_scheme_contract_from" timestamp(3) with time zone,
  	"social_instagram_handle" varchar DEFAULT 'planet.claire.tattoos',
  	"social_contact_email" varchar DEFAULT 'jutta@planetclairetattoos.com',
  	"tax_confirmed_at" timestamp(3) with time zone,
  	"tax_standard_rate" numeric DEFAULT 19,
  	"tax_reduced_rate" numeric DEFAULT 7,
  	"revenue_guard_previous_year_limit_cents" numeric DEFAULT 2500000,
  	"revenue_guard_current_year_limit_cents" numeric DEFAULT 10000000,
  	"revenue_guard_stage_thresholds_cents_u1" numeric DEFAULT 2000000,
  	"revenue_guard_stage_thresholds_cents_u3" numeric DEFAULT 8000000,
  	"revenue_guard_stage_thresholds_cents_u3a" numeric DEFAULT 9000000,
  	"revenue_guard_stage_thresholds_cents_u4" numeric DEFAULT 9500000,
  	"revenue_guard_last_notified" jsonb DEFAULT '{}'::jsonb,
  	"retention_invoice_years" "enum_settings_retention_invoice_years" DEFAULT '10',
  	"export_datev_consultant_number" varchar,
  	"export_datev_client_number" varchar,
  	"export_datev_fiscal_year_start" varchar DEFAULT '01-01',
  	"export_datev_revenue_account" varchar,
  	"export_datev_stripe_transit_account" varchar,
  	"export_datev_bank_account" varchar,
  	"export_datev_fee_account" varchar,
  	"costs_budget_cents" numeric DEFAULT 2500,
  	"costs_warning_threshold_cents" numeric DEFAULT 3000,
  	"shipping_eu_shipping_acknowledged" boolean DEFAULT false,
  	"shipping_eu_shipping_acknowledged_at" timestamp(3) with time zone,
  	"shipping_eu_checklist_authorised_representative_named" boolean DEFAULT false,
  	"shipping_eu_checklist_oss_threshold_checked" boolean DEFAULT false,
  	"shipping_eu_checklist_textile_language_checked" boolean DEFAULT false,
  	"shipping_eu_checklist_rates_maintained" boolean DEFAULT false,
  	"shipping_eu_checklist_legal_texts_adapted" boolean DEFAULT false,
  	"shipping_pickup_enabled" boolean DEFAULT true,
  	"shipping_pickup_city" varchar DEFAULT 'Berlin',
  	"shipping_insurance_hint_threshold_cents" numeric DEFAULT 50000,
  	"payment_prepayment_enabled" boolean DEFAULT true,
  	"payment_account_holder" varchar DEFAULT '[Kontoinhaberin folgt]',
  	"payment_iban" varchar DEFAULT 'DE36000000000000000000',
  	"payment_bic" varchar,
  	"payment_bank_name" varchar,
  	"payment_reservation_minutes" numeric DEFAULT 30,
  	"payment_prepayment_days" numeric DEFAULT 5,
  	"payment_prepayment_reminder_hours" numeric DEFAULT 72,
  	"payment_stripe_payment_method_configuration_id" varchar,
  	"tattoo_studio_district" varchar DEFAULT '[Bezirk folgt]',
  	"tattoo_min_price_cents" numeric,
  	"tattoo_custom_price_from_cents" numeric,
  	"tattoo_custom_price_to_cents" numeric,
  	"legal_review_interval_days" numeric DEFAULT 365,
  	"legal_allow_visible_blank_brands" boolean DEFAULT false,
  	"analytics_enabled" boolean DEFAULT false,
  	"analytics_confirmed_at" timestamp(3) with time zone,
  	"analytics_note" varchar,
  	"admin_notification_email" varchar,
  	"seed_example_data_present" boolean,
  	"seed_imported_at" timestamp(3) with time zone,
  	"seed_removed_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "settings_locales" (
  	"shop_closed_message" varchar,
  	"shipping_delivery_time_text" varchar,
  	"pickup_instructions" varchar,
  	"tattoo_price_note" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "_settings_v_version_tax_modes" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"mode" "enum__settings_v_version_tax_modes_mode" NOT NULL,
  	"valid_from" timestamp(3) with time zone NOT NULL,
  	"reason" varchar,
  	"confirmed_with_tax_advisor" boolean DEFAULT false,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_settings_v_version_revenue_guard_manual_year_totals" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"year" numeric NOT NULL,
  	"amount_cents" numeric NOT NULL,
  	"note" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_settings_v_version_costs_monthly_entries" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"month" varchar NOT NULL,
  	"amount_cents" numeric NOT NULL,
  	"note" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_settings_v_version_shipping_enabled_countries" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum__settings_v_version_shipping_enabled_countries",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "_settings_v_version_shipping_rates" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"zone" "enum__settings_v_version_shipping_rates_zone" NOT NULL,
  	"shipping_class" "enum_settings_rates_class" NOT NULL,
  	"price_cents" numeric NOT NULL,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_settings_tracking_v" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"carrier" "enum_settings_tracking_carrier" NOT NULL,
  	"url_template" varchar NOT NULL,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_settings_pkg_components_v" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"material" "enum_settings_pkg_material" NOT NULL,
  	"grams" numeric NOT NULL,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_settings_pkg_templates_v" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar NOT NULL,
  	"name" varchar NOT NULL,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_settings_pkg_defaults_v" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"shipping_class" "enum_settings_pkg_class" NOT NULL,
  	"template_key" varchar NOT NULL,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_settings_v_version_legal_reviews" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"type" "enum__settings_v_version_legal_reviews_type" NOT NULL,
  	"reviewed_at" timestamp(3) with time zone,
  	"last_reminder_sent_at" timestamp(3) with time zone,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_settings_v_version_safety_templates" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"category" "enum__settings_v_version_safety_templates_category" NOT NULL,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_settings_v_version_safety_templates_locales" (
  	"text" varchar NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "_settings_v_version_care_templates" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"category" "enum__settings_v_version_care_templates_category" NOT NULL,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_settings_v_version_care_templates_locales" (
  	"text" varchar NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "_settings_v_version_packing_checklists_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"text" varchar NOT NULL,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_settings_v_version_packing_checklists" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"shipping_class" "enum__settings_v_version_packing_checklists_shipping_class" NOT NULL,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_settings_v_version_processor_agreements" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"service_id" varchar NOT NULL,
  	"signed_at" timestamp(3) with time zone,
  	"document_version" varchar,
  	"url" varchar,
  	"file_id" integer,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_settings_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"version_shop_is_open" boolean DEFAULT true,
  	"version_shop_max_items_per_checkout" numeric DEFAULT 10,
  	"version_business_legal_name" varchar DEFAULT '[Name folgt]' NOT NULL,
  	"version_business_trade_name" varchar DEFAULT 'Planet Claire',
  	"version_business_street" varchar DEFAULT '[Adresse folgt]' NOT NULL,
  	"version_business_postal_code" varchar DEFAULT '00000',
  	"version_business_city" varchar DEFAULT 'Berlin' NOT NULL,
  	"version_business_country" "enum__settings_v_version_business_country" DEFAULT 'DE',
  	"version_business_email" varchar DEFAULT 'jutta@planetclairetattoos.com' NOT NULL,
  	"version_business_phone" varchar DEFAULT '[Telefon folgt]',
  	"version_business_vat_id" varchar,
  	"version_business_economic_id" varchar,
  	"version_business_tax_number" varchar,
  	"version_business_return_address" varchar,
  	"version_business_lucid_number" varchar,
  	"version_business_packaging_scheme_name" varchar,
  	"version_business_packaging_scheme_contract_from" timestamp(3) with time zone,
  	"version_social_instagram_handle" varchar DEFAULT 'planet.claire.tattoos',
  	"version_social_contact_email" varchar DEFAULT 'jutta@planetclairetattoos.com',
  	"version_tax_confirmed_at" timestamp(3) with time zone,
  	"version_tax_standard_rate" numeric DEFAULT 19,
  	"version_tax_reduced_rate" numeric DEFAULT 7,
  	"version_revenue_guard_previous_year_limit_cents" numeric DEFAULT 2500000,
  	"version_revenue_guard_current_year_limit_cents" numeric DEFAULT 10000000,
  	"version_revenue_guard_stage_thresholds_cents_u1" numeric DEFAULT 2000000,
  	"version_revenue_guard_stage_thresholds_cents_u3" numeric DEFAULT 8000000,
  	"version_revenue_guard_stage_thresholds_cents_u3a" numeric DEFAULT 9000000,
  	"version_revenue_guard_stage_thresholds_cents_u4" numeric DEFAULT 9500000,
  	"version_revenue_guard_last_notified" jsonb DEFAULT '{}'::jsonb,
  	"version_retention_invoice_years" "enum__settings_v_version_retention_invoice_years" DEFAULT '10',
  	"version_export_datev_consultant_number" varchar,
  	"version_export_datev_client_number" varchar,
  	"version_export_datev_fiscal_year_start" varchar DEFAULT '01-01',
  	"version_export_datev_revenue_account" varchar,
  	"version_export_datev_stripe_transit_account" varchar,
  	"version_export_datev_bank_account" varchar,
  	"version_export_datev_fee_account" varchar,
  	"version_costs_budget_cents" numeric DEFAULT 2500,
  	"version_costs_warning_threshold_cents" numeric DEFAULT 3000,
  	"version_shipping_eu_shipping_acknowledged" boolean DEFAULT false,
  	"version_shipping_eu_shipping_acknowledged_at" timestamp(3) with time zone,
  	"version_shipping_eu_checklist_authorised_representative_named" boolean DEFAULT false,
  	"version_shipping_eu_checklist_oss_threshold_checked" boolean DEFAULT false,
  	"version_shipping_eu_checklist_textile_language_checked" boolean DEFAULT false,
  	"version_shipping_eu_checklist_rates_maintained" boolean DEFAULT false,
  	"version_shipping_eu_checklist_legal_texts_adapted" boolean DEFAULT false,
  	"version_shipping_pickup_enabled" boolean DEFAULT true,
  	"version_shipping_pickup_city" varchar DEFAULT 'Berlin',
  	"version_shipping_insurance_hint_threshold_cents" numeric DEFAULT 50000,
  	"version_payment_prepayment_enabled" boolean DEFAULT true,
  	"version_payment_account_holder" varchar DEFAULT '[Kontoinhaberin folgt]',
  	"version_payment_iban" varchar DEFAULT 'DE36000000000000000000',
  	"version_payment_bic" varchar,
  	"version_payment_bank_name" varchar,
  	"version_payment_reservation_minutes" numeric DEFAULT 30,
  	"version_payment_prepayment_days" numeric DEFAULT 5,
  	"version_payment_prepayment_reminder_hours" numeric DEFAULT 72,
  	"version_payment_stripe_payment_method_configuration_id" varchar,
  	"version_tattoo_studio_district" varchar DEFAULT '[Bezirk folgt]',
  	"version_tattoo_min_price_cents" numeric,
  	"version_tattoo_custom_price_from_cents" numeric,
  	"version_tattoo_custom_price_to_cents" numeric,
  	"version_legal_review_interval_days" numeric DEFAULT 365,
  	"version_legal_allow_visible_blank_brands" boolean DEFAULT false,
  	"version_analytics_enabled" boolean DEFAULT false,
  	"version_analytics_confirmed_at" timestamp(3) with time zone,
  	"version_analytics_note" varchar,
  	"version_admin_notification_email" varchar,
  	"version_seed_example_data_present" boolean,
  	"version_seed_imported_at" timestamp(3) with time zone,
  	"version_seed_removed_at" timestamp(3) with time zone,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "_settings_v_locales" (
  	"version_shop_closed_message" varchar,
  	"version_shipping_delivery_time_text" varchar,
  	"version_pickup_instructions" varchar,
  	"version_tattoo_price_note" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "site_texts_navigation_main_links" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"target" "enum_site_texts_navigation_main_links_target" NOT NULL,
  	"category" "enum_site_texts_navigation_main_links_category"
  );
  
  CREATE TABLE "site_texts_navigation_main_links_locales" (
  	"label" varchar NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "site_texts_navigation_menu_links" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"target" "enum_site_texts_navigation_menu_links_target" NOT NULL,
  	"category" "enum_site_texts_navigation_menu_links_category"
  );
  
  CREATE TABLE "site_texts_navigation_menu_links_locales" (
  	"label" varchar NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "site_texts_emails_templates" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"template" "enum_site_texts_emails_templates_template" NOT NULL
  );
  
  CREATE TABLE "site_texts_emails_templates_locales" (
  	"subject" varchar,
  	"intro" varchar,
  	"outro" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "site_texts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "site_texts_locales" (
  	"navigation_menu_tagline" varchar,
  	"footer_tagline" varchar,
  	"footer_instagram_label" varchar,
  	"shop_filter_all" varchar,
  	"shop_filter_available_only" varchar,
  	"shop_sold_stamp" varchar,
  	"shop_reserved_label" varchar,
  	"shop_reserved_prepayment_label" varchar,
  	"shop_unique_hint" varchar,
  	"shop_empty_category" varchar,
  	"shop_archive_intro" varchar,
  	"product_add_to_cart" varchar,
  	"product_shipping_link_label" varchar,
  	"product_manufacturer_heading" varchar,
  	"product_deviation_heading" varchar,
  	"product_fiber_heading" varchar,
  	"product_label_missing_hint" varchar,
  	"cart_empty" varchar,
  	"cart_countdown" varchar,
  	"cart_reservation_expired" varchar,
  	"cart_pickup_option" varchar,
  	"cart_shipping_option" varchar,
  	"checkout_intro" varchar,
  	"checkout_change_link" varchar,
  	"thanks_heading" varchar,
  	"thanks_intro" varchar,
  	"order_status_intro" varchar,
  	"order_status_link_invalid" varchar,
  	"withdrawal_intro" varchar,
  	"withdrawal_done" varchar,
  	"not_found_heading" varchar,
  	"not_found_intro" varchar,
  	"errors_generic" varchar,
  	"errors_shop_closed" varchar,
  	"errors_already_reserved" varchar,
  	"emails_signature" varchar,
  	"emails_inquiry_response_time" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "_site_texts_v_version_navigation_main_links" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"target" "enum__site_texts_v_version_navigation_main_links_target" NOT NULL,
  	"category" "enum__site_texts_v_version_navigation_main_links_category",
  	"_uuid" varchar
  );
  
  CREATE TABLE "_site_texts_v_version_navigation_main_links_locales" (
  	"label" varchar NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "_site_texts_v_version_navigation_menu_links" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"target" "enum__site_texts_v_version_navigation_menu_links_target" NOT NULL,
  	"category" "enum__site_texts_v_version_navigation_menu_links_category",
  	"_uuid" varchar
  );
  
  CREATE TABLE "_site_texts_v_version_navigation_menu_links_locales" (
  	"label" varchar NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "_site_texts_v_version_emails_templates" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"template" "enum__site_texts_v_version_emails_templates_template" NOT NULL,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_site_texts_v_version_emails_templates_locales" (
  	"subject" varchar,
  	"intro" varchar,
  	"outro" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "_site_texts_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "_site_texts_v_locales" (
  	"version_navigation_menu_tagline" varchar,
  	"version_footer_tagline" varchar,
  	"version_footer_instagram_label" varchar,
  	"version_shop_filter_all" varchar,
  	"version_shop_filter_available_only" varchar,
  	"version_shop_sold_stamp" varchar,
  	"version_shop_reserved_label" varchar,
  	"version_shop_reserved_prepayment_label" varchar,
  	"version_shop_unique_hint" varchar,
  	"version_shop_empty_category" varchar,
  	"version_shop_archive_intro" varchar,
  	"version_product_add_to_cart" varchar,
  	"version_product_shipping_link_label" varchar,
  	"version_product_manufacturer_heading" varchar,
  	"version_product_deviation_heading" varchar,
  	"version_product_fiber_heading" varchar,
  	"version_product_label_missing_hint" varchar,
  	"version_cart_empty" varchar,
  	"version_cart_countdown" varchar,
  	"version_cart_reservation_expired" varchar,
  	"version_cart_pickup_option" varchar,
  	"version_cart_shipping_option" varchar,
  	"version_checkout_intro" varchar,
  	"version_checkout_change_link" varchar,
  	"version_thanks_heading" varchar,
  	"version_thanks_intro" varchar,
  	"version_order_status_intro" varchar,
  	"version_order_status_link_invalid" varchar,
  	"version_withdrawal_intro" varchar,
  	"version_withdrawal_done" varchar,
  	"version_not_found_heading" varchar,
  	"version_not_found_intro" varchar,
  	"version_errors_generic" varchar,
  	"version_errors_shop_closed" varchar,
  	"version_errors_already_reserved" varchar,
  	"version_emails_signature" varchar,
  	"version_emails_inquiry_response_time" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  ALTER TABLE "settings_tax_modes" ADD CONSTRAINT "settings_tax_modes_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "settings_revenue_guard_manual_year_totals" ADD CONSTRAINT "settings_revenue_guard_manual_year_totals_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "settings_costs_monthly_entries" ADD CONSTRAINT "settings_costs_monthly_entries_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "settings_shipping_enabled_countries" ADD CONSTRAINT "settings_shipping_enabled_countries_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "settings_shipping_rates" ADD CONSTRAINT "settings_shipping_rates_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "settings_tracking" ADD CONSTRAINT "settings_tracking_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "settings_pkg_components" ADD CONSTRAINT "settings_pkg_components_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."settings_pkg_templates"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "settings_pkg_templates" ADD CONSTRAINT "settings_pkg_templates_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "settings_pkg_defaults" ADD CONSTRAINT "settings_pkg_defaults_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "settings_legal_reviews" ADD CONSTRAINT "settings_legal_reviews_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "settings_safety_templates" ADD CONSTRAINT "settings_safety_templates_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "settings_safety_templates_locales" ADD CONSTRAINT "settings_safety_templates_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."settings_safety_templates"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "settings_care_templates" ADD CONSTRAINT "settings_care_templates_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "settings_care_templates_locales" ADD CONSTRAINT "settings_care_templates_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."settings_care_templates"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "settings_packing_checklists_items" ADD CONSTRAINT "settings_packing_checklists_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."settings_packing_checklists"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "settings_packing_checklists" ADD CONSTRAINT "settings_packing_checklists_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "settings_processor_agreements" ADD CONSTRAINT "settings_processor_agreements_file_id_private_uploads_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."private_uploads"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "settings_processor_agreements" ADD CONSTRAINT "settings_processor_agreements_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "settings_locales" ADD CONSTRAINT "settings_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_settings_v_version_tax_modes" ADD CONSTRAINT "_settings_v_version_tax_modes_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_settings_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_settings_v_version_revenue_guard_manual_year_totals" ADD CONSTRAINT "_settings_v_version_revenue_guard_manual_year_totals_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_settings_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_settings_v_version_costs_monthly_entries" ADD CONSTRAINT "_settings_v_version_costs_monthly_entries_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_settings_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_settings_v_version_shipping_enabled_countries" ADD CONSTRAINT "_settings_v_version_shipping_enabled_countries_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_settings_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_settings_v_version_shipping_rates" ADD CONSTRAINT "_settings_v_version_shipping_rates_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_settings_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_settings_tracking_v" ADD CONSTRAINT "_settings_tracking_v_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_settings_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_settings_pkg_components_v" ADD CONSTRAINT "_settings_pkg_components_v_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_settings_pkg_templates_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_settings_pkg_templates_v" ADD CONSTRAINT "_settings_pkg_templates_v_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_settings_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_settings_pkg_defaults_v" ADD CONSTRAINT "_settings_pkg_defaults_v_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_settings_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_settings_v_version_legal_reviews" ADD CONSTRAINT "_settings_v_version_legal_reviews_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_settings_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_settings_v_version_safety_templates" ADD CONSTRAINT "_settings_v_version_safety_templates_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_settings_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_settings_v_version_safety_templates_locales" ADD CONSTRAINT "_settings_v_version_safety_templates_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_settings_v_version_safety_templates"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_settings_v_version_care_templates" ADD CONSTRAINT "_settings_v_version_care_templates_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_settings_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_settings_v_version_care_templates_locales" ADD CONSTRAINT "_settings_v_version_care_templates_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_settings_v_version_care_templates"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_settings_v_version_packing_checklists_items" ADD CONSTRAINT "_settings_v_version_packing_checklists_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_settings_v_version_packing_checklists"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_settings_v_version_packing_checklists" ADD CONSTRAINT "_settings_v_version_packing_checklists_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_settings_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_settings_v_version_processor_agreements" ADD CONSTRAINT "_settings_v_version_processor_agreements_file_id_private_uploads_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."private_uploads"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_settings_v_version_processor_agreements" ADD CONSTRAINT "_settings_v_version_processor_agreements_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_settings_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_settings_v_locales" ADD CONSTRAINT "_settings_v_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_settings_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "site_texts_navigation_main_links" ADD CONSTRAINT "site_texts_navigation_main_links_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."site_texts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "site_texts_navigation_main_links_locales" ADD CONSTRAINT "site_texts_navigation_main_links_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."site_texts_navigation_main_links"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "site_texts_navigation_menu_links" ADD CONSTRAINT "site_texts_navigation_menu_links_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."site_texts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "site_texts_navigation_menu_links_locales" ADD CONSTRAINT "site_texts_navigation_menu_links_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."site_texts_navigation_menu_links"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "site_texts_emails_templates" ADD CONSTRAINT "site_texts_emails_templates_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."site_texts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "site_texts_emails_templates_locales" ADD CONSTRAINT "site_texts_emails_templates_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."site_texts_emails_templates"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "site_texts_locales" ADD CONSTRAINT "site_texts_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."site_texts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_site_texts_v_version_navigation_main_links" ADD CONSTRAINT "_site_texts_v_version_navigation_main_links_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_site_texts_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_site_texts_v_version_navigation_main_links_locales" ADD CONSTRAINT "_site_texts_v_version_navigation_main_links_locales_paren_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_site_texts_v_version_navigation_main_links"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_site_texts_v_version_navigation_menu_links" ADD CONSTRAINT "_site_texts_v_version_navigation_menu_links_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_site_texts_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_site_texts_v_version_navigation_menu_links_locales" ADD CONSTRAINT "_site_texts_v_version_navigation_menu_links_locales_paren_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_site_texts_v_version_navigation_menu_links"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_site_texts_v_version_emails_templates" ADD CONSTRAINT "_site_texts_v_version_emails_templates_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_site_texts_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_site_texts_v_version_emails_templates_locales" ADD CONSTRAINT "_site_texts_v_version_emails_templates_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_site_texts_v_version_emails_templates"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_site_texts_v_locales" ADD CONSTRAINT "_site_texts_v_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_site_texts_v"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "settings_tax_modes_order_idx" ON "settings_tax_modes" USING btree ("_order");
  CREATE INDEX "settings_tax_modes_parent_id_idx" ON "settings_tax_modes" USING btree ("_parent_id");
  CREATE INDEX "settings_revenue_guard_manual_year_totals_order_idx" ON "settings_revenue_guard_manual_year_totals" USING btree ("_order");
  CREATE INDEX "settings_revenue_guard_manual_year_totals_parent_id_idx" ON "settings_revenue_guard_manual_year_totals" USING btree ("_parent_id");
  CREATE INDEX "settings_costs_monthly_entries_order_idx" ON "settings_costs_monthly_entries" USING btree ("_order");
  CREATE INDEX "settings_costs_monthly_entries_parent_id_idx" ON "settings_costs_monthly_entries" USING btree ("_parent_id");
  CREATE INDEX "settings_shipping_enabled_countries_order_idx" ON "settings_shipping_enabled_countries" USING btree ("order");
  CREATE INDEX "settings_shipping_enabled_countries_parent_idx" ON "settings_shipping_enabled_countries" USING btree ("parent_id");
  CREATE INDEX "settings_shipping_rates_order_idx" ON "settings_shipping_rates" USING btree ("_order");
  CREATE INDEX "settings_shipping_rates_parent_id_idx" ON "settings_shipping_rates" USING btree ("_parent_id");
  CREATE INDEX "settings_tracking_order_idx" ON "settings_tracking" USING btree ("_order");
  CREATE INDEX "settings_tracking_parent_id_idx" ON "settings_tracking" USING btree ("_parent_id");
  CREATE INDEX "settings_pkg_components_order_idx" ON "settings_pkg_components" USING btree ("_order");
  CREATE INDEX "settings_pkg_components_parent_id_idx" ON "settings_pkg_components" USING btree ("_parent_id");
  CREATE INDEX "settings_pkg_templates_order_idx" ON "settings_pkg_templates" USING btree ("_order");
  CREATE INDEX "settings_pkg_templates_parent_id_idx" ON "settings_pkg_templates" USING btree ("_parent_id");
  CREATE INDEX "settings_pkg_defaults_order_idx" ON "settings_pkg_defaults" USING btree ("_order");
  CREATE INDEX "settings_pkg_defaults_parent_id_idx" ON "settings_pkg_defaults" USING btree ("_parent_id");
  CREATE INDEX "settings_legal_reviews_order_idx" ON "settings_legal_reviews" USING btree ("_order");
  CREATE INDEX "settings_legal_reviews_parent_id_idx" ON "settings_legal_reviews" USING btree ("_parent_id");
  CREATE INDEX "settings_safety_templates_order_idx" ON "settings_safety_templates" USING btree ("_order");
  CREATE INDEX "settings_safety_templates_parent_id_idx" ON "settings_safety_templates" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "settings_safety_templates_locales_locale_parent_id_unique" ON "settings_safety_templates_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "settings_care_templates_order_idx" ON "settings_care_templates" USING btree ("_order");
  CREATE INDEX "settings_care_templates_parent_id_idx" ON "settings_care_templates" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "settings_care_templates_locales_locale_parent_id_unique" ON "settings_care_templates_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "settings_packing_checklists_items_order_idx" ON "settings_packing_checklists_items" USING btree ("_order");
  CREATE INDEX "settings_packing_checklists_items_parent_id_idx" ON "settings_packing_checklists_items" USING btree ("_parent_id");
  CREATE INDEX "settings_packing_checklists_order_idx" ON "settings_packing_checklists" USING btree ("_order");
  CREATE INDEX "settings_packing_checklists_parent_id_idx" ON "settings_packing_checklists" USING btree ("_parent_id");
  CREATE INDEX "settings_processor_agreements_order_idx" ON "settings_processor_agreements" USING btree ("_order");
  CREATE INDEX "settings_processor_agreements_parent_id_idx" ON "settings_processor_agreements" USING btree ("_parent_id");
  CREATE INDEX "settings_processor_agreements_file_idx" ON "settings_processor_agreements" USING btree ("file_id");
  CREATE UNIQUE INDEX "settings_locales_locale_parent_id_unique" ON "settings_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_settings_v_version_tax_modes_order_idx" ON "_settings_v_version_tax_modes" USING btree ("_order");
  CREATE INDEX "_settings_v_version_tax_modes_parent_id_idx" ON "_settings_v_version_tax_modes" USING btree ("_parent_id");
  CREATE INDEX "_settings_v_version_revenue_guard_manual_year_totals_order_idx" ON "_settings_v_version_revenue_guard_manual_year_totals" USING btree ("_order");
  CREATE INDEX "_settings_v_version_revenue_guard_manual_year_totals_parent_id_idx" ON "_settings_v_version_revenue_guard_manual_year_totals" USING btree ("_parent_id");
  CREATE INDEX "_settings_v_version_costs_monthly_entries_order_idx" ON "_settings_v_version_costs_monthly_entries" USING btree ("_order");
  CREATE INDEX "_settings_v_version_costs_monthly_entries_parent_id_idx" ON "_settings_v_version_costs_monthly_entries" USING btree ("_parent_id");
  CREATE INDEX "_settings_v_version_shipping_enabled_countries_order_idx" ON "_settings_v_version_shipping_enabled_countries" USING btree ("order");
  CREATE INDEX "_settings_v_version_shipping_enabled_countries_parent_idx" ON "_settings_v_version_shipping_enabled_countries" USING btree ("parent_id");
  CREATE INDEX "_settings_v_version_shipping_rates_order_idx" ON "_settings_v_version_shipping_rates" USING btree ("_order");
  CREATE INDEX "_settings_v_version_shipping_rates_parent_id_idx" ON "_settings_v_version_shipping_rates" USING btree ("_parent_id");
  CREATE INDEX "_settings_tracking_v_order_idx" ON "_settings_tracking_v" USING btree ("_order");
  CREATE INDEX "_settings_tracking_v_parent_id_idx" ON "_settings_tracking_v" USING btree ("_parent_id");
  CREATE INDEX "_settings_pkg_components_v_order_idx" ON "_settings_pkg_components_v" USING btree ("_order");
  CREATE INDEX "_settings_pkg_components_v_parent_id_idx" ON "_settings_pkg_components_v" USING btree ("_parent_id");
  CREATE INDEX "_settings_pkg_templates_v_order_idx" ON "_settings_pkg_templates_v" USING btree ("_order");
  CREATE INDEX "_settings_pkg_templates_v_parent_id_idx" ON "_settings_pkg_templates_v" USING btree ("_parent_id");
  CREATE INDEX "_settings_pkg_defaults_v_order_idx" ON "_settings_pkg_defaults_v" USING btree ("_order");
  CREATE INDEX "_settings_pkg_defaults_v_parent_id_idx" ON "_settings_pkg_defaults_v" USING btree ("_parent_id");
  CREATE INDEX "_settings_v_version_legal_reviews_order_idx" ON "_settings_v_version_legal_reviews" USING btree ("_order");
  CREATE INDEX "_settings_v_version_legal_reviews_parent_id_idx" ON "_settings_v_version_legal_reviews" USING btree ("_parent_id");
  CREATE INDEX "_settings_v_version_safety_templates_order_idx" ON "_settings_v_version_safety_templates" USING btree ("_order");
  CREATE INDEX "_settings_v_version_safety_templates_parent_id_idx" ON "_settings_v_version_safety_templates" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "_settings_v_version_safety_templates_locales_locale_parent_i" ON "_settings_v_version_safety_templates_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_settings_v_version_care_templates_order_idx" ON "_settings_v_version_care_templates" USING btree ("_order");
  CREATE INDEX "_settings_v_version_care_templates_parent_id_idx" ON "_settings_v_version_care_templates" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "_settings_v_version_care_templates_locales_locale_parent_id_" ON "_settings_v_version_care_templates_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_settings_v_version_packing_checklists_items_order_idx" ON "_settings_v_version_packing_checklists_items" USING btree ("_order");
  CREATE INDEX "_settings_v_version_packing_checklists_items_parent_id_idx" ON "_settings_v_version_packing_checklists_items" USING btree ("_parent_id");
  CREATE INDEX "_settings_v_version_packing_checklists_order_idx" ON "_settings_v_version_packing_checklists" USING btree ("_order");
  CREATE INDEX "_settings_v_version_packing_checklists_parent_id_idx" ON "_settings_v_version_packing_checklists" USING btree ("_parent_id");
  CREATE INDEX "_settings_v_version_processor_agreements_order_idx" ON "_settings_v_version_processor_agreements" USING btree ("_order");
  CREATE INDEX "_settings_v_version_processor_agreements_parent_id_idx" ON "_settings_v_version_processor_agreements" USING btree ("_parent_id");
  CREATE INDEX "_settings_v_version_processor_agreements_file_idx" ON "_settings_v_version_processor_agreements" USING btree ("file_id");
  CREATE INDEX "_settings_v_created_at_idx" ON "_settings_v" USING btree ("created_at");
  CREATE INDEX "_settings_v_updated_at_idx" ON "_settings_v" USING btree ("updated_at");
  CREATE UNIQUE INDEX "_settings_v_locales_locale_parent_id_unique" ON "_settings_v_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "site_texts_navigation_main_links_order_idx" ON "site_texts_navigation_main_links" USING btree ("_order");
  CREATE INDEX "site_texts_navigation_main_links_parent_id_idx" ON "site_texts_navigation_main_links" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "site_texts_navigation_main_links_locales_locale_parent_id_un" ON "site_texts_navigation_main_links_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "site_texts_navigation_menu_links_order_idx" ON "site_texts_navigation_menu_links" USING btree ("_order");
  CREATE INDEX "site_texts_navigation_menu_links_parent_id_idx" ON "site_texts_navigation_menu_links" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "site_texts_navigation_menu_links_locales_locale_parent_id_un" ON "site_texts_navigation_menu_links_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "site_texts_emails_templates_order_idx" ON "site_texts_emails_templates" USING btree ("_order");
  CREATE INDEX "site_texts_emails_templates_parent_id_idx" ON "site_texts_emails_templates" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "site_texts_emails_templates_locales_locale_parent_id_unique" ON "site_texts_emails_templates_locales" USING btree ("_locale","_parent_id");
  CREATE UNIQUE INDEX "site_texts_locales_locale_parent_id_unique" ON "site_texts_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_site_texts_v_version_navigation_main_links_order_idx" ON "_site_texts_v_version_navigation_main_links" USING btree ("_order");
  CREATE INDEX "_site_texts_v_version_navigation_main_links_parent_id_idx" ON "_site_texts_v_version_navigation_main_links" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "_site_texts_v_version_navigation_main_links_locales_locale_p" ON "_site_texts_v_version_navigation_main_links_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_site_texts_v_version_navigation_menu_links_order_idx" ON "_site_texts_v_version_navigation_menu_links" USING btree ("_order");
  CREATE INDEX "_site_texts_v_version_navigation_menu_links_parent_id_idx" ON "_site_texts_v_version_navigation_menu_links" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "_site_texts_v_version_navigation_menu_links_locales_locale_p" ON "_site_texts_v_version_navigation_menu_links_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_site_texts_v_version_emails_templates_order_idx" ON "_site_texts_v_version_emails_templates" USING btree ("_order");
  CREATE INDEX "_site_texts_v_version_emails_templates_parent_id_idx" ON "_site_texts_v_version_emails_templates" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "_site_texts_v_version_emails_templates_locales_locale_parent" ON "_site_texts_v_version_emails_templates_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_site_texts_v_created_at_idx" ON "_site_texts_v" USING btree ("created_at");
  CREATE INDEX "_site_texts_v_updated_at_idx" ON "_site_texts_v" USING btree ("updated_at");
  CREATE UNIQUE INDEX "_site_texts_v_locales_locale_parent_id_unique" ON "_site_texts_v_locales" USING btree ("_locale","_parent_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "settings_tax_modes" CASCADE;
  DROP TABLE "settings_revenue_guard_manual_year_totals" CASCADE;
  DROP TABLE "settings_costs_monthly_entries" CASCADE;
  DROP TABLE "settings_shipping_enabled_countries" CASCADE;
  DROP TABLE "settings_shipping_rates" CASCADE;
  DROP TABLE "settings_tracking" CASCADE;
  DROP TABLE "settings_pkg_components" CASCADE;
  DROP TABLE "settings_pkg_templates" CASCADE;
  DROP TABLE "settings_pkg_defaults" CASCADE;
  DROP TABLE "settings_legal_reviews" CASCADE;
  DROP TABLE "settings_safety_templates" CASCADE;
  DROP TABLE "settings_safety_templates_locales" CASCADE;
  DROP TABLE "settings_care_templates" CASCADE;
  DROP TABLE "settings_care_templates_locales" CASCADE;
  DROP TABLE "settings_packing_checklists_items" CASCADE;
  DROP TABLE "settings_packing_checklists" CASCADE;
  DROP TABLE "settings_processor_agreements" CASCADE;
  DROP TABLE "settings" CASCADE;
  DROP TABLE "settings_locales" CASCADE;
  DROP TABLE "_settings_v_version_tax_modes" CASCADE;
  DROP TABLE "_settings_v_version_revenue_guard_manual_year_totals" CASCADE;
  DROP TABLE "_settings_v_version_costs_monthly_entries" CASCADE;
  DROP TABLE "_settings_v_version_shipping_enabled_countries" CASCADE;
  DROP TABLE "_settings_v_version_shipping_rates" CASCADE;
  DROP TABLE "_settings_tracking_v" CASCADE;
  DROP TABLE "_settings_pkg_components_v" CASCADE;
  DROP TABLE "_settings_pkg_templates_v" CASCADE;
  DROP TABLE "_settings_pkg_defaults_v" CASCADE;
  DROP TABLE "_settings_v_version_legal_reviews" CASCADE;
  DROP TABLE "_settings_v_version_safety_templates" CASCADE;
  DROP TABLE "_settings_v_version_safety_templates_locales" CASCADE;
  DROP TABLE "_settings_v_version_care_templates" CASCADE;
  DROP TABLE "_settings_v_version_care_templates_locales" CASCADE;
  DROP TABLE "_settings_v_version_packing_checklists_items" CASCADE;
  DROP TABLE "_settings_v_version_packing_checklists" CASCADE;
  DROP TABLE "_settings_v_version_processor_agreements" CASCADE;
  DROP TABLE "_settings_v" CASCADE;
  DROP TABLE "_settings_v_locales" CASCADE;
  DROP TABLE "site_texts_navigation_main_links" CASCADE;
  DROP TABLE "site_texts_navigation_main_links_locales" CASCADE;
  DROP TABLE "site_texts_navigation_menu_links" CASCADE;
  DROP TABLE "site_texts_navigation_menu_links_locales" CASCADE;
  DROP TABLE "site_texts_emails_templates" CASCADE;
  DROP TABLE "site_texts_emails_templates_locales" CASCADE;
  DROP TABLE "site_texts" CASCADE;
  DROP TABLE "site_texts_locales" CASCADE;
  DROP TABLE "_site_texts_v_version_navigation_main_links" CASCADE;
  DROP TABLE "_site_texts_v_version_navigation_main_links_locales" CASCADE;
  DROP TABLE "_site_texts_v_version_navigation_menu_links" CASCADE;
  DROP TABLE "_site_texts_v_version_navigation_menu_links_locales" CASCADE;
  DROP TABLE "_site_texts_v_version_emails_templates" CASCADE;
  DROP TABLE "_site_texts_v_version_emails_templates_locales" CASCADE;
  DROP TABLE "_site_texts_v" CASCADE;
  DROP TABLE "_site_texts_v_locales" CASCADE;
  DROP TYPE "public"."enum_settings_tax_modes_mode";
  DROP TYPE "public"."enum_settings_shipping_enabled_countries";
  DROP TYPE "public"."enum_settings_shipping_rates_zone";
  DROP TYPE "public"."enum_settings_rates_class";
  DROP TYPE "public"."enum_settings_tracking_carrier";
  DROP TYPE "public"."enum_settings_pkg_material";
  DROP TYPE "public"."enum_settings_pkg_class";
  DROP TYPE "public"."enum_settings_legal_reviews_type";
  DROP TYPE "public"."enum_settings_safety_templates_category";
  DROP TYPE "public"."enum_settings_care_templates_category";
  DROP TYPE "public"."enum_settings_packing_checklists_shipping_class";
  DROP TYPE "public"."enum_settings_business_country";
  DROP TYPE "public"."enum_settings_retention_invoice_years";
  DROP TYPE "public"."enum__settings_v_version_tax_modes_mode";
  DROP TYPE "public"."enum__settings_v_version_shipping_enabled_countries";
  DROP TYPE "public"."enum__settings_v_version_shipping_rates_zone";
  DROP TYPE "public"."enum__settings_v_version_legal_reviews_type";
  DROP TYPE "public"."enum__settings_v_version_safety_templates_category";
  DROP TYPE "public"."enum__settings_v_version_care_templates_category";
  DROP TYPE "public"."enum__settings_v_version_packing_checklists_shipping_class";
  DROP TYPE "public"."enum__settings_v_version_business_country";
  DROP TYPE "public"."enum__settings_v_version_retention_invoice_years";
  DROP TYPE "public"."enum_site_texts_navigation_main_links_target";
  DROP TYPE "public"."enum_site_texts_navigation_main_links_category";
  DROP TYPE "public"."enum_site_texts_navigation_menu_links_target";
  DROP TYPE "public"."enum_site_texts_navigation_menu_links_category";
  DROP TYPE "public"."enum_site_texts_emails_templates_template";
  DROP TYPE "public"."enum__site_texts_v_version_navigation_main_links_target";
  DROP TYPE "public"."enum__site_texts_v_version_navigation_main_links_category";
  DROP TYPE "public"."enum__site_texts_v_version_navigation_menu_links_target";
  DROP TYPE "public"."enum__site_texts_v_version_navigation_menu_links_category";
  DROP TYPE "public"."enum__site_texts_v_version_emails_templates_template";`)
}
