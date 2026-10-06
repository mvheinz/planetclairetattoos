import { expect, test } from './fixtures'

import { adminRoute, serverURL } from '../helpers/adminEnv'
import { seedTestUser } from '../helpers/seedUser'

// AK-A-8-02, AK-A-2-02 (ARCHITEKTUR §8.4, §2.5): Verwaltung nur unter ADMIN_ROUTE, /admin → 404, kein GraphQL.
test.describe('Verwaltungspfad @smoke', () => {
  test.beforeAll(async () => {
    // Mit Konto zeigt die Verwaltung die Login-Seite (ohne Konto die Ersteinrichtung).
    await seedTestUser()
  })

  test('AK-A-8-02 /admin und /admin/collections/users ergeben 404 @smoke', async ({ request }) => {
    for (const p of [
      '/admin',
      '/admin/collections/users',
      '/admin/login',
      '/admin/create-first-user',
    ]) {
      const res = await request.get(`${serverURL}${p}`, { maxRedirects: 0 })
      expect(res.status(), p).toBe(404)
      expect(await res.text(), p).not.toContain(adminRoute)
    }
    // Next normalisiert den Schrägstrich am Ende (308 auf /admin) – das Ziel ist ebenfalls 404.
    const slash = await request.get(`${serverURL}/admin/`)
    expect(slash.status()).toBe(404)
  })

  test('AK-A-8-02 ADMIN_ROUTE zeigt die Login-Seite @smoke', async ({ page }) => {
    await page.goto(`${serverURL}${adminRoute}`)
    await expect(page).toHaveURL(new RegExp(`${adminRoute}/login`))
    await expect(page.locator('#field-email')).toBeVisible()
    await expect(page.locator('#field-password')).toBeVisible()
  })

  test('AK-A-2-02 GET /api/graphql ergibt 404 @smoke', async ({ request }) => {
    for (const method of ['get', 'post'] as const) {
      const res = await request[method](`${serverURL}/api/graphql`, { maxRedirects: 0 })
      expect(res.status(), method).toBe(404)
    }
    const playground = await request.get(`${serverURL}/api/graphql-playground`)
    expect(playground.status()).toBe(404)
  })

  test('AK-2-04 öffentliche Startseite enthält den Verwaltungspfad nicht @smoke', async ({
    request,
  }) => {
    const res = await request.get(`${serverURL}/`)
    expect(res.status()).toBe(200)
    expect(await res.text()).not.toContain(adminRoute)
  })

  test('AK-A-2-01 /api/health antwortet ohne Datenbank @smoke', async ({ request }) => {
    const res = await request.get(`${serverURL}/api/health`)
    expect(res.status()).toBe(200)
    expect(res.headers()['cache-control']).toBe('no-store')
    expect(await res.json()).toMatchObject({ status: 'ok' })
  })
})
