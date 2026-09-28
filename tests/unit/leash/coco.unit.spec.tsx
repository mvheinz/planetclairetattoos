// @vitest-environment jsdom
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { Coco } from '@/components/Coco'
import {
  BOIL,
  BRIDGE_MS,
  bridgesFor,
  createCocoElement,
  mountCoco,
  type CocoController,
  type PoseEvent,
} from '@/leash/coco'
import { COCO_ANCHORS, COCO_SPRITE_HREF } from '@/leash/cocoSprite'
import sprite from '../../../src/art/coco/coco-sprite.json'

import { installTracker, type Tracker } from '../behaviors/harness'

// P2.18 Coco-Steuerung (DESIGN §10.3, §10.4, §9.11): Posenwechsel nur an Frame-Grenzen, Brücken, Boil-Budget.

let tracker: Tracker
let el: HTMLElement
let events: PoseEvent[]

const hrefs = () =>
  [...el.querySelectorAll('use')].map((u) => u.getAttribute('href')!.split('#')[1])
const advance = (ms: number) => vi.advanceTimersByTime(ms)

function mount(
  pose: 'sitzen' | 'rennen' = 'sitzen',
  motion: 'full' | 'reduced' = 'full',
): CocoController {
  el = createCocoElement(document, 'm', pose)
  document.body.appendChild(el)
  events = []
  return mountCoco(el, { pose, motion, onPose: (e) => events.push(e) })
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] })
  tracker = installTracker()
})

afterEach(() => {
  tracker.restore()
  vi.useRealTimers()
  document.body.innerHTML = ''
})

describe('Coco – Markup (§10.4)', () => {
  it('createCocoElement entspricht dem SSR-Markup von <Coco> (aria-hidden, drei Frames, Sprite-Datei)', () => {
    const ssr = document.createElement('div')
    ssr.innerHTML = renderToStaticMarkup(<Coco pose="kopfschief" size="m" />)
    const a = ssr.firstElementChild as HTMLElement
    const b = createCocoElement(document, 'm', 'kopfschief')
    for (const name of ['class', 'data-size', 'data-pose', 'data-boil', 'aria-hidden'])
      expect(b.getAttribute(name), name).toBe(a.getAttribute(name))
    const uses = (x: Element) =>
      [...x.querySelectorAll('use')].map((u) => [u.getAttribute('class'), u.getAttribute('href')])
    expect(uses(b)).toEqual(uses(a))
    expect(uses(a)).toEqual([
      ['f f-a', `${COCO_SPRITE_HREF}#coco-kopfschief-a`],
      ['f f-b', `${COCO_SPRITE_HREF}#coco-kopfschief-b`],
      ['f f-c', `${COCO_SPRITE_HREF}#coco-kopfschief-c`],
    ])
    expect(a.getAttribute('aria-hidden')).toBe('true')
    expect(a.querySelector('svg')!.getAttribute('focusable')).toBe('false')
    expect(a.getAttribute('data-boil')).toBe('off')
  })

  it('Sprite-Datei und Anker kommen aus dem erzeugten Manifest', () => {
    expect(COCO_SPRITE_HREF).toBe(sprite.href)
    const sit = sprite.symbols.filter((s) => s.pose === 'sitzen')
    expect(COCO_ANCHORS.sitzen![0]).toBeCloseTo(sit.reduce((a, s) => a + s.anchor.x, 0) / 3, 0)
  })
})

