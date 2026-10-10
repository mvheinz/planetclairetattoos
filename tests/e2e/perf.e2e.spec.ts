import { expect, test, type Page, type TestInfo } from '@playwright/test'

import budgets from '../perf/budgets.json'

// P2.23 Tempo im Browser (ARCHITEKTUR §7.7, DESIGN §9.10, KONZEPT EK-01) – Projekt `pixel-7`, CPU 4× gedrosselt (CDP):
// - INP-Ersatz: Menü öffnen (Event Timing, längste Interaktion) ≤ 200 ms (Ziel 150 ms, nur Bericht);
// - CLS über den Seitenaufbau (`layout-shift`, Sitzungsfenster wie Web Vitals) ≤ 0,1 (Ziel 0,05);
// - Arbeit je Frame der Tuschelinie beim Scrollen ≤ 6 ms (p95 der User-Timing-Messungen `leash:frame`, wie KUNST-QA
//   PF-03). Die Engine setzt sie immer (`LEASH_MEASURES` in `src/leash/runtime.ts`); gelesen per `PerformanceObserver`,
//   also ohne Debug-Schnittstelle `window.__leash`/`__qa` – der Job `quality` misst den Produktions-Build (DESIGN §9.13).
// Die Messwerte stehen als Annotation im Bericht. R04 „Zoom öffnen“ seit P3.10; R02/R04 (In den Korb, Filter) kommen mit P3/P4 dazu.

const { interaction } = budgets

/** CPU-Drosselung: Budget-Wert (4×); die lokale Prüfschleuse passt sie an einen langsameren Rechner an (U-65,
 *  `PERF_CPU_RATE` aus `scripts/ci/lighthouse-calibrated.ts --rate`, Lighthouse docs/throttling.md). */
const cpuRate = () => Number(process.env.PERF_CPU_RATE) || interaction.cpuThrottling

test.beforeEach(({ browserName }, testInfo) => {
  test.skip(
    testInfo.project.name !== 'pixel-7' || browserName !== 'chromium',
    '@perf läuft laut ARCHITEKTUR §7.3/§7.7 nur im Projekt pixel-7 (Chromium, CDP-Drosselung)',
  )
})

type PerfWindow = Window & {
  __perf: {
    events: { name: string; duration: number; interactionId: number }[]
    shifts: Shift[]
    /** User-Timing der Tuschelinie (`leash:build`, `leash:frame`). */
    leash: { name: string; duration: number }[]
  }
}
interface Shift {
  value: number
  startTime: number
  hadRecentInput: boolean
}

/** Beobachter vor dem ersten Skript der Seite (gepuffert): Event Timing und Layout-Verschiebungen. */
async function observe(page: Page) {
  await page.addInitScript(() => {
    const store: PerfWindow['__perf'] = { events: [], shifts: [], leash: [] }
    ;(window as unknown as PerfWindow).__perf = store
    new PerformanceObserver((list) => {
      for (const e of list.getEntries() as PerformanceEventTiming[])
        store.events.push({
          name: e.name,
          duration: e.duration,
          interactionId:
            (e as PerformanceEventTiming & { interactionId?: number }).interactionId ?? 0,
        })
    }).observe({ type: 'event', buffered: true, durationThreshold: 16 } as PerformanceObserverInit)
    new PerformanceObserver((list) => {
      for (const e of list.getEntries() as (PerformanceEntry & Shift)[])
        store.shifts.push({
          value: e.value,
          startTime: e.startTime,
          hadRecentInput: e.hadRecentInput,
        })
    }).observe({ type: 'layout-shift', buffered: true })
    // Die Engine leert den Puffer von `leash:frame` regelmäßig – der Beobachter sieht trotzdem jede Messung.
    new PerformanceObserver((list) => {
      for (const e of list.getEntries())
        if (e.name.startsWith('leash:')) store.leash.push({ name: e.name, duration: e.duration })
    }).observe({ type: 'measure', buffered: true })
  })
}

async function throttle(page: Page) {
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpuRate() })
  return cdp
}

/** CLS nach Web-Vitals-Definition: größtes Sitzungsfenster (Lücke < 1 s, Fenster ≤ 5 s), ohne Eingabe-Verschiebungen. */
function cumulativeLayoutShift(shifts: Shift[]): number {
  let max = 0
  let current = 0
  let first = 0
  let last = 0
  for (const s of shifts.filter((x) => !x.hadRecentInput)) {
    if (current > 0 && s.startTime - last < 1000 && s.startTime - first < 5000) current += s.value
    else {
      current = s.value
      first = s.startTime
    }
    last = s.startTime
    max = Math.max(max, current)
  }
  return max
}

function report(testInfo: TestInfo, type: string, description: string) {
  testInfo.annotations.push({ type, description })
  console.log(`@perf ${type}: ${description}`)
}

const trigger = (page: Page) => page.locator('[data-site-header] [data-menu-trigger]')

