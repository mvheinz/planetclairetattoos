// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { exposeLeashDebug } from '@/leash/debug'
import { easeInkOut } from '@/leash/easing'
import {
  FRAME_MEASURE_CAP,
  LEASH_MEASURES,
  mountLeash as mountStepwise,
  type InspectableLeashHandle,
  type MountOptions,
} from '@/leash/runtime'
import { resetLeashSchedule, whenLeashReady } from '@/leash/schedule'

import { installTracker, type Tracker } from '../behaviors/harness'

// P2.16 Laufzeit der Tuschelinie unter jsdom (DESIGN §9.4, §9.6, §9.10, §9.12 AK-DS-18).

/** Aufbau in einem Zug (die Idle-Teilstücke prüft ein eigener Test). */
const mountLeash = (root: HTMLElement, o: MountOptions) =>
  mountStepwise(root, { stepwise: false, ...o })

const VIEW = { w: 390, h: 844 }
const PAGE_H = 4000

function stubMatchMedia(reduce = false) {
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: q.includes('reduce') ? reduce : false,
    media: q,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
}

/** Seitencontainer mit Linien-Ebene, Inhalt mit Rinne und drei Stationen; Rechtecke über `data-rect`. */
function setupDom(): HTMLElement {
  document.body.innerHTML = `
    <div class="page" data-rect="0,0,390,${PAGE_H}">
      <div data-leash-layer aria-hidden="true" data-rect="0,0,390,${PAGE_H}"></div>
      <main><div class="u-container" data-rect="0,0,390,${PAGE_H}">
        <div data-leash-station="hallo" data-leash-pose="sit" data-leash-loop="right" data-rect="60,700,24,24"></div>
        <div data-leash-station="keramik" data-leash-pose="sniff" data-leash-loop="left" data-rect="60,1500,24,24"></div>
        <div data-leash-station="zeichnungen" data-leash-loop="spiral" data-rect="60,2400,24,24"></div>
      </div></main>
    </div>`
  return document.querySelector<HTMLElement>('[data-leash-layer]')!
}

let scrollY = 0
function setScroll(y: number) {
  scrollY = y
  window.dispatchEvent(new Event('scroll'))
}

let tracker: Tracker
const baseListeners = () => tracker.openListeners().filter((l) => !l.startsWith('<'))

beforeEach(() => {
  vi.useFakeTimers({
    toFake: [
      'setTimeout',
      'clearTimeout',
      'requestAnimationFrame',
      'cancelAnimationFrame',
      'performance',
    ],
  })
  tracker = installTracker()
  stubMatchMedia(false)
  scrollY = 0
  Object.defineProperty(window, 'scrollY', { configurable: true, get: () => scrollY })
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: VIEW.w })
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: VIEW.h })
  Object.defineProperty(document.documentElement, 'scrollHeight', {
    configurable: true,
    get: () => PAGE_H + 400,
  })
  Object.defineProperty(navigator, 'hardwareConcurrency', { configurable: true, value: 8 })
  Element.prototype.getBoundingClientRect = function () {
    const r = (this.getAttribute('data-rect') ?? '0,0,0,0').split(',').map(Number)
    const [x, y, w, h] = r as [number, number, number, number]
    return {
      x,
      y: y - scrollY,
      left: x,
      top: y - scrollY,
      width: w,
      height: h,
      right: x + w,
      bottom: y - scrollY + h,
      toJSON: () => ({}),
    } as DOMRect
  }
})

afterEach(() => {
  tracker.restore()
  vi.useRealTimers()
  document.body.innerHTML = ''
  document.documentElement.removeAttribute('data-motion')
})

const advance = (ms: number) => vi.advanceTimersByTime(ms)

