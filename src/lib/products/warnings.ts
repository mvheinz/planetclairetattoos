import type { Locale, ProductCategory } from '@/lib/enums'

// Pflicht-Warnhinweise in `safetyWarnings` (DATENMODELL §6.6.8 Nr. 5, R-040, R-045, R-046). Der Text kommt aus den
// Bausteinen `product.jewelrySmallParts` und `product.glassFrame` (RECHT ANFORDERUNGEN §6, Arbeitsfassung). Bis
// `getSnippet` existiert (P3.3, ab P6 aus `legal-snippets`), liegt die Arbeitsfassung hier; P3.3 stellt auf
// `getSnippet` um, die Aufrufer ändern sich nicht. Reines Modul.

export type MandatoryWarningKey = 'product.jewelrySmallParts' | 'product.glassFrame'

export const MANDATORY_WARNING_TEXTS: Readonly<
  Record<MandatoryWarningKey, Readonly<Record<Locale, string>>>
> = Object.freeze({
  'product.jewelrySmallParts': Object.freeze({
    de: 'Achtung: Kein Spielzeug. Nicht für Kinder unter 3 Jahren geeignet – enthält verschluckbare Kleinteile.',
    en: 'Warning: Not a toy. Not suitable for children under 3 years – contains small parts that could be swallowed.',
  }),
  'product.glassFrame': Object.freeze({
    de: 'Rahmen mit Glas – zerbrechlich, vorsichtig auspacken.',
    en: 'Frame with glass – fragile, unpack carefully.',
  }),
})

export interface WarningFlags {
  category?: ProductCategory | string | null
  smallPartsWarning?: boolean | null
  framed?: boolean | null
  frameHasGlass?: boolean | null
}

/** Welche Pflicht-Hinweise ein Stück braucht (Schmuck: Kleinteile; Zeichnung mit Glasrahmen: Glas). */
export function requiredWarningKeys(p: WarningFlags): MandatoryWarningKey[] {
  const keys: MandatoryWarningKey[] = []
  if (p.category === 'schmuck' && p.smallPartsWarning) keys.push('product.jewelrySmallParts')
  if (p.category === 'zeichnung' && p.framed && p.frameHasGlass) keys.push('product.glassFrame')
  return keys
}

const normalize = (s: string) => s.replace(/\s+/g, ' ').trim()

/** Enthält der Text den Hinweis (Leerraum-unabhängig)? */
export function containsWarning(
  text: string | null | undefined,
  key: MandatoryWarningKey,
  locale: Locale,
): boolean {
  if (!text) return false
  return normalize(text).includes(normalize(MANDATORY_WARNING_TEXTS[key][locale]))
}

export function missingWarnings(
  text: string | null | undefined,
  keys: readonly MandatoryWarningKey[],
  locale: Locale,
): MandatoryWarningKey[] {
  return keys.filter((k) => !containsWarning(text, k, locale))
}

/** Hängt fehlende Pflicht-Hinweise als eigenen Absatz an. */
export function appendWarnings(
  text: string | null | undefined,
  keys: readonly MandatoryWarningKey[],
  locale: Locale,
): string {
  const base = (text ?? '').trim()
  const add = missingWarnings(base, keys, locale).map((k) => MANDATORY_WARNING_TEXTS[k][locale])
  return [base, ...add].filter((s) => s !== '').join('\n\n')
}

/** Text ohne Pflicht-Hinweise (zum Vergleich mit der Kategorie-Vorlage). */
export function stripWarnings(text: string | null | undefined, locale: Locale): string {
  let out = text ?? ''
  for (const key of Object.keys(MANDATORY_WARNING_TEXTS) as MandatoryWarningKey[]) {
    out = out.split(MANDATORY_WARNING_TEXTS[key][locale]).join('')
  }
  return normalize(out)
}
