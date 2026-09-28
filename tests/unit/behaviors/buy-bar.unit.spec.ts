// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { mount, shouldShowBar } from '@/behaviors/buy-bar'

import { installTracker, type Tracker } from './harness'

// P3.10 `buy-bar` (DESIGN KO-09a; AK-DS-18): Kauf-Leiste erscheint, wenn der Hauptknopf nach oben aus dem Bild ist.

let tracker: Tracker
let callbacks: IntersectionObserverCallback[]
const Original = globalThis.IntersectionObserver

beforeEach(() => {
  callbacks = []
  const Tracked = class {
    constructor(cb: IntersectionObserverCallback) {
      callbacks.push(cb)
    }
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return []
    }
  }
  ;(globalThis as unknown as { IntersectionObserver: unknown }).IntersectionObserver = Tracked
  tracker = installTracker()
  document.body.innerHTML =
    '<span id="add-to-cart"><button type="button">In den Korb</button></span>' +
    '<div data-behavior="buy-bar" hidden><button type="button">In den Korb</button></div>'
})

afterEach(() => {
  tracker.restore()
  ;(globalThis as unknown as { IntersectionObserver: unknown }).IntersectionObserver = Original
  document.body.innerHTML = ''
})

const bar = () => document.querySelector<HTMLElement>('[data-behavior="buy-bar"]')!
const fire = (isIntersecting: boolean, top: number) =>
  callbacks.at(-1)!(
    [{ isIntersecting, boundingClientRect: { top } } as IntersectionObserverEntry],
    {} as IntersectionObserver,
  )

describe('KO-09a Kauf-Leiste', () => {
  it('shouldShowBar: nur wenn der Knopf nicht sichtbar und oberhalb ist', () => {
    expect(shouldShowBar(false, -40)).toBe(true)
    expect(shouldShowBar(false, 900)).toBe(false)
    expect(shouldShowBar(true, -10)).toBe(false)
  })

  it('blendet ein, wenn der Hauptknopf oben hinausläuft, und wieder aus; unsichtbar inert', () => {
    const unmount = mount(bar())
    expect(bar().hidden).toBe(false)
    expect(bar().hasAttribute('data-visible')).toBe(false)
    expect(bar().inert).toBe(true)
    fire(false, -120)
    expect(bar().hasAttribute('data-visible')).toBe(true)
    expect(bar().inert).toBe(false)
    expect(bar().getAttribute('aria-hidden')).toBe('false')
    fire(true, 300)
    expect(bar().hasAttribute('data-visible')).toBe(false)
    unmount()
    expect(bar().hidden).toBe(true)
  })

  it('AK-DS-18: unmount trennt den Observer; Modus preview ohne Netz/Storage', () => {
    const unmount = mount(bar(), { mode: 'preview' })
    fire(false, -1)
    unmount()
    expect(tracker.openObservers()).toEqual([])
    expect(tracker.openListeners()).toEqual([])
    expect(tracker.sensitive).toEqual([])
  })

  it('ohne Hauptknopf: nichts', () => {
    document.getElementById('add-to-cart')!.remove()
    const unmount = mount(bar())
    expect(bar().hidden).toBe(true)
    unmount()
  })
})
