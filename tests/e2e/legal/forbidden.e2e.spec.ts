import * as cheerio from 'cheerio'

import { V13_UNPROVEN_CLAIMS, V16_THIRD_PARTY_MARKS } from '../../../src/lib/legal/forbidden'
import { hasSamplePath, pageRoutes, samplePath } from '../../../src/lib/routes/paths'
import { LOCALES, ROUTES } from '../../../src/lib/routes/registry'
import { getTaxModeAt, type TaxSettings } from '../../../src/lib/tax'
import {
  FORBIDDEN_CONTENT_PATTERNS,
  FORBIDDEN_SOURCE_PATTERNS,
  type ForbiddenPattern,
} from '../../helpers/forbiddenPatterns'
import { expect, test, testPayload } from '../fixtures'
import { holdListData } from '../shop/fresh'
import { P3_PAGES, homeVariant } from '../shop/p3Pages'
import { ANCHORS, openProduct } from '../shop/productPage'

// P2.29 (RECHT §5, ergänzt den Quelltext-Scan `tests/unit/legal/forbidden.unit.spec.ts`): Verbotsmuster im gerenderten
// HTML aller `live`-Routen der Registry in DE und EN – z. B. kein Link/Text zur OS-Plattform (V-01), kein „inkl. MwSt.“
// im Kleinunternehmer-Modus (V-02), keine Einbettungen, CAPTCHAs oder Tracker (V-05–V-07), kein vorangekreuztes
// Häkchen (V-03). Geprüft wird der vollständige HTML-Quelltext der Antwort (sichtbarer Text, Attribute, eingebettete
// Daten). Dateiname laut ANFORDERUNGEN §5 (PLAN P2.29 nennt `forbidden-html.e2e.spec.ts`; spätere Aufgaben erweitern
// diese Datei um weitere Seitentypen und die Mail-Vorlagen). Bisher braucht das gerenderte HTML keine Allowlist.
// P3.16: über alle gerenderten P3-Seiten (Varianten, jede Kategorie, Produktseite je Kategorie und Zustand,
// 404-Varianten) zusätzlich im sichtbaren Text V-13 (unbelegte Produktaussagen – erlaubt nur in den Bausteinen mit
// Nachweis `[data-legal-note]`/`[data-badge]`), V-16 (fremde Figuren/Marken), V-20 (Streich-/„statt“-Preise, auch
// `<del>`/`<s>`/`line-through`), „Lorem“ (EK-09) und R-139 (Instagram nur als Link mit `rel="noopener noreferrer"`;
// kein Bild, Skript, Rahmen oder Einbettung). V-02, V-08, V-17 und V-19 prüfen die Inhaltsmuster über das ganze HTML.

// Seed-Anker (S06 verkauft, Listen) nicht während eines exklusiven Bestandstests (Archiv-Leerzustand) lesen.
holdListData(test, 'shared')

interface Visit {
  name: string
  path: string
  status: number
  /** P3.16: reines Server-HTML, browserunabhängig – einmal je Lauf (Projekt `desktop`). */
  once?: boolean
}

/** Server-HTML ist in allen Projekten gleich: die P3-Zusatzseiten nur im Projekt `desktop` (spart CI-Minuten). */
const onlyOnce = (projectName: string) =>
  test.skip(projectName !== 'desktop', 'Server-HTML – browserunabhängig, einmal je Lauf')

