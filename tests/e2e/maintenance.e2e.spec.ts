import { expect, test } from '@playwright/test'

// P10.7 Wartungsmodus (R-090, AK-3-11): läuft nur über `pnpm test:e2e:maintenance` (Server mit MAINTENANCE_MODE=true).
test.describe('Wartungsmodus @maintenance', () => {
  test('R-090 Shop und Kasse antworten 503 in Juttas Ton; Fußlink „Vertrag widerrufen“ (AK-3-11)', async ({
    page,
  }) => {
    for (const path of ['/de/shop', '/de/kasse', '/de']) {
      const res = await page.goto(path)
      expect(res?.status(), path).toBe(503)
      await expect(page.locator('h1')).toContainText('Pause')
      await expect(page.locator('[data-site-footer] [data-withdraw-link]')).toHaveAttribute(
        'href',
        '/de/vertrag-widerrufen',
      )
    }
    const en = await page.goto('/en/shop')
    expect(en?.status()).toBe(503)
    await expect(page.locator('[data-withdraw-link]')).toHaveText('Withdraw from contract here')
  })

  test('Rechtstexte bleiben erreichbar', async ({ page }) => {
    for (const path of ['/de/impressum', '/de/datenschutz', '/de/agb', '/de/widerrufsbelehrung']) {
      expect((await page.goto(path))?.status(), path).toBe(200)
    }
  })

  test('R-090 Widerrufsformular (R26) ist mit erreichbarer Datenbank vollständig nutzbar', async ({
    page,
  }) => {
    expect((await page.goto('/de/vertrag-widerrufen'))?.status()).toBe(200)
    await expect(page.locator('[data-withdraw-mailto]')).toHaveCount(0)
    await page.getByLabel('Name').fill('Wartung Beispiel')
    await page.getByLabel(/Bestellnummer oder andere Angaben/).fill('Bestellung ohne Nummer')
    await page.getByLabel(/E-Mail für die Eingangsbestätigung/).fill('wartung@planetclaire.local')
    await page.getByRole('button', { name: 'Weiter' }).click()
    await expect(page.getByText('Schritt 2 von 2')).toBeVisible()
    await page.getByRole('button', { name: /Widerruf bestätigen/ }).click()
    await expect(page.getByText('Dein Widerruf ist eingegangen')).toBeVisible()
  })

  test('Schnittstellen: Webhook 503, Kasse-Zustand 503, Health bleibt 200 mit maintenance', async ({
    request,
  }) => {
    expect((await request.post('/api/stripe/webhook', { data: '{}' })).status()).toBe(503)
    expect((await request.get('/api/checkout/abc/state')).status()).toBe(503)
    const f = await request.get('/api/health/freshness')
    expect(f.status()).toBe(200)
    expect(await f.json()).toEqual({ maintenance: true })
  })
})
