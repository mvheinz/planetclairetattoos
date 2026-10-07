import { describe, expect, it } from 'vitest'

import { EXERCISES } from '../../../scripts/art/fitness-coco'
import { GROUND, NEUTRAL, VIEW, build } from '../../../src/lib/fitness/rig'
import { loopMs, poseAt, REST_POSE, type FitnessData } from '../../../src/lib/fitness/timeline'

// P12.5: Puppen-Gerüst – Cocos Merkmale in jeder Pose (rechtes Ohr geknickt, Halsband, Buntstift, weiße Teile), Bild passt in
// die Box, nichts unter dem Boden, ruhige Bewegung (keine Sprünge), nahtloser Schleifenpunkt.

const d: FitnessData = { v: 2, ex: EXERCISES }
const T = loopMs(d)
const at = (id: string, u: number) => {
  let s = 0
  for (const e of d.ex) {
    if (e.id === id) return poseAt(d, s + e.ms * u)
    s += e.ms
  }
  throw new Error(id)
}
const coords = (ds: { d: string }[]) =>
  ds.flatMap((x) => {
    const n = (x.d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number)
    return Array.from(
      { length: Math.floor(n.length / 2) },
      (_, i) => [n[i * 2]!, n[i * 2 + 1]!] as const,
    )
  })

describe('Fitness-Coco Gerüst: Zeichnung', () => {
  it('rechtes Ohr (Bild links) ist in jeder Pose geknickt (U-07), auch liegend und in der Seitenansicht', () => {
    for (let t = 0; t < T; t += 650)
      expect(
        build(poseAt(d, t)).some((x) => x.k === 'knick'),
        `t=${t}`,
      ).toBe(true)
  })

  it('Buntstift nur als Schraffur im Fell, Papier für weiße Teile, Halsband rot wie Cocos Sprite', () => {
    const f = build(REST_POSE)
    expect(f.filter((x) => x.t === 'h').length).toBeGreaterThan(6)
    expect(f.some((x) => x.t === 'f' && x.c === 'paper')).toBe(true)
    expect(f.some((x) => x.t === 'f' && x.c === 'ink')).toBe(true) // Nase, Pupillen
    expect(f.some((x) => x.k === 'collar')).toBe(true)
  })

  it('deterministisch und klein: ≤ 30 KB Pfadtext je Bild, ≤ 90 Striche', () => {
    for (let t = 0; t < T; t += 1300) {
      const a = build(poseAt(d, t))
      expect(a).toEqual(build(poseAt(d, t)))
      expect(a.reduce((s, x) => s + x.d.length, 0)).toBeLessThan(30_000)
      expect(a.length).toBeLessThan(90)
    }
  })

  it('jede Pose passt in die Box 200 × 250 (mit Rand) und reicht nirgends tief unter die Bodenlinie', () => {
    let minX = 1e9,
      maxX = -1e9,
      minY = 1e9,
      maxY = -1e9
    for (let t = 0; t < T; t += 150) {
      for (const [x, y] of coords(build(poseAt(d, t)))) {
        minX = Math.min(minX, VIEW.ox + (x - VIEW.ox) * VIEW.s)
        maxX = Math.max(maxX, VIEW.ox + (x - VIEW.ox) * VIEW.s)
        minY = Math.min(minY, VIEW.oy + (y - VIEW.oy) * VIEW.s)
        maxY = Math.max(maxY, y)
      }
    }
    expect(minX).toBeGreaterThan(4)
    expect(maxX).toBeLessThan(196)
    expect(minY).toBeGreaterThan(4)
    expect(maxY).toBeLessThanOrEqual(GROUND + 5)
  })
})

