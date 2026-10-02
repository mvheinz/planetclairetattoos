import type { Page } from '@playwright/test'

import budgets from '../../perf/budgets.json'
import { holdShippingRates, type ReleaseLock } from '../../helpers/adminSessionLock'
import { expect, test } from '../fixtures'
import { PUBLISHED } from '../shop/productPage'
import { R06, R07, cleanupCheckouts, hydrated, startCheckoutFor } from './checkoutHelpers'

// P4.25 T-10 / EK-01 (ARCHITEKTUR §7.7): CLS über den Seitenaufbau von Korb R06 (gefüllt, mit Countdown) und Kasse R07
// ≤ 0,1 (Ziel 0,05) – Projekt `pixel-7`, CPU 4× gedrosselt (CDP), wie `perf.e2e.spec.ts` für R01/R02/R04. Fixture-Korb
// analog S01 + S11 (die Seed-Anker bleiben frei).

const { interaction } = budgets

interface Shift {
  value: number
  startTime: number
  hadRecentInput: boolean
}

test.beforeEach(({ browserName }, testInfo) => {
  test.skip(
    testInfo.project.name !== 'pixel-7' || browserName !== 'chromium',
    '@perf läuft laut ARCHITEKTUR §7.3/§7.7 nur im Projekt pixel-7 (Chromium, CDP-Drosselung)',
  )
})

let used: number[] = []
let release: ReleaseLock | undefined
test.beforeEach(async () => {
  release = await holdShippingRates('shared')
})
test.afterEach(async () => {
  await cleanupCheckouts(used)
  used = []
  await release?.()
  release = undefined
})

/** Layout-Verschiebungen ab dem ersten Skript der Seite (gepuffert). */
async function observeShifts(page: Page) {
  await page.addInitScript(() => {
    const shifts: Shift[] = []
    ;(window as unknown as { __shifts: Shift[] }).__shifts = shifts
    new PerformanceObserver((list) => {
      for (const e of list.getEntries() as (PerformanceEntry & Shift)[])
        shifts.push({ value: e.value, startTime: e.startTime, hadRecentInput: e.hadRecentInput })
    }).observe({ type: 'layout-shift', buffered: true })
  })
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

for (const id of ['R06', 'R07'] as const) {
  test(`T-10 EK-01 CLS über den Seitenaufbau von ${id} (Korb gefüllt, Kasse offen) ≤ 0,1 bei 4× CPU-Drosselung @perf`, async ({
    page,
    context,
    fixtureProducts,
  }, testInfo) => {
    const keramik = await fixtureProducts.create('keramik', { ...PUBLISHED, priceCents: 4500 })
    const textil = await fixtureProducts.create('textil', { ...PUBLISHED, priceCents: 6400 })
    used.push(keramik.id, textil.id)
    await startCheckoutFor(context, page, [{ id: keramik.id }, { id: textil.id }])
    await hydrated(page)

    const measured = await context.newPage()
    await measured.emulateMedia({ reducedMotion: 'no-preference' })
    await observeShifts(measured)
    const cdp = await context.newCDPSession(measured)
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: interaction.cpuThrottling })
    await measured.goto(id === 'R06' ? R06.de : R07.de, { waitUntil: 'load' })
    if (id === 'R07') await hydrated(measured)
    else await expect(measured.locator('[data-cart-line]')).toHaveCount(2)
    await measured.evaluate(async () => {
      const step = Math.round(innerHeight * 0.8)
      for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
        scrollTo(0, y)
        await new Promise((r) => setTimeout(r, 120))
      }
      scrollTo(0, 0)
      await new Promise((r) => setTimeout(r, 300))
    })
    const shifts = await measured.evaluate(
      () => (window as unknown as { __shifts: Shift[] }).__shifts,
    )
    const cls = cumulativeLayoutShift(shifts)
    const line = `${cls.toFixed(3)} (Gate ≤ ${interaction.cls.max}, Ziel ≤ ${interaction.cls.target}${cls > interaction.cls.target ? ' – Ziel verfehlt' : ''})`
    testInfo.annotations.push({ type: `CLS ${id}`, description: line })
    console.log(`@perf CLS ${id}: ${line}`)
    expect(cls).toBeLessThanOrEqual(interaction.cls.max)
  })
}
