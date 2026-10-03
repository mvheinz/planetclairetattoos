import 'server-only'

import { cached } from '@/lib/cache/cached'
import { TAGS } from '@/lib/cache/tags'
import { getPublicPage } from '@/lib/data/pages'
import { DEFAULT_INSTAGRAM_HANDLE } from '@/lib/data/navigation'
import { TAX_MODES, type FaqCategory, type Locale, type TaxMode } from '@/lib/enums'
import { createLogger } from '@/lib/monitoring/logger'
import { getPublicPayload, getPublicSettings } from '@/lib/payload/public'
import { formatFlashNumber } from '@/lib/tattoo/flash'
import { isOfferVisible, sortOffers } from '@/lib/tattoo/offers'
import {
  isMediaPubliclyVisible,
  isPubliclyVisible,
  isSeedConsentException,
} from '@/lib/tattoo/visibility'
import { systemClock } from '@/lib/time'
import type { Faq, Flash, Media, Page, TattooGallery, TattooOffer } from '@/payload-types'

// Gecachte Lesefunktionen des Tattoo-Bereichs (R11–R18, ARCHITEKTUR §9.2/§9.3, PLAN P7.1): Flash (Tag `flash`),
// Angebote (`tattoo-offers`), Galerie (`tattoo-gallery`), FAQ (`faqs`), Seiten `tattoo` und `tattoo_aftercare`
// (`page:tattoo`, `page:tattoo_aftercare`) und die öffentlichen Tattoo-Einstellungen (`settings`). Gelesen wird über
// `getPublicPayload()` (Zugriffsregeln samt Seed-Filter greifen); zusätzlich prüft der Code dieselben Regeln noch
// einmal (Abwehr in der Tiefe: Angebote `endsAt > jetzt`, Galerie `isPubliclyVisible`, Bilder
// `isMediaPubliclyVisible`). Ohne Datenbank liefern die Loader leere Listen bzw. `null` – die Seiten zeigen dann ihre
// Leerzustände statt 500 (DM-PAGE-01). Ergebnisse sind JSON-fähig (Daten-Cache).

const log = createLogger()

/** Bild für Karten und Raster (nur sichtbare Bilder; sonst `null` → schraffierter Platzhalter). */
export type TattooImage = Pick<
  Media,
  'id' | 'alt' | 'url' | 'width' | 'height' | 'focalX' | 'focalY' | 'dominantColor' | 'sizes'
>

function publicImage(value: number | Media | null | undefined): TattooImage | null {
  if (!value || typeof value !== 'object') return null
  if (!isMediaPubliclyVisible(value)) return null
  const { id, alt, url, width, height, focalX, focalY, dominantColor, sizes } = value
  return { id, alt, url, width, height, focalX, focalY, dominantColor, sizes }
}

const text = (v: string | null | undefined): string | null =>
  typeof v === 'string' && v.trim() !== '' ? v.trim() : null

// --- Seiten ----------------------------------------------------------------------------------------------------------

/** Seite `tattoo` (R11 und die Blöcke der Unterseiten R12–R16, R18, SE-09). */
export const getTattooPage = (locale: Locale): Promise<Page | null> =>
  getPublicPage('tattoo', locale)

/** Seite `tattoo_aftercare` (R17). */
export const getAftercarePage = (locale: Locale): Promise<Page | null> =>
  getPublicPage('tattoo_aftercare', locale)

export type PageBlock = NonNullable<Page['layout']>[number]

/** Blöcke einer Seite nach Typ (die Unterseiten lesen „ihre“ Blöcke der Seite `tattoo`, SE-09). */
export function blocksOfType<K extends PageBlock['blockType']>(
  page: Page | null | undefined,
  type: K,
): Extract<PageBlock, { blockType: K }>[] {
  return (page?.layout ?? []).filter(
    (b): b is Extract<PageBlock, { blockType: K }> => b.blockType === type,
  )
}

