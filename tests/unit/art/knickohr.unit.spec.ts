import { describe, expect, it } from 'vitest'

import { figureFor, stehen, symbolSpecs } from '../../../scripts/art/draw-coco'

// U-07 Knickohr (P12.4): Cocos rechtes Ohr (aus ihrer Sicht) ist in allen Posen geknickt – außer beim kurzen Aufspitzen
// (Frame B der Aktion „Ohr zucken“). Geprüft an der Zeichengeometrie (Striche des Knickohrs sind markiert), im Sprite
// und im Charakterblatt (`stehen`).

const all = [...symbolSpecs('main'), ...symbolSpecs('extra')]

describe('U-07 Knickohr', () => {
  it('jedes Symbol zeigt ein geknicktes Ohr (Außenkante + Innenkante), das nicht das aufrechte ist', () => {
    for (const spec of all) {
      const fig = figureFor(spec.pose, spec.frame)
      const knicked = fig.strokes.filter((s) => s.knick && s.layer === 'line')
      const aufspitzen = spec.id === 'coco-zucken-b'
      if (aufspitzen) expect(knicked, spec.id).toHaveLength(0)
      else expect(knicked.length, spec.id).toBeGreaterThanOrEqual(2)
      // genau ein Ohr trägt den Knick (nicht beide)
      expect(new Set(knicked.map((s) => s.part)).size, spec.id).toBeLessThanOrEqual(1)
    }
  })

  it('Aufspitzen ist kurz: nur ein Frame von dreien der Aktion', () => {
    const up = all
      .filter((s) => s.pose === 'zucken')
      .filter((s) => !figureFor(s.pose, s.frame).strokes.some((st) => st.knick))
    expect(up.map((s) => s.frame)).toEqual(['b'])
  })

  it('Knick liegt im oberen Drittel: Spitze liegt unter dem höchsten Punkt des Ohrs (geknickt, nicht gerade)', () => {
    const fig = figureFor('sitzen', 'a')
    const ear = fig.strokes.filter((s) => s.knick && s.part === 'ear-r' && s.layer === 'line')
    const ys = ear.flatMap((s) => s.pts.map((p) => p[1]))
    const topY = Math.min(...ys)
    const outer = ear.find((s) => s.pts.length >= 6)!
    const tip = outer.pts[outer.pts.length - 1]!
    expect(tip[1]).toBeGreaterThan(topY + 3) // Spitze hängt herunter
  })

  it('Charakterblatt-Figur (stehend) hat das Knickohr', () => {
    expect(stehen().strokes.some((s) => s.knick)).toBe(true)
  })
})
