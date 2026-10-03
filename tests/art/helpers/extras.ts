import type { Page } from '@playwright/test'

import type { ArtSession } from './fixtures'

// Zusatzmessungen der Szenarien für `pnpm art:check` (KUNST-QA §5, PLAN P9.6). Ergebnisse landen über
// `art.extra(key, …)` in `raw/<SC>/<profil>/<variante>/probes.json`.

type LeashWin = Window & {
  __leash?: {
    drawnLen(): number
    cocoLen(): number
    tier(): string
    geometry: { totalLength: number }
  }
}

/** Tab-Reihenfolge (A11Y-03): die ersten `n` Fokus-Ziele als Beschreibung. */
export async function tabOrder(page: Page, n = 25): Promise<string[]> {
  await page.evaluate(() => {
    ;(document.activeElement as HTMLElement | null)?.blur?.()
    scrollTo(0, 0)
  })
  const out: string[] = []
  for (let i = 0; i < n; i++) {
    await page.keyboard.press('Tab')
    out.push(
      await page.evaluate(() => {
        const a = document.activeElement
        if (!a || a === document.body) return 'body'
        return `${a.tagName.toLowerCase()}|${a.getAttribute('href') ?? ''}|${(a.textContent ?? '').trim().slice(0, 30)}`
      }),
    )
  }
  return out
}

/** MO-07: schnelles Wischen (3000 px/s) und 1 s Nachlauf; je Frame Bogenlänge von Coco und gezeichneter Linie. */
export function followSamples(
  page: Page,
  to: number,
): Promise<{ t: number; coco: number; drawn: number; scrolling: boolean }[]> {
  return page.evaluate(
    (to) =>
      new Promise((resolve) => {
        const w = window as LeashWin
        const out: { t: number; coco: number; drawn: number; scrolling: boolean }[] = []
        const from = scrollY
        const dur = (Math.abs(to - from) / 3000) * 1000
        const t0 = performance.now()
        const step = (now: number) => {
          const k = dur > 0 ? Math.min(1, (now - t0) / dur) : 1
          if (k < 1) scrollTo(0, from + (to - from) * k)
          else if (scrollY !== to) scrollTo(0, to)
          const l = w.__leash
          if (l)
            out.push({
              t: Math.round(now - t0),
              coco: Math.round(l.cocoLen() * 10) / 10,
              drawn: Math.round(l.drawnLen() * 10) / 10,
              scrolling: k < 1,
            })
          if (now - t0 < dur + 1200) requestAnimationFrame(step)
          else resolve(out)
        }
        requestAnimationFrame(step)
      }),
    to,
  )
}

/** MO-10: Intro bei angehaltener Uhr in 20-ms-Schritten (Start relativ zur Navigation, LCP per Beobachter). */
export async function introTiming(art: ArtSession): Promise<{
  lcp: number | null
  start: number | null
  end: number | null
  samples: number
}> {
  const { page } = art
  await page.addInitScript(() => {
    const w = window as Window & { __artLcp?: number | null }
    w.__artLcp = null
    try {
      new PerformanceObserver(() => {
        w.__artLcp ??= Date.now()
      }).observe({ type: 'largest-contentful-paint', buffered: true })
    } catch {
      // WebKit ohne LCP
    }
  })
  await art.pauseClock()
  const t0 = await page.evaluate(() => Date.now())
  await page.goto('/de', { waitUntil: 'load' })
  const samples: { t: number; drawn: number | null }[] = []
  for (let i = 0; i < 260; i++) {
    samples.push(
      await page.evaluate(() => ({
        t: Date.now(),
        drawn: (window as LeashWin).__leash?.drawnLen() ?? null,
      })),
    )
    const last = samples.slice(-6)
    if (
      last.length === 6 &&
      last.every((s) => s.drawn !== null && s.drawn > 0 && s.drawn === last[0]!.drawn)
    )
      break
    await page.clock.runFor(20)
  }
  const lcpAt = await page.evaluate(
    () => (window as Window & { __artLcp?: number | null }).__artLcp ?? null,
  )
  await art.resumeClock()
  const first = samples.find((s) => (s.drawn ?? 0) > 0)
  const final = samples[samples.length - 1]?.drawn ?? null
  const done =
    final === null ? undefined : samples.find((s) => s.drawn !== null && s.drawn >= final - 0.5)
  return {
    lcp: lcpAt === null ? null : lcpAt - t0,
    start: first ? first.t - t0 : null,
    end: done ? done.t - t0 : null,
    samples: samples.length,
  }
}

