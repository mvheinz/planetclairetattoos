// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  BANG_STAGGER_MS,
  JOLT_MS,
  MAX_BANGS,
  SOLD_EVENT,
  STAMP_MS,
  mount,
  stampKeyframes,
} from '@/behaviors/sold-stamp'

import { installTracker, type Tracker } from './harness'

// P3.4 `sold-stamp` (DESIGN KO-06, MI-03; AK-DS-18): Knall nur beim Live-Wechsel auf `sold`, nie beim Laden.

let tracker: Tracker
let animated: { el: Element; keyframes: Keyframe[]; options: KeyframeAnimationOptions }[]

const card = (id: number, sold = false) =>
  `<li><a href="/de/shop/${id}" data-product-card data-product-id="${id}"><span data-price-tag="hanging"` +
  `${sold ? ' data-sold' : ''}><span data-price-tag-swing data-angle="3">${id} €` +
  `<span data-sold-stamp data-angle="-13" aria-hidden="true"${sold ? '' : ' hidden'}>sold</span>` +
  `</span></span></a></li>`

beforeEach(() => {
  vi.useFakeTimers()
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
  document.body.innerHTML = `<ul data-behavior="sold-stamp">${[1, 2, 3, 4, 5].map((id) => card(id, id === 5)).join('')}</ul>`
})

afterEach(() => {
  tracker.restore()
  vi.useRealTimers()
  document.documentElement.removeAttribute('data-motion')
  document.body.innerHTML = ''
})

const root = () => document.querySelector('[data-behavior="sold-stamp"]')!
const stampOf = (id: number) =>
  document.querySelector<HTMLElement>(`[data-product-id="${id}"] [data-sold-stamp]`)!
const sell = (id: number) => document.dispatchEvent(new CustomEvent(SOLD_EVENT, { detail: { id } }))

describe('MI-03 Stempel-Knall', () => {
  it('Keyframes: scale 1.8 / −22° / 0 → 60 %: scale 0.94 / −13° / 1 → scale 1 / −14°; nur transform/opacity', () => {
    const frames = stampKeyframes(-14, 'cubic-bezier(0.18, 1.6, 0.4, 1)')
    expect(frames.map((f) => [f.offset, f.transform, f.opacity])).toEqual([
      [0, 'rotate(-22deg) scale(1.8)', 0],
      [0.6, 'rotate(-13deg) scale(0.94)', 1],
      [1, 'rotate(-14deg) scale(1)', 1],
    ])
    for (const f of frames) {
      const props = Object.keys(f).filter((k) => !['offset', 'easing'].includes(k))
      expect(props.sort()).toEqual(['opacity', 'transform'])
    }
  })

  it('beim Laden (auch mit verkauften Stücken) keine Animation', () => {
    const unmount = mount(root(), { mode: 'app' })
    vi.runAllTimers()
    expect(document.getAnimations()).toEqual([])
    expect(stampOf(5).hidden).toBe(false)
    unmount()
  })

  it('Live-Wechsel auf sold: Stempel erscheint und knallt (260 ms), danach Schild-Ruck 80 ms (translateY 1.5 px)', () => {
    const unmount = mount(root(), { mode: 'app' })
    sell(2)
    expect(stampOf(2).hidden).toBe(false)
    expect(
      document.querySelector('[data-product-id="2"] [data-price-tag]')!.hasAttribute('data-sold'),
    ).toBe(true)
    vi.advanceTimersByTime(0)
    expect(animated).toHaveLength(1)
    expect(animated[0]!.el).toBe(stampOf(2))
    expect(animated[0]!.options.duration).toBe(STAMP_MS)
    expect(animated[0]!.keyframes[2]!.transform).toBe('rotate(-13deg) scale(1)')
    // Ende des Knalls → Ruck am Schild-Körper
    ;(document.getAnimations()[0] as unknown as { finish(): void }).finish()
    expect(animated).toHaveLength(2)
    expect(animated[1]!.options.duration).toBe(JOLT_MS)
    expect(animated[1]!.keyframes.map((k) => k.transform)).toEqual([
      'rotate(3deg) translateY(0)',
      'rotate(3deg) translateY(1.5px)',
      'rotate(3deg) translateY(0)',
    ])
    // schon sichtbarer Stempel knallt nicht nochmal
    sell(2)
    vi.runAllTimers()
    expect(animated).toHaveLength(2)
    unmount()
  })

  it('höchstens 3 Knalle je Seitenansicht, gestaffelt 120 ms; weitere Stempel erscheinen statisch', () => {
    const unmount = mount(root(), { mode: 'app' })
    for (const id of [1, 2, 3, 4]) sell(id)
    for (const id of [1, 2, 3, 4]) expect(stampOf(id).hidden).toBe(false)
    vi.advanceTimersByTime(0)
    expect(animated).toHaveLength(1)
    vi.advanceTimersByTime(BANG_STAGGER_MS)
    expect(animated).toHaveLength(2)
    vi.advanceTimersByTime(BANG_STAGGER_MS)
    expect(animated.map((a) => a.el)).toEqual([stampOf(1), stampOf(2), stampOf(3)])
    vi.runAllTimers()
    expect(animated.filter((a) => a.options.duration === STAMP_MS)).toHaveLength(MAX_BANGS)
    unmount()
  })

  it('prefers-reduced-motion: reduce → Stempel sofort statisch, document.getAnimations() leer', () => {
    document.documentElement.setAttribute('data-motion', 'reduced')
    const unmount = mount(root(), { mode: 'app' })
    sell(1)
    vi.runAllTimers()
    expect(stampOf(1).hidden).toBe(false)
    expect(document.getAnimations()).toEqual([])
    unmount()
  })

  it('AK-DS-18 unmount entfernt Listener, Observer, Timer und Animationen; preview ohne fetch/Cookie/Storage', () => {
    for (const [mode, id] of [
      ['app', 1],
      ['preview', 2],
    ] as const) {
      const unmount = mount(root(), { mode })
      sell(id)
      vi.advanceTimersByTime(0)
      sell(3)
      unmount()
      expect(tracker.openListeners()).toEqual([])
      expect(tracker.openObservers()).toEqual([])
      expect(vi.getTimerCount()).toBe(0)
      expect(document.getAnimations()).toEqual([])
    }
    expect(tracker.sensitive).toEqual([])
  })
})
