import { ENUM_LABELS } from '@/lib/enumLabels'
import type { CountryCode, Locale, ProductCategory, ShippingClass } from '@/lib/enums'
import { formatMoney } from '@/lib/money'
import { appendWarnings, requiredWarningKeys, type WarningFlags } from '@/lib/products/warnings'
import {
  formatCondition,
  formatDimensions,
  formatWeight,
  type DimensionsInput,
} from '@/lib/shop/format'

// Blöcke 7–10 der Produktseite (KONZEPT §3.4): Beschreibung in Absätzen, Details-Tabelle (DESIGN KO-09b), Stammdaten
// der Herstellerin und Warnhinweise für „Herstellerin & Sicherheit“ (R-040), Versandklasse mit DE-Preis (R-031).
// Reines Modul (ohne Datenbank testbar); die Anzeige baut `src/components/shop/product/ProductInfo.tsx`.

type Obj = Record<string, unknown>
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v)
const text = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null)

/** Absätze eines Freitexts (Leerzeilen trennen Absätze, einfache Umbrüche bleiben im Absatz als Leerzeichen). */
export function paragraphs(value: string | null | undefined): string[] {
  return (value ?? '')
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s*\n\s*/g, ' ').trim())
    .filter((p) => p !== '')
}

// --- Details-Tabelle (KO-09b) ----------------------------------------------------------------------------------------

/** Zeilen in der Reihenfolge von KONZEPT §3.4 Nr. 8: Maße, Gewicht, Material, Technik, Größe, Zustand, Pflege. */
export const DETAIL_KEYS = [
  'dimensions',
  'weight',
  'material',
  'technique',
  'size',
  'condition',
  'care',
] as const
export type DetailKey = (typeof DETAIL_KEYS)[number]

/** Übersetzbares Feld hinter einer Zeile (für `lang="de"` beim EN-Rückfall). */
export type DetailTextField =
  'materials' | 'sizeLabel' | 'conditionNote' | 'careInstructions' | 'dimensionsNote'

export interface DetailRow {
  key: DetailKey
  value: string
  field?: DetailTextField
}

export interface DetailInput {
  category: ProductCategory
  dimensions?: DimensionsInput | null
  weightGrams?: number | null
  materials?: string | null
  sizeLabel?: string | null
  condition?: Parameters<typeof formatCondition>[0]
  conditionNote?: string | null
  careInstructions?: string | null
}

/** Zeilen der Details-Tabelle; leere Werte erzeugen keine Zeile. Zeichnungen: `materials` als „Technik“. */
export function productDetailRows(p: DetailInput, locale: Locale): DetailRow[] {
  const rows: DetailRow[] = []
  const add = (key: DetailKey, value: string | null | undefined, field?: DetailTextField) => {
    const v = value?.trim()
    if (v) rows.push(field ? { key, value: v, field } : { key, value: v })
  }
  add(
    'dimensions',
    formatDimensions(p.dimensions, locale),
    p.dimensions?.note ? 'dimensionsNote' : undefined,
  )
  add('weight', formatWeight(p.weightGrams, locale))
  add(p.category === 'zeichnung' ? 'technique' : 'material', p.materials, 'materials')
  add('size', p.sizeLabel, 'sizeLabel')
  add(
    'condition',
    formatCondition(p.condition, locale, p.conditionNote),
    p.conditionNote ? 'conditionNote' : undefined,
  )
  add('care', p.careInstructions, 'careInstructions')
  return rows.sort((a, b) => DETAIL_KEYS.indexOf(a.key) - DETAIL_KEYS.indexOf(b.key))
}

// --- Herstellerin (settings.business, R-040, E-40) -----------------------------------------------------------------

export interface BusinessInfo {
  legalName: string | null
  tradeName: string | null
  street: string | null
  postalCode: string | null
  city: string | null
  country: string | null
  email: string | null
}

/** Stammdaten aus den öffentlichen Einstellungen (Whitelist `getPublicSettings`). Land als Name der Sprache. */
export function pickBusinessInfo(settings: Obj, locale: Locale): BusinessInfo {
  const b = isObj(settings.business) ? settings.business : {}
  const code = text(b.country) as CountryCode | null
  const label = code
    ? (ENUM_LABELS.COUNTRY_CODES as Record<string, { de: string; en?: string }>)[code]
    : undefined
  return {
    legalName: text(b.legalName),
    tradeName: text(b.tradeName),
    street: text(b.street),
    postalCode: text(b.postalCode),
    city: text(b.city),
    country: label ? ((locale === 'en' ? label.en : undefined) ?? label.de) : null,
    email: text(b.email),
  }
}

// --- Versand (settings.shipping.rates, Zone DE, E-25) ---------------------------------------------------------------

export type ParcelClass = Exclude<ShippingClass, 'nur_abholung'>

/** DE-Preise je Versandklasse in Cent (nur ganzzahlige Werte). */
export function shippingRatesDe(settings: Obj): Partial<Record<ParcelClass, number>> {
  const shipping = isObj(settings.shipping) ? settings.shipping : {}
  const out: Partial<Record<ParcelClass, number>> = {}
  for (const rate of Array.isArray(shipping.rates) ? shipping.rates : []) {
    if (!isObj(rate) || rate.zone !== 'DE') continue
    const cls = rate.shippingClass as ParcelClass
    if (
      typeof rate.priceCents === 'number' &&
      Number.isInteger(rate.priceCents) &&
      rate.priceCents >= 0
    )
      out[cls] = rate.priceCents
  }
  return out
}

/** Versandpreis einer Klasse für den Satz „Versand als … 8,90 €“ (`formatMoney`, R-030); ohne Preis `null`. */
export function shippingPriceText(
  rates: Partial<Record<ParcelClass, number>>,
  shippingClass: ShippingClass,
  locale: Locale,
): string | null {
  if (shippingClass === 'nur_abholung') return null
  const cents = rates[shippingClass]
  return typeof cents === 'number' ? formatMoney(cents, locale) : null
}

// --- Warnhinweise (R-040) ----------------------------------------------------------------------------------------

export interface SafetyInput extends WarningFlags {
  /** `safetyWarnings` auf Deutsch (immer angezeigt). */
  de?: string | null
  /** `safetyWarnings` in der Seitensprache, nur wenn es eine eigene Fassung gibt (sonst `null`). */
  translated?: string | null
}

/**
 * Warn- und Sicherheitshinweise: Deutsch immer, auf `/en` zusätzlich die englische Fassung (R-040). Fehlende
 * Pflicht-Hinweise (Kleinteile, Glasrahmen) hängt das System an (DATENMODELL §6.6.8 Nr. 5); `extra` sind weitere
 * Bausteine je Sprache (z. B. Deko-Keramik). Leeres Deutsch → `fallback` (Baustein „Keine besonderen Warnhinweise“).
 */
export function safetyWarningTexts(
  input: SafetyInput,
  locale: Locale,
  extra: Partial<Record<Locale, string>> = {},
  fallback: Partial<Record<Locale, string>> = {},
): { de: string[]; en: string[] } {
  const keys = requiredWarningKeys(input)
  const build = (value: string | null | undefined, lang: Locale): string[] => {
    const withMandatory = appendWarnings(value, keys, lang)
    const add = extra[lang]
    const parts = paragraphs(withMandatory)
    if (add && !parts.some((p) => p.includes(add))) parts.push(add)
    if (parts.length === 0 && fallback[lang]) parts.push(fallback[lang]!)
    return parts
  }
  const de = build(input.de, 'de')
  const en = locale === 'en' && text(input.translated) ? build(input.translated, 'en') : []
  return { de, en }
}
