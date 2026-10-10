import { describe, expect, it } from 'vitest'

import koko from '@/art/koko/koko.json'
import { kokoLid } from '@/components/home/kokoLids'
import { KOKO_SLEEP_HOURS, kokoAsleep } from '@/lib/home/kokoSleep'
import { tourNow } from '@/lib/tour/now'

// U-53 (P14.4): Koko schläft nachts – nach Berliner Uhrzeit 22:00–06:59 geschlossene Lider, sonst wandernde Pupillen.

const at = (iso: string) => kokoAsleep(new Date(iso))

describe('kokoAsleep (Europe/Berlin)', () => {
  it('Schlafenszeit 22–7 Uhr', () => {
    expect(KOKO_SLEEP_HOURS).toEqual({ from: 22, to: 7 })
  })

  it('Sommerzeit (MESZ, UTC+2): 21:59 wach, 22:00 schläft, 06:59 schläft, 07:00 wach', () => {
    expect(at('2026-07-01T19:59:00Z')).toBe(false)
    expect(at('2026-07-01T20:00:00Z')).toBe(true)
    expect(at('2026-07-01T23:30:00Z')).toBe(true) // 01:30 am nächsten Tag
    expect(at('2026-07-02T04:59:00Z')).toBe(true)
    expect(at('2026-07-02T05:00:00Z')).toBe(false)
    expect(at('2026-07-02T10:00:00Z')).toBe(false)
  })

  it('Winterzeit (MEZ, UTC+1): 21:59 wach, 22:00 schläft, 06:59 schläft, 07:00 wach', () => {
    expect(at('2026-12-01T20:59:00Z')).toBe(false)
    expect(at('2026-12-01T21:00:00Z')).toBe(true)
    expect(at('2026-12-02T05:59:00Z')).toBe(true)
    expect(at('2026-12-02T06:00:00Z')).toBe(false)
  })

  it('Tage der Zeitumstellung (29.03. und 25.10.2026)', () => {
    // 29.03.: 02:00 MEZ → 03:00 MESZ; 07:00 MESZ = 05:00 UTC
    expect(at('2026-03-29T04:59:00Z')).toBe(true)
    expect(at('2026-03-29T05:00:00Z')).toBe(false)
    // 25.10.: 03:00 MESZ → 02:00 MEZ; 07:00 MEZ = 06:00 UTC, 22:00 MEZ = 21:00 UTC
    expect(at('2026-10-25T05:30:00Z')).toBe(true)
    expect(at('2026-10-25T06:00:00Z')).toBe(false)
    expect(at('2026-10-25T20:59:00Z')).toBe(false)
    expect(at('2026-10-25T21:00:00Z')).toBe(true)
  })

  it('in der Testumgebung zählt SEED_NOW (tourNow)', () => {
    const night = tourNow({ APP_ENV: 'test', SEED_NOW: '2026-10-15T23:00:00+02:00' })
    const day = tourNow({ APP_ENV: 'test', SEED_NOW: '2026-10-15T10:00:00+02:00' })
    expect(kokoAsleep(night)).toBe(true)
    expect(kokoAsleep(day)).toBe(false)
  })
})

describe('kokoLid (Lider im Stil der Tusche)', () => {
  for (const id of ['l', 'r'] as const) {
    it(`Auge ${id}: deterministisch, deckt den Augapfel oben ab, Unterkante hängt in der Mitte tiefer`, () => {
      const ball = koko.eyes[id].ball
      const a = kokoLid(ball, 1)
      expect(kokoLid(ball, 1)).toEqual(a)
      expect(kokoLid(ball, 2).edge).not.toBe(a.edge)
      const ys = ball.map((p) => p[1]!)
      const top = Math.min(...ys)
      const h = Math.max(...ys) - top
      const pts = a.edge
        .slice(1)
        .split('L')
        .map((p) => p.split(' ').map(Number) as [number, number])
      expect(pts.length).toBeGreaterThanOrEqual(10)
      const mid = pts[Math.floor(pts.length / 2)]!
      // müder Bogen: Mitte tiefer als die Winkel, unten bleibt ein Streifen Augenweiß
      expect(mid[1]).toBeGreaterThan(pts[0]![1] + 0.1 * h)
      expect(mid[1]).toBeGreaterThan(pts.at(-1)![1] + 0.1 * h)
      expect(mid[1]).toBeLessThan(top + h)
      expect(a.fill.startsWith('M')).toBe(true)
      expect(a.fill.endsWith('Z')).toBe(true)
      // klein (Startseiten-SVG ≤ 60 KB, PF-10)
      expect(a.fill.length + a.edge.length + a.hair.length).toBeLessThan(900)
    })
  }
})
