import { ENUM_LABELS } from '@/lib/enumLabels'
import type { Locale, ProductCategory, TextileCondition } from '@/lib/enums'

import { formatFibers, type FiberRow } from './fibers'
import { pickLocale, type LocalizedValue } from './localized'

// Wesentliche Eigenschaften eines Stücks als eine Zeile (DATENMODELL §6.6.2, KONZEPT §4.5 Nr. 1, § 312j BGB):
// Kategorie, Maße, Material bzw. bei Textil/Caps Faserzusammensetzung, Größe und Zustand, bei Keramik der
// Lebensmittelkontakt, bei Schmuck das Material der Metallteile, bei Zeichnungen der Rahmen, dazu der Abweichungstext.
// Wird in Kasse und Bestell-Snapshot verwendet. Reines Modul.

export interface CharacteristicsInput {
  category?: ProductCategory | string | null
  materials?: LocalizedValue
  dimensions?: {
    widthCm?: number | null
    heightCm?: number | null
    depthCm?: number | null
    diameterCm?: number | null
    note?: LocalizedValue
  } | null
  sizeLabel?: LocalizedValue
  condition?: TextileCondition | string | null
  fiberComposition?: readonly FiberRow[] | null
  labelMissing?: boolean | null
  foodContact?: string | null
  metalPartsMaterial?: LocalizedValue
  framed?: boolean | null
  frameHasGlass?: boolean | null
  hasDeviation?: boolean | null
  deviationDescription?: LocalizedValue
}

type Words = Record<Locale, string>
const W = {
  category: {
    keramik: { de: 'Keramik', en: 'Ceramics' },
    textil: { de: 'Textil', en: 'Textile' },
    cap: { de: 'Cap', en: 'Cap' },
    zeichnung: { de: 'Zeichnung', en: 'Drawing' },
    schmuck: { de: 'Schmuck', en: 'Jewellery' },
    sonstiges: { de: 'Sonstiges', en: 'Other' },
  } satisfies Record<ProductCategory, Words>,
  size: { de: 'Größe', en: 'Size' },
  condition: { de: 'Zustand', en: 'Condition' },
  bestKnowledge: { de: 'nach bestem Wissen', en: 'to the best of our knowledge' },
  deko: { de: 'Deko – nicht für Lebensmittel', en: 'Decorative – not for food use' },
  foodSafe: { de: 'lebensmittelecht', en: 'food-safe' },
  metalParts: { de: 'Metallteile', en: 'Metal parts' },
  framedGlass: { de: 'gerahmt, mit Glas', en: 'framed, with glass' },
  framed: { de: 'gerahmt', en: 'framed' },
  deviation: { de: 'Besonderheit', en: 'Special feature' },
} as const

function formatCm(value: number, locale: Locale): string {
  return new Intl.NumberFormat(locale === 'en' ? 'en-GB' : 'de-DE', {
    maximumFractionDigits: 1,
  }).format(value)
}

const DIM_LABEL = {
  widthCm: { de: 'Breite', en: 'width' },
  heightCm: { de: 'Höhe', en: 'height' },
  depthCm: { de: 'Tiefe', en: 'depth' },
} as const

/** „Ø 14 cm, Höhe 6,5 cm“, „21 × 29,7 cm“ (B × H [× T]); eine einzelne Kantenlänge mit Bezeichnung. */
function formatDimensions(d: CharacteristicsInput['dimensions'], locale: Locale): string[] {
  if (!d) return []
  const out: string[] = []
  if (d.diameterCm) out.push(`Ø ${formatCm(d.diameterCm, locale)} cm`)
  const box = (['widthCm', 'heightCm', 'depthCm'] as const).filter((k) => !!d[k])
  if (box.length === 1) {
    const key = box[0]!
    out.push(`${DIM_LABEL[key][locale]} ${formatCm(d[key]!, locale)} cm`)
  } else if (box.length > 1) {
    out.push(`${box.map((k) => formatCm(d[k]!, locale)).join(' × ')} cm`)
  }
  return out.length > 0 ? [out.join(', ')] : []
}

/** Eine Zeile, Teile mit „ · “ verbunden; fehlende Angaben entfallen. */
export function buildCharacteristics(product: CharacteristicsInput, locale: Locale): string {
  const parts: string[] = []
  const category = product.category as ProductCategory | undefined
  if (category && W.category[category]) parts.push(W.category[category][locale])
  const pick = (v: LocalizedValue) => pickLocale(v, locale)

  if (category === 'textil' || category === 'cap') {
    const size = pick(product.sizeLabel)
    if (size) parts.push(`${W.size[locale]} ${size}`)
    const fibers = formatFibers(product.fiberComposition, locale)
    if (fibers) parts.push(product.labelMissing ? `${fibers} (${W.bestKnowledge[locale]})` : fibers)
    const condition = product.condition as TextileCondition | undefined
    const label = condition ? ENUM_LABELS.TEXTILE_CONDITIONS[condition] : undefined
    if (label) parts.push(`${W.condition[locale]}: ${locale === 'en' ? label.en : label.de}`)
  } else {
    parts.push(...formatDimensions(product.dimensions, locale))
    const materials = pick(product.materials)
    if (materials) parts.push(materials)
  }

  if (category === 'keramik') {
    if (product.foodContact === 'lebensmittelecht') parts.push(W.foodSafe[locale])
    else if (product.foodContact === 'deko') parts.push(W.deko[locale])
  }
  if (category === 'schmuck') {
    const metal = pick(product.metalPartsMaterial)
    if (metal) parts.push(`${W.metalParts[locale]}: ${metal}`)
  }
  if (category === 'zeichnung' && product.framed) {
    parts.push((product.frameHasGlass ? W.framedGlass : W.framed)[locale])
  }
  if (product.hasDeviation) {
    const text = pick(product.deviationDescription)
    if (text) parts.push(`${W.deviation[locale]}: ${text}`)
  }
  return parts.join(' · ')
}
