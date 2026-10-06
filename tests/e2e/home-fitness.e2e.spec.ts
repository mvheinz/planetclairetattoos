import { expect, test } from './fixtures'

// P12.5/P12.6 (U-09, U-08): Startseite – Fitness-Coco ersetzt die große sitzende Coco der Hallo-Station, lädt die Bildfolge
// erst nach dem `load`, steht bei reduzierter Bewegung still; Koko: nur die Pupillen sind animiert.

test.describe('Startseite: Fitness-Coco und Koko', () => {
  test('keine sitzende Sprite-Coco mehr in „Hallo“; Fitness-Coco mit Alt-Text, Daten erst nach dem load', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' })
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
      /fitness-still\.v\d+\.svg$/,
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
  })

  test('reduzierte Bewegung: Standbild, keine Bildfolge geladen, Pupillen still', async ({
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

  test('Koko: nur die Pupillen sind animiert, Alt-Text DE/EN, Bild statt Inline-SVG', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.goto('/de')
    const koko = page.locator('[data-chairwoman]').first()
    await expect(koko).toHaveAttribute('aria-label', 'Koko, Vorsitzende der Goth Dogs Berlin')
    await expect(koko.locator('svg')).toHaveCount(0)
    const targets = await koko.evaluate((el) =>
      el
        .getAnimations({ subtree: true })
        .map((a) => (a.effect as KeyframeEffect).target?.hasAttribute('data-koko-pupil')),
    )
    expect(targets).toEqual([true, true])
    await page.goto('/en')
    await expect(page.locator('[data-chairwoman]').first()).toHaveAttribute(
      'aria-label',
      /Koko, chairwoman of the Goth Dogs Berlin/,
    )
  })
})
