// Lighthouse-CI (ARCHITEKTUR §7.7, PLAN P2.23 / T-10, KONZEPT EK-01): Preset mobil (Lighthouse-Standard:
// formFactor mobile, simulierte Drosselung), Median aus 3 Läufen, nur Kategorie Leistung. Grenzen aus
// tests/perf/budgets.json: Gates (`error`) blockieren, Ziele (`warn`) werden nur berichtet.
//
// Datenschutz/Fremddienste: Bericht nur ins Dateisystem (`upload.target: 'filesystem'`, kein
// `temporary-public-storage`), Chromium aus der Playwright-Installation (`chromePath`), Hintergrund-Netz von Chrome aus.
// Server: LHCI startet selbst `pnpm start` auf Port 3000 (Produktions-Build vorher: `pnpm build`; Port muss frei sein).

const { chromium } = require('@playwright/test')

const budgets = require('./budgets.json')

/** Pfade je Routen-ID (DE, wie in src/lib/routes/registry.ts; ein Unit-Test prüft die Übereinstimmung). */
const ROUTE_PATHS = { R01: '/de' }

const baseURL = 'http://localhost:3000'
const urls = budgets.lighthouse.routes.map((id) => {
  const p = ROUTE_PATHS[id]
  if (!p) throw new Error(`lighthouserc: kein Pfad für ${id}`)
  return `${baseURL}${p}`
})

const lh = budgets.lighthouse
const weight = budgets.pageWeight.R01

/** @param {'max' | 'target'} key */
const numeric = (key) => ({
  'largest-contentful-paint': { maxNumericValue: lh.lcpMs[key] },
  'cumulative-layout-shift': { maxNumericValue: lh.cls[key] },
  'total-blocking-time': { maxNumericValue: lh.tbtMs[key] },
})

/** @param {'error' | 'warn'} level @param {'max' | 'target'} key */
const assertions = (level, key) =>
  Object.fromEntries(
    Object.entries(numeric(key)).map(([audit, opts]) => [
      audit,
      [level, { ...opts, aggregationMethod: 'median' }],
    ]),
  )

module.exports = {
  ci: {
    collect: {
      url: urls,
      numberOfRuns: lh.runs,
      chromePath: chromium.executablePath(),
      startServerCommand: 'pnpm start',
      startServerReadyPattern: 'Ready',
      startServerReadyTimeout: 120000,
      settings: {
        onlyCategories: ['performance'],
        // Kein Netz außer zur eigenen Seite: Hintergrunddienste von Chrome aus.
        chromeFlags: [
          '--headless=new',
          '--no-sandbox',
          '--disable-background-networking',
          '--disable-component-update',
          '--disable-default-apps',
          '--disable-sync',
          '--disable-domain-reliability',
          '--disable-client-side-phishing-detection',
          '--no-first-run',
          '--no-default-browser-check',
          '--metrics-recording-only',
        ].join(' '),
      },
    },
    assert: {
      assertMatrix: [
        {
          matchingUrlPattern: '.*',
          assertions: {
            ...assertions('error', 'max'),
            'total-byte-weight': [
              'error',
              { maxNumericValue: weight.max, aggregationMethod: 'median' },
            ],
          },
        },
        {
          matchingUrlPattern: '.*',
          assertions: {
            ...assertions('warn', 'target'),
            'total-byte-weight': [
              'warn',
              { maxNumericValue: weight.target, aggregationMethod: 'median' },
            ],
          },
        },
      ],
    },
    upload: {
      target: 'filesystem',
      outputDir: '.lighthouseci/reports',
    },
  },
}
