import { describe, expect, it } from 'vitest'

import {
  NOT_INCLUDED_ROUTE,
  rewriteHref,
  type LinkContext,
} from '../../../scripts/preview-export/transform/links'

const ctx: LinkContext = {
  currentRoute: '/de/tattoo/flash',
  exported: new Set([
    '/de',
    '/de/shop',
    '/de/shop?available=1',
    '/de/tattoo/flash',
    '/de/impressum',
  ]),
  redirects: { '/impressum': '/de/impressum' },
  origin: 'http://127.0.0.1:3999',
}

describe('Vorschau-Export: Links (KONZEPT §12.5 Nr. 5)', () => {
  it('interne Links → Hash-Routen, Query bleibt, Anker wird angehängt', () => {
    expect(rewriteHref('/de/shop', ctx)).toEqual({ kind: 'internal', href: '#/de/shop' })
    expect(rewriteHref('/de/shop?available=1', ctx).href).toBe('#/de/shop?available=1')
    expect(rewriteHref('/de/tattoo/flash#f-012', ctx).href).toBe('#/de/tattoo/flash#f-012')
    expect(rewriteHref('http://127.0.0.1:3999/de/shop', ctx).href).toBe('#/de/shop')
  })

  it('Seiten-Anker → aktuelle Route plus Anker', () => {
    expect(rewriteHref('#kontakt', ctx).href).toBe('#/de/tattoo/flash#kontakt')
  })

  it('Weiterleitungen aus dem Crawl werden aufgelöst (Kurz-URL → kanonische Route)', () => {
    expect(rewriteHref('/impressum', ctx).href).toBe('#/de/impressum')
  })

  it('nicht exportierte Ziele (API, PDF, Verwaltung, nicht gebaute Route) → #/vorschau/nicht-enthalten', () => {
    for (const href of ['/api/invoices/1', '/de/rechnung.pdf', '/werkstatt', '/de/warenkorb'])
      expect(rewriteHref(href, ctx)).toEqual({ kind: 'internal', href: `#${NOT_INCLUDED_ROUTE}` })
    expect(rewriteHref('javascript:alert(1)', ctx).href).toBe(`#${NOT_INCLUDED_ROUTE}`)
    expect(rewriteHref('http://example.com/x', ctx).href).toBe(`#${NOT_INCLUDED_ROUTE}`)
  })

  it('externe https-Links bleiben (neuer Tab), mailto/tel bleiben', () => {
    expect(rewriteHref('https://www.instagram.com/planet.claire.tattoos/', ctx)).toEqual({
      kind: 'external',
      href: 'https://www.instagram.com/planet.claire.tattoos/',
    })
    expect(rewriteHref('mailto:hallo@example.com', ctx)).toEqual({
      kind: 'keep',
      href: 'mailto:hallo@example.com',
    })
    expect(rewriteHref('tel:+4930123', ctx).kind).toBe('keep')
  })
})
