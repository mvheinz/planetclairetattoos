import type { Page } from '@playwright/test'

import { READING_LINE, loopScroll } from '../../../src/leash/presets'
import type { LoopKind } from '../../../src/leash/types'
import type { ArtSession } from './fixtures'

// Stationen der Tuschelinie für scrollgekoppelte Frames (KUNST-QA §4.3 SC-01/SC-02, §4.4; DESIGN §9.6): Station-Grenzen
// `y − 40`, `y`, `y + loopScroll/2`, `y + loopScroll` in Lesezeilen-Koordinaten (relativ zur Linien-Ebene).

export interface ArtStation {
  id: string
  y: number
  loop: LoopKind
  loopScroll: number
}

export async function leashStations(page: Page): Promise<ArtStation[]> {
  const raw = await page.evaluate(() => {
    const w = window as Window & {
      __leash?: { geometry: { stations: { id: string; y: number }[] } }
    }
    const g = w.__leash?.geometry
    if (!g) return { vw: innerWidth, stations: [] as { id: string; y: number; loop: string }[] }
    return {
      vw: innerWidth,
      stations: g.stations.map((s) => ({
        id: s.id,
        y: s.y,
        loop:
          document
            .querySelector(`[data-leash-station="${CSS.escape(s.id)}"]`)
            ?.getAttribute('data-leash-loop') ?? 'none',
      })),
    }
  })
  return raw.stations.map((s) => ({
    ...s,
    loop: s.loop as LoopKind,
    loopScroll: loopScroll(s.loop as LoopKind, raw.vw),
  }))
}

/** Lesezeile exakt auf `readingY` (Debug-Schnittstelle) und Seite passend scrollen, dann Standbild. */
export async function readingFrame(
  art: ArtSession,
  readingY: number,
  label: string,
): Promise<string> {
  await art.page.evaluate(
    ({ readingY, line }) => {
      const layer = document.querySelector('[data-leash-layer]')
      const rootTop = layer ? layer.getBoundingClientRect().top + scrollY : 0
      // `instant`: die Seite scrollt sonst weich (`scroll-behavior: smooth`) und das Standbild zeigt eine
      // Zwischenlage – Stationstext abgeschnitten, Kopfleiste versetzt (R3-01-04)
      scrollTo({
        top: Math.max(0, readingY + rootTop - line * innerHeight),
        behavior: 'instant' as ScrollBehavior,
      })
      const w = window as Window & {
        __leash?: { setReadingY(y: number | null): void }
        __artReadingY?: number | null
      }
      w.__artReadingY = readingY
      w.__leash?.setReadingY(readingY)
    },
    { readingY, line: READING_LINE },
  )
  return art.settledFrame(label)
}

/** Lesezeile wieder dem Scrollen überlassen. */
export async function releaseReading(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as Window & {
      __leash?: { setReadingY(y: number | null): void }
      __artReadingY?: number | null
    }
    w.__artReadingY = null
    w.__leash?.setReadingY(null)
  })
}

/** Station-Grenzen einer Station (§4.3 SC-01). */
export const stationBounds = (s: ArtStation) => [
  { y: s.y - 40, tag: 'before' },
  { y: s.y, tag: 'arrive' },
  { y: s.y + s.loopScroll / 2, tag: 'loop-half' },
  { y: s.y + s.loopScroll, tag: 'loop-end' },
]
