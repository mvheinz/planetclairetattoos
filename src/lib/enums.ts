// Einzige Quelle aller Enum-Werte (DATENMODELL §4, DM-P1-05) – wörtlich übernommen.
// Keine TypeScript-`enum`s, sondern `as const`-Arrays. Labels: src/lib/enumLabels.ts.

export const LOCALES = ['de', 'en'] as const
export type Locale = (typeof LOCALES)[number]

// Shop
export const PRODUCT_CATEGORIES = [
  'keramik',
  'textil',
  'cap',
  'zeichnung',
  'schmuck',
  'sonstiges',
] as const
export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number]
export const PRODUCT_STATUSES = ['draft', 'available', 'reserved', 'sold', 'archived'] as const
export type ProductStatus = (typeof PRODUCT_STATUSES)[number]
export const SOLD_CHANNELS = ['online', 'pickup', 'offline'] as const
export type SoldChannel = (typeof SOLD_CHANNELS)[number]
export const SHIPPING_CLASSES = ['brief', 'paket_klein', 'keramik', 'nur_abholung'] as const
export type ShippingClass = (typeof SHIPPING_CLASSES)[number]
export const SHIPPING_CLASS_RANK: Record<ShippingClass, number> = {
  brief: 1,
  paket_klein: 2,
  keramik: 3,
  nur_abholung: 99,
}
export const SHIPPING_ZONES = ['DE', 'EU', 'CH'] as const
export type ShippingZone = (typeof SHIPPING_ZONES)[number]
export const FOOD_CONTACT = ['deko', 'lebensmittelecht'] as const
export type FoodContact = (typeof FOOD_CONTACT)[number]
export const VAT_CATEGORIES = ['standard', 'reduced_art'] as const
export type VatCategory = (typeof VAT_CATEGORIES)[number]
export const TEXTILE_CONDITIONS = ['like_new', 'very_good', 'good', 'worn'] as const
export type TextileCondition = (typeof TEXTILE_CONDITIONS)[number]
export const FIBER_COMPONENTS = ['main', 'lining', 'trim', 'other'] as const
export type FiberComponent = (typeof FIBER_COMPONENTS)[number]
// DATENMODELL §6.6.5 (VO (EU) 1007/2011 Anhang I), 64 Werte
export const TEXTILE_FIBERS = [
  'wool',
  'alpaca',
  'llama',
  'camel',
  'cashmere',
  'mohair',
  'angora',
  'vicuna',
  'yak',
  'guanaco',
  'cashgora',
  'beaver',
  'otter',
  'animal_hair',
  'horsehair',
  'silk',
  'cotton',
  'kapok',
  'flax',
  'hemp',
  'jute',
  'abaca',
  'alfa',
  'coir',
  'broom',
  'ramie',
  'sisal',
  'sunn',
  'henequen',
  'maguey',
  'acetate',
  'alginate',
  'cupro',
  'modal',
  'protein',
  'triacetate',
  'viscose',
  'acrylic',
  'chlorofibre',
  'fluorofibre',
  'modacrylic',
  'polyamide',
  'aramid',
  'polyimide',
  'lyocell',
  'polylactide',
  'polyester',
  'polyethylene',
  'polypropylene',
  'polycarbamide',
  'polyurethane',
  'vinylal',
  'trivinyl',
  'elastodiene',
  'elastane',
  'glass_fibre',
  'metal_fibre',
  'paper_fibre',
  'elastomultiester',
  'elastolefin',
  'melamine',
  'pp_pa_bicomponent',
  'polyacrylate',
  'other_fibres',
] as const
export type TextileFiber = (typeof TEXTILE_FIBERS)[number]
export const EN_TRANSLATION_STATUSES = ['missing', 'machine', 'reviewed'] as const
export type EnTranslationStatus = (typeof EN_TRANSLATION_STATUSES)[number]
export const DEVIATION_DECISIONS = ['none', 'described'] as const // R-048: ausdrückliche Entscheidung bei textil/cap
export type DeviationDecision = (typeof DEVIATION_DECISIONS)[number]

