import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_inquiries_object_type" AS ENUM('cap', 'shirt', 'textil_sonstiges', 'teller', 'schale', 'tasse', 'fliese', 'zeichnung', 'schmuck', 'sonstiges');
  CREATE TYPE "public"."enum_inquiries_locale" AS ENUM('de', 'en');
  CREATE TYPE "public"."enum_inquiries_status" AS ENUM('new', 'in_progress', 'offer_sent', 'accepted', 'declined', 'completed', 'closed');
  CREATE TYPE "public"."enum_faqs_category" AS ENUM('tattoo', 'aftercare', 'shop', 'shipping', 'commissions', 'general');
  CREATE TYPE "public"."enum__faqs_v_version_category" AS ENUM('tattoo', 'aftercare', 'shop', 'shipping', 'commissions', 'general');
  CREATE TYPE "public"."enum_pages_blocks_hero_coco_pose" AS ENUM('run', 'sniff', 'sit', 'sleep', 'jump', 'head_tilt');
  CREATE TYPE "public"."enum_pages_blocks_station_link_target" AS ENUM('home', 'shop', 'archive', 'category', 'tattoo', 'tattoo_aftercare', 'about', 'commissions', 'contact', 'conformity', 'instagram', 'email');
  CREATE TYPE "public"."enum_pages_blocks_station_link_category" AS ENUM('keramik', 'textil', 'cap', 'zeichnung', 'schmuck', 'sonstiges');
  CREATE TYPE "public"."enum_pages_blocks_station_coco_pose" AS ENUM('run', 'sniff', 'sit', 'sleep', 'jump', 'head_tilt');
  CREATE TYPE "public"."enum_pages_blocks_station_ornament" AS ENUM('planet', 'star', 'none');
  CREATE TYPE "public"."enum_pages_blocks_image_text_image_position" AS ENUM('left', 'right');
  CREATE TYPE "public"."enum_pages_blocks_product_teaser_mode" AS ENUM('latest', 'category', 'manual');
  CREATE TYPE "public"."enum_pages_blocks_product_teaser_category" AS ENUM('keramik', 'textil', 'cap', 'zeichnung', 'schmuck', 'sonstiges');
  CREATE TYPE "public"."enum_pages_blocks_category_teaser_categories" AS ENUM('keramik', 'textil', 'cap', 'zeichnung', 'schmuck', 'sonstiges');
  CREATE TYPE "public"."enum_pages_blocks_tattoo_gallery_filter" AS ENUM('all', 'fresh', 'healed');
  CREATE TYPE "public"."enum_pages_blocks_faq_list_category" AS ENUM('tattoo', 'aftercare', 'shop', 'shipping', 'commissions', 'general');
  CREATE TYPE "public"."enum_pages_blocks_callout_tone" AS ENUM('info', 'hint');
  CREATE TYPE "public"."enum_pages_key" AS ENUM('home', 'about', 'contact', 'commissions', 'tattoo', 'tattoo_aftercare', 'shop', 'archive', 'conformity', 'withdrawal', 'order_status', 'thanks', 'not_found');
  CREATE TYPE "public"."enum_pages_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__pages_v_blocks_hero_coco_pose" AS ENUM('run', 'sniff', 'sit', 'sleep', 'jump', 'head_tilt');
  CREATE TYPE "public"."enum__pages_v_blocks_station_link_target" AS ENUM('home', 'shop', 'archive', 'category', 'tattoo', 'tattoo_aftercare', 'about', 'commissions', 'contact', 'conformity', 'instagram', 'email');
  CREATE TYPE "public"."enum__pages_v_blocks_station_link_category" AS ENUM('keramik', 'textil', 'cap', 'zeichnung', 'schmuck', 'sonstiges');
  CREATE TYPE "public"."enum__pages_v_blocks_station_coco_pose" AS ENUM('run', 'sniff', 'sit', 'sleep', 'jump', 'head_tilt');
  CREATE TYPE "public"."enum__pages_v_blocks_station_ornament" AS ENUM('planet', 'star', 'none');
  CREATE TYPE "public"."enum__pages_v_blocks_image_text_image_position" AS ENUM('left', 'right');
  CREATE TYPE "public"."enum__pages_v_blocks_product_teaser_mode" AS ENUM('latest', 'category', 'manual');
  CREATE TYPE "public"."enum__pages_v_blocks_product_teaser_category" AS ENUM('keramik', 'textil', 'cap', 'zeichnung', 'schmuck', 'sonstiges');
  CREATE TYPE "public"."enum__pages_v_blocks_category_teaser_categories" AS ENUM('keramik', 'textil', 'cap', 'zeichnung', 'schmuck', 'sonstiges');
  CREATE TYPE "public"."enum__pages_v_blocks_tattoo_gallery_filter" AS ENUM('all', 'fresh', 'healed');
  CREATE TYPE "public"."enum__pages_v_blocks_faq_list_category" AS ENUM('tattoo', 'aftercare', 'shop', 'shipping', 'commissions', 'general');
  CREATE TYPE "public"."enum__pages_v_blocks_callout_tone" AS ENUM('info', 'hint');
  CREATE TYPE "public"."enum__pages_v_version_key" AS ENUM('home', 'about', 'contact', 'commissions', 'tattoo', 'tattoo_aftercare', 'shop', 'archive', 'conformity', 'withdrawal', 'order_status', 'thanks', 'not_found');
  CREATE TYPE "public"."enum__pages_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__pages_v_published_locale" AS ENUM('de', 'en');
  CREATE TYPE "public"."enum_revenue_entries_source" AS ENUM('tattoo', 'flohmarkt', 'auftragsarbeiten', 'sonstiges');
  CREATE TYPE "public"."enum_privacy_requests_types" AS ENUM('access', 'rectification', 'erasure', 'restriction', 'portability', 'objection', 'consent_withdrawal');
  CREATE TYPE "public"."enum_privacy_requests_channel" AS ENUM('email', 'letter', 'instagram_dm', 'oral', 'withdrawal_form', 'other');
  CREATE TYPE "public"."enum_privacy_requests_status" AS ENUM('received', 'identity_check', 'in_progress', 'answered', 'rejected');
  CREATE TYPE "public"."enum_privacy_requests_locale" AS ENUM('de', 'en');
  CREATE TYPE "public"."enum_privacy_requests_identity_method" AS ENUM('stored_email', 'control_data', 'other');
  CREATE TABLE "inquiries" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"reference" varchar NOT NULL,
  	"name" varchar NOT NULL,
  	"email" varchar NOT NULL,
  	"idea" varchar NOT NULL,
  	"object_type" "enum_inquiries_object_type" NOT NULL,
  	"object_type_other" varchar,
  	"desired_timeframe" varchar,
  	"budget" varchar,
  	"locale" "enum_inquiries_locale" NOT NULL,
  	"privacy_notice_version_id" integer NOT NULL,
  	"status" "enum_inquiries_status" DEFAULT 'new' NOT NULL,
  	"last_activity_at" timestamp(3) with time zone NOT NULL,
  	"delete_after" timestamp(3) with time zone NOT NULL,
  	"admin_notes" varchar,
  	"privacy_processing_restricted" boolean DEFAULT false,
  	"privacy_restricted_at" timestamp(3) with time zone,
  	"privacy_legal_hold" boolean DEFAULT false,
  	"privacy_legal_hold_reason" varchar,
  	"privacy_legal_hold_since" timestamp(3) with time zone,
  	"privacy_legal_hold_reviewed_at" timestamp(3) with time zone,
  	"privacy_anonymized_at" timestamp(3) with time zone,
  	"seed" boolean DEFAULT false,
  	"seed_key" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "inquiries_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"private_uploads_id" integer
  );
  
  CREATE TABLE "faqs" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"category" "enum_faqs_category" DEFAULT 'general' NOT NULL,
  	"sort_order" numeric DEFAULT 100 NOT NULL,
  	"published" boolean DEFAULT true,
  	"seed" boolean DEFAULT false,
  	"seed_key" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "faqs_locales" (
  	"question" varchar NOT NULL,
  	"answer" jsonb NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "_faqs_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_category" "enum__faqs_v_version_category" DEFAULT 'general' NOT NULL,
  	"version_sort_order" numeric DEFAULT 100 NOT NULL,
  	"version_published" boolean DEFAULT true,
  	"version_seed" boolean DEFAULT false,
  	"version_seed_key" varchar,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "_faqs_v_locales" (
  	"version_question" varchar NOT NULL,
  	"version_answer" jsonb NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "pages_blocks_hero" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"image_id" integer,
  	"coco_pose" "enum_pages_blocks_hero_coco_pose" DEFAULT 'run',
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_hero_locales" (
  	"heading" varchar,
  	"subheading" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "pages_blocks_station" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"station_id" varchar,
  	"image_id" integer,
  	"link_target" "enum_pages_blocks_station_link_target",
  	"link_category" "enum_pages_blocks_station_link_category",
  	"coco_pose" "enum_pages_blocks_station_coco_pose" DEFAULT 'sniff',
  	"ornament" "enum_pages_blocks_station_ornament" DEFAULT 'none',
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_station_locales" (
  	"heading" varchar,
  	"text" varchar,
  	"link_label" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "pages_blocks_rich_text" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_rich_text_locales" (
  	"content" jsonb,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "pages_blocks_image_text" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"image_id" integer,
  	"image_position" "enum_pages_blocks_image_text_image_position" DEFAULT 'left',
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_image_text_locales" (
  	"content" jsonb,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "pages_blocks_image_gallery" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_image_gallery_locales" (
  	"caption" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "pages_blocks_product_teaser" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"mode" "enum_pages_blocks_product_teaser_mode" DEFAULT 'latest',
  	"category" "enum_pages_blocks_product_teaser_category",
  	"limit" numeric DEFAULT 6,
  	"only_available" boolean DEFAULT true,
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_product_teaser_locales" (
  	"heading" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "pages_blocks_category_teaser_categories" (
  	"order" integer NOT NULL,
  	"parent_id" varchar NOT NULL,
  	"value" "enum_pages_blocks_category_teaser_categories",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "pages_blocks_category_teaser" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_category_teaser_locales" (
  	"heading" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "pages_blocks_flash_grid" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"show_claimed" boolean DEFAULT true,
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_flash_grid_locales" (
  	"heading" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
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
  
  CREATE TABLE "pages_blocks_tattoo_gallery" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"filter" "enum_pages_blocks_tattoo_gallery_filter" DEFAULT 'all',
  	"limit" numeric DEFAULT 12,
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_tattoo_gallery_locales" (
  	"heading" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "pages_blocks_price_info" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_price_info_locales" (
  	"heading" varchar,
  	"content" jsonb,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "pages_blocks_process_steps_steps" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "pages_blocks_process_steps_steps_locales" (
  	"title" varchar,
  	"text" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "pages_blocks_process_steps" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_process_steps_locales" (
  	"heading" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "pages_blocks_aftercare_steps_phases" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "pages_blocks_aftercare_steps_phases_locales" (
  	"title" varchar,
  	"content" jsonb,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "pages_blocks_aftercare_steps" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"pdf_id" integer,
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_aftercare_steps_locales" (
  	"heading" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "pages_blocks_faq_list" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"category" "enum_pages_blocks_faq_list_category",
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_faq_list_locales" (
  	"heading" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "pages_blocks_contact_links" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"show_email" boolean DEFAULT true,
  	"show_instagram" boolean DEFAULT true,
  	"show_district" boolean DEFAULT true,
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_contact_links_locales" (
  	"heading" varchar,
  	"email_subject" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "pages_blocks_commission_form" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_commission_form_locales" (
  	"heading" varchar,
  	"intro" varchar,
  	"success_text" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "pages_blocks_callout" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"tone" "enum_pages_blocks_callout_tone" DEFAULT 'info',
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_callout_locales" (
  	"text" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "pages" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" "enum_pages_key",
  	"seo_og_image_id" integer,
  	"seed" boolean DEFAULT false,
  	"seed_key" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "enum_pages_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "pages_locales" (
  	"title" varchar,
  	"seo_meta_title" varchar,
  	"seo_meta_description" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "pages_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"media_id" integer,
  	"products_id" integer
  );
  
  CREATE TABLE "_pages_v_blocks_hero" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"image_id" integer,
  	"coco_pose" "enum__pages_v_blocks_hero_coco_pose" DEFAULT 'run',
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_hero_locales" (
  	"heading" varchar,
  	"subheading" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "_pages_v_blocks_station" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"station_id" varchar,
  	"image_id" integer,
  	"link_target" "enum__pages_v_blocks_station_link_target",
  	"link_category" "enum__pages_v_blocks_station_link_category",
  	"coco_pose" "enum__pages_v_blocks_station_coco_pose" DEFAULT 'sniff',
  	"ornament" "enum__pages_v_blocks_station_ornament" DEFAULT 'none',
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_station_locales" (
  	"heading" varchar,
  	"text" varchar,
  	"link_label" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "_pages_v_blocks_rich_text" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_rich_text_locales" (
  	"content" jsonb,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "_pages_v_blocks_image_text" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"image_id" integer,
  	"image_position" "enum__pages_v_blocks_image_text_image_position" DEFAULT 'left',
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_image_text_locales" (
  	"content" jsonb,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "_pages_v_blocks_image_gallery" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_image_gallery_locales" (
  	"caption" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "_pages_v_blocks_product_teaser" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"mode" "enum__pages_v_blocks_product_teaser_mode" DEFAULT 'latest',
  	"category" "enum__pages_v_blocks_product_teaser_category",
  	"limit" numeric DEFAULT 6,
  	"only_available" boolean DEFAULT true,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_product_teaser_locales" (
  	"heading" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "_pages_v_blocks_category_teaser_categories" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum__pages_v_blocks_category_teaser_categories",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "_pages_v_blocks_category_teaser" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_category_teaser_locales" (
  	"heading" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "_pages_v_blocks_flash_grid" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"show_claimed" boolean DEFAULT true,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_flash_grid_locales" (
  	"heading" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
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
  
  CREATE TABLE "_pages_v_blocks_tattoo_gallery" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"filter" "enum__pages_v_blocks_tattoo_gallery_filter" DEFAULT 'all',
  	"limit" numeric DEFAULT 12,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_tattoo_gallery_locales" (
  	"heading" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "_pages_v_blocks_price_info" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_price_info_locales" (
  	"heading" varchar,
  	"content" jsonb,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "_pages_v_blocks_process_steps_steps" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_process_steps_steps_locales" (
  	"title" varchar,
  	"text" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "_pages_v_blocks_process_steps" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_process_steps_locales" (
  	"heading" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "_pages_v_blocks_aftercare_steps_phases" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_aftercare_steps_phases_locales" (
  	"title" varchar,
  	"content" jsonb,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "_pages_v_blocks_aftercare_steps" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"pdf_id" integer,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_aftercare_steps_locales" (
  	"heading" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "_pages_v_blocks_faq_list" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"category" "enum__pages_v_blocks_faq_list_category",
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_faq_list_locales" (
  	"heading" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "_pages_v_blocks_contact_links" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"show_email" boolean DEFAULT true,
  	"show_instagram" boolean DEFAULT true,
  	"show_district" boolean DEFAULT true,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_contact_links_locales" (
  	"heading" varchar,
  	"email_subject" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "_pages_v_blocks_commission_form" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_commission_form_locales" (
  	"heading" varchar,
  	"intro" varchar,
  	"success_text" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "_pages_v_blocks_callout" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"tone" "enum__pages_v_blocks_callout_tone" DEFAULT 'info',
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_callout_locales" (
  	"text" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "_pages_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_key" "enum__pages_v_version_key",
  	"version_seo_og_image_id" integer,
  	"version_seed" boolean DEFAULT false,
  	"version_seed_key" varchar,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "enum__pages_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"snapshot" boolean,
  	"published_locale" "enum__pages_v_published_locale",
  	"latest" boolean
  );
  
  CREATE TABLE "_pages_v_locales" (
  	"version_title" varchar,
  	"version_seo_meta_title" varchar,
  	"version_seo_meta_description" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "_pages_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"media_id" integer,
  	"products_id" integer
  );
  
  CREATE TABLE "revenue_entries" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"month" varchar NOT NULL,
  	"source" "enum_revenue_entries_source" DEFAULT 'tattoo' NOT NULL,
  	"amount_cents" numeric NOT NULL,
  	"note" varchar,
  	"seed" boolean DEFAULT false,
  	"seed_key" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "privacy_requests_types" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_privacy_requests_types",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "privacy_requests" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"reference" varchar NOT NULL,
  	"channel" "enum_privacy_requests_channel" DEFAULT 'email' NOT NULL,
  	"received_at" timestamp(3) with time zone NOT NULL,
  	"due_at" timestamp(3) with time zone NOT NULL,
  	"extended_due_at" timestamp(3) with time zone,
  	"extension_reason" varchar,
  	"extension_notified_at" timestamp(3) with time zone,
  	"status" "enum_privacy_requests_status" DEFAULT 'received' NOT NULL,
  	"contact_email" varchar NOT NULL,
  	"contact_name" varchar,
  	"locale" "enum_privacy_requests_locale" DEFAULT 'de' NOT NULL,
  	"identity_verified" boolean DEFAULT false,
  	"identity_method" "enum_privacy_requests_identity_method",
  	"identity_verified_at" timestamp(3) with time zone,
  	"export_file_id" integer,
  	"answered_at" timestamp(3) with time zone,
  	"result_note" varchar,
  	"reminders_sent" jsonb,
  	"admin_notes" varchar,
  	"retain_until" timestamp(3) with time zone,
  	"seed" boolean DEFAULT false,
  	"seed_key" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "privacy_requests_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"orders_id" integer,
  	"withdrawals_id" integer,
  	"inquiries_id" integer
  );
  
  ALTER TABLE "private_uploads" ADD COLUMN "related_inquiry_id" integer;
  ALTER TABLE "private_uploads" ADD COLUMN "related_privacy_request_id" integer;
  ALTER TABLE "email_log" ADD COLUMN "inquiry_id" integer;
  ALTER TABLE "consent_log" ADD COLUMN "inquiry_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "inquiries_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "faqs_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "pages_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "revenue_entries_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "privacy_requests_id" integer;
  ALTER TABLE "inquiries" ADD CONSTRAINT "inquiries_privacy_notice_version_id_legal_texts_id_fk" FOREIGN KEY ("privacy_notice_version_id") REFERENCES "public"."legal_texts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "inquiries_rels" ADD CONSTRAINT "inquiries_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."inquiries"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "inquiries_rels" ADD CONSTRAINT "inquiries_rels_private_uploads_fk" FOREIGN KEY ("private_uploads_id") REFERENCES "public"."private_uploads"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "faqs_locales" ADD CONSTRAINT "faqs_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."faqs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_faqs_v" ADD CONSTRAINT "_faqs_v_parent_id_faqs_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."faqs"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_faqs_v_locales" ADD CONSTRAINT "_faqs_v_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_faqs_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_hero" ADD CONSTRAINT "pages_blocks_hero_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages_blocks_hero" ADD CONSTRAINT "pages_blocks_hero_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_hero_locales" ADD CONSTRAINT "pages_blocks_hero_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_hero"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_station" ADD CONSTRAINT "pages_blocks_station_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages_blocks_station" ADD CONSTRAINT "pages_blocks_station_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_station_locales" ADD CONSTRAINT "pages_blocks_station_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_station"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_rich_text" ADD CONSTRAINT "pages_blocks_rich_text_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_rich_text_locales" ADD CONSTRAINT "pages_blocks_rich_text_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_rich_text"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_image_text" ADD CONSTRAINT "pages_blocks_image_text_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages_blocks_image_text" ADD CONSTRAINT "pages_blocks_image_text_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_image_text_locales" ADD CONSTRAINT "pages_blocks_image_text_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_image_text"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_image_gallery" ADD CONSTRAINT "pages_blocks_image_gallery_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_image_gallery_locales" ADD CONSTRAINT "pages_blocks_image_gallery_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_image_gallery"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_product_teaser" ADD CONSTRAINT "pages_blocks_product_teaser_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_product_teaser_locales" ADD CONSTRAINT "pages_blocks_product_teaser_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_product_teaser"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_category_teaser_categories" ADD CONSTRAINT "pages_blocks_category_teaser_categories_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."pages_blocks_category_teaser"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_category_teaser" ADD CONSTRAINT "pages_blocks_category_teaser_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_category_teaser_locales" ADD CONSTRAINT "pages_blocks_category_teaser_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_category_teaser"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_flash_grid" ADD CONSTRAINT "pages_blocks_flash_grid_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_flash_grid_locales" ADD CONSTRAINT "pages_blocks_flash_grid_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_flash_grid"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_offers_list" ADD CONSTRAINT "pages_blocks_offers_list_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_offers_list_locales" ADD CONSTRAINT "pages_blocks_offers_list_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_offers_list"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_tattoo_gallery" ADD CONSTRAINT "pages_blocks_tattoo_gallery_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_tattoo_gallery_locales" ADD CONSTRAINT "pages_blocks_tattoo_gallery_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_tattoo_gallery"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_price_info" ADD CONSTRAINT "pages_blocks_price_info_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_price_info_locales" ADD CONSTRAINT "pages_blocks_price_info_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_price_info"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_process_steps_steps" ADD CONSTRAINT "pages_blocks_process_steps_steps_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_process_steps"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_process_steps_steps_locales" ADD CONSTRAINT "pages_blocks_process_steps_steps_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_process_steps_steps"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_process_steps" ADD CONSTRAINT "pages_blocks_process_steps_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_process_steps_locales" ADD CONSTRAINT "pages_blocks_process_steps_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_process_steps"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_aftercare_steps_phases" ADD CONSTRAINT "pages_blocks_aftercare_steps_phases_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_aftercare_steps"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_aftercare_steps_phases_locales" ADD CONSTRAINT "pages_blocks_aftercare_steps_phases_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_aftercare_steps_phases"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_aftercare_steps" ADD CONSTRAINT "pages_blocks_aftercare_steps_pdf_id_documents_id_fk" FOREIGN KEY ("pdf_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages_blocks_aftercare_steps" ADD CONSTRAINT "pages_blocks_aftercare_steps_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_aftercare_steps_locales" ADD CONSTRAINT "pages_blocks_aftercare_steps_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_aftercare_steps"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_faq_list" ADD CONSTRAINT "pages_blocks_faq_list_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_faq_list_locales" ADD CONSTRAINT "pages_blocks_faq_list_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_faq_list"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_contact_links" ADD CONSTRAINT "pages_blocks_contact_links_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_contact_links_locales" ADD CONSTRAINT "pages_blocks_contact_links_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_contact_links"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_commission_form" ADD CONSTRAINT "pages_blocks_commission_form_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_commission_form_locales" ADD CONSTRAINT "pages_blocks_commission_form_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_commission_form"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_callout" ADD CONSTRAINT "pages_blocks_callout_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_callout_locales" ADD CONSTRAINT "pages_blocks_callout_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_callout"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages" ADD CONSTRAINT "pages_seo_og_image_id_media_id_fk" FOREIGN KEY ("seo_og_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages_locales" ADD CONSTRAINT "pages_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_rels" ADD CONSTRAINT "pages_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_rels" ADD CONSTRAINT "pages_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_rels" ADD CONSTRAINT "pages_rels_products_fk" FOREIGN KEY ("products_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_hero" ADD CONSTRAINT "_pages_v_blocks_hero_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_hero" ADD CONSTRAINT "_pages_v_blocks_hero_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_hero_locales" ADD CONSTRAINT "_pages_v_blocks_hero_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v_blocks_hero"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_station" ADD CONSTRAINT "_pages_v_blocks_station_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_station" ADD CONSTRAINT "_pages_v_blocks_station_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_station_locales" ADD CONSTRAINT "_pages_v_blocks_station_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v_blocks_station"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_rich_text" ADD CONSTRAINT "_pages_v_blocks_rich_text_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_rich_text_locales" ADD CONSTRAINT "_pages_v_blocks_rich_text_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v_blocks_rich_text"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_image_text" ADD CONSTRAINT "_pages_v_blocks_image_text_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_image_text" ADD CONSTRAINT "_pages_v_blocks_image_text_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_image_text_locales" ADD CONSTRAINT "_pages_v_blocks_image_text_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v_blocks_image_text"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_image_gallery" ADD CONSTRAINT "_pages_v_blocks_image_gallery_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_image_gallery_locales" ADD CONSTRAINT "_pages_v_blocks_image_gallery_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v_blocks_image_gallery"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_product_teaser" ADD CONSTRAINT "_pages_v_blocks_product_teaser_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_product_teaser_locales" ADD CONSTRAINT "_pages_v_blocks_product_teaser_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v_blocks_product_teaser"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_category_teaser_categories" ADD CONSTRAINT "_pages_v_blocks_category_teaser_categories_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_pages_v_blocks_category_teaser"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_category_teaser" ADD CONSTRAINT "_pages_v_blocks_category_teaser_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_category_teaser_locales" ADD CONSTRAINT "_pages_v_blocks_category_teaser_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v_blocks_category_teaser"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_flash_grid" ADD CONSTRAINT "_pages_v_blocks_flash_grid_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_flash_grid_locales" ADD CONSTRAINT "_pages_v_blocks_flash_grid_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v_blocks_flash_grid"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_offers_list" ADD CONSTRAINT "_pages_v_blocks_offers_list_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_offers_list_locales" ADD CONSTRAINT "_pages_v_blocks_offers_list_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v_blocks_offers_list"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_tattoo_gallery" ADD CONSTRAINT "_pages_v_blocks_tattoo_gallery_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_tattoo_gallery_locales" ADD CONSTRAINT "_pages_v_blocks_tattoo_gallery_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v_blocks_tattoo_gallery"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_price_info" ADD CONSTRAINT "_pages_v_blocks_price_info_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_price_info_locales" ADD CONSTRAINT "_pages_v_blocks_price_info_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v_blocks_price_info"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_process_steps_steps" ADD CONSTRAINT "_pages_v_blocks_process_steps_steps_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v_blocks_process_steps"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_process_steps_steps_locales" ADD CONSTRAINT "_pages_v_blocks_process_steps_steps_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v_blocks_process_steps_steps"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_process_steps" ADD CONSTRAINT "_pages_v_blocks_process_steps_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_process_steps_locales" ADD CONSTRAINT "_pages_v_blocks_process_steps_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v_blocks_process_steps"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_aftercare_steps_phases" ADD CONSTRAINT "_pages_v_blocks_aftercare_steps_phases_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v_blocks_aftercare_steps"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_aftercare_steps_phases_locales" ADD CONSTRAINT "_pages_v_blocks_aftercare_steps_phases_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v_blocks_aftercare_steps_phases"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_aftercare_steps" ADD CONSTRAINT "_pages_v_blocks_aftercare_steps_pdf_id_documents_id_fk" FOREIGN KEY ("pdf_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_aftercare_steps" ADD CONSTRAINT "_pages_v_blocks_aftercare_steps_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_aftercare_steps_locales" ADD CONSTRAINT "_pages_v_blocks_aftercare_steps_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v_blocks_aftercare_steps"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_faq_list" ADD CONSTRAINT "_pages_v_blocks_faq_list_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_faq_list_locales" ADD CONSTRAINT "_pages_v_blocks_faq_list_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v_blocks_faq_list"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_contact_links" ADD CONSTRAINT "_pages_v_blocks_contact_links_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_contact_links_locales" ADD CONSTRAINT "_pages_v_blocks_contact_links_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v_blocks_contact_links"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_commission_form" ADD CONSTRAINT "_pages_v_blocks_commission_form_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_commission_form_locales" ADD CONSTRAINT "_pages_v_blocks_commission_form_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v_blocks_commission_form"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_callout" ADD CONSTRAINT "_pages_v_blocks_callout_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_callout_locales" ADD CONSTRAINT "_pages_v_blocks_callout_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v_blocks_callout"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v" ADD CONSTRAINT "_pages_v_parent_id_pages_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."pages"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_pages_v" ADD CONSTRAINT "_pages_v_version_seo_og_image_id_media_id_fk" FOREIGN KEY ("version_seo_og_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_pages_v_locales" ADD CONSTRAINT "_pages_v_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_rels" ADD CONSTRAINT "_pages_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_rels" ADD CONSTRAINT "_pages_v_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_rels" ADD CONSTRAINT "_pages_v_rels_products_fk" FOREIGN KEY ("products_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "privacy_requests_types" ADD CONSTRAINT "privacy_requests_types_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."privacy_requests"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "privacy_requests" ADD CONSTRAINT "privacy_requests_export_file_id_private_uploads_id_fk" FOREIGN KEY ("export_file_id") REFERENCES "public"."private_uploads"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "privacy_requests_rels" ADD CONSTRAINT "privacy_requests_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."privacy_requests"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "privacy_requests_rels" ADD CONSTRAINT "privacy_requests_rels_orders_fk" FOREIGN KEY ("orders_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "privacy_requests_rels" ADD CONSTRAINT "privacy_requests_rels_withdrawals_fk" FOREIGN KEY ("withdrawals_id") REFERENCES "public"."withdrawals"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "privacy_requests_rels" ADD CONSTRAINT "privacy_requests_rels_inquiries_fk" FOREIGN KEY ("inquiries_id") REFERENCES "public"."inquiries"("id") ON DELETE cascade ON UPDATE no action;
  CREATE UNIQUE INDEX "inquiries_reference_idx" ON "inquiries" USING btree ("reference");
  CREATE INDEX "inquiries_email_idx" ON "inquiries" USING btree ("email");
  CREATE INDEX "inquiries_privacy_notice_version_idx" ON "inquiries" USING btree ("privacy_notice_version_id");
  CREATE INDEX "inquiries_status_idx" ON "inquiries" USING btree ("status");
  CREATE INDEX "inquiries_delete_after_idx" ON "inquiries" USING btree ("delete_after");
  CREATE INDEX "inquiries_seed_idx" ON "inquiries" USING btree ("seed");
  CREATE INDEX "inquiries_seed_key_idx" ON "inquiries" USING btree ("seed_key");
  CREATE INDEX "inquiries_updated_at_idx" ON "inquiries" USING btree ("updated_at");
  CREATE INDEX "inquiries_created_at_idx" ON "inquiries" USING btree ("created_at");
  CREATE INDEX "inquiries_rels_order_idx" ON "inquiries_rels" USING btree ("order");
  CREATE INDEX "inquiries_rels_parent_idx" ON "inquiries_rels" USING btree ("parent_id");
  CREATE INDEX "inquiries_rels_path_idx" ON "inquiries_rels" USING btree ("path");
  CREATE INDEX "inquiries_rels_private_uploads_id_idx" ON "inquiries_rels" USING btree ("private_uploads_id");
  CREATE INDEX "faqs_category_idx" ON "faqs" USING btree ("category");
  CREATE INDEX "faqs_sort_order_idx" ON "faqs" USING btree ("sort_order");
  CREATE INDEX "faqs_seed_idx" ON "faqs" USING btree ("seed");
  CREATE INDEX "faqs_seed_key_idx" ON "faqs" USING btree ("seed_key");
  CREATE INDEX "faqs_updated_at_idx" ON "faqs" USING btree ("updated_at");
  CREATE INDEX "faqs_created_at_idx" ON "faqs" USING btree ("created_at");
  CREATE UNIQUE INDEX "faqs_locales_locale_parent_id_unique" ON "faqs_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_faqs_v_parent_idx" ON "_faqs_v" USING btree ("parent_id");
  CREATE INDEX "_faqs_v_version_version_category_idx" ON "_faqs_v" USING btree ("version_category");
  CREATE INDEX "_faqs_v_version_version_sort_order_idx" ON "_faqs_v" USING btree ("version_sort_order");
  CREATE INDEX "_faqs_v_version_version_seed_idx" ON "_faqs_v" USING btree ("version_seed");
  CREATE INDEX "_faqs_v_version_version_seed_key_idx" ON "_faqs_v" USING btree ("version_seed_key");
  CREATE INDEX "_faqs_v_version_version_updated_at_idx" ON "_faqs_v" USING btree ("version_updated_at");
  CREATE INDEX "_faqs_v_version_version_created_at_idx" ON "_faqs_v" USING btree ("version_created_at");
  CREATE INDEX "_faqs_v_created_at_idx" ON "_faqs_v" USING btree ("created_at");
  CREATE INDEX "_faqs_v_updated_at_idx" ON "_faqs_v" USING btree ("updated_at");
  CREATE UNIQUE INDEX "_faqs_v_locales_locale_parent_id_unique" ON "_faqs_v_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "pages_blocks_hero_order_idx" ON "pages_blocks_hero" USING btree ("_order");
  CREATE INDEX "pages_blocks_hero_parent_id_idx" ON "pages_blocks_hero" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_hero_path_idx" ON "pages_blocks_hero" USING btree ("_path");
  CREATE INDEX "pages_blocks_hero_image_idx" ON "pages_blocks_hero" USING btree ("image_id");
  CREATE UNIQUE INDEX "pages_blocks_hero_locales_locale_parent_id_unique" ON "pages_blocks_hero_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "pages_blocks_station_order_idx" ON "pages_blocks_station" USING btree ("_order");
  CREATE INDEX "pages_blocks_station_parent_id_idx" ON "pages_blocks_station" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_station_path_idx" ON "pages_blocks_station" USING btree ("_path");
  CREATE INDEX "pages_blocks_station_image_idx" ON "pages_blocks_station" USING btree ("image_id");
  CREATE UNIQUE INDEX "pages_blocks_station_locales_locale_parent_id_unique" ON "pages_blocks_station_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "pages_blocks_rich_text_order_idx" ON "pages_blocks_rich_text" USING btree ("_order");
  CREATE INDEX "pages_blocks_rich_text_parent_id_idx" ON "pages_blocks_rich_text" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_rich_text_path_idx" ON "pages_blocks_rich_text" USING btree ("_path");
  CREATE UNIQUE INDEX "pages_blocks_rich_text_locales_locale_parent_id_unique" ON "pages_blocks_rich_text_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "pages_blocks_image_text_order_idx" ON "pages_blocks_image_text" USING btree ("_order");
  CREATE INDEX "pages_blocks_image_text_parent_id_idx" ON "pages_blocks_image_text" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_image_text_path_idx" ON "pages_blocks_image_text" USING btree ("_path");
  CREATE INDEX "pages_blocks_image_text_image_idx" ON "pages_blocks_image_text" USING btree ("image_id");
  CREATE UNIQUE INDEX "pages_blocks_image_text_locales_locale_parent_id_unique" ON "pages_blocks_image_text_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "pages_blocks_image_gallery_order_idx" ON "pages_blocks_image_gallery" USING btree ("_order");
  CREATE INDEX "pages_blocks_image_gallery_parent_id_idx" ON "pages_blocks_image_gallery" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_image_gallery_path_idx" ON "pages_blocks_image_gallery" USING btree ("_path");
  CREATE UNIQUE INDEX "pages_blocks_image_gallery_locales_locale_parent_id_unique" ON "pages_blocks_image_gallery_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "pages_blocks_product_teaser_order_idx" ON "pages_blocks_product_teaser" USING btree ("_order");
  CREATE INDEX "pages_blocks_product_teaser_parent_id_idx" ON "pages_blocks_product_teaser" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_product_teaser_path_idx" ON "pages_blocks_product_teaser" USING btree ("_path");
  CREATE UNIQUE INDEX "pages_blocks_product_teaser_locales_locale_parent_id_unique" ON "pages_blocks_product_teaser_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "pages_blocks_category_teaser_categories_order_idx" ON "pages_blocks_category_teaser_categories" USING btree ("order");
  CREATE INDEX "pages_blocks_category_teaser_categories_parent_idx" ON "pages_blocks_category_teaser_categories" USING btree ("parent_id");
  CREATE INDEX "pages_blocks_category_teaser_order_idx" ON "pages_blocks_category_teaser" USING btree ("_order");
  CREATE INDEX "pages_blocks_category_teaser_parent_id_idx" ON "pages_blocks_category_teaser" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_category_teaser_path_idx" ON "pages_blocks_category_teaser" USING btree ("_path");
  CREATE UNIQUE INDEX "pages_blocks_category_teaser_locales_locale_parent_id_unique" ON "pages_blocks_category_teaser_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "pages_blocks_flash_grid_order_idx" ON "pages_blocks_flash_grid" USING btree ("_order");
  CREATE INDEX "pages_blocks_flash_grid_parent_id_idx" ON "pages_blocks_flash_grid" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_flash_grid_path_idx" ON "pages_blocks_flash_grid" USING btree ("_path");
  CREATE UNIQUE INDEX "pages_blocks_flash_grid_locales_locale_parent_id_unique" ON "pages_blocks_flash_grid_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "pages_blocks_offers_list_order_idx" ON "pages_blocks_offers_list" USING btree ("_order");
  CREATE INDEX "pages_blocks_offers_list_parent_id_idx" ON "pages_blocks_offers_list" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_offers_list_path_idx" ON "pages_blocks_offers_list" USING btree ("_path");
  CREATE UNIQUE INDEX "pages_blocks_offers_list_locales_locale_parent_id_unique" ON "pages_blocks_offers_list_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "pages_blocks_tattoo_gallery_order_idx" ON "pages_blocks_tattoo_gallery" USING btree ("_order");
  CREATE INDEX "pages_blocks_tattoo_gallery_parent_id_idx" ON "pages_blocks_tattoo_gallery" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_tattoo_gallery_path_idx" ON "pages_blocks_tattoo_gallery" USING btree ("_path");
  CREATE UNIQUE INDEX "pages_blocks_tattoo_gallery_locales_locale_parent_id_unique" ON "pages_blocks_tattoo_gallery_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "pages_blocks_price_info_order_idx" ON "pages_blocks_price_info" USING btree ("_order");
  CREATE INDEX "pages_blocks_price_info_parent_id_idx" ON "pages_blocks_price_info" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_price_info_path_idx" ON "pages_blocks_price_info" USING btree ("_path");
  CREATE UNIQUE INDEX "pages_blocks_price_info_locales_locale_parent_id_unique" ON "pages_blocks_price_info_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "pages_blocks_process_steps_steps_order_idx" ON "pages_blocks_process_steps_steps" USING btree ("_order");
  CREATE INDEX "pages_blocks_process_steps_steps_parent_id_idx" ON "pages_blocks_process_steps_steps" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "pages_blocks_process_steps_steps_locales_locale_parent_id_un" ON "pages_blocks_process_steps_steps_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "pages_blocks_process_steps_order_idx" ON "pages_blocks_process_steps" USING btree ("_order");
  CREATE INDEX "pages_blocks_process_steps_parent_id_idx" ON "pages_blocks_process_steps" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_process_steps_path_idx" ON "pages_blocks_process_steps" USING btree ("_path");
  CREATE UNIQUE INDEX "pages_blocks_process_steps_locales_locale_parent_id_unique" ON "pages_blocks_process_steps_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "pages_blocks_aftercare_steps_phases_order_idx" ON "pages_blocks_aftercare_steps_phases" USING btree ("_order");
  CREATE INDEX "pages_blocks_aftercare_steps_phases_parent_id_idx" ON "pages_blocks_aftercare_steps_phases" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "pages_blocks_aftercare_steps_phases_locales_locale_parent_id" ON "pages_blocks_aftercare_steps_phases_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "pages_blocks_aftercare_steps_order_idx" ON "pages_blocks_aftercare_steps" USING btree ("_order");
  CREATE INDEX "pages_blocks_aftercare_steps_parent_id_idx" ON "pages_blocks_aftercare_steps" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_aftercare_steps_path_idx" ON "pages_blocks_aftercare_steps" USING btree ("_path");
  CREATE INDEX "pages_blocks_aftercare_steps_pdf_idx" ON "pages_blocks_aftercare_steps" USING btree ("pdf_id");
  CREATE UNIQUE INDEX "pages_blocks_aftercare_steps_locales_locale_parent_id_unique" ON "pages_blocks_aftercare_steps_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "pages_blocks_faq_list_order_idx" ON "pages_blocks_faq_list" USING btree ("_order");
  CREATE INDEX "pages_blocks_faq_list_parent_id_idx" ON "pages_blocks_faq_list" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_faq_list_path_idx" ON "pages_blocks_faq_list" USING btree ("_path");
  CREATE UNIQUE INDEX "pages_blocks_faq_list_locales_locale_parent_id_unique" ON "pages_blocks_faq_list_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "pages_blocks_contact_links_order_idx" ON "pages_blocks_contact_links" USING btree ("_order");
  CREATE INDEX "pages_blocks_contact_links_parent_id_idx" ON "pages_blocks_contact_links" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_contact_links_path_idx" ON "pages_blocks_contact_links" USING btree ("_path");
  CREATE UNIQUE INDEX "pages_blocks_contact_links_locales_locale_parent_id_unique" ON "pages_blocks_contact_links_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "pages_blocks_commission_form_order_idx" ON "pages_blocks_commission_form" USING btree ("_order");
  CREATE INDEX "pages_blocks_commission_form_parent_id_idx" ON "pages_blocks_commission_form" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_commission_form_path_idx" ON "pages_blocks_commission_form" USING btree ("_path");
  CREATE UNIQUE INDEX "pages_blocks_commission_form_locales_locale_parent_id_unique" ON "pages_blocks_commission_form_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "pages_blocks_callout_order_idx" ON "pages_blocks_callout" USING btree ("_order");
  CREATE INDEX "pages_blocks_callout_parent_id_idx" ON "pages_blocks_callout" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_callout_path_idx" ON "pages_blocks_callout" USING btree ("_path");
  CREATE UNIQUE INDEX "pages_blocks_callout_locales_locale_parent_id_unique" ON "pages_blocks_callout_locales" USING btree ("_locale","_parent_id");
  CREATE UNIQUE INDEX "pages_key_idx" ON "pages" USING btree ("key");
  CREATE INDEX "pages_seo_seo_og_image_idx" ON "pages" USING btree ("seo_og_image_id");
  CREATE INDEX "pages_seed_idx" ON "pages" USING btree ("seed");
  CREATE INDEX "pages_seed_key_idx" ON "pages" USING btree ("seed_key");
  CREATE INDEX "pages_updated_at_idx" ON "pages" USING btree ("updated_at");
  CREATE INDEX "pages_created_at_idx" ON "pages" USING btree ("created_at");
  CREATE INDEX "pages__status_idx" ON "pages" USING btree ("_status");
  CREATE UNIQUE INDEX "pages_locales_locale_parent_id_unique" ON "pages_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "pages_rels_order_idx" ON "pages_rels" USING btree ("order");
  CREATE INDEX "pages_rels_parent_idx" ON "pages_rels" USING btree ("parent_id");
  CREATE INDEX "pages_rels_path_idx" ON "pages_rels" USING btree ("path");
  CREATE INDEX "pages_rels_media_id_idx" ON "pages_rels" USING btree ("media_id");
  CREATE INDEX "pages_rels_products_id_idx" ON "pages_rels" USING btree ("products_id");
  CREATE INDEX "_pages_v_blocks_hero_order_idx" ON "_pages_v_blocks_hero" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_hero_parent_id_idx" ON "_pages_v_blocks_hero" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_hero_path_idx" ON "_pages_v_blocks_hero" USING btree ("_path");
  CREATE INDEX "_pages_v_blocks_hero_image_idx" ON "_pages_v_blocks_hero" USING btree ("image_id");
  CREATE UNIQUE INDEX "_pages_v_blocks_hero_locales_locale_parent_id_unique" ON "_pages_v_blocks_hero_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_pages_v_blocks_station_order_idx" ON "_pages_v_blocks_station" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_station_parent_id_idx" ON "_pages_v_blocks_station" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_station_path_idx" ON "_pages_v_blocks_station" USING btree ("_path");
  CREATE INDEX "_pages_v_blocks_station_image_idx" ON "_pages_v_blocks_station" USING btree ("image_id");
  CREATE UNIQUE INDEX "_pages_v_blocks_station_locales_locale_parent_id_unique" ON "_pages_v_blocks_station_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_pages_v_blocks_rich_text_order_idx" ON "_pages_v_blocks_rich_text" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_rich_text_parent_id_idx" ON "_pages_v_blocks_rich_text" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_rich_text_path_idx" ON "_pages_v_blocks_rich_text" USING btree ("_path");
  CREATE UNIQUE INDEX "_pages_v_blocks_rich_text_locales_locale_parent_id_unique" ON "_pages_v_blocks_rich_text_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_pages_v_blocks_image_text_order_idx" ON "_pages_v_blocks_image_text" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_image_text_parent_id_idx" ON "_pages_v_blocks_image_text" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_image_text_path_idx" ON "_pages_v_blocks_image_text" USING btree ("_path");
  CREATE INDEX "_pages_v_blocks_image_text_image_idx" ON "_pages_v_blocks_image_text" USING btree ("image_id");
  CREATE UNIQUE INDEX "_pages_v_blocks_image_text_locales_locale_parent_id_unique" ON "_pages_v_blocks_image_text_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_pages_v_blocks_image_gallery_order_idx" ON "_pages_v_blocks_image_gallery" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_image_gallery_parent_id_idx" ON "_pages_v_blocks_image_gallery" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_image_gallery_path_idx" ON "_pages_v_blocks_image_gallery" USING btree ("_path");
  CREATE UNIQUE INDEX "_pages_v_blocks_image_gallery_locales_locale_parent_id_uniqu" ON "_pages_v_blocks_image_gallery_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_pages_v_blocks_product_teaser_order_idx" ON "_pages_v_blocks_product_teaser" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_product_teaser_parent_id_idx" ON "_pages_v_blocks_product_teaser" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_product_teaser_path_idx" ON "_pages_v_blocks_product_teaser" USING btree ("_path");
  CREATE UNIQUE INDEX "_pages_v_blocks_product_teaser_locales_locale_parent_id_uniq" ON "_pages_v_blocks_product_teaser_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_pages_v_blocks_category_teaser_categories_order_idx" ON "_pages_v_blocks_category_teaser_categories" USING btree ("order");
  CREATE INDEX "_pages_v_blocks_category_teaser_categories_parent_idx" ON "_pages_v_blocks_category_teaser_categories" USING btree ("parent_id");
  CREATE INDEX "_pages_v_blocks_category_teaser_order_idx" ON "_pages_v_blocks_category_teaser" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_category_teaser_parent_id_idx" ON "_pages_v_blocks_category_teaser" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_category_teaser_path_idx" ON "_pages_v_blocks_category_teaser" USING btree ("_path");
  CREATE UNIQUE INDEX "_pages_v_blocks_category_teaser_locales_locale_parent_id_uni" ON "_pages_v_blocks_category_teaser_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_pages_v_blocks_flash_grid_order_idx" ON "_pages_v_blocks_flash_grid" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_flash_grid_parent_id_idx" ON "_pages_v_blocks_flash_grid" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_flash_grid_path_idx" ON "_pages_v_blocks_flash_grid" USING btree ("_path");
  CREATE UNIQUE INDEX "_pages_v_blocks_flash_grid_locales_locale_parent_id_unique" ON "_pages_v_blocks_flash_grid_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_pages_v_blocks_offers_list_order_idx" ON "_pages_v_blocks_offers_list" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_offers_list_parent_id_idx" ON "_pages_v_blocks_offers_list" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_offers_list_path_idx" ON "_pages_v_blocks_offers_list" USING btree ("_path");
  CREATE UNIQUE INDEX "_pages_v_blocks_offers_list_locales_locale_parent_id_unique" ON "_pages_v_blocks_offers_list_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_pages_v_blocks_tattoo_gallery_order_idx" ON "_pages_v_blocks_tattoo_gallery" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_tattoo_gallery_parent_id_idx" ON "_pages_v_blocks_tattoo_gallery" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_tattoo_gallery_path_idx" ON "_pages_v_blocks_tattoo_gallery" USING btree ("_path");
  CREATE UNIQUE INDEX "_pages_v_blocks_tattoo_gallery_locales_locale_parent_id_uniq" ON "_pages_v_blocks_tattoo_gallery_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_pages_v_blocks_price_info_order_idx" ON "_pages_v_blocks_price_info" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_price_info_parent_id_idx" ON "_pages_v_blocks_price_info" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_price_info_path_idx" ON "_pages_v_blocks_price_info" USING btree ("_path");
  CREATE UNIQUE INDEX "_pages_v_blocks_price_info_locales_locale_parent_id_unique" ON "_pages_v_blocks_price_info_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_pages_v_blocks_process_steps_steps_order_idx" ON "_pages_v_blocks_process_steps_steps" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_process_steps_steps_parent_id_idx" ON "_pages_v_blocks_process_steps_steps" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "_pages_v_blocks_process_steps_steps_locales_locale_parent_id" ON "_pages_v_blocks_process_steps_steps_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_pages_v_blocks_process_steps_order_idx" ON "_pages_v_blocks_process_steps" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_process_steps_parent_id_idx" ON "_pages_v_blocks_process_steps" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_process_steps_path_idx" ON "_pages_v_blocks_process_steps" USING btree ("_path");
  CREATE UNIQUE INDEX "_pages_v_blocks_process_steps_locales_locale_parent_id_uniqu" ON "_pages_v_blocks_process_steps_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_pages_v_blocks_aftercare_steps_phases_order_idx" ON "_pages_v_blocks_aftercare_steps_phases" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_aftercare_steps_phases_parent_id_idx" ON "_pages_v_blocks_aftercare_steps_phases" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "_pages_v_blocks_aftercare_steps_phases_locales_locale_parent" ON "_pages_v_blocks_aftercare_steps_phases_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_pages_v_blocks_aftercare_steps_order_idx" ON "_pages_v_blocks_aftercare_steps" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_aftercare_steps_parent_id_idx" ON "_pages_v_blocks_aftercare_steps" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_aftercare_steps_path_idx" ON "_pages_v_blocks_aftercare_steps" USING btree ("_path");
  CREATE INDEX "_pages_v_blocks_aftercare_steps_pdf_idx" ON "_pages_v_blocks_aftercare_steps" USING btree ("pdf_id");
  CREATE UNIQUE INDEX "_pages_v_blocks_aftercare_steps_locales_locale_parent_id_uni" ON "_pages_v_blocks_aftercare_steps_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_pages_v_blocks_faq_list_order_idx" ON "_pages_v_blocks_faq_list" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_faq_list_parent_id_idx" ON "_pages_v_blocks_faq_list" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_faq_list_path_idx" ON "_pages_v_blocks_faq_list" USING btree ("_path");
  CREATE UNIQUE INDEX "_pages_v_blocks_faq_list_locales_locale_parent_id_unique" ON "_pages_v_blocks_faq_list_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_pages_v_blocks_contact_links_order_idx" ON "_pages_v_blocks_contact_links" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_contact_links_parent_id_idx" ON "_pages_v_blocks_contact_links" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_contact_links_path_idx" ON "_pages_v_blocks_contact_links" USING btree ("_path");
  CREATE UNIQUE INDEX "_pages_v_blocks_contact_links_locales_locale_parent_id_uniqu" ON "_pages_v_blocks_contact_links_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_pages_v_blocks_commission_form_order_idx" ON "_pages_v_blocks_commission_form" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_commission_form_parent_id_idx" ON "_pages_v_blocks_commission_form" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_commission_form_path_idx" ON "_pages_v_blocks_commission_form" USING btree ("_path");
  CREATE UNIQUE INDEX "_pages_v_blocks_commission_form_locales_locale_parent_id_uni" ON "_pages_v_blocks_commission_form_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_pages_v_blocks_callout_order_idx" ON "_pages_v_blocks_callout" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_callout_parent_id_idx" ON "_pages_v_blocks_callout" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_callout_path_idx" ON "_pages_v_blocks_callout" USING btree ("_path");
  CREATE UNIQUE INDEX "_pages_v_blocks_callout_locales_locale_parent_id_unique" ON "_pages_v_blocks_callout_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_pages_v_parent_idx" ON "_pages_v" USING btree ("parent_id");
  CREATE INDEX "_pages_v_version_version_key_idx" ON "_pages_v" USING btree ("version_key");
  CREATE INDEX "_pages_v_version_seo_version_seo_og_image_idx" ON "_pages_v" USING btree ("version_seo_og_image_id");
  CREATE INDEX "_pages_v_version_version_seed_idx" ON "_pages_v" USING btree ("version_seed");
  CREATE INDEX "_pages_v_version_version_seed_key_idx" ON "_pages_v" USING btree ("version_seed_key");
  CREATE INDEX "_pages_v_version_version_updated_at_idx" ON "_pages_v" USING btree ("version_updated_at");
  CREATE INDEX "_pages_v_version_version_created_at_idx" ON "_pages_v" USING btree ("version_created_at");
  CREATE INDEX "_pages_v_version_version__status_idx" ON "_pages_v" USING btree ("version__status");
  CREATE INDEX "_pages_v_created_at_idx" ON "_pages_v" USING btree ("created_at");
  CREATE INDEX "_pages_v_updated_at_idx" ON "_pages_v" USING btree ("updated_at");
  CREATE INDEX "_pages_v_snapshot_idx" ON "_pages_v" USING btree ("snapshot");
  CREATE INDEX "_pages_v_published_locale_idx" ON "_pages_v" USING btree ("published_locale");
  CREATE INDEX "_pages_v_latest_idx" ON "_pages_v" USING btree ("latest");
  CREATE UNIQUE INDEX "_pages_v_locales_locale_parent_id_unique" ON "_pages_v_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_pages_v_rels_order_idx" ON "_pages_v_rels" USING btree ("order");
  CREATE INDEX "_pages_v_rels_parent_idx" ON "_pages_v_rels" USING btree ("parent_id");
  CREATE INDEX "_pages_v_rels_path_idx" ON "_pages_v_rels" USING btree ("path");
  CREATE INDEX "_pages_v_rels_media_id_idx" ON "_pages_v_rels" USING btree ("media_id");
  CREATE INDEX "_pages_v_rels_products_id_idx" ON "_pages_v_rels" USING btree ("products_id");
  CREATE INDEX "revenue_entries_month_idx" ON "revenue_entries" USING btree ("month");
  CREATE INDEX "revenue_entries_seed_idx" ON "revenue_entries" USING btree ("seed");
  CREATE INDEX "revenue_entries_seed_key_idx" ON "revenue_entries" USING btree ("seed_key");
  CREATE INDEX "revenue_entries_updated_at_idx" ON "revenue_entries" USING btree ("updated_at");
  CREATE INDEX "revenue_entries_created_at_idx" ON "revenue_entries" USING btree ("created_at");
  CREATE UNIQUE INDEX "month_source_idx" ON "revenue_entries" USING btree ("month","source");
  CREATE INDEX "privacy_requests_types_order_idx" ON "privacy_requests_types" USING btree ("order");
  CREATE INDEX "privacy_requests_types_parent_idx" ON "privacy_requests_types" USING btree ("parent_id");
  CREATE UNIQUE INDEX "privacy_requests_reference_idx" ON "privacy_requests" USING btree ("reference");
  CREATE INDEX "privacy_requests_due_at_idx" ON "privacy_requests" USING btree ("due_at");
  CREATE INDEX "privacy_requests_status_idx" ON "privacy_requests" USING btree ("status");
  CREATE INDEX "privacy_requests_contact_email_idx" ON "privacy_requests" USING btree ("contact_email");
  CREATE INDEX "privacy_requests_export_file_idx" ON "privacy_requests" USING btree ("export_file_id");
  CREATE INDEX "privacy_requests_retain_until_idx" ON "privacy_requests" USING btree ("retain_until");
  CREATE INDEX "privacy_requests_seed_idx" ON "privacy_requests" USING btree ("seed");
  CREATE INDEX "privacy_requests_seed_key_idx" ON "privacy_requests" USING btree ("seed_key");
  CREATE INDEX "privacy_requests_updated_at_idx" ON "privacy_requests" USING btree ("updated_at");
  CREATE INDEX "privacy_requests_created_at_idx" ON "privacy_requests" USING btree ("created_at");
  CREATE INDEX "privacy_requests_rels_order_idx" ON "privacy_requests_rels" USING btree ("order");
  CREATE INDEX "privacy_requests_rels_parent_idx" ON "privacy_requests_rels" USING btree ("parent_id");
  CREATE INDEX "privacy_requests_rels_path_idx" ON "privacy_requests_rels" USING btree ("path");
  CREATE INDEX "privacy_requests_rels_orders_id_idx" ON "privacy_requests_rels" USING btree ("orders_id");
  CREATE INDEX "privacy_requests_rels_withdrawals_id_idx" ON "privacy_requests_rels" USING btree ("withdrawals_id");
  CREATE INDEX "privacy_requests_rels_inquiries_id_idx" ON "privacy_requests_rels" USING btree ("inquiries_id");
  ALTER TABLE "private_uploads" ADD CONSTRAINT "private_uploads_related_inquiry_id_inquiries_id_fk" FOREIGN KEY ("related_inquiry_id") REFERENCES "public"."inquiries"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "private_uploads" ADD CONSTRAINT "private_uploads_related_privacy_request_id_privacy_requests_id_fk" FOREIGN KEY ("related_privacy_request_id") REFERENCES "public"."privacy_requests"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "email_log" ADD CONSTRAINT "email_log_inquiry_id_inquiries_id_fk" FOREIGN KEY ("inquiry_id") REFERENCES "public"."inquiries"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "consent_log" ADD CONSTRAINT "consent_log_inquiry_id_inquiries_id_fk" FOREIGN KEY ("inquiry_id") REFERENCES "public"."inquiries"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_inquiries_fk" FOREIGN KEY ("inquiries_id") REFERENCES "public"."inquiries"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_faqs_fk" FOREIGN KEY ("faqs_id") REFERENCES "public"."faqs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_pages_fk" FOREIGN KEY ("pages_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_revenue_entries_fk" FOREIGN KEY ("revenue_entries_id") REFERENCES "public"."revenue_entries"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_privacy_requests_fk" FOREIGN KEY ("privacy_requests_id") REFERENCES "public"."privacy_requests"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "private_uploads_related_inquiry_idx" ON "private_uploads" USING btree ("related_inquiry_id");
  CREATE INDEX "private_uploads_related_privacy_request_idx" ON "private_uploads" USING btree ("related_privacy_request_id");
  CREATE INDEX "email_log_inquiry_idx" ON "email_log" USING btree ("inquiry_id");
  CREATE INDEX "consent_log_inquiry_idx" ON "consent_log" USING btree ("inquiry_id");
  CREATE INDEX "payload_locked_documents_rels_inquiries_id_idx" ON "payload_locked_documents_rels" USING btree ("inquiries_id");
  CREATE INDEX "payload_locked_documents_rels_faqs_id_idx" ON "payload_locked_documents_rels" USING btree ("faqs_id");
  CREATE INDEX "payload_locked_documents_rels_pages_id_idx" ON "payload_locked_documents_rels" USING btree ("pages_id");
  CREATE INDEX "payload_locked_documents_rels_revenue_entries_id_idx" ON "payload_locked_documents_rels" USING btree ("revenue_entries_id");
  CREATE INDEX "payload_locked_documents_rels_privacy_requests_id_idx" ON "payload_locked_documents_rels" USING btree ("privacy_requests_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "inquiries" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "inquiries_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "faqs" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "faqs_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_faqs_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_faqs_v_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pages_blocks_hero" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pages_blocks_hero_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pages_blocks_station" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pages_blocks_station_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pages_blocks_rich_text" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pages_blocks_rich_text_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pages_blocks_image_text" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pages_blocks_image_text_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pages_blocks_image_gallery" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pages_blocks_image_gallery_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pages_blocks_product_teaser" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pages_blocks_product_teaser_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pages_blocks_category_teaser_categories" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pages_blocks_category_teaser" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pages_blocks_category_teaser_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pages_blocks_flash_grid" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pages_blocks_flash_grid_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pages_blocks_offers_list" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pages_blocks_offers_list_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pages_blocks_tattoo_gallery" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pages_blocks_tattoo_gallery_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pages_blocks_price_info" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pages_blocks_price_info_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pages_blocks_process_steps_steps" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pages_blocks_process_steps_steps_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pages_blocks_process_steps" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pages_blocks_process_steps_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pages_blocks_aftercare_steps_phases" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pages_blocks_aftercare_steps_phases_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pages_blocks_aftercare_steps" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pages_blocks_aftercare_steps_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pages_blocks_faq_list" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pages_blocks_faq_list_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pages_blocks_contact_links" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pages_blocks_contact_links_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pages_blocks_commission_form" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pages_blocks_commission_form_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pages_blocks_callout" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pages_blocks_callout_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pages" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pages_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pages_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_pages_v_blocks_hero" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_pages_v_blocks_hero_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_pages_v_blocks_station" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_pages_v_blocks_station_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_pages_v_blocks_rich_text" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_pages_v_blocks_rich_text_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_pages_v_blocks_image_text" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_pages_v_blocks_image_text_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_pages_v_blocks_image_gallery" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_pages_v_blocks_image_gallery_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_pages_v_blocks_product_teaser" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_pages_v_blocks_product_teaser_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_pages_v_blocks_category_teaser_categories" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_pages_v_blocks_category_teaser" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_pages_v_blocks_category_teaser_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_pages_v_blocks_flash_grid" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_pages_v_blocks_flash_grid_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_pages_v_blocks_offers_list" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_pages_v_blocks_offers_list_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_pages_v_blocks_tattoo_gallery" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_pages_v_blocks_tattoo_gallery_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_pages_v_blocks_price_info" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_pages_v_blocks_price_info_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_pages_v_blocks_process_steps_steps" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_pages_v_blocks_process_steps_steps_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_pages_v_blocks_process_steps" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_pages_v_blocks_process_steps_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_pages_v_blocks_aftercare_steps_phases" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_pages_v_blocks_aftercare_steps_phases_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_pages_v_blocks_aftercare_steps" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_pages_v_blocks_aftercare_steps_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_pages_v_blocks_faq_list" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_pages_v_blocks_faq_list_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_pages_v_blocks_contact_links" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_pages_v_blocks_contact_links_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_pages_v_blocks_commission_form" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_pages_v_blocks_commission_form_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_pages_v_blocks_callout" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_pages_v_blocks_callout_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_pages_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_pages_v_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_pages_v_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "revenue_entries" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "privacy_requests_types" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "privacy_requests" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "privacy_requests_rels" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "inquiries" CASCADE;
  DROP TABLE "inquiries_rels" CASCADE;
  DROP TABLE "faqs" CASCADE;
  DROP TABLE "faqs_locales" CASCADE;
  DROP TABLE "_faqs_v" CASCADE;
  DROP TABLE "_faqs_v_locales" CASCADE;
  DROP TABLE "pages_blocks_hero" CASCADE;
  DROP TABLE "pages_blocks_hero_locales" CASCADE;
  DROP TABLE "pages_blocks_station" CASCADE;
  DROP TABLE "pages_blocks_station_locales" CASCADE;
  DROP TABLE "pages_blocks_rich_text" CASCADE;
  DROP TABLE "pages_blocks_rich_text_locales" CASCADE;
  DROP TABLE "pages_blocks_image_text" CASCADE;
  DROP TABLE "pages_blocks_image_text_locales" CASCADE;
  DROP TABLE "pages_blocks_image_gallery" CASCADE;
  DROP TABLE "pages_blocks_image_gallery_locales" CASCADE;
  DROP TABLE "pages_blocks_product_teaser" CASCADE;
  DROP TABLE "pages_blocks_product_teaser_locales" CASCADE;
  DROP TABLE "pages_blocks_category_teaser_categories" CASCADE;
  DROP TABLE "pages_blocks_category_teaser" CASCADE;
  DROP TABLE "pages_blocks_category_teaser_locales" CASCADE;
  DROP TABLE "pages_blocks_flash_grid" CASCADE;
  DROP TABLE "pages_blocks_flash_grid_locales" CASCADE;
  DROP TABLE "pages_blocks_offers_list" CASCADE;
  DROP TABLE "pages_blocks_offers_list_locales" CASCADE;
  DROP TABLE "pages_blocks_tattoo_gallery" CASCADE;
  DROP TABLE "pages_blocks_tattoo_gallery_locales" CASCADE;
  DROP TABLE "pages_blocks_price_info" CASCADE;
  DROP TABLE "pages_blocks_price_info_locales" CASCADE;
  DROP TABLE "pages_blocks_process_steps_steps" CASCADE;
  DROP TABLE "pages_blocks_process_steps_steps_locales" CASCADE;
  DROP TABLE "pages_blocks_process_steps" CASCADE;
  DROP TABLE "pages_blocks_process_steps_locales" CASCADE;
  DROP TABLE "pages_blocks_aftercare_steps_phases" CASCADE;
  DROP TABLE "pages_blocks_aftercare_steps_phases_locales" CASCADE;
  DROP TABLE "pages_blocks_aftercare_steps" CASCADE;
  DROP TABLE "pages_blocks_aftercare_steps_locales" CASCADE;
  DROP TABLE "pages_blocks_faq_list" CASCADE;
  DROP TABLE "pages_blocks_faq_list_locales" CASCADE;
  DROP TABLE "pages_blocks_contact_links" CASCADE;
  DROP TABLE "pages_blocks_contact_links_locales" CASCADE;
  DROP TABLE "pages_blocks_commission_form" CASCADE;
  DROP TABLE "pages_blocks_commission_form_locales" CASCADE;
  DROP TABLE "pages_blocks_callout" CASCADE;
  DROP TABLE "pages_blocks_callout_locales" CASCADE;
  DROP TABLE "pages" CASCADE;
  DROP TABLE "pages_locales" CASCADE;
  DROP TABLE "pages_rels" CASCADE;
  DROP TABLE "_pages_v_blocks_hero" CASCADE;
  DROP TABLE "_pages_v_blocks_hero_locales" CASCADE;
  DROP TABLE "_pages_v_blocks_station" CASCADE;
  DROP TABLE "_pages_v_blocks_station_locales" CASCADE;
  DROP TABLE "_pages_v_blocks_rich_text" CASCADE;
  DROP TABLE "_pages_v_blocks_rich_text_locales" CASCADE;
  DROP TABLE "_pages_v_blocks_image_text" CASCADE;
  DROP TABLE "_pages_v_blocks_image_text_locales" CASCADE;
  DROP TABLE "_pages_v_blocks_image_gallery" CASCADE;
  DROP TABLE "_pages_v_blocks_image_gallery_locales" CASCADE;
  DROP TABLE "_pages_v_blocks_product_teaser" CASCADE;
  DROP TABLE "_pages_v_blocks_product_teaser_locales" CASCADE;
  DROP TABLE "_pages_v_blocks_category_teaser_categories" CASCADE;
  DROP TABLE "_pages_v_blocks_category_teaser" CASCADE;
  DROP TABLE "_pages_v_blocks_category_teaser_locales" CASCADE;
  DROP TABLE "_pages_v_blocks_flash_grid" CASCADE;
  DROP TABLE "_pages_v_blocks_flash_grid_locales" CASCADE;
  DROP TABLE "_pages_v_blocks_offers_list" CASCADE;
  DROP TABLE "_pages_v_blocks_offers_list_locales" CASCADE;
  DROP TABLE "_pages_v_blocks_tattoo_gallery" CASCADE;
  DROP TABLE "_pages_v_blocks_tattoo_gallery_locales" CASCADE;
  DROP TABLE "_pages_v_blocks_price_info" CASCADE;
  DROP TABLE "_pages_v_blocks_price_info_locales" CASCADE;
  DROP TABLE "_pages_v_blocks_process_steps_steps" CASCADE;
  DROP TABLE "_pages_v_blocks_process_steps_steps_locales" CASCADE;
  DROP TABLE "_pages_v_blocks_process_steps" CASCADE;
  DROP TABLE "_pages_v_blocks_process_steps_locales" CASCADE;
  DROP TABLE "_pages_v_blocks_aftercare_steps_phases" CASCADE;
  DROP TABLE "_pages_v_blocks_aftercare_steps_phases_locales" CASCADE;
  DROP TABLE "_pages_v_blocks_aftercare_steps" CASCADE;
  DROP TABLE "_pages_v_blocks_aftercare_steps_locales" CASCADE;
  DROP TABLE "_pages_v_blocks_faq_list" CASCADE;
  DROP TABLE "_pages_v_blocks_faq_list_locales" CASCADE;
  DROP TABLE "_pages_v_blocks_contact_links" CASCADE;
  DROP TABLE "_pages_v_blocks_contact_links_locales" CASCADE;
  DROP TABLE "_pages_v_blocks_commission_form" CASCADE;
  DROP TABLE "_pages_v_blocks_commission_form_locales" CASCADE;
  DROP TABLE "_pages_v_blocks_callout" CASCADE;
  DROP TABLE "_pages_v_blocks_callout_locales" CASCADE;
  DROP TABLE "_pages_v" CASCADE;
  DROP TABLE "_pages_v_locales" CASCADE;
  DROP TABLE "_pages_v_rels" CASCADE;
  DROP TABLE "revenue_entries" CASCADE;
  DROP TABLE "privacy_requests_types" CASCADE;
  DROP TABLE "privacy_requests" CASCADE;
  DROP TABLE "privacy_requests_rels" CASCADE;
  ALTER TABLE "private_uploads" DROP CONSTRAINT "private_uploads_related_inquiry_id_inquiries_id_fk";
  
  ALTER TABLE "private_uploads" DROP CONSTRAINT "private_uploads_related_privacy_request_id_privacy_requests_id_fk";
  
  ALTER TABLE "email_log" DROP CONSTRAINT "email_log_inquiry_id_inquiries_id_fk";
  
  ALTER TABLE "consent_log" DROP CONSTRAINT "consent_log_inquiry_id_inquiries_id_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_inquiries_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_faqs_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_pages_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_revenue_entries_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_privacy_requests_fk";
  
  DROP INDEX "private_uploads_related_inquiry_idx";
  DROP INDEX "private_uploads_related_privacy_request_idx";
  DROP INDEX "email_log_inquiry_idx";
  DROP INDEX "consent_log_inquiry_idx";
  DROP INDEX "payload_locked_documents_rels_inquiries_id_idx";
  DROP INDEX "payload_locked_documents_rels_faqs_id_idx";
  DROP INDEX "payload_locked_documents_rels_pages_id_idx";
  DROP INDEX "payload_locked_documents_rels_revenue_entries_id_idx";
  DROP INDEX "payload_locked_documents_rels_privacy_requests_id_idx";
  ALTER TABLE "private_uploads" DROP COLUMN "related_inquiry_id";
  ALTER TABLE "private_uploads" DROP COLUMN "related_privacy_request_id";
  ALTER TABLE "email_log" DROP COLUMN "inquiry_id";
  ALTER TABLE "consent_log" DROP COLUMN "inquiry_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "inquiries_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "faqs_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "pages_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "revenue_entries_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "privacy_requests_id";
  DROP TYPE "public"."enum_inquiries_object_type";
  DROP TYPE "public"."enum_inquiries_locale";
  DROP TYPE "public"."enum_inquiries_status";
  DROP TYPE "public"."enum_faqs_category";
  DROP TYPE "public"."enum__faqs_v_version_category";
  DROP TYPE "public"."enum_pages_blocks_hero_coco_pose";
  DROP TYPE "public"."enum_pages_blocks_station_link_target";
  DROP TYPE "public"."enum_pages_blocks_station_link_category";
  DROP TYPE "public"."enum_pages_blocks_station_coco_pose";
  DROP TYPE "public"."enum_pages_blocks_station_ornament";
  DROP TYPE "public"."enum_pages_blocks_image_text_image_position";
  DROP TYPE "public"."enum_pages_blocks_product_teaser_mode";
  DROP TYPE "public"."enum_pages_blocks_product_teaser_category";
  DROP TYPE "public"."enum_pages_blocks_category_teaser_categories";
  DROP TYPE "public"."enum_pages_blocks_tattoo_gallery_filter";
  DROP TYPE "public"."enum_pages_blocks_faq_list_category";
  DROP TYPE "public"."enum_pages_blocks_callout_tone";
  DROP TYPE "public"."enum_pages_key";
  DROP TYPE "public"."enum_pages_status";
  DROP TYPE "public"."enum__pages_v_blocks_hero_coco_pose";
  DROP TYPE "public"."enum__pages_v_blocks_station_link_target";
  DROP TYPE "public"."enum__pages_v_blocks_station_link_category";
  DROP TYPE "public"."enum__pages_v_blocks_station_coco_pose";
  DROP TYPE "public"."enum__pages_v_blocks_station_ornament";
  DROP TYPE "public"."enum__pages_v_blocks_image_text_image_position";
  DROP TYPE "public"."enum__pages_v_blocks_product_teaser_mode";
  DROP TYPE "public"."enum__pages_v_blocks_product_teaser_category";
  DROP TYPE "public"."enum__pages_v_blocks_category_teaser_categories";
  DROP TYPE "public"."enum__pages_v_blocks_tattoo_gallery_filter";
  DROP TYPE "public"."enum__pages_v_blocks_faq_list_category";
  DROP TYPE "public"."enum__pages_v_blocks_callout_tone";
  DROP TYPE "public"."enum__pages_v_version_key";
  DROP TYPE "public"."enum__pages_v_version_status";
  DROP TYPE "public"."enum__pages_v_published_locale";
  DROP TYPE "public"."enum_revenue_entries_source";
  DROP TYPE "public"."enum_privacy_requests_types";
  DROP TYPE "public"."enum_privacy_requests_channel";
  DROP TYPE "public"."enum_privacy_requests_status";
  DROP TYPE "public"."enum_privacy_requests_locale";
  DROP TYPE "public"."enum_privacy_requests_identity_method";`)
}
