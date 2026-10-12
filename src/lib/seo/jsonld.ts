import type { TaxMode } from '@/lib/enums'
import { assertCents } from '@/lib/money'
import { padItemNumber } from '@/lib/products/itemNumber'

import { absoluteUrl, SITE_NAME } from './metadata'

// JSON-LD (KONZEPT §3.0.5, §3.4 SEO/OG, E-50, P3.13): Startseite `Organization` mit Name, URL, Logo und `sameAs`
// Instagram – **ohne** Adresse; Produktseite `Product` mit `Offer`; Listen und Produktseite `BreadcrumbList`. Ausgabe als
// `<script type="application/ld+json">` (Datenblock, wird nicht ausgeführt; `<` maskiert). Reine Funktionen ohne
// Datenbank – die Seiten reichen die Daten herein. Im Kleinunternehmer-Modus nie eine Steuerangabe (R-126).
// V-61 b (U-93, nur normale Google-Suche, kein Google Shopping): Das `Offer` eines Stücks im Shop nennt Versand nach
// Deutschland (`OfferShippingDetails`: Preis der Versandklasse, Lieferzeit aus den Einstellungen; nicht bei reinen
// Abholstücken) und die Rückgabe (`MerchantReturnPolicy`: gesetzliches Widerrufsrecht, 14 Tage, Rücksendekosten trägt die
// Kundin, E-27 – wie in der Widerrufsbelehrung).

export const LOGO_PATH = '/art/wordmark.svg'
const SCHEMA = 'https://schema.org'

/** `instagram` = vollständige Profil-URL (`instagramUrl()` aus `src/lib/data/navigation.ts`). */
export function organizationJsonLd(instagram: string, siteUrl?: string) {
  return {
    '@context': SCHEMA,
    '@type': 'Organization',
    name: SITE_NAME,
    url: absoluteUrl('/', siteUrl),
    logo: absoluteUrl(LOGO_PATH, siteUrl),
    sameAs: [instagram],
  }
}

/**
 * Preis für `offers.price` aus Integer-Cent als Zeichenkette („45.00“, „1234.50“, „0.05“) – reine Zeichenketten-Arbeit,
 * keine Fließkomma-Rechnung (CLAUDE.md §6).
 */
export function priceString(cents: number): string {
  assertCents(cents, 'Preis')
  const digits = String(cents).padStart(3, '0')
  return `${digits.slice(0, -2)}.${digits.slice(-2)}`
}

/** Öffentliche Zustände, in denen ein Stück eine Produktseite hat (R04). */
export type PublicProductStatus = 'available' | 'reserved' | 'sold'

/** `InStock` bei `available`/`reserved` (reserviert kann wieder frei werden), `SoldOut` bei `sold` (KONZEPT §3.4). */
export function availabilityFor(status: PublicProductStatus): string {
  return `${SCHEMA}/${status === 'sold' ? 'SoldOut' : 'InStock'}`
}

interface ImageLike {
  url?: string | null
  sizes?: { detail?: { url?: string | null } | null } | null
}

/** Absolute Bild-URLs (Größe `detail`, sonst Original) in der Reihenfolge der Galerie. */
export function productImageUrls(
  images: readonly (number | ImageLike | null | undefined)[] | null | undefined,
  siteUrl?: string,
): string[] {
  return (images ?? []).flatMap((m) => {
    if (!m || typeof m !== 'object') return []
    const url = m.sizes?.detail?.url || m.url
    return url ? [absoluteUrl(url, siteUrl)] : []
  })
}

/** Versand eines Stücks nach Deutschland (V-61 b). */
export interface ShippingInput {
  /** Preis der Versandklasse für Deutschland in Cent (`settings.shipping.rates`, Zone DE). */
  rateCents: number
  /** Lieferzeit in Tagen ab Bestellung (`deliveryDayRange` aus `settings.shipping.deliveryTimeText`); `null` = ohne. */
  deliveryDays: { min: number; max: number } | null
}

/** Rückgabe (V-61 b): gesetzliches Widerrufsrecht (alle Shop-Stücke, E-11), 14 Tage, Rücksendekosten trägt die Kundin (E-27). */
export interface ReturnInput {
  /** Rücksendung per Post (Versandstücke); bei reinen Abholstücken entfällt die Angabe (Übergabe nach Absprache). */
  byMail: boolean
}

/** Widerrufsfrist in Tagen (§ 355 Abs. 2 BGB, Widerrufsbelehrung). */
export const RETURN_DAYS = 14
/** Annahme für die Laufzeit des Pakets innerhalb Deutschlands (Werktage). Rest der Lieferzeit = Bearbeitung. */
export const TRANSIT_MAX_DAYS = 2

/**
 * Lieferzeit (gesamt `min`–`max` Tage) → Bearbeitung + Laufzeit für `ShippingDeliveryTime`: Laufzeit 1 bis höchstens 2
 * Tage, die Bearbeitung trägt den Rest; die Summen ergeben genau `min` bzw. `max` (z. B. 2–5 → Bearbeitung 1–3, Laufzeit
 * 1–2).
 */
