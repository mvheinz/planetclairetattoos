import { cpus, loadavg } from 'node:os'

import type { Page } from '@playwright/test'

import type { ArtSession } from './fixtures'

// Zusatzmessungen der Szenarien für `pnpm art:check` (KUNST-QA §5, PLAN P9.6). Ergebnisse landen über
// `art.extra(key, …)` in `raw/<SC>/<profil>/<variante>/probes.json`.

type LeashWin = Window & {
  __leash?: {
    drawnLen(): number
    cocoLen(): number
    tier(): string
    geometry: { totalLength: number; scrollMap: { readingY: number; len: number }[] }
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
): Promise<{ t: number; coco: number; drawn: number; target: number; scrolling: boolean }[]> {
  return page.evaluate(
    (to) =>
      new Promise((resolve) => {
        const w = window as LeashWin
        const out: {
          t: number
          coco: number
          drawn: number
          target: number
          scrolling: boolean
        }[] = []
        const from = scrollY
        const dur = (Math.abs(to - from) / 3000) * 1000
        const t0 = performance.now()
        const step = (now: number) => {
          const k = dur > 0 ? Math.min(1, (now - t0) / dur) : 1
          // `instant`: html hat `scroll-behavior: smooth` – ein weiches scrollTo liefe selbst 0,5–1 s nach und verfälschte den Nachlauf
          if (k < 1) scrollTo({ top: from + (to - from) * k, behavior: 'instant' })
          else if (scrollY !== to) scrollTo({ top: to, behavior: 'instant' })
          const l = w.__leash
          if (l) {
            // Ziel der Coco = Abbildung der Lesezeile (höchstens das Gezeichnete): dorthin muss sie folgen. Die
            // gezeichnete Linie selbst bleibt beim Zurückscrollen stehen und ist kein Maß für den Rückstand.
            const box = document.querySelector('[data-leash-layer]')?.getBoundingClientRect()
            const sm = l.geometry.scrollMap
            let mapped = 0
            if (box && sm.length) {
              const ry = scrollY + 0.72 * innerHeight - (box.top + scrollY)
              if (ry <= sm[0]!.readingY) mapped = sm[0]!.len
              else if (ry >= sm[sm.length - 1]!.readingY) mapped = sm[sm.length - 1]!.len
              else
                for (let i = 1; i < sm.length; i++)
                  if (sm[i]!.readingY >= ry) {
                    const a = sm[i - 1]!
                    const b = sm[i]!
                    mapped =
                      a.len + (b.len - a.len) * ((ry - a.readingY) / (b.readingY - a.readingY || 1))
                    break
                  }
            }
            out.push({
              t: Math.round(now - t0),
              coco: Math.round(l.cocoLen() * 10) / 10,
              drawn: Math.round(l.drawnLen() * 10) / 10,
              target: Math.round(Math.min(mapped, l.drawnLen()) * 10) / 10,
              scrolling: k < 1,
            })
          }
          if (now - t0 < dur + 1200) requestAnimationFrame(step)
          else resolve(out)
        }
        requestAnimationFrame(step)
      }),
    to,
  )
}

/**
 * MO-10: Intro auf der echten Zeitachse der Seite (eigener Kontext ohne Playwright-Uhr, die `performance.now` und
 * `Date.now` anhält – sonst stünde der LCP bei 0, R2-02-01): LCP = `startTime` des letzten LCP-Kandidaten, Start =
 * erster Frame mit gezeichneter Länge > 0, Ende = letzte Änderung der Länge; alles relativ zur Navigation.
 */
export async function introTiming(art: ArtSession): Promise<{
  lcp: number | null
  start: number | null
  end: number | null
  samples: number
}> {
  const ctx = await art.extraContext({})
  try {
    const page = await ctx.newPage()
    await page.addInitScript(() => {
      const w = window as Window & {
        __artIntro?: { lcp: number | null; start: number | null; end: number | null; n: number }
      }
      const rec = {
        lcp: null as number | null,
        start: null as number | null,
        end: null as number | null,
        n: 0,
      }
      w.__artIntro = rec
      try {
        new PerformanceObserver((list) => {
          const e = list.getEntries().at(-1)
          if (e) rec.lcp = Math.round(e.startTime)
        }).observe({ type: 'largest-contentful-paint', buffered: true })
      } catch {
        // ohne LCP-Unterstützung bleibt lcp null
      }
      let last = 0
      const tick = () => {
        const d = (window as LeashWin).__leash?.drawnLen() ?? 0
        const now = performance.now()
        rec.n++
        if (d > 0 && rec.start === null) rec.start = Math.round(now)
        if (d !== last) {
          last = d
          if (rec.start !== null) rec.end = Math.round(now)
        }
        if (rec.start === null || now - (rec.end ?? now) < 400) requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    })
    await page.goto('/de', { waitUntil: 'load' })
    await page
      .waitForFunction(
        () => {
          const r = (
            window as Window & { __artIntro?: { start: number | null; end: number | null } }
          ).__artIntro
          return !!r && r.start !== null && r.end !== null && performance.now() - r.end > 400
        },
        undefined,
        { timeout: 10_000 },
      )
      .catch(() => undefined)
    const r = await page.evaluate(
      () =>
        (
          window as Window & {
            __artIntro?: { lcp: number | null; start: number | null; end: number | null; n: number }
          }
        ).__artIntro ?? null,
    )
    return {
      lcp: r?.lcp ?? null,
      start: r?.start ?? null,
      end: r?.end ?? null,
      samples: r?.n ?? 0,
    }
  } finally {
    await ctx.close()
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
export async function desktopMeasures(art: ArtSession): Promise<{
  build: number[]
  frame: number[]
  host: { load1Start: number; load1End: number; cpus: number }
}> {
  const load1Start = loadavg()[0]!
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
    const measured = await page.evaluate(() => ({
      build: performance
        .getEntriesByName('leash:build')
        .map((e) => Math.round(e.duration * 100) / 100),
      frame: ((window as Window & { __artFrames?: number[] }).__artFrames ?? []).map(
        (d) => Math.round(d * 100) / 100,
      ),
    }))
    // Rechnerlast während der Messung (R3-04-03): geht mit den Rohwerten nach `metrics/desktop.json`.
    return {
      ...measured,
      host: {
        load1Start: Math.round(load1Start * 100) / 100,
        load1End: Math.round(loadavg()[0]! * 100) / 100,
        cpus: cpus().length,
      },
    }
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
  await art.scrollRun(2400, 600)
  return { before, after: await tier() }
}
