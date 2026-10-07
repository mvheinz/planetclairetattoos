import { expect, test } from './fixtures'

// P12.6 (U-08): Koko, Vorsitzende der Goth Dogs Berlin – freigestelltes Bild von Juttas Malerei, nur die Pupillen sind
// animiert und gucken immer von links nach rechts. Fehlermeldung der Inhaberin: „die kleine Koko-Animation ist nach
// 3–4 Sekunden verschwunden“ – darum läuft ein Test über mehr als zwei Durchgänge (22 s) und prüft, dass sich die
// Pupille weiter bewegt, die Animationen laufen und nichts ausgeblendet bleibt. Bei reduzierter Bewegung: Standbild.

const sample = () => {
  const el = document.querySelector('[data-chairwoman]')!
  const pupil = el.querySelector('[data-koko-pupil]')!
  const box = pupil.getBoundingClientRect()
  return {
    x: box.x,
    w: box.width,
    opacity: Number(getComputedStyle(pupil).opacity),
    running: el
      .getAnimations({ subtree: true })
      .map((a) => ({ state: a.playState, t: Number(a.currentTime ?? 0) })),
  }
}

test.describe('Startseite: Koko', () => {
  test('Bild mit Maßen, Alt-Text DE/EN, keine Drittanfragen', async ({ page, foreignRequests }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.goto('/de')
    const koko = page.locator('[data-chairwoman]').first()
    await expect(koko).toHaveAttribute(
      'aria-label',
      /^Koko, Vorsitzende der Goth Dogs Berlin: .*Hund/,
    )
    const img = koko.locator('img')
    await expect(img).toHaveAttribute('src', '/art/koko.v2.webp')
    await expect(img).toHaveAttribute('width', '700')
    await expect(img).toHaveAttribute('height', /^\d+$/)
    await expect
      .poll(() => img.evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth))
      .toBe(700)
    const box = await koko.boundingBox()
    expect(box!.width).toBeGreaterThan(150)
    expect(box!.height / box!.width).toBeCloseTo(690 / 700, 1)
    await page.goto('/en')
    await expect(page.locator('[data-chairwoman]').first()).toHaveAttribute(
      'aria-label',
      /^Koko, chairwoman of the Goth Dogs Berlin: .*dog/,
    )
    expect(foreignRequests).toEqual([])
  })

  test('Pupillen laufen weiter: 24 s lang mehrfach links und rechts, ruhige Halts, schnelle Wechsel, kein Zittern', async ({
    page,
  }) => {
    test.setTimeout(90_000)
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.goto('/de')
    const koko = page.locator('[data-chairwoman]').first()
    await koko.scrollIntoViewIfNeeded()
    const samples: {
      t: number
      x: number
      w: number
      opacity: number
      running: { state: string; t: number }[]
    }[] = []
    const t0 = Date.now()
    while (Date.now() - t0 < 24_000) {
      const s = await page.evaluate(sample)
      samples.push({ t: Date.now() - t0, ...s })
      await page.waitForTimeout(60)
    }
    const last = samples[samples.length - 1]!
    // zwei CSS-Animationen (eine je Auge), laufen noch nach > 20 s
    expect(last.running).toHaveLength(2)
    for (const a of last.running) {
      expect(a.state).toBe('running')
      expect(a.t).toBeGreaterThan(20_000)
    }
    for (const s of samples) expect(s.opacity).toBe(1) // nie ausgeblendet
    const xs = samples.map((s) => s.x)
    const min = Math.min(...xs)
    const max = Math.max(...xs)
    const span = max - min
    expect(span).toBeGreaterThan(last.w * 0.8) // sichtbarer Weg
    const near = (x: number, edge: number) => Math.abs(x - edge) < span * 0.04
    // Seiten besucht: Folge links/rechts-Wechsel – in 24 s (Takt 6,8 s) mindestens 3 Wechsel
    let side: 'l' | 'r' | null = null
    let flips = 0
    for (const s of samples) {
      const cur = near(s.x, min) ? 'l' : near(s.x, max) ? 'r' : null
      if (cur && cur !== side) {
        if (side) flips++
        side = cur
      }
    }
    expect(flips).toBeGreaterThanOrEqual(5)
    // Halts: längste Ruhephasen (Abweichung < 0,3 px) dauern ≈ 3 s (≥ 2,4 s); kein Zittern dazwischen
    let runStart = 0
    const holds: number[] = []
    for (let i = 1; i <= samples.length; i++) {
      if (i === samples.length || Math.abs(samples[i]!.x - samples[runStart]!.x) > 0.3) {
        const d = samples[i - 1]!.t - samples[runStart]!.t
        if (d > 600) holds.push(d)
        runStart = i
      }
    }
    expect(holds.length).toBeGreaterThanOrEqual(5)
    for (const h of holds.slice(1, -1)) {
      expect(h).toBeGreaterThan(2_400)
      expect(h).toBeLessThan(3_800)
    }
    // Wechsel sind kurz: Zeit zwischen Halts ≤ 0,9 s (0,4 s Soll)
    const moving = samples.filter((s) => !near(s.x, min) && !near(s.x, max)).length * 60
    expect(moving).toBeLessThan(24_000 * 0.2)
    await expect(koko.locator('img')).toBeVisible()
    await expect(koko.locator('svg')).toBeVisible()
  })

  test('weniger Bewegung: keine Animation, Pupillen stehen links (Standbild)', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/de')
    const koko = page.locator('[data-chairwoman]').first()
    await expect(koko).toBeVisible()
    const s = await page.evaluate(sample)
    expect(s.running).toHaveLength(0)
    expect(s.opacity).toBe(1)
    await page.waitForTimeout(1500)
    expect((await page.evaluate(sample)).x).toBe(s.x)
  })

  test('Schalter „Animationen aus“ (data-motion=reduced) stoppt auch Koko', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.goto('/de')
    await page.evaluate(() => document.documentElement.setAttribute('data-motion', 'reduced'))
    const s = await page.evaluate(sample)
    expect(s.running).toHaveLength(0)
    expect(s.opacity).toBe(1)
  })
})