// Kasse & Bestellung
export const CHECKOUT_STATUSES = [
  'open',
  'confirming',
  'completed',
  'expired',
  'cancelled',
  'failed',
] as const // KONZEPT §5.2
export type CheckoutStatus = (typeof CHECKOUT_STATUSES)[number]
export const CHECKOUT_PAYMENT_CHOICES = ['stripe', 'prepayment'] as const // KONZEPT §4.4 `paymentChoice`
export type CheckoutPaymentChoice = (typeof CHECKOUT_PAYMENT_CHOICES)[number]
export const CHECKOUT_CLOSE_REASONS = [
  'reservation_expired',
  'cart_changed',
  'replaced',
  'payment_failed',
  'checkout_error',
  'sold_offline',
] as const // sold_offline: KONZEPT §5.1 P10
export type CheckoutCloseReason = (typeof CHECKOUT_CLOSE_REASONS)[number]
export const RESERVATION_SOURCES = ['checkout_session', 'prepayment'] as const
export type ReservationSource = (typeof RESERVATION_SOURCES)[number]
export const RESERVATION_STATUSES = ['active', 'converted', 'released'] as const
export type ReservationStatus = (typeof RESERVATION_STATUSES)[number]
export const RESERVATION_RELEASE_REASONS = [
  'session_expired',
  'payment_failed',
  'customer_cancelled',
  'prepayment_overdue',
  'order_cancelled',
  'checkout_error',
  'admin',
] as const
export type ReservationReleaseReason = (typeof RESERVATION_RELEASE_REASONS)[number]
export const FULFILLMENT_METHODS = ['shipping', 'pickup'] as const
export type FulfillmentMethod = (typeof FULFILLMENT_METHODS)[number]
export const PAYMENT_METHODS = ['card', 'paypal', 'prepayment'] as const // card umfasst Apple Pay/Google Pay
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]
export const PAYMENT_PROVIDERS = ['stripe', 'mock', 'bank_transfer'] as const
export type PaymentProvider = (typeof PAYMENT_PROVIDERS)[number]
// Bestellstatus exakt nach KONZEPT §5.3 (13 Werte). Vor der Zahlung gibt es keine Bestellung, nur die Kasse.
export const ORDER_STATUSES = [
  'awaiting_prepayment',
  'paid',
  'packed',
  'shipped',
  'ready_for_pickup',
  'picked_up',
  'delivered',
  'cancelled',
  'withdrawal_received',
  'return_received',
  'refunded',
  'partially_refunded',
  'disputed',
] as const
export type OrderStatus = (typeof ORDER_STATUSES)[number]
export const ORDER_CANCEL_REASONS = ['payment_timeout', 'admin', 'withdrawn'] as const // KONZEPT §5.3 O4
export type OrderCancelReason = (typeof ORDER_CANCEL_REASONS)[number]
export const DELIVERED_SOURCES = ['manual', 'auto'] as const // O10: Admin bzw. Job markDelivered
export type DeliveredSource = (typeof DELIVERED_SOURCES)[number]
export const ORDER_ITEM_STATUSES = ['active', 'withdrawn', 'returned', 'refunded'] as const
export type OrderItemStatus = (typeof ORDER_ITEM_STATUSES)[number]
export const CARRIERS = ['dhl', 'deutsche_post', 'other'] as const
export type Carrier = (typeof CARRIERS)[number]
export const PACKAGING_MATERIALS = ['paper_cardboard', 'plastic', 'other'] as const // E-47, R-201
export type PackagingMaterial = (typeof PACKAGING_MATERIALS)[number]
// KONZEPT §5.3; breakage = Stück vor dem Versand beschädigt, admin_cancellation = Storno einer bezahlten Bestellung
// durch Jutta (beide O15, DM-39)
export const REFUND_REASONS = [
  'withdrawal',
  'goodwill',
  'complaint',
  'breakage',
  'admin_cancellation',
  'item_unavailable',
  'dispute',
  'correction', // Gutschrift zur Berichtigung, danach neue Rechnung (R-152, P6.18)
] as const
export type RefundReason = (typeof REFUND_REASONS)[number]
export const REFUND_STATUSES = ['pending', 'succeeded', 'failed'] as const
export type RefundStatus = (typeof REFUND_STATUSES)[number]
export const DISPUTE_STATUSES = ['none', 'open', 'won', 'lost'] as const
export type DisputeStatus = (typeof DISPUTE_STATUSES)[number]
export const ATTENTION_REASONS = [
  'oversold',
  'dispute_open',
  'refund_failed',
  'webhook_error',
  'payment_amount_mismatch',
  'conformity_revoked',
  'manual',
] as const // conformity_revoked nur an `products` (§6.6.6)
export type AttentionReason = (typeof ATTENTION_REASONS)[number]
export const COUNTRY_CODES = [
  'DE',
  'AT',
  'BE',
  'BG',
  'CY',
  'CZ',
  'DK',
  'EE',
  'ES',
  'FI',
  'FR',
  'GR',
  'HR',
  'HU',
  'IE',
  'IT',
  'LT',
  'LU',
  'LV',
  'MT',
  'NL',
  'PL',
  'PT',
  'RO',
  'SE',
  'SI',
  'SK',
  'CH',
] as const // nie GB/US (E-24)
export type CountryCode = (typeof COUNTRY_CODES)[number]

