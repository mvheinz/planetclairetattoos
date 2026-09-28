import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'

import { describe, expect, it } from 'vitest'

import { loadBudgets } from '../../../scripts/check-bundle'
import { buildReport, median, verdict } from '../../../scripts/perf/lighthouse-report'
import { localizedPath } from '../../../src/lib/routes/paths'

// P2.23 Lighthouse-CI (ARCHITEKTUR §7.7, T-10): Konfiguration ohne Fremddienste, Grenzen aus budgets.json, Bericht.

const require = createRequire(import.meta.url)
const budgets = loadBudgets()

interface LhciConfig {
  ci: {
    collect: {
      url: string[]
      numberOfRuns: number
      chromePath: string
      settings: { onlyCategories: string[]; chromeFlags: string; preset?: string }
    }
    assert: { assertMatrix: { assertions: Record<string, [string, Record<string, unknown>]> }[] }
    upload: { target: string; outputDir: string }
  }
}
const config = require('../../perf/lighthouserc.cjs') as LhciConfig

describe('T-10 tests/perf/lighthouserc.cjs', () => {
  it('Bericht nur ins Dateisystem, Chromium aus Playwright, @lhci/cli exakt gepinnt', () => {
    expect(config.ci.upload.target).toBe('filesystem')
    expect(readFileSync('tests/perf/lighthouserc.cjs', 'utf8')).not.toMatch(
      /target:\s*'temporary-public-storage'|serverBaseUrl/,
    )
    expect(config.ci.collect.chromePath).toMatch(/ms-playwright|chrom/i)
    expect(config.ci.collect.settings.chromeFlags).toMatch(/--disable-background-networking/)
    const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as {
      devDependencies: Record<string, string>
      scripts: Record<string, string>
    }
    expect(pkg.devDependencies['@lhci/cli']).toMatch(/^\d+\.\d+\.\d+$/)
    expect(pkg.scripts['test:perf']).toMatch(/lhci collect .*lhci upload .*lhci assert/)
  })

  it('Preset mobil (Lighthouse-Standard, kein desktop-Preset), Median aus 3 Läufen, Seiten P2: R01', () => {
    expect(config.ci.collect.settings.preset).toBeUndefined()
    expect(config.ci.collect.numberOfRuns).toBe(3)
    expect(config.ci.collect.url.map((u) => new URL(u).pathname)).toEqual([
      localizedPath('R01', 'de'),
    ])
  })

  it('Gates (error): LCP ≤ 2,5 s, CLS ≤ 0,1, TBT ≤ 200 ms, Gewicht ≤ 1,5 MB; Ziele nur warn', () => {
    const [gates, targets] = config.ci.assert.assertMatrix
    expect(gates!.assertions).toEqual({
      'largest-contentful-paint': ['error', { maxNumericValue: 2500, aggregationMethod: 'median' }],
      'cumulative-layout-shift': ['error', { maxNumericValue: 0.1, aggregationMethod: 'median' }],
      'total-blocking-time': ['error', { maxNumericValue: 200, aggregationMethod: 'median' }],
      'total-byte-weight': ['error', { maxNumericValue: 1_500_000, aggregationMethod: 'median' }],
    })
    expect(Object.values(targets!.assertions).every(([level]) => level === 'warn')).toBe(true)
    expect(targets!.assertions['largest-contentful-paint']![1]).toMatchObject({
      maxNumericValue: 2000,
    })
  })
})

describe('T-10 Lighthouse-Bericht', () => {
  it('Median und Einstufung Gate/Ziel', () => {
    expect(median([3, 1, 2])).toBe(2)
    expect(median([1, 2, 3, 4])).toBe(2.5)
    expect(verdict(1900, budgets.lighthouse.lcpMs)).toBe('Ziel erreicht')
    expect(verdict(2200, budgets.lighthouse.lcpMs)).toBe('Gate eingehalten, Ziel verfehlt')
    expect(verdict(2600, budgets.lighthouse.lcpMs)).toBe('GATE ÜBERSCHRITTEN')
  })

  it('Tabelle je Seite mit LCP, CLS, TBT und Seitengewicht', () => {
    const run = (lcp: number) => ({
      url: 'http://localhost:3000/de',
      audits: {
        'largest-contentful-paint': lcp,
        'cumulative-layout-shift': 0,
        'total-blocking-time': 100,
        'total-byte-weight': 300_000,
      },
    })
    const rows = buildReport([run(1800), run(2300), run(2700)], budgets)
    expect(rows).toHaveLength(2 + 4)
    expect(rows[2]).toMatch(/\/de \(3 Läufe\) \| LCP \| 2300 ms .*Ziel verfehlt/)
    expect(rows.join('\n')).toMatch(/Seitengewicht \| 0\.30 MB/)
  })
})
