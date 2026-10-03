import type { Page } from '@playwright/test'

// Deterministische Frame-Aufnahme (KUNST-QA §4.4): scrollgekoppelt (`scrollTo` + 2 rAF bzw. `__leash.setReadingY`),
// zeitbasiert per WAAPI-Seek über `document.getAnimations()` und per Playwright-Clock für rAF/Timer, Boil-Seek auf
// 0/1/2 Frame-Längen. Alle Hilfen laufen im Browser über `page.evaluate` (kein Eingriff in den Produktcode).

/** Zwei Frames abwarten – bei angehaltener Uhr per `clock.runFor`, sonst echte rAF. */
export async function twoFrames(page: Page, clockPaused: boolean): Promise<void> {
  if (clockPaused) await page.clock.runFor(34)
  else
    await page.evaluate(
      () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))),
    )
}

/** Schriften und Bilder im Sichtbereich fertig (höchstens `timeoutMs`, Zeitgrenze im Testprozess – die Browser-Uhr
 * kann angehalten sein). */
export async function waitForPaint(page: Page, timeoutMs = 4000): Promise<void> {
  const work = page
    .evaluate(async () => {
      const visible = Array.from(document.images).filter((img) => {
        const r = img.getBoundingClientRect()
        return r.width > 0 && r.bottom > -50 && r.top < innerHeight + 50
      })
      await Promise.all([
        document.fonts.ready,
        ...visible.map((img) => (img.complete ? null : img.decode().catch(() => undefined))),
      ])
    })
    .catch(() => undefined)
  let timer: ReturnType<typeof setTimeout> | undefined
  await Promise.race([work, new Promise<void>((r) => (timer = setTimeout(r, timeoutMs)))])
  if (timer) clearTimeout(timer)
}

/** Sanftes Scrollen in Echtzeit (für das Video): `pxPerSec` gleichmäßig bis `to`. */
export async function scrollRun(page: Page, to: number, pxPerSec: number): Promise<void> {
  await page.evaluate(
    ({ to, pxPerSec }) =>
      new Promise<void>((resolve) => {
        const from = scrollY
        const dist = to - from
        const dur = (Math.abs(dist) / pxPerSec) * 1000
        if (dur < 1) return resolve()
        const t0 = performance.now()
        const step = (t: number) => {
          const k = Math.min(1, (t - t0) / dur)
          scrollTo(0, from + dist * k)
          if (k < 1) requestAnimationFrame(step)
          else resolve()
        }
        requestAnimationFrame(step)
      }),
    { to, pxPerSec },
  )
}

/** Gesamthöhe des scrollbaren Bereichs (max. `scrollY`). */
export const maxScroll = (page: Page) =>
  page.evaluate(() => Math.max(0, document.documentElement.scrollHeight - innerHeight))

/**
 * WAAPI-/CSS-Animationen auf die (Clock-)Zeit `t` setzen: jede Animation wird beim ersten Sehen angehalten und ihr
 * Startpunkt relativ zu `t` gemerkt; danach `currentTime = t − Start`. So laufen per Clock ausgelöste Animationen
 * (Timer, rAF) und CSS-Übergänge deterministisch mit.
 */
export async function seekAnimations(page: Page, t: number): Promise<number> {
  return page.evaluate((t) => {
    const w = window as Window & { __artBorn?: WeakMap<Animation, number> }
    const born = (w.__artBorn ??= new WeakMap())
    let n = 0
    for (const a of document.getAnimations()) {
      if (a.playState === 'finished' && !born.has(a)) continue
      if (!born.has(a)) born.set(a, t - Number(a.currentTime ?? 0))
      try {
        a.pause()
        a.currentTime = Math.max(0, t - born.get(a)!)
        n++
      } catch {
        // abgebrochene Animation
      }
    }
    return n
  }, t)
}

/** Angehaltene Animationen wieder laufen lassen und die Startpunkte vergessen. */
export async function releaseAnimations(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as Window & { __artBorn?: WeakMap<Animation, number> }
    for (const a of document.getAnimations()) if (a.playState === 'paused') a.play()
    w.__artBorn = new WeakMap()
  })
}

/** Boil-Seek (§4.4): alle Boil-Animationen auf `k` Frame-Längen (Dauer der Animation / 3). */
export async function seekBoil(page: Page, k: number): Promise<void> {
  await page.evaluate((k) => {
    for (const a of document.getAnimations()) {
      const name = (a as CSSAnimation).animationName
      if (name !== 'coco-boil') continue
      const dur = Number(a.effect?.getTiming().duration ?? 0)
      a.pause()
      a.currentTime = (dur / 3) * k
    }
  }, k)
}

/** Text aller Live-Regionen (für SC-06/SC-07). */
export const liveRegionTexts = (page: Page) =>
  page.evaluate(() =>
    Array.from(document.querySelectorAll('[aria-live], [role="status"], [role="alert"]')).map(
      (el) => ({
        live: el.getAttribute('aria-live') ?? el.getAttribute('role'),
        text: (el.textContent ?? '').replace(/\s+/g, ' ').trim(),
      }),
    ),
  )

/** Protokoll der laufenden Animationen (`getAnimations()`, SC-06). */
export const animationLog = (page: Page) =>
  page.evaluate(() =>
    document.getAnimations().map((a) => {
      const target = (a.effect as KeyframeEffect | null)?.target as Element | null
      return {
        name:
          (a as CSSAnimation).animationName ??
          (a as CSSTransition).transitionProperty ??
          a.id ??
          '',
        kind: a.constructor.name,
        state: a.playState,
        currentTime: a.currentTime === null ? null : Number(a.currentTime),
        duration: Number(a.effect?.getTiming().duration ?? 0) || null,
        target: target
          ? `${target.tagName.toLowerCase()}${target.id ? `#${target.id}` : ''}${
              target.classList.length ? `.${Array.from(target.classList).join('.')}` : ''
            }`
          : null,
      }
    }),
  )
