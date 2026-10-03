import { expect, test, type Page } from '@playwright/test'

import { COCO_SPRITE_HREF } from '../../src/leash/cocoSprite'
import { SPRITE_POSES } from '../../src/leash/poses'

// P2.18 Coco (DESIGN §10.4–§10.6, §9.8, §9.9; ADR 0003): Sprite-Datei, feste Box ohne CLS, Coco an der Leinenspitze
// (R01), Menü, Boil-Budget, ohne JavaScript unsichtbar, View Transitions mit Coco (weich und hart).

type LeashWindow = Window & { __leash?: { pose(): string | null } }
const SPRITE = COCO_SPRITE_HREF
const leashCoco = (page: Page) => page.locator('[data-leash-coco]')

test.describe('Coco', () => {
  test.beforeEach(({ browserName }, testInfo) => {
    test.skip(
      browserName !== 'chromium' || testInfo.project.name !== 'desktop',
      'Engine-/Coco-Prüfungen in Chromium (ein Projekt genügt)',
    )
  })

  test('Sprite-Datei: 200, SVG, immutable, 22 Symbole', async ({ request }) => {
    const res = await request.get(SPRITE)
    expect(res.status()).toBe(200)
    expect(res.headers()['content-type']).toContain('image/svg+xml')
    expect(res.headers()['cache-control']).toBe('public, max-age=31536000, immutable')
    expect((await res.text()).match(/<symbol /g)).toHaveLength(22)
  })

  test('feste Coco-Box: kein Layout-Shift, wenn der Sprite spät lädt (390 px)', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    let release: () => void = () => {}
    const gate = new Promise<void>((r) => (release = r))
    await page.route(`**${SPRITE}`, async (route) => {
      await gate
      await route.continue()
    })
    await page.addInitScript(() => {
      const w = window as Window & { __shifts?: string[] }
      w.__shifts = []
      new PerformanceObserver((list) => {
        for (const e of list.getEntries() as (PerformanceEntry & {
          sources?: { node?: Node | null }[]
        })[])
          for (const s of e.sources ?? [])
            if ((s.node as Element | null)?.closest?.('.coco')) w.__shifts!.push(e.name)
      }).observe({ type: 'layout-shift', buffered: true })
    })
    // Der Sprite hält `load` auf – nur bis DOMContentLoaded warten.
    await page.goto('/de', { waitUntil: 'domcontentloaded' })
    // Layout-Maße (ohne die `transform` der Engine)
    const size = () =>
      leashCoco(page).evaluate((el: HTMLElement) => [
        el.offsetWidth,
        el.getBoundingClientRect().height,
      ])
    const before = await size()
    expect(before[0]).toBe(42)
    release()
    await page.waitForResponse((r) => r.url().endsWith(SPRITE))
    await page.waitForTimeout(500)
    expect((await size())[0]).toBe(42)
    expect(
      await leashCoco(page).evaluate((el: HTMLElement) => el.offsetHeight),
    ).toBeGreaterThanOrEqual(31)
    expect(
      await page.evaluate(() => (window as Window & { __shifts?: string[] }).__shifts),
    ).toEqual([])
  })

  test('R01: Coco an der Leinenspitze – aria-hidden, von der Engine geführt, Boil stoppt nach ≤ 5 s ohne Aktion', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.goto('/de')
    const coco = leashCoco(page)
    await expect(coco).toHaveAttribute('aria-hidden', 'true')
    await expect(coco).toHaveAttribute('data-placed', '', { timeout: 10_000 })
    expect(await coco.locator('a, button, [tabindex]').count()).toBe(0)
    expect(await coco.evaluate((el) => getComputedStyle(el).pointerEvents)).toBe('none')
    const pose = await page.evaluate(() => (window as LeashWindow).__leash?.pose())
    expect(SPRITE_POSES).toContain(pose)
    const href = await coco.locator('use.f-a').getAttribute('href')
    expect(href).toMatch(new RegExp(`^${SPRITE.replace(/\./g, '\\.')}#coco-[a-z-]+$`))
    // Boil-Budget (§10.3, WCAG 2.2.2): spätestens 5 s nach der letzten Aktion steht Frame A.
    await page.waitForTimeout(5200)
    await expect(coco).toHaveAttribute('data-boil', 'off')
    expect(
      await page.evaluate(
        () =>
          document
            .getAnimations()
            .filter(
              (a) =>
                a.playState === 'running' &&
                ((a.effect as KeyframeEffect | null)?.target as Element | null)?.closest('.coco'),
            ).length,
      ),
    ).toBe(0)
  })

  test('Menü: Coco kopfschief in Größe m (72 px) mit fester Box', async ({ page }) => {
    await page.goto('/de')
    const trigger = page.locator('[data-site-header] [data-menu-trigger]')
    // Erst klicken, wenn das Menü-Modul gebunden ist (wie in menu.e2e.spec.ts) – sonst geht der Klick vor dem Laden
    // des nachgeladenen Moduls ins Leere (auf der Startseite lädt zuerst die Tuschelinie).
    await expect(trigger).toHaveAttribute('role', 'button')
    await trigger.click()
    const coco = page.locator('dialog .coco')
    await expect(coco).toBeVisible()
    await expect(coco).toHaveAttribute('data-pose', 'kopfschief')
    await expect(coco).toHaveAttribute('data-size', 'm')
    const box = await coco.boundingBox()
    expect(box?.width).toBe(72)
    expect(box?.height).toBe(54)
  })

  test('ohne JavaScript keine Coco an der (fehlenden) Linie', async ({ browser }) => {
    const ctx = await browser.newContext({ javaScriptEnabled: false })
    const page = await ctx.newPage()
    await page.goto('/de')
    await expect(page.locator('[data-leash-coco]')).toHaveCount(1)
    await expect(page.locator('[data-leash-coco]')).toBeHidden()
    await ctx.close()
  })

  test('harte Navigation: Coco trägt view-transition-name coco, bei reduzierter Bewegung nicht', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.goto('/de')
    const name = () => leashCoco(page).evaluate((el) => getComputedStyle(el).viewTransitionName)
    expect(await name()).toBe('coco')
    await page.evaluate(() => document.documentElement.setAttribute('data-motion', 'reduced'))
    expect(await name()).toBe('none')
  })
})

