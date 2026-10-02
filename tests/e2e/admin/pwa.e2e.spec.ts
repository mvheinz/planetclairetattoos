import { adminPath, expect, test } from '../fixtures'

// P5.29 – Verwaltung als installierbare Web-App (KONZEPT §7.1, ARCHITEKTUR §8.4). Lighthouse hat sein PWA-Audit
// entfernt; die Installierbarkeit prüft Chromium über CDP `Page.getInstallabilityErrors` (AK-7-06). Öffentliche Seiten
// registrieren keinen Service Worker und bekommen kein Manifest (T-04, R-130); `/manifest.webmanifest`,
// `/admin/manifest.webmanifest` und `/sw.js` gibt es nicht.

test('AK-7-06 Verwaltung ist nach Anmeldung unter ADMIN_ROUTE/heute installierbar (keine Installierbarkeits-Fehler)', async ({
  adminPage: page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'CDP nur in Chromium (Projekt desktop)')
  await page.goto(adminPath('/heute'))
  await expect(page.getByTestId('today')).toBeVisible()
  const manifestHref = await page.locator('link[rel="manifest"]').getAttribute('href')
  expect(manifestHref).toBe(adminPath('/manifest.webmanifest'))
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute(
    'href',
    adminPath('/pwa/apple-touch-icon.png'),
  )

  // Service Worker ist aktiv und kontrolliert die Seite im Geltungsbereich ADMIN_ROUTE/
  const scope = await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready
    return reg.scope
  })
  expect(new URL(scope).pathname).toBe(adminPath('/'))

  const res = await page.request.get(adminPath('/manifest.webmanifest'))
  expect(res.status()).toBe(200)
  expect(res.headers()['content-type']).toContain('application/manifest+json')
  const manifest = (await res.json()) as {
    start_url: string
    scope: string
    icons: { src: string }[]
  }
  expect(manifest.start_url).toBe(adminPath('/heute'))
  for (const icon of manifest.icons) {
    const r = await page.request.get(icon.src)
    expect(r.status(), icon.src).toBe(200)
    expect(r.headers()['content-type']).toBe('image/png')
  }
  const sw = await page.request.get(adminPath('/sw.js'))
  expect(sw.status()).toBe(200)
  const swText = await sw.text()
  expect(swText).not.toMatch(/caches\.|push/i)

  const cdp = await page.context().newCDPSession(page)
  await expect(async () => {
    await page.reload()
    await expect(page.getByTestId('today')).toBeVisible()
    const { installabilityErrors } = (await cdp.send('Page.getInstallabilityErrors')) as {
      installabilityErrors: { errorId: string }[]
    }
    expect(installabilityErrors.map((e) => e.errorId)).toEqual([])
  }).toPass({ timeout: 30_000 })
})

test('T-04 /manifest.webmanifest, /admin/manifest.webmanifest und /sw.js → 404; öffentliche Seite ohne Manifest und ohne Service Worker', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'einmal reicht (Projekt desktop)')
  for (const p of [
    '/manifest.webmanifest',
    '/admin/manifest.webmanifest',
    '/sw.js',
    '/admin/sw.js',
  ]) {
    const res = await page.request.get(p, { maxRedirects: 0 })
    expect(res.status(), p).toBe(404)
  }
  await page.goto('/de')
  await expect(page.locator('link[rel="manifest"]')).toHaveCount(0)
  const registrations = await page.evaluate(async () =>
    'serviceWorker' in navigator ? (await navigator.serviceWorker.getRegistrations()).length : 0,
  )
  expect(registrations).toBe(0)
})
