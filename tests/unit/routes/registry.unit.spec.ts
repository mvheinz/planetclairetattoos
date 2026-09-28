import { readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  adminRoutesFromEnv,
  checkRouteRegistry,
  parseKonzeptRouteTable,
  registryInput,
} from '../../../scripts/lib/static-checks/route-registry'
import {
  alternatePath,
  aliasTarget,
  localizedPath,
  matchRoute,
  toFolderPattern,
} from '../../../src/lib/routes/paths'
import { ROUTES, shortLinks } from '../../../src/lib/routes/registry'
import { pathnames, routing } from '@/i18n/routing'

const root = path.resolve(import.meta.dirname, '../../..')

// AK-2-01 / T-07 (Registry-Teil), ARCHITEKTUR §2.3.
describe('Routen-Registry (T-07, AK-2-01)', () => {
  it('AK-2-01 T-07 Registry stimmt mit KONZEPT §2.2 überein, Pfade eindeutig, nichts unter /admin', () => {
    const result = checkRouteRegistry(registryInput(root, adminRoutesFromEnv()))
    expect(result.errors).toEqual([])
  })

  it('AK-2-01 alle R01–R31 aus der KONZEPT-Tabelle, R01–R27 mit DE- und EN-Muster', () => {
    const rows = parseKonzeptRouteTable(readFileSync(path.join(root, 'docs/KONZEPT.md'), 'utf8'))
    expect(rows.map((r) => r.id)).toEqual(ROUTES.map((r) => r.id))
    for (const r of ROUTES.filter((x) => Number(x.id.slice(1)) <= 27)) {
      expect(r.paths?.de, r.id).toMatch(/^\//)
      expect(r.paths?.en, r.id).toMatch(/^\//)
    }
  })

  it('T-07 kein Pfad beginnt mit /admin oder ADMIN_ROUTE (Negativprobe)', () => {
    const input = registryInput(root, ['/werkstatt'])
    const bad = checkRouteRegistry({
      ...input,
      shortLinks: [...input.shortLinks, { path: '/werkstatt/x', routeId: 'R21' }],
      aliases: [...input.aliases, { path: '/admin', locale: 'en', routeId: 'R21' }],
    })
    expect(bad.errors.join('\n')).toMatch(/\/werkstatt\/x liegt unter \/werkstatt/)
    expect(bad.errors.join('\n')).toMatch(/\/admin liegt unter \/admin/)
  })

  it('T-07 erkennt doppelte Pfade und Abweichungen von KONZEPT', () => {
    const input = registryInput(root, [])
    const routes = ROUTES.map((r) =>
      r.id === 'R05' ? { ...r, paths: { de: '/warenkorb', en: '/archive' } } : r,
    )
    const bad = checkRouteRegistry({ ...input, routes })
    expect(bad.errors.join('\n')).toMatch(/R05: DE-Muster \/warenkorb ≠ KONZEPT \/archiv/)
    expect(bad.errors.join('\n')).toMatch(/Pfad \/de\/warenkorb doppelt/)
  })

  it('P2: live sind R01, R20–R29', () => {
    expect(
      ROUTES.filter((r) => r.status === 'live' && r.kind !== 'redirect').map((r) => r.id),
    ).toEqual(['R01', 'R20', 'R21', 'R22', 'R23', 'R24', 'R25', 'R26', 'R27', 'R28', 'R29'])
  })

  it('R-010 genau sieben Kurz-URLs mit kanonischem DE-Ziel', () => {
    expect(shortLinks).toHaveLength(7)
    const widerruf = shortLinks.find((s) => s.path === '/widerruf')!
    expect(localizedPath(widerruf.routeId, 'de')).toBe('/de/vertrag-widerrufen')
    const versand = shortLinks.find((s) => s.path === '/versand')!
    expect(localizedPath(versand.routeId, 'de')).toBe('/de/versand-und-zahlung')
  })
})

describe('Pfad-Helfer', () => {
  it("alternatePath('/de/impressum','en') = '/en/legal-notice'", () => {
    expect(alternatePath('/de/impressum', 'en')).toBe('/en/legal-notice')
    expect(alternatePath('/en/legal-notice', 'de')).toBe('/de/impressum')
    expect(alternatePath('/de', 'en')).toBe('/en')
    expect(alternatePath('/en/withdraw-from-contract', 'de')).toBe('/de/vertrag-widerrufen')
    expect(alternatePath('/de/shop/kategorie/keramik', 'en')).toBe('/en/shop/category/keramik')
    expect(alternatePath('/de/danke/abc123', 'en')).toBe('/en/thank-you/abc123')
    expect(alternatePath('/de/gibt-es-nicht', 'en')).toBeNull()
    expect(alternatePath('/fr/impressum', 'en')).toBeNull()
  })

  it('localizedPath setzt Parameter ein', () => {
    expect(localizedPath('R01', 'de')).toBe('/de')
    expect(localizedPath('R04', 'de', { nummer: '017', slug: 'schale-mit-hund' })).toBe(
      '/de/shop/017-schale-mit-hund',
    )
    expect(() => localizedPath('R08', 'en')).toThrow(/token/)
    expect(() => localizedPath('R28', 'en')).toThrow()
  })

  it('matchRoute bevorzugt statische Muster', () => {
    expect(matchRoute('/shop', 'de')?.route.id).toBe('R02')
    expect(matchRoute('/shop/017-schale', 'de')).toEqual({
      route: expect.objectContaining({ id: 'R04' }),
      params: { nummer: '017', slug: 'schale' },
    })
    expect(matchRoute('/tattoo/angebote', 'de')?.route.id).toBe('R13')
    expect(matchRoute('/tattoo/angebote', 'en')).toBeNull()
  })

  it('Aliasse /en/imprint und /en/impressum → /en/legal-notice', () => {
    expect(aliasTarget('/en/imprint')).toBe('/en/legal-notice')
    expect(aliasTarget('/en/impressum')).toBe('/en/legal-notice')
    expect(aliasTarget('/en/legal-notice')).toBeNull()
  })

  it('next-intl-Routing: kein Cookie, immer Präfix, Muster aus der Registry', () => {
    expect(routing.localeCookie).toBe(false)
    expect(routing.localePrefix).toBe('always')
    expect(routing.defaultLocale).toBe('de')
    expect(pathnames['/legal-notice']).toEqual({ de: '/impressum', en: '/legal-notice' })
    expect(pathnames['/shop/[product]']).toEqual({ de: '/shop/[product]', en: '/shop/[product]' })
    expect(toFolderPattern('/shop/[nummer]-[slug]', '/shop/[product]')).toBe('/shop/[product]')
  })
})
