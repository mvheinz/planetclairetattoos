import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_products_fiber_composition_component" AS ENUM('main', 'lining', 'trim', 'other');
  CREATE TYPE "public"."enum_products_fiber_composition_fiber" AS ENUM('wool', 'alpaca', 'llama', 'camel', 'cashmere', 'mohair', 'angora', 'vicuna', 'yak', 'guanaco', 'cashgora', 'beaver', 'otter', 'animal_hair', 'horsehair', 'silk', 'cotton', 'kapok', 'flax', 'hemp', 'jute', 'abaca', 'alfa', 'coir', 'broom', 'ramie', 'sisal', 'sunn', 'henequen', 'maguey', 'acetate', 'alginate', 'cupro', 'modal', 'protein', 'triacetate', 'viscose', 'acrylic', 'chlorofibre', 'fluorofibre', 'modacrylic', 'polyamide', 'aramid', 'polyimide', 'lyocell', 'polylactide', 'polyester', 'polyethylene', 'polypropylene', 'polycarbamide', 'polyurethane', 'vinylal', 'trivinyl', 'elastodiene', 'elastane', 'glass_fibre', 'metal_fibre', 'paper_fibre', 'elastomultiester', 'elastolefin', 'melamine', 'pp_pa_bicomponent', 'polyacrylate', 'other_fibres');
  CREATE TYPE "public"."enum_products_category" AS ENUM('keramik', 'textil', 'cap', 'zeichnung', 'schmuck', 'sonstiges');
  CREATE TYPE "public"."enum_products_vat_category" AS ENUM('standard', 'reduced_art');
  CREATE TYPE "public"."enum_products_shipping_class" AS ENUM('brief', 'paket_klein', 'keramik', 'nur_abholung');
  CREATE TYPE "public"."enum_products_condition" AS ENUM('like_new', 'very_good', 'good', 'worn');
  CREATE TYPE "public"."enum_products_food_contact" AS ENUM('deko', 'lebensmittelecht');
  CREATE TYPE "public"."enum_products_deviation_decision" AS ENUM('none', 'described');
  CREATE TYPE "public"."enum_products_customs_country_of_origin" AS ENUM('DE', 'AT', 'BE', 'BG', 'CY', 'CZ', 'DK', 'EE', 'ES', 'FI', 'FR', 'GR', 'HR', 'HU', 'IE', 'IT', 'LT', 'LU', 'LV', 'MT', 'NL', 'PL', 'PT', 'RO', 'SE', 'SI', 'SK', 'CH');
  CREATE TYPE "public"."enum_products_status" AS ENUM('draft', 'available', 'reserved', 'sold', 'archived');
  CREATE TYPE "public"."enum_products_sold_channel" AS ENUM('online', 'pickup', 'offline');
  CREATE TYPE "public"."enum_products_i18n_en_status" AS ENUM('missing', 'machine', 'reviewed');
  CREATE TYPE "public"."enum_products_admin_attention_reason" AS ENUM('oversold', 'dispute_open', 'refund_failed', 'webhook_error', 'payment_amount_mismatch', 'conformity_revoked', 'manual');
  CREATE TABLE "products_fiber_composition" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"component" "enum_products_fiber_composition_component" DEFAULT 'main',
  	"fiber" "enum_products_fiber_composition_fiber",
  	"percent" numeric
  );
  
  CREATE TABLE "products" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"item_number" numeric NOT NULL,
  	"category" "enum_products_category" NOT NULL,
  	"price_cents" numeric NOT NULL,
  	"vat_category" "enum_products_vat_category" DEFAULT 'standard' NOT NULL,
  	"vat_reduced_reason" varchar DEFAULT 'Originalzeichnung, vollständig von Hand (Anlage 2 Nr. 53 UStG)',
  	"dimensions_width_cm" numeric,
  	"dimensions_height_cm" numeric,
  	"dimensions_depth_cm" numeric,
  	"dimensions_diameter_cm" numeric,
  	"weight_grams" numeric,
  	"shipping_class" "enum_products_shipping_class" NOT NULL,
  	"is_second_hand" boolean DEFAULT false,
  	"condition" "enum_products_condition",
  	"label_missing" boolean DEFAULT false,
  	"blank_brand_visible" boolean DEFAULT false,
  	"food_contact" "enum_products_food_contact",
  	"nickel_free_confirmed" boolean DEFAULT false,
  	"nickel_evidence_id" integer,
  	"lead_free_glaze_confirmed" boolean DEFAULT false,
  	"small_parts_warning" boolean DEFAULT false,
  	"framed" boolean DEFAULT false,
  	"frame_has_glass" boolean DEFAULT false,
  	"deviation_decision" "enum_products_deviation_decision",
  	"has_deviation" boolean DEFAULT false,
  	"own_design_confirmed" boolean DEFAULT false,
  	"is_custom_commission" boolean DEFAULT false,
  	"customs_hs_code" varchar,
  	"customs_country_of_origin" "enum_products_customs_country_of_origin" DEFAULT 'DE',
  	"customs_description_en" varchar,
  	"status" "enum_products_status" DEFAULT 'draft' NOT NULL,
  	"show_in_archive_after_sale" boolean DEFAULT true,
  	"first_published_at" timestamp(3) with time zone,
  	"sold_at" timestamp(3) with time zone,
  	"sold_channel" "enum_products_sold_channel",
  	"offline_sale_note" varchar,
  	"archived_at" timestamp(3) with time zone,
  	"reserved_until" timestamp(3) with time zone,
  	"reservation_ref" varchar,
  	"storage_location" varchar,
  	"internal_note" varchar,
  	"i18n_en_status" "enum_products_i18n_en_status" DEFAULT 'missing',
  	"i18n_translated_at" timestamp(3) with time zone,
  	"admin_attention_flag" boolean DEFAULT false,
  	"admin_attention_reason" "enum_products_admin_attention_reason",
  	"admin_attention_note" varchar,
  	"seed" boolean DEFAULT false,
  	"seed_key" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "products_locales" (
  	"admin_title" varchar,
  	"title" varchar,
  	"slug" varchar,
  	"description" varchar,
  	"jutta_says" varchar,
  	"materials" varchar,
  	"dimensions_note" varchar,
  	"size_label" varchar,
  	"condition_note" varchar,
  	"fiber_free_text" varchar,
  	"care_instructions" varchar,
  	"metal_parts_material" varchar,
  	"safety_warnings" varchar,
  	"deviation_description" varchar,
  	"seo_meta_title" varchar,
  	"seo_meta_description" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "products_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"conformity_declarations_id" integer,
  	"media_id" integer
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "products_id" integer;
  ALTER TABLE "products_fiber_composition" ADD CONSTRAINT "products_fiber_composition_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "products" ADD CONSTRAINT "products_nickel_evidence_id_private_uploads_id_fk" FOREIGN KEY ("nickel_evidence_id") REFERENCES "public"."private_uploads"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "products_locales" ADD CONSTRAINT "products_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "products_rels" ADD CONSTRAINT "products_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "products_rels" ADD CONSTRAINT "products_rels_conformity_declarations_fk" FOREIGN KEY ("conformity_declarations_id") REFERENCES "public"."conformity_declarations"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "products_rels" ADD CONSTRAINT "products_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "products_fiber_composition_order_idx" ON "products_fiber_composition" USING btree ("_order");
  CREATE INDEX "products_fiber_composition_parent_id_idx" ON "products_fiber_composition" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "products_item_number_idx" ON "products" USING btree ("item_number");
  CREATE INDEX "products_nickel_evidence_idx" ON "products" USING btree ("nickel_evidence_id");
  CREATE INDEX "products_status_idx" ON "products" USING btree ("status");
  CREATE INDEX "products_first_published_at_idx" ON "products" USING btree ("first_published_at");
  CREATE INDEX "products_seed_idx" ON "products" USING btree ("seed");
  CREATE INDEX "products_seed_key_idx" ON "products" USING btree ("seed_key");
  CREATE INDEX "products_updated_at_idx" ON "products" USING btree ("updated_at");
  CREATE INDEX "products_created_at_idx" ON "products" USING btree ("created_at");
  CREATE INDEX "category_status_idx" ON "products" USING btree ("category","status");
  CREATE UNIQUE INDEX "products_slug_idx" ON "products_locales" USING btree ("slug","_locale");
  CREATE UNIQUE INDEX "products_locales_locale_parent_id_unique" ON "products_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "products_rels_order_idx" ON "products_rels" USING btree ("order");
  CREATE INDEX "products_rels_parent_idx" ON "products_rels" USING btree ("parent_id");
  CREATE INDEX "products_rels_path_idx" ON "products_rels" USING btree ("path");
  CREATE INDEX "products_rels_conformity_declarations_id_idx" ON "products_rels" USING btree ("conformity_declarations_id");
  CREATE INDEX "products_rels_media_id_idx" ON "products_rels" USING btree ("media_id");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_products_fk" FOREIGN KEY ("products_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_products_id_idx" ON "payload_locked_documents_rels" USING btree ("products_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "products_fiber_composition" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "products" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "products_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "products_rels" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "products_fiber_composition" CASCADE;
  DROP TABLE "products" CASCADE;
  DROP TABLE "products_locales" CASCADE;
  DROP TABLE "products_rels" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_products_fk";
  
  DROP INDEX "payload_locked_documents_rels_products_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "products_id";
  DROP TYPE "public"."enum_products_fiber_composition_component";
  DROP TYPE "public"."enum_products_fiber_composition_fiber";
  DROP TYPE "public"."enum_products_category";
  DROP TYPE "public"."enum_products_vat_category";
  DROP TYPE "public"."enum_products_shipping_class";
  DROP TYPE "public"."enum_products_condition";
  DROP TYPE "public"."enum_products_food_contact";
  DROP TYPE "public"."enum_products_deviation_decision";
  DROP TYPE "public"."enum_products_customs_country_of_origin";
  DROP TYPE "public"."enum_products_status";
  DROP TYPE "public"."enum_products_sold_channel";
  DROP TYPE "public"."enum_products_i18n_en_status";
  DROP TYPE "public"."enum_products_admin_attention_reason";`)
}
