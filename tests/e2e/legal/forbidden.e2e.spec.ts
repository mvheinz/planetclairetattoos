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
import { holdShippingRates } from '../../helpers/adminSessionLock'
import { scanMail } from '../../helpers/mails'
import { readOutbox } from '../../helpers/outbox'
import { adminCall, adminLogin } from '../adminApi'
import { cleanupCheckouts } from '../checkout/checkoutHelpers'
import { expect, test, testPayload } from '../fixtures'
import * as h from '../purchase/purchaseHelpers'
import { holdListData } from '../shop/fresh'
import { P3_PAGES, homeVariant } from '../shop/p3Pages'
import { ANCHORS, openProduct, PUBLISHED } from '../shop/productPage'

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

// P6.13 (PLAN „Automatische Verbotsprüfungen“): weitere Muster über alle gecrawlten Seiten.
/** V-27: erlaubte Ziele externer Links (RECHT §5: Instagram, DHL-Sendungsverfolgung, EU-Infoseite, Schlichtungsstelle). */
export const EXTERNAL_LINK_ALLOWLIST: readonly { host: RegExp; reason: string }[] = [
  {
    host: /^(www\.)?instagram\.com$/,
    reason: 'Instagram-Profil als einfacher Link (E-51, R-139).',
  },
  { host: /^ig\.me$/, reason: 'Instagram-Direktnachricht (E-51).' },
  { host: /^www\.dhl\.de$/, reason: 'Sendungsverfolgung (R-082).' },
  {
    host: /^europa\.eu$/,
    reason: 'EU-Infoseite der harmonisierten Gewährleistungs-Mitteilung (R-049).',
  },
  {
    host: /^www\.universalschlichtungsstelle\.de$/,
    reason: 'Verbraucherschlichtung (§ 37 VSBG, R-112).',
  },
  {
    host: /^(www\.)?safer-tattoo\.de$/,
    reason: 'Safer-Tattoo-Infoseite (Tattoo-Bereich, RECHT V-27).',
  },
  {
    host: /^www\.bundesumweltministerium\.de$/,
    reason:
      'Safer-Tattoo-Checklisten des Bundesumweltministeriums auf R17 (KONZEPT §9.2, RECHT V-27).',
  },
]
/** V-31: Seiten, auf denen die Straße aus den Stammdaten stehen darf (Impressum, Rechtstexte, Konformitätserklärungen). */
export const STREET_ALLOWED_ROUTES: readonly { routeId: string; reason: string }[] = [
  { routeId: 'R21', reason: 'Impressum (§ 5 DDG).' },
  { routeId: 'R22', reason: 'Datenschutzerklärung: Verantwortliche (Art. 13 DSGVO).' },
  { routeId: 'R23', reason: 'AGB: Anbieterin.' },
  { routeId: 'R24', reason: 'Widerrufsbelehrung und Muster-Formular: Adressatin des Widerrufs.' },
  { routeId: 'R25', reason: 'Versand & Zahlung (Rechtstext): Abholung/Rücksendung.' },
  { routeId: 'R27', reason: 'Konformitätserklärungen: Herstellerangaben (GPSR).' },
  {
    routeId: 'R19',
    reason: 'Über mich: Kontaktblock mit Anschrift (U-46, Juttas Wunsch 08.10.2026).',
  },
  { routeId: 'R20', reason: 'Kontakt: Anschrift (U-46, Juttas Wunsch 08.10.2026).' },
]
const V11_PAGE =
  /(innerhalb|binnen)\s+(von\s+)?\d+\s+Tag(en)?.{0,60}(sonst|andernfalls|ausgeschlossen|erlischt|verfällt)/iu
const V18_PAGE = /Garantie|garantiert/iu

let street: Promise<string> | undefined
const businessStreet = () =>
  (street ??= testPayload()
    .then((payload) => payload.findGlobal({ slug: 'settings', depth: 0, overrideAccess: true }))
    .then((s) => ((s as { business?: { street?: string } }).business?.street ?? '').trim()))