describe('leash/runtime – mountLeash', () => {
  it('baut Segmente in Stufe A (Strich-Stücke ohne Maske) und zeichnet beim Scrollen monoton (§9.4, §9.6)', () => {
    const root = setupDom()
    const handle = mountLeash(root, { preset: 'journey', routeKey: 'R01' })
    const state = handle.inspect()
    expect(state.tier).toBe('A')
    expect(state.geometry!.segments.length).toBeGreaterThan(0)
    const svgs = root.querySelectorAll('svg')
    expect(svgs.length).toBe(state.geometry!.segments.length)
    // PF-05: keine Masken (deren Änderung erzwingt je Frame ein Layout), je Stück ein runder Strich mit Dash
    expect(root.querySelectorAll('mask, [mask]').length).toBe(0)
    const strokes = state.geometry!.segments.reduce((n, g) => n + g.strokes!.length, 0)
    // PF-05/PF-10: Dash-Muster und „verborgen“ am `<svg>` (vererbt), die Stücke tragen nur `d` und Breite
    const all = [...root.querySelectorAll<SVGPathElement>('path')]
    expect(all.length).toBe(strokes)
    for (const p of all) {
      expect(p.closest('svg')!.getAttribute('stroke-linecap')).toBe('round')
      expect(p.closest('svg')!.getAttribute('stroke-dasharray')).toBe('2000 2000')
      expect(p.hasAttribute('stroke-dasharray')).toBe(false)
    }
    // Lage inline, Rest aus global.css; die Ebene ist aria-hidden (PF-10)
    for (const svg of svgs) expect(svg.style.left).toMatch(/px$/)

    // Intro (journey) von 0 bis zur Lesezeile in 900 ms
    expect(handle.inspect().drawnLen).toBe(0)
    advance(1000)
    const afterIntro = handle.inspect().drawnLen
    expect(afterIntro).toBeGreaterThan(0)

    setScroll(1200)
    advance(20)
    const down = handle.inspect().drawnLen
    expect(down).toBeGreaterThan(afterIntro)
    setScroll(700)
    advance(20)
    expect(handle.inspect().drawnLen).toBe(down)
    // Coco läuft geglättet auf der Linie zurück
    advance(1000)
    expect(handle.inspect().cocoLen).toBeLessThan(down)

    // Gezeichnete Stücke ganz sichtbar (Versatz 0), höchstens eines anteilig, zukünftige Segmente unsichtbar
    const ink = [...root.querySelectorAll<SVGPathElement>('path')]
    const offsets = ink.map((p) => parseFloat(p.getAttribute('stroke-dashoffset') ?? 'NaN'))
    expect(offsets.some((o) => o === 0)).toBe(true) // fertige Stücke
    expect(offsets.filter((o) => o > 0 && o < 2000).length).toBeLessThanOrEqual(1) // höchstens eines anteilig
    expect([...svgs].some((s) => (s as SVGSVGElement).style.visibility === 'hidden')).toBe(true)

    setScroll(PAGE_H + 400 - VIEW.h)
    advance(20)
    expect(handle.inspect().drawnLen).toBe(handle.inspect().geometry!.totalLength)
    handle.destroy()
  })

  it('Einstieg mitten in der Seite: kein Intro, drawnLen sofort auf der Lesezeile', () => {
    const root = setupDom()
    scrollY = 1500
    const handle = mountLeash(root, { preset: 'journey', routeKey: 'R01' })
    expect(handle.inspect().drawnLen).toBeGreaterThan(0)
    handle.destroy()
  })

  it('reduzierte Bewegung → Stufe C: vollständig, ohne Maske (§9.11); setMotion schaltet ohne Neuladen', () => {
    stubMatchMedia(true)
    const root = setupDom()
    const handle = mountLeash(root, { preset: 'journey', routeKey: 'R01' })
    const s = handle.inspect()
    expect(s.tier).toBe('C')
    expect(s.drawnLen).toBe(s.geometry!.totalLength)
    expect(root.querySelectorAll('[mask], mask').length).toBe(0)
    handle.setMotion('full')
    expect(handle.inspect().tier).toBe('A')
    // bereits gezeichnete Tinte bleibt
    expect(handle.inspect().drawnLen).toBe(handle.inspect().geometry!.totalLength)
    handle.destroy()
  })

  it('wenige Kerne → Stufe B (Feder): Strich ohne Maske und ohne Breitenvariation', () => {
    Object.defineProperty(navigator, 'hardwareConcurrency', { configurable: true, value: 2 })
    const root = setupDom()
    const handle = mountLeash(root, { preset: 'margin', routeKey: 'R20' })
    expect(handle.inspect().tier).toBe('B')
    expect(root.querySelectorAll('mask').length).toBe(0)
    const path = root.querySelector<SVGPathElement>('path.ink')!
    expect(path.getAttribute('fill')).toBe('none')
    expect(path.getAttribute('stroke-linecap')).toBe('round')
    handle.destroy()
  })

  it('Laufzeit-Abstufung A → B bei > 25 % langsamen Frames in 2 s Scroll-Aktivität (nur im Speicher)', () => {
    // Langsames Gerät: jeder Frame braucht 32 ms.
    const raf = window.requestAnimationFrame
    const caf = window.cancelAnimationFrame
    window.requestAnimationFrame = (cb) =>
      setTimeout(() => cb(performance.now()), 32) as unknown as number
    window.cancelAnimationFrame = (id) => clearTimeout(id)
    const root = setupDom()
    const handle = mountLeash(root, { preset: 'margin', routeKey: 'R20' })
    expect(handle.inspect().tier).toBe('A')
    for (let i = 0; i < 90; i++) {
      setScroll(100 + i * 5)
      advance(32)
    }
    expect(handle.inspect().tier).toBe('B')
    expect(root.querySelectorAll('mask').length).toBe(0)
    expect(tracker.sensitive).toEqual([])
    handle.destroy()
    window.requestAnimationFrame = raf
    window.cancelAnimationFrame = caf
  })

  it('Neuaufbau: Breitenänderung entprellt 150 ms; Höhenänderung < 120 px ignoriert (§9.6, §9.10)', () => {
    const root = setupDom()
    const handle = mountLeash(root, { preset: 'journey', routeKey: 'R01' })
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: VIEW.h - 80 })
    window.dispatchEvent(new Event('resize'))
    advance(500)
    expect(handle.inspect().rebuildCount).toBe(0)
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 768 })
    window.dispatchEvent(new Event('resize'))
    advance(100)
    window.dispatchEvent(new Event('resize'))
    advance(100)
    expect(handle.inspect().rebuildCount).toBe(0)
    advance(200)
    expect(handle.inspect().rebuildCount).toBe(1)
    handle.rebuild()
    expect(handle.inspect().rebuildCount).toBe(2)
    handle.destroy()
  })

  it('PF-04: erster Aufbau in Idle-Teilstücken, jedes mit eigener leash:build-Messung; whenBuilt danach', () => {
    const w = window as Window & {
      requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number
      cancelIdleCallback?: (id: number) => void
    }
    w.requestIdleCallback = (cb) => setTimeout(cb, 1) as unknown as number
    w.cancelIdleCallback = (id) => clearTimeout(id)
    const measure = vi.spyOn(performance, 'measure')
    try {
      const root = setupDom()
      let scrollReads = 0
      const scrollY = vi.spyOn(window, 'scrollY', 'get').mockImplementation(() => {
        scrollReads++
        return 0
      })
      const handle = mountStepwise(root, { preset: 'journey', routeKey: 'R01' })
      const built = vi.fn()
      handle.whenBuilt(built)
      // Auch die Lesephase wartet auf den Idle-Callback (Layout nach dem Frame aktuell) – noch keine Linie
      expect(handle.inspect().geometry).toBeNull()
      expect(root.querySelectorAll('svg').length).toBe(0)
      expect(measure.mock.calls.filter((c) => c[0] === LEASH_MEASURES.build)).toHaveLength(0)
      for (let i = 0; i < 40 && !built.mock.calls.length; i++) advance(2)
      // `scrollY` nur in der Lesephase: die Schreibphase erzwingt kein Layout (PF-04/PF-05)
      expect(scrollReads).toBe(1)
      scrollY.mockRestore()
      expect(built).toHaveBeenCalledTimes(1)
      expect(root.querySelectorAll('svg').length).toBe(handle.inspect().geometry!.segments.length)
      const builds = measure.mock.calls.filter((c) => c[0] === LEASH_MEASURES.build)
      expect(builds.length).toBeGreaterThanOrEqual(3)
      const later = vi.fn()
      handle.whenBuilt(later)
      expect(later).toHaveBeenCalledTimes(1)
      // Abbruch mitten im Aufbau räumt die Idle-Callbacks
      const root2 = setupDom()
      const h2 = mountStepwise(root2, { preset: 'journey', routeKey: 'R01' })
      advance(2)
      h2.destroy()
      handle.destroy()
      expect(vi.getTimerCount()).toBe(0)
    } finally {
      measure.mockRestore()
      Reflect.deleteProperty(w, 'requestIdleCallback')
      Reflect.deleteProperty(w, 'cancelIdleCallback')
    }
  })

  it('AK-DS-18: destroy() räumt Listener, Observer, Timer und DOM; zweites mount auf neuem DOM funktioniert', () => {
    const before = baseListeners()
    const timers0 = vi.getTimerCount()
    const root = setupDom()
    const handle = mountLeash(root, { preset: 'journey', routeKey: 'R01' })
    setScroll(900)
    window.dispatchEvent(new Event('resize'))
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 500 })
    window.dispatchEvent(new Event('resize'))
    expect(vi.getTimerCount()).toBeGreaterThan(0)
    expect(tracker.openObservers().length).toBeGreaterThan(0)
    handle.destroy()
    expect(vi.getTimerCount()).toBe(timers0)
    expect(timers0).toBe(0)
    expect(tracker.openObservers()).toEqual([])
    expect(baseListeners()).toEqual(before)
    expect(root.childElementCount).toBe(0)
    expect(tracker.runningAnimations()).toBe(0)
    handle.destroy() // idempotent

    const root2 = setupDom()
    const again: InspectableLeashHandle = mountLeash(root2, { preset: 'journey', routeKey: 'R01' })
    expect(root2.querySelectorAll('svg').length).toBeGreaterThan(0)
    again.destroy()
    expect(tracker.sensitive).toEqual([])
  })

  it('gleiche Route → gleiche Linie; andere Route → andere Linie (Seed §9.3)', () => {
    const d = (key: string) => {
      const root = setupDom()
      const h = mountLeash(root, { preset: 'margin', routeKey: key })
      const out = h
        .inspect()
        .geometry!.segments.flatMap((g) => g.strokes!.map((x) => x.d))
        .join('')
      h.destroy()
      return out
    }
    expect(d('R20')).toBe(d('R20'))
    expect(d('R20')).not.toBe(d('R99'))
  })

  it('onCoco meldet Position der Leinenspitze aus der LUT', () => {
    const root = setupDom()
    const coco = vi.fn()
    const handle = mountLeash(root, { preset: 'journey', routeKey: 'R01', onCoco: coco })
    advance(1000)
    setScroll(800)
    advance(500)
    const last = coco.mock.calls.at(-1)![0]
    expect(last.len).toBeCloseTo(handle.inspect().cocoLen, 5)
    expect(Number.isFinite(last.x) && Number.isFinite(last.y)).toBe(true)
    handle.destroy()
  })

  it('Presets ohne Coco (margin) melden keine Coco-Position und keine Pose', () => {
    const root = setupDom()
    const coco = vi.fn()
    const handle = mountLeash(root, { preset: 'margin', routeKey: 'R20', onCoco: coco })
    setScroll(800)
    advance(500)
    expect(coco).not.toHaveBeenCalled()
    expect(handle.inspect().pose).toBeNull()
    handle.destroy()
  })

  it('P2.23 User-Timing ohne Debug-Schnittstelle: leash:build je Aufbau, leash:frame je Frame, Puffer begrenzt (KUNST-QA PF-03)', () => {
    const measure = vi.spyOn(performance, 'measure')
    const clear = vi.spyOn(performance, 'clearMeasures')
    const root = setupDom()
    const handle = mountLeash(root, { preset: 'journey', routeKey: 'R01' })
    const names = () => measure.mock.calls.map((c) => c[0])
    expect(names()).toEqual([LEASH_MEASURES.build])
    expect(measure.mock.calls[0]![1]).toMatchObject({
      start: expect.any(Number),
      end: expect.any(Number),
    })
    advance(1000)
    const frames = names().filter((n) => n === LEASH_MEASURES.frame).length
    expect(frames).toBeGreaterThan(10)
    expect((window as Window & { __leash?: unknown }).__leash).toBeUndefined()
    for (let i = 0; clear.mock.calls.length === 0 && i < FRAME_MEASURE_CAP; i++) {
      setScroll(i % 2 ? 1200 : 1210)
      advance(17)
    }
    expect(clear).toHaveBeenCalledWith(LEASH_MEASURES.frame)
    expect(names().filter((n) => n === LEASH_MEASURES.frame).length).toBe(FRAME_MEASURE_CAP)
    handle.destroy()
  })

  it('exposeLeashDebug stellt window.__leash bereit und räumt es wieder ab', () => {
    const root = setupDom()
    const handle = mountLeash(root, { preset: 'margin', routeKey: 'R20' })
    const off = exposeLeashDebug(handle)
    const api = (window as Window & { __leash?: { drawnLen(): number; tier(): string } }).__leash!
    expect(api.tier()).toBe('A')
    expect(api.drawnLen()).toBe(handle.inspect().drawnLen)
    off()
    expect((window as Window & { __leash?: unknown }).__leash).toBeUndefined()
    handle.destroy()
  })
})