describe('Coco – Posenwechsel nur an Frame-Grenzen (Fake-Timer)', () => {
  it('direkter Schnitt an der nächsten Grenze plus 1 Frame Stauchung scaleY(0.94)', () => {
    const c = mount('sitzen')
    advance(30)
    c.setPose('schnueffeln')
    expect(hrefs()).toEqual(['coco-sitzen-a', 'coco-sitzen-b', 'coco-sitzen-c'])
    advance(69)
    expect(c.pose()).toBe('sitzen')
    advance(1) // t = 100 ms: Frame-Grenze (10 fps)
    expect(c.pose()).toBe('schnueffeln')
    expect(hrefs()).toEqual(['coco-schnueffeln-a', 'coco-schnueffeln-b', 'coco-schnueffeln-c'])
    expect(el.getAttribute('data-pose')).toBe('schnueffeln')
    const hop = el.querySelector<HTMLElement>('.coco__hop')!
    expect(hop.style.transform).toBe('scaleY(0.94)')
    advance(100)
    expect(hop.style.transform).toBe('')
    expect(events).toEqual([
      expect.objectContaining({ from: 'sitzen', to: 'schnueffeln', bridge: null }),
    ])
    c.destroy()
  })

  it('rennen → sitzen über die Brücke „bremsen“ (1 Frame, 83 ms)', () => {
    const c = mount('rennen')
    advance(10)
    c.setPose('sitzen')
    advance(70) // Grenze bei 83,3 ms (12 fps)
    expect(hrefs()).toEqual(['coco-rennen-a', 'coco-rennen-b', 'coco-rennen-c'])
    advance(4)
    expect(hrefs()).toEqual(['coco-bridge-bremsen', 'coco-bridge-bremsen', 'coco-bridge-bremsen'])
    expect(el.getAttribute('data-pose')).toBe('bridge-bremsen')
    advance(BRIDGE_MS)
    expect(c.pose()).toBe('sitzen')
    expect(events.at(-1)).toMatchObject({ from: 'rennen', to: 'sitzen', bridge: 'bremsen' })
    c.destroy()
  })

  it('sitzen → schlafen über einrollen-1 und einrollen-2; Brückentabelle §10.3', () => {
    const c = mount('sitzen')
    c.setPose('schlafen')
    expect(hrefs()[0]).toBe('coco-bridge-einrollen-1')
    advance(BRIDGE_MS)
    expect(hrefs()[0]).toBe('coco-bridge-einrollen-2')
    advance(BRIDGE_MS)
    expect(c.pose()).toBe('schlafen')
    expect(events.at(-1)!.bridge).toBe('einrollen-1+einrollen-2')
    expect(bridgesFor('sitzen', 'rennen')).toEqual(['abspringen'])
    expect(bridgesFor('schlafen', 'springen')).toEqual(['abspringen'])
    expect(bridgesFor('rennen', 'kopfschief')).toEqual(['bremsen'])
    expect(bridgesFor('kopfschief', 'schnueffeln')).toBeNull()
    c.destroy()
  })

  it('zurück zur alten Pose vor der Grenze: kein Wechsel', () => {
    const c = mount('sitzen')
    advance(20)
    c.setPose('kopfschief')
    c.setPose('sitzen')
    advance(500)
    expect(events).toEqual([])
    c.destroy()
  })
})

describe('Coco – Boil-Budget (§10.3, WCAG 2.2.2)', () => {
  it('Seiteneintritt 2 s, Aktivität + 1,5 s Nachlauf, dann Frame A', () => {
    const c = mount('sitzen')
    expect(c.boiling()).toBe(true)
    advance(BOIL.afterPose)
    expect(c.boiling()).toBe(false)
    expect(el.getAttribute('data-boil')).toBe('off')
    c.activity()
    expect(c.boiling()).toBe(true)
    advance(1499)
    expect(c.boiling()).toBe(true)
    advance(1)
    expect(c.boiling()).toBe(false)
    c.destroy()
  })

  it('ohne Nutzeraktion höchstens 5 s Bewegung, auch bei Posenwechseln', () => {
    const c = mount('sitzen')
    const poses = ['kopfschief', 'sitzen'] as const
    for (let i = 0; i < 8; i++) {
      c.setPose(poses[i % 2]!)
      advance(1000)
    }
    expect(c.boiling()).toBe(false)
    // Scrollen ist Nutzeraktion: Boil läuft weiter, solange gescrollt wird
    for (let i = 0; i < 10; i++) {
      c.activity()
      advance(1000)
      expect(c.boiling()).toBe(true)
    }
    advance(1500)
    expect(c.boiling()).toBe(false)
    c.destroy()
  })
})

describe('Coco – reduzierte Bewegung und Aufräumen', () => {
  it('reduziert: kein Boil, Wechsel sofort ohne Brücke und ohne Stauchung; setMotion setzt die Ruhe-Pose', () => {
    const c = mount('sitzen', 'reduced')
    expect(c.boiling()).toBe(false)
    c.setPose('rennen')
    expect(c.pose()).toBe('rennen')
    expect(hrefs()[0]).toBe('coco-rennen-a')
    expect(el.querySelector<HTMLElement>('.coco__hop')!.style.transform).toBe('')
    c.setMotion('full')
    expect(c.boiling()).toBe(true)
    c.setMotion('reduced', 'sitzen')
    expect(c.boiling()).toBe(false)
    expect(c.pose()).toBe('sitzen')
    c.destroy()
  })

  it('place(): D-Ring der Pose auf den Punkt, gespiegelt beim Zurücklaufen', () => {
    const c = mount('sitzen')
    c.place(100, 200, -1)
    expect(el.style.transform).toMatch(/^translate\(100\.0px,200\.0px\) scaleX\(-1\) translate\(/)
    c.destroy()
  })

  it('AK-DS-18: destroy() räumt Timer und Observer; Boil aus', () => {
    const c = mount('rennen')
    c.setPose('sitzen')
    c.activity()
    c.destroy()
    expect(vi.getTimerCount()).toBe(0)
    expect(tracker.openObservers()).toEqual([])
    expect(el.getAttribute('data-boil')).toBe('off')
    expect(tracker.sensitive).toEqual([])
  })
})
