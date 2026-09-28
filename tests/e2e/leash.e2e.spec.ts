import { expect, test, type Page } from '@playwright/test'

// P2.16 Tuschelinie-Laufzeit (DESIGN §9.4, §9.6, §9.9, §9.10, §9.13): AK-DS-13, AK-DS-15, Chunk-Analyse.
// Braucht `window.__leash` (Build/Dev-Server mit NEXT_PUBLIC_LEASH_DEBUG=1, siehe playwright.config.ts).

interface LeashApi {
  geometry: { totalLength: number; segments: unknown[] } | null
  drawnLen(): number
  tier(): string
  rebuildCount(): number
}
type LeashWindow = Window & { __leash?: LeashApi }

/** Unverwechselbarer Text aus `src/leash/runtime.ts` (Masken-ID-Präfix) für die Chunk-Analyse. */
const RUNTIME_MARKER = 'pc-leash-m-'

const layer = (page: Page) => page.locator('[data-leash-layer]')

async function waitForLeash(page: Page) {
  await page.waitForFunction(() => {
    const l = (window as LeashWindow).__leash
    return !!l?.geometry && l.geometry.totalLength > 0
  })
}

/**
 * Die vorläufige Startseite (bis P2.20) ist kürzer als ein Bildschirm; für die Scroll-Kopplung braucht der Test eine
 * scrollbare Seite. Mit den Stationen aus P2.20 greift das nicht mehr.
 */
async function ensureScrollable(page: Page) {
  const grew = await page.evaluate(() => {
    const main = document.querySelector('main')
    if (!main || document.documentElement.scrollHeight >= 3 * innerHeight) return false
    main.style.minHeight = `${4 * innerHeight}px`
    return true
  })
  // Höhere Seite → ResizeObserver → Neuaufbau (entprellt, §9.10)
  if (grew)
    await expect
      .poll(() => page.evaluate(() => (window as LeashWindow).__leash!.rebuildCount()))
      .toBeGreaterThan(0)
}

const drawn = (page: Page) => page.evaluate(() => (window as LeashWindow).__leash!.drawnLen())

