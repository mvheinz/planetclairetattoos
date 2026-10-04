// Lighthouse-CI (ARCHITEKTUR §7.7, PLAN P2.23 / T-10, KONZEPT EK-01): Preset mobil (Lighthouse-Standard:
// formFactor mobile, simulierte Drosselung), Median aus 3 Läufen, nur Kategorie Leistung. Grenzen aus
// tests/perf/budgets.json: Gates (`error`) blockieren, Ziele (`warn`) werden nur berichtet.
//
// Datenschutz/Fremddienste: Bericht nur ins Dateisystem (`upload.target: 'filesystem'`, kein
// `temporary-public-storage`), Chromium aus der Playwright-Installation (`chromePath`), Hintergrund-Netz von Chrome aus.
// Server: LHCI startet `scripts/perf/serve-h2.mjs` – `next start` auf Port 3100 hinter einem HTTP/2-TLS-Vorschaltserver
// auf Port 3000 (wie die Produktion; ARCHITEKTUR §7.7, OFFENE-PUNKTE „P5 CI“). Produktions-Build vorher: `pnpm build`;
// beide Ports müssen frei sein. Das Zertifikat ist selbstsigniert – nur hier `--ignore-certificate-errors`.

const { chromium } = require('@playwright/test')

const budgets = require('./budgets.json')

/**
 * Pfade je Routen-ID (DE, wie in src/lib/routes/registry.ts; ein Unit-Test prüft die Übereinstimmung). R04 misst die
 * Produktseite des Seed-Ankers S01 (verfügbar, zwei Fotos) – dieselbe Beispiel-Adresse wie `samplePath('R04', 'de')`.
 */
const ROUTE_PATHS = {
  R01: '/de',
  R02: '/de/shop',
  R04: '/de/shop/901-schale-langohr-wuschel',
  R11: '/de/tattoo',
}

const baseURL = `https://localhost:${process.env.PERF_PORT || 3000}`
const urls = budgets.lighthouse.routes.map((id) => {
  const p = ROUTE_PATHS[id]
  if (!p) throw new Error(`lighthouserc: kein Pfad für ${id}`)
  return `${baseURL}${p}`
})

const lh = budgets.lighthouse

/** Seitengewicht (`total-byte-weight`) nur für Routen mit eigenem Budget (ARCHITEKTUR §7.7: R01). */
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const weighted = lh.routes
  .filter((id) => budgets.pageWeight[id])
  .map((id) => ({
    pattern: `^${escapeRegex(`${baseURL}${ROUTE_PATHS[id]}`)}$`,
    weight: budgets.pageWeight[id],
  }))

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
      startServerCommand: 'node scripts/perf/serve-h2.mjs',
      startServerReadyPattern: 'HTTP/2-Vorschaltserver bereit',
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
          // Selbstsigniertes Zertifikat des HTTP/2-Vorschaltservers (nur localhost, nur Lighthouse).
          '--ignore-certificate-errors',
        ].join(' '),
      },
    },
    assert: {
      assertMatrix: [
        { matchingUrlPattern: '.*', assertions: assertions('error', 'max') },
        { matchingUrlPattern: '.*', assertions: assertions('warn', 'target') },
        ...weighted.flatMap(({ pattern, weight }) => [
          {
            matchingUrlPattern: pattern,
            assertions: {
              'total-byte-weight': [
                'error',
                { maxNumericValue: weight.max, aggregationMethod: 'median' },
              ],
            },
          },
          {
            matchingUrlPattern: pattern,
            assertions: {
              'total-byte-weight': [
                'warn',
                { maxNumericValue: weight.target, aggregationMethod: 'median' },
              ],
            },
          },
        ]),
      ],
    },
    upload: {
      target: 'filesystem',
      outputDir: '.lighthouseci/reports',
    },
  },
}
