import { describe, expect, it } from 'vitest'

import de from '@/i18n/messages/de.json'
import en from '@/i18n/messages/en.json'
import { ROUTE_SAMPLE_PARAMS, pageRoutes } from '@/lib/routes/paths'
import { LOCALES } from '@/lib/routes/registry'
import { organizationJsonLd, serializeJsonLd } from '@/lib/seo/jsonld'
import { buildMetadata, notFoundMetadata, robotsFor } from '@/lib/seo/metadata'
import { disallowedPaths, robotsRules, xRobotsTag } from '@/lib/seo/robots'
import { buildSitemap } from '@/lib/seo/sitemap'

// P2.11 SEO-Grundlagen (KONZEPT §2.5, §3.0.5).

const SITE = 'https://planetclairetattoos.com'
const ADMIN = '/werkstatt'
const livePages = pageRoutes().filter((r) => r.status === 'live')

describe('buildMetadata', () => {
  it('AK-2-05 indexierbare live-Seiten: canonical + hreflang de/en/x-default mit absoluten Apex-URLs', () => {
    const indexable = livePages.filter((r) => r.robots === 'index')
    expect(indexable.map((r) => r.id)).toEqual(
      expect.arrayContaining(['R01', 'R20', 'R21', 'R22', 'R23', 'R24', 'R25', 'R27']),
    )
    for (const route of indexable) {
      for (const locale of LOCALES) {
        const m = buildMetadata(route.id, locale, ROUTE_SAMPLE_PARAMS[route.id]?.[locale] ?? {}, {
          siteUrl: SITE,
          alternateParams: ROUTE_SAMPLE_PARAMS[route.id],
        })
        const canonical = String(m.alternates?.canonical)
        expect(canonical.startsWith(`${SITE}/${locale}`), `${route.id} ${locale}`).toBe(true)
        const languages = m.alternates?.languages as Record<string, string>
        expect(Object.keys(languages).sort()).toEqual(['de', 'en', 'x-default'])
        for (const url of Object.values(languages))
          expect(url).toMatch(/^https:\/\/planetclairetattoos\.com\//)
        expect(languages['x-default']).toBe(languages.de)
        expect(languages[locale]).toBe(canonical)
      }
    }
    const legal = buildMetadata('R21', 'en', {}, { siteUrl: SITE })
    expect(legal.alternates?.canonical).toBe(`${SITE}/en/legal-notice`)
    expect(legal.alternates?.languages).toEqual({
      de: `${SITE}/de/impressum`,
      en: `${SITE}/en/legal-notice`,
      'x-default': `${SITE}/de/impressum`,
    })
  })

  it('Titel „{Seite} · Planet Claire“, Startseite „Planet Claire – {Claim}“, Beschreibung aus den Nachrichten', () => {
    expect(buildMetadata('R21', 'de', {}, { siteUrl: SITE }).title).toEqual({
      absolute: 'Impressum · Planet Claire',
    })
    expect(buildMetadata('R21', 'en', {}, { siteUrl: SITE }).title).toEqual({
      absolute: 'Legal notice · Planet Claire',
    })
    expect(buildMetadata('R01', 'de', {}, { siteUrl: SITE }).title).toEqual({
      absolute: `Planet Claire – ${de.common.claim}`,
    })
    expect(buildMetadata('R01', 'en', {}, { siteUrl: SITE }).description).toBe(
      en.seo.descriptions.home,
    )
    expect(buildMetadata('R22', 'de', {}, { siteUrl: SITE }).description).toBe(
      de.seo.descriptions.legal,
    )
    expect(
      buildMetadata('R21', 'de', {}, { siteUrl: SITE, title: 'X', description: 'Y' }),
    ).toMatchObject({
      title: { absolute: 'X · Planet Claire' },
      description: 'Y',
    })
  })

  it('Beschreibungen DE/EN 120–160 Zeichen (KONZEPT §3.0.5)', () => {
    for (const texts of [de.seo.descriptions, en.seo.descriptions]) {
      for (const [key, text] of Object.entries(texts)) {
        expect(text.length, key).toBeGreaterThanOrEqual(120)
        expect(text.length, key).toBeLessThanOrEqual(160)
      }
    }
  })

  it('robots aus der Registry; R26 „noindex, follow“ ohne canonical/hreflang', () => {
    expect(robotsFor('index')).toEqual({ index: true, follow: true })
    expect(robotsFor('noindex')).toEqual({ index: false })
    const r26 = buildMetadata('R26', 'de', {}, { siteUrl: SITE })
    expect(r26.robots).toEqual({ index: false, follow: true })
    expect(r26.alternates).toBeUndefined()
    expect(buildMetadata('R07', 'de', {}, { siteUrl: SITE }).robots).toEqual({ index: false })
  })

  it('Parameter-Routen: canonical mit Parametern, Alternates mit abweichenden Parametern', () => {
    const m = buildMetadata(
      'R03',
      'de',
      { slug: 'keramik' },
      { siteUrl: SITE, alternateParams: { en: { slug: 'ceramics' } } },
    )
    expect(m.alternates?.canonical).toBe(`${SITE}/de/shop/kategorie/keramik`)
    expect((m.alternates?.languages as Record<string, string>).en).toBe(
      `${SITE}/en/shop/category/ceramics`,
    )
  })
})

describe('robots.txt, X-Robots-Tag, Sitemap', () => {
  it('AK-A-4-03 außerhalb der Produktion Disallow: / und X-Robots-Tag noindex, nofollow', () => {
    for (const env of ['development', 'test', 'preview', 'staging'] as const) {
      expect(xRobotsTag(env)).toBe('noindex, nofollow')
      expect(robotsRules(env, SITE)).toEqual({ rules: { userAgent: '*', disallow: '/' } })
    }
    expect(xRobotsTag('production')).toBeNull()
  })

  it('Produktion: Allow + Sperrliste laut KONZEPT §2.5 + Sitemap', () => {
    const rules = robotsRules('production', SITE)
    expect(rules.sitemap).toBe(`${SITE}/sitemap.xml`)
    expect(rules.rules.allow).toBe('/')
    expect([...disallowedPaths()].sort()).toEqual(
      [
        '/api/',
        '/de/warenkorb',
        '/en/cart',
        '/de/kasse',
        '/en/checkout',
        '/de/danke/',
        '/en/thank-you/',
        '/de/bestellung/',
        '/en/order/',
      ].sort(),
    )
  })

  it('AK-2-04 T-07 der Verwaltungspfad steht weder in robots noch in der Sitemap', () => {
    const text = JSON.stringify([
      robotsRules('production', SITE),
      robotsRules('staging', SITE),
      buildSitemap(SITE),
    ])
    expect(text).not.toContain(ADMIN)
    expect(text).not.toContain('/admin')
  })

  it('Sitemap: indexierbare live-Seiten beider Sprachen mit Alternates', () => {
    const map = buildSitemap(SITE)
    const urls = map.map((e) => e.url)
    expect(urls).toContain(`${SITE}/de`)
    expect(urls).toContain(`${SITE}/en/legal-notice`)
    expect(urls).not.toContain(`${SITE}/de/vertrag-widerrufen`)
    expect(urls.every((u) => u.startsWith(SITE))).toBe(true)
    const legal = map.find((e) => e.url === `${SITE}/de/impressum`)!
    expect(legal.alternates?.languages).toEqual({
      de: `${SITE}/de/impressum`,
      en: `${SITE}/en/legal-notice`,
      'x-default': `${SITE}/de/impressum`,
    })
    // Seiten mit Parametern (Kategorien, Stücke) ergänzt P3.13 mit ihren Daten
    expect(map).toHaveLength(
      livePages.filter((r) => r.robots === 'index' && !r.paths!.de.includes('[')).length * 2,
    )
  })
})

describe('P3.13 Produkt, 404-Varianten, Sitemap mit Daten', () => {
  it('R04: og:type product (kein website-Typ in den Metadaten), metadataBase = Apex-Domain', () => {
    const m = buildMetadata(
      'R04',
      'en',
      { nummer: '017', slug: 'bowl' },
      {
        siteUrl: SITE,
        ogType: 'product',
        alternateParams: { de: { nummer: '017', slug: 'schale' } },
      },
    )
    expect(m.openGraph).not.toHaveProperty('type')
    expect(m.openGraph?.url).toBe(`${SITE}/en/shop/017-bowl`)
    expect(m.openGraph?.locale).toBe('en_GB')
    expect(m.openGraph?.alternateLocale).toEqual(['de_DE'])
    expect(String(m.metadataBase)).toBe(`${SITE}/`)
    expect(m.alternates?.languages).toEqual({
      de: `${SITE}/de/shop/017-schale`,
      en: `${SITE}/en/shop/017-bowl`,
      'x-default': `${SITE}/de/shop/017-schale`,
    })
    expect(buildMetadata('R02', 'de', {}, { siteUrl: SITE }).openGraph).toMatchObject({
      type: 'website',
    })
  })

  it('404-Varianten: noindex, ohne canonical und hreflang, Titel je Variante', () => {
    expect(notFoundMetadata('de')).toEqual({
      title: { absolute: 'Coco hat sich losgerissen · Planet Claire' },
      robots: { index: false },
    })
    expect(notFoundMetadata('en', 'home').title).toEqual({
      absolute: `${en.errors.homeTitle} · Planet Claire`,
    })
    expect(notFoundMetadata('de', 'home')).not.toHaveProperty('alternates')
  })

  it('Sitemap: Kategorien und Stücke beider Sprachen mit Slug der Sprache, Alternates und lastmod', () => {
    const map = buildSitemap(SITE, {
      categories: [
        { slug: { de: 'keramik', en: 'ceramics' }, updatedAt: '2026-09-01T10:00:00.000Z' },
      ],
      products: [
        {
          itemNumber: 901,
          slug: { de: '901-schale', en: '901-bowl' },
          updatedAt: '2026-09-02T10:00:00.000Z',
        },
        { itemNumber: 906, slug: { de: '906-fliese' }, updatedAt: '2026-09-03T10:00:00.000Z' },
      ],
    })
    const byUrl = new Map(map.map((e) => [e.url, e]))
    expect(byUrl.get(`${SITE}/en/shop/category/ceramics`)?.lastModified).toBe(
      '2026-09-01T10:00:00.000Z',
    )
    expect(byUrl.get(`${SITE}/de/shop/901-schale`)?.alternates?.languages).toEqual({
      de: `${SITE}/de/shop/901-schale`,
      en: `${SITE}/en/shop/901-bowl`,
      'x-default': `${SITE}/de/shop/901-schale`,
    })
    // EN fehlt → DE-Slug (KONZEPT §2.3)
    expect(byUrl.has(`${SITE}/en/shop/906-fliese`)).toBe(true)
    expect(byUrl.get(`${SITE}/de/shop/906-fliese`)?.lastModified).toBe('2026-09-03T10:00:00.000Z')
    expect(JSON.stringify(map)).not.toMatch(
      /warenkorb|cart|kasse|checkout|danke|thank-you|bestellung|order\//,
    )
  })
})

describe('Organization-JSON-LD', () => {
  it('E-50 Name, URL, Logo, sameAs Instagram – ohne Adresse; sicher serialisiert', () => {
    const data = organizationJsonLd('https://www.instagram.com/planet.claire.tattoos/', SITE)
    expect(data).toEqual({
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'Planet Claire',
      url: `${SITE}/`,
      logo: `${SITE}/art/wordmark.svg`,
      sameAs: ['https://www.instagram.com/planet.claire.tattoos/'],
    })
    expect(JSON.stringify(data)).not.toMatch(/address|streetAddress|PostalAddress/)
    expect(serializeJsonLd({ a: '</script>' })).toBe('{"a":"\\u003c/script>"}')
  })
})
