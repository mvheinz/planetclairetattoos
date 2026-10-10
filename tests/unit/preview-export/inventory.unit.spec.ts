import { describe, expect, it } from 'vitest'

import { BESTAND_TOKEN_PAGES_NOTE, notBuiltRoutes } from '../../../scripts/preview-export/assemble'
import { paramProviderFor, seedParamProvider } from '../../../scripts/preview-export/crawl'
import { buildExportEnv } from '../../../scripts/preview-export/env'
import {
  BESTAND_SEED_STEPS,
  cartAnchors,
  piecePath,
  previewPieces,
  resolveInventory,
} from '../../../scripts/preview-export/inventory'
import { EXAMPLE_STEPS } from '@/lib/seed/example'
import { ROUTES } from '@/lib/routes/registry'

// P16.3 (U-76): Die Vorschau-Datei zeigt Juttas echten Bestand; der Demo-Bestand nur noch mit PREVIEW_INVENTORY=demo.

describe('Bestand der Vorschau-Datei', () => {
  it('Standard ist der echte Bestand; demo nur ausdrücklich; anderes ist ein Fehler', () => {
    expect(resolveInventory({})).toBe('bestand')
    expect(resolveInventory({ PREVIEW_INVENTORY: ' demo ' })).toBe('demo')
    expect(() => resolveInventory({ PREVIEW_INVENTORY: 'alles' })).toThrow(/bestand oder demo/)
    const env = buildExportEnv({
      source: { DATABASE_URL: 'postgres://u:p@localhost:5432/x' },
      example: {},
      now: new Date('2026-10-10T10:00:00Z'),
      phase: 'p16',
    })
    expect(env.PREVIEW_INVENTORY).toBe('bestand')
  })

  it('echter Bestand: seed:example ohne Stücke und ohne Vorgänge, die Demo-Stücke brauchen', () => {
    for (const step of BESTAND_SEED_STEPS) expect(EXAMPLE_STEPS).toContain(step)
    for (const step of [
      'products',
      'checkouts',
      'orders',
      'reservations',
      'invoices',
      'withdrawals',
      'complaints',
    ])
      expect(BESTAND_SEED_STEPS).not.toContain(step)
  })

  it('Stücke: echter Bestand 74 Stücke 101–174, Demo nur die öffentlichen Seed-Stücke', () => {
    const bestand = previewPieces('bestand')
    expect(bestand).toHaveLength(74)
    expect(bestand[0]!.itemNumber).toBe(101)
    expect(bestand.at(-1)!.itemNumber).toBe(174)
    const demo = previewPieces('demo')
    expect(demo.every((p) => p.itemNumber >= 901)).toBe(true)
    expect(demo.map((p) => p.key)).not.toContain('S08')
  })

  it('Korb-Stücke: Keramik mit ≥ 2 Fotos ohne Abweichung + Textil/Cap mit Abweichung; Demo S01 + S11', () => {
    const [a, b] = cartAnchors('bestand')
    expect(a.category).toBe('keramik')
    expect(a.photos).toBeGreaterThanOrEqual(2)
    expect(a.deviation).toBe(false)
    expect(['textil', 'cap']).toContain(b.category)
    expect(b.deviation).toBe(true)
    expect(cartAnchors('demo').map((p) => p.key)).toEqual(['S01', 'S11'])
    expect(piecePath(cartAnchors('demo')[0], 'de')).toBe('/de/shop/901-schale-langohr-wuschel')
  })

  it('Parameter: Seed-Anker nur mit Demo-Bestand', () => {
    const r08 = ROUTES.find((r) => r.id === 'R08')!
    expect(paramProviderFor('demo')).toBe(seedParamProvider)
    expect(paramProviderFor('bestand')(r08)).toEqual([])
  })

  it('Bericht: Danke- und Statusseiten mit echtem Bestand als „nicht gebaut“ mit Hinweis', () => {
    const nb = notBuiltRoutes({ pages: [], notBuilt: [] }, { inventory: 'bestand' })
    const token = nb.filter((r) => r.note === BESTAND_TOKEN_PAGES_NOTE).map((r) => r.route)
    expect(token.sort()).toEqual([
      '/de/bestellung/[token]',
      '/de/danke/[token]',
      '/en/order/[token]',
      '/en/thank-you/[token]',
    ])
    expect(
      notBuiltRoutes({ pages: [], notBuilt: [] }).some((r) => r.note === BESTAND_TOKEN_PAGES_NOTE),
    ).toBe(false)
  })
})
