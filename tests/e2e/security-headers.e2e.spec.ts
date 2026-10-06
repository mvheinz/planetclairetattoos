import { pageRoutes, hasSamplePath, samplePath } from '../../src/lib/routes/paths'
import { LOCALES } from '../../src/lib/routes/registry'
import { adminRoute } from '../helpers/adminEnv'
import { watchCsp } from './csp'
import { expect, test } from './fixtures'

// P2.12 Sicherheits-Header und CSP (ARCHITEKTUR §8.1, Spike B-03, CSP-Teil von B-01): Header je Kontext
// (AK-A-8-01/T-16), `/api/health` im Kontext `api` (R-136), keine CSP-Verstöße auf `live`-Routen und in der Verwaltung.
// P4.5: Kassen-Kontext (Permissions-Policy/COOP, Stripe-Hosts nur mit PAYMENTS_DRIVER=stripe, sonst nirgends).

// Token-Seiten (R08, R09): Header prüfen `tests/e2e/checkout/thank-you` und `tests/e2e/order/order-status`.
const livePages = pageRoutes().filter((r) => r.status === 'live' && hasSamplePath(r))

const BASE = {
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'cross-origin-opener-policy': 'same-origin',
  'permissions-policy':
    'camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()',
}

/** Treiber des laufenden Servers (E2E: `mock` aus `.env.example`). */
const PAYMENTS_DRIVER = process.env.PAYMENTS_DRIVER ?? 'mock'

/** Kasse (P4.5, §8.1): eigene Permissions-Policy (Zahlung) und COOP für PayPal-/3DS-Fenster. */
const CHECKOUT = {
  ...BASE,
  'cross-origin-opener-policy': 'same-origin-allow-popups',
  'permissions-policy': BASE['permissions-policy'].replace(
    'payment=()',
    PAYMENTS_DRIVER === 'stripe' ? 'payment=(self "https://js.stripe.com")' : 'payment=(self)',
  ),
}

const CSP_CORE = [
  "default-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'",
]

test.describe('Sicherheits-Header', () => {
  test('AK-A-8-01 T-16 jede live-Route trägt die Header ihres Kontexts (DE/EN, inkl. 404) @smoke', async ({
    request,
  }) => {
    test.slow() // Entwicklungsserver: jede Seite wird beim ersten Aufruf übersetzt
    const cases = [
      ...livePages.flatMap((r) =>
        LOCALES.map((l) => ({ path: samplePath(r.id, l), context: r.headerContext })),
      ),
      { path: '/de/gibt-es-nicht', context: 'public' as const },
    ]
    const nonces = new Set<string>()
    for (const { path, context } of cases) {
      // Die Kasse ohne `pc_checkout` antwortet mit 307 auf den Korb (P4.9) – die Header gelten schon dieser Antwort.
      const res = await request.get(path, context === 'checkout' ? { maxRedirects: 0 } : {})
      const h = res.headers()
      expect(h, path).toMatchObject(context === 'checkout' ? CHECKOUT : BASE)
      expect(h['referrer-policy'], path).toBe('strict-origin-when-cross-origin')
      const csp = h['content-security-policy'] ?? ''
      for (const part of CSP_CORE) expect(csp, `${path}: ${part}`).toContain(part)
      // Fremde Hosts höchstens auf der Kasse und nur mit PAYMENTS_DRIVER=stripe (P4.5, R-131).
      if (context !== 'checkout' || PAYMENTS_DRIVER !== 'stripe') {
        expect(csp, path).not.toMatch(/https?:\/\//)
      }
      if (context === 'public') {
        expect(csp, path).not.toContain("'nonce-")
        expect(csp, path).toContain("frame-src 'none'")
      } else {
        const nonce = /'nonce-([^']+)'/.exec(csp)?.[1]
        expect(nonce, path).toBeTruthy()
        expect(csp, path).toContain("'strict-dynamic'")
        nonces.add(nonce!)
        // Next hängt die Nonce an seine Skripte.
        expect(await res.text(), path).toContain(`nonce="${nonce}"`)
      }
      // Genau eine CSP (kein zweiter Header aus next.config und Proxy).
      expect(
        res.headersArray().filter((x) => x.name.toLowerCase() === 'content-security-policy'),
        path,
      ).toHaveLength(1)
    }
    // Nonce je Anfrage neu
    expect(nonces.size).toBe(cases.filter((c) => c.context !== 'public').length)
  })

  test('P4.5 T-16 Kasse (R07): Kontext checkout; Stripe-Hosts nur bei PAYMENTS_DRIVER=stripe, sonst nirgends', async ({
    request,
  }) => {
    const checkoutRoutes = pageRoutes().filter((r) => r.headerContext === 'checkout')
    expect(checkoutRoutes.map((r) => r.id)).toEqual(['R07'])
    // Stripe-Skripte nur auf der Kasse (CLAUDE.md §6): keine andere live-Route nennt einen Stripe-Host.
    for (const r of livePages.filter((p) => p.headerContext !== 'checkout')) {
      for (const l of LOCALES) {
        const path = samplePath(r.id, l)
        const res = await request.get(path)
        expect(res.headers()['content-security-policy'], path).not.toMatch(/stripe/i)
        expect(await res.text(), path).not.toMatch(/js\.stripe\.com/)
      }
    }
    for (const r of checkoutRoutes) {
      for (const l of LOCALES) {
        const path = samplePath(r.id, l)
        const res = await request.get(path, { maxRedirects: 0 })
        const h = res.headers()
        const csp = h['content-security-policy'] ?? ''
        if (r.status !== 'live') {
          // Kasse noch nicht gebaut: statische Antwort ohne Kassen-Kontext und ohne Stripe.
          expect(csp, path).not.toMatch(/stripe/i)
          continue
        }
        expect(h, path).toMatchObject(CHECKOUT)
        expect(h['cache-control'], path).toMatch(/private, no-store|no-(store|cache)/)
        expect(csp, path).toMatch(/script-src 'self' 'nonce-[^']+' 'strict-dynamic'/)
        if (PAYMENTS_DRIVER === 'stripe') {
          expect(csp, path).toContain('https://js.stripe.com')
          expect(csp, path).toContain("connect-src 'self' https://api.stripe.com")
        } else {
          expect(csp, path).not.toMatch(/stripe/i)
          expect(csp, path).toContain("frame-src 'none'")
        }
      }
    }
  })

  test('R-136 /api/health trägt den Kontext api', async ({ request }) => {
    const res = await request.get('/api/health')
    expect(res.headers()['content-security-policy']).toBe(
      "default-src 'none'; frame-ancestors 'none'",
    )
    expect(res.headers()).toMatchObject(BASE)
  })

  test('Verwaltung: Kontext admin (Nonce, camera=(self), noindex, no-store)', async ({
    request,
  }) => {
    const res = await request.get(`${adminRoute}/login`)
    const h = res.headers()
    expect(h['content-security-policy']).toMatch(/script-src 'self' 'nonce-[^']+' 'strict-dynamic'/)
    expect(h['content-security-policy']).toContain("worker-src 'self'")
    expect(h['permissions-policy']).toContain('camera=(self)')
    expect(h['x-robots-tag']).toBe('noindex, nofollow')
    // `next dev` setzt für dynamische Antworten selbst `no-cache, must-revalidate`; maßgeblich ist der Produktions-Build.
    if (process.env.E2E_SERVER === 'start') expect(h['cache-control']).toBe('no-store')
    else expect(h['cache-control']).toMatch(/no-(store|cache)/)
  })
})

