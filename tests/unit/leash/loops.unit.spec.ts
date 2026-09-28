import { describe, expect, it } from 'vitest'

import { buildGeometry, buildGeometryWithSamples } from '@/leash/geometry'
import { fnv1a32 } from '@/leash/random'
import type { BuildInput, LeashAnchor, LoopKind, PresetId } from '@/leash/types'

import { journeyInput } from './fixtures'

// P2.15 Schlaufenformen und Freiraum-Regeln (DESIGN §9.5).

function railInput(loop: LoopKind, viewport: { w: number; h: number }, seed = 1): BuildInput {
  const desktop = viewport.w >= 768
  const gutter = desktop ? 64 : 44
  const anchors: LeashAnchor[] = [
    { id: 'start', kind: 'start', x: gutter / 2, y: 0, w: 0, h: 0, loop: 'none' },
    { id: 'a', kind: 'station', x: 60, y: 300, w: 24, h: 24, loop, pose: 'sitzen' },
    { id: 'b', kind: 'station', x: 60, y: 900, w: 24, h: 24, loop, pose: 'sitzen' },
  ]
  return {
    preset: 'journey',
    seed,
    root: { w: viewport.w, h: 1400 },
    viewport,
    gutter,
    baseWidth: desktop ? 2.6 : 2.2,
    anchors,
  }
}

function single(
  preset: PresetId,
  anchor: Omit<LeashAnchor, 'id' | 'kind'>,
  viewport = { w: 390, h: 844 },
): BuildInput {
  return {
    preset,
    seed: fnv1a32(`${preset}:test`),
    root: { w: viewport.w, h: 1200 },
    viewport,
    gutter: 0,
    baseWidth: 2.2,
    anchors: [{ id: 'x', kind: 'station', ...anchor }],
  }
}

