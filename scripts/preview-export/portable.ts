import * as cheerio from 'cheerio'

// Statische Prüfungen der Vorschau-Datei (R-182, ARCHITEKTUR §14.10, PLAN P10.20): keine externen Ressourcen, keine
// Spuren des Build-Rechners. Reine Funktionen auf dem HTML-Text – genutzt vom Unit-Test (R-182), vom Int-Test des
// Exports und vom Portabilitätstest (`tests/e2e/preview-portable.e2e.spec.ts`).

/** Das Band aus R-182 (Zeile 1, Deutsch). */
export const R182_BANNER_DE =
  'Interne Vorschau – nicht weitergeben · Beispieldaten · Rechtstexte sind Platzhalter'

/** Zeichenketten, die nie in der Datei stehen dürfen (AK-A-14-02 und Portabilität, P10.20). */
export const FORBIDDEN_STRINGS = [
  '/_next/',
  '127.0.0.1:3999',
  '__next_f',
  '__leash',
  '/werkstatt',
  'localhost',
  '127.0.0.1',
  'file://',
] as const

/** Verbotene Zeichenketten, die in `html` vorkommen (inklusive des absoluten Build-Pfads `cwd`). */
export function forbiddenStrings(html: string, cwd: string): string[] {
  // `__leash` nur als eigenes Wort (die Test-Schnittstelle `window.__leash`): CSS-Modul-Klassennamen wie
  // `qa-module__O2_KOq__leashPage` (Kunst-QA-Seiten) enthalten die Zeichenfolge zufällig und zählen nicht.
  const found: string[] = FORBIDDEN_STRINGS.filter((s) =>
    s === '__leash' ? /(?<![A-Za-z0-9_$])__leash(?![A-Za-z0-9_$])/.test(html) : html.includes(s),
  )
  if (cwd.length > 1 && html.includes(cwd)) found.push(cwd)
  return found
}

const URL_ATTRS = new Set([
  'src',
  'srcset',
  'href',
  'data-href',
  'action',
  'poster',
  'data',
  'xlink:href',
])
const ALLOWED_SCHEME = /^(data:|blob:|#)/i
/** In CSS zusätzlich Verweise auf Fragmente innerhalb der Datei (`url(#filter)`, auch als `%23` kodiert). */
const ALLOWED_CSS_URL = /^(data:|blob:|#|%23)/i

/**
 * Alle Verweise, die über die Datei hinausgehen: jedes `src`/`href`/… muss `data:`, `blob:`, `#…` sein; erlaubt sind
 * nur Textlinks nach außen (`<a href>` mit http(s), `mailto:`, `tel:`). Dazu externe `url(…)`/`@import` in CSS.
 * Auch der Inhalt von `<template>` wird geprüft.
 */
export function externalReferences(html: string): string[] {
  const $ = cheerio.load(html)
  const found: string[] = []
  $('*').each((_, el) => {
    const tag = (el as { tagName?: string }).tagName ?? ''
    for (const [name, value] of Object.entries($(el).attr() ?? {})) {
      if (name === 'style') {
        for (const m of value.matchAll(/url\(\s*['"]?([^'")\s]+)/gi)) {
          if (!ALLOWED_CSS_URL.test(m[1]!)) found.push(`<${tag} style url(${m[1]!.slice(0, 80)})>`)
        }
        continue
      }
      if (!URL_ATTRS.has(name)) continue
      const v = value.trim()
      if (v === '' || ALLOWED_SCHEME.test(v)) continue
      if (tag === 'a' && /^(https?:|mailto:|tel:)/i.test(v)) continue
      if (name === 'srcset' && v.split(',').every((p) => ALLOWED_SCHEME.test(p.trim()))) continue
      found.push(`<${tag} ${name}="${v.slice(0, 80)}">`)
    }
  })
  $('style').each((_, el) => {
    const css = $(el).text()
    for (const m of css.matchAll(/url\(\s*['"]?([^'")\s]+)/gi)) {
      if (!ALLOWED_CSS_URL.test(m[1]!)) found.push(`url(${m[1]!.slice(0, 80)})`)
    }
    if (/@import/i.test(css)) found.push('@import')
  })
  return found
}

/** Enthält das Dokument das Band aus R-182 (Deutsch und Englisch) in den eingebetteten Texten? */
export function hasBanner(html: string): boolean {
  return html.includes(R182_BANNER_DE) && html.includes('id="pv-banner"')
}
