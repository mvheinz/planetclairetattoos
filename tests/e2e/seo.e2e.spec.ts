import { expect, test } from './fixtures'

import { pageRoutes, hasSamplePath, samplePath } from '../../src/lib/routes/paths'
import { LOCALES } from '../../src/lib/routes/registry'
import { adminRoute } from '../helpers/adminEnv'

// P2.11 SEO-Grundlagen (KONZEPT §2.5, ARCHITEKTUR §4.2): canonical/hreflang (AK-2-05), Verwaltungspfad nirgends
// öffentlich (AK-2-04, T-07), `X-Robots-Tag` und `robots.txt` außerhalb der Produktion (AK-A-4-03). Der E2E-Server
// läuft nie mit `APP_ENV=production`; die Produktionsregeln prüft der Unit-Test.

const SITE = (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '')
// Token-Seiten (R08, R09) prüfen ihre eigenen Suiten mit Fixture-Bestellungen.
const livePages = pageRoutes().filter((r) => r.status === 'live' && hasSamplePath(r))
const indexable = livePages.filter((r) => r.robots === 'index')

test.describe('SEO', () => {
  test('AK-2-05 jede indexierbare live-Seite hat canonical und drei hreflang-Links mit absoluten URLs', async ({
    page,
  }) => {
    for (const route of indexable) {
      for (const locale of LOCALES) {
        const path = samplePath(route.id, locale)
        await page.goto(path)
        await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
          'href',
          `${SITE}${path}`,
        )
        const alternates = await page
          .locator('link[rel="alternate"][hreflang]')
          .evaluateAll((els) =>
            Object.fromEntries(
              els.map((e) => [e.getAttribute('hreflang'), e.getAttribute('href')]),
            ),
          )
        expect(alternates, path).toEqual({
          de: `${SITE}${samplePath(route.id, 'de')}`,
          en: `${SITE}${samplePath(route.id, 'en')}`,
          'x-default': `${SITE}${samplePath(route.id, 'de')}`,
        })
        await expect(page).toHaveTitle(/ · Planet Claire$| – /)
        await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /.{120,}/)
      }
    }
  })

  test('R26 hat noindex, follow und keine hreflang-Links', async ({ page }) => {
    await page.goto('/de/vertrag-widerrufen')
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, follow')
    await expect(page.locator('link[rel="alternate"][hreflang]')).toHaveCount(0)
    await expect(page.locator('link[rel="canonical"]')).toHaveCount(0)
  })

  test('Startseite: Organization-JSON-LD ohne Adresse', async ({ page }) => {
    await page.goto('/de')
    const raw = await page.locator('script[type="application/ld+json"]').first().textContent()
    const data = JSON.parse(raw ?? '{}') as Record<string, unknown>
    expect(data).toMatchObject({
      '@type': 'Organization',
      name: 'Planet Claire',
      url: `${SITE}/`,
    })
    expect(String((data.sameAs as string[])[0])).toMatch(/^https:\/\/www\.instagram\.com\//)
    expect(raw).not.toMatch(/address/i)
  })

  test('AK-2-04 T-07 Verwaltungspfad weder in robots.txt noch in sitemap.xml noch im öffentlichen HTML', async ({
    request,
  }) => {
    const bodies: [string, string][] = []
    for (const path of ['/robots.txt', '/sitemap.xml']) {
      const res = await request.get(path)
      expect(res.status(), path).toBe(200)
      bodies.push([path, await res.text()])
    }
    for (const route of livePages) {
      for (const locale of LOCALES) {
        const path = samplePath(route.id, locale)
        bodies.push([path, await (await request.get(path)).text()])
      }
    }
    bodies.push(['404', await (await request.get('/de/gibt-es-nicht')).text()])
    for (const [path, body] of bodies) {
      expect(body.includes(adminRoute), `${path} enthält ${adminRoute}`).toBe(false)
    }
    const sitemap = bodies.find(([p]) => p === '/sitemap.xml')![1]
    expect(sitemap).toContain(`<loc>${SITE}/de/impressum</loc>`)
    expect(sitemap).toContain('hreflang="x-default"')
  })

  test('AK-A-4-03 außerhalb der Produktion: X-Robots-Tag auf allen Antworten, robots.txt Disallow: /', async ({
    request,
  }) => {
    const robots = await request.get('/robots.txt')
    expect(await robots.text()).toMatch(/Disallow: \/\s*$/m)
    expect(await robots.text()).not.toMatch(/Allow: \/\n/)
    const paths = [
      '/de',
      '/en/legal-notice',
      '/de/vertrag-widerrufen',
      '/de/gibt-es-nicht',
      '/robots.txt',
      '/sitemap.xml',
      '/api/health',
      '/icon.svg',
      '/admin',
      adminRoute,
    ]
    for (const path of paths) {
      const res = await request.get(path, { maxRedirects: 0 })
      expect(res.headers()['x-robots-tag'], path).toBe('noindex, nofollow')
    }
    // Weiterleitungen des Proxys ebenso
    const redirect = await request.get('/', { maxRedirects: 0 })
    expect(redirect.status()).toBe(307)
    expect(redirect.headers()['x-robots-tag']).toBe('noindex, nofollow')
  })
})
