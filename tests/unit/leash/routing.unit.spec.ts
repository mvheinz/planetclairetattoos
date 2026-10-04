import { describe, expect, it } from 'vitest'

import { buildGeometry } from '@/leash/geometry'
import type { BuildInput, LeashAnchor, LoopKind, PresetId } from '@/leash/types'

// P9.17 Randbahn: ohne Rinne läuft die Linie von `stencil`, `product` und (mobil) `thanks` nicht quer über Text,
// sondern seitlich neben dem Inhalt (KUNST-QA LG-01).

const A = (
  id: string,
  kind: LeashAnchor['kind'],
  x: number,
  y: number,
  w = 0,
  h = 0,
  loop: LoopKind = 'none',
): LeashAnchor => ({ id, kind, x, y, w, h, loop })

function points(input: BuildInput): { x: number; y: number }[] {
  const { lut } = buildGeometry(input)
  const out: { x: number; y: number }[] = []
  for (let i = 0; i < lut.length; i += 4) out.push({ x: lut[i + 1]!, y: lut[i + 2]! })
  return out
}

const inRect = (
  p: { x: number; y: number },
  r: { x: number; y: number; w: number; h: number },
  pad = 2,
) => p.x > r.x - pad && p.x < r.x + r.w + pad && p.y > r.y - pad && p.y < r.y + r.h + pad

function stencil(viewportW: number, left: number, cardW: number, columns = 2): BuildInput {
  const cards =
    columns === 2
      ? [
          A('c0', 'station', left, 215, cardW, 470, 'contour'),
          A('c1', 'station', left + cardW + 20, 215, cardW, 470, 'contour'),
          A('c2', 'station', left, 900, cardW, 470, 'contour'),
        ]
      : [
          A('c0', 'station', left, 215, cardW, 470, 'contour'),
          A('c1', 'station', left, 720, cardW, 470, 'contour'),
          A('c2', 'station', left, 1225, cardW, 470, 'contour'),
        ]
  return {
    preset: 'stencil',
    seed: 12345,
    root: { w: viewportW, h: 2000 },
    viewport: { w: viewportW, h: 900 },
    gutter: 0,
    baseWidth: 2.6,
    anchors: [
      A('start', 'start', 24, 0),
      A('h1', 'station', left, 131),
      ...cards,
      A('end', 'end', left, columns === 2 ? 1400 : 1750),
    ],
  }
}

describe('Randbahn ohne Rinne (P9.17, LG-01)', () => {
  it('stencil Desktop: nie durch die Überschrift, nie links von x = 0, Rückweg zwischen den Reihen am Kartenrand', () => {
    const heading = { x: 120, y: 131, w: 366, h: 54 }
    const pts = points(stencil(1440, 120, 385))
    expect(Math.min(...pts.map((p) => p.x))).toBeGreaterThanOrEqual(0)
    expect(pts.filter((p) => inRect(p, heading, 0))).toEqual([])
    // die zweite Reihe wird über die Randbahn (x ≈ Kartenrand − 10) erreicht, nicht diagonal über Reihe 1
    const row1Text = { x: 120, y: 700, w: 800, h: 180 }
    expect(pts.filter((p) => inRect(p, row1Text, 0))).toEqual([])
  })

  it('stencil mobil: Randbahn bleibt im Seitenrand (x ≥ 0), Station ohne Schlaufe läuft nicht an der Textkante', () => {
    const pts = points(stencil(390, 16, 358, 1))
    expect(Math.min(...pts.map((p) => p.x))).toBeGreaterThanOrEqual(0)
    const h1 = { x: 16, y: 131, w: 150, h: 54 }
    expect(pts.filter((p) => inRect(p, h1, 0))).toEqual([])
  })

  it('thanks: mobil im Seitenrand hinunter, am Desktop erst quer unter der Kopfleiste', () => {
    const base = (w: number, endX: number, endY: number): BuildInput => ({
      preset: 'thanks' as PresetId,
      seed: 7,
      root: { w, h: 1200 },
      viewport: { w, h: 900 },
      gutter: 0,
      baseWidth: 2.6,
      anchors: [A('start', 'start', 24, 0), A('end', 'end', endX, endY, 0, 0, 'heart')],
    })
    // Text steht auf der ganzen Breite: die Linie darf nur im Rand (x < 16) hinunterlaufen
    const mobile = points(base(390, 250, 600))
    const text = { x: 16, y: 150, w: 358, h: 300 }
    expect(mobile.filter((p) => inRect(p, text, 0))).toEqual([])
    // Desktop: Text links (x 120–470, y 250–420), Ziel rechts davon – quer oberhalb des Textes
    const desktop = points(base(1440, 1300, 390))
    expect(desktop.filter((p) => inRect(p, { x: 120, y: 250, w: 350, h: 170 }, 0))).toEqual([])
    expect(Math.max(...desktop.map((p) => p.x))).toBeGreaterThan(1250)
  })

  it('product: Start im Seitenrand, Weg zum Haken neben dem Inhalt, keine Linie durch die Titelzeilen', () => {
    const input: BuildInput = {
      preset: 'product',
      seed: 3,
      root: { w: 390, h: 1400 },
      viewport: { w: 390, h: 844 },
      gutter: 0,
      baseWidth: 2.2,
      anchors: [
        A('start', 'start', 6, 780),
        A('title', 'station', 352, 790),
        A('buy', 'target', 16, 1100, 358, 52, 'hook'),
      ],
    }
    const pts = points(input)
    const body = { x: 16, y: 840, w: 358, h: 230 }
    expect(pts.filter((p) => inRect(p, body, 0))).toEqual([])
  })
})
