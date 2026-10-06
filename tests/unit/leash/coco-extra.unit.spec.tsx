// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { COCO_JOY_EVENT } from '@/behaviors/types'
import { createCocoElement, mountCoco, type CocoController } from '@/leash/coco'
import { COCO_ANCHORS } from '@/leash/cocoSprite'
import { IDLE_PLAN, JOY_MS, attachExtra } from '@/leash/cocoExtra'
import extra from '../../../src/art/coco/coco-extra-anchors.json'
import extraManifest from '../../../src/art/coco/coco-extra.json'

// P12.4 Zusatz-Aktionen (U-03/U-04): Warte-Aktionen gestaffelt beim Stillstand, Freudenhüpfer bei Erfolg, Abbruch bei
// Bewegung, Standbild bei reduzierter Bewegung. Zeit über Fake-Timer.

let el: HTMLElement
let coco: CocoController
const advance = (ms: number) => vi.advanceTimersByTime(ms)
const shown = () => el.getAttribute('data-pose')
const boiling = () => el.getAttribute('data-boil') === 'on'

function mount(href = '/art/coco-sprite.test.svg'): CocoController {
  el = createCocoElement(document, 'leash', 'sitzen', href)
  document.body.appendChild(el)
  // `href` gesetzt → die Steuerung lädt den Zusatz-Chunk nicht selbst; der Test hängt ihn an
  const c = mountCoco(el, { pose: 'sitzen', motion: 'full', href })
  attachExtra(c)
  return c
}

beforeEach(() => {
  Object.defineProperty(document, 'hidden', { configurable: true, value: false }) // jsdom meldet sonst „verborgen“
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] })
  coco = mount()
})
afterEach(() => {
  coco.destroy()
  vi.useRealTimers()
  document.body.innerHTML = ''
})

describe('Warte-Aktionen (U-03)', () => {
  it('Plan: gestaffelt aufsteigend, jede Aktion ≤ 5 s, zwischen den Aktionen Stillstand, am Ende Einrollen', () => {
    for (let i = 0; i < IDLE_PLAN.length; i++) {
      const s = IDLE_PLAN[i]!
      expect(s.ms).toBeLessThanOrEqual(5000)
      const prev = IDLE_PLAN[i - 1]
      if (prev) expect(s.at).toBeGreaterThanOrEqual(prev.at + prev.ms + 1000)
    }
    expect(IDLE_PLAN.map((s) => s.pose)).toEqual([
      'hecheln',
      'zucken',
      'kratzen',
      'gaehnen',
      'verbeugung',
      'wedeln',
      'liegen',
    ])
    expect(IDLE_PLAN.at(-1)!.then).toBe('schlafen')
  })

  it('Sitz-Ruhe löst die Aktionen nacheinander aus; dazwischen steht Coco im Standbild (Boil aus)', () => {
    expect(shown()).toBe('sitzen')
    advance(IDLE_PLAN[0]!.at + 10)
    expect(shown()).toBe('hecheln')
    expect(boiling()).toBe(true)
    advance(IDLE_PLAN[0]!.ms)
    expect(shown()).toBe('sitzen')
    expect(boiling()).toBe(false)
    advance(IDLE_PLAN[1]!.at - IDLE_PLAN[0]!.at - IDLE_PLAN[0]!.ms + 10)
    expect(shown()).toBe('zucken')
  })

  it('Zusatz-Posen haben je 3 Gruppen-Frames und einen Anker (D-Ring) wie die Haupt-Posen', () => {
    for (const pose of Object.keys(extra.anchors)) {
      expect(coco.x.g.get(pose)?.querySelectorAll('use'), pose).toHaveLength(3)
      expect(coco.x.a[pose], pose).toHaveLength(2)
    }
    // der Haupt-Anker-Satz bleibt unverändert (kein Zustand zwischen Einhängungen)
    expect(Object.keys(COCO_ANCHORS)).not.toContain('freude')
    expect(Object.keys(extra.anchors).sort()).toEqual(
      [
        'freude',
        'gaehnen',
        'hecheln',
        'kratzen',
        'liegen',
        'schuetteln',
        'verbeugung',
        'wedeln',
        'zucken',
      ].sort(),
    )
    const poses = new Set(extraManifest.symbols.map((s) => s.pose))
    for (const p of poses)
      expect(extraManifest.symbols.filter((s) => s.pose === p).map((s) => s.frame)).toEqual([
        'a',
        'b',
        'c',
      ])
  })

  it('bei sehr langer Ruhe: Hinlegen, danach Einrollen (Brücken) und Schlafen', () => {
    const last = IDLE_PLAN.at(-1)!
    advance(last.at + 10)
    expect(shown()).toBe('liegen')
    advance(last.ms + 10)
    expect(['bridge-einrollen-1', 'schlafen', 'bridge-einrollen-2']).toContain(shown())
    advance(1000)
    expect(coco.pose()).toBe('schlafen')
    expect(boiling()).toBe(false)
  })

  it('Bewegung bricht die laufende Aktion sofort ab und bewacht den Plan neu', () => {
    advance(IDLE_PLAN[0]!.at + 10)
    expect(shown()).toBe('hecheln')
    coco.setPose('rennen')
    expect(shown()).not.toBe('hecheln')
    advance(60_000)
    expect(['rennen', 'bridge-abspringen']).toContain(shown())
  })

  it('reduzierte Bewegung: Aktion endet sofort, danach keine Aktionen mehr (Standbild)', () => {
    advance(IDLE_PLAN[0]!.at + 10)
    expect(shown()).toBe('hecheln')
    coco.setMotion('reduced', 'sitzen')
    expect(shown()).toBe('sitzen')
    advance(120_000)
    expect(shown()).toBe('sitzen')
    expect(boiling()).toBe(false)
  })

  it('destroy räumt Timer und das Ereignis-Abo', () => {
    coco.destroy()
    expect(vi.getTimerCount()).toBe(0)
    document.dispatchEvent(new CustomEvent(COCO_JOY_EVENT))
    expect(shown()).not.toBe('freude')
    coco = mount()
  })
})

describe('Freudenhüpfer (U-04)', () => {
  it('Ereignis „Korb gefüllt“ / „Bestellung abgeschickt“ löst die Drehung aus und endet im Standbild', () => {
    expect(JOY_MS).toBeLessThanOrEqual(5000)
    document.dispatchEvent(new CustomEvent(COCO_JOY_EVENT, { detail: { reason: 'cart' } }))
    expect(shown()).toBe('freude')
    expect(boiling()).toBe(true)
    advance(JOY_MS + 10)
    expect(shown()).toBe('sitzen')
    expect(boiling()).toBe(false)
    document.dispatchEvent(new CustomEvent(COCO_JOY_EVENT, { detail: { reason: 'order' } }))
    expect(shown()).toBe('freude')
  })

  it('läuft Coco gerade, bleibt das Ereignis ohne Wirkung', () => {
    coco.setPose('rennen')
    advance(300)
    document.dispatchEvent(new CustomEvent(COCO_JOY_EVENT))
    expect(shown()).not.toBe('freude')
  })

  it('reduzierte Bewegung: kein Hüpfer', () => {
    coco.setMotion('reduced', 'sitzen')
    document.dispatchEvent(new CustomEvent(COCO_JOY_EVENT))
    expect(shown()).toBe('sitzen')
  })
})