// Belege & Steuern
export const TAX_MODES = ['kleinunternehmer', 'regelbesteuert'] as const
export type TaxMode = (typeof TAX_MODES)[number]
export const INVOICE_TYPES = ['invoice', 'credit_note'] as const
export type InvoiceType = (typeof INVOICE_TYPES)[number]
export const INVOICE_SERIES = ['RE', 'GS', 'BSP-RE', 'BSP-GS'] as const // BSP-* nur Beispielbestand
export type InvoiceSeries = (typeof INVOICE_SERIES)[number]
export const INVOICE_STATUSES = ['pending_pdf', 'issued'] as const
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number]
export const REVENUE_SOURCES = ['tattoo', 'flohmarkt', 'auftragsarbeiten', 'sonstiges'] as const // R-125, E-11
export type RevenueSource = (typeof REVENUE_SOURCES)[number]
export const REVENUE_GUARD_STAGES = ['U0', 'U1', 'U2', 'U3', 'U3a', 'U4', 'U5'] as const // KONZEPT §8.4, R-125
export type RevenueGuardStage = (typeof REVENUE_GUARD_STAGES)[number]
export const INVOICE_RETENTION_YEARS = [8, 10] as const // settings.retention.invoiceYears, Standard 10 (L-06)
export type InvoiceRetentionYears = (typeof INVOICE_RETENTION_YEARS)[number]

