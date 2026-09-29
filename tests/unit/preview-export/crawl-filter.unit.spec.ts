import { describe, expect, it } from 'vitest'

import {
  assetRefs,
  canonicalPath,
  crawl,
  crawlTarget,
  cssUrls,
  isExcludedPath,
  seedParamProvider,
  startSet,
  type FetchResult,
  type Fetcher,
} from '../../../scripts/preview-export/crawl'
import { ExportError } from '../../../scripts/preview-export/errors'
import { ROUTES, type RouteEntry } from '../../../src/lib/routes/registry'
import { seedToken } from '../../../src/lib/seed/tokens'

const ADMIN = '/werkstatt'

describe('Vorschau-Export: Crawl-Filter (ARCHITEKTUR §14.4)', () => {
  it('lässt /api, ADMIN_ROUTE, /_next und Pfade mit Dateiendung aus', () => {
    expect(isExcludedPath('/api/health', ADMIN)).toBe(true)
    expect(isExcludedPath('/api', ADMIN)).toBe(true)
    expect(isExcludedPath('/werkstatt', ADMIN)).toBe(true)
    expect(isExcludedPath('/werkstatt/collections/products', ADMIN)).toBe(true)
    expect(isExcludedPath('/_next/static/chunks/a.js', ADMIN)).toBe(true)
    expect(isExcludedPath('/de/rechnung.pdf', ADMIN)).toBe(true)
    expect(isExcludedPath('/de/impressum', ADMIN)).toBe(false)
    expect(isExcludedPath('/werkstattbericht', ADMIN)).toBe(false)
    expect(isExcludedPath('/apiary', ADMIN)).toBe(false)
  })

  it('behält nur available, category, kind, page (sortiert) und entfernt den Schrägstrich am Ende', () => {
    const u = new URL('http://x/de/shop/?utm_source=x&page=2&available=1&category=keramik&kind=a')
    expect(canonicalPath(u)).toBe('/de/shop?available=1&category=keramik&kind=a&page=2')
    expect(canonicalPath(new URL('http://x/de?ref=1'))).toBe('/de')
  })

  it('folgt nur internen Links (a[href^="/"]), nie externen oder Protokoll-relativen', () => {
    expect(crawlTarget('/de/kontakt#form', ADMIN)).toBe('/de/kontakt')
    expect(crawlTarget('https://www.instagram.com/x', ADMIN)).toBeNull()
    expect(crawlTarget('//evil.example/de', ADMIN)).toBeNull()
    expect(crawlTarget('mailto:a@b.de', ADMIN)).toBeNull()
    expect(crawlTarget('#inhalt', ADMIN)).toBeNull()
    expect(crawlTarget('/api/orders', ADMIN)).toBeNull()
    expect(crawlTarget('/werkstatt', ADMIN)).toBeNull()
  })

  it('Start-Menge: alle Registry-Routen mit status ≠ planned in DE und EN plus /de/__404 und /en/__404', () => {
    const start = startSet()
    const paths = start.map((s) => s.path)
    const live = ROUTES.filter((r) => r.kind === 'page' && r.status !== 'planned')
    for (const r of live) {
      if (r.paths!.de.includes('[')) continue
      expect(start.filter((s) => s.routeId === r.id).map((s) => s.lang)).toEqual(['de', 'en'])
    }
    expect(paths).toContain('/de')
    expect(paths).toContain('/en/legal-notice')
    expect(paths).toContain('/de/__404')
    expect(paths).toContain('/en/__404')
    expect(start.find((s) => s.path === '/de/__404')!.expect).toBe(404)
    for (const r of ROUTES.filter((x) => x.status === 'planned'))
      expect(start.some((s) => s.routeId === r.id)).toBe(false)
  })

  it('Danke- und Statusseiten mit deterministischen Seed-Token (nur wenn die Route gebaut ist)', () => {
    const live = (id: string): RouteEntry => ({
      ...ROUTES.find((r) => r.id === id)!,
      status: 'live',
    })
    const start = startSet([live('R08'), live('R09')], seedParamProvider)
    const paths = start.map((s) => s.path)
    expect(paths).toContain(`/de/danke/${seedToken('checkouts:O13', 'checkout')}`)
    expect(paths).toContain(`/en/thank-you/${seedToken('checkouts:O14', 'checkout')}`)
    for (const key of ['O10', 'O13', 'O01'])
      expect(paths).toContain(`/de/bestellung/${seedToken(`orders:${key}`, 'status')}`)
  })

  it('findet url()-Verweise und Dateien im HTML', () => {
    expect(cssUrls('a{background:url("/a.png")} b{src:url(x.woff2)} c{d:url(data:,)}')).toEqual([
      '/a.png',
      'x.woff2',
    ])
    const refs = assetRefs(
      '<html><head><link rel="stylesheet" href="/s.css"></head><body><img src="/i.webp" srcset="/i-2.webp 2x"><svg><use href="/art/coco.v1.svg#coco-a"></use><use href="#local"></use></svg></body></html>',
    )
    expect(refs).toEqual(['/art/coco.v1.svg', '/i-2.webp', '/i.webp', '/s.css'])
  })
})

