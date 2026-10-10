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
import { COCO_MAX_SPEED, COCO_WALK_SPEED, READING_LINE } from '@/leash/presets'
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

const STATIONS = `
        <div data-leash-station="hallo" data-leash-pose="sit" data-leash-loop="right" data-rect="60,700,24,24"></div>
        <div data-leash-station="keramik" data-leash-pose="sniff" data-leash-loop="left" data-rect="60,1500,24,24"></div>
        <div data-leash-station="zeichnungen" data-leash-loop="spiral" data-rect="60,2400,24,24"></div>`

/** Seitencontainer mit Linien-Ebene, Inhalt mit Rinne und drei Stationen; Rechtecke über `data-rect`. */
function setupDom(stations = STATIONS): HTMLElement {
  document.body.innerHTML = `
    <div class="page" data-rect="0,0,390,${PAGE_H}">
      <div data-leash-layer aria-hidden="true" data-rect="0,0,390,${PAGE_H}"></div>
      <main><div class="u-container" data-rect="0,0,390,${PAGE_H}">${stations}
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
  it('baut Segmente in Stufe A (Strich-Stücke ohne Maske), zeichnet beim Scrollen und wickelt beim Hochscrollen auf (§9.4, §9.6, U-74)', () => {
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
      // runde Enden, Farbe und Dash-Muster aus global.css (`[data-leash-seg].lx`), am Segment nur der Versatz
      expect(p.closest('svg')!.getAttribute('class')).toBe('lx')
      expect(p.closest('svg')!.getAttribute('stroke-dashoffset')).not.toBeNull()
      expect(p.hasAttribute('stroke-dasharray')).toBe(false)
    }
    // Lage inline, Rest aus global.css; die Ebene ist aria-hidden (PF-10)
    for (const svg of svgs) expect(svg.style.left).toMatch(/px$/)

    // Intro (journey) von 0 bis zur Lesezeile in 1800 ms (U-06: doppelt so langsam)
    expect(handle.inspect().drawnLen).toBe(0)
    advance(2000)
    const afterIntro = handle.inspect().drawnLen
    expect(afterIntro).toBeGreaterThan(0)

    setScroll(1200)
    advance(20)
    const down = handle.inspect().drawnLen
    expect(down).toBeGreaterThan(afterIntro)
    setScroll(700)
    // Coco läuft geglättet auf der Linie zurück, die Leine wickelt sich mit ihr auf (U-74) – nie über sie hinaus
    for (let i = 0; i < 60; i++) {
      advance(16)
      expect(handle.inspect().drawnLen).toBeLessThanOrEqual(handle.inspect().cocoLen + 0.01)
    }
    expect(handle.inspect().cocoLen).toBeLessThan(down)
    expect(handle.inspect().drawnLen).toBeCloseTo(handle.inspect().cocoLen, 1)
    // zurückgewickelte Stücke wieder verborgen: hinter der Feder kein sichtbares Stück
    const hidden = handle
      .inspect()
      .geometry!.segments.filter((g) => g.len0 > handle.inspect().drawnLen)
    for (const g of hidden)
      expect(
        (root.querySelector(`[data-leash-seg="${g.id}"]`) as SVGSVGElement | null)?.style
          .visibility ?? 'hidden',
      ).toBe('hidden')

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
    // U-74: mit Coco endet die Leine nach dem Umschalten bei ihr (Lesezeile), nicht mehr vollständig
    expect(handle.inspect().drawnLen).toBeCloseTo(handle.inspect().cocoLen, 1)
    expect(handle.inspect().drawnLen).toBeLessThan(handle.inspect().geometry!.totalLength)
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
    expect(s.cocoLen).toBe(s.geometry!.stations[0]!.loopLen1 + 48)
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

  it('setMotion: reduziert → Linie sofort vollständig ohne Intro; zurück → Leine endet bei Coco (U-74)', () => {
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
    expect(s.drawnLen).toBeCloseTo(s.cocoLen, 1)
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
    advance(2000) // Intro (1800 ms, U-06) ist vorbei
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

describe('U-55 Coco und Tinte mit Höchsttempo (P14.6)', () => {
  it('Coco rückt je Frame höchstens COCO_MAX_SPEED × dt vor; die Linie wächst nie schneller als Coco', () => {
    const root = setupDom()
    const handle = mountLeash(root, { preset: 'journey', routeKey: 'R01' })
    const off = exposeLeashDebug(handle)
    const api = (
      window as Window & {
        __leash?: {
          cocoLen(): number
          drawnLen(): number
          setReadingY(y: number | null): void
          geometry: { scrollMap: { readingY: number; len: number }[] }
        }
      }
    ).__leash!
    advance(2000) // Intro vorbei
    // Ziel knapp unter der Sprung-Schwelle (300 px Bogen): Coco rennt, aber gedeckelt
    const start = api.cocoLen()
    const sm = api.geometry.scrollMap
    const want = start + 280
    const k = sm.findIndex((r) => r.len >= want)
    const a = sm[k - 1]!
    const b = sm[k]!
    api.setReadingY(a.readingY + ((want - a.len) / (b.len - a.len)) * (b.readingY - a.readingY))
    let prev = api.cocoLen()
    let prevDrawn = api.drawnLen()
    let maxStep = 0
    let maxInk = 0
    for (let i = 0; i < 60; i++) {
      advance(16)
      maxStep = Math.max(maxStep, api.cocoLen() - prev)
      maxInk = Math.max(maxInk, api.drawnLen() - prevDrawn)
      prev = api.cocoLen()
      prevDrawn = api.drawnLen()
    }
    expect(maxStep).toBeGreaterThan(0)
    // ein Frame dauert in den Tests 16–17 ms (Raster der Fake-Timer)
    expect(maxStep).toBeLessThanOrEqual(COCO_MAX_SPEED * 17 + 0.01)
    expect(maxInk).toBeLessThanOrEqual(COCO_MAX_SPEED * 17 + 0.01)
    expect(api.cocoLen()).toBeGreaterThan(start + 250) // kommt trotzdem an
    off()
    handle.destroy()
  })
})

describe('U-68 Coco läuft eine beim Laden begonnene Schlaufe allein und ruhig zu Ende (P15.1)', () => {
  it('Intro zeichnet nur bis zum Schlaufenanfang; danach läuft Coco im Schritttempo ohne Sprung bis ans Ende', () => {
    // Umrundung beginnt über der Lesezeile beim Laden (0,72 × 844 ≈ 608 px) – wie die Kategorie-Bilder im Shop
    const root = setupDom(`
        <div data-leash-station="kategorien" data-leash-loop="contour" data-rect="60,480,200,160"></div>
        <div data-leash-station="keramik" data-leash-loop="left" data-rect="60,1500,24,24"></div>`)
    const handle = mountLeash(root, { preset: 'journey', routeKey: 'R02' })
    const off = exposeLeashDebug(handle)
    const api = (
      window as Window & {
        __leash?: {
          cocoLen(): number
          drawnLen(): number
          geometry: {
            stations: { id: string; loopLen0: number; loopLen1: number }[]
            scrollMap: { readingY: number; len: number }[]
          }
        }
      }
    ).__leash!
    const s = api.geometry.stations.find((x) => x.id === 'kategorien')!
    expect(s.loopLen1 - s.loopLen0).toBeGreaterThan(300) // länger als die Sprung-Schwelle
    // Die Scroll-Abbildung legt das Schlaufenende auf die Lesezeile beim Laden: ohne Scrollen ist das Ziel das Ende
    const last = api.geometry.scrollMap.find((p) => Math.abs(p.len - s.loopLen1) < 0.5)!
    expect(last.readingY).toBeLessThanOrEqual(READING_LINE * VIEW.h + 1)
    // Intro (1800 ms ab dem ersten Frame): kurz vor seinem Ende fast am Schlaufenanfang, nie darüber hinaus
    let introMax = 0
    for (let t = 0; t < 1750; t += 16) {
      advance(16)
      introMax = Math.max(introMax, api.drawnLen())
    }
    expect(introMax).toBeLessThanOrEqual(s.loopLen0 + 0.5)
    expect(introMax).toBeGreaterThan(s.loopLen0 - 10)
    advance(100)
    let prev = api.cocoLen()
    let maxStep = 0
    let maxLead = 0
    for (let i = 0; i < 600 && api.cocoLen() < s.loopLen1 - 0.5; i++) {
      advance(16)
      maxStep = Math.max(maxStep, api.cocoLen() - prev)
      maxLead = Math.max(maxLead, api.drawnLen() - api.cocoLen())
      prev = api.cocoLen()
    }
    expect(api.cocoLen()).toBeGreaterThan(s.loopLen1 - 0.5) // kommt an
    expect(maxStep).toBeGreaterThan(0)
    expect(maxStep).toBeLessThanOrEqual(COCO_WALK_SPEED * 17 + 0.01) // kein Rennen, kein Sprung
    expect(maxLead).toBeLessThanOrEqual(0.5) // die Tinte läuft hinter Coco her
    off()
    handle.destroy()
  })

  it('wer dabei scrollt, bekommt wieder das normale Höchsttempo; Sprünge erst nach der Schlaufe', () => {
    const root = setupDom(`
        <div data-leash-station="kategorien" data-leash-loop="contour" data-rect="60,480,200,160"></div>
        <div data-leash-station="keramik" data-leash-loop="left" data-rect="60,1500,24,24"></div>`)
    const handle = mountLeash(root, { preset: 'journey', routeKey: 'R02' })
    const off = exposeLeashDebug(handle)
    const api = (window as Window & { __leash?: { cocoLen(): number } }).__leash!
    advance(1900)
    let prev = api.cocoLen()
    let maxStep = 0
    for (let i = 0; i < 20; i++) {
      setScroll(scrollY + 40)
      advance(16)
      maxStep = Math.max(maxStep, api.cocoLen() - prev)
      prev = api.cocoLen()
    }
    expect(maxStep).toBeGreaterThan(COCO_WALK_SPEED * 17)
    expect(maxStep).toBeLessThanOrEqual(COCO_MAX_SPEED * 17 + 0.01)
    off()
    handle.destroy()
  })
})

describe('U-68 Randfälle aus der Prüfung (P15.1)', () => {
  const CONTOUR = `
        <div data-leash-station="kategorien" data-leash-loop="contour" data-rect="60,480,200,160"></div>
        <div data-leash-station="keramik" data-leash-loop="left" data-rect="60,1500,24,24"></div>`
  type Api = {
    cocoLen(): number
    drawnLen(): number
    setReadingY(y: number | null): void
    geometry: {
      stations: { id: string; loopLen0: number; loopLen1: number }[]
      scrollMap: { readingY: number; len: number }[]
    }
  }
  const api = () => (window as Window & { __leash?: Api }).__leash!
  const loop = () => api().geometry.stations.find((x) => x.id === 'kategorien')!

  it('Scrollen während des Intros: weder Tinte noch Coco springen über die Umrundung', () => {
    const handle = mountLeash(setupDom(CONTOUR), { preset: 'journey', routeKey: 'R02' })
    const off = exposeLeashDebug(handle)
    advance(800)
    let prev = { c: api().cocoLen(), d: api().drawnLen() }
    let maxC = 0
    let maxD = 0
    for (let i = 0; i < 40; i++) {
      if (i < 5) setScroll(scrollY + 40)
      advance(16)
      maxC = Math.max(maxC, api().cocoLen() - prev.c)
      maxD = Math.max(maxD, api().drawnLen() - prev.d)
      prev = { c: api().cocoLen(), d: api().drawnLen() }
    }
    expect(maxD).toBeLessThanOrEqual(60) // vorher ≈ 900 px in einem Bild
    expect(maxC).toBeLessThanOrEqual(60)
    expect(api().drawnLen()).toBeLessThanOrEqual(loop().loopLen1)
    off()
    handle.destroy()
  })

  it('Laden mit 1–7 px Scroll oder auf hohem Bildschirm: das Intro endet trotzdem am Anfang der Umrundung', () => {
    for (const [y, h] of [
      [3, VIEW.h],
      [0, 1400],
    ] as const) {
      scrollY = y
      Object.defineProperty(window, 'innerHeight', { configurable: true, value: h })
      const handle = mountLeash(setupDom(CONTOUR), { preset: 'journey', routeKey: 'R02' })
      const off = exposeLeashDebug(handle)
      let introMax = 0
      for (let t = 0; t < 1750; t += 16) {
        advance(16)
        introMax = Math.max(introMax, api().drawnLen())
      }
      expect(introMax, `scrollY ${y}, Höhe ${h}`).toBeLessThanOrEqual(loop().loopLen0 + 0.5)
      advance(6000)
      expect(api().cocoLen()).toBeGreaterThanOrEqual(loop().loopLen1 - 0.5) // Coco läuft sie danach allein
      off()
      handle.destroy()
      Object.defineProperty(window, 'innerHeight', { configurable: true, value: VIEW.h })
      scrollY = 0
    }
  })

  it('Neuaufbau im Alleingang nach weitem Scrollen: kein Kriechen bis zur Lesezeile, Coco holt per Sprung auf', () => {
    const handle = mountLeash(setupDom(CONTOUR), { preset: 'journey', routeKey: 'R02' })
    const off = exposeLeashDebug(handle)
    advance(1900)
    setScroll(2400)
    advance(50)
    handle.rebuild()
    // Rest der Umrundung (< 1 000 px) im Schritttempo, danach Sprung zur Lesezeile – vorher ≈ 5,6 s Kriechen bis dorthin
    advance(2600)
    expect(api().cocoLen()).toBeGreaterThan(loop().loopLen1 + 1500)
    expect(Math.abs(api().cocoLen() - api().drawnLen())).toBeLessThan(1)
    off()
    handle.destroy()
  })

  it('angekommen ist angekommen: danach gilt wieder die Sprung-Regel (Lesezeile von Hand gesetzt)', () => {
    const handle = mountLeash(setupDom(CONTOUR), { preset: 'journey', routeKey: 'R02' })
    const off = exposeLeashDebug(handle)
    advance(1900 + 6000)
    expect(api().cocoLen()).toBeGreaterThanOrEqual(loop().loopLen1 - 0.5)
    api().setReadingY(0)
    advance(450)
    const s = loop()
    const sm = api().geometry.scrollMap
    const k = sm.findIndex((p) => p.len >= s.loopLen0 + 400)
    api().setReadingY(sm[k]!.readingY)
    advance(50)
    expect(api().cocoLen()).toBeGreaterThan(s.loopLen0 + 350) // gesprungen, nicht gekrochen
    off()
    handle.destroy()
  })

  it('Neuaufbau, bevor der erste Aufbau fertig ist (z. B. `load`): Intro und Alleingang fallen nicht aus', () => {
    const w = window as Window & {
      requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number
      cancelIdleCallback?: (id: number) => void
    }
    w.requestIdleCallback = (cb) => setTimeout(cb, 1) as unknown as number
    w.cancelIdleCallback = (id) => clearTimeout(id)
    try {
      const handle = mountStepwise(setupDom(CONTOUR), { preset: 'journey', routeKey: 'R02' })
      advance(2) // erster Aufbau läuft in Idle-Teilstücken …
      handle.rebuild() // … und wird durch einen Neuaufbau ersetzt (wie nach `load` oder späten Bildern)
      const built = vi.fn()
      handle.whenBuilt(built)
      for (let i = 0; i < 200 && !built.mock.calls.length; i++) advance(2)
      expect(built).toHaveBeenCalledTimes(1)
      const off = exposeLeashDebug(handle)
      const s = loop()
      expect(api().drawnLen()).toBeLessThan(s.loopLen0) // Intro läuft, nicht sofort fertig gezeichnet
      advance(1800)
      expect(api().drawnLen()).toBeLessThanOrEqual(s.loopLen0 + 30)
      off()
      handle.destroy()
    } finally {
      Reflect.deleteProperty(w, 'requestIdleCallback')
      Reflect.deleteProperty(w, 'cancelIdleCallback')
    }
  })

  it('404 (einmalige Zeichnung, Schlusskringel): zeichnet weiter in einem Zug bis zum Ende', () => {
    document.body.innerHTML = `
      <div class="page" data-rect="0,0,390,900">
        <div data-leash-layer aria-hidden="true" data-rect="0,0,390,900"></div>
        <main><div data-rect="0,0,390,900">
          <div data-leash-anchor="end" data-leash-loop="coil" data-rect="160,480,60,10"></div>
        </div></main>
      </div>`
    const root = document.querySelector<HTMLElement>('[data-leash-layer]')!
    const handle = mountLeash(root, { preset: 'lost', routeKey: 'R28' })
    const off = exposeLeashDebug(handle)
    advance(1400 + 120)
    expect(api().drawnLen()).toBeGreaterThan(0)
    expect(root.hasAttribute('data-leash-drawn')).toBe(true)
    off()
    handle.destroy()
  })
})

describe('U-74 Leine wickelt sich beim Hochscrollen auf (P15.4)', () => {
  /** Wirksamer Versatz eines Stücks: eigener Wert, sonst der vom `<svg>` geerbte. */
  const offsetOf = (p: SVGPathElement) =>
    parseFloat(
      p.getAttribute('stroke-dashoffset') ??
        p.closest('svg')!.getAttribute('stroke-dashoffset') ??
        'NaN',
    )

  it('Stufe A: nach dem Zurückwickeln ist hinter der Feder kein Stück mehr sichtbar (auch aus fertigen Segmenten)', () => {
    scrollY = 2600
    const root = setupDom()
    const handle = mountLeash(root, { preset: 'journey', routeKey: 'R01' })
    advance(50)
    setScroll(2700)
    advance(50)
    setScroll(700)
    advance(1500)
    const s = handle.inspect()
    expect(s.drawnLen).toBeCloseTo(s.cocoLen, 1)
    const segs = s.geometry!.segments
    for (const seg of segs) {
      const svg = root.querySelector<SVGSVGElement>(`[data-leash-seg="${seg.id}"]`)!
      if (svg.style.visibility === 'hidden') continue
      const paths = [...svg.querySelectorAll<SVGPathElement>('path')]
      seg.strokes!.forEach((st, i) => {
        if (st.len0 > s.drawnLen + 1)
          expect(offsetOf(paths[i]!), `${seg.id}#${i}`).toBeGreaterThanOrEqual(2000)
      })
    }
    // wieder hinunter: die Leine wächst wieder bis zu Coco, fertige Stücke sichtbar
    setScroll(2600)
    advance(2000)
    const d = handle.inspect()
    expect(d.drawnLen).toBeGreaterThan(s.drawnLen + 500)
    expect(d.drawnLen).toBeCloseTo(d.cocoLen, 1)
    handle.destroy()
  })

  it('Hochscrollen während des Intros: das Intro endet, die Linie läuft nie vor Coco her', () => {
    const root = setupDom()
    const handle = mountLeash(root, { preset: 'journey', routeKey: 'R01' })
    advance(300)
    setScroll(1600)
    advance(600)
    setScroll(200)
    for (let i = 0; i < 150; i++) {
      advance(16)
      if (i > 20)
        expect(handle.inspect().drawnLen).toBeLessThanOrEqual(handle.inspect().cocoLen + 0.5)
    }
    handle.destroy()
  })

  it('Neuaufbau mit Coco: die Linie endet bei ihr (kein Rest vor ihr); ohne Coco bleibt der Fortschritt', () => {
    const root = setupDom()
    const handle = mountLeash(root, { preset: 'journey', routeKey: 'R01' })
    advance(2000)
    setScroll(1300)
    advance(1500)
    setScroll(400)
    advance(1500)
    handle.rebuild()
    advance(50)
    expect(handle.inspect().drawnLen).toBeCloseTo(handle.inspect().cocoLen, 1)
    handle.destroy()
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