const visits: Visit[] = [
  ...pageRoutes()
    .filter((r) => r.status === 'live' && hasSamplePath(r))
    .flatMap((r) =>
      LOCALES.map((locale) => ({
        name: `${r.id} ${locale}`,
        path: samplePath(r.id, locale),
        status: 200,
      })),
    ),
  ...LOCALES.flatMap((locale) => [
    { name: `R28 ${locale}`, path: `/${locale}/gibt-es-nicht-${locale}`, status: 404 },
    { name: `R29 ${locale}`, path: `/${locale}/__fehler-test`, status: 500 },
  ]),
  { name: 'R30', path: '/', status: 200 },
  // Kurzlink (P3.7): 307 auf die Produktseite (S01).
  { name: 'R31', path: '/nr/901', status: 200 },
  // P3.16: Varianten und Zustände von R02–R05 (Listen-Varianten, jede Kategorie, Produktseiten je Kategorie und Zustand
  // mit Blöcken 7–11 – Widerrufshinweis V-08/V-19 –, 404-Varianten).
  // (Beispiel-Adressen der Registry stehen schon oben – nur weitere Pfade.)
  ...P3_PAGES.filter(
    (p) =>
      !pageRoutes()
        .filter((r) => r.status === 'live' && hasSamplePath(r))
        .some((r) => LOCALES.some((l) => samplePath(r.id, l) === p.path)),
  ).map((p) => ({ name: p.name, path: p.path, status: p.status, once: true })),
]

/** Muster fürs gerenderte HTML: alle Inhaltsmuster, dazu Einbettungen/CAPTCHA/Tracker und vorbelegte Checkboxen. */
const HTML_PATTERNS: readonly ForbiddenPattern[] = [
  ...FORBIDDEN_CONTENT_PATTERNS,
  ...FORBIDDEN_SOURCE_PATTERNS.filter((p) => ['V-05', 'V-06', 'V-07'].includes(p.id)),
  {
    id: 'V-03',
    re: /<input\b(?=[^>]*\btype="checkbox")(?=[^>]*\schecked(?:=""|\s|\/?>))[^>]*>/iu,
  },
]

/** Treffer mit etwas Kontext (für eine lesbare Fehlermeldung). */
function scanHtml(html: string): string[] {
  const out: string[] = []
  for (const { id, re } of HTML_PATTERNS) {
    const global = new RegExp(re.source, re.flags.includes('g') ? re.flags : `${re.flags}g`)
    for (const m of html.matchAll(global)) {
      const from = Math.max(0, m.index - 40)
      out.push(
        `${id} „${m[0]}“ … ${html.slice(from, m.index + m[0].length + 40).replace(/\s+/g, ' ')}`,
      )
    }
  }
  return out
}

/** V-20 (RECHT §5): Streich-, Rabatt- und „statt“-Preise. */
const V20_HTML = /<del\b|<s>|<s\s|line-through/iu
const V20_TEXT = /\bstatt\b|\bUVP\b|\bSale\b|-\d+\s*%/iu
const LOREM = /\blorem\b/iu
const INSTAGRAM = /instagram\.com|ig\.me\/|cdninstagram|instagr\.am/iu

/**
 * Sichtbarer Text der Seite (ohne Skripte, Styles, JSON-LD und `<template>`), einmal mit und einmal ohne die Bausteine
 * mit Nachweis (`[data-legal-note]`, `[data-badge]` – dort dürfen belegte Aussagen wie „nickelfrei“ stehen, R-044/R-045).
 */
function visibleText(html: string): { all: string; withoutProof: string } {
  const $ = cheerio.load(html)
  $('script, style, noscript, template').remove()
  const all = $('body').text().replace(/\s+/g, ' ')
  $('[data-legal-note], [data-badge]').remove()
  return { all, withoutProof: $('body').text().replace(/\s+/g, ' ') }
}

/** R-139: Instagram-Adressen nur als `href` eines Links mit `rel="noopener noreferrer"` (und in JSON-LD `sameAs`). */
function instagramFindings(html: string): string[] {
  const $ = cheerio.load(html)
  const out: string[] = []
  $('*').each((_, node) => {
    const el = $(node)
    const tag = (node as { tagName?: string }).tagName?.toLowerCase() ?? ''
    for (const [attr, value] of Object.entries(
      (node as { attribs?: Record<string, string> }).attribs ?? {},
    )) {
      if (!INSTAGRAM.test(value)) continue
      const rel = (el.attr('rel') ?? '').split(/\s+/)
      if (tag === 'a' && attr === 'href' && rel.includes('noopener') && rel.includes('noreferrer'))
        continue
      out.push(`R-139 <${tag} ${attr}="${value}" rel="${el.attr('rel') ?? ''}">`)
    }
  })
  if (/instagram-media|instgrm|\/embed\.js/iu.test(html)) out.push('R-139 Instagram-Einbettung')
  return out
}