describe('leash/runtime – reduzierte Bewegung (P2.17, §9.11, §10.6)', () => {
  it('AK-DS-14 prefers-reduced-motion: Stufe C, sofort vollständig, keine Maske, Coco ruht sitzend an Station 1', () => {
    stubMatchMedia(true)
    const root = setupDom()
    const coco = vi.fn()
    const handle = mountLeash(root, { preset: 'journey', routeKey: 'R01', onCoco: coco })
    const s = handle.inspect()
    expect(s.tier).toBe('C')
    expect(s.drawnLen).toBe(s.geometry!.totalLength)
    expect(root.querySelectorAll('[mask], mask').length).toBe(0)
    expect(s.pose).toBe('sitzen')
    expect(s.cocoLen).toBe(s.geometry!.stations[0]!.loopLen0)
    // Scrollen bewegt Coco nicht und startet keine Schleife.
    setScroll(1500)
    advance(500)
    expect(handle.inspect().cocoLen).toBe(s.cocoLen)
    expect(handle.inspect().pose).toBe('sitzen')
    expect(coco.mock.calls.at(-1)![0]).toMatchObject({
      pose: 'sitzen',
      moving: false,
      motion: 'reduced',
    })
    handle.destroy()
  })

  it('setMotion: reduziert → Linie sofort vollständig ohne Intro; zurück → Tinte bleibt (monoton)', () => {
    const root = setupDom()
    const handle = mountLeash(root, { preset: 'journey', routeKey: 'R01' })
    expect(handle.inspect().drawnLen).toBe(0) // Intro läuft noch
    handle.setMotion('reduced')
    let s = handle.inspect()
    expect(s.tier).toBe('C')
    expect(s.drawnLen).toBe(s.geometry!.totalLength)
    expect(root.querySelectorAll('mask').length).toBe(0)
    expect(s.pose).toBe('sitzen')
    handle.setMotion('full')
    s = handle.inspect()
    expect(s.tier).toBe('A')
    expect(s.drawnLen).toBe(s.geometry!.totalLength)
    handle.destroy()
  })

  it('Ruhe-Pose je Preset laut §10.6', async () => {
    const { REST_POSE } = await import('@/leash/presets')
    expect(REST_POSE).toMatchObject({
      journey: 'sitzen',
      about: 'sitzen',
      stencil: 'kopfschief',
      calm: 'sitzen',
      legal: null,
      margin: null,
      lost: null,
    })
  })
})

