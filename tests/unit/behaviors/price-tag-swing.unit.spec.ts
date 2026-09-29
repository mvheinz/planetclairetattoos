// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  ENTER_DELAY_MS,
  ROW_STAGGER_MS,
  SWING_MS,
  mount,
  swingKeyframes,
} from '@/behaviors/price-tag-swing'

import { installTracker, type Tracker } from './harness'

// P3.4 `price-tag-swing` (DESIGN KO-05, MI-02; AK-DS-18): Pendel um die Öse, nur `transform`, reduzierte Bewegung aus.

/** Steuerbarer IntersectionObserver (jsdom hat keinen). */
class FakeIO {
  static instances: FakeIO[] = []
  observed = new Set<Element>()
  constructor(private readonly cb: IntersectionObserverCallback) {
    FakeIO.instances.push(this)
  }
  observe(el: Element) {
    this.observed.add(el)
  }
  unobserve(el: Element) {
    this.observed.delete(el)
  }
  disconnect() {
    this.observed.clear()
  }
  takeRecords() {
    return []
  }
  enter(els: Element[], top = (i: number) => 100 + Math.floor(i / 2) * 300) {
    this.cb(
      els.map((target, i) => ({
        target,
        isIntersecting: true,
        boundingClientRect: { top: top(i), left: (i % 2) * 200 } as DOMRectReadOnly,
      })) as unknown as IntersectionObserverEntry[],
      this as unknown as IntersectionObserver,
    )
  }
}

let tracker: Tracker
let animated: { el: Element; keyframes: Keyframe[]; options: KeyframeAnimationOptions }[]

beforeEach(() => {
  vi.useFakeTimers()
  FakeIO.instances = []
  vi.stubGlobal('IntersectionObserver', FakeIO)
  tracker = installTracker()
  animated = []
  const trackedAnimate = Element.prototype.animate
  Element.prototype.animate = function (keyframes, options) {
    animated.push({
      el: this,
      keyframes: keyframes as Keyframe[],
      options: options as KeyframeAnimationOptions,
    })
    return trackedAnimate.call(this, keyframes, options)
  }
  document.body.innerHTML =
    '<ul data-behavior="price-tag-swing">' +
    [4, -3, 2.5, -4]
      .map(
        (a, i) =>
          `<li><a href="/de/shop/0${i}" data-product-card><span data-price-tag="hanging">` +
          `<span data-price-tag-swing data-angle="${a}">${i} €</span></span><span>Titel</span></a></li>`,
      )
      .join('') +
    '</ul>'
})

afterEach(() => {
  tracker.restore()
  vi.useRealTimers()
  document.documentElement.removeAttribute('data-motion')
  document.body.innerHTML = ''
})

const root = () => document.querySelector('[data-behavior="price-tag-swing"]')!
const tags = () => [...document.querySelectorAll('[data-price-tag-swing]')]
const cards = () => [...document.querySelectorAll('[data-product-card]')]

describe('MI-02 Schwingen', () => {
  it('Keyframes a → a+5° → a−3.5° → a+1.5° → a bei 0/20/45/70/100 %, nur transform, --ease-swing je Teilstück', () => {
    const frames = swingKeyframes(4, 'cubic-bezier(0.45, 0, 0.55, 1)')
    expect(frames.map((f) => f.offset)).toEqual([0, 0.2, 0.45, 0.7, 1])
    expect(frames.map((f) => f.transform)).toEqual([
      'rotate(4deg)',
      'rotate(9deg)',
      'rotate(0.5deg)',
      'rotate(5.5deg)',
      'rotate(4deg)',
    ])
    for (const f of frames) {
      const props = Object.keys(f).filter((k) => !['offset', 'easing'].includes(k))
      expect(props).toEqual(['transform'])
    }
    expect(frames.slice(0, -1).every((f) => f.easing === 'cubic-bezier(0.45, 0, 0.55, 1)')).toBe(
      true,
    )
  })

  it('Reihe tritt in den Sichtbereich: nach dem Zeichnen der Schnur (500 ms) schwingen die Schilder der Reihe 60 ms versetzt', () => {
    const unmount = mount(root(), { mode: 'app' })
    const io = FakeIO.instances[0]!
    expect(io.observed.size).toBe(4)
    io.enter(tags())
    expect(animated).toHaveLength(0)
    vi.advanceTimersByTime(ENTER_DELAY_MS)
    // erste Karte jeder Reihe (Reihe 1: Karte 0, Reihe 2: Karte 2)
    expect(animated.map((a) => tags().indexOf(a.el))).toEqual([0, 2])
    vi.advanceTimersByTime(ROW_STAGGER_MS)
    expect(animated.map((a) => tags().indexOf(a.el))).toEqual([0, 2, 1, 3])
    expect(animated[0]!.options.duration).toBe(SWING_MS)
    // einmalig: beobachtet wird danach nichts mehr
    expect(io.observed.size).toBe(0)
    unmount()
  })

  it('Hover mit feinem Zeiger und Fokus der Karte lösen das Schwingen aus; Touch nicht; nie doppelt gleichzeitig', () => {
    const unmount = mount(root(), { mode: 'app' })
    const [first, second] = cards()
    first!.dispatchEvent(new PointerEvent('pointerover', { bubbles: true, pointerType: 'touch' }))
    expect(animated).toHaveLength(0)
    first!.dispatchEvent(new PointerEvent('pointerover', { bubbles: true, pointerType: 'mouse' }))
    expect(animated).toHaveLength(1)
    first!.dispatchEvent(new PointerEvent('pointerover', { bubbles: true, pointerType: 'mouse' }))
    expect(animated).toHaveLength(1)
    second!.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
    expect(animated.map((a) => tags().indexOf(a.el))).toEqual([0, 1])
    unmount()
  })

  it('prefers-reduced-motion: reduce → document.getAnimations() leer, auch nach Eintritt, Hover und Fokus', () => {
    document.documentElement.setAttribute('data-motion', 'reduced')
    const unmount = mount(root(), { mode: 'app' })
    FakeIO.instances[0]!.enter(tags())
    cards()[0]!.dispatchEvent(
      new PointerEvent('pointerover', { bubbles: true, pointerType: 'mouse' }),
    )
    cards()[1]!.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
    vi.advanceTimersByTime(ENTER_DELAY_MS + 4 * ROW_STAGGER_MS)
    expect(document.getAnimations()).toEqual([])
    unmount()
  })

  it('Wechsel auf reduzierte Bewegung stoppt laufende Schwünge und geplante Timer', async () => {
    const unmount = mount(root(), { mode: 'app' })
    FakeIO.instances[0]!.enter(tags())
    cards()[0]!.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
    expect(document.getAnimations()).toHaveLength(1)
    document.documentElement.setAttribute('data-motion', 'reduced')
    await Promise.resolve()
    expect(document.getAnimations()).toEqual([])
    expect(vi.getTimerCount()).toBe(0)
    unmount()
  })

  it('AK-DS-18 unmount entfernt Listener, Observer, Timer und Animationen; preview ohne fetch/Cookie/Storage', () => {
    for (const mode of ['app', 'preview'] as const) {
      const unmount = mount(root(), { mode })
      FakeIO.instances.at(-1)!.enter(tags())
      cards()[0]!.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
      unmount()
      expect(tracker.openListeners()).toEqual([])
      expect(tracker.openObservers()).toEqual([])
      expect(vi.getTimerCount()).toBe(0)
      expect(document.getAnimations()).toEqual([])
    }
    expect(tracker.sensitive).toEqual([])
  })
})
