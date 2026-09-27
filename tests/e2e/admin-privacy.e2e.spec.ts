import { adminPath, expect, test } from './fixtures'

// P1.31 – Verwaltung ohne Fremd-Requests (CLAUDE.md §6, ARCHITEKTUR §8.4, R-136): Login, Liste und Formulare laden
// nichts von fremden Hosts – kein Gravatar (`admin.avatar: 'default'`), kein Monaco vom CDN (JSON-Felder als
// Nur-Lese-Anzeige `JsonPreview`). Die Fixture `foreignRequests` blockiert und protokolliert jede solche Anfrage.

test.describe('Verwaltung ohne Fremd-Requests @smoke', () => {
  test('R-136 Login-Seite macht keine Anfrage an fremde Hosts @smoke', async ({
    page,
    foreignRequests,
  }) => {
    // Login-Seite (vor der Anmeldung)
    await page.goto(adminPath('/login'))
    await page.waitForLoadState('networkidle')
    expect(foreignRequests, 'Login-Seite').toEqual([])
  })

  test('R-136 angemeldet: Dashboard, Liste, Stück-Formular und JSON-Felder ohne Fremd-Requests @smoke', async ({
    adminPage: page,
    foreignRequests,
  }) => {
    const views = [
      '', // Dashboard
      '/collections/products',
      '/collections/products/create',
      '/collections/media',
      '/collections/audit-log',
      '/globals/settings', // enthält ein JSON-Feld (sonst Monaco vom CDN)
      '/account',
    ]
    for (const view of views) {
      await page.goto(adminPath(view))
      await page.waitForLoadState('networkidle')
      expect(foreignRequests, view || 'Dashboard').toEqual([])
    }
    // Kein Gravatar-Bild im Konto-Knopf.
    const avatars = await page
      .locator('img')
      .evaluateAll((imgs) =>
        imgs.map((i) => (i as HTMLImageElement).src).filter((s) => /gravatar/i.test(s)),
      )
    expect(avatars).toEqual([])
    // Die JSON-Anzeige ersetzt Monaco (kein Editor-Element).
    await page.goto(adminPath('/globals/settings'))
    await page.waitForLoadState('networkidle')
    await page.locator('.tabs-field__tab-button', { hasText: 'Steuer & Umsatz' }).click()
    await expect(page.getByText('Bereits gemeldete Stufen')).toBeVisible()
    await page.waitForLoadState('networkidle')
    await expect(page.locator('.monaco-editor')).toHaveCount(0)
    expect(foreignRequests).toEqual([])
  })

  test('Gegenprobe: der Wächter erkennt und blockiert eine Fremd-Anfrage', async ({
    page,
    foreignRequests,
  }) => {
    await page.goto(adminPath('/login'))
    await page.evaluate(() => fetch('https://example.com/probe').catch(() => null))
    expect(foreignRequests).toEqual(['https://example.com/probe'])
    foreignRequests.length = 0
  })
})
