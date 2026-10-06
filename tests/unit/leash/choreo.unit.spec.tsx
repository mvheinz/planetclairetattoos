// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  BRIDGE_MS,
  DWELL,
  FACING_PX,
  JUMP_MS,
  bridgesFor,
  createCocoElement,
  mountCoco,
  type CocoController,
  type CocoFollow,
  type PoseEvent,
} from '@/leash/coco'
import type { SpritePose } from '@/leash/types'

import { installTracker, type Tracker } from '../behaviors/harness'

// P9.15 Choreografie der Startseite (DESIGN §11.4): Posen-Tabelle Ankunft → Verweilen mit Brücken (§10.3), Verweil-Timer
// 1,2 s / 1,5 s, Sprung-Sequenz Schmuck (415 ms), Blickrichtung erst nach 24 px, Scrollstopp > 1,2 s → sitzen, Coco-Box
// bleibt in der Rinne (LG-01).

let tracker: Tracker
let el: HTMLElement
let events: PoseEvent[]
let coco: CocoController

const advance = (ms: number) => vi.advanceTimersByTime(ms)

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] })
  tracker = installTracker()
  el = createCocoElement(document, 'leash', 'sitzen')
  el.getBoundingClientRect = () => ({ width: 42, height: 31.5 }) as DOMRect
  document.body.appendChild(el)
  events = []
  coco = mountCoco(el, { pose: 'sitzen', motion: 'full', onPose: (e) => events.push(e) })
})

afterEach(() => {
  coco.destroy()
  tracker.restore()
  vi.useRealTimers()
  document.body.innerHTML = ''
})

type Station = NonNullable<CocoFollow['station']>
const st = (id: string, pose: SpritePose, inside = true): Station => ({
  id,
  pose,
  len0: 1000,
  len1: 1200,
  inside,
})
const state = (over: Partial<CocoFollow>): CocoFollow => ({
  len: 1100,
  x: 22,
  y: 300,
  angle: Math.PI / 2,
  direction: 1,
  pose: 'sitzen',
  moving: false,
  motion: 'full',
  station: null,
  intro: false,
  gutter: null,
  ...over,
})
const poses = () => events.map((e) => `${e.from}>${e.to}${e.bridge ? `(${e.bridge})` : ''}`)

/** Läuft zur Station und bleibt stehen. */
function arrive(station: Station, len = 1100) {
  coco.follow(state({ moving: true, station, len }))
  advance(200)
  coco.follow(state({ moving: false, station, len }))
}

describe('Brücken (DESIGN §10.3, §11.4)', () => {
  it('nach dem Sprung: springen → bremsen → sitzen, sonst Tabelle', () => {
    expect(bridgesFor('springen', 'sitzen')).toEqual(['bremsen'])
    expect(bridgesFor('sitzen', 'springen')).toEqual(['abspringen'])
    expect(bridgesFor('rennen', 'schnueffeln')).toEqual(['bremsen'])
    expect(bridgesFor('sitzen', 'kopfschief')).toBeNull()
  })
})

describe('Posen je Station (Tabelle §11.4)', () => {
  it('AK-DS-13 Ankunft: rennen → bremsen → Station-Pose (hallo: sitzen, keramik: schnueffeln, tattoo: kopfschief)', () => {
    for (const [id, pose] of [
      ['hallo', 'sitzen'],
      ['keramik', 'schnueffeln'],
      ['tattoo', 'kopfschief'],
    ] as const) {
      events.length = 0
      coco.follow(state({ moving: true, station: st(id, pose) }))
      advance(300)
      coco.follow(state({ moving: false, station: st(id, pose) }))
      advance(400)
      expect(coco.pose(), id).toBe(pose)
      expect(poses().at(-1), id).toBe(`rennen>${pose}(bremsen)`)
    }
  })

  it('Kopf-Station: nach 1,2 s Verweilen einmal kopfschief (3 s), dann wieder sitzen', () => {
    arrive(st('planet-claire', 'sitzen'))
    advance(500)
    expect(coco.pose()).toBe('sitzen')
    advance(DWELL['planet-claire']!.after - 500 + 200)
    expect(coco.pose()).toBe('kopfschief')
    advance(3000 + 200)
    expect(coco.pose()).toBe('sitzen')
    advance(5000)
    expect(coco.pose()).toBe('sitzen')
  })

  it('Textil: schnueffeln, nach 1,5 s Verweilen kopfschief', () => {
    arrive(st('textil', 'schnueffeln'))
    advance(1300)
    expect(coco.pose()).toBe('schnueffeln')
    advance(500)
    expect(coco.pose()).toBe('kopfschief')
  })

  it('Sprung der Linie zu einer anderen Station ohne Lauf-Frame: Ankunft gilt neu', () => {
    arrive(st('hallo', 'sitzen'))
    advance(500)
    coco.follow(state({ moving: false, station: st('keramik', 'schnueffeln') }))
    advance(300)
    expect(coco.pose()).toBe('schnueffeln')
  })

  it('Der Verweil-Timer der alten Station feuert nach dem Sprung zur nächsten nicht mehr', () => {
    arrive(st('planet-claire', 'sitzen'))
    advance(1500) // kopfschief läuft (3 s)
    coco.follow(state({ moving: false, station: st('hallo', 'sitzen') }))
    advance(300)
    coco.follow(state({ moving: false, station: st('keramik', 'schnueffeln') }))
    advance(4000)
    expect(coco.pose()).toBe('schnueffeln')
  })

  it('Station direkt nach dem Sprung (Schmuck → Tattoo): Ankunft nicht durch die Sprung-Sperre verschluckt', () => {
    const schmuck = st('schmuck', 'springen')
    arrive(schmuck, 1100)
    coco.follow(state({ moving: true, station: schmuck, len: 1202 }))
    advance(100)
    coco.follow(state({ moving: false, station: st('tattoo', 'kopfschief'), len: 5000 }))
    advance(500)
    expect(coco.pose()).toBe('kopfschief')
  })

  it('Scrollen unterbricht das Verweilen', () => {
    arrive(st('planet-claire', 'sitzen'))
    advance(1000)
    coco.follow(state({ moving: true, station: st('planet-claire', 'sitzen') }))
    advance(2000)
    expect(coco.pose()).toBe('rennen')
  })

  it('Scrollstopp > 1,2 s zwischen Stationen: sitzen', () => {
    coco.follow(state({ moving: true }))
    advance(200)
    expect(coco.pose()).toBe('rennen')
    coco.follow(state({ moving: false }))
    advance(1000)
    expect(coco.pose()).toBe('rennen')
    advance(500)
    expect(coco.pose()).toBe('sitzen')
  })
})