// --- Einstellungen und Kontakt ---------------------------------------------------------------------------------------

export interface TattooSettings {
  /** `social.contactEmail` (Flash-Anfragen, E-51), sonst `business.email`. */
  email: string | null
  instagramHandle: string
  /** Nur der Bezirk (E-50); Platzhalter „[Bezirk folgt]“ gilt als nicht gesetzt. */
  studioDistrict: string | null
  minPriceCents: number | null
  customPriceFromCents: number | null
  customPriceToCents: number | null
  priceNote: string | null
  taxMode: TaxMode
}

const EMAIL_RE = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/
const HANDLE_RE = /^[a-z0-9._]{1,30}$/

type Obj = Record<string, unknown>
const group = (o: Obj, key: string): Obj =>
  typeof o[key] === 'object' && o[key] !== null ? (o[key] as Obj) : {}
const str = (o: Obj, key: string) => (typeof o[key] === 'string' ? text(o[key] as string) : null)
const cents = (o: Obj, key: string) => {
  const v = o[key]
  return typeof v === 'number' && Number.isSafeInteger(v) && v > 0 ? v : null
}

/** Reine Auswahl aus den öffentlichen Einstellungen (testbar ohne Datenbank). */
export function pickTattooSettings(settings: Obj): TattooSettings {
  const social = group(settings, 'social')
  const business = group(settings, 'business')
  const tattoo = group(settings, 'tattoo')
  const tax = group(settings, 'tax')
  const email = [str(social, 'contactEmail'), str(business, 'email')].find(
    (e): e is string => !!e && EMAIL_RE.test(e),
  )
  const handle = str(social, 'instagramHandle')
  const district = str(tattoo, 'studioDistrict')
  const from = cents(tattoo, 'customPriceFromCents')
  const to = cents(tattoo, 'customPriceToCents')
  return {
    email: email ?? null,
    instagramHandle: handle && HANDLE_RE.test(handle) ? handle : DEFAULT_INSTAGRAM_HANDLE,
    studioDistrict: district && !/^\[.*\]$/.test(district) ? district : null,
    minPriceCents: cents(tattoo, 'minPriceCents'),
    customPriceFromCents: from,
    customPriceToCents: to !== null && from !== null && to < from ? null : to,
    priceNote: str(tattoo, 'priceNote'),
    taxMode: (TAX_MODES as readonly string[]).includes(String(tax.currentMode))
      ? (tax.currentMode as TaxMode)
      : 'kleinunternehmer',
  }
}

export async function loadTattooSettings(locale: Locale): Promise<TattooSettings> {
  try {
    return pickTattooSettings(await getPublicSettings(systemClock, { locale }))
  } catch (err) {
    log.warn('tattoo.settings_load_failed', { reason: (err as Error).message })
    return pickTattooSettings({})
  }
}

export const getTattooSettings = cached(loadTattooSettings, {
  key: 'tattoo-settings',
  tags: [TAGS.settings],
})

// --- Flash -----------------------------------------------------------------------------------------------------------

export interface PublicFlash {
  id: number
  number: number
  /** „F-012“ */
  display: string
  /** Anker „f-012“ (KONZEPT §9.3). */
  anchor: string
  title: string
  image: TattooImage | null
  sizeCm: number
  sizeNote: string | null
  priceCents: number
  repeatable: boolean
  status: Flash['status']
}

export const flashAnchor = (number: number) => formatFlashNumber(number).toLowerCase()

function toPublicFlash(doc: Flash): PublicFlash | null {
  if (typeof doc.number !== 'number') return null
  return {
    id: doc.id,
    number: doc.number,
    display: formatFlashNumber(doc.number),
    anchor: flashAnchor(doc.number),
    title: doc.title,
    image: publicImage(doc.image),
    sizeCm: doc.sizeCm,
    sizeNote: text(doc.sizeNote),
    priceCents: doc.priceCents,
    repeatable: doc.repeatable === true,
    status: doc.status,
  }
}

