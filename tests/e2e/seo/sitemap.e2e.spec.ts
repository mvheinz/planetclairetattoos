import * as cheerio from 'cheerio'

import type { LocalizedValue } from '../../../src/lib/products/localized'
import { productPath } from '../../../src/lib/shop/format'
import { adminRoute } from '../../helpers/adminEnv'
import { expect, test, testPayload } from '../fixtures'
import { NO_CACHE, holdListData, refresh } from '../shop/fresh'

// P3.13 `sitemap.xml` (KONZEPT §2.5): öffentliche Stücke (`available`, `reserved`, `sold` mit Archiv), Kategorien und
// feste Seiten beider Sprachen mit `xhtml:link`-Alternates und `lastmod`. Seed-Anker: S01 (901, available) und S06 (906,
// sold, Archiv) stehen darin; S09 (909, archived) und S18 (918, draft) nicht, ebenso wenig ein Fixture-Stück analog S08
// (sold, nicht im Archiv). Die echten Anker S19/S08 prüft P8.21. Der Verwaltungspfad kommt nie vor (AK-2-04).

const SITE = (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '')

interface Entry {
  loc: string
  lastmod: string | null
  alternates: Record<string, string>
}

function parseSitemap(xml: string): Entry[] {
  const $ = cheerio.load(xml, { xml: true })
  return $('urlset > url')
    .map((_, el) => {
      const url = $(el)
      const alternates = Object.fromEntries(
        url
          .find('xhtml\\:link')
          .map((__, link) => [[$(link).attr('hreflang'), $(link).attr('href')]])
          .get() as [string, string][],
      )
      return {
        loc: url.find('loc').text(),
        lastmod: url.find('lastmod').text() || null,
        alternates,
      }
    })
    .get()
}

async function slugOf(itemNumber: number): Promise<LocalizedValue> {
  const payload = await testPayload()
  const doc = (
    await payload.find({
      collection: 'products',
      where: { itemNumber: { equals: itemNumber } },
      locale: 'all',
      overrideAccess: true,
      limit: 1,
    })
  ).docs[0]
  return doc?.slug as LocalizedValue
}

test.describe('P3.13 sitemap.xml', () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'Server-XML – browserunabhängig, einmal je Lauf')
  })
  // Seed-Anker S01/S06 nicht während eines exklusiven Bestandstests (Archiv-Leerzustand blendet S06 aus) lesen.
  holdListData(test, 'shared')

  test('Stücke, Kategorien und Seiten mit Alternates und lastmod; nie Entwürfe, Archiviertes, Korb, Kasse, Verwaltung', async ({
    request,
    fixtureProducts,
  }) => {
    const hidden = await fixtureProducts.create('keramik', {
      status: 'sold',
      firstPublishedAt: '2026-09-01T10:00:00.000Z',
      soldAt: '2026-09-20T10:00:00.000Z',
      soldChannel: 'offline',
      offlineSaleNote: 'Flohmarkt',
      showInArchiveAfterSale: false,
    })
    const visible = await fixtureProducts.create('keramik', {
      status: 'available',
      firstPublishedAt: '2026-09-02T10:00:00.000Z',
    })
    await refresh(request, ['/sitemap.xml'])

    const res = await request.get('/sitemap.xml', { headers: NO_CACHE })
    expect(res.status()).toBe(200)
    expect(res.headers()['content-type']).toMatch(/xml/)
    const xml = await res.text()
    const entries = parseSitemap(xml)
    const byLoc = new Map(entries.map((e) => [e.loc, e]))
    expect(entries.length).toBeGreaterThan(10)

    // S01 und S06 in beiden Sprachen, EN mit EN-Slug, Alternates und lastmod
    for (const nr of [901, 906]) {
      const slug = await slugOf(nr)
      const de = `${SITE}${productPath({ itemNumber: nr, slug }, 'de')}`
      const en = `${SITE}${productPath({ itemNumber: nr, slug }, 'en')}`
      expect(byLoc.has(de), de).toBe(true)
      expect(byLoc.has(en), en).toBe(true)
      expect(byLoc.get(de)!.alternates).toEqual({ de, en, 'x-default': de })
      expect(byLoc.get(en)!.alternates).toEqual({ de, en, 'x-default': de })
      expect(Number.isNaN(Date.parse(byLoc.get(de)!.lastmod ?? '')), de).toBe(false)
    }
    expect(byLoc.has(`${SITE}/en/shop/901-bowl-long-ears-fluff`)).toBe(true)
    expect(byLoc.has(`${SITE}/de/shop/901-schale-langohr-wuschel`)).toBe(true)

    // sichtbares Fixture-Stück ja, verkauft-ausgeblendetes (analog S08) nein; S09 (archived), S18 (draft) nein
    const locs = entries.map((e) => e.loc)
    const hasNumber = (nr: number) => locs.some((l) => l.includes(`/shop/${nr}-`))
    expect(hasNumber(visible.itemNumber), `Fixture ${visible.itemNumber}`).toBe(true)
    expect(hasNumber(hidden.itemNumber), `Fixture ${hidden.itemNumber}`).toBe(false)
    expect(hasNumber(909)).toBe(false)
    expect(hasNumber(918)).toBe(false)

    // Kategorien mit Slug der Sprache
    expect(byLoc.get(`${SITE}/de/shop/kategorie/keramik`)?.alternates).toEqual({
      de: `${SITE}/de/shop/kategorie/keramik`,
      en: `${SITE}/en/shop/category/ceramics`,
      'x-default': `${SITE}/de/shop/kategorie/keramik`,
    })
    expect(byLoc.get(`${SITE}/en/shop/category/ceramics`)?.lastmod).toBeTruthy()
    // Listen und feste Seiten
    for (const path of ['/de/shop', '/en/shop', '/de/archiv', '/en/archive', '/de/impressum'])
      expect(byLoc.has(`${SITE}${path}`), path).toBe(true)

    // jeder Eintrag: absolute URL, drei Alternates
    for (const e of entries) {
      expect(e.loc.startsWith(`${SITE}/`), e.loc).toBe(true)
      expect(Object.keys(e.alternates).sort(), e.loc).toEqual(['de', 'en', 'x-default'])
    }
    // nie Korb, Kasse, Token-Seiten, Widerruf, Verwaltung (AK-2-04)
    expect(xml).not.toMatch(
      /\/(warenkorb|cart|kasse|checkout|danke|thank-you|bestellung|order|vertrag-widerrufen|withdraw-from-contract)\b/,
    )
    expect(xml.includes(adminRoute)).toBe(false)
    expect(xml).not.toContain('/admin')
  })
})
