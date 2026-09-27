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

// Nummernbereiche (DATENMODELL §13.3): Beispielbestand 901–930, E2E-Fixtures 980–999. Solange Beispieldaten
// existieren, ist 901–999 für neue Stücke der Verwaltung gesperrt, und der Vorschlag überspringt den Bereich.
export const SEED_ITEM_RANGE = { from: 901, to: 930 } as const
export const FIXTURE_ITEM_RANGE = { from: 980, to: 999 } as const
export const RESERVED_ITEM_RANGE = { from: 901, to: 999 } as const

export function isReservedItemNumber(nr: number): boolean {
  return nr >= RESERVED_ITEM_RANGE.from && nr <= RESERVED_ITEM_RANGE.to
}

export interface SuggestOptions {
  /** Größte Nummer aller Nicht-Seed-Stücke (ohne Stücke: `null`). */
  maxReal: number | null
  /** Belegte Nummern (alle Stücke, auch Seed). */
  taken: ReadonlySet<number>
  /** `settings.seed.exampleDataPresent`: 901–999 überspringen. */
  exampleDataPresent: boolean
}

/**
 * Vorschlag §6.6.4: max(Nicht-Seed) + 1, mindestens 1; ist die Zahl belegt oder gesperrt, die nächste freie darüber.
 * `null`, wenn bis 99 999 nichts mehr frei ist.
 */
export function suggestItemNumber({
  maxReal,
  taken,
  exampleDataPresent,
}: SuggestOptions): number | null {
  for (let nr = Math.max(ITEM_NUMBER_MIN, (maxReal ?? 0) + 1); nr <= ITEM_NUMBER_MAX; nr++) {
    if (taken.has(nr)) continue
    if (exampleDataPresent && isReservedItemNumber(nr)) continue
    return nr
  }
  return null
}

const UMLAUTS: Record<string, string> = { ä: 'ae', ö: 'oe', ü: 'ue', ß: 'ss' }
export const SLUG_MAX_TITLE = 80
export const PRODUCT_SLUG_RE = /^\d{3,}-[a-z0-9-]+$/

/** „Schale „Fuchs“ Nr. 1“ → „schale-fuchs-nr-1“ (Umlaute ausgeschrieben, sonstige Akzente entfernt). */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[äöüß]/g, (c) => UMLAUTS[c] ?? c)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, SLUG_MAX_TITLE)
    .replace(/-+$/g, '')
}

/** Slug je Sprache: `<nr3>-<slugify(titel)>`, ohne verwertbaren Titel `<nr3>-stueck`. */
export function buildProductSlug(nr: number, title: string | null | undefined): string {
  return `${padItemNumber(nr)}-${slugify(title ?? '') || 'stueck'}`
}
