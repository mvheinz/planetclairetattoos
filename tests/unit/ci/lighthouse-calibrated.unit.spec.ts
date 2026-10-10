import { describe, expect, it } from 'vitest'

import {
  calibratedSlowdown,
  hardRuleHolds,
  median,
  routeMedians,
} from '../../../scripts/ci/lighthouse-calibrated'

// U-65 (P14.14): Lighthouse-Drosselung für die lokale Prüfschleuse (Lighthouse docs/throttling.md).
describe('scripts/ci/lighthouse-calibrated', () => {
  it('schneller Rechner (≥ Referenz): Standard 4×', () => {
    expect(calibratedSlowdown(1750)).toBe(4)
    expect(calibratedSlowdown(2400)).toBe(4)
  })
  it('langsamerer Rechner: proportional kleiner, auf 0,1 gerundet, nie unter 1×', () => {
    expect(calibratedSlowdown(1400)).toBe(3.2)
    expect(calibratedSlowdown(1000)).toBe(2.3)
    expect(calibratedSlowdown(200)).toBe(1)
  })
  it('ohne Messwert: Standard 4×', () => {
    expect(calibratedSlowdown(Number.NaN)).toBe(4)
  })
  it('Median', () => {
    expect(median([3, 1, 2])).toBe(2)
    expect(median([4, 1, 2, 3])).toBe(2.5)
  })
})

describe('harte Regel als Rückfall (CLAUDE.md §7)', () => {
  const lhr = (u: string, lcp: number, cls: number, tbt: number) => ({
    finalDisplayedUrl: u,
    audits: {
      'largest-contentful-paint': { numericValue: lcp },
      'cumulative-layout-shift': { numericValue: cls },
      'total-blocking-time': { numericValue: tbt },
    },
  })
  it('Mediane je Seite; eingehalten nur, wenn jede Seite LCP < 2500 und CLS < 0,1', () => {
    const m = routeMedians([
      lhr('/de', 2000, 0.01, 400),
      lhr('/de', 2600, 0.01, 300),
      lhr('/de', 2100, 0.02, 700),
    ])
    expect(m.get('/de')).toEqual({ lcp: 2100, cls: 0.01, tbt: 400 })
    expect(hardRuleHolds(m)).toBe(true)
    expect(hardRuleHolds(routeMedians([lhr('/de', 2600, 0, 0)]))).toBe(false)
    expect(hardRuleHolds(routeMedians([lhr('/de', 1000, 0.2, 0)]))).toBe(false)
    expect(hardRuleHolds(new Map())).toBe(false)
  })
})
