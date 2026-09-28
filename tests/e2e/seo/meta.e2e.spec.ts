import type { APIRequestContext } from '@playwright/test'
import * as cheerio from 'cheerio'

import { productPath } from '../../../src/lib/shop/format'
import { expect, test, testPayload } from '../fixtures'
import { refresh } from '../shop/fresh'
import { CRAWLER } from './crawler'

// P3.13 SEO der Shop-Routen (KONZEPT §2.5, §3.0.5, §3.2–§3.5): canonical, hreflang (AK-2-05), Open Graph je Seitentyp
// in DE/EN, JSON-LD (`Product` mit `Offer`, `BreadcrumbList`; R-126 kein Steuer-Flag im Kleinunternehmer-Modus) und
// die 404-Varianten (noindex, ohne canonical/hreflang). Geprüft wird das Server-HTML (ohne Browser) – einmal je Lauf.

const SITE = (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '')

interface Case {
  route: 'R02' | 'R03' | 'R04' | 'R05'
  de: string
  en: string
  title: { de: RegExp; en: RegExp }
}

const CASES: Case[] = [
  {
    route: 'R02',
    de: '/de/shop',
    en: '/en/shop',
    title: { de: /^Shop · Planet Claire$/, en: /^Shop · Planet Claire$/ },
  },
  {
    route: 'R03',
    de: '/de/shop/kategorie/keramik',
    en: '/en/shop/category/ceramics',
    title: { de: /^Keramik · Shop · Planet Claire$/, en: /^Ceramics · Shop · Planet Claire$/ },
  },
  {
    route: 'R04',
    de: '/de/shop/901-schale-langohr-wuschel',
    en: '/en/shop/901-bowl-long-ears-fluff',
    title: { de: / – Nr\. 901 · Planet Claire$/, en: / – No\. 901 · Planet Claire$/ },
  },
  {
    route: 'R05',
    de: '/de/archiv',
    en: '/en/archive',
    title: { de: /^Archiv · Planet Claire$/, en: /^Archive · Planet Claire$/ },
  },
]

async function html(request: APIRequestContext, url: string) {
  const res = await request.get(url, { maxRedirects: 0, headers: CRAWLER })
  return { status: res.status(), $: cheerio.load(await res.text()) }
}

const meta = ($: cheerio.CheerioAPI, property: string) =>
  $(`head meta[property="${property}"]`)
    .map((_, el) => $(el).attr('content'))
    .get()

/**
 * Dokumenttitel (nicht der `<title>` einer SVG). Bei dynamisch gerenderten 404-Antworten streamt Next die Metadaten für
 * Browser in den `<body>`; bekannte Crawler bekommen sie blockierend im `<head>`.
 */
const docTitle = ($: cheerio.CheerioAPI) =>
  $('title')
    .filter((_, el) => $(el).closest('svg').length === 0)
    .first()
    .text()

function jsonLd($: cheerio.CheerioAPI): Record<string, unknown>[] {
  return $('script[type="application/ld+json"]')
    .toArray()
    .map((el) => JSON.parse($(el).text()) as Record<string, unknown>)
}