function fakeServer(routes: Record<string, Partial<FetchResult> & { html?: string }>) {
  const requested: string[] = []
  const fetcher: Fetcher = async (path) => {
    requested.push(path)
    const r = routes[path]
    if (!r) return { status: 404, contentType: 'text/html', body: Buffer.from('<h1>404</h1>') }
    return {
      status: r.status ?? 200,
      contentType: r.contentType ?? 'text/html; charset=utf-8',
      body: r.body ?? Buffer.from(r.html ?? ''),
      location: r.location,
    }
  }
  return { fetcher, requested }
}

const page = (body: string) =>
  `<html><head><link rel="stylesheet" href="/s.css"></head><body>${body}</body></html>`

describe('Vorschau-Export: Crawl (ARCHITEKTUR §14.4)', () => {
  const start = [
    { path: '/de', lang: 'de' as const, routeId: 'R01', expect: 200 as const },
    { path: '/de/impressum', lang: 'de' as const, routeId: 'R21', expect: 200 as const },
    { path: '/de/__404', lang: 'de' as const, routeId: null, expect: 404 as const },
  ]

  it('Breitensuche über interne Links, Dateien inkl. CSS-url(), keine fremden Hosts', async () => {
    const { fetcher, requested } = fakeServer({
      '/de': {
        html: page(
          '<a href="/de/kontakt">k</a><a href="https://x.example/">x</a><img src="https://cdn.example/a.png">',
        ),
      },
      '/de/kontakt': { html: page('<a href="/de?utm=1">start</a><a href="/api/x">api</a>') },
      '/de/impressum': { html: page('<a href="/impressum">kurz</a>') },
      '/impressum': { status: 308, location: '/de/impressum' },
      '/de/__404': { status: 404, html: page('<h1>weg</h1>') },
      '/s.css': { contentType: 'text/css', body: Buffer.from('@font-face{src:url(/f.woff2)}') },
      '/f.woff2': { contentType: 'font/woff2', body: Buffer.from('woff') },
    })
    const res = await crawl(fetcher, { adminRoute: ADMIN, start })
    expect(res.pages.map((p) => p.path)).toEqual([
      '/de',
      '/de/__404',
      '/de/impressum',
      '/de/kontakt',
    ])
    expect(res.pages.find((p) => p.path === '/de/__404')!.status).toBe(404)
    expect(res.redirects).toEqual({ '/impressum': '/de/impressum' })
    expect([...res.assets.keys()]).toEqual(['/f.woff2', '/s.css'])
    expect(requested.every((p) => p.startsWith('/') && !p.startsWith('//'))).toBe(true)
    expect(requested).not.toContain('/api/x')
    expect(res.warnings.some((w) => w.includes('cdn.example'))).toBe(true)
  })

  it('eine Registry-Route mit 404 steht als not-built im Ergebnis und fehlt in den Seiten', async () => {
    const { fetcher } = fakeServer({
      '/de': { html: page('') },
      '/de/__404': { status: 404, html: page('') },
      '/s.css': { contentType: 'text/css', body: Buffer.from('') },
    })
    const res = await crawl(fetcher, { adminRoute: ADMIN, start })
    expect(res.notBuilt).toEqual([{ routeId: 'R21', path: '/de/impressum', lang: 'de' }])
    expect(res.pages.map((p) => p.path)).not.toContain('/de/impressum')
  })

  it('P4.25 vorab geholte Seiten (Kassen-Sitzung) ersetzen den eigenen Abruf – Korb/Kasse mit Cookies', async () => {
    const { fetcher, requested } = fakeServer({
      '/de': { html: page('<a href="/de/warenkorb">Korb</a>') },
      '/de/impressum': { html: page('') },
      '/de/__404': { status: 404, html: page('') },
      '/de/warenkorb': { html: page('<p>leer</p>') },
      '/s.css': { contentType: 'text/css', body: Buffer.from('') },
    })
    const pinned = new Map([
      [
        '/de/warenkorb',
        {
          status: 200,
          contentType: 'text/html',
          body: Buffer.from(page('<p data-cart-line>901</p>')),
        },
      ],
    ])
    const res = await crawl(fetcher, { adminRoute: ADMIN, start, pinned })
    expect(res.pages.find((p) => p.path === '/de/warenkorb')!.html).toContain('data-cart-line')
    expect(requested).not.toContain('/de/warenkorb')
  })

  it('ein 5xx beim Crawl ergibt ExportError mit Exit 1', async () => {
    const { fetcher } = fakeServer({
      '/de': { html: page('') },
      '/de/impressum': { status: 500, html: 'boom' },
      '/de/__404': { status: 404, html: page('') },
    })
    const err = await crawl(fetcher, { adminRoute: ADMIN, start }).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ExportError)
    expect((err as ExportError).exitCode).toBe(1)
  })

  it('höchstens maxPages Seiten', async () => {
    const links = Array.from({ length: 20 }, (_, i) => `<a href="/de/s${i}">${i}</a>`).join('')
    const routes: Record<string, { html: string }> = { '/de': { html: page(links) } }
    for (let i = 0; i < 20; i++) routes[`/de/s${i}`] = { html: page('') }
    const { fetcher } = fakeServer(routes)
    const res = await crawl(fetcher, {
      adminRoute: ADMIN,
      start: [start[0]!],
      maxPages: 5,
    })
    expect(res.pages).toHaveLength(5)
    expect(res.warnings.some((w) => w.includes('Obergrenze'))).toBe(true)
  })
})
