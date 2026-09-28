import type { APIRequestContext } from '@playwright/test'
import * as cheerio from 'cheerio'
import sharp from 'sharp'

import type { LocalizedValue } from '../../../src/lib/products/localized'
import { pageRoutes, samplePath } from '../../../src/lib/routes/paths'
import { LOCALES } from '../../../src/lib/routes/registry'
import { productPath } from '../../../src/lib/shop/format'
import { expect, test, testPayload } from '../fixtures'
import { NO_CACHE } from '../shop/fresh'
import { CRAWLER } from './crawler'

// P3.14 OG-Bilder (DESIGN §12.6, KONZEPT §3.0.5): Für jedes öffentliche Seed-Stück liefert die OG-Route 200,
// `image/png`, 1200 × 630; `sold` zeigt den Stempel; `/en` hat den englischen Titel. Jede Seite verweist per absolutem
// `og:image` (mit `og:image:alt`, `:width`, `:height`) auf eine OG-Route. Im Entwicklungsmodus setzt Next für
// Datei-OG-Bilder den lokalen Server als Basis, im Produktions-Build die Apex-Domain aus `NEXT_PUBLIC_SITE_URL`.

const SITE = (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '')
const PRODUCTION = process.env.E2E_SERVER === 'start'
const FOX = { r: 0xb8, g: 0x4e, b: 0x1a }

interface OgMeta {
  url: string
  alt: string
  width: string
  height: string
}

async function ogMeta(request: APIRequestContext, path: string): Promise<OgMeta> {
  const res = await request.get(path, { headers: CRAWLER })
  expect(res.status(), path).toBe(200)
  const $ = cheerio.load(await res.text())
  const meta = (p: string) => $(`head meta[property="${p}"]`).attr('content') ?? ''
  expect($('head meta[property="og:image"]'), path).toHaveLength(1)
  return {
    url: meta('og:image'),
    alt: meta('og:image:alt'),
    width: meta('og:image:width'),
    height: meta('og:image:height'),
  }
}

async function fetchPng(request: APIRequestContext, url: string): Promise<Buffer> {
  const u = new URL(url)
  const res = await request.get(`${u.pathname}${u.search}`, { headers: NO_CACHE })
  expect(res.status(), url).toBe(200)
  expect(res.headers()['content-type'], url).toBe('image/png')
  const png = Buffer.from(await res.body())
  expect(await sharp(png).metadata(), url).toMatchObject({
    format: 'png',
    width: 1200,
    height: 630,
  })
  return png
}

/** Anteil der Pixel in der Stempelfarbe rechts vom Foto. */
async function foxShare(png: Buffer): Promise<number> {
  const { data, info } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  let hits = 0
  for (let y = 0; y < info.height; y++)
    for (let x = 504; x < info.width; x++) {
      const i = (y * info.width + x) * 3
      if (
        Math.abs(data[i]! - FOX.r) < 40 &&
        Math.abs(data[i + 1]! - FOX.g) < 40 &&
        Math.abs(data[i + 2]! - FOX.b) < 40
      )
        hits++
    }
  return hits / ((info.width - 504) * info.height)
}

interface SeedProduct {
  itemNumber: number
  status: string
  slug: LocalizedValue
  title: LocalizedValue
}

async function publicSeedProducts(): Promise<SeedProduct[]> {
  const payload = await testPayload()
  const res = await payload.find({
    collection: 'products',
    where: {
      and: [
        { seed: { equals: true } },
        {
          or: [
            { status: { in: ['available', 'reserved'] } },
            {
              and: [{ status: { equals: 'sold' } }, { showInArchiveAfterSale: { equals: true } }],
            },
          ],
        },
      ],
    },
    locale: 'all',
    depth: 0,
    pagination: false,
    overrideAccess: true,
    select: { itemNumber: true, status: true, slug: true, title: true },
  })
  return res.docs.map((d) => ({
    itemNumber: d.itemNumber,
    status: d.status,
    slug: d.slug as LocalizedValue,
    title: d.title as LocalizedValue,
  }))
}

test.describe('P3.14 OG-Bilder', () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(
      testInfo.project.name !== 'desktop',
      'Server-Bilder – browserunabhängig, einmal je Lauf',
    )
  })

  test('jedes öffentliche Seed-Stück: OG-Route 200, image/png, 1200 × 630; sold mit Stempel; EN mit EN-Titel', async ({
    request,
  }) => {
    test.setTimeout(240_000)
    const products = await publicSeedProducts()
    expect(products.map((p) => p.itemNumber)).toEqual(expect.arrayContaining([901, 906]))
    const pngs = new Map<string, Buffer>()
    for (const p of products) {
      for (const locale of LOCALES) {
        const path = productPath(p, locale)
        const og = await ogMeta(request, path)
        expect(og.url, path).toMatch(/^https?:\/\/[^/]+\/.+\/opengraph-image[^/]*\/[\w-]+/)
        expect(new URL(og.url).pathname.startsWith(`${path}/opengraph-image`), og.url).toBe(true)
        if (PRODUCTION) expect(og.url.startsWith(`${SITE}/`), og.url).toBe(true)
        expect([og.width, og.height], path).toEqual(['1200', '630'])
        const title = (p.title as Record<string, string | undefined>)[locale] ?? ''
        expect(og.alt, path).toContain(title)
        expect(og.alt, path).toContain(locale === 'de' ? 'Nr.' : 'No.')
        const png = await fetchPng(request, og.url)
        pngs.set(`${p.itemNumber}:${locale}`, png)
        const share = await foxShare(png)
        if (p.status === 'sold') expect(share, `${path} Stempel`).toBeGreaterThan(0.002)
        else expect(share, `${path} ohne Stempel`).toBe(0)
      }
    }
    // S01 hat einen eigenen EN-Titel → das EN-Bild unterscheidet sich vom DE-Bild.
    expect(pngs.get('901:en')!.equals(pngs.get('901:de')!)).toBe(false)
  })

  test('jede Seite verweist per absolutem og:image auf eine OG-Route (Standardbild DE/EN)', async ({
    request,
  }) => {
    const live = pageRoutes().filter((r) => r.status === 'live' && r.id !== 'R04')
    const seen = new Set<string>()
    for (const route of live) {
      for (const locale of LOCALES) {
        const path = samplePath(route.id, locale)
        const og = await ogMeta(request, path)
        expect(og.url, path).toBe(`${SITE}/${locale}/og-image.png`)
        expect(og.alt, path).toMatch(/Planet Claire/)
        expect([og.width, og.height], path).toEqual(['1200', '630'])
        seen.add(og.url)
      }
    }
    const [de, en] = await Promise.all([...seen].sort().map((url) => fetchPng(request, url)))
    expect(de!.equals(en!)).toBe(false)
    const unknown = await request.get('/xx/og-image.png')
    expect(unknown.status()).toBe(404)
  })
})
