import { expect, test } from './fixtures'

// P12.5/P12.6 (U-09, U-08): Startseite – Fitness-Coco (Puppen-Gerüst, `src/lib/fitness`) ersetzt die große sitzende Coco der
// Hallo-Station, lädt den Ablaufplan erst nach dem `load`, läuft als Endlosschleife, pausiert außerhalb des Bildes, steht bei
// reduzierter Bewegung still; Koko: nur die Pupillen sind animiert.

test.describe('Startseite: Fitness-Coco und Koko', () => {
  test('keine sitzende Sprite-Coco mehr in „Hallo“; Fitness-Coco läuft nach dem load, ohne Konsolenfehler', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    const errors: string[] = []
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
    page.on('pageerror', (e) => errors.push(String(e)))
    let loadedAt = Infinity
    let requestedAt = -1
    page.on('request', (r) => {
      if (/fitness-coco\.v\d+\.json$/.test(r.url())) requestedAt = Date.now()
    })
    page.on('load', () => (loadedAt = Date.now()))
    await page.goto('/de')
    const hallo = page.locator('[data-home-station="hallo"]')
    await expect(hallo.locator('.coco')).toHaveCount(0)
    const fit = hallo.locator('[data-behavior="fitness-coco"]')
    await expect(fit).toHaveAttribute('role', 'img')
    await expect(fit).toHaveAttribute('aria-label', /Coco.*Gymnastik/)
    await expect(fit.locator('img[data-fitness-still]')).toHaveAttribute(
      'src',
      /fitness-still\.v\d+\.webp$/,
    )
    const canvas = fit.locator('canvas[data-fitness-canvas]')
    await fit.scrollIntoViewIfNeeded()
    // nach dem load startet die Schleife: die Leinwand erscheint und verändert sich von Bild zu Bild
    await expect(canvas).toBeVisible({ timeout: 20_000 })
    const shot = () => canvas.evaluate((c) => (c as HTMLCanvasElement).toDataURL())
    const first = await shot()
    await expect.poll(shot, { timeout: 10_000 }).not.toBe(first)
    expect(requestedAt).toBeGreaterThanOrEqual(loadedAt)
    const box = await fit.boundingBox()
    expect(Math.abs(box!.width / box!.height - 0.8)).toBeLessThan(0.02) // feste Box 4:5
    // Standbild hinter der Leinwand ist verborgen, damit nichts doppelt zu sehen ist
    await expect(fit.locator('img[data-fitness-still]')).toHaveCSS('visibility', 'hidden')
    expect(errors).toEqual([])
  })

  test('Endlosschleife: über mehr als eine volle Schleife (43 s) läuft sie weiter, ohne Fehler', async ({
    page,
  }) => {
    test.setTimeout(120_000)
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    const errors: string[] = []
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
    page.on('pageerror', (e) => errors.push(String(e)))
    await page.goto('/de')
    const fit = page.locator('[data-behavior="fitness-coco"]')
    const canvas = fit.locator('canvas[data-fitness-canvas]')
    await fit.scrollIntoViewIfNeeded()
    await expect(canvas).toBeVisible({ timeout: 20_000 })
    await page.clock.install()
    const shot = () => canvas.evaluate((c) => (c as HTMLCanvasElement).toDataURL())
    const seen = new Set<string>()
    for (let i = 0; i < 11; i++) {
      await page.clock.runFor(4000)
      seen.add(await shot())
    }
    // jede Probe (alle 4 s, über 44 s) zeigt ein anderes Bild: sie steht nie still und bricht am Schleifenpunkt nicht ab
    expect(seen.size).toBeGreaterThanOrEqual(10)
    await expect(canvas).toBeVisible()
    expect(errors).toEqual([])
  })

  test('pausiert außerhalb des Bildes und läuft danach weiter', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.goto('/de')
    const fit = page.locator('[data-behavior="fitness-coco"]')
    const canvas = fit.locator('canvas[data-fitness-canvas]')
    await fit.scrollIntoViewIfNeeded()
    await expect(canvas).toBeVisible({ timeout: 20_000 })
    const shot = () => canvas.evaluate((c) => (c as HTMLCanvasElement).toDataURL())
    // ganz nach unten: die Zeichnung ist nicht mehr im Bild
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
    await expect
      .poll(() =>
        fit.evaluate(
          (el) =>
            el.getBoundingClientRect().bottom < 0 || el.getBoundingClientRect().top > innerHeight,
        ),
      )
      .toBe(true)
    await page.waitForTimeout(500) // Beobachter meldet
    const away = await shot()
    await page.waitForTimeout(900)
    expect(await shot()).toBe(away)
    await fit.scrollIntoViewIfNeeded()
    await expect.poll(shot, { timeout: 10_000 }).not.toBe(away)
  })

  test('reduzierte Bewegung: Standbild, kein Ablaufplan geladen, Pupillen still', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    let requested = false
    page.on('request', (r) => {
      if (/fitness-coco\.v\d+\.json$/.test(r.url())) requested = true
    })
    await page.goto('/de')
    const fit = page.locator('[data-behavior="fitness-coco"]')
    await page.waitForTimeout(3000)
    await expect(fit.locator('img[data-fitness-still]')).toBeVisible()
    await expect(fit.locator('canvas[data-fitness-canvas]')).toBeHidden()
    expect(requested).toBe(false)
    const anims = await page
      .locator('[data-chairwoman]')
      .evaluate((el) => el.getAnimations({ subtree: true }).length)
    expect(anims).toBe(0)
  })
})
