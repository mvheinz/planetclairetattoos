import { expect, test } from './fixtures'
import { type Page } from '@playwright/test'

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
    expect(before[0]).toBe(70)
    release()
    await page.waitForResponse((r) => r.url().endsWith(SPRITE))
    await page.waitForTimeout(500)
    expect((await size())[0]).toBe(70)
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
    const href = await coco.locator('.cg[data-on] use.f-a').getAttribute('href')
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

  interface CocoVt {
    pose: string | null
    anims: { name: string; pe: string; d: number }[]
  }

  /**
   * Harte Navigation (die Seite nutzt `<a href>`, ADR 0003): zeichnet im alten Dokument die Pose von Coco beim
   * `pageswap` auf und im neuen die animierten Coco-Pseudo-Elemente beim `pagereveal`; `exposeFunction` überlebt den
   * Dokumentwechsel. Gibt eine Funktion zurück, die den Link anklickt und beide Aufzeichnungen liefert.
   */
  async function hardTransition(page: Page, path: string) {
    const rec: Partial<CocoVt> = {}
    await page.exposeFunction('__cocoSwap', (pose: string | null) => (rec.pose = pose))
    await page.exposeFunction('__cocoReveal', (anims: CocoVt['anims']) => (rec.anims = anims))
    await page.addInitScript(() => {
      type W = Window & {
        __cocoSwap(p: string | null): void
        __cocoReveal(a: unknown[]): void
      }
      addEventListener('pageswap', () =>
        (window as unknown as W).__cocoSwap(
          document.querySelector('[data-leash-coco]')?.getAttribute('data-pose') ?? null,
        ),
      )
      addEventListener('pagereveal', (e) => {
        const vt = (e as Event & { viewTransition?: { ready: Promise<void> } | null })
          .viewTransition
        void vt?.ready
          .then(() =>
            (window as unknown as W).__cocoReveal(
              document
                .getAnimations()
                .filter((a) =>
                  /\(coco\)/.test((a.effect as KeyframeEffect | null)?.pseudoElement ?? ''),
                )
                .map((a) => ({
                  name: (a as CSSAnimation).animationName ?? '',
                  pe: (a.effect as KeyframeEffect).pseudoElement ?? '',
                  d: a.effect!.getTiming().duration,
                })),
            ),
          )
          .catch(() => undefined)
      })
    })
    return async (): Promise<CocoVt> => {
      await page.evaluate(
        (u) => document.querySelector<HTMLAnchorElement>(`a[href="${u}"]`)!.click(),
        path,
      )
      await page.waitForURL(`**${path}`)
      await expect.poll(() => rec.anims !== undefined, { timeout: 10_000 }).toBe(true)
      return { pose: rec.pose ?? null, anims: rec.anims! }
    }
  }

  test('Coco reist mit (MO-14): Lauf-Pose beim Aufbruch, ohne Gegenstück läuft sie hinaus, 350 ms', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    const go = await hardTransition(page, '/de/kontakt')
    await page.goto('/de')
    await page.waitForLoadState('load')
    await expect(leashCoco(page)).toHaveAttribute('data-placed', '')
    await page.waitForTimeout(1500) // Reise-Modul nachgeladen
    const vt = await go()
    expect(vt.pose).toBe('rennen')
    const away = vt.anims.find((a) => a.name === 'pc-coco-away')
    expect(away?.pe).toBe('::view-transition-old(coco)')
    expect(away?.d).toBe(350)
  })

  test('Coco reist mit (MO-14): Start → Über mich wandert von Leinenspitze zu Leinenspitze und steht sofort', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    const go = await hardTransition(page, '/de/ueber-mich')
    await page.goto('/de')
    await page.waitForLoadState('load')
    await expect(leashCoco(page)).toHaveAttribute('data-placed', '')
    await page.waitForTimeout(1500)
    const vt = await go()
    // Paar: Gruppe wandert in 350 ms, kein „hinaus“/„herein“
    expect(vt.anims.some((a) => a.pe === '::view-transition-group(coco)' && a.d === 350)).toBe(true)
    expect(vt.anims.some((a) => a.name === 'pc-coco-away' || a.name === 'pc-coco-in')).toBe(false)
    // neue Seite: Coco kam über einen Übergang → steht am Linienanfang, ohne Hereinrennen von links
    await expect(leashCoco(page)).toHaveAttribute('data-arrived', '')
  })

  test('Coco reist mit (MO-14): Kontakt → Start läuft herein; Erststart ohne Reise', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    const go = await hardTransition(page, '/de')
    await page.goto('/de/kontakt')
    await page.waitForLoadState('load')
    await page.waitForTimeout(1200)
    const vt = await go()
    const inn = vt.anims.find((a) => a.name === 'pc-coco-in')
    expect(inn?.pe).toBe('::view-transition-new(coco)')
    expect(inn?.d).toBe(350)
    await expect(leashCoco(page)).toHaveAttribute('data-arrived', '')
    // Erstaufruf ohne Referrer: kein `data-arrived` (Coco rennt im Intro herein, MI-10)
    await page.goto('about:blank')
    await page.goto('/de')
    await expect(leashCoco(page)).not.toHaveAttribute('data-arrived', '')
  })

  test('Coco reist nicht bei reduzierter Bewegung', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/de')
    await page.waitForLoadState('load')
    await page.waitForTimeout(1500)
    await expect(leashCoco(page)).not.toHaveAttribute('data-arrived', '')
    await page.evaluate(() =>
      document.querySelector<HTMLAnchorElement>('a[href="/de/kontakt"]')!.click(),
    )
    await page.waitForURL('**/de/kontakt')
    await expect(page.locator('[data-leash-coco]')).toHaveCount(0)
  })

  test('reduzierte Bewegung: kein Übergang', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await recordTransitions(page)
    await page.goto('/de')
    await page.waitForLoadState('load')
    expect(await softNavigate(page, '/de/kontakt')).toEqual([])
  })
})