// Recht
export const LEGAL_TEXT_TYPES = [
  'impressum',
  'datenschutz',
  'agb',
  'widerrufsbelehrung',
  'widerrufsformular',
  'versand-zahlung',
] as const
export type LegalTextType = (typeof LEGAL_TEXT_TYPES)[number]
export const LEGAL_TEXT_STATUSES = ['draft', 'scheduled', 'active', 'superseded'] as const
export type LegalTextStatus = (typeof LEGAL_TEXT_STATUSES)[number]
export const LEGAL_TEXT_SOURCES = ['manual', 'itrk_lti'] as const // itrk_lti nur vorbereitet (E-41)
export type LegalTextSource = (typeof LEGAL_TEXT_SOURCES)[number]
export const LEGAL_TEXT_ORIGINS = ['placeholder', 'draft', 'lawyer'] as const // R-002; auch für legal-snippets
export type LegalTextOrigin = (typeof LEGAL_TEXT_ORIGINS)[number]
// Schlüssel der Rechtsbausteine = Tabelle RECHT ANFORDERUNGEN §6 (Reihenfolge wie dort); Spalte „Kanzlei“ als
// Konstante LEGAL_SNIPPET_REQUIRES_LAWYER in src/lib/legal/snippets.ts
export const LEGAL_SNIPPET_KEYS = [
  'price.kleinunternehmerNote',
  'price.shippingNote',
  'price.tattooNote',
  'delivery.timeShipping',
  'delivery.timePickup',
  'cart.paymentAndDeliveryInfo',
  'checkout.legalNotice',
  'checkout.dhlEmailConsent',
  'checkout.deviationAgreement',
  'checkout.vorkasseInfo',
  'product.ceramicsDecorative',
  'product.ceramicsFoodSafe',
  'product.jewelrySmallParts',
  'product.jewelryNickel',
  'product.textileSecondHand',
  'product.textileLabelMissing',
  'product.noSpecialWarnings',
  'product.glassFrame',
  'email.orderConfirmation.contractSentence',
  'email.vorkasse.paymentInstructions',
  'email.vorkasse.reminder',
  'email.vorkasse.cancellation',
  'email.shipping.damageNotice',
  'email.pickup.ready',
  'withdrawal.intro',
  'withdrawal.receiptNotice',
  'withdrawal.returnInfo',
  'withdrawal.returnCostsNote',
  'complaint.repairChoice',
  'dispute.vsbg37',
  'inquiry.privacyNotice',
  'inquiry.autoReply',
  'commission.offer',
  'translation.disclaimer',
  'privacyRequest.accessResponse',
  'privacyRequest.erasureResponse',
  // Schutz des geistigen Eigentums (U-22, P12.11)
  'ip.copyrightNotice',
  'ip.aiMiningReservation',
  'ip.purchaseClause',
  'ip.tattooFlashNotice',
] as const
export type LegalSnippetKey = (typeof LEGAL_SNIPPET_KEYS)[number]
export const WITHDRAWAL_STATUSES = [
  'received',
  'goods_returned',
  'partially_refunded',
  'refunded',
  'rejected',
  'closed',
] as const
export type WithdrawalStatus = (typeof WITHDRAWAL_STATUSES)[number]
export const WITHDRAWAL_MATCH_STATUSES = [
  'auto_matched',
  'needs_manual_match',
  'manually_matched',
  'no_order',
] as const
export type WithdrawalMatchStatus = (typeof WITHDRAWAL_MATCH_STATUSES)[number]
export const WITHDRAWAL_CHANNELS = ['online_form', 'email', 'letter', 'other'] as const // R-094 manuelle Erfassung
export type WithdrawalChannel = (typeof WITHDRAWAL_CHANNELS)[number]
export const WITHDRAWAL_CLOSE_REASONS = [
  'unpaid_order_cancelled',
  'duplicate',
  'retracted',
  'other',
] as const // KONZEPT §5.4 W5
export type WithdrawalCloseReason = (typeof WITHDRAWAL_CLOSE_REASONS)[number]
export const COMPLAINT_KINDS = ['transport_damage', 'defect'] as const // R-110
export type ComplaintKind = (typeof COMPLAINT_KINDS)[number]
export const COMPLAINT_REMEDIES = [
  'repair',
  'replacement',
  'refund',
  'price_reduction',
  'none',
] as const // R-110, R-111
export type ComplaintRemedy = (typeof COMPLAINT_REMEDIES)[number]
export const COMPLAINT_STATUSES = ['open', 'waiting_customer', 'resolved', 'rejected'] as const
export type ComplaintStatus = (typeof COMPLAINT_STATUSES)[number]
export const CONFORMITY_STATUSES = ['active', 'revoked'] as const
export type ConformityStatus = (typeof CONFORMITY_STATUSES)[number]
export const CONSENT_PURPOSES = [
  'carrier_email_forwarding',
  'deviation_agreement',
  'inquiry_privacy_notice',
] as const
export type ConsentPurpose = (typeof CONSENT_PURPOSES)[number]

// Datenschutz & Löschung (LOESCHKONZEPT, R-150 bis R-154)
export const PRIVACY_REQUEST_TYPES = [
  'access',
  'rectification',
  'erasure',
  'restriction',
  'portability',
  'objection',
  'consent_withdrawal',
] as const
export type PrivacyRequestType = (typeof PRIVACY_REQUEST_TYPES)[number]
export const PRIVACY_REQUEST_STATUSES = [
  'received',
  'identity_check',
  'in_progress',
  'answered',
  'rejected',
] as const
export type PrivacyRequestStatus = (typeof PRIVACY_REQUEST_STATUSES)[number]
export const PRIVACY_REQUEST_CHANNELS = [
  'email',
  'letter',
  'instagram_dm',
  'oral',
  'withdrawal_form',
  'other',
] as const
export type PrivacyRequestChannel = (typeof PRIVACY_REQUEST_CHANNELS)[number]
export const IDENTITY_CHECK_METHODS = ['stored_email', 'control_data', 'other'] as const // LOESCHKONZEPT §5.2
export type IdentityCheckMethod = (typeof IDENTITY_CHECK_METHODS)[number]
export const DELETION_ACTIONS = ['deleted', 'anonymized', 'restricted', 'files_deleted'] as const
export type DeletionAction = (typeof DELETION_ACTIONS)[number]
export const DELETION_TRIGGERS = ['job', 'privacy_request', 'admin', 'consent_withdrawn'] as const
export type DeletionTrigger = (typeof DELETION_TRIGGERS)[number]

