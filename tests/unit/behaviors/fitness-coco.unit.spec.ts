// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { mount } from '@/behaviors/fitness-coco'
import { EXERCISES } from '../../../scripts/art/fitness-coco'

// P12.5: Endlosschleife aus dem Puppen-Gerüst – Laden nach dem `load`, ≈ 30 Bilder/s auf einer Leinwand, Standbild bei
// reduzierter Bewegung, Pause außerhalb des Bildes und im verborgenen Tab, Aufräumen. Gezeichnet wird mit Stummel-Kontext.

const data = { v: 2, ex: EXERCISES }

let root: HTMLElement
let queue: FrameRequestCallback[]
let now: number
let fills: number
let paints: number
let strokes: number
const still = () => root.querySelector<HTMLElement>('[data-fitness-still]')!
const canvas = () => root.querySelector<HTMLCanvasElement>('[data-fitness-canvas]')!
/** Ein Anzeige-Takt (16 ms): ruft die vorgemerkten rAF-Rückrufe auf. */
const tick = (n = 1, step = 16.7) => {
  for (let i = 0; i < n; i++) {
    now += step
    const q = queue
    queue = []
    q.forEach((cb) => cb(now))
  }
}
const flush = async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve()
}

function setup(motion?: 'reduced') {
  document.body.innerHTML =
    '<div id="r" data-behavior="fitness-coco" data-fitness-src="/art/fitness-coco.v2.json"><img data-fitness-still src="/s.svg"><canvas data-fitness-canvas hidden></canvas></div>'
  root = document.getElementById('r')!
  if (motion) document.documentElement.setAttribute('data-motion', motion)
  queue = []
  now = 0
  fills = 0
  paints = 0
  strokes = 0
  window.requestAnimationFrame = ((cb: FrameRequestCallback) =>
    queue.push(cb)) as typeof window.requestAnimationFrame
  window.cancelAnimationFrame = (() => {
    queue = []
  }) as typeof window.cancelAnimationFrame
  const stub = {
    setTransform: vi.fn(),
    clearRect: vi.fn(),
    drawImage: vi.fn(() => paints++),
    setLineDash: vi.fn(),
    fill: vi.fn(() => fills++),
    stroke: vi.fn(() => strokes++),
    lineCap: '',
    lineJoin: '',
    lineWidth: 0,
    strokeStyle: '',
    fillStyle: '',
    globalAlpha: 1,
  }
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(((kind: string) =>
    kind === '2d' ? stub : null) as never)
  vi.stubGlobal('Path2D', class {})
}

beforeEach(() => {
  Object.defineProperty(document, 'hidden', { configurable: true, value: false })
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  document.documentElement.removeAttribute('data-motion')
  document.body.innerHTML = ''
})