/** Verfügbare nach `sortOrder`, dann vergebene nach `sortOrder` (KONZEPT §9.3). */
export function sortFlash<T extends { status: string; sortOrder?: number | null; number: number }>(
  list: T[],
): T[] {
  const rank = (f: T) => (f.status === 'available' ? 0 : 1)
  return [...list].sort(
    (a, b) => rank(a) - rank(b) || (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.number - b.number,
  )
}

export async function loadFlash(locale: Locale): Promise<PublicFlash[]> {
  try {
    const payload = await getPublicPayload()
    const res = await payload.find({
      collection: 'flash',
      where: { published: { equals: true } },
      locale,
      fallbackLocale: 'de',
      depth: 1,
      limit: 500,
      pagination: false,
      sort: 'sortOrder',
    })
    const docs = res.docs.filter((d) => d.published !== false && typeof d.number === 'number')
    return sortFlash(docs as (Flash & { number: number })[])
      .map(toPublicFlash)
      .filter((f): f is PublicFlash => f !== null)
  } catch (err) {
    log.warn('tattoo.flash_load_failed', { reason: (err as Error).message })
    return []
  }
}

/** Alle veröffentlichten Motive (verfügbare zuerst). */
export const listFlash = cached(loadFlash, { key: 'tattoo-flash', tags: [TAGS.flash] })

// --- Angebote --------------------------------------------------------------------------------------------------------

export interface PublicOffer {
  id: number
  type: TattooOffer['type']
  title: string
  description: string
  startsAt: string
  endsAt: string
  locationNote: string | null
  priceNote: string | null
  image: TattooImage | null
  flashes: {
    number: number
    display: string
    anchor: string
    title: string
    image: TattooImage | null
  }[]
}

function toPublicOffer(doc: TattooOffer): PublicOffer {
  const flashes = (doc.flashes ?? [])
    .filter((f): f is Flash => typeof f === 'object' && f !== null && f.published !== false)
    .map(toPublicFlash)
    .filter((f): f is PublicFlash => f !== null)
    .map(({ number, display, anchor, title, image }) => ({ number, display, anchor, title, image }))
  return {
    id: doc.id,
    type: doc.type,
    title: doc.title,
    description: doc.description,
    startsAt: doc.startsAt,
    endsAt: doc.endsAt,
    locationNote: text(doc.locationNote),
    priceNote: text(doc.priceNote),
    image: publicImage(doc.image),
    flashes,
  }
}

/**
 * Laufende und kommende Angebote nach Beginn (DATENMODELL §6.15): die Zugriffsregel liefert nur `published` und
 * `endsAt > jetzt`; der Loader filtert zusätzlich mit derselben Uhr. R13, der Teaser auf R11 und die Startseite nutzen
 * dieselbe Abfrage (P7.3).
 */
export async function loadOffers(locale: Locale): Promise<PublicOffer[]> {
  try {
    const now = systemClock.now()
    const payload = await getPublicPayload()
    const res = await payload.find({
      collection: 'tattoo-offers',
      where: {
        and: [{ published: { equals: true } }, { endsAt: { greater_than: now.toISOString() } }],
      },
      locale,
      fallbackLocale: 'de',
      depth: 2,
      limit: 100,
      pagination: false,
      sort: 'startsAt',
    })
    return sortOffers(res.docs.filter((d) => isOfferVisible(d, now)).map(toPublicOffer))
  } catch (err) {
    log.warn('tattoo.offers_load_failed', { reason: (err as Error).message })
    return []
  }
}

export const listOffers = cached(loadOffers, {
  key: 'tattoo-offers',
  tags: [TAGS.tattooOffers, TAGS.flash],
})

// --- Galerie ---------------------------------------------------------------------------------------------------------

export interface PublicGalleryEntry {
  id: number
  kind: TattooGallery['kind']
  image: TattooImage
  caption: string | null
  placement: string | null
  healedLabel: string | null
  healedDurationMonths: number | null
  creditHandle: string | null
  /** Seed-Ausnahme im Vorschau-Modus: Etikett „intern – Einwilligung fehlt“ (R-182). */
  internal: boolean
  featured: boolean
}

/** Reine Auswahl: nur öffentlich sichtbare Einträge mit sichtbarem Bild (KONZEPT §9.7). */
export function toPublicGallery(
  docs: readonly TattooGallery[],
  env?: Parameters<typeof isPubliclyVisible>[1],
): PublicGalleryEntry[] {
  const out: PublicGalleryEntry[] = []
  for (const doc of docs) {
    if (!isPubliclyVisible(doc, env)) continue
    const image =
      doc.image && typeof doc.image === 'object' && isMediaPubliclyVisible(doc.image, env)
        ? publicImageWith(doc.image)
        : null
    if (!image) continue
    out.push({
      id: doc.id,
      kind: doc.kind,
      image,
      caption: text(doc.caption),
      placement: text(doc.placement),
      healedLabel: doc.kind === 'healed' ? text(doc.healedLabel) : null,
      healedDurationMonths: doc.kind === 'healed' ? (doc.healedDurationMonths ?? null) : null,
      creditHandle: doc.consentGiven === true ? text(doc.creditHandle) : null,
      internal: isSeedConsentException(doc, env),
      featured: doc.featured === true,
    })
  }
  return out
}

function publicImageWith(m: Media): TattooImage {
  const { id, alt, url, width, height, focalX, focalY, dominantColor, sizes } = m
  return { id, alt, url, width, height, focalX, focalY, dominantColor, sizes }
}

export async function loadGallery(locale: Locale): Promise<PublicGalleryEntry[]> {
  try {
    const payload = await getPublicPayload()
    const res = await payload.find({
      collection: 'tattoo-gallery',
      where: { published: { equals: true } },
      locale,
      fallbackLocale: 'de',
      depth: 1,
      limit: 500,
      pagination: false,
      sort: 'sortOrder',
    })
    return toPublicGallery(res.docs)
  } catch (err) {
    log.warn('tattoo.gallery_load_failed', { reason: (err as Error).message })
    return []
  }
}

/** Alle sichtbaren Galerie-Fotos nach `sortOrder`. */
export const listGallery = cached(loadGallery, {
  key: 'tattoo-gallery',
  tags: [TAGS.tattooGallery],
})

/** Teaser (R11): bevorzugt `healed`, dann hervorgehobene, sonst nach Reihenfolge. */
export function galleryTeaser(
  entries: readonly PublicGalleryEntry[],
  n: number,
): PublicGalleryEntry[] {
  const score = (e: PublicGalleryEntry) => (e.kind === 'healed' ? 0 : 2) + (e.featured ? 0 : 1)
  return entries
    .map((e, i) => ({ e, i }))
    .sort((a, b) => score(a.e) - score(b.e) || a.i - b.i)
    .slice(0, n)
    .map(({ e }) => e)
}

// --- FAQ -------------------------------------------------------------------------------------------------------------

export interface PublicFaq {
  id: number
  question: string
  answer: Faq['answer']
}

export async function loadFaqs(category: FaqCategory, locale: Locale): Promise<PublicFaq[]> {
  try {
    const payload = await getPublicPayload()
    const res = await payload.find({
      collection: 'faqs',
      where: { and: [{ category: { equals: category } }, { published: { equals: true } }] },
      locale,
      fallbackLocale: 'de',
      depth: 0,
      limit: 200,
      pagination: false,
      sort: 'sortOrder',
    })
    return res.docs.map((d) => ({ id: d.id, question: d.question, answer: d.answer }))
  } catch (err) {
    log.warn('tattoo.faqs_load_failed', { category, reason: (err as Error).message })
    return []
  }
}

export const listFaqs = cached(loadFaqs, { key: 'faqs', tags: [TAGS.faqs] })
