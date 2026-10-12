import type { Locale } from '@/lib/enums'

import { type LocalizedValue } from './localized'

// Maße ehrlich (V-15, U-93): Ein Stück geht erst online, wenn im Hinweis zu den Maßen und in der Größe kein Schätz-
// Vermerk mehr steht („geschätzt“, „estimated“, „vermutlich“, „bitte nachmessen“ …). Maße gelten rechtlich als
// zugesagte Eigenschaft (§ 434 BGB) und stehen im Bestell-Snapshot (R-013/R-063) – deshalb eine Sperre, keine Warnung.
// Ein schlichtes „ca.“ bei gemessenen Werten bleibt erlaubt (handgemachte Stücke sind nie aufs Millimeter gleich).
// Dazu der feste Größenvergleich für sehr kleine Stücke (< 4 cm) auf der Produktseite – ein Satz, keine erzeugte
// Skizze (E-80). Reines Modul (Server, Browser, Unit-Tests).

export interface EstimateMarker {
  /** Stabiler Schlüssel (Tests). */
  id: string
  /** So erscheint der Vermerk in der Meldung. */
  label: string
  pattern: RegExp
}

/** Buchstaben davor/danach verhindern Treffer mitten im Wort („Einschätzung“, „estimates“ zählt mit). */
const L = '\\p{L}'
const marker = (id: string, label: string, source: string): EstimateMarker => ({
  id,
  label,
  pattern: new RegExp(source, 'iu'),
})

/**
 * Zentrale Liste der Schätz-Vermerke (Deutsch und Englisch). Nicht enthalten – weil bei gemessenen Werten üblich:
 * „ca.“, „etwa“, „ungefähr“, „approx.“, „about“, „roughly“.
 */
export const ESTIMATE_MARKERS: readonly EstimateMarker[] = [
  // Deutsch
  marker('de-geschaetzt', 'geschätzt', `(?<!${L})gesch(?:ä|ae)tzt`),
  marker('de-schaetzung', 'Schätzung', `(?<!${L})sch(?:ä|ae)tzung`),
  marker('de-schaetzwert', 'Schätzwert', `(?<!${L})sch(?:ä|ae)tzwert`),
  marker('de-vermutlich', 'vermutlich', `(?<!${L})vermutlich(?!${L})`),
  marker('de-nachmessen', 'nachmessen', `(?<!${L})nach(?:zu)?messen(?!${L})`),
  marker('de-noch-messen', 'noch messen', `(?<!${L})noch\\s+(?:zu\\s+)?messen(?!${L})`),
  marker('de-nicht-gemessen', 'nicht gemessen', `(?<!${L})(?:un|nicht\\s+)gemessen(?!${L})`),
  marker('de-ergaenzen', 'bitte ergänzen', `(?<!${L})(?:bitte|noch)\\s+erg(?:ä|ae)nzen(?!${L})`),
  // Englisch
  marker('en-estimated', 'estimated', `(?<!${L})estimat(?:e|ed|es|ion)(?!${L})`),
  marker('en-presumably', 'presumably', `(?<!${L})presumably(?!${L})`),
  marker('en-probably', 'probably', `(?<!${L})probably(?!${L})`),
  marker('en-to-be', 'to be measured', `(?<!${L})to\\s+be\\s+(?:measured|added)(?!${L})`),
  marker(
    'en-not-measured',
    'not measured',
    `(?<!${L})(?:not\\s+(?:yet\\s+)?measured|unmeasured|re-?measure)(?!${L})`,
  ),
  marker('en-tbd', 'tbd', `(?<!${L})tbd(?!${L})`),
  marker('en-guess', 'guessed', `(?<!${L})guess(?:ed|es|timated?)?(?!${L})`),
]

/** Erster Schätz-Vermerk im Text (`null` = keiner). */
export function findEstimateMarker(text: string | null | undefined): EstimateMarker | null {
  if (!text || !text.trim()) return null
  const normalized = text.normalize('NFC')
  return ESTIMATE_MARKERS.find((m) => m.pattern.test(normalized)) ?? null
}

