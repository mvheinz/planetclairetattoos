import { pageRoutes, samplePath } from '../../../src/lib/routes/paths'
import { LOCALES, ROUTES } from '../../../src/lib/routes/registry'
import { getTaxModeAt, type TaxSettings } from '../../../src/lib/tax'
import {
  FORBIDDEN_CONTENT_PATTERNS,
  FORBIDDEN_SOURCE_PATTERNS,
  type ForbiddenPattern,
} from '../../helpers/forbiddenPatterns'
import { expect, test, testPayload } from '../fixtures'

// P2.29 (RECHT §5, ergänzt den Quelltext-Scan `tests/unit/legal/forbidden.unit.spec.ts`): Verbotsmuster im gerenderten
// HTML aller `live`-Routen der Registry in DE und EN – z. B. kein Link/Text zur OS-Plattform (V-01), kein „inkl. MwSt.“
// im Kleinunternehmer-Modus (V-02), keine Einbettungen, CAPTCHAs oder Tracker (V-05–V-07), kein vorangekreuztes
// Häkchen (V-03). Geprüft wird der vollständige HTML-Quelltext der Antwort (sichtbarer Text, Attribute, eingebettete
// Daten). Dateiname laut ANFORDERUNGEN §5 (PLAN P2.29 nennt `forbidden-html.e2e.spec.ts`; spätere Aufgaben erweitern
// diese Datei um weitere Seitentypen und die Mail-Vorlagen). Bisher braucht das gerenderte HTML keine Allowlist.

interface Visit {
  name: string
  path: string
  status: number
}

const visits: Visit[] = [
  ...pageRoutes()
    .filter((r) => r.status === 'live')
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

test('Registry: alle live-Routen sind im Verbotsmuster-Scan abgedeckt', () => {
  const live = ROUTES.filter((r) => r.status === 'live').map((r) => r.id)
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

test('Steuermodus der Test-Datenbank ist Kleinunternehmer (Voraussetzung für V-02)', async () => {
  const payload = await testPayload()
  const settings = (await payload.findGlobal({ slug: 'settings', depth: 0 })) as TaxSettings
  expect(getTaxModeAt(settings, new Date())).toBe('kleinunternehmer')
})

for (const visit of visits) {
  test(`RECHT §5 V-01/V-02 kein Verbotsmuster im HTML: ${visit.name}`, async ({ request }) => {
    const res = await request.get(visit.path)
    expect(res.status(), visit.path).toBe(visit.status)
    const html = await res.text()
    expect(html.length, visit.path).toBeGreaterThan(500)
    expect(scanHtml(html), visit.path).toEqual([])
  })
}