// Tattoo & Anfragen
export const FLASH_STATUSES = ['available', 'claimed'] as const
export type FlashStatus = (typeof FLASH_STATUSES)[number]
// „Planet Claire on Tour“ (P12.8, U-20): geplant · abgesagt · vorbei (vorbei auch automatisch aus dem Datum)
export const TOUR_STATUSES = ['planned', 'cancelled', 'past'] as const
export type TourStatus = (typeof TOUR_STATUSES)[number]
export const TATTOO_PHOTO_KINDS = ['fresh', 'healed'] as const
export type TattooPhotoKind = (typeof TATTOO_PHOTO_KINDS)[number]
export const CONSENT_SCOPES = ['tattoo_only', 'with_face'] as const
export type ConsentScope = (typeof CONSENT_SCOPES)[number]
export const INQUIRY_STATUSES = [
  'new',
  'in_progress',
  'offer_sent',
  'accepted',
  'declined',
  'completed',
  'closed',
] as const
export type InquiryStatus = (typeof INQUIRY_STATUSES)[number]
export const INQUIRY_OBJECT_TYPES = [
  'cap',
  'shirt',
  'textil_sonstiges',
  'teller',
  'schale',
  'tasse',
  'fliese',
  'zeichnung',
  'schmuck',
  'sonstiges',
] as const
export type InquiryObjectType = (typeof INQUIRY_OBJECT_TYPES)[number]

// Medien & Dateien
export const MEDIA_SOURCES = [
  'upload',
  'instagram_seed',
  'instagram_export',
  'placeholder',
  'generated',
] as const
export type MediaSource = (typeof MEDIA_SOURCES)[number]
export const SHOWS_PERSON = ['none', 'jutta', 'customer'] as const
export type ShowsPerson = (typeof SHOWS_PERSON)[number]
export const DOCUMENT_KINDS = [
  'legal_text_pdf',
  'conformity_declaration',
  'aftercare_pdf',
  'other',
] as const
export type DocumentKind = (typeof DOCUMENT_KINDS)[number]
export const PRIVATE_UPLOAD_PURPOSES = [
  'commission_reference',
  'packing_photo',
  'return_photo',
  'complaint_photo',
  'nickel_evidence',
  'lab_report',
  'consent_evidence',
  'supplier_document',
  'technical_file',
  'invoice_pdf',
  'credit_note_pdf',
  'monthly_export',
  'data_export',
  'processor_agreement',
] as const
export type PrivateUploadPurpose = (typeof PRIVATE_UPLOAD_PURPOSES)[number]
export const PRIVATE_UPLOAD_STATUSES = ['pending', 'attached'] as const
export type PrivateUploadStatus = (typeof PRIVATE_UPLOAD_STATUSES)[number]

// Inhalte
export const PAGE_KEYS = [
  'home',
  'about',
  'contact',
  'commissions',
  'tattoo',
  'tattoo_aftercare',
  'shop',
  'archive',
  'conformity',
  'withdrawal',
  'order_status',
  'thanks',
  'not_found',
] as const
export type PageKey = (typeof PAGE_KEYS)[number]
export const FAQ_CATEGORIES = [
  'tattoo',
  'aftercare',
  'shop',
  'shipping',
  'commissions',
  'general',
] as const
export type FaqCategory = (typeof FAQ_CATEGORIES)[number]
export const COCO_POSES = ['run', 'sniff', 'sit', 'sleep', 'jump', 'head_tilt'] as const // E-80: min. 6 Posen
export type CocoPose = (typeof COCO_POSES)[number]
// Gespeichert werden nur diese CMS-Werte. Die Sprite-IDs der Zeichnungen (DESIGN §10.3: rennen, schnueffeln, sitzen,
// schlafen, springen, kopfschief) bildet allein `COCO_POSE_TO_SPRITE` in `src/leash/poses.ts` ab:
// run → rennen · sniff → schnueffeln · sit → sitzen · sleep → schlafen · jump → springen · head_tilt → kopfschief
export const INTERNAL_LINK_TARGETS = [
  'home',
  'shop',
  'archive',
  'category',
  'tattoo',
  'tattoo_aftercare',
  'about',
  'commissions',
  'contact',
  'conformity',
  'instagram',
  'email',
] as const
export type InternalLinkTarget = (typeof INTERNAL_LINK_TARGETS)[number]

