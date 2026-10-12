import { describe, expect, it } from 'vitest'

import { FRESH_DAYS, LAUNCH_GRACE_HOURS, freshFor, isFreshInShop } from '@/lib/shop/fresh'
import { freshStampAngle, stampAngle } from '@/lib/shop/priceTag'

// V-60 (U-93, P20.3): Stempel „frisch im Shop“ – höchstens 14 Tage seit dem ersten Online-Stellen, ohne die Erstbefüllung
// in den ersten 48 Stunden nach dem allerersten `firstPublishedAt` des Shops.

const START = '2026-11-01T10:00:00.000Z'
const NOW = new Date('2026-12-15T12:00:00.000Z')
const ctx = { now: NOW, shopStartedAt: START }
const daysAgo = (d: number, base = NOW) => new Date(base.getTime() - d * 86_400_000).toISOString()

describe('isFreshInShop (V-60)', () => {
  it('Regelwerte: 14 Tage, 48 Stunden Erstbefüllung', () => {
    expect(FRESH_DAYS).toBe(14)
    expect(LAUNCH_GRACE_HOURS).toBe(48)
  })

  it('frisch bis einschließlich 14 Tage, danach nicht mehr', () => {
    expect(isFreshInShop(daysAgo(0), ctx)).toBe(true)
    expect(isFreshInShop(daysAgo(1), ctx)).toBe(true)
    expect(isFreshInShop(daysAgo(14), ctx)).toBe(true)
    expect(isFreshInShop(daysAgo(14.01), ctx)).toBe(false)
    expect(isFreshInShop(daysAgo(30), ctx)).toBe(false)
  })

  it('Zukunft, leer oder ungültig → kein Stempel', () => {
    expect(isFreshInShop(daysAgo(-1), ctx)).toBe(false)
    expect(isFreshInShop(null, ctx)).toBe(false)
    expect(isFreshInShop(undefined, ctx)).toBe(false)
    expect(isFreshInShop('kein Datum', ctx)).toBe(false)
  })

  it('Erstbefüllung zum Start (erste 48 h nach dem ersten Stück) trägt keinen Stempel – auch nicht in den ersten 14 Tagen', () => {
    const launchNow = new Date('2026-11-05T09:00:00.000Z')
    const at = { now: launchNow, shopStartedAt: START }
    // Import: alle Stücke innerhalb weniger Minuten bzw. bis knapp vor 48 h
    expect(isFreshInShop(START, at)).toBe(false)
    expect(isFreshInShop('2026-11-01T10:30:00.000Z', at)).toBe(false)
    expect(isFreshInShop('2026-11-03T09:59:59.000Z', at)).toBe(false)
    // ab 48 h danach: ein neues Stück
    expect(isFreshInShop('2026-11-03T10:00:00.000Z', at)).toBe(true)
    expect(isFreshInShop('2026-11-04T18:00:00.000Z', at)).toBe(true)
  })

  it('ohne bekannten Start (Datenbank fehlt) lieber kein Stempel', () => {
    expect(isFreshInShop(daysAgo(1), { now: NOW, shopStartedAt: null })).toBe(false)
  })

  it('freshFor: nur verfügbare und reservierte Stücke, sonst nie; ohne Rahmen nie', () => {
    const recent = daysAgo(2)
    expect(freshFor({ status: 'available', firstPublishedAt: recent }, ctx)).toBe(true)
    expect(freshFor({ status: 'reserved', firstPublishedAt: recent }, ctx)).toBe(true)
    expect(freshFor({ status: 'sold', firstPublishedAt: recent }, ctx)).toBe(false)
    expect(freshFor({ status: 'archived', firstPublishedAt: recent }, ctx)).toBe(false)
    expect(freshFor({ status: 'available', firstPublishedAt: recent }, null)).toBe(false)
  })
})

describe('freshStampAngle (KO-06a)', () => {
  it('+4° bis +8° nach Nummer, deterministisch, kippt anders als „sold“', () => {
    for (let nr = 1; nr <= 200; nr++) {
      const a = freshStampAngle(nr)
      expect(a).toBeGreaterThanOrEqual(4)
      expect(a).toBeLessThanOrEqual(8)
      expect(Math.sign(a)).not.toBe(Math.sign(stampAngle(nr)))
      expect(freshStampAngle(nr)).toBe(a)
    }
  })
})
