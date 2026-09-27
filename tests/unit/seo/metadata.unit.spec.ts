import { describe, expect, it } from 'vitest'

import de from '@/i18n/messages/de.json'
import en from '@/i18n/messages/en.json'
import { pageRoutes } from '@/lib/routes/paths'
import { LOCALES } from '@/lib/routes/registry'
import { organizationJsonLd, serializeJsonLd } from '@/lib/seo/jsonLd'
import { buildMetadata, robotsFor } from '@/lib/seo/metadata'
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
        const m = buildMetadata(route.id, locale, {}, { siteUrl: SITE })
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
    expect(map).toHaveLength(livePages.filter((r) => r.robots === 'index').length * 2)
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