/** P6.13-Muster: V-11/V-18 im sichtbaren Text, V-27 externe Links, V-28 Audio, V-31 Straße außerhalb der Pflichtorte. */
function scanP6(html: string, routeId: string, streetName: string): string[] {
  const out: string[] = []
  const text = visibleText(html).all
  if (V11_PAGE.test(text)) out.push('V-11 Rügefrist')
  const g = V18_PAGE.exec(text)
  if (g) out.push(`V-18 „${g[0]}“ … ${text.slice(Math.max(0, g.index - 40), g.index + 40)}`)
  const $ = cheerio.load(html)
  $('a[href]').each((_, a) => {
    const href = $(a).attr('href') ?? ''
    if (!/^https?:\/\//i.test(href)) return
    const host = new URL(href).hostname
    if (/^(localhost|127\.0\.0\.1)$|(^|\.)planetclairetattoos\.com$/.test(host)) return
    if (!EXTERNAL_LINK_ALLOWLIST.some((e) => e.host.test(host))) out.push(`V-27 ${href}`)
  })
  if ($('audio').length > 0 || /<audio\b/i.test(html)) out.push('V-28 audio')
  if (streetName && !STREET_ALLOWED_ROUTES.some((r) => r.routeId === routeId)) {
    const $$ = cheerio.load(html)
    // Die Rechtstext-Dialoge der Kasse (`LegalNotice`) zeigen AGB, Belehrung und Datenschutz mit der Anbieter-Anschrift:
    // Rechtstexte sind ein Pflichtort (V-31), also keine Fundstelle.
    $$(
      'script, style, noscript, template, [data-product-safety], [data-legal-dialog-panel]',
    ).remove()
    if ($$('body').text().includes(streetName)) out.push(`V-31 Straße „${streetName}“`)
  }
  return out
}

test('V-27 V-28 V-31 V-11 V-18 Gegenprobe: Fremdlink, Audio, Straße, Rügefrist und „Garantie“ werden erkannt', () => {
  const page = (body: string) => `<html><body>${body}</body></html>`
  const ids = (body: string, route = 'R01') =>
    scanP6(page(body), route, 'Werkstattweg 7').map((f) => f.split(' ')[0])
  expect(ids('<a href="https://mystaelectric.com/">Link</a>')).toEqual(['V-27'])
  expect(ids('<a href="https://www.instagram.com/planet.claire.tattoos/">IG</a>')).toEqual([])
  expect(ids('<audio src="/planet-claire.mp3"></audio>')).toEqual(['V-28'])
  expect(ids('<p>Werkstattweg 7, 10999 Berlin</p>')).toEqual(['V-31'])
  expect(ids('<p>Werkstattweg 7, 10999 Berlin</p>', 'R21')).toEqual([])
  expect(ids('<div data-product-safety><p>Werkstattweg 7</p></div>', 'R04')).toEqual([])
  expect(ids('<p>Mängel innerhalb von 7 Tagen melden, sonst erlischt der Anspruch.</p>')).toEqual([
    'V-11',
  ])
  expect(ids('<p>2 Jahre Garantie</p>')).toEqual(['V-18'])
})

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
  test(`V-01 V-02 V-03 V-05–V-08 V-10–V-21 V-26–V-28 V-31 kein Verbotsmuster im HTML: ${visit.name}`, async ({
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
    // P6.13: V-11, V-18, V-27 (externe Links nur aus der Allowlist), V-28 (kein Audio), V-31 (Straße nur an Pflichtorten).
    expect(scanP6(html, visit.name.split(' ')[0]!, await businessStreet()), visit.path).toEqual([])
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

// P4.25 Verbotsmuster über die Seiten der Phase P4 und die dabei gerenderten Mails (RECHT §5): Korb gefüllt, Kasse (auch
// mit Fehlern), Danke-Seiten (bezahlt, Vorkasse), Bestellstatus, dazu M01/M02/M04/M05 und die Verwaltungsmails aus
// echten Kaufwegen (Mock, Vorkasse, Verwaltung „Zahlung erhalten“/„Stornieren“ über die Admin-Endpunkte).
// Seiten: V-01, V-02, V-03, V-17, V-21 (Inhaltsmuster), V-11 (Rügefristen), V-22 (keine Eingaben in URLs), V-23 (keine
// Zahlungsdaten der Kundin im Formular), V-31 (Privatstraße nie auf Korb, Kasse, Danke, Status). Mails: dieselben
// Inhaltsmuster, V-09 (Werbung/Tracking, `scanMail`), V-11; die Anbieterkennung mit Straße im Mail-Fuß ist laut V-31 ein
// Pflichtort (R-080) und muss dort stehen. V-17: Countdown nur auf Kasse und Korb (Allowlist unten).

/** V-17-Allowlist: Seiten, auf denen der Reservierungs-Countdown stehen darf. */
export const COUNTDOWN_ALLOWLIST: readonly { routeId: string; reason: string }[] = [
  { routeId: 'R07', reason: 'Kasse: echte Reservierung dieser Person (KO-15, KONZEPT §4.6).' },
  {
    routeId: 'R06',
    reason: 'Countdown im Korb = dieselbe echte Reservierung wie in der Kasse, KO-13.',
  },
]

const V11_RE =
  /(innerhalb|binnen)\s+(von\s+)?\d+\s+Tag(en)?.{0,60}(sonst|andernfalls|ausgeschlossen|erlischt|verfällt)/iu
/** V-23: Eingabefelder für Zahlungsdaten der Kundin (IBAN, Kartennummer, Prüfziffer). */
const V23_FIELDS =
  /<input\b[^>]*\bname="[^"]*(iban|cardNumber|creditCard|card_number|cvc|cvv)[^"]*"/iu

test.describe('P4.25 Verbotsmuster: Korb, Kasse, Danke, Status und Mails', () => {
  test.describe.configure({ timeout: 180_000 })

  test('RECHT §5 V-01 V-02 V-03 V-09 V-11 V-17 V-21 V-22 V-23 V-31 R-080 auf P4-Seiten und in den gerenderten Mails', async ({
    page,
    context,
    request,
    fixtureProducts,
  }, testInfo) => {
    onlyOnce(testInfo.project.name)
    // Nur Mails dieses Laufs (der Postausgang bleibt über Läufe hinweg stehen; IDs wiederholen sich nach `db:reset`).
    const startedAt = new Date(Date.now() - 1000).toISOString()
    const release = await holdShippingRates('shared')
    const pieces: number[] = []
    const pages: { id: string; url: string; html: string }[] = []
    const capture = async (id: string) =>
      pages.push({ id, url: page.url(), html: await page.content() })
    try {
      const payload = await testPayload()
      const { business } = (await payload.findGlobal({
        slug: 'settings',
        depth: 0,
        overrideAccess: true,
      })) as { business: { street: string } }
      const street = business.street.trim()
      expect(street).not.toBe('')

      // Kaufweg 1: Karte „Erfolg“ – Korb, Kasse (leer und mit Fehlern), Danke „bezahlt“, Bestellstatus.
      const a = await fixtureProducts.create('keramik', { ...PUBLISHED, priceCents: 4500 })
      pieces.push(a.id)
      const b1 = await h.buyer(context, page)
      await h.addToCartFromProduct(page, request, a.itemNumber)
      await capture('R06')
      const t1 = await h.goToCheckout(context, page)
      await capture('R07')
      await h.orderButton(page).click()
      await expect(page.locator('[data-error-summary]')).toBeFocused()
      await capture('R07')
      await h.fillShipping(page, b1.email)
      await h.choosePayment(page, 'stripe')
      await h.chooseMock(page, 'success', 'card')
      await expect(await h.orderAndThank(page, t1)).toHaveAttribute('data-thanks-state', 'paid')
      await capture('R08')
      await page.getByRole('link', { name: 'Bestellstatus ansehen' }).click()
      await expect(page).toHaveURL(/\/de\/bestellung\/[A-Za-z0-9_-]{43}$/)
      await capture('R09')

      // Kaufweg 2 und 3: Vorkasse – Danke „Vorkasse“, dann „Zahlung erhalten“ (M05) bzw. „Stornieren“ (M04).
      const vorkasse: { email: string; orderId: number; totalCents: number }[] = []
      for (const n of [0, 1]) {
        const p = await fixtureProducts.create('keramik', { ...PUBLISHED, priceCents: 4500 })
        pieces.push(p.id)
        await context.clearCookies()
        const bn = await h.buyer(context, page)
        await h.addToCartFromProduct(page, request, p.itemNumber)
        const t = await h.goToCheckout(context, page)
        await h.fillShipping(page, bn.email)
        await h.choosePayment(page, 'prepayment')
        await expect(await h.orderAndThank(page, t)).toHaveAttribute(
          'data-thanks-state',
          'prepayment',
        )
        if (n === 0) {
          await capture('R08')
          await page.getByRole('link', { name: 'Bestellstatus ansehen' }).click()
          await expect(page).toHaveURL(/\/de\/bestellung\//)
          await capture('R09')
        }
        const [order] = await h.ordersOf([p.id])
        vorkasse.push({ email: bn.email, orderId: order!.id, totalCents: 5390 })
      }
      const admin = await adminLogin()
      try {
        await adminCall(
          request,
          admin,
          'post',
          `/orders/${vorkasse[0]!.orderId}/prepayment-received`,
          {
            amountCents: vorkasse[0]!.totalCents,
          },
        )
        await adminCall(request, admin, 'post', `/orders/${vorkasse[1]!.orderId}/cancel`, {
          reason: 'Test: Stück doch nicht verfügbar',
        })
      } finally {
        await admin.release()
      }

      // Seiten: Inhaltsmuster, V-11, V-23, V-31, V-17 (Countdown nur laut Allowlist), V-22 (URLs ohne Eingaben).
      const allowed = new Set(COUNTDOWN_ALLOWLIST.map((e) => e.routeId))
      const findings: string[] = []
      for (const p of pages) {
        for (const f of scanHtml(p.html)) findings.push(`${p.id} ${p.url}: ${f}`)
        const text = visibleText(p.html).all
        if (V11_RE.test(text)) findings.push(`${p.id}: V-11`)
        if (V23_FIELDS.test(p.html)) findings.push(`${p.id}: V-23`)
        const $street = cheerio.load(p.html)
        // Rechtstext-Dialoge der Kasse (Pflichtort Rechtstexte, V-31) ausgenommen
        $street('script, style, noscript, template, [data-legal-dialog-panel]').remove()
        if ($street('body').text().replace(/\s+/g, ' ').includes(street))
          findings.push(`${p.id}: V-31 Straße „${street}“`)
        if (!allowed.has(p.id) && /data-countdown=/.test(p.html))
          findings.push(`${p.id}: V-17 Countdown außerhalb der Allowlist`)
        if (/%40|@|Erika|Musterstra|10115/i.test(decodeURIComponent(p.url)))
          findings.push(`${p.id}: V-22 Eingabe in der URL ${p.url}`)
      }
      expect(pages.map((p) => p.id)).toEqual(['R06', 'R07', 'R07', 'R08', 'R09', 'R08', 'R09'])
      expect(pages.filter((p) => p.id === 'R07').every((p) => /data-countdown=/.test(p.html))).toBe(
        true,
      )
      expect(findings).toEqual([])

      // Mails der Kundinnen (M01, M02, M05, M04) und die Verwaltungsmails dieser Bestellungen.
      const want: Record<string, string[]> = {
        [b1.email]: ['order_confirmation'],
        [vorkasse[0]!.email]: ['prepayment_instructions', 'prepayment_received'],
        [vorkasse[1]!.email]: ['prepayment_cancelled', 'prepayment_instructions'],
      }
      // Links der Mails baut der Server aus NEXT_PUBLIC_SITE_URL (unabhängig vom Port des Testservers).
      const site = process.env.NEXT_PUBLIC_SITE_URL || new URL(page.url()).origin
      const mailFindings: string[] = []
      for (const [email, types] of Object.entries(want)) {
        await expect
          .poll(async () => (await readOutbox({ to: email })).map((r) => r.type).sort(), {
            timeout: 15_000,
          })
          .toEqual(types)
        for (const m of await readOutbox({ to: email })) {
          const html = m.html ?? ''
          const text = m.text ?? ''
          for (const f of scanMail({ html, text }, site)) mailFindings.push(`${m.type}: ${f}`)
          for (const f of FORBIDDEN_CONTENT_PATTERNS.filter((x) => ['V-17', 'V-21'].includes(x.id)))
            if (f.re.test(`${html}\n${text}`)) mailFindings.push(`${m.type}: ${f.id}`)
          if (V11_RE.test(text)) mailFindings.push(`${m.type}: V-11`)
          // R-080 / V-31: die Anbieterkennung mit Straße steht im Fuß jeder Kundenmail (Pflichtort).
          if (!text.includes(street)) mailFindings.push(`${m.type}: R-080 Anbieterkennung fehlt`)
        }
      }
      const orderIds = [(await h.ordersOf([a.id]))[0]!.id, ...vorkasse.map((v) => v.orderId)]
      const adminMails = (await readOutbox()).filter(
        (m) =>
          m.date >= startedAt &&
          m.type.startsWith('admin_') &&
          orderIds.some((id) => m.idempotencyKey.includes(`:${id}:`)),
      )
      expect(adminMails.map((m) => m.type).sort()).toEqual(
        expect.arrayContaining(['admin_order_placed']),
      )
      for (const m of adminMails)
        for (const f of scanMail({ html: m.html ?? '', text: m.text ?? '' }, site))
          mailFindings.push(`${m.type}: ${f}`)
      expect(mailFindings).toEqual([])
    } finally {
      await cleanupCheckouts(pieces)
      await release()
    }
  })
})
