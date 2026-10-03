import { cpus, loadavg } from 'node:os'

import type { CDPSession, Page } from '@playwright/test'

import { ownClientIp, startCheckoutFor } from '../e2e/checkout/checkoutHelpers'
import { pathOf } from '../e2e/shop/productPage'
import { artPieces, seedPiece } from './helpers/commerce'
import { artTags, test, type ArtSession } from './helpers/fixtures'
import { writeJson, writeRunFile } from './helpers/run'

// SC-18 Tempo-Messung (KUNST-QA §4.6, PLAN P9.4): Profil `art-pixel7`, CPU 4× per CDP, ohne Video, Cache warm (1 Vorlauf
// verworfen); je Route R01, R02, R04, R07 drei Läufe mit Engine und drei mit `?leash=off` (Grundlinie). Ablauf je Lauf:
// laden → LCP → `__qa.start()` → 5 s Scrollen per `Input.synthesizeScrollGesture` (900 px/s, Maus-Rad, kalibriert) → Menü öffnen/
// schließen → (R04) „In den Korb“ → `__qa.stop()` → `dump()`. Je Route ein CDP-Trace (`devtools.timeline`) für die
// `Layout`-Ereignisse während des Scrollens. Rohdaten unter `raw/SC-18/…`, Auswertung `pnpm art:metrics`.

const RUNS = 3
const SCROLL_PX_PER_S = 900
const SCROLL_MS = 5000

interface Marks {
  lcp: number | null
  menuAt: number | null
  addAt: number | null
  scrollFrom: number
  scrollTo: number
}

type QaWindow = Window & {
  __qa?: { start(): void; stop(): void; dump(): unknown }
}

async function lcpOf(page: Page): Promise<number | null> {
  return page.evaluate(
    () =>
      new Promise<number | null>((resolve) => {
        let last: number | null = null
        try {
          const o = new PerformanceObserver((list) => {
            for (const e of list.getEntries()) last = e.startTime
          })
          o.observe({ type: 'largest-contentful-paint', buffered: true })
          setTimeout(() => {
            o.disconnect()
            resolve(last)
          }, 300)
        } catch {
          resolve(null)
        }
      }),
  )
}

/**
 * 5 s Scrollen mit 900 CSS-px/s. Synthetische Touch-Gesten scrollen im Headless-Chromium nicht (gemessen P9.11: 0 px,
 * auch auf einer leeren Seite) – daher eine Maus-Rad-Geste; deren Weg wird mit der Mobil-Emulation skaliert, also
 * vorher an einem kurzen Stück kalibriert (Faktor CSS-px je Gesten-px), danach zurück an den Anfang.
 */
let gestureScale: number | null = null
const gestureAt = (page: Page) => {
  const vp = page.viewportSize()!
  return { x: Math.round(vp.width / 2), y: Math.round(vp.height * 0.7) }
}
async function calibrate(cdp: CDPSession, page: Page): Promise<void> {
  const at = gestureAt(page)
  if (gestureScale === null) {
    const y0 = await page.evaluate(() => scrollY)
    await cdp.send('Input.synthesizeScrollGesture', {
      ...at,
      yDistance: -200,
      speed: 2000,
      gestureSourceType: 'mouse',
    })
    const moved = (await page.evaluate(() => scrollY)) - y0
    gestureScale = moved > 0 ? moved / 200 : 1
    await page.evaluate(
      (y) => window.scrollTo({ top: y, behavior: 'instant' as ScrollBehavior }),
      y0,
    )
    await page.waitForTimeout(300)
  }
}

async function scroll(cdp: CDPSession, page: Page): Promise<void> {
  const scale = gestureScale ?? 1
  await cdp.send('Input.synthesizeScrollGesture', {
    ...gestureAt(page),
    yDistance: -Math.round((SCROLL_PX_PER_S * SCROLL_MS) / 1000 / scale),
    speed: Math.round(SCROLL_PX_PER_S / scale),
    gestureSourceType: 'mouse',
    repeatCount: 1,
  })
}

