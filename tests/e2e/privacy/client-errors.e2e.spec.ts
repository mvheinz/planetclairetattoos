import { expect, test } from '../fixtures'

// R-133: Standard – kein Sentry-Browser-SDK und kein Fehler-Skript auf öffentlichen Seiten, keine Anfrage an
// `/api/client-errors` oder einen Sentry-Host, kein Endgeräte-Speicher. (Läuft mit den Standardwerten, Schalter aus.)

for (const path of ['/de', '/en', '/de/shop']) {
  test(`R-133 T-04: ${path} lädt kein Sentry- und kein Fehler-Skript und meldet nichts @privacy`, async ({
    page,
    context,
  }) => {
    const reports: string[] = []
    page.on('request', (r) => {
      if (/\/api\/client-errors|sentry/i.test(r.url())) reports.push(r.url())
    })
    await page.goto(path)
    await page.waitForLoadState('networkidle')
    expect(reports).toEqual([])
    expect(await page.locator('script[src*="sentry"]').count()).toBe(0)
    const html = await page.content()
    expect(html).not.toMatch(/sentry/i)
    expect(html).not.toContain('/api/client-errors')
    expect(await context.cookies()).toEqual([])
    expect(
      await page.evaluate(() => [...Object.keys(localStorage), ...Object.keys(sessionStorage)]),
    ).toEqual([])
  })
}
