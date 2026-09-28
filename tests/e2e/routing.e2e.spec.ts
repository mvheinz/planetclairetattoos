import { test, expect, request as playwrightRequest, type APIResponse } from '@playwright/test'

import { shortLinks } from '../../src/lib/routes/registry'
import { localizedPath } from '../../src/lib/routes/paths'
import { adminRoute, serverURL } from '../helpers/adminEnv'

// ARCHITEKTUR §2.3, KONZEPT §2.4: Sprachumleitung, Kurz-URLs, Aliasse, Schrägstrich, Verwaltungspfad.
/** Ziel einer Weiterleitung als Pfad + Query (absolute und relative `Location` gleich behandelt). */
const target = (res: APIResponse) => {
  const u = new URL(res.headers()['location'] ?? '', serverURL)
  return u.pathname + u.search
}

const noCookie = (res: APIResponse) => {
  expect(res.headers()['set-cookie'], res.url()).toBeUndefined()
}

test.describe('Routing @smoke', () => {
  test('AK-2-02 GET / → 307 nach Accept-Language, ohne Cookie @smoke', async () => {
    const ctx = await playwrightRequest.newContext({ baseURL: serverURL })
    try {
      const en = await ctx.get('/', {
        maxRedirects: 0,
        headers: { 'accept-language': 'en-US,en;q=0.9' },
      })
      expect(en.status()).toBe(307)
      expect(target(en)).toBe('/en')
      expect(en.headers()['vary']).toMatch(/accept-language/i)
      noCookie(en)

      const none = await ctx.get('/', { maxRedirects: 0 })
      expect(none.status()).toBe(307)
      expect(target(none)).toBe('/de')
      noCookie(none)

      const fr = await ctx.get('/', { maxRedirects: 0, headers: { 'accept-language': 'fr' } })
      expect(target(fr)).toBe('/de')
    } finally {
      await ctx.dispose()
    }
  })

  test('R-010 AK-A-2-04 Kurz-URLs → 308 auf die kanonische DE-Route, ohne Cookie @smoke', async ({
    request,
  }) => {
    expect(shortLinks).toHaveLength(7)
    for (const s of shortLinks) {
      const res = await request.get(`${serverURL}${s.path}`, {
        maxRedirects: 0,
        headers: { 'accept-language': 'en' },
      })
      expect(res.status(), s.path).toBe(308)
      expect(new URL(res.headers()['location']!, serverURL).pathname, s.path).toBe(
        localizedPath(s.routeId, 'de'),
      )
      noCookie(res)
    }
  })

  test('AK-A-2-04 Pfad der anderen Sprache und Aliasse → 308 @smoke', async ({ request }) => {
    const cases: [string, string][] = [
      ['/en/vertrag-widerrufen', '/en/withdraw-from-contract'],
      ['/en/impressum', '/en/legal-notice'],
      ['/en/imprint', '/en/legal-notice'],
      ['/de/legal-notice', '/de/impressum'],
    ]
    for (const [from, to] of cases) {
      const res = await request.get(`${serverURL}${from}`, { maxRedirects: 0 })
      expect(res.status(), from).toBe(308)
      expect(target(res), from).toBe(to)
      noCookie(res)
    }
  })

  test('/de/ → 308 /de; lokalisierte Seiten liefern 200 ohne Cookie @smoke', async ({
    request,
  }) => {
    const slash = await request.get(`${serverURL}/de/`, { maxRedirects: 0 })
    expect(slash.status()).toBe(308)
    expect(new URL(slash.headers()['location']!, serverURL).pathname).toBe('/de')

    for (const p of ['/de', '/en', '/de/impressum', '/en/legal-notice', '/de/vertrag-widerrufen']) {
      const res = await request.get(`${serverURL}${p}`, { maxRedirects: 0 })
      expect(res.status(), p).toBe(200)
      noCookie(res)
    }
  })

  test('unpräfixierter Pfad → 307 in die erkannte Sprache (übersetzt) @smoke', async ({
    request,
  }) => {
    const res = await request.get(`${serverURL}/legal-notice`, {
      maxRedirects: 0,
      headers: { 'accept-language': 'de-DE' },
    })
    expect(res.status()).toBe(307)
    expect(target(res)).toBe('/de/impressum')
    noCookie(res)
  })

  test('www.-Host → 308 auf den Apex-Host @smoke', async ({ request }) => {
    const site = new URL(serverURL)
    const res = await request.get(`${serverURL}/de/impressum?x=1`, {
      maxRedirects: 0,
      headers: { host: `www.${site.host}` },
    })
    expect(res.status()).toBe(308)
    // Next kürzt eine Weiterleitung auf den eigenen Ursprung zu einem relativen Pfad; hier ist der Apex-Host
    // (NEXT_PUBLIC_SITE_URL) zugleich der Test-Server. Absolute Ziele müssen auf den Apex-Ursprung zeigen.
    const location = res.headers()['location'] ?? ''
    if (/^https?:/.test(location)) expect(new URL(location).origin).toBe(site.origin)
    expect(target(res)).toBe('/de/impressum?x=1')
  })

  test('AK-A-8-02 /admin bleibt 404, ADMIN_ROUTE zeigt die Verwaltung @smoke', async ({
    request,
  }) => {
    const admin = await request.get(`${serverURL}/admin`, { maxRedirects: 0 })
    expect(admin.status()).toBe(404)
    const werkstatt = await request.get(`${serverURL}${adminRoute}/login`, { maxRedirects: 0 })
    expect(werkstatt.status()).toBe(200)
    expect(await werkstatt.text()).toContain('email')
  })
})