test.describe('Weiche Navigation mit View Transitions (ADR 0003)', () => {
  test.beforeEach(({ browserName }, testInfo) => {
    test.skip(
      browserName !== 'chromium' || testInfo.project.name !== 'desktop',
      'View Transitions in Chromium (ein Projekt genügt)',
    )
  })

  /** Protokolliert jede `startViewTransition` und die animierten Pseudo-Elemente. */
  async function recordTransitions(page: Page) {
    await page.addInitScript(() => {
      const w = window as Window & { __vt?: { names: string[] }[] }
      w.__vt = []
      const orig = document.startViewTransition?.bind(document)
      if (!orig) return
      document.startViewTransition = ((arg: never) => {
        const t = orig(arg)
        const rec = { names: [] as string[] }
        w.__vt!.push(rec)
        void t.ready
          .then(() => {
            rec.names = document
              .getAnimations()
              .map((a) => (a.effect as KeyframeEffect | null)?.pseudoElement ?? '')
              .filter(Boolean)
          })
          .catch(() => {})
        return t
      }) as typeof document.startViewTransition
    })
  }

  async function softNavigate(page: Page, path: string) {
    await page.evaluate(
      (u) =>
        (window as Window & { next?: { router: { push(u: string): void } } }).next!.router.push(u),
      path,
    )
    await page.waitForURL(`**${path}`)
    await page.waitForTimeout(600)
    return page.evaluate(() =>
      (window as Window & { __vt?: { names: string[] }[] }).__vt!.splice(0),
    )
  }

  test('R01 → R20: Seiteninhalt blendet über, Coco verlässt die Seite; zu/von calm kein Übergang', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await recordTransitions(page)
    await page.goto('/de')
    await page.waitForLoadState('load')
    const toContact = await softNavigate(page, '/de/kontakt')
    expect(toContact).toHaveLength(1)
    expect(toContact[0]!.names.some((n) => n.includes('(coco)'))).toBe(true)
    expect(toContact[0]!.names.some((n) => /view-transition-new\(_/.test(n))).toBe(true)
    expect(await softNavigate(page, '/de/vertrag-widerrufen')).toEqual([])
    expect(await softNavigate(page, '/de/impressum')).toEqual([])
  })

  test('reduzierte Bewegung: kein Übergang', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await recordTransitions(page)
    await page.goto('/de')
    await page.waitForLoadState('load')
    expect(await softNavigate(page, '/de/kontakt')).toEqual([])
  })
})