/** MO-05/MO-06: frische Seite, Lesezeile an 12 steigenden Positionen, dann 400 px zurück – je eine Sonde (ohne Bild). */
export async function readingSeries(art: ArtSession): Promise<void> {
  const { page } = art
  await art.goto('/de')
  await page.waitForTimeout(1600)
  const range = await page.evaluate(() => {
    const sm = (
      window as Window & { __leash?: { geometry: { scrollMap: { readingY: number }[] } } }
    ).__leash?.geometry.scrollMap
    const layer = document.querySelector('[data-leash-layer]')
    const top = layer ? layer.getBoundingClientRect().top + scrollY : 0
    // Erst unterhalb der Lesezeile beim Laden beginnen (dort hat das Intro schon gezeichnet).
    const start = 0.72 * innerHeight - top + 40
    return sm && sm.length
      ? { a: Math.max(sm[0]!.readingY, start), b: sm[sm.length - 1]!.readingY }
      : null
  })
  if (!range) return
  const set = (y: number) =>
    page.evaluate(
      ({ y }) =>
        new Promise<void>((resolve) => {
          const w = window as Window & {
            __leash?: { setReadingY(y: number | null): void }
            __artReadingY?: number | null
          }
          const layer = document.querySelector('[data-leash-layer]')
          const top = layer ? layer.getBoundingClientRect().top + scrollY : 0
          scrollTo(0, Math.max(0, y + top - 0.72 * innerHeight))
          w.__artReadingY = y
          w.__leash?.setReadingY(y)
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
        }),
      { y },
    )
  let last = range.a
  for (let i = 0; i < 12; i++) {
    last = range.a + ((range.b - range.a) * 0.9 * (i + 1)) / 12
    await set(last)
    await art.probe(`mo05-${String(i + 1).padStart(2, '0')}`)
  }
  await set(last - 400)
  await art.probe('mo06-up400')
  await page.evaluate(() => {
    const w = window as Window & {
      __leash?: { setReadingY(y: number | null): void }
      __artReadingY?: number | null
    }
    w.__artReadingY = null
    w.__leash?.setReadingY(null)
  })
}

/** PF-03/PF-04 Desktop 1×: eigener Kontext ohne Playwright-Uhr (sie ersetzt performance.now), R01 laden und scrollen,
 * dann die `leash:build`-/`leash:frame`-Messungen der Engine. */
export async function desktopMeasures(
  art: ArtSession,
): Promise<{ build: number[]; frame: number[] }> {
  const ctx = await art.extraContext({})
  try {
    const page = await ctx.newPage()
    await page.goto('/de', { waitUntil: 'load' })
    await page
      .waitForFunction(() => !!(window as LeashWin).__leash, undefined, { timeout: 8000 })
      .catch(() => undefined)
    await page.evaluate(
      () =>
        new Promise<void>((resolve) => {
          const frame: number[] = []
          const po = new PerformanceObserver((l) => {
            for (const e of l.getEntries()) if (e.name === 'leash:frame') frame.push(e.duration)
          })
          po.observe({ type: 'measure' })
          const t0 = performance.now()
          const step = () => {
            scrollTo(0, ((performance.now() - t0) / 1000) * 900)
            if (performance.now() - t0 < 3000) requestAnimationFrame(step)
            else {
              po.disconnect()
              ;(window as Window & { __artFrames?: number[] }).__artFrames = frame
              resolve()
            }
          }
          requestAnimationFrame(step)
        }),
    )
    return await page.evaluate(() => ({
      build: performance
        .getEntriesByName('leash:build')
        .map((e) => Math.round(e.duration * 100) / 100),
      frame: ((window as Window & { __artFrames?: number[] }).__artFrames ?? []).map(
        (d) => Math.round(d * 100) / 100,
      ),
    }))
  } finally {
    await ctx.close()
  }
}

/** PF-11: Tab verborgen → Engine-Frames (`leash:frame`) über 2 s bei Scrollen zählen. */
export function hiddenFrames(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        Object.defineProperty(document, 'visibilityState', {
          configurable: true,
          get: () => 'hidden',
        })
        Object.defineProperty(document, 'hidden', { configurable: true, get: () => true })
        document.dispatchEvent(new Event('visibilitychange'))
        let n = 0
        const po = new PerformanceObserver((l) => {
          n += l.getEntries().filter((e) => e.name === 'leash:frame').length
        })
        po.observe({ type: 'measure' })
        let y = scrollY
        const iv = setInterval(() => scrollTo(0, (y += 40)), 50)
        setTimeout(() => {
          clearInterval(iv)
          po.disconnect()
          resolve(n)
        }, 2000)
      }),
  )
}

/** PF-12: Stufe vor/nach 2 s Scrollen unter künstlicher Last (`?qa-jank=30`). */
export async function jankTier(
  art: ArtSession,
): Promise<{ before: string | null; after: string | null }> {
  const tier = () => art.page.evaluate(() => (window as LeashWin).__leash?.tier() ?? null)
  await art.goto('/de?qa-jank=30')
  const before = await tier()
  await art.scrollRun(1200, 600)
  return { before, after: await tier() }
}
