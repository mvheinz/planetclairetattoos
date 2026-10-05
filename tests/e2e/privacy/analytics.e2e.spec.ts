import { expect, test } from '../fixtures'

// P10.11 R-132: Statistik standardmäßig aus – kein Skript, keine Anfrage an `/_vercel/insights`, kein Endgeräte-Speicher.
// (Läuft mit den Standardwerten `NEXT_PUBLIC_ANALYTICS_ENABLED=false`.)

for (const path of ['/de', '/en', '/de/shop']) {
  test(`R-132 T-04: ${path} lädt kein Statistik-Skript und fragt nicht bei /_vercel/insights an @privacy`, async ({
    page,
    context,
  }) => {
    const insights: string[] = []
    page.on('request', (r) => {
      if (r.url().includes('/_vercel/')) insights.push(r.url())
    })
    await page.goto(path)
    await page.waitForLoadState('networkidle')
    expect(insights).toEqual([])
    expect(await page.locator('script[src*="_vercel"]').count()).toBe(0)
    expect(await page.content()).not.toContain('_vercel/insights')
    expect(await context.cookies()).toEqual([])
    expect(
      await page.evaluate(() => [...Object.keys(localStorage), ...Object.keys(sessionStorage)]),
    ).toEqual([])
  })
}
