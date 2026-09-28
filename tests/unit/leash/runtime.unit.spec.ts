// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { exposeLeashDebug } from '@/leash/debug'
import { easeInkOut } from '@/leash/easing'
import { mountLeash, type InspectableLeashHandle } from '@/leash/runtime'
import { resetLeashSchedule, whenLeashReady } from '@/leash/schedule'

import { installTracker, type Tracker } from '../behaviors/harness'

// P2.16 Laufzeit der Tuschelinie unter jsdom (DESIGN §9.4, §9.6, §9.10, §9.12 AK-DS-18).

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
  it('baut Segmente in Stufe A (Maske) und zeichnet beim Scrollen monoton (§9.4, §9.6)', () => {
    const root = setupDom()
    const handle = mountLeash(root, { preset: 'journey', routeKey: 'R01' })
    const state = handle.inspect()
    expect(state.tier).toBe('A')
    expect(state.geometry!.segments.length).toBeGreaterThan(0)
    const svgs = root.querySelectorAll('svg')
    expect(svgs.length).toBe(state.geometry!.segments.length)
    expect(root.querySelectorAll('mask').length).toBe(svgs.length)
    for (const svg of svgs) expect(svg.getAttribute('focusable')).toBe('false')

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

    // Fertige Segmente verlieren die Maske, zukünftige sind unsichtbar
    const ink = [...root.querySelectorAll<SVGPathElement>('path.ink')]
    expect(ink.some((p) => !p.hasAttribute('mask'))).toBe(true)
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
      const out = root.querySelector('path.ink')!.getAttribute('d')
      h.destroy()
      return out
    }
    expect(d('R20')).toBe(d('R20'))
    expect(d('R20')).not.toBe(d('R99'))
  })

  it('onCoco meldet Position der Leinenspitze aus der LUT', () => {
    const root = setupDom()
    const coco = vi.fn()
    const handle = mountLeash(root, { preset: 'margin', routeKey: 'R20', onCoco: coco })
    setScroll(800)
    advance(500)
    const last = coco.mock.calls.at(-1)![0]
    expect(last.len).toBeCloseTo(handle.inspect().cocoLen, 5)
    expect(Number.isFinite(last.x) && Number.isFinite(last.y)).toBe(true)
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
