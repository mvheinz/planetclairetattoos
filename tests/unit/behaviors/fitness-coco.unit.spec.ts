// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { mount, timeline, type FitnessData } from '@/behaviors/fitness-coco'

// P12.5: Endlosschleife (Übergang → Übung im Kreis → nächste …), Laden nach dem `load`, Standbild bei reduzierter
// Bewegung, Pause außerhalb des Bildes, Aufräumen. Gezeichnet wird auf einer Leinwand (hier mit Stummel-Kontext).

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
let drawn: string[]
const still = () => root.querySelector<HTMLElement>('[data-fitness-still]')!
const canvas = () => root.querySelector<HTMLCanvasElement>('[data-fitness-canvas]')!

function setup(motion?: 'reduced') {
  document.body.innerHTML =
    '<div id="r" data-behavior="fitness-coco" data-fitness-src="/art/fitness-coco.v1.json"><img data-fitness-still src="/s.svg"><canvas data-fitness-canvas hidden></canvas></div>'
  root = document.getElementById('r')!
  if (motion) document.documentElement.setAttribute('data-motion', motion)
  drawn = []
  // Stummel-Kontext: merkt sich die Pfadtexte der gezeichneten Striche (zuerst Buntstift, dann Tusche)
  const strokes: string[] = []
  const stub = {
    setTransform: vi.fn(),
    clearRect: vi.fn(),
    setLineDash: vi.fn(),
    stroke: vi.fn<(p: { d: string }) => void>(),
    lineCap: '',
    lineJoin: '',
    lineWidth: 0,
    strokeStyle: '',
  }
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(((kind: string) => {
    if (kind !== '2d') return null
    // jedes Bild = zwei Striche; nach dem zweiten Strich Pfadtext „ink“ notieren
    stub.stroke.mockImplementation((p: { d: string }) => {
      strokes.push(p.d)
      if (strokes.length % 2 === 0) drawn.push(strokes[strokes.length - 1]!)
    })
    return stub
  }) as never)
  vi.stubGlobal(
    'Path2D',
    class {
      constructor(public d: string) {}
    },
  )
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  Object.defineProperty(document, 'hidden', { configurable: true, value: false })
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  document.documentElement.removeAttribute('data-motion')
  document.body.innerHTML = ''
})

const flush = async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve()
}

describe('fitness-coco mount', () => {
  it('holt die Bildfolge, spielt sie im 10-Bilder/s-Takt auf der Leinwand; unmount stellt das Standbild wieder her', async () => {
    setup()
    const fitnessData = vi.fn((_url: string) => Promise.resolve(data as unknown))
    const unmount = mount(root, { mode: 'app', actions: { fitnessData } })
    expect(fitnessData).toHaveBeenCalledWith('/art/fitness-coco.v1.json')
    await flush()
    expect(drawn).toEqual(['t0']) // erstes Bild: Übergang vor Übung 1 (Tusche-Pfad „t0“)
    expect(canvas().hidden).toBe(false)
    expect(still().style.visibility).toBe('hidden')
    vi.advanceTimersByTime(100)
    expect(drawn.at(-1)).toBe('a0')
    vi.advanceTimersByTime(300)
    expect(drawn.at(-1)).toBe('a1')
    unmount()
    expect(canvas().hidden).toBe(true)
    expect(still().style.visibility).toBe('')
    const n = drawn.length
    vi.advanceTimersByTime(10_000)
    expect(drawn).toHaveLength(n)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('reduzierte Bewegung: kein Abruf, Standbild bleibt; im Vorschau-Modus ebenfalls', () => {
    setup('reduced')
    const fitnessData = vi.fn((_url: string) => Promise.resolve(data as unknown))
    const un = mount(root, { mode: 'app', actions: { fitnessData } })
    expect(fitnessData).not.toHaveBeenCalled()
    expect(canvas().hidden).toBe(true)
    un()
    document.documentElement.removeAttribute('data-motion')
    const un2 = mount(root, { mode: 'preview', actions: { fitnessData } })
    expect(fitnessData).not.toHaveBeenCalled()
    un2()
  })

  it('wechselt der Schalter auf „Animationen aus“, steht sofort wieder das Standbild', async () => {
    setup()
    const fitnessData = vi.fn((_url: string) => Promise.resolve(data as unknown))
    const un = mount(root, { mode: 'app', actions: { fitnessData } })
    await flush()
    vi.advanceTimersByTime(200)
    expect(canvas().hidden).toBe(false)
    document.documentElement.setAttribute('data-motion', 'reduced')
    await flush()
    expect(canvas().hidden).toBe(true)
    expect(still().style.visibility).toBe('')
    const n = drawn.length
    vi.advanceTimersByTime(1000)
    expect(drawn).toHaveLength(n)
    un()
  })
})
