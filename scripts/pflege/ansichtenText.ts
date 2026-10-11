// Texte für den Katalog (U-88, PLAN P18.3): Preis, Eckdaten und gekürzte Beschreibung je Stück. Reine Funktionen.
import { ENUM_LABELS } from '../../src/lib/enumLabels'
import { PRODUCT_CATEGORIES, TEXTILE_CONDITIONS } from '../../src/lib/enums'
import { formatMoney } from '../../src/lib/money'
import type { BestandProduct } from '../../src/lib/bestand/schema'

export const CATEGORY_LABEL_DE: Record<string, string> = Object.fromEntries(
  PRODUCT_CATEGORIES.map((c) => [c, ENUM_LABELS.PRODUCT_CATEGORIES[c].de]),
)
const CONDITION_DE: Record<string, string> = Object.fromEntries(
  TEXTILE_CONDITIONS.map((c) => [c, ENUM_LABELS.TEXTILE_CONDITIONS[c].de]),
)

const cm = (n: number) => String(n).replace('.', ',')

/** „B 7 × H 9 × T 2 cm“, „Ø 12 cm“ – leer, wenn keine Maße. */
export function dimensionsText(d: BestandProduct['dimensions']): string {
  const parts = [
    d.widthCm !== undefined ? `B ${cm(d.widthCm)}` : '',
    d.heightCm !== undefined ? `H ${cm(d.heightCm)}` : '',
    d.depthCm !== undefined ? `T ${cm(d.depthCm)}` : '',
  ].filter(Boolean)
  const dia = d.diameterCm !== undefined ? `Ø ${cm(d.diameterCm)} cm` : ''
  return [parts.length ? `${parts.join(' × ')} cm` : '', dia].filter(Boolean).join(', ')
}

/** Text auf höchstens `max` Zeichen kürzen, möglichst am Satzende. */
export function shorten(text: string, max = 170): string {
  const t = text.replace(/\s+/g, ' ').trim()
  if (t.length <= max) return t
  const cut = t.slice(0, max)
  const end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '))
  return end > max * 0.5 ? cut.slice(0, end + 1) : `${cut.slice(0, cut.lastIndexOf(' '))} …`
}

export function catalogFacts(p: BestandProduct): {
  price: string
  facts: string[]
  description: string
} {
  const textile = p.category === 'textil' || p.category === 'cap'
  return {
    price: formatMoney(p.priceCents, 'de'),
    facts: [
      dimensionsText(p.dimensions),
      textile && p.sizeLabel ? `Größe ${p.sizeLabel.de}` : '',
      p.materials.de,
      textile && p.condition
        ? `${p.isSecondHand ? 'Second Hand, ' : ''}Zustand ${CONDITION_DE[p.condition] ?? p.condition}`
        : '',
    ].filter(Boolean),
    description: shorten(p.description.de),
  }
}
