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

  test.describe('Gegenprobe', () => {
    // Seit P2.12 blockiert schon die CSP (`connect-src 'self'`) die Anfrage im Browser; für die Gegenprobe des
    // Netz-Wächters wird sie hier umgangen.
    test.use({ bypassCSP: true })

    test('Gegenprobe: der Wächter erkennt und blockiert eine Fremd-Anfrage', async ({
      page,
      foreignRequests,
      cspViolations,
      browserName,
    }) => {
      await page.goto(adminPath('/login'))
      await page.evaluate(() => fetch('https://example.com/probe').catch(() => null))
      expect(foreignRequests).toEqual(['https://example.com/probe'])
      foreignRequests.length = 0
      // WebKit ignoriert `bypassCSP`: Die absichtliche Fremd-Anfrage meldet dort zusätzlich einen CSP-Verstoß. Er wird
      // erwartet und geprüft (der CSP-Wächter schlägt also an) und nur dieser eine Eintrag wird entfernt – jeder andere
      // Verstoß lässt den Test weiterhin scheitern.
      const probe = cspViolations.filter((v) => v.includes('example.com/probe'))
      if (browserName === 'webkit') expect(probe.length).toBeGreaterThan(0)
      for (const v of probe) cspViolations.splice(cspViolations.indexOf(v), 1)
      // WebKit meldet dieselbe Anfrage außerdem zweimal ohne URL auf der Konsole (CSP-Block und „Failed to load
      // resource“). Genau diese beiden Zeilen gehören zur Fremd-Anfrage und werden je einmal entfernt; weitere oder
      // andere CSP-Konsolenfehler lassen den Test scheitern.
      if (browserName === 'webkit') {
        for (const text of [
          'console: Blocked by Content Security Policy.',
          'console: Failed to load resource: Blocked by Content Security Policy.',
        ]) {
          const at = cspViolations.indexOf(text)
          if (at >= 0) cspViolations.splice(at, 1)
        }
      }
    })
  })
})