/** P3.16-Muster über sichtbaren Text und Markup (siehe Kopfkommentar). */
function scanP3(html: string): string[] {
  const text = visibleText(html)
  const out: string[] = []
  const hit = (id: string, re: RegExp, source: string) => {
    const m = re.exec(source)
    if (m) out.push(`${id} „${m[0]}“ … ${source.slice(Math.max(0, m.index - 40), m.index + 40)}`)
  }
  for (const rule of V13_UNPROVEN_CLAIMS) hit('V-13', rule.pattern, text.withoutProof)
  for (const rule of V16_THIRD_PARTY_MARKS) hit('V-16', rule.pattern, text.all)
  hit('V-20', V20_TEXT, text.all)
  hit('V-20', V20_HTML, html)
  hit('EK-09', LOREM, text.all)
  return [...out, ...instagramFindings(html)]
}

test('Registry: alle live-Routen sind im Verbotsmuster-Scan abgedeckt', () => {
  // Token-Seiten (R08, R09) scannen ihre eigenen Suiten mit Fixture-Bestellungen (`scanHtml`).
  const live = ROUTES.filter((r) => r.status === 'live' && (!r.paths || hasSamplePath(r))).map(
    (r) => r.id,
  )
  const covered = new Set(visits.map((v) => v.name.split(' ')[0]))
  expect(live.filter((id) => !covered.has(id))).toEqual([])
})

test('RECHT §5 Gegenprobe: OS-Link, „inkl. MwSt.“, Tracker und vorbelegte Checkbox werden im HTML erkannt', () => {
  const ids = (html: string) => scanHtml(html).map((f) => f.split(' ')[0])
  expect(ids('<a href="https://ec.europa.eu/consumers/odr/">Streitbeilegung</a>')).toEqual(['V-01'])
  expect(ids('<p>20,00 € inkl. MwSt.</p>')).toContain('V-02')
  expect(ids('<script src="https://www.googletagmanager.com/gtag/js"></script>')).toEqual(['V-07'])
  expect(ids('<input type="checkbox" name="news" checked="">')).toEqual(['V-03'])
  expect(ids('<input checked type="checkbox">')).toEqual(['V-03'])
  expect(ids('<input type="checkbox" name="agb" required="">')).toEqual([])
  expect(ids('<input type="radio" name="lang" checked="">')).toEqual([])
})

test('P3.16 Gegenprobe: V-13, V-16, V-20, Lorem und R-139 werden erkannt; Belege in Bausteinen sind erlaubt', () => {
  const ids = (html: string) =>
    scanP3(`<html><body>${html}</body></html>`).map((f) => f.split(' ')[0])
  expect(ids('<p>Spülmaschinenfest und bleifrei</p>')).toEqual(['V-13', 'V-13'])
  expect(
    ids('<p data-legal-note="jewelryNickel">Metallteile: Silber, nickelfrei (Nachweis)</p>'),
  ).toEqual([])
  expect(ids('<p>Dekorationsobjekt – nicht lebensmittelecht.</p>')).toEqual([])
  expect(ids('<p>Tasse mit Snoopy</p>')).toEqual(['V-16'])
  expect(ids('<p><del>59 €</del> 45 €</p>')).toEqual(['V-20'])
  expect(ids('<p>45 € statt 59 €</p>')).toEqual(['V-20'])
  expect(ids('<p>Werkstatt-Preis</p>')).toEqual([])
  expect(ids('<p>Lorem ipsum</p>')).toEqual(['EK-09'])
  expect(ids('<iframe src="https://www.instagram.com/p/abc/embed"></iframe>')).toEqual(['R-139'])
  expect(ids('<img src="https://scontent.cdninstagram.com/x.jpg">')).toEqual(['R-139'])
  expect(
    ids('<a href="https://www.instagram.com/planet.claire.tattoos/" rel="noopener">IG</a>'),
  ).toEqual(['R-139'])
  expect(
    ids(
      '<a href="https://www.instagram.com/planet.claire.tattoos/" rel="noopener noreferrer">IG</a>',
    ),
  ).toEqual([])
})

