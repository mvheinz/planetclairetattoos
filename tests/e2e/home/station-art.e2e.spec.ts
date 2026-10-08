import { expect, test } from '../fixtures'

// P8.14 Stationszeichnungen (DESIGN §12.4, KO-21, E-73): die Startseite zeigt 6 Stationszeichnungen aus
// `src/art/stations/` bzw. dem Coco-Sprite (keine Ersatzzeichnung mehr), `aria-hidden`, Tusche über `currentColor`, ohne Konsolenfehler.
// P13.1 (U-40): Station „Komm näher.“ samt Fitness-Coco entfernt.

const STATION_IDS = ['keramik', 'textil', 'zeichnungen', 'schmuck', 'tattoo', 'jutta-und-coco']

test('P8.14 P13.1: Startseite zeigt 6 Stationszeichnungen ohne Konsolenfehler', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text())
  })
  page.on('pageerror', (err) => errors.push(err.message))
  const res = await page.goto('/de')
  expect(res?.status()).toBe(200)
  const arts = page.locator('[data-home-station] [data-station-art]')
  await expect(arts).toHaveCount(6)
  expect(
    await arts.evaluateAll((els) => els.map((e) => e.getAttribute('data-station-art'))),
  ).toEqual(STATION_IDS)
  for (const id of STATION_IDS) {
    const art = page.locator(`[data-station-art="${id}"]`)
    await expect(art).toHaveAttribute('aria-hidden', 'true')
    const svg = art.locator('svg')
    // „Jutta & Coco“: Coco aus dem Sprite (DESIGN §12.4), bei Jutta & Coco zusätzlich die Planet-Marke
    await expect(svg).toHaveCount(id === 'jutta-und-coco' ? 2 : 1)
    await expect(svg.first()).toBeVisible()
    // Tusche: currentColor löst auf die Tuschefarbe auf (E-73)
    const color = await art.evaluate((el) => getComputedStyle(el).color)
    expect(color, id).toBe('rgb(28, 26, 23)')
  }
  await page.waitForLoadState('load')
  expect(errors).toEqual([])
})
