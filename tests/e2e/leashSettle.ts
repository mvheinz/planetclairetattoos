import type { Page } from '@playwright/test'

// P14.13 (U-62, Wackel-Tests): Warten auf einen Zustand statt fester Wartezeit. Das Intro der Linie (MI-10, 1800 ms ab
// dem ersten Frame) und das Nachziehen von Coco dauern auf ausgelasteten CI-Runnern unterschiedlich lange; feste 1,2–2,2 s
// waren dort mal zu kurz. Hier gilt die Linie als „ruhig“, wenn sich gezeichnete Länge und Coco-Position über `quietMs`
// nicht mehr ändern (Debug-Schnittstelle `window.__leash`, DESIGN §9.13). Höchstens `timeoutMs`, dann Fehler.

type LeashProbe = Window & { __leash?: { drawnLen(): number; cocoLen(): number } }

export async function waitForLeashSettled(
  page: Page,
  { quietMs = 400, timeoutMs = 15_000 }: { quietMs?: number; timeoutMs?: number } = {},
): Promise<void> {
  await page.waitForFunction(
    (quiet) => {
      const w = window as LeashProbe & { __pcSettle?: { key: string; since: number } }
      const l = w.__leash
      if (!l) return false
      const key = `${l.drawnLen().toFixed(1)}|${l.cocoLen().toFixed(1)}`
      const now = performance.now()
      if (!w.__pcSettle || w.__pcSettle.key !== key) {
        w.__pcSettle = { key, since: now }
        return false
      }
      if (now - w.__pcSettle.since < quiet) return false
      delete w.__pcSettle
      return true
    },
    quietMs,
    { polling: 50, timeout: timeoutMs },
  )
}