test.describe('P3.13 SEO der Shop-Routen', () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(
      testInfo.project.name !== 'desktop',
      'Server-HTML – browserunabhängig, einmal je Lauf',
    )
  })

  test('AK-2-05 canonical, hreflang und Open Graph je Seitentyp in DE und EN', async ({
    request,
  }) => {
    for (const c of CASES) {
      for (const locale of ['de', 'en'] as const) {
        const path = c[locale]
        const { status, $ } = await html(request, path)
        expect(status, path).toBe(200)
        expect($('head link[rel="canonical"]').attr('href'), path).toBe(`${SITE}${path}`)
        const alternates = Object.fromEntries(
          $('head link[rel="alternate"][hreflang]')
            .map((_, el) => [[$(el).attr('hreflang'), $(el).attr('href')]])
            .get() as [string, string][],
        )
        expect(alternates, path).toEqual({
          de: `${SITE}${c.de}`,
          en: `${SITE}${c.en}`,
          'x-default': `${SITE}${c.de}`,
        })
        expect($('head title').text(), path).toMatch(c.title[locale])
        const description = $('head meta[name="description"]').attr('content') ?? ''
        expect(description.length, path).toBeGreaterThan(0)
        expect(description.length, path).toBeLessThanOrEqual(160)
        expect(meta($, 'og:title'), path).toEqual([$('head title').text()])
        expect(meta($, 'og:description'), path).toEqual([description])
        expect(meta($, 'og:url'), path).toEqual([`${SITE}${path}`])
        expect(meta($, 'og:type'), path).toEqual([c.route === 'R04' ? 'product' : 'website'])
        expect(meta($, 'og:locale'), path).toEqual([locale === 'de' ? 'de_DE' : 'en_GB'])
        expect(meta($, 'og:locale:alternate'), path).toEqual([locale === 'de' ? 'en_GB' : 'de_DE'])
        const image = meta($, 'og:image')
        expect(image.length, path).toBe(1)
        expect(image[0], path).toMatch(/^https?:\/\//)
        expect($('head meta[name="robots"]').attr('content') ?? '', path).not.toMatch(/noindex/)
      }
    }
  })

  test('JSON-LD: BreadcrumbList auf R02–R05, Product mit Offer auf R04 (R-126 ohne Steuer-Flag)', async ({
    request,
  }) => {
    for (const c of CASES) {
      for (const locale of ['de', 'en'] as const) {
        const { $ } = await html(request, c[locale])
        const blocks = jsonLd($)
        const crumbs = blocks.find((b) => b['@type'] === 'BreadcrumbList') as
          { itemListElement: { position: number; name: string; item: string }[] } | undefined
        expect(crumbs, c[locale]).toBeTruthy()
        const items = crumbs!.itemListElement
        expect(items[0]).toMatchObject({
          position: 1,
          name: 'Planet Claire',
          item: `${SITE}/${locale}`,
        })
        expect(items.at(-1)!.item, c[locale]).toBe(`${SITE}${c[locale]}`)
        expect(items.map((i) => i.position)).toEqual(items.map((_, i) => i + 1))
      }
    }

    const { $ } = await html(request, '/de/shop/901-schale-langohr-wuschel')
    const raw = $('script[type="application/ld+json"]')
      .map((_, el) => $(el).text())
      .get()
      .join('\n')
    const product = jsonLd($).find((b) => b['@type'] === 'Product')
    expect(product).toMatchObject({
      '@context': 'https://schema.org',
      sku: '901',
      brand: { '@type': 'Brand', name: 'Planet Claire' },
      itemCondition: 'https://schema.org/NewCondition',
      offers: {
        '@type': 'Offer',
        price: '45.00',
        priceCurrency: 'EUR',
        availability: 'https://schema.org/InStock',
        url: `${SITE}/de/shop/901-schale-langohr-wuschel`,
      },
    })
    expect(String(product!.name)).toMatch(/Langohr/)
    for (const url of product!.image as string[])
      expect(url).toMatch(/^https?:\/\/.+\/api\/media\//)
    // Seed-Einstellungen: Kleinunternehmer-Modus → keine Steuerangabe (R-126)
    expect(raw).not.toMatch(/valueAddedTaxIncluded|priceSpecification/)
  })

  test('verkauftes Stück im Archiv (S06): availability SoldOut', async ({ request }) => {
    const res = await request.get('/de/shop/906', { maxRedirects: 5, headers: CRAWLER })
    expect(res.status()).toBe(200)
    const product = jsonLd(cheerio.load(await res.text())).find((b) => b['@type'] === 'Product')
    expect(product).toMatchObject({
      sku: '906',
      offers: { availability: 'https://schema.org/SoldOut' },
    })
  })

  test('404-Varianten: noindex, ohne canonical und hreflang, eigener Titel', async ({
    request,
    fixtureProducts,
  }) => {
    const { itemNumber } = await fixtureProducts.create('keramik', {
      status: 'sold',
      firstPublishedAt: '2026-09-01T10:00:00.000Z',
      soldAt: '2026-09-20T10:00:00.000Z',
      soldChannel: 'offline',
      offlineSaleNote: 'Flohmarkt',
      showInArchiveAfterSale: false,
    })
    const payload = await testPayload()
    const doc = (
      await payload.find({
        collection: 'products',
        where: { itemNumber: { equals: itemNumber } },
        locale: 'de',
        overrideAccess: true,
        limit: 1,
      })
    ).docs[0]!
    const gone = productPath({ itemNumber, slug: doc.slug }, 'de')
    await refresh(request, [gone])

    const cases: [string, RegExp][] = [
      [gone, /^Dieses Stück hat schon ein Zuhause gefunden · Planet Claire$/],
      ['/de/shop/909-reh-im-planetenregen', /^Coco hat sich losgerissen · Planet Claire$/], // S09 archiviert
      ['/en/shop/918', /^Coco slipped her leash · Planet Claire$/], // S18 Entwurf
      ['/de/shop/kategorie/gibt-es-nicht', /^Coco hat sich losgerissen · Planet Claire$/],
      ['/de/shop?page=99', /^Coco hat sich losgerissen · Planet Claire$/],
    ]
    for (const [url, title] of cases) {
      const { status, $ } = await html(request, url)
      expect(status, url).toBe(404)
      expect($('meta[name="robots"]').attr('content'), url).toMatch(/noindex/)
      expect($('link[rel="alternate"][hreflang]'), url).toHaveLength(0)
      expect($('link[rel="canonical"]'), url).toHaveLength(0)
      expect(docTitle($), url).toMatch(title)
      expect(
        jsonLd($).filter((b) => b['@type'] === 'Product'),
        url,
      ).toEqual([])
    }
  })
})
