import type { ProductCategory } from '@/lib/enums'
import { padItemNumber } from '@/lib/products/itemNumber'

// Fotoliste eines Stücks (PLAN P5.5, KONZEPT §7.4): 1–12 Fotos, Warnung unter 2, Reihenfolge per Hoch/Runter, erstes
// Foto = Titelbild, Fokuspunkt, Entfernen, Alt-Text-Vorschlag. Reines Modul (auch im Browser), unit-getestet.

export const MAX_PHOTOS = 12
export const RECOMMENDED_PHOTOS = 2

export interface PiecePhoto {
  /** ID in `media`. */
  id: number
  /** Vorschaubild (Größe `thumb`, sonst Original). */
  url: string | null
  altDe: string
  altEn: string
  /** Alt-Text DE stammt noch aus dem Vorschlag (wird bei Titel-/Kategorie-Änderung nachgeführt). */
  altDeAuto: boolean
  focalX: number
  focalY: number
  /** Alt-Texte oder Fokuspunkt geändert, noch nicht gespeichert. */
  dirty: boolean
}

/** Freie Plätze bis 12 Fotos. */
export function freeSlots(count: number): number {
  return Math.max(0, MAX_PHOTOS - count)
}

export function movePhoto<T>(list: readonly T[], index: number, delta: -1 | 1): T[] {
  const target = index + delta
  if (index < 0 || index >= list.length || target < 0 || target >= list.length) return [...list]
  const next = [...list]
  const [item] = next.splice(index, 1)
  next.splice(target, 0, item!)
  return next
}

export function removePhoto<T>(list: readonly T[], index: number): T[] {
  return list.filter((_, i) => i !== index)
}

/** „Produktart“ im Singular für den Alt-Text-Vorschlag. */
const KIND_DE: Record<ProductCategory, string> = {
  keramik: 'Keramik',
  textil: 'Textil',
  cap: 'Cap',
  zeichnung: 'Zeichnung',
  schmuck: 'Schmuck',
  sonstiges: 'Stück',
}

export interface AltSuggestionInput {
  category?: ProductCategory | string | null
  title?: string | null
  itemNumber?: number | null
  /** 1-basiert. */
  index: number
  total: number
}

/** Vorschlag Alt-Text DE: `{Produktart} „{Titel}“, Nr. 017, Foto 1 von 3` (PLAN P5.5). */
export function suggestAlt({ category, title, itemNumber, index, total }: AltSuggestionInput) {
  const kind = KIND_DE[category as ProductCategory] ?? 'Stück'
  const name = title?.trim() ? ` „${title.trim()}“` : ''
  const nr =
    typeof itemNumber === 'number' && Number.isInteger(itemNumber) && itemNumber > 0
      ? `, Nr. ${padItemNumber(itemNumber)}`
      : ''
  return `${kind}${name}${nr}, Foto ${index} von ${total}`
}

/** Fokuspunkt als 3×3-Raster (Tastatur-bedienbare Auswahl statt Tippen ins Bild). */
export const FOCAL_POSITIONS = [
  { key: 'tl', label: 'oben links', x: 20, y: 20 },
  { key: 't', label: 'oben Mitte', x: 50, y: 20 },
  { key: 'tr', label: 'oben rechts', x: 80, y: 20 },
  { key: 'l', label: 'Mitte links', x: 20, y: 50 },
  { key: 'c', label: 'Mitte', x: 50, y: 50 },
  { key: 'r', label: 'Mitte rechts', x: 80, y: 50 },
  { key: 'bl', label: 'unten links', x: 20, y: 80 },
  { key: 'b', label: 'unten Mitte', x: 50, y: 80 },
  { key: 'br', label: 'unten rechts', x: 80, y: 80 },
] as const

/** Nächstgelegene Raster-Position zu einem Fokuspunkt (Prozent). */
export function focalKey(x: number, y: number): string {
  let best: (typeof FOCAL_POSITIONS)[number] = FOCAL_POSITIONS[4]
  let dist = Infinity
  for (const p of FOCAL_POSITIONS) {
    const d = (p.x - x) ** 2 + (p.y - y) ** 2
    if (d < dist) {
      dist = d
      best = p
    }
  }
  return best.key
}

/** Automatische Alt-Texte nachführen (nur solche, die du nicht selbst geändert hast). */
export function refreshAutoAlts(
  photos: readonly PiecePhoto[],
  info: Omit<AltSuggestionInput, 'index' | 'total'>,
): PiecePhoto[] {
  let changed = false
  const next = photos.map((p, i) => {
    if (!p.altDeAuto) return p
    const alt = suggestAlt({ ...info, index: i + 1, total: photos.length })
    if (alt === p.altDe) return p
    changed = true
    return { ...p, altDe: alt, dirty: true }
  })
  return changed ? next : (photos as PiecePhoto[])
}
