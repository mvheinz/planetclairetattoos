import 'server-only'

import { z } from 'zod'

import {
  ATTENTION_REASONS,
  CARRIERS,
  CHECKOUT_CLOSE_REASONS,
  CHECKOUT_PAYMENT_CHOICES,
  CHECKOUT_STATUSES,
  COCO_POSES,
  COMPLAINT_KINDS,
  COMPLAINT_REMEDIES,
  COMPLAINT_STATUSES,
  CONSENT_PURPOSES,
  ACTOR_TYPES,
  AUDIT_ACTIONS,
  EMAIL_TEMPLATES,
  FLASH_STATUSES,
  IDENTITY_CHECK_METHODS,
  INQUIRY_OBJECT_TYPES,
  INQUIRY_STATUSES,
  PRIVACY_REQUEST_CHANNELS,
  PRIVACY_REQUEST_STATUSES,
  PRIVACY_REQUEST_TYPES,
  REVENUE_SOURCES,
  TATTOO_OFFER_TYPES,
  TATTOO_PHOTO_KINDS,
  WITHDRAWAL_CLOSE_REASONS,
  WITHDRAWAL_MATCH_STATUSES,
  WITHDRAWAL_STATUSES,
  DELIVERED_SOURCES,
  DEVIATION_DECISIONS,
  DISPUTE_STATUSES,
  EN_TRANSLATION_STATUSES,
  FAQ_CATEGORIES,
  FIBER_COMPONENTS,
  FOOD_CONTACT,
  FULFILLMENT_METHODS,
  INTERNAL_LINK_TARGETS,
  LEGAL_TEXT_TYPES,
  LOCALES,
  ORDER_CANCEL_REASONS,
  ORDER_ITEM_STATUSES,
  ORDER_STATUSES,
  PAGE_KEYS,
  PAYMENT_METHODS,
  PAYMENT_PROVIDERS,
  PRIVATE_UPLOAD_PURPOSES,
  PRODUCT_CATEGORIES,
  PRODUCT_STATUSES,
  REFUND_REASONS,
  REFUND_STATUSES,
  RESERVATION_RELEASE_REASONS,
  RESERVATION_SOURCES,
  RESERVATION_STATUSES,
  SHIPPING_CLASSES,
  SHIPPING_ZONES,
  SHOWS_PERSON,
  SOLD_CHANNELS,
  TEXTILE_CONDITIONS,
  TEXTILE_FIBERS,
  VAT_CATEGORIES,
} from '@/lib/enums'

import { SEED_DRAWING_MOTIFS } from './drawings'
import { isSeedTimeExpr } from './time'

// zod-Schemas je Datendatei (SEED-SPEC §2.1, §2.6). Enum-Werte kommen nur aus `src/lib/enums.ts`. Alle Zeitwerte
// der Beispieldaten sind Ausdrücke relativ zu `N` (§2.2); die Dateien enthalten keine absoluten Daten (Ausnahme:
// Grund-Seed mit festen Werten wie `validFrom` der Platzhalter-Rechtstexte, §3.4).

const text = (min = 1) => z.string().trim().min(min)
/** Lokalisierter Text: `de` Pflicht, `en` optional (fehlendes `en` = Schlüssel weglassen, nie `""`). */
export const l10n = z.strictObject({ de: text(), en: text().optional() })
export const l10nBoth = z.strictObject({ de: text(), en: text() })
export const timeExpr = z.string().refine(isSeedTimeExpr, {
  message: 'Zeitausdruck nach SEED-SPEC §2.2 erwartet (z. B. D-30@18:00)',
})
const cents = z.number().int().nonnegative()
const cm = z
  .number()
  .positive()
  .refine((v) => Math.round(v * 10) === v * 10, 'höchstens eine Nachkommastelle')
const pct = z.number().min(0).max(100)
const ISO_WITH_OFFSET = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?(Z|[+-]\d{2}:\d{2})$/
const isoDate = z.string().regex(ISO_WITH_OFFSET, 'ISO 8601 mit Offset')

