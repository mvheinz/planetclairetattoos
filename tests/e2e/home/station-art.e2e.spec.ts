import { expect, test } from '@playwright/test'

// P8.14 Stationszeichnungen (DESIGN §12.4, KO-21, E-73): die Startseite zeigt 7 Stationszeichnungen aus
// `src/art/stations/` (keine Ersatzzeichnung mehr), `aria-hidden`, Tusche über `currentColor`, ohne Konsolenfehler.

const STATION_IDS = [
  'hallo',
  'keramik',
  'textil',
  'zeichnungen',
  'schmuck',
  'tattoo',
  'jutta-und-coco',
]

test('P8.14: Startseite zeigt 7 Stationszeichnungen ohne Konsolenfehler', async ({ page }) => {
  const errors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text())
  })
  page.on('pageerror', (err) => errors.push(err.message))
  const res = await page.goto('/de')
  expect(res?.status()).toBe(200)
  const arts = page.locator('[data-home-station] [data-station-art]')
  await expect(arts).toHaveCount(7)
  expect(
    await arts.evaluateAll((els) => els.map((e) => e.getAttribute('data-station-art'))),
  ).toEqual(STATION_IDS)
  for (const id of STATION_IDS) {
    const art = page.locator(`[data-station-art="${id}"]`)
    await expect(art).toHaveAttribute('aria-hidden', 'true')
    const svg = art.locator('svg')
    await expect(svg).toHaveCount(1)
    await expect(svg).toBeVisible()
    // Tusche: currentColor löst auf die Tuschefarbe auf (E-73)
    const color = await art.evaluate((el) => getComputedStyle(el).color)
    expect(color, id).toBe('rgb(28, 26, 23)')
  }
  await page.waitForLoadState('load')
  expect(errors).toEqual([])
})
