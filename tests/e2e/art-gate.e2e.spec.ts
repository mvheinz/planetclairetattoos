import { expect, test, type Page } from '@playwright/test'

import { overlaps } from '../../scripts/art/lib/checks/runtime'
import { localizedPath } from '../../src/lib/routes/paths'
import { probePage } from '../art/helpers/probe'
import { expectCalm } from './calm'

// Dauer-Gate der Kunst-Abnahme (KUNST-QA §9, PLAN P9.7): schnelle Teilmenge in der regulären E2E-Suite (Job
// `e2e-full` in `ci-full.yml`, Projekt `pixel-7`, ohne Video) – DESIGN AK-DS-09, AK-DS-11, AK-DS-13, AK-DS-14 und
// KUNST-QA LG-01 für R01. Verhindert, dass spätere Phasen die Kunst-Abnahme unbemerkt brechen.

type LeashWindow = Window & {
  __leash?: {
    geometry: { totalLength: number; scrollMap: { readingY: number }[] }
    drawnLen(): number
    setReadingY(y: number | null): void
  }
  __artReadingY?: number | null
}

// tsx ergänzt in Browser-Callbacks `__name(…)` (esbuild keepNames) – im Browser als Identität bereitstellen.
const NAME_SHIM = 'globalThis.__name = globalThis.__name || ((f) => f);'

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name !== 'pixel-7',
    'Schnelle Kunst-Teilmenge läuft auf Pixel 7 (KUNST-QA §9).',
  )
  await page.addInitScript(NAME_SHIM)
})

async function waitForLeash(page: Page) {
  await page.waitForFunction(() => {
    const l = (window as LeashWindow).__leash
    return !!l?.geometry && l.geometry.totalLength > 0
  })
}

test.describe('Kunst-Gate (KUNST-QA §9)', () => {
  test('AK-DS-09 „Vertrag widerrufen“ auf R01 und R06 sichtbar, ≥ 44 px, nicht verdeckt – mit und ohne reduzierte Bewegung', async ({
    page,
  }) => {
    for (const path of [localizedPath('R01', 'de'), localizedPath('R06', 'de')])
      for (const reducedMotion of ['reduce', 'no-preference'] as const) {
        await page.emulateMedia({ reducedMotion })
        await page.goto(path)
        const r = await page.evaluate(() => {
          const el = document.querySelector<HTMLElement>('footer a[href$="/vertrag-widerrufen"]')
          if (!el) return null
          el.scrollIntoView({ block: 'center', behavior: 'instant' })
          const b = el.getBoundingClientRect()
          const at = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2)
          return { h: b.height, hit: !!at && (at === el || el.contains(at)) }
        })
        expect(r, `${path} ${reducedMotion}`).not.toBeNull()
        expect(r!.h, `${path} ${reducedMotion} Höhe`).toBeGreaterThanOrEqual(44)
        expect(r!.hit, `${path} ${reducedMotion} getroffen`).toBe(true)
      }
  })

  test('AK-DS-11 Ruhe-Routen R06, R26, R21 ohne Animation und Transition', async ({ page }) => {
    for (const id of ['R06', 'R26', 'R21']) {
      await page.goto(localizedPath(id, 'de'))
      await expectCalm(page, id)
    }
  })

  test('AK-DS-13 R01 bei 390×844: Linie aria-hidden ohne Fokusziele, Mitte 0,35–0,75 gezeichnet, Tinte bleibt', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(localizedPath('R01', 'de'))
    await waitForLeash(page)
    const layer = page.locator('[data-leash-layer]')
    await expect(layer).toHaveAttribute('aria-hidden', 'true')
    expect(await layer.locator('a, button, input, [tabindex]:not([tabindex="-1"])').count()).toBe(0)
    await page.evaluate(() =>
      scrollTo(0, (document.documentElement.scrollHeight - innerHeight) / 2),
    )
    await page.waitForTimeout(800)
    const mid = await page.evaluate(() => {
      const l = (window as LeashWindow).__leash!
      return l.drawnLen() / l.geometry.totalLength
    })
    expect(mid).toBeGreaterThanOrEqual(0.35)
    expect(mid).toBeLessThanOrEqual(0.75)
    const before = await page.evaluate(() => (window as LeashWindow).__leash!.drawnLen())
    await page.evaluate(() => scrollBy(0, -400))
    await page.waitForTimeout(500)
    expect(await page.evaluate(() => (window as LeashWindow).__leash!.drawnLen())).toBe(before)
  })

  test('AK-DS-14 R01 mit reducedMotion: Linie sofort vollständig, nichts läuft', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto(localizedPath('R01', 'de'))
    await page.waitForLoadState('load')
    await page.waitForTimeout(1500)
    await waitForLeash(page)
    const s = await page.evaluate(() => {
      const l = (window as LeashWindow).__leash!
      return {
        full: l.drawnLen() === l.geometry.totalLength,
        masks: document.querySelectorAll('[data-leash-layer] [mask]').length,
        running: document.getAnimations().filter((a) => a.playState === 'running').length,
      }
    })
    expect(s).toEqual({ full: true, masks: 0, running: 0 })
  })

  test('LG-01 R01: Linie und Coco überdecken an 12 Lesezeilen-Positionen keinen Text und kein Bedienelement', async ({
    page,
  }) => {
    await page.goto(localizedPath('R01', 'de'))
    await waitForLeash(page)
    await page.waitForTimeout(1500)
    const range = await page.evaluate(() => {
      const sm = (window as LeashWindow).__leash!.geometry.scrollMap
      return { a: sm[0]!.readingY, b: sm[sm.length - 1]!.readingY }
    })
    const hits: string[] = []
    for (let i = 0; i <= 11; i++) {
      const y = range.a + ((range.b - range.a) * i) / 11
      await page.evaluate((y) => {
        const w = window as LeashWindow
        const layer = document.querySelector('[data-leash-layer]')
        const top = layer ? layer.getBoundingClientRect().top + scrollY : 0
        scrollTo(0, Math.max(0, y + top - 0.72 * innerHeight))
        w.__artReadingY = y
        w.__leash!.setReadingY(y)
      }, y)
      await page.waitForTimeout(450)
      const p = await probePage(page, {
        label: `y${Math.round(y)}`,
        frame: null,
        t: null,
        scale: 1,
        calm: false,
      })
      expect(p.leash, 'Linie gemessen').not.toBeNull()
      hits.push(...overlaps(p).map((o) => `${p.label}: ${o}`))
    }
    expect(hits).toEqual([])
  })
})