describe('Sprung-Sequenz Schmuck', () => {
  it('abspringen → springen → bremsen → sitzen in ≈ 415 ms, einmal ab loopLen1', () => {
    const schmuck = st('schmuck', 'springen')
    arrive(schmuck, 1100)
    advance(600)
    expect(coco.pose()).toBe('sitzen')
    events.length = 0
    coco.follow(state({ moving: true, station: schmuck, len: 1202 }))
    const t0 = performance.now()
    advance(JUMP_MS + 3 * BRIDGE_MS + 40)
    const seq = poses()
    expect(seq[0]).toBe('sitzen>springen(abspringen)')
    expect(seq.at(-1)).toMatch(/springen>sitzen\(bremsen\)$/)
    expect(performance.now() - t0).toBeLessThan(700)
    // zweiter Durchlauf: kein Sprung mehr
    events.length = 0
    coco.follow(state({ moving: false, station: schmuck, len: 1210 }))
    advance(1000)
    coco.follow(state({ moving: true, station: schmuck, len: 1300, direction: -1 }))
    coco.follow(state({ moving: true, station: schmuck, len: 1210 }))
    advance(800)
    expect(poses().some((x) => x.includes('>springen'))).toBe(false)
  })
})

describe('Blickrichtung und Rinne', () => {
  const facing = () => /scaleX\((-?1)\)/.exec(el.style.transform)?.[1]

  it('Umschalten erst nach 24 px Bogenlänge in neuer Richtung; beim Hochscrollen gespiegelt', () => {
    coco.follow(state({ moving: true, len: 100, angle: 0 }))
    expect(facing()).toBe('1')
    // Linie dreht nach links: 20 px zählen noch nicht …
    coco.follow(state({ moving: true, len: 110, angle: Math.PI }))
    coco.follow(state({ moving: true, len: 120, angle: Math.PI }))
    expect(facing()).toBe('1')
    // … ab 24 px
    coco.follow(state({ moving: true, len: 100 + FACING_PX + 1, angle: Math.PI }))
    expect(facing()).toBe('-1')
    // Hochscrollen (Richtung −1): gespiegelt gegenüber dem Vorwärtslauf
    coco.follow(state({ moving: true, len: 130, angle: 0, direction: -1 }))
    coco.follow(state({ moving: true, len: 90, angle: 0, direction: -1 }))
    expect(facing()).toBe('-1')
    coco.follow(state({ moving: true, len: 60, angle: 0, direction: -1 }))
    coco.follow(state({ moving: true, len: 30, angle: 0, direction: -1 }))
    expect(facing()).toBe('-1')
  })

  it('LG-01 die Box ragt nicht aus der Rinne in den Text (Spitze in der Rinne)', () => {
    // D-Ring von `sitzen` (Seitenansicht, P12.4) liegt bei 50 % der Breite; der Hund reicht bis 0,9 der Box → Rinne 0…44
    coco.follow(state({ moving: false, x: 38, y: 100, gutter: [0, 44, 40] }))
    const m = /translate\(([-\d.]+)px,/.exec(el.style.transform)
    const shift = 38 - Number(m![1])
    expect(shift).toBeGreaterThan(10) // Box ragt über die Rinne → auf ≤ 43 zurück
    // weit außerhalb der Rinne (Lasso, Schlaufen): keine Verschiebung
    coco.follow(state({ moving: false, x: 200, y: 100, gutter: [0, 44, 40] }))
    expect(Number(/translate\(([-\d.]+)px,/.exec(el.style.transform)![1])).toBeCloseTo(200, 0)
  })

  it('MI-10 Intro: Coco rennt von links herein (600 ms), danach an der Leinenspitze', () => {
    coco.follow(state({ moving: true, intro: true, x: 60, y: 200 }))
    const x0 = Number(/translate\(([-\d.]+)px,/.exec(el.style.transform)![1])
    expect(x0).toBeLessThan(0)
    advance(700)
    coco.follow(state({ moving: true, intro: true, x: 60, y: 200 }))
    expect(Number(/translate\(([-\d.]+)px,/.exec(el.style.transform)![1])).toBeCloseTo(60, 0)
  })

  it('MI-17 reduzierte Bewegung: keine Timer, Ruhe-Pose', () => {
    coco.setMotion('reduced', 'sitzen')
    coco.follow(
      state({ motion: 'reduced', pose: 'sitzen', station: st('planet-claire', 'sitzen') }),
    )
    advance(10_000)
    expect(coco.pose()).toBe('sitzen')
    expect(events.filter((e) => e.to === 'kopfschief')).toHaveLength(0)
  })
})
