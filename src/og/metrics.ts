import { OG_FONT_METRICS } from './fontMetrics.generated'

// Schriftmaße der OG-Bilder (P3.14) aus dem von `pnpm fonts:copy` erzeugten Modul – ohne Schriftbibliothek zur
// Laufzeit. Reines Modul. `keepCovered` entfernt Zeichen, die die TTF-Datei nicht hat: satori würde sonst Ersatz-
// schriften bzw. Emoji-Grafiken aus dem Netz nachladen (Google Fonts, jsDelivr) – verboten (R-131, CLAUDE.md §6).

export type OgFontKey = keyof typeof OG_FONT_METRICS

const tables = new Map<OgFontKey, Map<number, number>>()

function table(key: OgFontKey): Map<number, number> {
  let map = tables.get(key)
  if (!map) {
    map = new Map(OG_FONT_METRICS[key].advances.map(([cp, w]) => [cp, w] as [number, number]))
    tables.set(key, map)
  }
  return map
}

export function hasGlyph(key: OgFontKey, codePoint: number): boolean {
  return table(key).has(codePoint)
}

/** Nur Zeichen mit Glyphe in der Schrift; Leerraum wird zu einfachen Leerzeichen zusammengefasst. */
export function keepCovered(text: string, key: OgFontKey): string {
  return [...text.replace(/\s+/g, ' ')]
    .filter((c) => c === ' ' || hasGlyph(key, c.codePointAt(0)!))
    .join('')
    .replace(/ {2,}/g, ' ')
    .trim()
}

/** Breite in px (Summe der Laufweiten, ohne Unterschneidung) bei `fontSize` px. */
export function textWidth(
  text: string,
  key: OgFontKey,
  fontSize: number,
  letterSpacing = 0,
): number {
  const map = table(key)
  const fallback = map.get(32) ?? OG_FONT_METRICS[key].unitsPerEm / 2
  let units = 0
  let chars = 0
  for (const c of text) {
    units += map.get(c.codePointAt(0)!) ?? fallback
    chars++
  }
  return (units * fontSize) / OG_FONT_METRICS[key].unitsPerEm + letterSpacing * chars
}
