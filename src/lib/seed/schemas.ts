import 'server-only'

import { z } from 'zod'

import {
  CHECKOUT_CLOSE_REASONS,
  CHECKOUT_PAYMENT_CHOICES,
  CHECKOUT_STATUSES,
  COCO_POSES,
  DEVIATION_DECISIONS,
  EN_TRANSLATION_STATUSES,
  FAQ_CATEGORIES,
  FIBER_COMPONENTS,
  FOOD_CONTACT,
  FULFILLMENT_METHODS,
  INTERNAL_LINK_TARGETS,
  LEGAL_TEXT_TYPES,
  LOCALES,
  PAGE_KEYS,
  PRIVATE_UPLOAD_PURPOSES,
  PRODUCT_CATEGORIES,
  PRODUCT_STATUSES,
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
  /** Absätze unter der Überschrift (nur „Text folgt von der Kanzlei.“ und erlaubte Tokens, R-002/R-012). */
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
        sections: z.array(legalSection).min(1),
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

export const checkoutSeedSchema = z.strictObject({
  key: localKey,
  status: z.enum(CHECKOUT_STATUSES),
  locale: z.enum(LOCALES),
  items: z.array(ref('products')).min(1).max(10),
  fulfillmentMethod: z.enum(FULFILLMENT_METHODS),
  shippingZone: z.enum(SHIPPING_ZONES).optional(),
  paymentChoice: z.enum(CHECKOUT_PAYMENT_CHOICES).optional(),
  reservationRef: z.uuid(),
  createdAt: timeExpr,
  displayExpiresAt: timeExpr,
  expiresAt: timeExpr,
  submittedAt: timeExpr.optional(),
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

export const ordersSchema = z.strictObject({
  checkouts: z.array(checkoutSeedSchema),
  /** Bestellungen O01–O14 folgen in P8 (SEED-SPEC §7). */
  orders: z.array(z.never()).max(0),
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
])
export type PageBlockSeed = z.infer<typeof pageBlockSchema>

export const pagesSchema = z.array(
  z.strictObject({
    key: z.enum(PAGE_KEYS),
    title: l10nBoth,
    layout: z.array(pageBlockSchema).max(40),
  }),
)
export type PagesData = z.infer<typeof pagesSchema>

// ---------------------------------------------------------------------------------------------------------------
// Registry

export const SEED_FILE_SCHEMAS = {
  'base.json': baseSchema,
  'media.json': mediaSchema,
  'private-uploads.json': privateUploadsSchema,
  'products.json': productsSchema,
  'orders.json': ordersSchema,
  'pages.json': pagesSchema,
} as const
export type SeedFileName = keyof typeof SEED_FILE_SCHEMAS