// Protokolle
export const ACTOR_TYPES = ['admin', 'system', 'webhook', 'job', 'customer', 'seed'] as const
export type ActorType = (typeof ACTOR_TYPES)[number]
export const AUDIT_ACTIONS = [
  'product_created',
  'product_published',
  'product_status_changed',
  'product_price_changed',
  'product_offline_sold',
  'product_adopted',
  'product_deleted',
  'reservation_conflict',
  'order_created',
  'order_status_changed',
  'order_address_changed',
  'order_status_link_rotated',
  'order_refund_created',
  'order_refund_failed',
  'packing_photo_skipped',
  'carrier_consent_withdrawn',
  'complaint_changed',
  'invoice_issued',
  'credit_note_issued',
  'withdrawal_received',
  'withdrawal_matched',
  'withdrawal_status_changed',
  'legal_text_activated',
  'legal_text_superseded',
  'legal_snippet_activated',
  'legal_snippet_superseded',
  'legal_review_confirmed',
  'settings_changed',
  'tax_mode_changed',
  'gallery_published',
  'gallery_consent_withdrawn',
  'inquiry_status_changed',
  'inquiry_deleted',
  'private_upload_deleted',
  'order_anonymized',
  'data_exported',
  'legal_hold_changed',
  'processing_restricted',
  'privacy_request_changed',
  'retention_setting_changed',
  'seed_imported',
  'seed_removed',
  'login_succeeded',
  'password_reset_requested',
] as const
export type AuditAction = (typeof AUDIT_ACTIONS)[number]
// Mail-Vorlagen: einzige Quelle der Schlüssel; Zuordnung zu den KONZEPT-IDs M…/A… in der Tabelle unten und in
// src/lib/email/registry.ts
export const EMAIL_TEMPLATES = [
  'order_confirmation',
  'prepayment_instructions',
  'prepayment_reminder',
  'prepayment_cancelled',
  'prepayment_received',
  'order_shipped',
  'pickup_ready',
  'withdrawal_receipt',
  'refund_confirmation',
  'oversold_apology',
  'inquiry_receipt',
  'complaint_repair_choice',
  'dispute_vsbg',
  'privacy_access_response',
  'privacy_erasure_response',
  'consent_withdrawal_confirmation',
  'admin_order_placed',
  'admin_prepayment_cancelled',
  'admin_withdrawal_received',
  'admin_inquiry_received',
  'admin_oversold',
  'admin_dispute_opened',
  'admin_refund_failed',
  'admin_revenue_guard',
  'admin_legal_review_due',
  'admin_monthly_close',
  'admin_alert',
  'admin_withdrawal_deadline',
  'admin_password_reset',
  'admin_privacy_request_due',
  'admin_legal_hold_review',
  'admin_compliance_docs_review',
] as const
export type EmailTemplate = (typeof EMAIL_TEMPLATES)[number]
export const EMAIL_STATUSES = ['queued', 'sent', 'failed', 'suppressed'] as const
export type EmailStatus = (typeof EMAIL_STATUSES)[number]
export const EMAIL_TRANSPORTS = ['file', 'smtp', 'memory', 'log'] as const // = EMAIL_DRIVER (ARCHITEKTUR §3.4)
export type EmailTransport = (typeof EMAIL_TRANSPORTS)[number]
export const WEBHOOK_PROVIDERS = ['stripe', 'mock'] as const // webhook-events.provider (DATENMODELL §6.24)
export type WebhookProvider = (typeof WEBHOOK_PROVIDERS)[number]
export const WEBHOOK_EVENT_STATUSES = ['processing', 'processed', 'failed', 'ignored'] as const
export type WebhookEventStatus = (typeof WEBHOOK_EVENT_STATUSES)[number]
