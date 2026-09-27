import type { Locale } from '@/lib/enums'

// Objektnummer (E-12, R-041, DATENMODELL §6.6.4): einzige Stelle für Format und Auffüll-Regel (ARCHITEKTUR §2.1).
// Reines Modul (auch im Browser nutzbar).

export const ITEM_NUMBER_MIN = 1
export const ITEM_NUMBER_MAX = 99_999

/** Ganzzahl 1–99 999. */
export function isValidItemNumber(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= ITEM_NUMBER_MIN &&
    value <= ITEM_NUMBER_MAX
  )
}

/** Mindestens dreistellig mit führenden Nullen („017“), ab 1000 ohne Auffüllen („1234“). */
export function padItemNumber(nr: number): string {
  return String(nr).padStart(3, '0')
}

const PREFIX: Record<Locale, string> = { de: 'Nr.', en: 'No.' }

/** „Nr. 017“ / „No. 017“. */
export function formatItemNumber(nr: number, locale: Locale): string {
  return `${PREFIX[locale]} ${padItemNumber(nr)}`
}
