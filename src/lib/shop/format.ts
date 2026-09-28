import { ENUM_LABELS } from '@/lib/enumLabels'
import type { Locale, TextileCondition } from '@/lib/enums'
import { formatFibers as formatFiberRows, type FiberRow } from '@/lib/products/fibers'
import { formatItemNumber, isValidItemNumber, padItemNumber } from '@/lib/products/itemNumber'
import { pickLocale, type LocalizedValue } from '@/lib/products/localized'
import { localizedPath } from '@/lib/routes/paths'

// Anzeige-Formatierer des Shops (ARCHITEKTUR §2.1, KONZEPT §3.2–§3.5). Nummer, Fasern und Zustand kommen aus
// `src/lib/products/` (einzige Stelle der Regeln); hier nur die Anzeige. Beträge formatiert ausschließlich
// `formatMoney` aus `src/lib/money.ts` – einen eigenen Preis-Formatierer gibt es nicht. Reines Modul.

export { formatItemNumber }

/** Geschütztes Leerzeichen zwischen Zahl und Einheit (DESIGN DA-9). */
const NBSP = ' '

const INTL: Record<Locale, string> = { de: 'de-DE', en: 'en-GB' }

/** Zahl mit höchstens `digits` Nachkommastellen in der Schreibweise der Sprache („29,7“ / „29.7“). */
function formatNumber(value: number, locale: Locale, digits = 1): string {
  return new Intl.NumberFormat(INTL[locale], { maximumFractionDigits: digits }).format(value)
}

export interface DimensionsInput {
  widthCm?: number | null
  heightCm?: number | null
  depthCm?: number | null
  diameterCm?: number | null
  note?: LocalizedValue
}

const DIM_ABBR: Record<'widthCm' | 'heightCm' | 'depthCm', Record<Locale, string>> = {
  widthCm: { de: 'B', en: 'W' },
  heightCm: { de: 'H', en: 'H' },
  depthCm: { de: 'T', en: 'D' },
}

/** „Ø 14 cm, H 6 cm“ bzw. „B 21 cm, H 29,7 cm“; Maß-Notiz (`dimensions.note`) hinten an; nichts → `''`. */
export function formatDimensions(d: DimensionsInput | null | undefined, locale: Locale): string {
  if (!d) return ''
  const parts: string[] = []
  if (d.diameterCm) parts.push(`Ø ${formatNumber(d.diameterCm, locale)} cm`)
  for (const key of ['widthCm', 'heightCm', 'depthCm'] as const) {
    const v = d[key]
    if (v) parts.push(`${DIM_ABBR[key][locale]} ${formatNumber(v, locale)} cm`)
  }
  const note = pickLocale(d.note, locale)
  if (note) parts.push(note)
  return parts.join(', ')
}

/**
 * Faserzusammensetzung (R-043): je Komponente absteigend nach Anteil, amtliche deutsche Bezeichnung; auf `/en`
 * zusätzlich die englische in Klammern. Regeln aus `src/lib/products/fibers.ts`.
 */
export function formatFibers(
  composition: readonly FiberRow[] | null | undefined,
  locale: Locale,
): string {
  return formatFiberRows(composition, locale)
}

/** Zustand eines Textils („sehr gut“ / „very good“), optional mit Notiz („sehr gut – kleiner Fleck am Ärmel“). */
export function formatCondition(
  condition: TextileCondition | string | null | undefined,
  locale: Locale,
  note?: LocalizedValue,
): string {
  const label = condition
    ? ENUM_LABELS.TEXTILE_CONDITIONS[condition as TextileCondition]
    : undefined
  if (!label) return ''
  const text = (locale === 'en' ? label.en : undefined) ?? label.de
  const extra = pickLocale(note, locale)
  return extra ? `${text} – ${extra}` : text
}

/**
 * Gewicht ohne Verpackung (DESIGN DA-9): unter 1000 g ganze Gramm („210 g“), ab 1000 g Kilogramm mit höchstens einer
 * Nachkommastelle, gerundet, ohne „,0“ („2,4 kg“ / „2.4 kg“, „1 kg“). Ungültige Werte → `''`.
 */
export function formatWeight(grams: number | null | undefined, locale: Locale): string {
  if (typeof grams !== 'number' || !Number.isFinite(grams) || grams <= 0) return ''
  if (grams < 1000) return `${Math.round(grams)}${NBSP}g`
  // Auf Zehntel-Kilogramm runden, ganzzahlig: 2449 g → 24 Zehntel → „2,4“.
  const tenths = Math.round(grams / 100)
  return `${formatNumber(tenths / 10, locale)}${NBSP}kg`
}

export interface ProductPathInput {
  itemNumber: number
  slug?: LocalizedValue
}

/**
 * Kanonischer Pfad eines Stücks (KONZEPT §2.3): `/{locale}/shop/{nr 3-stellig}-{slug}`, Slug der Sprache mit Rückfall
 * auf DE; ohne verwertbaren Slug `{nr}-stueck`. Der gespeicherte Slug beginnt bereits mit der Nummer (DATENMODELL
 * §6.6.4); maßgeblich ist aber immer die Nummer.
 */
export function productPath(product: ProductPathInput, locale: Locale): string {
  return localizedPath('R04', locale, productParams(product, locale))
}

/** Routen-Parameter von R04 (`nummer` 3-stellig, `slug` ohne Nummer; Rückfall `stueck`). */
export function productParams(
  product: ProductPathInput,
  locale: Locale,
): { nummer: string; slug: string } {
  const slug = pickLocale(product.slug, locale) ?? ''
  return {
    nummer: padItemNumber(product.itemNumber),
    slug: slug.replace(/^\d+-/, '') || 'stueck',
  }
}

/** Kanonisches Pfadsegment unter `/shop/` (Ordner `[product]`): `017-schale-mit-hund`. */
export function productSegment(product: ProductPathInput, locale: Locale): string {
  const { nummer, slug } = productParams(product, locale)
  return `${nummer}-${slug}`
}

/**
 * Objektnummer aus dem Pfadsegment der Produktseite (KONZEPT §2.3): nur die führenden Ziffern zählen („017-schale“,
 * „17“, „0017-alter-slug“ → 17). Ohne führende Ziffern oder außerhalb 1–99 999 → `null`.
 */
export function parseProductSegment(segment: string): number | null {
  const digits = /^\d+/.exec(segment)?.[0]
  if (!digits || digits.length > 6) return null
  const nr = Number.parseInt(digits, 10)
  return isValidItemNumber(nr) ? nr : null
}
