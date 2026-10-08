import { expect, test } from './fixtures'
import { type Page } from '@playwright/test'

// P9.15 Choreografie der Startseite (DESIGN §11.4, MO-08): Pose je Station über `__leash.pose()` – Ankunft und Verweilen
// (Kopf-Station 1,2 s → kopfschief, Textil 1,5 s → kopfschief, Schmuck: Sprung-Sequenz endet sitzend), Scrollstopp
// zwischen den Stationen → sitzen, Coco-Box ragt nicht in den Text (LG-01, Rinne).

type Win = Window & {
  __leash?: {
    pose(): string | null
    setReadingY(y: number | null): void
    cocoLen(): number
    geometry: { stations: { id: string; y: number; loopLen0: number; loopLen1: number }[] } | null
  }
}

const ARRIVE: Record<string, string> = {
  'planet-claire': 'sitzen',
  hallo: 'sitzen',
  keramik: 'schnueffeln',
  textil: 'schnueffeln',
  zeichnungen: 'sitzen',
  schmuck: 'sitzen',
  tattoo: 'kopfschief',
  'jutta-und-coco': 'sitzen',
}
const DWELL: Record<string, string> = { 'planet-claire': 'kopfschief', textil: 'kopfschief' }

const loopScroll = (id: string, vw: number) =>
  id === 'planet-claire'
    ? vw >= 768
      ? 180
      : 140
    : id === 'zeichnungen'
      ? vw >= 768
        ? 440
        : 360
      : id === 'tattoo' || id === 'textil' || id === 'schmuck' // Umrundung (contour, U-44)
        ? vw >= 768
          ? 480
          : 400
        : vw >= 768
          ? 360
          : 280

async function ready(page: Page) {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.goto('/de')
  await page.waitForFunction(() => !!(window as Win).__leash?.geometry?.stations.length)
}

const pose = (page: Page) => page.evaluate(() => (window as Win).__leash?.pose() ?? null)

test.describe('Startseite – Choreografie (Preset journey)', () => {
  test.beforeEach(({ browserName }, testInfo) => {
    test.skip(
      browserName !== 'chromium' || testInfo.project.name !== 'desktop',
      'Engine-Prüfungen in Chromium (ein Projekt genügt)',
    )
  })

  test('MO-08 Pose je Station: Ankunft → Verweilen (Tabelle §11.4), 390 px', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await ready(page)
    const stations = await page.evaluate(() => (window as Win).__leash!.geometry!.stations)
    expect(stations.map((s) => s.id)).toEqual(Object.keys(ARRIVE))
    for (const s of stations) {
      await page.evaluate(
        ([y]) => (window as Win).__leash!.setReadingY(y!),
        [s.y + loopScroll(s.id, 390) - 1],
      )
      await expect
        .poll(() => pose(page), { message: `${s.id} Ankunft`, timeout: 6000 })
        .toBe(ARRIVE[s.id])
      const dwell = DWELL[s.id]
      if (dwell)
        await expect
          .poll(() => pose(page), { message: `${s.id} Verweilen`, timeout: 6000 })
          .toBe(dwell)
    }
  })

  test('Scrollstopp zwischen Stationen: nach 1,2 s sitzen; unterwegs rennen', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await ready(page)
    const [a, b] = await page.evaluate(() =>
      (window as Win).__leash!.geometry!.stations.slice(2, 4),
    )
    await page.evaluate(([y]) => (window as Win).__leash!.setReadingY(y!), [a!.y + 20])
    // in kleinen Schritten wie beim Scrollen (U-06: Schlaufen brauchen den doppelten Scroll-Weg; ein Sprung über
    // > 300 px Bogenlänge lässt Coco direkt springen statt zu rennen)
    for (let y = a!.y + 20; y < (a!.y + b!.y) / 2; y += 60) {
      await page.evaluate((v) => (window as Win).__leash!.setReadingY(v), y)
      await page.waitForTimeout(30)
    }
    await expect.poll(() => pose(page), { timeout: 3000 }).toBe('rennen')
    await expect.poll(() => pose(page), { timeout: 5000 }).toBe('sitzen')
  })

  test('LG-01 Coco-Box bleibt im Rinnenbereich, solange die Leinenspitze darin liegt (390 px)', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await ready(page)
    const hallo = await page.evaluate(() => (window as Win).__leash!.geometry!.stations[1]!)
    await page.evaluate(([y]) => (window as Win).__leash!.setReadingY(y!), [hallo.y - 30])
    await page.waitForTimeout(1500)
    const box = await page.locator('[data-leash-coco]').boundingBox()
    // Text beginnt bei x = 56 (Rinne, U-05): der Hund (füllt 0,13–0,90 der Box, P9.18) ragt höchstens 1 px darüber
    expect(box!.x + 0.9 * box!.width).toBeLessThanOrEqual(57)
  })
})