/** Maß- und Größentexte eines Stücks, die geprüft werden (Feldpfad, Name in der Meldung). */
export const MEASUREMENT_TEXT_FIELDS = [
  { path: 'dimensions.note', label: 'Hinweis zu den Maßen' },
  { path: 'sizeLabel', label: 'Größe' },
] as const

export interface MeasurementTexts {
  dimensions?: { note?: LocalizedValue } | null
  sizeLabel?: LocalizedValue
}

export interface MeasurementIssue {
  field: (typeof MEASUREMENT_TEXT_FIELDS)[number]['path']
  locale: Locale
  marker: EstimateMarker
  /** Deutsche Meldung mit Feldname (beginnt mit „Bitte erst nachmessen“). */
  message: string
}

function localesOf(value: LocalizedValue): [Locale, string][] {
  if (typeof value === 'string') return [['de', value]]
  if (!value || typeof value !== 'object') return []
  return (['de', 'en'] as const)
    .map((l) => [l, value[l]] as [Locale, string | null | undefined])
    .filter((e): e is [Locale, string] => typeof e[1] === 'string' && e[1].trim() !== '')
}

/** Schätz-Vermerke in Maß-Hinweis und Größe (beide Sprachen); leer = nachgemessen. */
export function measurementIssues(product: MeasurementTexts): MeasurementIssue[] {
  const issues: MeasurementIssue[] = []
  const values: Record<MeasurementIssue['field'], LocalizedValue> = {
    'dimensions.note': product.dimensions?.note,
    sizeLabel: product.sizeLabel,
  }
  for (const { path, label } of MEASUREMENT_TEXT_FIELDS) {
    for (const [locale, text] of localesOf(values[path])) {
      const hit = findEstimateMarker(text)
      if (!hit) continue
      const lang = locale === 'de' ? 'Deutsch' : 'Englisch'
      issues.push({
        field: path,
        locale,
        marker: hit,
        message: `Bitte erst nachmessen: Im Feld „${label}“ (${lang}) steht noch „${hit.label}“. Miss das Stück nach, trag die gemessenen Werte ein und nimm den Vermerk heraus.`,
      })
    }
  }
  return issues
}

// --- Größenvergleich ------------------------------------------------------------------------------------------

/** Ab dieser größten Abmessung (cm) gibt es keinen Vergleich mehr. */
export const SIZE_COMPARE_MAX_CM = 4

/**
 * Bänder des Größenvergleichs nach der größten Abmessung (Breite, Höhe, Tiefe oder Durchmesser), ehrlich gewählt:
 * 1-Cent-Münze Ø 1,6 cm, 1-Euro-Münze Ø 2,3 cm, 2-Euro-Münze Ø 2,6 cm, Walnuss etwa 3–4 cm.
 */
export const SIZE_COMPARE_BANDS = [
  { key: 'belowCent', below: 1.3 },
  { key: 'cent', below: 1.9 },
  { key: 'euro1', below: 2.45 },
  { key: 'euro2', below: 2.9 },
  { key: 'walnut', below: SIZE_COMPARE_MAX_CM },
] as const

export type SizeCompareKey = (typeof SIZE_COMPARE_BANDS)[number]['key']

export interface DimensionNumbers {
  widthCm?: number | null
  heightCm?: number | null
  depthCm?: number | null
  diameterCm?: number | null
}

/** Größte Abmessung in cm (`null` ohne Maße). */
export function largestDimension(d: DimensionNumbers | null | undefined): number | null {
  if (!d) return null
  const values = [d.widthCm, d.heightCm, d.depthCm, d.diameterCm].filter(
    (v): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0,
  )
  return values.length > 0 ? Math.max(...values) : null
}

/** Vergleichsband für sehr kleine Stücke (größte Abmessung unter 4 cm), sonst `null`. */
export function sizeComparison(d: DimensionNumbers | null | undefined): SizeCompareKey | null {
  const max = largestDimension(d)
  if (max === null) return null
  return SIZE_COMPARE_BANDS.find((b) => max < b.below)?.key ?? null
}
