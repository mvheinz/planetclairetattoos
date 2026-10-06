import { expect, test } from './fixtures'
import { type Page } from '@playwright/test'

// P2.17 Reduzierte Bewegung (DESIGN §9.4 Stufe C, §9.11, §10.6, §9.13): AK-DS-14 und AK-DS-03 (P2-Umfang R01, R21;
// Produktseite und Kasse folgen in P3/P4). Braucht `window.__leash` (Build/Dev-Server mit NEXT_PUBLIC_LEASH_DEBUG=1).

interface LeashApi {
  geometry: { totalLength: number } | null
  drawnLen(): number
  tier(): string
  pose(): string | null
  preset(): string
}
type LeashWindow = Window & { __leash?: LeashApi }

/** Zustand der Linie aus `window.__leash`. */
const state = (page: Page) =>
  page.evaluate(() => {
    const l = (window as LeashWindow).__leash!
    return {
      tier: l.tier(),
      full: l.drawnLen() === l.geometry!.totalLength,
      pose: l.pose(),
      preset: l.preset(),
    }
  })

async function waitForLeash(page: Page, tier?: string) {
  await page.waitForFunction((t) => {
    const l = (window as LeashWindow).__leash
    return !!l?.geometry && l.geometry.totalLength > 0 && (!t || l.tier() === t)
  }, tier)
}

const runningAnimations = (page: Page) =>
  page.evaluate(() => document.getAnimations().filter((a) => a.playState === 'running').length)

test.describe('Reduzierte Bewegung', () => {
  test.beforeEach(({ browserName }, testInfo) => {
    test.skip(
      browserName !== 'chromium' || testInfo.project.name !== 'desktop',
      'Engine-Prüfungen laut DESIGN §9.13 in Chromium (ein Projekt genügt)',
    )
  })

  test('AK-DS-14 R01 mit reducedMotion reduce: nach load + 1500 ms vollständig, ohne Maske, 0 Animationen', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/de')
    await page.waitForLoadState('load')
    await page.waitForTimeout(1500)
    await waitForLeash(page)
    expect((await state(page)).tier).toBe('C')
    expect((await state(page)).full).toBe(true)
    expect(await page.locator('[data-leash-layer] [mask], [data-leash-layer] mask').count()).toBe(0)
    expect(await runningAnimations(page)).toBe(0)
    // Coco: Frame A der Ruhe-Pose `sitzen` (§10.6)
    expect((await state(page)).pose).toBe('sitzen')
    // Scrollen ändert nichts
    await page.mouse.wheel(0, 600)
    await page.waitForTimeout(300)
    expect((await state(page)).full).toBe(true)
    expect(await runningAnimations(page)).toBe(0)
  })

  test('Schalter „Animationen“ (html[data-motion]) schaltet ohne Neuladen auf Stufe C und zurück', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.goto('/de')
    await waitForLeash(page, 'A')
    await page.evaluate(() => document.documentElement.setAttribute('data-motion', 'reduced'))
    await waitForLeash(page, 'C')
    expect((await state(page)).full).toBe(true)
    expect(await page.locator('[data-leash-layer] mask').count()).toBe(0)
    expect((await state(page)).pose).toBe('sitzen')
    expect(
      await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior),
    ).toBe('auto')
    await page.evaluate(() => document.documentElement.setAttribute('data-motion', 'full'))
    await waitForLeash(page, 'A')
    // Tinte wird nie weggeradiert (§9.6)
    expect((await state(page)).full).toBe(true)
  })

  test('Rechtsseite R21: statischer Renderer (Stufe C), Engine-Chunk wird nicht geladen', async ({
    page,
  }) => {
    const engine: string[] = []
    page.on('response', async (r) => {
      if (r.request().resourceType() !== 'script') return
      const body = await r.text().catch(() => '')
      if (body.includes('pc-leash-m-')) engine.push(r.url())
    })
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.goto('/de/impressum')
    await waitForLeash(page, 'C')
    expect((await state(page)).preset).toBe('legal')
    expect((await state(page)).full).toBe(true)
    expect(await page.locator('[data-leash-layer] svg').count()).toBe(1)
    expect(await page.locator('[data-leash-layer] mask').count()).toBe(0)
    await page.waitForTimeout(1000)
    expect(engine).toEqual([])
    expect(await runningAnimations(page)).toBe(0)
  })

  for (const path of ['/de', '/de/impressum']) {
    test(`AK-DS-03 ${path}: bei reduce sind Screenshots mit colorScheme dark und light pixelgleich`, async ({
      page,
    }) => {
      await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'light' })
      await page.goto(path)
      await page.waitForLoadState('load')
      await waitForLeash(page, 'C')
      await page.evaluate(() => document.fonts.ready)
      const light = await page.screenshot({ animations: 'disabled' })
      await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'dark' })
      await page.evaluate(
        () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
      )
      const dark = await page.screenshot({ animations: 'disabled' })
      expect(dark.equals(light), 'dark und light unterscheiden sich').toBe(true)
    })
  }
})