describe('leash/debug – window.__leash und window.__qa (P2.17, §9.13, KUNST-QA §3.1)', () => {
  type W = Window & {
    __leash?: {
      pose(): string | null
      drawnLen(): number
      cocoLen(): number
      setReadingY(y: number | null): void
      geometry: { scrollMap: { readingY: number; len: number }[] }
    }
    __qa?: {
      poseLog: { from: string | null; to: string; bridge: string | null }[]
      frames: number[]
      start(): void
      stop(): void
      dump(): { frames: number[]; poseLog: unknown[]; marks: unknown[] }
      recording: boolean
    }
  }

  it('pose(), setReadingY(y) und poseLog', () => {
    const root = setupDom()
    const handle = mountLeash(root, { preset: 'journey', routeKey: 'R01' })
    const off = exposeLeashDebug(handle)
    const w = window as W
    const api = w.__leash!
    w.__qa!.start()
    advance(1000)
    expect(api.pose()).not.toBeNull()
    // Lesezeile ein kurzes Stück weiter (< 300 px Bogenlänge): Coco rennt geglättet hinterher.
    const near = api.geometry.scrollMap.find((r) => r.len >= api.cocoLen() + 150)!
    api.setReadingY(near.readingY)
    advance(16)
    expect(api.pose()).toBe('rennen')
    advance(2000)
    expect(api.pose()).not.toBe('rennen')
    // Lesezeile fest auf die zweite Station: gezeichnete Länge folgt ohne Scroll.
    const station = handle.inspect().geometry!.stations[1]!
    const row = api.geometry.scrollMap.find((r) => r.len >= station.loopLen1)!
    api.setReadingY(row.readingY)
    advance(2000)
    expect(api.drawnLen()).toBeGreaterThanOrEqual(station.loopLen1 - 1)
    expect(api.cocoLen()).toBeGreaterThan(station.loopLen0)
    const log = w.__qa!.poseLog
    expect(log.some((e) => e.to === 'rennen')).toBe(true)
    expect(log.every((e) => e.bridge === null || typeof e.bridge === 'string')).toBe(true)
    const dump = w.__qa!.dump()
    expect(Array.isArray(dump.frames)).toBe(true)
    expect(JSON.parse(JSON.stringify(dump)).poseLog.length).toBe(log.length)
    w.__qa!.stop()
    expect(w.__qa!.recording).toBe(false)
    off()
    expect(w.__leash).toBeUndefined()
    handle.destroy()
    delete w.__qa
  })
})