describe('fitness-coco mount', () => {
  it('holt den Ablaufplan, zeichnet 20 Bilder/s auf der Leinwand; unmount stellt das Standbild wieder her', async () => {
    setup()
    const fitnessData = vi.fn((_url: string) => Promise.resolve(data as unknown))
    const unmount = mount(root, { mode: 'app', actions: { fitnessData } })
    expect(fitnessData).toHaveBeenCalledWith('/art/fitness-coco.v2.json')
    await flush()
    expect(canvas().hidden).toBe(false)
    expect(still().style.visibility).toBe('hidden')
    expect(paints).toBe(1) // erstes Bild sofort
    expect(fills).toBeGreaterThan(5) // Papier-/Waschflächen
    const first = paints
    tick() // Takt 1: Uhr setzen, nächste Pose rechnen
    tick() // Takt 2: erste Hälfte in den Puffer
    expect(paints).toBe(first) // noch nichts auf der Leinwand (Puffer wird erst fertig gezeigt)
    tick() // Takt 3: zweite Hälfte, dann auf die Leinwand
    expect(paints).toBe(first + 1)
    tick(2) // Wartezeit (Bildabstand 50 ms): kein neues Bild
    expect(paints).toBe(first + 1)
    const n = paints
    tick(60) // ≈ 1 s → ≈ 20 Bilder
    expect(paints - n).toBeGreaterThanOrEqual(17)
    expect(paints - n).toBeLessThanOrEqual(22)
    expect(strokes).toBeGreaterThan(0)
    unmount()
    expect(canvas().hidden).toBe(true)
    expect(still().style.visibility).toBe('')
    const m = paints
    tick(30)
    expect(paints).toBe(m)
    expect(queue).toHaveLength(0)
  })

  it('fallen Anzeige-Takte aus (verspätete Takte), schaltet es auf 10 Bilder/s zurück – nie ruckelnd', async () => {
    setup()
    const un = mount(root, {
      mode: 'app',
      actions: { fitnessData: () => Promise.resolve(data as unknown) },
    })
    await flush()
    tick(100) // Einblenden (1,4 s) abwarten: davor zählen verspätete Takte nicht
    const n = paints
    tick(60)
    const fast = paints - n
    expect(fast).toBeGreaterThanOrEqual(17)
    // vier Takte à 45 ms (Gerät kommt nicht mehr hinterher) → dauerhaft Stufe 1
    tick(4, 45)
    tick(3)
    const m = paints
    tick(60)
    const slow = paints - m
    expect(slow).toBeLessThanOrEqual(11)
    expect(slow).toBeGreaterThanOrEqual(8)
    un()
  })

  it('reduzierte Bewegung: kein Abruf, Standbild bleibt; im Vorschau-Modus kommt der Plan aus der Datei (kein Netz)', () => {
    setup('reduced')
    const fitnessData = vi.fn((_url: string) => Promise.resolve(data as unknown))
    const un = mount(root, { mode: 'app', actions: { fitnessData } })
    expect(fitnessData).not.toHaveBeenCalled()
    expect(canvas().hidden).toBe(true)
    un()
    document.documentElement.removeAttribute('data-motion')
    const un2 = mount(root, { mode: 'preview', actions: { fitnessData } })
    expect(fitnessData).toHaveBeenCalledTimes(1)
    un2()
  })

  it('wechselt der Schalter auf „Animationen aus“, steht sofort wieder das Standbild', async () => {
    setup()
    const fitnessData = vi.fn((_url: string) => Promise.resolve(data as unknown))
    const un = mount(root, { mode: 'app', actions: { fitnessData } })
    await flush()
    tick(4)
    expect(canvas().hidden).toBe(false)
    document.documentElement.setAttribute('data-motion', 'reduced')
    await flush()
    expect(canvas().hidden).toBe(true)
    expect(still().style.visibility).toBe('')
    const n = paints
    tick(30)
    expect(paints).toBe(n)
    un()
  })

  it('pausiert im verborgenen Tab und läuft danach weiter', async () => {
    setup()
    const un = mount(root, {
      mode: 'app',
      actions: { fitnessData: () => Promise.resolve(data as unknown) },
    })
    await flush()
    tick(4)
    Object.defineProperty(document, 'hidden', { configurable: true, value: true })
    document.dispatchEvent(new Event('visibilitychange'))
    expect(queue).toHaveLength(0)
    const n = paints
    tick(20)
    expect(paints).toBe(n)
    Object.defineProperty(document, 'hidden', { configurable: true, value: false })
    document.dispatchEvent(new Event('visibilitychange'))
    tick(4)
    expect(paints).toBeGreaterThan(n)
    un()
  })

  it('pausiert außerhalb des Bildes (IntersectionObserver)', async () => {
    setup()
    let cb: IntersectionObserverCallback = () => {}
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(c: IntersectionObserverCallback) {
          cb = c
          window.IntersectionObserver = this.constructor as never
        }
        observe() {}
        disconnect() {}
      },
    )
    window.IntersectionObserver = globalThis.IntersectionObserver
    const un = mount(root, {
      mode: 'app',
      actions: { fitnessData: () => Promise.resolve(data as unknown) },
    })
    await flush()
    tick(4)
    cb([{ isIntersecting: false } as IntersectionObserverEntry], {} as IntersectionObserver)
    expect(queue).toHaveLength(0)
    const n = paints
    tick(20)
    expect(paints).toBe(n)
    cb([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver)
    tick(4)
    expect(paints).toBeGreaterThan(n)
    un()
  })

  it('unbrauchbare Daten werden ignoriert (Standbild bleibt)', async () => {
    setup()
    const un = mount(root, {
      mode: 'app',
      actions: { fitnessData: () => Promise.resolve({ v: 1, ex: [] } as unknown) },
    })
    await flush()
    expect(canvas().hidden).toBe(true)
    expect(queue).toHaveLength(0)
    un()
  })
})