test.describe('Tempo @perf', () => {
  test('T-10 INP-Ersatz: Menü öffnen ≤ 200 ms bei 4× CPU-Drosselung @perf', async ({
    page,
  }, testInfo) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await observe(page)
    await page.goto('/de')
    await expect(trigger(page)).toHaveAttribute('role', 'button')
    await throttle(page)
    await trigger(page).click()
    await expect(page.locator('dialog#menu')).toBeVisible()
    // Event-Timing-Einträge erscheinen nach dem nächsten Frame.
    await page.evaluate(
      () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
    )
    const events = await page.evaluate(() =>
      (window as unknown as PerfWindow).__perf.events.filter((e) => e.interactionId > 0),
    )
    // Unter 16 ms meldet Event Timing nichts (durationThreshold) – dann liegt die Interaktion darunter.
    const inp = events.length ? Math.max(...events.map((e) => e.duration)) : 16
    report(
      testInfo,
      'INP-Ersatz Menü öffnen',
      `${Math.round(inp)} ms (Gate ≤ ${interaction.inpMs.max} ms, Ziel ≤ ${interaction.inpMs.target} ms${inp > interaction.inpMs.target ? ' – Ziel verfehlt' : ''})`,
    )
    expect(inp).toBeLessThanOrEqual(interaction.inpMs.max)
  })

  test('T-10 INP-Ersatz: Zoom öffnen auf R04 ≤ 200 ms bei 4× CPU-Drosselung @perf (P3.10)', async ({
    page,
  }, testInfo) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await observe(page)
    // S01 (Nr. 901) hat zwei Fotos.
    await page.goto('/de/shop/901-schale-langohr-wuschel')
    // Das Modul `gallery` ist gebunden, sobald die Knöpfe nicht mehr `hidden` sind; `lightbox` im selben Durchgang.
    await expect(page.locator('[data-gallery]')).toHaveAttribute('data-gallery-index', '0')
    await throttle(page)
    await page.locator('a[data-zoom-src]').first().click()
    await expect(page.locator('dialog[data-lightbox]')).toBeVisible()
    await page.evaluate(
      () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
    )
    const events = await page.evaluate(() =>
      (window as unknown as PerfWindow).__perf.events.filter((e) => e.interactionId > 0),
    )
    const inp = events.length ? Math.max(...events.map((e) => e.duration)) : 16
    report(
      testInfo,
      'INP-Ersatz Zoom öffnen',
      `${Math.round(inp)} ms (Gate ≤ ${interaction.inpMs.max} ms, Ziel ≤ ${interaction.inpMs.target} ms${inp > interaction.inpMs.target ? ' – Ziel verfehlt' : ''})`,
    )
    expect(inp).toBeLessThanOrEqual(interaction.inpMs.max)
  })

  // ARCHITEKTUR §7.7: CLS per Playwright auf R01 und (P3.16) R02, R04.
  for (const [id, path] of [
    ['R01', '/de'],
    ['R02', '/de/shop'],
    ['R04', '/de/shop/901-schale-langohr-wuschel'],
  ] as const) {
    test(`T-10 CLS über den Seitenaufbau von ${id} ≤ 0,1 bei 4× CPU-Drosselung @perf`, async ({
      page,
    }, testInfo) => {
      await page.emulateMedia({ reducedMotion: 'no-preference' })
      await observe(page)
      await throttle(page)
      await page.goto(path, { waitUntil: 'load' })
      // Einmal bis zum Fuß und zurück: Stationen/Karten, Zeichnungen, Linie und Coco bauen auf.
      await page.evaluate(async () => {
        const step = Math.round(innerHeight * 0.8)
        for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
          scrollTo(0, y)
          await new Promise((r) => setTimeout(r, 120))
        }
        scrollTo(0, 0)
        await new Promise((r) => setTimeout(r, 300))
      })
      const shifts = await page.evaluate(() => (window as unknown as PerfWindow).__perf.shifts)
      const cls = cumulativeLayoutShift(shifts)
      report(
        testInfo,
        `CLS ${id}`,
        `${cls.toFixed(3)} (Gate ≤ ${interaction.cls.max}, Ziel ≤ ${interaction.cls.target}${cls > interaction.cls.target ? ' – Ziel verfehlt' : ''})`,
      )
      expect(cls).toBeLessThanOrEqual(interaction.cls.max)
    })
  }

  test('DESIGN §9.10: Arbeit je Frame der Tuschelinie beim Scrollen ≤ 6 ms bei 4× Drosselung @perf', async ({
    page,
  }, testInfo) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await observe(page)
    await page.goto('/de')
    // Engine geladen und Linie aufgebaut (erste `leash:build`-Messung) – ohne Debug-Build erkennbar.
    await page.waitForFunction(() =>
      (window as unknown as PerfWindow).__perf.leash.some((e) => e.name === 'leash:build'),
    )
    await expect(page.locator('[data-leash-layer] svg path').first()).toBeAttached()
    await throttle(page)
    const frames = await page.evaluate(async () => {
      const store = (window as unknown as PerfWindow).__perf
      // Messfenster beginnt hier (bisher `__qa.start()`): frühere Messungen verwerfen.
      store.leash.length = 0
      const end = document.documentElement.scrollHeight - innerHeight
      for (let y = 0; y <= end; y += 40) {
        scrollTo(0, y)
        // Keine benannten Hilfsfunktionen im Browser-Code (tsx fügt sonst `__name` ein).
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
      }
      // Beobachter-Einträge kommen asynchron – einen Task abwarten.
      await new Promise((r) => setTimeout(r, 50))
      return store.leash.filter((m) => m.name === 'leash:frame').map((m) => m.duration)
    })
    expect(frames.length, 'die Linie hat beim Scrollen gezeichnet').toBeGreaterThan(10)
    const sorted = [...frames].sort((a, b) => a - b)
    const max = sorted.at(-1)!
    const p95 = sorted[Math.floor(sorted.length * 0.95)]!
    report(
      testInfo,
      'Arbeit je Frame (leash:frame)',
      `${frames.length} Frames, p95 ${p95.toFixed(2)} ms, max ${max.toFixed(2)} ms (Gate p95 ≤ ${interaction.frameWorkMs.max} ms, KUNST-QA PF-03)`,
    )
    // Maß laut KUNST-QA PF-03: p95 von `leash:frame` (einzelne Ausreißer durch GC/Drosselung zählen nicht).
    expect(p95).toBeLessThanOrEqual(interaction.frameWorkMs.max)
  })
})
