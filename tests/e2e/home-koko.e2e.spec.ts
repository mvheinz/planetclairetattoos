import { expect, test } from './fixtures'

// P12.6 (U-08): Koko, Vorsitzende der Goth Dogs Berlin – freigestelltes Bild von Juttas Malerei, nur die Pupillen sind
// animiert und gucken immer von links nach rechts. Fehlermeldung der Inhaberin: „die kleine Koko-Animation ist nach
// 3–4 Sekunden verschwunden“ – darum läuft ein Test über mehr als zwei Durchgänge (22 s) und prüft, dass sich die
// Pupille weiter bewegt, die Animationen laufen und nichts ausgeblendet bleibt. Bei reduzierter Bewegung: Standbild.

const sample = () => {
  const el = document.querySelector('[data-chairwoman]')!
  const look = el.querySelector('[data-koko-pupil="look"]')!
  const home = el.querySelector('[data-koko-pupil="home"]')!
  const box = look.getBoundingClientRect()
  const hbox = home.getBoundingClientRect()
  return {
    x: box.x,
    w: box.width,
    lookOpacity: Number(getComputedStyle(look).opacity),
    homeOpacity: Number(getComputedStyle(home).opacity),
    hx: hbox.x,
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
    await expect(img).toHaveAttribute('width', '660')
    await expect(img).toHaveAttribute('height', /^\d+$/)
    await expect
      .poll(() => img.evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth))
      .toBe(660)
    const box = await koko.boundingBox()
    expect(box!.width).toBeGreaterThan(150)
    expect(box!.height / box!.width).toBeCloseTo(867 / 660, 1)
    await page.goto('/en')
    await expect(page.locator('[data-chairwoman]').first()).toHaveAttribute(
      'aria-label',
      /^Koko, chairwoman of the Goth Dogs Berlin: .*dog/,
    )
    expect(foreignRequests).toEqual([])
  })

  test('Pupillen laufen weiter: nach 22 s noch in Bewegung, immer von links nach rechts, nichts bleibt verschwunden', async ({
    page,
  }) => {
    test.setTimeout(90_000)
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.goto('/de')
    const koko = page.locator('[data-chairwoman]').first()
    await koko.scrollIntoViewIfNeeded()
    const samples: Awaited<ReturnType<typeof page.evaluate<ReturnType<typeof sample>>>>[] = []
    const t0 = Date.now()
    while (Date.now() - t0 < 22_000) {
      samples.push(await page.evaluate(sample))
      await page.waitForTimeout(250)
    }
    const last = samples[samples.length - 1]!
    // vier CSS-Animationen (zwei je Auge), alle laufen, schon > 20 s
    expect(last.running).toHaveLength(4)
    for (const a of last.running) {
      expect(a.state).toBe('running')
      expect(a.t).toBeGreaterThan(20_000)
    }
    // der Läufer ist während der 22 s mindestens zweimal über den Weg gewandert
    const xs = samples.filter((s) => s.lookOpacity > 0.5).map((s) => s.x)
    const span = Math.max(...xs) - Math.min(...xs)
    expect(span).toBeGreaterThan(last.w * 0.8)
    // sichtbar nie rückwärts (rechts → links): in Folge sichtbarer Messungen wächst x oder bleibt gleich
    let back = 0
    for (let i = 1; i < samples.length; i++) {
      const a = samples[i - 1]!
      const b = samples[i]!
      if (a.lookOpacity > 0.5 && b.lookOpacity > 0.5 && b.x < a.x - 0.5) back++
    }
    expect(back).toBe(0)
    // in jedem 5-Sekunden-Fenster ist mindestens eine Pupille sichtbar (kein leeres Auge, nichts verschwindet)
    for (let i = 0; i < samples.length; i += 1)
      expect(Math.max(samples[i]!.lookOpacity, samples[i]!.homeOpacity)).toBeGreaterThan(0)
    // in den letzten 9 s hat sie sich noch bewegt (nicht eingefroren)
    const late = samples
      .slice(-36)
      .filter((s) => s.lookOpacity > 0.5)
      .map((s) => s.x)
    expect(Math.max(...late) - Math.min(...late)).toBeGreaterThan(last.w * 0.3)
    // Bild und Pupillen noch am Platz
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
    expect(s.homeOpacity).toBe(1)
    expect(s.lookOpacity).toBe(0)
    await page.waitForTimeout(1500)
    expect((await page.evaluate(sample)).hx).toBe(s.hx)
  })

  test('Schalter „Animationen aus“ (data-motion=reduced) stoppt auch Koko', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.goto('/de')
    await page.evaluate(() => document.documentElement.setAttribute('data-motion', 'reduced'))
    const s = await page.evaluate(sample)
    expect(s.running).toHaveLength(0)
    expect(s.homeOpacity).toBe(1)
  })
})