describe('leash/schedule – Ladezeitpunkt (§9.2)', () => {
  it('ohne LCP: load + 1200 ms, dann Idle; danach (weiche Navigation) sofort; Abbruch räumt auf', () => {
    resetLeashSchedule()
    Object.defineProperty(document, 'readyState', { configurable: true, value: 'complete' })
    const cb = vi.fn()
    whenLeashReady(cb)
    advance(1100)
    expect(cb).not.toHaveBeenCalled()
    advance(200)
    expect(cb).toHaveBeenCalledTimes(1)
    const cb2 = vi.fn()
    const cancel = whenLeashReady(cb2)
    cancel()
    advance(2000)
    expect(cb2).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
    delete (document as unknown as { readyState?: string }).readyState
  })

  it('R2-02-01: LCP + 300 ms ab dem letzten LCP-Kandidaten (startTime), spätere Kandidaten schieben nach hinten', () => {
    resetLeashSchedule()
    Object.defineProperty(document, 'readyState', { configurable: true, value: 'loading' })
    const g = globalThis as unknown as { PerformanceObserver: unknown }
    const orig = g.PerformanceObserver
    let deliver: ((startTime: number) => void) | null = null
    g.PerformanceObserver = class {
      constructor(cb: (list: { getEntries(): { startTime: number }[] }) => void) {
        deliver = (startTime) => cb({ getEntries: () => [{ startTime }] })
      }
      observe() {}
      disconnect() {}
    }
    try {
      const cb = vi.fn()
      const t0 = performance.now()
      whenLeashReady(cb)
      deliver!(t0 + 100) // erster Kandidat bei 100 ms → frühestens 400 ms
      advance(350)
      deliver!(t0 + 300) // größerer Kandidat bei 300 ms → frühestens 600 ms
      advance(200)
      expect(cb).not.toHaveBeenCalled()
      advance(100)
      expect(cb).toHaveBeenCalledTimes(1)
    } finally {
      g.PerformanceObserver = orig
      delete (document as unknown as { readyState?: string }).readyState
    }
  })
})

describe('leash/easing', () => {
  it('--ease-ink-out steigt monoton von 0 auf 1 und setzt schnell an', () => {
    let prev = 0
    for (let t = 0; t <= 1.0001; t += 0.05) {
      const v = easeInkOut(t)
      expect(v).toBeGreaterThanOrEqual(prev - 1e-9)
      prev = v
    }
    expect(easeInkOut(0)).toBe(0)
    expect(easeInkOut(1)).toBe(1)
    expect(easeInkOut(0.25)).toBeGreaterThan(0.5)
  })
})
