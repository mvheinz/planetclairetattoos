import { hasSamplePath, pageRoutes, samplePath } from '../../src/lib/routes/paths'
import { LOCALES, ROUTES } from '../../src/lib/routes/registry'
import { expect, test } from './fixtures'
import { expectPrivate } from './privacy/privacyHelpers'
import { holdListData } from './shop/fresh'
import { P3_PAGES, homeVariant } from './shop/p3Pages'

// P2.21 Datenschutz (ARCHITEKTUR §7.4 T-03/T-04, §8.7; RECHT R-130/R-131; KONZEPT EK-04/EK-05; DESIGN AK-DS-04):
// Jede Registry-Route mit Status `live` in DE und EN, in allen drei Projekten, jeweils in einem frischen Browser-Kontext
// (Playwright legt ihn je Test neu an). Ohne Nutzeraktion entsteht kein Endgeräte-Speicher (kein Cookie, kein
// `Set-Cookie`, kein Local/Session Storage, keine IndexedDB, kein Service Worker), und die Seite lädt nur vom eigenen
// Origin (plus `data:`/`blob:`). Die einzige Ausnahme vor dem Warenkorb – `localStorage['pc-motion']` nach Klick auf
// den Schalter „Animationen“ (R-130 a) – prüft `motion-toggle.e2e.spec.ts`. Ein CSP-Verstoß (Ereignis
// `securitypolicyviolation` oder CSP-Fehler auf der Konsole) lässt den Test ebenfalls scheitern (P3.16).
// P3.16 dehnt die Suite auf die Varianten und Zustände von R02–R05 aus (`P3_PAGES`: Listen-Varianten, jede Kategorie,
// Produktseite je Kategorie, reserviert, verkauft, 404-Varianten inkl. „Schon ein Zuhause“).

interface Visit {
  name: string
  path: string
  status: number
}

const visits: Visit[] = [
  // Token-Seiten (R08, R09) ohne Beispiel-Adresse: `privacy/p4-pages.e2e.spec.ts` mit Fixture-Bestellungen.
  ...pageRoutes()
    .filter((r) => r.status === 'live' && hasSamplePath(r))
    .flatMap((r) =>
      LOCALES.map((locale) => ({
        name: `${r.id} ${locale}`,
        path: samplePath(r.id, locale),
        status: 200,
      })),
    ),
  // Fehlerseiten und Weiterleitung (R28–R30) – ebenfalls `live` in der Registry.
  ...LOCALES.flatMap((locale) => [
    { name: `R28 ${locale}`, path: `/${locale}/gibt-es-nicht-${locale}`, status: 404 },
    { name: `R29 ${locale}`, path: `/${locale}/__fehler-test`, status: 500 },
  ]),
  { name: 'R30', path: '/', status: 200 },
  // Kurzlink (P3.7): 307 auf die Produktseite (S01), ebenfalls ohne Cookie.
  { name: 'R31', path: '/nr/901', status: 200 },
]

test('Registry: alle live-Routen sind abgedeckt @privacy', () => {
  const live = ROUTES.filter((r) => r.status === 'live' && (!r.paths || hasSamplePath(r))).map(
    (r) => r.id,
  )
  const covered = new Set(visits.map((v) => v.name.split(' ')[0]))
  expect(live.filter((id) => !covered.has(id))).toEqual([])
})

test.describe('Datenschutz: keine Cookies, kein Speicher, keine Fremd-Requests @privacy', () => {
  for (const visit of visits) {
    test(`R-130 R-131 T-03/T-04 ${visit.name} ${visit.path} @privacy`, async ({
      page,
      context,
      foreignRequests,
    }) => {
      await expectPrivate(page, context, foreignRequests, visit.path, visit.status)
    })
  }
})

test.describe('Datenschutz P3: Varianten und Zustände von R02–R05 @privacy', () => {
  // Je Route prüft die Suite oben alle drei Projekte; die Varianten und Zustände laufen in Chromium (desktop) und echtem
  // WebKit (iphone-15) – pixel-7 ist dieselbe Engine wie desktop (CI-Minuten, OFFENE-PUNKTE P3.16).
  test.beforeEach(({}, testInfo) => {
    test.skip(
      testInfo.project.name === 'pixel-7',
      'P3-Varianten: desktop (Chromium) und iphone-15 (WebKit)',
    )
  })
  // Seed-Anker (S06 verkauft, Listen) nicht während eines exklusiven Bestandstests lesen.
  holdListData(test, 'shared')

  for (const p of P3_PAGES) {
    test(`R-130 R-131 T-03/T-04 EK-04 EK-05 ${p.name} ${p.path} @privacy`, async ({
      page,
      context,
      foreignRequests,
    }) => {
      await expectPrivate(page, context, foreignRequests, p.path, p.status)
    })
  }

  for (const locale of LOCALES) {
    test(`R-130 R-131 T-03/T-04 R04 404-Variante „Schon ein Zuhause“ (Fixture analog S08) ${locale} @privacy`, async ({
      page,
      context,
      foreignRequests,
      fixtureProducts,
      request,
    }) => {
      const url = await homeVariant(fixtureProducts, request, locale)
      await expectPrivate(page, context, foreignRequests, url, 404)
      await expect(page.locator('[data-not-found]')).toHaveAttribute('data-variant', 'home')
    })
  }
})