export function splitDeliveryDays(days: { min: number; max: number }): {
  handling: { min: number; max: number }
  transit: { min: number; max: number }
} {
  const transitMax = Math.min(TRANSIT_MAX_DAYS, days.max - days.min + 1)
  return {
    handling: { min: days.min - 1, max: days.max - transitMax },
    transit: { min: 1, max: transitMax },
  }
}

const dayRange = (range: { min: number; max: number }) => ({
  '@type': 'QuantitativeValue',
  minValue: range.min,
  maxValue: range.max,
  unitCode: 'DAY',
})

/** `OfferShippingDetails` für Deutschland (V-61 b). */
export function shippingDetailsJsonLd(input: ShippingInput) {
  const details: Record<string, unknown> = {
    '@type': 'OfferShippingDetails',
    shippingRate: {
      '@type': 'MonetaryAmount',
      value: priceString(input.rateCents),
      currency: 'EUR',
    },
    shippingDestination: { '@type': 'DefinedRegion', addressCountry: 'DE' },
  }
  if (input.deliveryDays && input.deliveryDays.min >= 1) {
    const split = splitDeliveryDays(input.deliveryDays)
    details.deliveryTime = {
      '@type': 'ShippingDeliveryTime',
      handlingTime: dayRange(split.handling),
      transitTime: dayRange(split.transit),
    }
  }
  return details
}

/** `MerchantReturnPolicy` = gesetzliches Widerrufsrecht (V-61 b, E-11, E-27). */
export function returnPolicyJsonLd(input: ReturnInput) {
  return {
    '@type': 'MerchantReturnPolicy',
    applicableCountry: 'DE',
    returnPolicyCountry: 'DE',
    returnPolicyCategory: `${SCHEMA}/MerchantReturnFiniteReturnWindow`,
    merchantReturnDays: RETURN_DAYS,
    ...(input.byMail ? { returnMethod: `${SCHEMA}/ReturnByMail` } : {}),
    returnFees: `${SCHEMA}/ReturnFeesCustomerResponsibility`,
  }
}

export interface ProductJsonLdInput {
  name: string
  description?: string | null
  itemNumber: number
  priceCents: number
  status: PublicProductStatus
  isSecondHand?: boolean | null
  /** Absolute URLs (z. B. aus `productImageUrls`). */
  images: readonly string[]
  /** Absolute kanonische URL der Produktseite. */
  url: string
  /** Steuermodus zum Zeitpunkt des Renderns (`settings.tax.currentMode`). */
  taxMode: TaxMode
  /** Versand nach Deutschland (V-61 b); fehlt bei verkauften und reinen Abholstücken oder ohne Tarif. */
  shipping?: ShippingInput | null
  /** Rückgabe (V-61 b); fehlt bei verkauften Stücken. */
  returns?: ReturnInput | null
}

/**
 * `Product` mit `Offer` (KONZEPT §3.4): `sku` = dreistellige Objektnummer, Marke „Planet Claire“, `itemCondition` nach
 * `isSecondHand`, Preis als Zeichenkette in EUR, Verfügbarkeit nach Status. Regelbesteuert: `priceSpecification` mit
 * `valueAddedTaxIncluded: true`; im Kleinunternehmer-Modus fehlt jede Steuerangabe (R-126).
 */
export function productJsonLd(input: ProductJsonLdInput) {
  const price = priceString(input.priceCents)
  const description = (input.description ?? '').replace(/\s+/g, ' ').trim()
  const offer: Record<string, unknown> = {
    '@type': 'Offer',
    price,
    priceCurrency: 'EUR',
    availability: availabilityFor(input.status),
    url: input.url,
  }
  if (input.taxMode === 'regelbesteuert') {
    offer.priceSpecification = {
      '@type': 'PriceSpecification',
      price,
      priceCurrency: 'EUR',
      valueAddedTaxIncluded: true,
    }
  }
  // V-61 b: nur für Stücke, die man gerade kaufen kann (verkauft → nichts davon)
  if (input.status !== 'sold') {
    if (input.shipping) offer.shippingDetails = shippingDetailsJsonLd(input.shipping)
    if (input.returns) offer.hasMerchantReturnPolicy = returnPolicyJsonLd(input.returns)
  }
  return {
    '@context': SCHEMA,
    '@type': 'Product',
    name: input.name,
    ...(input.images.length > 0 ? { image: [...input.images] } : {}),
    ...(description ? { description } : {}),
    sku: padItemNumber(input.itemNumber),
    brand: { '@type': 'Brand', name: SITE_NAME },
    itemCondition: `${SCHEMA}/${input.isSecondHand ? 'UsedCondition' : 'NewCondition'}`,
    offers: offer,
  }
}

export interface BreadcrumbItem {
  name: string
  /** Absolute URL. */
  url: string
}

/** `BreadcrumbList` (KONZEPT §3.0.5) mit fortlaufenden Positionen ab 1. */
export function breadcrumbJsonLd(items: readonly BreadcrumbItem[]) {
  return {
    '@context': SCHEMA,
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  }
}

/** Serialisiert JSON-LD sicher für ein Inline-`<script>` (kein `</script>`-Ausbruch). */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c')
}