describe('leash/loops – Freiraum-Regeln (§9.5)', () => {
  it('Rinnen-Schlaufen bleiben in der Rinne: Radius + halbe Linienbreite + 2 ≤ halbe Rinnenbreite', () => {
    for (const vp of [
      { w: 390, h: 844 },
      { w: 1024, h: 768 },
      { w: 1440, h: 900 },
    ]) {
      for (const loop of ['right', 'left', 'spiral'] as const) {
        for (const seed of [1, 2, 3, 99, 12345]) {
          const input = railInput(loop, vp, seed)
          const rail = input.gutter / 2
          const { geometry, samples } = buildGeometryWithSamples(input)
          for (const st of geometry.stations) {
            let worst = -Infinity
            for (let i = 0; i < samples.s.length; i++) {
              const s = samples.s[i]!
              if (s < st.loopLen0 || s > st.loopLen1) continue
              worst = Math.max(worst, Math.abs(samples.x[i]! - rail) + samples.w[i]! / 2 + 2)
            }
            expect(worst, `${loop} ${vp.w} seed ${seed}`).toBeLessThanOrEqual(input.gutter / 2)
          }
        }
      }
    }
  })

  it('journey-Fixture: alle Rinnen-Abschnitte außerhalb von orbit/lasso bleiben in der Rinne', () => {
    const input = journeyInput()
    const { geometry, samples } = buildGeometryWithSamples(input)
    // Kopf-Station: Weg zur Planet-Marke und zurück liegt absichtlich außerhalb der Rinne.
    const hallo = geometry.stations.find((s) => s.id === 'hallo')!
    for (let i = 0; i < samples.s.length; i++) {
      if (samples.s[i]! < hallo.loopLen0) continue
      expect(Math.abs(samples.x[i]! - input.gutter / 2) + samples.w[i]! / 2).toBeLessThanOrEqual(
        input.gutter / 2,
      )
    }
  })

  it('Schlaufen machen die Linie länger als der gerade Weg (Schlaufe ist wirklich gezeichnet)', () => {
    const straight = buildGeometry(railInput('none', { w: 390, h: 844 }))
    for (const loop of ['right', 'left', 'spiral'] as const) {
      const g = buildGeometry(railInput(loop, { w: 390, h: 844 }))
      expect(g.totalLength, loop).toBeGreaterThan(straight.totalLength + 2 * 60)
    }
  })

  it('lasso nur ab 1200 px, darunter Tropfenschlaufe; legal/margin ignorieren Schlaufen', () => {
    const at = (w: number) => {
      const input = journeyInput({ w, h: 900 })
      const g = buildGeometry(input)
      const st = g.stations.find((s) => s.id === 'keramik')!
      return st.loopLen1 - st.loopLen0
    }
    expect(at(1440)).toBeGreaterThan(at(1024) + 60)
    const legal: BuildInput = { ...railInput('right', { w: 390, h: 844 }), preset: 'legal' }
    const g = buildGeometry(legal)
    const plain = buildGeometry({ ...railInput('none', { w: 390, h: 844 }), preset: 'legal' })
    expect(g.totalLength).toBeCloseTo(plain.totalLength, 6)
  })

  it('orbit umrundet die Planet-Marke einmal (Ellipse rx 0.9 w, ry 0.35 w)', () => {
    const input = journeyInput()
    const { geometry, samples } = buildGeometryWithSamples(input)
    const planet = input.anchors.find((a) => a.id === 'planet-claire')!
    const st = geometry.stations.find((s) => s.id === 'planet-claire')!
    const cx = planet.x + planet.w / 2
    const cy = planet.y + planet.h / 2
    let angle = 0
    let prev: number | null = null
    let maxDx = 0
    for (let i = 0; i < samples.s.length; i++) {
      if (samples.s[i]! < st.loopLen0 || samples.s[i]! > st.loopLen1) continue
      const a = Math.atan2(samples.y[i]! - cy, samples.x[i]! - cx)
      if (prev !== null) {
        let d = a - prev
        while (d > Math.PI) d -= 2 * Math.PI
        while (d < -Math.PI) d += 2 * Math.PI
        angle += d
      }
      prev = a
      maxDx = Math.max(maxDx, Math.abs(samples.x[i]! - cx))
    }
    expect(Math.abs(angle)).toBeGreaterThan(1.9 * Math.PI)
    expect(maxDx).toBeGreaterThan(0.9 * 0.9 * planet.w)
    expect(maxDx).toBeLessThan(1.25 * 0.9 * planet.w)
  })

  it('contour läuft mit Abstand um die Karte (1 Umlauf + Überlappung)', () => {
    const card = { x: 40, y: 200, w: 260, h: 180, loop: 'contour' as const }
    const { geometry, samples } = buildGeometryWithSamples(single('frame', card))
    const st = geometry.stations[0]!
    for (let i = 0; i < samples.s.length; i++) {
      if (samples.s[i]! < st.loopLen0 || samples.s[i]! > st.loopLen1) continue
      const inside =
        samples.x[i]! > card.x + 4 &&
        samples.x[i]! < card.x + card.w - 4 &&
        samples.y[i]! > card.y + 4 &&
        samples.y[i]! < card.y + card.h - 4
      expect(inside).toBe(false)
    }
    expect(st.loopLen1 - st.loopLen0).toBeGreaterThan(2 * (card.w + card.h))
  })

  it('heart, coil und hook beenden die Linie; Herz 36 px mobil / 48 px ab 768', () => {
    for (const [preset, loop] of [
      ['thanks', 'heart'],
      ['lost', 'coil'],
      ['product', 'hook'],
    ] as const) {
      const g = buildGeometry(single(preset, { x: 150, y: 500, w: 60, h: 44, loop }))
      const st = g.stations[0]!
      expect(g.totalLength - st.loopLen1, preset).toBeLessThan(1)
    }
    const width = (w: number) => {
      const { geometry, samples } = buildGeometryWithSamples(
        single('thanks', { x: 150, y: 500, w: 60, h: 60, loop: 'heart' }, { w, h: 900 }),
      )
      const st = geometry.stations[0]!
      let min = Infinity
      let max = -Infinity
      for (let i = 0; i < samples.s.length; i++) {
        if (samples.s[i]! < st.loopLen0) continue
        min = Math.min(min, samples.x[i]!)
        max = Math.max(max, samples.x[i]!)
      }
      return max - min
    }
    expect(width(390)).toBeGreaterThan(34)
    expect(width(390)).toBeLessThan(44)
    expect(width(1440)).toBeGreaterThan(46)
    expect(width(1440)).toBeLessThan(58)
  })
})