/** Schlüssel innerhalb einer Datei (ohne Collection-Präfix), z. B. `S01`, `ig:DdUPhoZOoMW#a`. */
const localKey = z.string().regex(/^[A-Za-z0-9:#._-]{1,80}$/)
/** Verweis auf einen vollständigen `seedKey` einer Collection. */
const ref = (collection: string) =>
  z
    .string()
    .regex(
      new RegExp(`^${collection}:[A-Za-z0-9:#._-]{1,80}$`),
      `Verweis auf ${collection}:<schlüssel> erwartet`,
    )

// ---------------------------------------------------------------------------------------------------------------
// base.json (Grund-Seed §3)

const legalSection = z.strictObject({
  heading: text(),
  /** Absätze unter der Überschrift (Platzhalter-Fassung P12.11: ausformuliert, nur Tokens aus R-012). */
  paragraphs: z.array(text()).min(1),
})

export const baseSchema = z.strictObject({
  settings: z.record(z.string(), z.unknown()),
  categories: z
    .array(
      z.strictObject({
        key: z.enum(PRODUCT_CATEGORIES),
        name: l10nBoth,
        slug: z.strictObject({
          de: z.string().regex(/^[a-z0-9-]+$/),
          en: z.string().regex(/^[a-z0-9-]+$/),
        }),
        sortOrder: z.number().int().positive(),
        showInNavigation: z.boolean(),
        intro: l10nBoth,
      }),
    )
    .length(PRODUCT_CATEGORIES.length),
  legalTexts: z
    .array(
      z.strictObject({
        type: z.enum(LEGAL_TEXT_TYPES),
        validFrom: isoDate,
        sourceNote: text(),
        /** Knapper Einstieg vor der ersten Überschrift (U-22, Ton der Marke); DE und EN. */
        intro: text().optional(),
        introEn: text().optional(),
        /** Deutsche Fassung (verbindlich) und gleichwertige englische Fassung (U-00); gleiche Gliederung. */
        sections: z.array(legalSection).min(1),
        sectionsEn: z.array(legalSection).min(1),
      }),
    )
    .length(LEGAL_TEXT_TYPES.length),
})
export type BaseData = z.infer<typeof baseSchema>

// ---------------------------------------------------------------------------------------------------------------
// media.json (§4.1, §4.2)

/** Nur Beiträge aus dem Manifest; Highlights und `profil.jpg` nie (§4.1, AK-SEED-19). */
const instagramFile = z
  .string()
  .regex(/^post-[A-Za-z0-9_-]+\.jpg$/, 'nur Beiträge (post-*.jpg), nie Highlights oder profil.jpg')

export const WASH_TOKENS = ['clay', 'pink', 'mat', 'sky'] as const

export const mediaSchema = z.strictObject({
  instagram: z.array(
    z.strictObject({
      key: localKey.refine((k) => k.startsWith('ig:'), 'Instagram-Schlüssel beginnen mit ig:'),
      file: instagramFile,
      crop: z.strictObject({ x: pct, y: pct, w: pct, h: pct }).nullable(),
      focal: z.strictObject({ x: pct, y: pct }).optional(),
      showsPerson: z.enum(SHOWS_PERSON),
      alt: l10n,
    }),
  ),
  placeholders: z.array(
    z.strictObject({
      key: localKey.refine((k) => /^ph:[a-z]+-\d+$/.test(k), 'Platzhalter-Schlüssel ph:<typ>-<n>'),
      wash: z.enum(WASH_TOKENS).nullable(),
      alt: l10n,
    }),
  ),
})
export type MediaData = z.infer<typeof mediaSchema>

// ---------------------------------------------------------------------------------------------------------------
// private-uploads.json (§4.4)

export const privateUploadsSchema = z.array(
  z
    .strictObject({
      key: localKey,
      purpose: z.enum(PRIVATE_UPLOAD_PURPOSES),
      complianceCategory: z.enum(PRODUCT_CATEGORIES).optional(),
      /** Inhalt des vom Seed erzeugten Beispieldokuments (PDF, eine Seite). */
      pdfText: text(10).optional(),
      /** Vom Seed erzeugtes Beispielbild (Linienzeichnung, §4.4). */
      image: z
        .strictObject({
          format: z.enum(['jpeg', 'png']),
          width: z.number().int().min(100).max(4000),
          height: z.number().int().min(100).max(4000),
          motif: z.enum(SEED_DRAWING_MOTIFS),
          label: text().optional(),
        })
        .optional(),
      /** Bezug, den der Seed nach dem Anlegen der Vorgänge setzt (§1.7 Schritte 5 und 7). */
      relatedOrder: ref('orders').optional(),
      relatedInquiry: ref('inquiries').optional(),
      relatedComplaint: ref('complaints').optional(),
      note: text().optional(),
    })
    .refine((u) => (u.pdfText === undefined) !== (u.image === undefined), {
      message: 'genau eines von pdfText oder image angeben',
    }),
)
export type PrivateUploadsData = z.infer<typeof privateUploadsSchema>

// ---------------------------------------------------------------------------------------------------------------
// products.json (§5)

const productState = z.strictObject({
  status: z.enum(PRODUCT_STATUSES),
  firstPublishedAt: timeExpr.optional(),
  soldAt: timeExpr.optional(),
  soldChannel: z.enum(SOLD_CHANNELS).optional(),
  archivedAt: timeExpr.optional(),
  offlineSaleNote: text().optional(),
  showInArchiveAfterSale: z.boolean().optional(),
  reservedUntil: timeExpr.optional(),
  /** Kasse, deren `reservationRef` das Stück trägt (z. B. `checkouts:KS2`). */
  reservationCheckout: ref('checkouts').optional(),
})

export const productSchema = z.strictObject({
  key: z.string().regex(/^S\d{2}$/),
  itemNumber: z.number().int().min(901).max(930),
  category: z.enum(PRODUCT_CATEGORIES),
  title: l10n,
  description: l10n,
  juttaSays: l10n.optional(),
  priceCents: cents.positive(),
  vatCategory: z.enum(VAT_CATEGORIES),
  materials: l10n,
  dimensions: z.strictObject({
    widthCm: cm.optional(),
    heightCm: cm.optional(),
    depthCm: cm.optional(),
    diameterCm: cm.optional(),
    note: l10n.optional(),
  }),
  weightGrams: z.number().int().positive(),
  shippingClass: z.enum(SHIPPING_CLASSES),
  sizeLabel: l10n.optional(),
  isSecondHand: z.boolean().optional(),
  condition: z.enum(TEXTILE_CONDITIONS).optional(),
  conditionNote: l10n.optional(),
  fiberComposition: z
    .array(
      z.strictObject({
        component: z.enum(FIBER_COMPONENTS),
        fiber: z.enum(TEXTILE_FIBERS),
        percent: z.number().int().min(1).max(100),
      }),
    )
    .optional(),
  labelMissing: z.boolean().optional(),
  fiberFreeText: l10n.optional(),
  blankBrandVisible: z.boolean().optional(),
  foodContact: z.enum(FOOD_CONTACT).optional(),
  metalPartsMaterial: l10n.optional(),
  nickelFreeConfirmed: z.boolean().optional(),
  nickelEvidence: ref('private-uploads').optional(),
  leadFreeGlazeConfirmed: z.boolean().optional(),
  smallPartsWarning: z.boolean().optional(),
  framed: z.boolean().optional(),
  frameHasGlass: z.boolean().optional(),
  safetyWarnings: l10n.optional(),
  deviationDecision: z.enum(DEVIATION_DECISIONS).optional(),
  hasDeviation: z.boolean().optional(),
  deviationDescription: l10n.optional(),
  ownDesignConfirmed: z.boolean(),
  images: z.array(ref('media')).min(1).max(12),
  state: productState,
  storageLocation: text(),
  internalNote: text().optional(),
  enStatus: z.enum(EN_TRANSLATION_STATUSES),
})
export const productsSchema = z.array(productSchema)
export type ProductSeed = z.infer<typeof productSchema>

// ---------------------------------------------------------------------------------------------------------------
// orders.json (§7, §8): Kassen, Bestellungen (ab P8) und Reservierungen

/** Erfundene Kund:innen (SEED-SPEC §6), nur Seed-intern; E-Mail nur `@example.com`/`@example.org` (AK-SEED-12). */
export const customersSchema = z.array(
  z.strictObject({
    key: z.string().regex(/^C\d{2}$/),
    name: text(),
    email: z
      .email()
      .refine((m) => /@example\.(com|org)$/.test(m), 'nur @example.com oder @example.org (R-180)'),
    address: z
      .strictObject({
        addressLine1: text(),
        postalCode: z.string().regex(/^\d{5}$/),
        city: text(),
      })
      .optional(),
    locale: z.enum(LOCALES),
  }),
)
export type CustomersData = z.infer<typeof customersSchema>

/** Kasse ohne Bestellung (SEED-SPEC §7.3: KS1 abgelaufen, KS2 offen); Kassen der Bestellungen leitet der Seed ab. */
export const checkoutSeedSchema = z.strictObject({
  key: z.string().regex(/^KS\d$/),
  status: z.enum(CHECKOUT_STATUSES),
  locale: z.enum(LOCALES),
  items: z.array(ref('products')).min(1).max(10),
  fulfillmentMethod: z.enum(FULFILLMENT_METHODS),
  shippingZone: z.enum(SHIPPING_ZONES).optional(),
  paymentChoice: z.enum(CHECKOUT_PAYMENT_CHOICES).optional(),
  reservationRef: z.uuid(),
  /** Kund:in (erst nach dem Absenden bekannt). */
  customer: ref('customers').optional(),
  carrierEmailConsent: z.boolean().optional(),
  createdAt: timeExpr,
  displayExpiresAt: timeExpr,
  expiresAt: timeExpr,
  submittedAt: timeExpr.optional(),
  confirmingAt: timeExpr.optional(),
  expiredAt: timeExpr.optional(),
  closeReason: z.enum(CHECKOUT_CLOSE_REASONS).optional(),
  stripe: z.strictObject({
    checkoutSessionId: z.string().regex(/^cs_seed_[a-z0-9_]+$/),
    sessionExpiresAt: timeExpr,
    sessionSeq: z.number().int().min(0),
  }),
})

export const reservationSeedSchema = z.strictObject({
  key: localKey,
  checkout: ref('checkouts'),
  product: ref('products'),
  source: z.enum(RESERVATION_SOURCES),
  status: z.enum(RESERVATION_STATUSES),
  createdAt: timeExpr,
  expiresAt: timeExpr,
  displayExpiresAt: timeExpr.optional(),
  convertedAt: timeExpr.optional(),
  releasedAt: timeExpr.optional(),
  releaseReason: z.enum(RESERVATION_RELEASE_REASONS).optional(),
})

/** Zeitleiste einer Bestellung (SEED-SPEC §7.2) → `timestamps.*` und `statusHistory`. */
export const ORDER_TIMELINE_KEYS = [
  'placedAt',
  'paidAt',
  'packedAt',
  'shippedAt',
  'deliveredAt',
  'readyForPickupAt',
  'pickedUpAt',
  'withdrawalReceivedAt',
  'returnReceivedAt',
  'refundedAt',
  'cancelledAt',
  'disputedAt',
] as const
export type OrderTimelineKey = (typeof ORDER_TIMELINE_KEYS)[number]

const orderTimeline = z
  .strictObject(
    Object.fromEntries(ORDER_TIMELINE_KEYS.map((k) => [k, timeExpr.optional()])) as Record<
      OrderTimelineKey,
      z.ZodOptional<typeof timeExpr>
    >,
  )
  .refine((t) => t.placedAt !== undefined, 'placedAt fehlt')

export const orderSeedSchema = z.strictObject({
  key: z.string().regex(/^O\d{2}$/),
  orderNumber: z.string().regex(/^PC-2026-900\d{2}$/, 'Seed-Nummern PC-2026-900NN (§2.5)'),
  status: z.enum(ORDER_STATUSES),
  locale: z.enum(LOCALES),
  /** Kund:in aus customers.json (`C10`, SEED-SPEC §2.6) → intern `customers:C10`. */
  customer: z
    .string()
    .regex(/^C\d{2}$/)
    .transform((k) => `customers:${k}`),
  fulfillmentMethod: z.enum(FULFILLMENT_METHODS),
  items: z
    .array(
      z.strictObject({
        /** Stück (`S02`, §2.6) → intern `products:S02`. */
        product: z
          .string()
          .regex(/^S\d{2}$/)
          .transform((k) => `products:${k}`),
        status: z.enum(ORDER_ITEM_STATUSES).optional(),
        refundedCents: cents.optional(),
      }),
    )
    .min(1),
  payment: z.strictObject({
    method: z.enum(PAYMENT_METHODS),
    provider: z.enum(PAYMENT_PROVIDERS),
    /** `stripe.paymentMethodType` (card, apple_pay, google_pay, paypal). */
    methodType: z.enum(['card', 'apple_pay', 'google_pay', 'paypal']).optional(),
    feeCents: cents.optional(),
  }),
  carrierEmailConsent: z.boolean(),
  timeline: orderTimeline,
  prepayment: z.strictObject({ reminderSentAt: timeExpr.optional() }).optional(),
  shipment: z
    .strictObject({
      carrier: z.enum(CARRIERS),
      trackingNumber: z.string().regex(/^[A-Z0-9]{8,35}$/),
      deliveredSource: z.enum(DELIVERED_SOURCES).optional(),
    })
    .optional(),
  refunds: z
    .array(
      z.strictObject({
        amountCents: cents.positive(),
        reason: z.enum(REFUND_REASONS),
        /** Positionen `<Order>-L<n>`. */
        itemIds: z.array(z.string().regex(/^O\d{2}-L\d+$/)).min(1),
        includesShipping: z.boolean(),
        status: z.enum(REFUND_STATUSES),
        createdAt: timeExpr,
      }),
    )
    .optional(),
  cancelReason: z.enum(ORDER_CANCEL_REASONS).optional(),
  dispute: z
    .strictObject({ status: z.enum(DISPUTE_STATUSES), stripeDisputeId: z.string() })
    .optional(),
  adminAttention: z
    .strictObject({ flag: z.boolean(), reason: z.enum(ATTENTION_REASONS), note: text() })
    .optional(),
  /** Standard-Verpackungsvorlage der Versandklasse (Kontrolle; der Seed nimmt sie aus `settings.packaging`, §7.1). */
  packaging: z.strictObject({ templateKey: text() }).optional(),
  packingPhotos: z.array(ref('private-uploads')).optional(),
  /** Kasse der Bestellung (`checkouts:<Key>`), solange sie nach L-03 noch existiert (§7.3); fehlt bei O01/O02. */
  checkout: ref('checkouts').optional(),
  notes: text().optional(),
})
export type OrderSeed = z.infer<typeof orderSeedSchema>

export const ordersSchema = z.strictObject({
  checkouts: z.array(checkoutSeedSchema),
  /** Bestellungen O01–O14 (SEED-SPEC §7); ihre Kassen und Reservierungen leitet der Seed ab (§7.3, §8). */
  orders: z.array(orderSeedSchema),
  /** Reservierungen der Kassen ohne Bestellung (KS1, KS2). */
  reservations: z.array(reservationSeedSchema),
})
export type OrdersData = z.infer<typeof ordersSchema>

// ---------------------------------------------------------------------------------------------------------------
// pages.json (§13)

const linkSchema = z.strictObject({
  target: z.enum(INTERNAL_LINK_TARGETS),
  category: z.enum(PRODUCT_CATEGORIES).optional(),
  label: l10nBoth,
})

const stepSchema = z.strictObject({ title: l10nBoth, text: l10nBoth })

export const pageBlockSchema = z.discriminatedUnion('blockType', [
  z.strictObject({
    blockType: z.literal('hero'),
    heading: l10nBoth,
    subheading: l10nBoth.optional(),
    cocoPose: z.enum(COCO_POSES),
  }),
  z.strictObject({
    blockType: z.literal('station'),
    stationId: z.string().regex(/^[a-z0-9-]+$/),
    heading: l10nBoth,
    text: l10nBoth.optional(),
    cocoPose: z.enum(COCO_POSES),
    ornament: z.enum(['planet', 'star', 'none']),
    link: linkSchema.optional(),
  }),
  z.strictObject({ blockType: z.literal('richText'), content: l10nBoth }),
  z.strictObject({
    blockType: z.literal('contactLinks'),
    heading: l10nBoth.optional(),
    showEmail: z.boolean().optional(),
    showInstagram: z.boolean().optional(),
    showDistrict: z.boolean().optional(),
    emailSubject: l10nBoth.optional(),
  }),
  z.strictObject({
    blockType: z.literal('callout'),
    text: l10nBoth,
    tone: z.enum(['info', 'hint']),
  }),
  z.strictObject({
    blockType: z.literal('faqList'),
    heading: l10nBoth.optional(),
    category: z.enum(FAQ_CATEGORIES),
  }),
  z.strictObject({
    blockType: z.literal('imageText'),
    image: ref('media'),
    content: l10nBoth,
    imagePosition: z.enum(['left', 'right']),
  }),
  z.strictObject({
    blockType: z.literal('imageGallery'),
    images: z.array(ref('media')).min(1).max(12),
    caption: l10nBoth.optional(),
  }),
  z.strictObject({
    blockType: z.literal('categoryTeaser'),
    heading: l10nBoth.optional(),
    categories: z.array(z.enum(PRODUCT_CATEGORIES)).min(1),
  }),
  z.strictObject({
    blockType: z.literal('processSteps'),
    heading: l10nBoth.optional(),
    steps: z.array(stepSchema).min(1).max(8),
  }),
  z.strictObject({
    blockType: z.literal('commissionForm'),
    heading: l10nBoth.optional(),
    intro: l10nBoth.optional(),
    successText: l10nBoth,
  }),
  z.strictObject({
    blockType: z.literal('offersList'),
    heading: l10nBoth.optional(),
    emptyText: l10nBoth.optional(),
  }),
  z.strictObject({
    blockType: z.literal('flashGrid'),
    heading: l10nBoth.optional(),
    showClaimed: z.boolean(),
  }),
  z.strictObject({
    blockType: z.literal('tattooGallery'),
    heading: l10nBoth.optional(),
    filter: z.enum(['all', 'fresh', 'healed']),
    limit: z.number().int().min(1).max(48),
  }),
  z.strictObject({
    blockType: z.literal('priceInfo'),
    heading: l10nBoth.optional(),
    content: l10nBoth,
  }),
  z.strictObject({
    blockType: z.literal('aftercareSteps'),
    heading: l10nBoth.optional(),
    phases: z
      .array(z.strictObject({ title: l10nBoth, content: l10nBoth }))
      .min(1)
      .max(8),
  }),
])
export type PageBlockSeed = z.infer<typeof pageBlockSchema>

export const pagesSchema = z.array(
  z.strictObject({
    key: z.enum(PAGE_KEYS),
    title: l10nBoth,
    layout: z.array(pageBlockSchema).max(40),
    seo: z
      .strictObject({
        metaTitle: z.strictObject({ de: text().max(60), en: text().max(60) }).optional(),
      })
      .optional(),
  }),
)
export type PagesData = z.infer<typeof pagesSchema>

// ---------------------------------------------------------------------------------------------------------------
// faqs.json (§14)

export const faqsSchema = z.array(
  z.strictObject({
    key: z.string().regex(/^FAQ\d{2}$/),
    category: z.enum(FAQ_CATEGORIES),
    sortOrder: z.number().int().min(0),
    question: l10nBoth,
    /** Klartext → `toLexical()` (§2.4). */
    answer: l10nBoth,
  }),
)
export type FaqsData = z.infer<typeof faqsSchema>

// ---------------------------------------------------------------------------------------------------------------
// withdrawals.json (§10)

const customerKey = z.string().regex(/^C\d{2}$/)
/** Position einer Bestellung `<Order>-L<n>` (§2.5). */
const itemId = z.string().regex(/^O\d{2}-L\d+$/)

export const withdrawalSeedSchema = z.strictObject({
  key: z.string().regex(/^W\d$/),
  reference: z.string().regex(/^WR-2026-9000\d$/, 'Seed-Nummern WR-2026-9000N (§2.5)'),
  order: ref('orders').optional(),
  customer: customerKey,
  receivedAt: timeExpr,
  matchStatus: z.enum(WITHDRAWAL_MATCH_STATUSES),
  status: z.enum(WITHDRAWAL_STATUSES),
  contractIdentification: text(3),
  itemsText: text().optional(),
  reason: text().optional(),
  adminNotes: text().optional(),
  affectedItemIds: z.array(itemId).optional(),
  returnTrackingNumber: z
    .string()
    .regex(/^[A-Z0-9]{8,35}$/)
    .optional(),
  goodsReturnedAt: timeExpr.optional(),
  refundedAt: timeExpr.optional(),
  closedAt: timeExpr.optional(),
  rejectedAt: timeExpr.optional(),
  closeReason: z.enum(WITHDRAWAL_CLOSE_REASONS).optional(),
  closeNote: text(10).optional(),
  spam: z.strictObject({ markedAt: timeExpr, reason: text(10) }).optional(),
})
export type WithdrawalSeed = z.infer<typeof withdrawalSeedSchema>
export const withdrawalsSchema = z.array(withdrawalSeedSchema)

// ---------------------------------------------------------------------------------------------------------------
// complaints.json (§10a)

export const complaintSeedSchema = z.strictObject({
  key: z.string().regex(/^RK\d$/),
  order: ref('orders'),
  affectedItemIds: z.array(itemId).min(1),
  kind: z.enum(COMPLAINT_KINDS),
  receivedAt: timeExpr,
  status: z.enum(COMPLAINT_STATUSES),
  remedy: z.enum(COMPLAINT_REMEDIES).optional(),
  photos: z.array(ref('private-uploads')).max(6).optional(),
  repairChoiceSentAt: timeExpr.optional(),
  customerChoice: z.enum(COMPLAINT_REMEDIES).optional(),
  customerChoiceAt: timeExpr.optional(),
  vsbgNoticeSentAt: timeExpr.optional(),
  description: text(),
  notes: text().optional(),
})
export type ComplaintSeed = z.infer<typeof complaintSeedSchema>
export const complaintsSchema = z.array(complaintSeedSchema)

// ---------------------------------------------------------------------------------------------------------------
// inquiries.json (§11)

export const inquirySeedSchema = z.strictObject({
  key: z.string().regex(/^A\d$/),
  reference: z.string().regex(/^AA-2026-900\d$/, 'Seed-Nummern AA-2026-900N (§2.5)'),
  customer: customerKey,
  objectType: z.enum(INQUIRY_OBJECT_TYPES),
  status: z.enum(INQUIRY_STATUSES),
  createdAt: timeExpr,
  lastActivityAt: timeExpr,
  idea: text(10),
  desiredTimeframe: text().optional(),
  budget: text().optional(),
  adminNotes: text().optional(),
  referenceImages: z.array(ref('private-uploads')).optional(),
})
export type InquirySeed = z.infer<typeof inquirySeedSchema>
export const inquiriesSchema = z.array(inquirySeedSchema)

// ---------------------------------------------------------------------------------------------------------------
// privacy-requests.json (§11a)

export const privacyRequestSeedSchema = z.strictObject({
  key: z.string().regex(/^DS\d$/),
  reference: z.string().regex(/^DS-2026-900\d$/, 'Seed-Nummern DS-2026-900N (§2.5)'),
  types: z.array(z.enum(PRIVACY_REQUEST_TYPES)).min(1),
  channel: z.enum(PRIVACY_REQUEST_CHANNELS),
  customer: customerKey,
  receivedAt: timeExpr,
  status: z.enum(PRIVACY_REQUEST_STATUSES),
  identityVerified: z.boolean(),
  identityMethod: z.enum(IDENTITY_CHECK_METHODS).optional(),
  identityVerifiedAt: timeExpr.optional(),
  matchedOrders: z.array(ref('orders')).optional(),
  matchedWithdrawals: z.array(ref('withdrawals')).optional(),
  answeredAt: timeExpr.optional(),
  resultNote: text(10).optional(),
  adminNotes: text().optional(),
})
export type PrivacyRequestSeed = z.infer<typeof privacyRequestSeedSchema>
export const privacyRequestsSchema = z.array(privacyRequestSeedSchema)

// ---------------------------------------------------------------------------------------------------------------
// revenue.json (§15)

export const revenueSchema = z.array(
  z.strictObject({
    month: timeExpr.refine((v) => /^M-\d+$/.test(v), 'Monatsausdruck M-<k> (§2.2)'),
    source: z.enum(REVENUE_SOURCES),
    amountCents: cents,
    note: text().optional(),
  }),
)
export type RevenueData = z.infer<typeof revenueSchema>

// ---------------------------------------------------------------------------------------------------------------
// tattoo.json (§12)

export const tattooSchema = z.strictObject({
  flash: z.array(
    z.strictObject({
      key: z.string().regex(/^F9\d{2}$/),
      number: z.number().int().min(901).max(910),
      title: l10nBoth,
      sizeCm: cm,
      sizeNote: l10nBoth.optional(),
      priceCents: cents.min(1000),
      repeatable: z.boolean(),
      status: z.enum(FLASH_STATUSES),
      claimedAt: timeExpr.optional(),
      image: ref('media'),
      sortOrder: z.number().int().min(0),
    }),
  ),
  offers: z.array(
    z.strictObject({
      key: z.string().regex(/^TO\d$/),
      type: z.enum(TATTOO_OFFER_TYPES),
      title: l10nBoth,
      description: l10nBoth,
      startsAt: timeExpr,
      endsAt: timeExpr,
      priceNote: l10nBoth.optional(),
      flashes: z.array(ref('flash')),
    }),
  ),
  gallery: z.array(
    z.strictObject({
      key: z.string().regex(/^G\d$/),
      image: ref('media'),
      kind: z.enum(TATTOO_PHOTO_KINDS),
      healedDurationMonths: z.number().int().min(1).max(600).optional(),
      healedLabel: l10nBoth.optional(),
      caption: l10nBoth,
      placement: l10nBoth,
      flash: ref('flash').optional(),
      showsCustomer: z.boolean(),
      consentGiven: z.boolean(),
      published: z.boolean(),
      featured: z.boolean(),
      sortOrder: z.number().int().min(0),
    }),
  ),
})
export type TattooData = z.infer<typeof tattooSchema>

// ---------------------------------------------------------------------------------------------------------------
// logs.json (§16): Ableitungsregeln (Mails, Einwilligungen) und die Audit-Einträge

/** Ereignisse, aus denen Mails entstehen (§16.1). */
export const EMAIL_EVENTS = [
  'order.paidAt',
  'order.placedAt',
  'order.prepayment.reminderSentAt',
  'order.cancelledAt',
  'order.shippedAt',
  'order.readyForPickupAt',
  'order.refunds.createdAt',
  'order.disputedAt',
  'withdrawal.receivedAt',
  'inquiry.createdAt',
  'complaint.repairChoiceSentAt',
  'complaint.vsbgNoticeSentAt',
  'privacyRequest.answeredAt',
] as const
export type EmailEvent = (typeof EMAIL_EVENTS)[number]

export const logsSchema = z.strictObject({
  email: z.array(
    z.strictObject({
      event: z.enum(EMAIL_EVENTS),
      /** Nur bei diesen Zahlarten (Bestellungen). */
      paymentMethods: z.array(z.enum(PAYMENT_METHODS)).optional(),
      /** Nur bei diesen Arten (Datenschutz-Anfragen). */
      privacyTypes: z.array(z.enum(PRIVACY_REQUEST_TYPES)).optional(),
      templates: z.array(z.enum(EMAIL_TEMPLATES)).min(1),
    }),
  ),
  consent: z.array(
    z.strictObject({
      purpose: z.enum(CONSENT_PURPOSES),
      snippet: z.enum([
        'checkout.dhlEmailConsent',
        'checkout.deviationAgreement',
        'inquiry.privacyNotice',
      ]),
      orders: z.array(ref('orders')).optional(),
      inquiries: z.array(ref('inquiries')).optional(),
      /** Stück mit Abweichung (nur `deviation_agreement`). */
      product: ref('products').optional(),
    }),
  ),
  audit: z.array(
    z.strictObject({
      key: localKey,
      action: z.enum(AUDIT_ACTIONS),
      actorType: z.enum(ACTOR_TYPES),
      /** Bezug als seedKey; `settings` für den Seed-Lauf. */
      entity: z.union([
        z.literal('settings'),
        z.string().regex(/^[a-z-]+:[A-Za-z0-9:#._-]{1,80}$/),
      ]),
      /** Zeitausdruck; fehlt = Zeitpunkt des Seed-Laufs (Uhr). */
      at: timeExpr.optional(),
      /** Platzhalter `{<collection>}` = Anzahl angelegter Beispiel-Datensätze. */
      summary: text().max(300),
    }),
  ),
})
export type LogsData = z.infer<typeof logsSchema>

// ---------------------------------------------------------------------------------------------------------------
// Registry

export const SEED_FILE_SCHEMAS = {
  'base.json': baseSchema,
  'customers.json': customersSchema,
  'media.json': mediaSchema,
  'private-uploads.json': privateUploadsSchema,
  'products.json': productsSchema,
  'orders.json': ordersSchema,
  'pages.json': pagesSchema,
  'faqs.json': faqsSchema,
  'withdrawals.json': withdrawalsSchema,
  'complaints.json': complaintsSchema,
  'inquiries.json': inquiriesSchema,
  'privacy-requests.json': privacyRequestsSchema,
  'revenue.json': revenueSchema,
  'tattoo.json': tattooSchema,
  'logs.json': logsSchema,
} as const
export type SeedFileName = keyof typeof SEED_FILE_SCHEMAS