test.describe('Tuschelinie-Laufzeit', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test.beforeEach(({ browserName }, testInfo) => {
    test.skip(
      browserName !== 'chromium' || testInfo.project.name !== 'desktop',
      'AK-DS-13/15 laut DESIGN §9.13 in Chromium 390 × 844 (ein Projekt genügt)',
    )
  })

  test('AK-DS-13 R01: Ebene aria-hidden ohne Fokusziele, Scroll zeichnet, Hochscrollen radiert nicht', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.goto('/de')
    await waitForLeash(page)
    await ensureScrollable(page)
    // Intro (journey, MI-10) abwarten
    await page.waitForTimeout(1200)

    await expect(layer(page)).toHaveAttribute('aria-hidden', 'true')
    const focusables = await layer(page)
      .locator('a, button, input, select, textarea, [tabindex], [contenteditable]')
      .count()
    expect(focusables).toBe(0)
    expect(await layer(page).locator('svg[focusable="false"]').count()).toBeGreaterThan(0)
    expect(await layer(page).evaluate((el) => getComputedStyle(el).pointerEvents)).toBe('none')
    expect(await page.evaluate(() => (window as LeashWindow).__leash!.tier())).toBe('A')

    // Seitenmitte: Lesezeile auf halber Höhe des Seitencontainers.
    await page.evaluate(() => {
      const root = document.querySelector('[data-leash-layer]')!.getBoundingClientRect()
      const top = root.top + scrollY
      window.scrollTo({ top: top + root.height / 2 - 0.72 * innerHeight, behavior: 'instant' })
    })
    await expect
      .poll(async () =>
        page.evaluate(() => {
          const l = (window as LeashWindow).__leash!
          return l.drawnLen() / l.geometry!.totalLength
        }),
      )
      .toBeGreaterThanOrEqual(0.35)
    const ratio = await page.evaluate(() => {
      const l = (window as LeashWindow).__leash!
      return l.drawnLen() / l.geometry!.totalLength
    })
    expect(ratio).toBeLessThanOrEqual(0.75)

    const before = await drawn(page)
    await page.evaluate(() => window.scrollBy({ top: -400, behavior: 'instant' }))
    await page.waitForTimeout(300)
    expect(await drawn(page)).toBe(before)
  })

  test('AK-DS-15: Resize 390 → 768 → 390 baut neu auf, ohne Konsolenfehler und ohne Layout-Verschiebung', async ({
    page,
  }) => {
    const errors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text())
    })
    page.on('pageerror', (err) => errors.push(err.message))
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.goto('/de')
    await waitForLeash(page)
    await page.waitForTimeout(1200)
    const rebuilds = () => page.evaluate(() => (window as LeashWindow).__leash!.rebuildCount())
    const gutter = () =>
      page.evaluate(() =>
        parseFloat(getComputedStyle(document.body).getPropertyValue('--leash-gutter')),
      )

    /**
     * Neue Breite setzen, das Umfließen des Inhalts durch den Viewport-Wechsel selbst abwarten (zwei Frames) und erst
     * dann Layout-Verschiebungen protokollieren: gemessen wird der Neuaufbau der Linie (§9.9 Nr. 6, CLS-Beitrag 0).
     */
    async function resizeAndRebuild(width: number) {
      const before = await rebuilds()
      await page.setViewportSize({ width, height: 844 })
      await page.evaluate(
        () =>
          new Promise<void>((resolve) => {
            requestAnimationFrame(() =>
              requestAnimationFrame(() => {
                const w = window as Window & { __cls?: string[]; __clsObs?: PerformanceObserver }
                w.__clsObs?.disconnect()
                w.__cls = []
                w.__clsObs = new PerformanceObserver((list) => {
                  for (const e of list.getEntries()) {
                    const shift = e as PerformanceEntry & {
                      value: number
                      sources?: { node?: Node | null }[]
                    }
                    const nodes = (shift.sources ?? []).map(
                      (src) => (src.node as Element | null)?.tagName ?? '?',
                    )
                    w.__cls!.push(`${shift.value.toFixed(4)} ${nodes.join(',')}`)
                  }
                })
                w.__clsObs.observe({ type: 'layout-shift', buffered: false })
                resolve()
              }),
            )
          }),
      )
      await expect.poll(rebuilds).toBeGreaterThan(before)
      await page.waitForTimeout(300)
      return page.evaluate(() => (window as Window & { __cls?: string[] }).__cls ?? [])
    }

    expect(await resizeAndRebuild(768)).toEqual([])
    expect(await gutter()).toBe(64)
    expect(await resizeAndRebuild(390)).toEqual([])
    expect(await gutter()).toBe(44)
    expect(errors).toEqual([])
    const width = await page.evaluate(
      () => document.querySelector('[data-leash-layer]')!.getBoundingClientRect().width,
    )
    expect(width).toBeLessThanOrEqual(390)
  })

  test('Die Runtime ist nicht im Erstlade-Bundle, sondern ein eigener, später geladener Chunk', async ({
    page,
    request,
  }) => {
    const res = await request.get('/de')
    const html = await res.text()
    const initial = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map((m) => m[1]!)
    expect(initial.length).toBeGreaterThan(0)
    for (const src of initial) {
      const body = await (await request.get(src)).text()
      expect(body.includes(RUNTIME_MARKER), `Erstlade-Skript ${src}`).toBe(false)
    }
    expect(html.includes(RUNTIME_MARKER)).toBe(false)

    const loaded: string[] = []
    page.on('response', async (r) => {
      if (r.request().resourceType() !== 'script') return
      const body = await r.text().catch(() => '')
      if (body.includes(RUNTIME_MARKER)) loaded.push(r.url())
    })
    await page.goto('/de')
    await waitForLeash(page)
    await expect.poll(() => loaded.length).toBeGreaterThan(0)
    for (const url of loaded) expect(initial.some((src) => url.endsWith(src))).toBe(false)
  })

  test('Rechtsseiten (legal) laden die Laufzeit nicht', async ({ page }) => {
    const runtime: string[] = []
    page.on('response', async (r) => {
      if (r.request().resourceType() !== 'script') return
      const body = await r.text().catch(() => '')
      if (body.includes(RUNTIME_MARKER)) runtime.push(r.url())
    })
    await page.goto('/de/impressum')
    await page.waitForLoadState('load')
    await page.waitForTimeout(2000)
    expect(runtime).toEqual([])
    // Nur der statische Renderer (Stufe C, P2.17)
    expect(await page.evaluate(() => (window as LeashWindow).__leash?.tier())).toBe('C')
  })

  test('View Transitions: Regel nur unter no-preference, nicht auf calm-Seiten', async ({
    page,
  }) => {
    await page.goto('/de')
    const style = page.locator('style[data-view-transition]')
    await expect(style).toHaveCount(1)
    expect(await style.textContent()).toContain(
      '@media (prefers-reduced-motion: no-preference){@view-transition{navigation:auto}}',
    )
    await page.goto('/de/vertrag-widerrufen')
    await expect(page.locator('style[data-view-transition]')).toHaveCount(0)
  })
})
