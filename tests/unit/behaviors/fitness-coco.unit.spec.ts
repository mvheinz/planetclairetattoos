// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { mount, timeline, type FitnessData } from '@/behaviors/fitness-coco'

// P12.5: Endlosschleife (Übergang → Übung im Kreis → nächste …), Laden nach dem `load`, Standbild bei reduzierter
// Bewegung, Pause außerhalb des Bildes, Aufräumen.

const data: FitnessData = {
  f: 100,
  ex: [
    { id: 'a', ms: 400, fr: ['a0|p0', 'a1|p1'] },
    { id: 'b', ms: 300, fr: ['b0|q0', 'b1|q1', 'b2|q2'] },
  ],
  tr: [['t0|u0'], ['t1|u1', 't2|u2']],
}

describe('timeline', () => {
  it('je Übung erst der Übergang, dann die Bilder im Kreis bis zur Dauer; danach von vorn', () => {
    const it2 = timeline(data)
    const out = Array.from({ length: 14 }, () => it2.next().value as string)
    expect(out.map((s) => s.split('|')[0])).toEqual([
      't0',
      'a0',
      'a1',
      'a0',
      'a1',
      't1',
      't2',
      'b0',
      'b1',
      'b2',
      't0',
      'a0',
      'a1',
      'a0',
    ])
  })
})

let root: HTMLElement
const ink = () => root.querySelector('[data-fitness-ink]')!.getAttribute('d')
const pencil = () => root.querySelector('[data-fitness-pencil]')!.getAttribute('d')

function setup(motion?: 'reduced') {
  document.body.innerHTML =
    '<div id="r" data-behavior="fitness-coco" data-fitness-src="/art/fitness-coco.v1.json"><svg><path data-fitness-pencil d="PS"/><path data-fitness-ink d="IS"/></svg></div>'
  root = document.getElementById('r')!
  if (motion) document.documentElement.setAttribute('data-motion', motion)
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  Object.defineProperty(document, 'hidden', { configurable: true, value: false })
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  document.documentElement.removeAttribute('data-motion')
  document.body.innerHTML = ''
})

const flush = async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve()
}

describe('fitness-coco mount', () => {
  it('holt die Bildfolge und spielt sie im 10-Bilder/s-Takt; unmount stellt das Standbild wieder her', async () => {
    setup()
    const fetchMock = vi.fn((_url: string) => Promise.resolve(data as unknown))
    const fitnessData = fetchMock
    const unmount = mount(root, { mode: 'app', actions: { fitnessData } })
    expect(fetchMock).toHaveBeenCalledWith('/art/fitness-coco.v1.json')
    await flush()
    expect(ink()).toBe('t0')
    expect(pencil()).toBe('u0')
    vi.advanceTimersByTime(100)
    expect(ink()).toBe('a0')
    vi.advanceTimersByTime(300)
    expect(ink()).toBe('a1') // nach 4 Bildern: a0 a1 a0 a1 … weiter
    unmount()
    expect(ink()).toBe('IS')
    vi.advanceTimersByTime(10_000)
    expect(ink()).toBe('IS')
    expect(vi.getTimerCount()).toBe(0)
  })

  it('reduzierte Bewegung: kein Abruf, Standbild bleibt; im Vorschau-Modus ebenfalls', () => {
    setup('reduced')
    const fetchMock = vi.fn((_url: string) => Promise.resolve(data as unknown))
    const fitnessData = fetchMock
    const un = mount(root, { mode: 'app', actions: { fitnessData } })
    expect(fetchMock).not.toHaveBeenCalled()
    expect(ink()).toBe('IS')
    un()
    document.documentElement.removeAttribute('data-motion')
    const un2 = mount(root, { mode: 'preview', actions: { fitnessData } })
    expect(fetchMock).not.toHaveBeenCalled()
    un2()
  })

  it('wechselt der Schalter auf „Animationen aus“, steht sofort wieder das Standbild', async () => {
    setup()
    const fitnessData = vi.fn((_url: string) => Promise.resolve(data as unknown))
    const un = mount(root, { mode: 'app', actions: { fitnessData } })
    await flush()
    vi.advanceTimersByTime(200)
    expect(ink()).not.toBe('IS')
    document.documentElement.setAttribute('data-motion', 'reduced')
    await flush()
    expect(ink()).toBe('IS')
    vi.advanceTimersByTime(1000)
    expect(ink()).toBe('IS')
    un()
  })
})