async function oneRun(
  art: ArtSession,
  cdp: CDPSession,
  url: string,
  route: string,
  trace: boolean,
): Promise<{ marks: Marks; dump: unknown }> {
  const { page } = art
  // Jeder Lauf ohne Korb (sonst steht nach dem ersten „In den Korb“ der Hinweis statt des Knopfs).
  await page.context().clearCookies({ name: 'pc_cart' })
  await page.goto(url, { waitUntil: 'load' })
  await page.waitForFunction(() => !!(window as QaWindow).__qa, undefined, { timeout: 20_000 })
  await art.waitLeash(10_000)
  const lcp = await lcpOf(page)
  await calibrate(cdp, page)
  await page.evaluate(() => (window as QaWindow).__qa!.start())
  const now = () => page.evaluate(() => performance.now())
  const scrollFrom = await now()
  if (trace)
    await page
      .context()
      .browser()!
      .startTracing(page, { categories: ['devtools.timeline'] })
  await scroll(cdp, page)
  const traceBuf = trace ? await page.context().browser()!.stopTracing() : null
  const scrollTo = await now()
  if (traceBuf) writeRunFile(`traces/SC-18-${route}.json`, traceBuf)
  // Menü öffnen und schließen
  const menuAt = await now()
  await page.locator('[data-menu-trigger]').first().click()
  await page.waitForTimeout(800)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(400)
  let addAt: number | null = null
  if (route === 'R04') {
    await page.evaluate(() =>
      document
        .getElementById('add-to-cart')
        ?.scrollIntoView({ block: 'center', behavior: 'instant' as ScrollBehavior }),
    )
    await page.waitForTimeout(300)
    addAt = await now()
    await page.evaluate(() =>
      document.querySelector<HTMLButtonElement>('[data-add-to-cart] button')?.click(),
    )
    await page.waitForTimeout(1000)
  }
  await page.evaluate(() => (window as QaWindow).__qa!.stop())
  const dump = (await page.evaluate(() => {
    const d = (window as QaWindow).__qa!.dump() as { marks: unknown[] }
    // `leash:build` fällt beim Einhängen der Engine – vor `__qa.start()`; aus der Zeitleiste ergänzen (PF-04).
    const builds = performance.getEntriesByName('leash:build', 'measure').map((e) => e.toJSON())
    return {
      ...d,
      marks: [...builds, ...d.marks.filter((m) => (m as { name?: string }).name !== 'leash:build')],
    }
  })) as unknown
  return { marks: { lcp, menuAt, addAt, scrollFrom, scrollTo }, dump }
}

test('SC-18 Tempo-Messung', { tag: artTags(['art-pixel7'], ['tempo']) }, async ({ art }) => {
  test.setTimeout(20 * 60_000)
  const { page, context } = art
  await ownClientIp(context)
  const cdp = await context.newCDPSession(page)
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
  const pieces = await artPieces()
  try {
    const nr = await seedPiece('available')
    const r04 = nr === null ? '/de/shop' : await pathOf(nr, 'de')
    // R07: eigene Kasse mit Fixture-Stück (Reservierung hält länger als die Messung)
    const p = await pieces.create({ priceCents: 4500 })
    await startCheckoutFor(context, page, [{ id: p.id, priceCents: 4500 }])
    const routes: [string, string][] = [
      ['R01', '/de'],
      ['R02', '/de/shop'],
      ['R04', r04],
      ['R07', '/de/kasse'],
    ]
    // Vorlauf (Cache warm), verworfen
    for (const [, url] of routes) await page.goto(url, { waitUntil: 'load' })
    const runs: unknown[] = []
    for (const [route, url] of routes)
      for (const mode of ['engine', 'off'] as const)
        for (let i = 1; i <= RUNS; i++) {
          const target = mode === 'off' ? `${url}${url.includes('?') ? '&' : '?'}leash=off` : url
          const r = await oneRun(art, cdp, target, route, mode === 'engine' && i === 1)
          const rel = `raw/SC-18/art-pixel7/tempo/${route}-${mode}-${i}.json`
          writeJson(rel, {
            scenario: 'SC-18',
            route,
            mode,
            run: i,
            url: target,
            cpuThrottling: 4,
            host: { load1: loadavg()[0]!, cpus: cpus().length },
            ...r,
          })
          runs.push(rel)
        }
    writeJson('raw/SC-18/art-pixel7/tempo/index.json', {
      runs,
      cpuThrottling: 4,
      runsPerMode: RUNS,
    })
  } finally {
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 }).catch(() => undefined)
    await pieces.cleanup()
  }
})