describe('Fitness-Coco Ablauf: Übungen', () => {
  it('Body wave: ein Arm kreist über dem Kopf, Schwanz schwingt', () => {
    const ps = Array.from({ length: 16 }, (_, i) => at('wave', 0.25 + i * 0.03))
    expect(Math.min(...ps.map((p) => p.ra1))).toBeGreaterThan(120)
    expect(Math.max(...ps.map((p) => p.rb)) - Math.min(...ps.map((p) => p.rb))).toBeGreaterThan(40)
    expect(ps[0]!.tm).toBeGreaterThan(20)
  })

  it('Body bounce: ganzer Körper federt (Becken hebt ab, Stauchen/Strecken), Schwanz hängt', () => {
    const ps = Array.from({ length: 60 }, (_, i) => at('bounce', 0.15 + i * 0.01))
    const ys = ps.map((p) => p.y)
    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(18)
    expect(Math.max(...ps.map((p) => p.sq)) - Math.min(...ps.map((p) => p.sq))).toBeGreaterThan(
      0.08,
    )
    expect(ps[10]!.ta).toBeLessThan(40)
  })

  it('Single arm raises: ein Arm gestreckt oben, anderer unten, Kopf schaut zum Arm, Blick unbeeindruckt (halbe Lider)', () => {
    let seenR = false,
      seenL = false
    for (let u = 0.1; u < 0.95; u += 0.01) {
      const p = at('arm', u)
      if (p.ra1 > 130) {
        seenR = true
        expect(p.la1).toBeLessThan(40)
        expect(p.hy).toBeGreaterThan(10)
      }
      if (p.la1 > 130) {
        seenL = true
        expect(p.ra1).toBeLessThan(40)
        expect(p.hy).toBeLessThan(-10)
      }
    }
    expect(seenR && seenL).toBe(true)
    expect(at('arm', 0.5).lid).toBeGreaterThan(0.3)
  })

  it('Hüftdrehung: Hüfte dreht, Oberkörper gegenläufig, Hüpfer, Schwanz peitscht', () => {
    const ps = Array.from({ length: 40 }, (_, i) => at('hip', 0.2 + i * 0.012))
    expect(Math.max(...ps.map((p) => Math.abs(p.hip)))).toBeGreaterThan(25)
    for (const p of ps) expect(Math.sign(p.tw) * Math.sign(p.hip) <= 0).toBe(true)
    expect(ps[0]!.tm).toBeGreaterThan(40)
  })

  it('Brustöffner: Arme weit offen und vor der Brust zusammen, Augen halb geschlossen', () => {
    const ps = Array.from({ length: 80 }, (_, i) => at('chest', 0.15 + i * 0.01))
    expect(Math.max(...ps.map((p) => p.la1))).toBeGreaterThan(90)
    expect(Math.min(...ps.map((p) => p.lbe))).toBeLessThan(10)
    expect(Math.max(...ps.map((p) => p.lbe))).toBeGreaterThan(80)
    expect(ps[10]!.lid).toBeGreaterThan(0.45)
  })

  it('Rumpfdrehung: gestreckte Arme seitlich, Oberkörper dreht kräftig, Füße bleiben', () => {
    const ps = Array.from({ length: 80 }, (_, i) => at('twist', 0.15 + i * 0.01))
    expect(Math.max(...ps.map((p) => Math.abs(p.tw)))).toBeGreaterThan(55)
    expect(Math.min(...ps.map((p) => p.la1))).toBeGreaterThan(80)
    expect(Math.min(...ps.map((p) => p.ra1))).toBeGreaterThan(80)
    for (const p of ps) {
      expect(p.lfx).toBeCloseTo(NEUTRAL.lfx, 0)
      expect(p.rfx).toBeCloseTo(NEUTRAL.rfx, 0)
    }
  })

  it('Thump up: Seitenansicht, beide Arme über den Kopf und mit Aufprall nach unten, Schwanz nach hinten', () => {
    const ps = Array.from({ length: 100 }, (_, i) => at('thump', 0.2 + i * 0.006))
    expect(ps[0]!.yaw).toBeGreaterThan(80)
    expect(Math.max(...ps.map((p) => Math.min(p.la1, p.ra1)))).toBeGreaterThan(150)
    expect(Math.min(...ps.map((p) => p.ra1))).toBeLessThan(5)
    expect(Math.max(...ps.map((p) => p.y))).toBeGreaterThan(10)
    expect(ps[0]!.tb).toBeGreaterThan(70)
  })

  it('Erschöpft: flach am Boden, Zunge heraus, Augen zu, Schwanz hängt', () => {
    const p = at('lying', 0.5)
    expect(p.roll).toBeGreaterThan(85)
    expect(p.tg).toBeGreaterThan(0.7)
    expect(p.lid).toBeGreaterThan(0.95)
    expect(p.tm).toBeLessThan(2)
    expect(build(p).some((x) => x.k === 'tongue')).toBe(true)
  })
})

describe('Fitness-Coco Ablauf: Weichheit', () => {
  it('nahtloser Schleifenpunkt', () => {
    expect(poseAt(d, 0)).toEqual(poseAt(d, T))
    expect(poseAt(d, 123)).toEqual(poseAt(d, 123 + 3 * T))
    expect(poseAt(d, -500)).toEqual(poseAt(d, T - 500))
  })

  it('keine Sprünge zwischen zwei Bildern im 30-Bilder/s-Takt (Lage, Drehung, Kopf)', () => {
    let prev = poseAt(d, 0)
    for (let t = 33; t <= T + 33; t += 33) {
      const p = poseAt(d, t)
      expect(Math.abs(p.x - prev.x), `x ${t}`).toBeLessThan(5)
      expect(Math.abs(p.y - prev.y), `y ${t}`).toBeLessThan(9)
      expect(Math.abs(p.yaw - prev.yaw), `yaw ${t}`).toBeLessThan(8)
      expect(Math.abs(p.roll - prev.roll), `roll ${t}`).toBeLessThan(6)
      expect(Math.abs(p.tw - prev.tw), `tw ${t}`).toBeLessThan(8)
      expect(Math.abs(p.hip - prev.hip), `hip ${t}`).toBeLessThan(8)
      expect(Math.abs(p.hy - prev.hy), `hy ${t}`).toBeLessThan(8)
      prev = p
    }
  })

  it('Einblenden aus der Ruhepose: Stärke 0 = Standbild-Pose', () => {
    const p = poseAt(d, 9000, 0)
    for (const k of Object.keys(REST_POSE) as (keyof typeof REST_POSE)[])
      expect(p[k]).toBeCloseTo(REST_POSE[k], 6)
  })
})