test.describe('Keine CSP-Verstöße', () => {
  test('R-131 auf keiner live-Route ein CSP-Verstoß (DE/EN, inkl. 404) @smoke', async ({
    page,
  }) => {
    // Jede live-Seite nacheinander bis `networkidle` – mit den Listen aus P3 mehr als 30 s
    test.slow()
    const violations = await watchCsp(page)
    const paths = [
      ...livePages.flatMap((r) => LOCALES.map((l) => samplePath(r.id, l))),
      '/de/gibt-es-nicht',
    ]
    const found: string[] = []
    for (const path of paths) {
      await page.goto(path)
      await page.waitForLoadState('networkidle')
      // Das Inline-Skript `pc-motion` läuft (Schalter nutzt es beim Neuladen).
      found.push(...(await violations()).map((v) => `${path}: ${v}`))
    }
    expect(found).toEqual([])
  })

  test('B-01 Login der Verwaltung ohne CSP-Verstoß', async ({ page }) => {
    const violations = await watchCsp(page)
    await page.goto(`${adminRoute}/login`)
    await expect(page.locator('input[name="email"]')).toBeVisible()
    await page.waitForLoadState('networkidle')
    expect(await violations()).toEqual([])
  })

  test('B-01 Liste und Bearbeiten der Verwaltung ohne CSP-Verstoß', async ({ adminPage }) => {
    const violations = await watchCsp(adminPage)
    await adminPage.goto(`${adminRoute}/collections/users`)
    await expect(adminPage.locator('table, [class*="table"]').first()).toBeVisible()
    await adminPage.waitForLoadState('networkidle')
    const list = await violations()
    await adminPage.locator('table a[href*="/collections/users/"]').first().click()
    await expect(adminPage.locator('input[name="email"]')).toBeVisible()
    await adminPage.waitForLoadState('networkidle')
    expect([...list, ...(await violations())]).toEqual([])
  })
})

// P10.5 (T-16, AK-A-8-01/-02, AK-A-4-03): Audit über alle Registry-Routen und alle Kontexte.
const ROBOTS = 'noindex, nofollow' // E2E läuft mit APP_ENV=test: außerhalb von Produktion überall noindex (AK-A-4-03)

