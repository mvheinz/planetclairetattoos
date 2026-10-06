import { describe, expect, it } from 'vitest'

import {
  ANALYTICS_BLOCKED_PREFIXES,
  analyticsBeforeSend,
  isBlockedPath,
} from '../../../src/lib/analytics/beforeSend'
import {
  analyticsAllowed,
  analyticsEnvAllows,
  analyticsSettingsAllow,
} from '../../../src/lib/analytics/gate'
import { ROUTES } from '../../../src/lib/routes/registry'

const BASE = 'https://planetclairetattoos.com'
const pv = (path: string) => ({ type: 'pageview' as const, url: `${BASE}${path}` })

describe('Statistik beforeSend (R-132)', () => {
  it('R-132 entfernt alle Query-Parameter und Fragmente', () => {
    expect(analyticsBeforeSend(pv('/de/shop?utm_source=x&email=a@b.de#kasse'))?.url).toBe(
      `${BASE}/de/shop`,
    )
    expect(analyticsBeforeSend(pv('/?q=1'))?.url).toBe(`${BASE}/`)
  })

  it('R-132 verwirft Kasse, Warenkorb, Danke, Bestellstatus, Widerruf (R06–R09, R26) in beiden Sprachen und mit Token', () => {
    for (const path of [
      '/de/warenkorb',
      '/en/cart',
      '/de/kasse',
      '/en/checkout',
      '/de/danke/' + 'T'.repeat(43),
      '/en/thank-you/' + 'T'.repeat(43),
      '/de/bestellung/' + 'T'.repeat(43),
      '/en/order/' + 'T'.repeat(43),
      '/de/vertrag-widerrufen',
      '/en/withdraw-from-contract',
      '/de/vertrag-widerrufen/bestaetigen',
      '/admin',
      '/api/health',
    ]) {
      expect(analyticsBeforeSend(pv(path)), path).toBeNull()
    }
  })

  it('Registry-Abgleich: alle Pfade von R06, R07, R08, R09, R26 sind gesperrt, normale Seiten nicht', () => {
    const blocked = new Set(['R06', 'R07', 'R08', 'R09', 'R26'])
    for (const r of ROUTES) {
      if (r.kind !== 'page' || !r.paths) continue
      for (const locale of ['de', 'en'] as const) {
        const concrete = r.paths[locale].replace(/\[[^\]]+\]/g, 'x')
        const full = locale === 'en' ? `/en${concrete === '/' ? '' : concrete}` : concrete
        expect(isBlockedPath(full), `${r.id} ${full}`).toBe(blocked.has(r.id))
      }
    }
    expect(ANALYTICS_BLOCKED_PREFIXES.length).toBeGreaterThan(8)
  })

  it('verwirft Custom Events und ungültige URLs', () => {
    expect(analyticsBeforeSend({ type: 'event', url: `${BASE}/de/shop` })).toBeNull()
    expect(analyticsBeforeSend({ type: 'pageview', url: 'kaputt' })).toBeNull()
  })
})

describe('Statistik-Freigabe (R-210 Nr. 10)', () => {
  const env = { NEXT_PUBLIC_ANALYTICS_ENABLED: true, APP_ENV: 'production', PREVIEW_EXPORT: false }
  const ok = {
    enabled: true,
    confirmedAt: '2026-11-01T10:00:00Z',
    note: 'Kanzlei hat K-30 bestätigt',
  }

  it('nur mit allen vier Bedingungen', () => {
    expect(analyticsAllowed(env, ok)).toBe(true)
    expect(analyticsAllowed({ ...env, NEXT_PUBLIC_ANALYTICS_ENABLED: false }, ok)).toBe(false)
    expect(analyticsAllowed({ ...env, APP_ENV: 'staging' }, ok)).toBe(false)
    expect(analyticsAllowed({ ...env, PREVIEW_EXPORT: true }, ok)).toBe(false)
    expect(analyticsAllowed(env, { ...ok, enabled: false })).toBe(false)
    expect(analyticsAllowed(env, { ...ok, confirmedAt: null })).toBe(false)
    expect(analyticsAllowed(env, { ...ok, note: '  ' })).toBe(false)
    expect(analyticsAllowed(env, null)).toBe(false)
    expect(analyticsEnvAllows(env)).toBe(true)
    expect(analyticsSettingsAllow(undefined)).toBe(false)
  })
})
