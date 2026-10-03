import { describe, expect, it } from 'vitest'

import { buildGeometry } from '@/leash/geometry'
import { PRESET_CONFIG, REST_POSE } from '@/leash/presets'
import { PRESET_DOCS } from '@/leash/presetDocs'
import { getRoute } from '@/lib/routes/paths'

import { aboutInput } from './fixtures'

// P8.18 Preset `about` (DESIGN §9.7): wie `journey` scrollgekoppelt in der mittigen Rinne 44/64, ohne Intro, Schlaufen nur
// right/left, Coco-Posen sitzen/kopfschief/schnueffeln, Ruhe-Pose `sitzen`; Route R19 ist live mit diesem Preset.
describe('Preset about (R19, P8.18)', () => {
  it('Konfiguration laut DESIGN §9.7', () => {
    const c = PRESET_CONFIG.about
    expect(c.gutter).toEqual({ mobile: 44, desktop: 64 })
    expect(c.rail).toBe('center')
    expect(c.draw).toBe('scroll')
    expect(c.intro).toBe(false)
    expect([...c.loops].sort()).toEqual(['left', 'right'])
    expect([...(c.coco?.poses ?? [])].sort()).toEqual(['kopfschief', 'schnueffeln', 'sitzen'])
    expect(REST_POSE.about).toBe('sitzen')
    expect(PRESET_DOCS.about.routes).toEqual(['R19'])
    const route = getRoute('R19')
    expect(route.preset).toBe('about')
    expect(route.status).toBe('live')
  })

  for (const viewport of [
    { w: 390, h: 844 },
    { w: 1440, h: 900 },
  ]) {
    it(`Geometrie ${viewport.w} px: drei Stationen in Reihenfolge mit Schlaufe, deterministisch`, () => {
      const g = buildGeometry(aboutInput(viewport))
      expect(g.stations.map((s) => s.id)).toEqual(['jutta', 'coco', 'werkstatt'])
      expect(g.stations.map((s) => s.pose)).toEqual(['sitzen', 'kopfschief', 'schnueffeln'])
      const starts = g.stations.map((s) => s.loopLen0)
      expect(starts).toEqual([...starts].sort((a, b) => a - b))
      for (const s of g.stations) expect(s.loopLen1).toBeGreaterThan(s.loopLen0)
      expect(g.totalLength).toBeGreaterThan(0)
      // deterministisch (gleicher Seed → gleicher Pfad)
      const again = buildGeometry(aboutInput(viewport))
      expect(again.segments.map((x) => x.outlineD)).toEqual(g.segments.map((x) => x.outlineD))
    })
  }
})
