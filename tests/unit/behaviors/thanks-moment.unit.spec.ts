// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { BREATHE_MS, HEART_MS, LINE_MS, mount } from '@/behaviors/thanks-moment'
import { SOLD_EVENT } from '@/behaviors/types'

import { installTracker, type Tracker } from './harness'

// P4.17 – `thanks-moment` (DESIGN KO-19, MI-09 Grundfassung): Coco rollt sich ein, Stempel-Knall-Ereignis je Stück,
// Gesamtablauf ≤ 5 s; reduzierte Bewegung = sofort Endzustand; unmount räumt auf (AK-DS-18).

let tracker: Tracker

function root(): HTMLElement {
  document.body.innerHTML =
    '<div data-behavior="thanks-moment"><div class="coco" data-thanks-coco data-pose="sitzen" data-boil="off">' +
    '<div class="coco__hop"><svg><use class="f f-a" href="/art/c.svg#coco-sitzen-a"></use>' +
    '<use class="f f-b" href="/art/c.svg#coco-sitzen-b"></use><use class="f f-c" href="/art/c.svg#coco-sitzen-c"></use>' +
    '</svg></div></div><ul><li data-product-id="17"><span data-price-tag="mini">' +
    '<span data-sold-stamp hidden>sold</span></span></li><li data-product-id="18"><span data-price-tag="mini">' +
    '<span data-sold-stamp hidden>sold</span></span></li></ul></div>'
  return document.querySelector<HTMLElement>('[data-behavior="thanks-moment"]')!
}

beforeEach(() => {
  vi.useFakeTimers()
  tracker = installTracker()
})
afterEach(() => {
  tracker.restore()
  vi.useRealTimers()
  document.documentElement.removeAttribute('data-motion')
  document.body.innerHTML = ''
})

describe('thanks-moment', () => {
  it('MI-09: nach Linie + Herz schläft Coco, Knall-Ereignis je Stück, Ende nach ≤ 5 s', () => {
    const sold: string[] = []
    const onSold = (e: Event) => sold.push(String((e as CustomEvent).detail.id))
    document.addEventListener(SOLD_EVENT, onSold)
    const el = root()
    const unmount = mount(el, { mode: 'app' })
    const coco = el.querySelector<HTMLElement>('[data-thanks-coco]')!
    expect(coco.getAttribute('data-pose')).toBe('sitzen')
    vi.advanceTimersByTime(LINE_MS + HEART_MS)
    expect(sold).toEqual(['17', '18'])
    vi.advanceTimersByTime(400)
    expect(coco.getAttribute('data-pose')).toBe('schlafen')
    expect(coco.hasAttribute('data-breathe')).toBe(true)
    vi.advanceTimersByTime(BREATHE_MS)
    expect(coco.hasAttribute('data-breathe')).toBe(false)
    expect(el.hasAttribute('data-thanks-done')).toBe(true)
    expect(LINE_MS + HEART_MS + 400 + BREATHE_MS).toBeLessThanOrEqual(5000)
    unmount()
    document.removeEventListener(SOLD_EVENT, onSold)
    expect(tracker.openListeners()).toEqual([])
    expect(vi.getTimerCount()).toBe(0)
  })

  it('reduzierte Bewegung: sofort Endzustand (Coco schläft, Stempel statisch), kein Timer', () => {
    document.documentElement.setAttribute('data-motion', 'reduced')
    const el = root()
    const unmount = mount(el, { mode: 'app' })
    expect(el.querySelector('[data-thanks-coco]')!.getAttribute('data-pose')).toBe('schlafen')
    for (const s of Array.from(el.querySelectorAll<HTMLElement>('[data-sold-stamp]')))
      expect(s.hidden).toBe(false)
    expect(el.hasAttribute('data-thanks-done')).toBe(true)
    expect(vi.getTimerCount()).toBe(0)
    unmount()
    expect(tracker.openObservers()).toEqual([])
  })

  it('Umschalten auf reduziert während des Ablaufs springt in den Endzustand', async () => {
    const el = root()
    const unmount = mount(el, { mode: 'app' })
    vi.advanceTimersByTime(200)
    document.documentElement.setAttribute('data-motion', 'reduced')
    await Promise.resolve()
    expect(el.hasAttribute('data-thanks-done')).toBe(true)
    expect(el.querySelector('[data-thanks-coco]')!.getAttribute('data-pose')).toBe('schlafen')
    unmount()
    expect(vi.getTimerCount()).toBe(0)
  })
})