test('Steuermodus der Test-Datenbank ist Kleinunternehmer (Voraussetzung für V-02)', async () => {
  const payload = await testPayload()
  const settings = (await payload.findGlobal({ slug: 'settings', depth: 0 })) as TaxSettings
  expect(getTaxModeAt(settings, new Date())).toBe('kleinunternehmer')
})

for (const visit of visits) {
  test(`RECHT §5 V-01/V-02 kein Verbotsmuster im HTML: ${visit.name}`, async ({
    request,
  }, testInfo) => {
    if (visit.once) onlyOnce(testInfo.project.name)
    const res = await request.get(visit.path)
    expect(res.status(), visit.path).toBe(visit.status)
    const html = await res.text()
    expect(html.length, visit.path).toBeGreaterThan(500)
    expect(scanHtml(html), visit.path).toEqual([])
    // P3.16 auf allen Seiten: sichtbarer Text und Markup (V-13, V-16, V-20, EK-09, R-139).
    expect(scanP3(html), visit.path).toEqual([])
  })
}

for (const locale of LOCALES) {
  test(`RECHT §5 R-096 V-08 V-13 V-20 R-139 kein Verbotsmuster: R04 404-Variante „Schon ein Zuhause“ ${locale}`, async ({
    request,
    fixtureProducts,
  }, testInfo) => {
    onlyOnce(testInfo.project.name)
    const url = await homeVariant(fixtureProducts, request, locale)
    const res = await request.get(url)
    expect(res.status(), url).toBe(404)
    const html = await res.text()
    expect(scanHtml(html), url).toEqual([])
    expect(scanP3(html), url).toEqual([])
  })
}

test('R-096 R-139 V-08: auf keiner P3-Seite ein Widerrufsausschluss; Instagram nur als Link', async ({
  request,
}, testInfo) => {
  onlyOnce(testInfo.project.name)
  // Zusammenfassung für die Nachverfolgbarkeit (R-001): dieselben Prüfungen wie oben über alle P3-Seiten in einem Lauf.
  const v08 = FORBIDDEN_CONTENT_PATTERNS.find((p) => p.id === 'V-08')!
  const findings: string[] = []
  for (const p of P3_PAGES) {
    const res = await request.get(p.path)
    expect(res.status(), p.path).toBe(p.status)
    const html = await res.text()
    if (v08.re.test(html)) findings.push(`${p.path}: V-08`)
    findings.push(...instagramFindings(html).map((f) => `${p.path}: ${f}`))
  }
  expect(findings).toEqual([])
})

test.describe('V-31 Privatadresse nur im GPSR-Block der Produktseite (R04)', () => {
  for (const key of ['S01', 'S26'] as const) {
    for (const locale of LOCALES) {
      test(`V-31 R04 ${key} ${locale}: Straße aus settings.business nur in „Herstellerin & Sicherheit“`, async ({
        page,
        request,
      }) => {
        const payload = await testPayload()
        const { business } = (await payload.findGlobal({
          slug: 'settings',
          depth: 0,
          overrideAccess: true,
        })) as { business: { street: string } }
        expect(business.street.trim()).not.toBe('')
        await openProduct(page, request, ANCHORS[key][locale])
        await expect(page.locator('[data-product-safety]')).toContainText(business.street)
        const outside = await page.evaluate(() => {
          const clone = document.body.cloneNode(true) as HTMLElement
          clone.querySelectorAll('[data-product-safety], script').forEach((el) => el.remove())
          return clone.textContent ?? ''
        })
        expect(outside).not.toContain(business.street)
      })
    }
  }
})