test.describe('P10.5 Sicherheits-Audit', () => {
  test('AK-A-4-03 jede Antwort trägt außerhalb von Produktion X-Robots-Tag und keinen HSTS', async ({
    request,
  }) => {
    const paths = [
      ...pageRoutes()
        .filter((r) => hasSamplePath(r))
        .flatMap((r) => LOCALES.map((l) => samplePath(r.id, l))),
      '/de/gibt-es-nicht',
      '/admin', // 404 des Proxys
      '/api/health',
      '/robots.txt',
    ]
    for (const path of paths) {
      const res = await request.get(path, { maxRedirects: 0 })
      const h = res.headers()
      expect(h['x-robots-tag'], path).toBe(ROBOTS)
      expect(h['strict-transport-security'], path).toBeUndefined()
      expect(h['x-content-type-options'], path).toBe('nosniff')
    }
  })

  test('AK-A-8-01 Kontext api: jeder API-Endpunkt trägt default-src none und die Grundheader (auch bei Fehlern)', async ({
    request,
  }) => {
    const calls: { method: 'GET' | 'POST'; path: string }[] = [
      { method: 'GET', path: '/api/health' },
      { method: 'GET', path: '/api/health/freshness' },
      { method: 'GET', path: '/api/public/product-status?ids=1' },
      { method: 'POST', path: '/api/client-errors' },
      { method: 'GET', path: '/api/cron/tick' },
      { method: 'GET', path: '/api/cron/run/retention' },
      { method: 'POST', path: '/api/stripe/webhook' },
      { method: 'POST', path: '/api/uploads/commission' },
      { method: 'GET', path: '/api/checkout/ungueltig/state' },
      { method: 'GET', path: '/api/orders/ungueltig/documents/x.pdf' },
      { method: 'GET', path: '/api/privacy-export/ungueltig' },
      { method: 'GET', path: '/api/legal/gibt-es-nicht' },
      { method: 'GET', path: '/api/gibt-es-nicht' },
      { method: 'GET', path: '/api/graphql' },
      { method: 'GET', path: '/api/private-uploads/file/gibt-es-nicht.pdf' },
      { method: 'GET', path: '/api/users/me' },
    ]
    for (const { method, path } of calls) {
      const res = await request.fetch(path, {
        method,
        maxRedirects: 0,
        data: method === 'POST' ? '{}' : undefined,
      })
      const label = `${method} ${path} → ${res.status()}`
      expect(res.status(), label).toBeLessThan(500)
      const h = res.headers()
      expect(h, label).toMatchObject(BASE)
      expect(h['referrer-policy'], label).toBe('strict-origin-when-cross-origin')
      expect(h['content-security-policy'], label).toBe("default-src 'none'; frame-ancestors 'none'")
      expect(h['x-robots-tag'], label).toBe(ROBOTS)
    }
  })

  test('R-136 AK-A-8-02 private Datei ohne Anmeldung 403, GraphQL und /admin 404, Verwaltungspfad in keinem öffentlichen HTML', async ({
    request,
  }) => {
    const priv = await request.get('/api/private-uploads/file/beleg.pdf')
    expect([401, 403]).toContain(priv.status())
    for (const p of ['/admin', '/admin/collections/users', '/api/graphql'])
      expect((await request.get(p, { maxRedirects: 0 })).status(), p).toBe(404)
    const login = await request.get(adminRoute, { maxRedirects: 0 })
    expect([200, 307]).toContain(login.status())
    for (const r of pageRoutes().filter((x) => hasSamplePath(x))) {
      for (const l of LOCALES) {
        const path = samplePath(r.id, l)
        const res = await request.get(path, { maxRedirects: 0 })
        expect(await res.text(), path).not.toContain(adminRoute)
      }
    }
  })

  test('Kontext admin: Login, Manifest und Service Worker tragen Nonce-CSP, camera=(self), noindex', async ({
    request,
  }) => {
    for (const p of ['/login', '/forgot', '/manifest.webmanifest', '/sw.js']) {
      const res = await request.get(`${adminRoute}${p}`, { maxRedirects: 0 })
      const label = `${adminRoute}${p} → ${res.status()}`
      const h = res.headers()
      expect(res.status(), label).toBeLessThan(500)
      expect(h['content-security-policy'], label).toMatch(
        /script-src 'self' 'nonce-[^']+' 'strict-dynamic'/,
      )
      expect(h['content-security-policy'], label).not.toContain("'unsafe-inline' 'nonce")
      expect(h['permissions-policy'], label).toContain('camera=(self)')
      expect(h['x-robots-tag'], label).toBe(ROBOTS)
      expect(h['x-frame-options'], label).toBe('DENY')
    }
  })

  test('CSP-Verstöße lassen Tests scheitern: der Wächter fängt securitypolicyviolation (Selbsttest)', async ({
    page,
    cspViolations,
  }) => {
    await page.goto('/de')
    // Kontext `dynamic` (Nonce, ohne unsafe-inline): ein Inline-Ereignis-Handler ist verboten und löst den Verstoß aus.
    await page.goto('/de/warenkorb')
    await page.evaluate(() => {
      document.body.insertAdjacentHTML(
        'beforeend',
        '<img alt="" src="/__csp-selbsttest.png" onerror="window.__csp_test=1">',
      )
    })
    await expect.poll(() => cspViolations.length).toBeGreaterThan(0)
    cspViolations.length = 0 // erwartet – der Wächter am Testende bleibt grün
  })
})
