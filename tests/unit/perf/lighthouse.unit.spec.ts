import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'

import { describe, expect, it } from 'vitest'

import { loadBudgets } from '../../../scripts/check-bundle'
import { buildReport, median, verdict } from '../../../scripts/perf/lighthouse-report'
import { localizedPath, samplePath } from '../../../src/lib/routes/paths'

// P2.23 Lighthouse-CI (ARCHITEKTUR §7.7, T-10): Konfiguration ohne Fremddienste, Grenzen aus budgets.json, Bericht.

const require = createRequire(import.meta.url)
const budgets = loadBudgets()

interface LhciConfig {
  ci: {
    collect: {
      url: string[]
      numberOfRuns: number
      chromePath: string
      startServerCommand: string
      startServerReadyPattern: string
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

  it('misst über HTTP/2 wie die Produktion: Vorschaltserver vor next start, https, Zertifikat nur hier ignoriert', () => {
    expect(config.ci.collect.startServerCommand).toBe('node scripts/perf/serve-h2.mjs')
    const server = readFileSync('scripts/perf/serve-h2.mjs', 'utf8')
    expect(server).toContain('http2')
    expect(server).toContain('allowHTTP1: true')
    expect(server).toContain(config.ci.collect.startServerReadyPattern)
    expect(config.ci.collect.url.every((u) => new URL(u).protocol === 'https:')).toBe(true)
    expect(config.ci.collect.settings.chromeFlags).toMatch(/--ignore-certificate-errors/)
  })

  it('Preset mobil (Lighthouse-Standard, kein desktop-Preset), Median aus 3 Läufen, Seiten R01, R02, R04 (P3.16)', () => {
    expect(config.ci.collect.settings.preset).toBeUndefined()
    expect(config.ci.collect.numberOfRuns).toBe(3)
    expect(config.ci.collect.url.map((u) => new URL(u).pathname)).toEqual([
      localizedPath('R01', 'de'),
      localizedPath('R02', 'de'),
      samplePath('R04', 'de'),
    ])
  })

  it('EK-01 Gates (error) auf allen Seiten: LCP ≤ 2,5 s, CLS ≤ 0,1, TBT ≤ 200 ms; Gewicht ≤ 1,5 MB nur R01; Ziele nur warn', () => {
    const [gates, targets, weightGate, weightTarget] = config.ci.assert.assertMatrix as {
      matchingUrlPattern: string
      assertions: Record<string, [string, Record<string, unknown>]>
    }[]
    expect(gates!.matchingUrlPattern).toBe('.*')
    expect(gates!.assertions).toEqual({
      'largest-contentful-paint': ['error', { maxNumericValue: 2500, aggregationMethod: 'median' }],
      'cumulative-layout-shift': ['error', { maxNumericValue: 0.1, aggregationMethod: 'median' }],
      'total-blocking-time': ['error', { maxNumericValue: 200, aggregationMethod: 'median' }],
    })
    expect(Object.values(targets!.assertions).every(([level]) => level === 'warn')).toBe(true)
    expect(targets!.assertions['largest-contentful-paint']![1]).toMatchObject({
      maxNumericValue: 2000,
    })
    // Seitengewicht nur für R01 (ARCHITEKTUR §7.7).
    const r01 = new RegExp(weightGate!.matchingUrlPattern)
    expect(
      config.ci.collect.url.filter((u) => r01.test(u)).map((u) => new URL(u).pathname),
    ).toEqual(['/de'])
    expect(weightGate!.assertions).toEqual({
      'total-byte-weight': ['error', { maxNumericValue: 1_500_000, aggregationMethod: 'median' }],
    })
    expect(weightTarget!.assertions['total-byte-weight']![0]).toBe('warn')
    expect(config.ci.assert.assertMatrix).toHaveLength(4)
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
    expect(rows[2]).toMatch(/\/de \(R01\) \(3 Läufe\) \| LCP \| 2300 ms .*Ziel verfehlt/)
    expect(rows.join('\n')).toMatch(/Seitengewicht \| 0\.30 MB \| ≤ 1\.50 MB/)
    // R04 ohne Gewichts-Budget: Seitengewicht nur als Bericht.
    const product = buildReport(
      [{ ...run(2000), url: `http://localhost:3000${samplePath('R04', 'de')}` }],
      budgets,
    )
    expect(product.join('\n')).toMatch(
      /\(R04\).*Seitengewicht \| 0\.30 MB \| – \| – \| nur Bericht/,
    )
  })
})
