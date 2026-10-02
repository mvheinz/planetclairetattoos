// CSS der Vorschau-Datei (KONZEPT §12.5 Nr. 2, ARCHITEKTUR §14.5): alle Stylesheets in der Reihenfolge des ersten
// Auftretens, nach Inhalts-Hash dedupliziert, in **einem** `<style>`. `url()` auf Schriften → Data-URI, auf Bilder → die
// kodierte Fassung (WebP bzw. SVG) als Data-URI. `@import` ist ein Fehler (Exit 1).
import { createHash } from 'node:crypto'

import { resolveAssetPath } from '../crawl'
import { ExportError } from '../errors'

export interface CssSource {
  path: string
  css: string
}

/** Stylesheet-Pfade in Reihenfolge des ersten Auftretens über alle Seiten (Seiten in fester Reihenfolge). */
export function orderStylesheets(pageSheets: readonly (readonly string[])[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const sheets of pageSheets)
    for (const s of sheets) {
      if (seen.has(s)) continue
      seen.add(s)
      out.push(s)
    }
  return out
}

/** Entfernt Source-Map-Kommentare; `@import` → ExportError. */
export function cleanCss(css: string, path: string): string {
  if (/@import\b/i.test(css.replace(/\/\*[\s\S]*?\*\//g, ''))) {
    throw new ExportError(1, `CSS ${path} enthält @import – in der Vorschau-Datei nicht erlaubt.`)
  }
  return css.replace(/\/\*#\s*sourceMappingURL=[^*]*\*\//g, '').trim()
}

/**
 * Ersetzt `url()` in `css` (Datei `from`) über `resolve(Pfad) → Data-URI | null`. Nicht auflösbare Verweise werden
 * zu `url("data:,")` (lädt nichts) und als Warnung gemeldet.
 */
export function inlineCssUrls(
  css: string,
  from: string,
  resolve: (path: string) => string | null,
  warnings: string[],
): string {
  // Gequotete Werte als Ganzes: Ein SVG-Daten-URI enthält selbst `'` und `url(%23id)` – das darf nicht als eigene
  // Adresse gelesen werden (sonst `url("data:,")` mitten im Muster).
  const re = /url\(\s*(?:"([^"]*)"|'([^']*)'|([^'")\s]+))\s*\)/g
  return css.replace(re, (whole, dq?: string, sq?: string, bare?: string) => {
    const u = (dq ?? sq ?? bare ?? '').trim()
    if (u.startsWith('data:') || u.startsWith('#')) return whole
    const path = resolveAssetPath(u, from)
    const data = path ? resolve(path) : null
    if (!data) {
      warnings.push(`CSS ${from}: ${u} nicht eingebettet.`)
      return 'url("data:,")'
    }
    return `url("${data}")`
  })
}

/** Führt die Stylesheets zusammen (dedupliziert nach Inhalts-Hash). */
export function mergeCss(sources: readonly CssSource[]): string {
  const seen = new Set<string>()
  const parts: string[] = []
  for (const s of sources) {
    const hash = createHash('sha256').update(s.css).digest('hex')
    if (seen.has(hash)) continue
    seen.add(hash)
    parts.push(s.css)
  }
  return parts.join('\n')
}
