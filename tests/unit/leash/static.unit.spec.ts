// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { mountStaticLeash, quietLine } from '@/leash/static'

import { installTracker, type Tracker } from '../behaviors/harness'

// P2.17 statischer Renderer (DESIGN §9.4 Stufe C, §9.7 `legal`/`calm`, §9.12 AK-DS-18).

let tracker: Tracker

function setupDom(main: string): HTMLElement {
  document.body.innerHTML = `
    <div class="page" data-rect="0,0,390,2000">
      <div data-leash-layer aria-hidden="true" data-rect="0,0,390,2000"></div>
      <main>${main}</main>
    </div>`
  return document.querySelector<HTMLElement>('[data-leash-layer]')!
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  tracker = installTracker()
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: false,
    media: q,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
  Element.prototype.getBoundingClientRect = function () {
    const [x, y, w, h] = (this.getAttribute('data-rect') ?? '0,0,0,0').split(',').map(Number) as [
      number,
      number,
      number,
      number,
    ]
    return {
      x,
      y,
      left: x,
      top: y,
      width: w,
      height: h,
      right: x + w,
      bottom: y + h,
      toJSON: () => ({}),
    } as DOMRect
  }
})

afterEach(() => {
  tracker.restore()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

describe('leash/static – Stufe C ohne Laufzeit', () => {
  it('legal: ruhige Randlinie in der Rinne, vollständig, ohne Maske, aria-hidden', () => {
    const root = setupDom(
      '<div class="u-container" data-rect="16,0,358,1500"><h1>Impressum</h1></div>',
    )
    const handle = mountStaticLeash(root, { preset: 'legal', routeKey: 'R21' })
    const s = handle.inspect()
    expect(s.tier).toBe('C')
    expect(s.pose).toBeNull()
    expect(s.geometry!.segments).toHaveLength(1)
    expect(s.drawnLen).toBe(s.geometry!.totalLength)
    expect(s.geometry!.totalLength).toBeCloseTo(1500, 0)
    const svg = root.querySelector('svg')!
    expect(svg.getAttribute('aria-hidden')).toBe('true')
    expect(svg.getAttribute('focusable')).toBe('false')
    expect(root.querySelectorAll('mask, [mask]')).toHaveLength(0)
    const path = root.querySelector('path.ink')!
    expect(path.getAttribute('d')).toMatch(/^M[\d.\s-]+L.*Z$/)
    // x = Rinnenmitte − 1 (Standard-Rinne 16 px) ± Wackel
    const lut = s.geometry!.lut
    for (let i = 0; i < lut.length; i += 4) expect(Math.abs(lut[i + 1]! - (16 + 7))).toBeLessThan(1)
    handle.destroy()
  })

  it('calm: Unterstreichung der H1, sonst nichts; ohne H1 keine Linie', () => {
    let root = setupDom('<h1 data-rect="20,40,200,40">Vertrag widerrufen</h1>')
    let handle = mountStaticLeash(root, { preset: 'calm', routeKey: 'R26' })
    const g = handle.inspect().geometry!
    expect(g.totalLength).toBeCloseTo(212, 0)
    expect(g.lut[2]).toBeCloseTo(86, 0)
    handle.destroy()
    root = setupDom('<p>ohne Überschrift</p>')
    handle = mountStaticLeash(root, { preset: 'calm', routeKey: 'R26' })
    expect(handle.inspect().geometry).toBeNull()
    expect(root.children).toHaveLength(0)
    handle.destroy()
  })

  it('deterministisch je Route; Breite in [0,8; 1,35] × Grundbreite (§9.3)', () => {
    const a = quietLine({ x: 7, y: 0 }, { x: 7, y: 800 }, 1.25, 42)
    const b = quietLine({ x: 7, y: 0 }, { x: 7, y: 800 }, 1.25, 42)
    const c = quietLine({ x: 7, y: 0 }, { x: 7, y: 800 }, 1.25, 43)
    expect(a.segments[0]!.outlineD).toBe(b.segments[0]!.outlineD)
    expect(a.segments[0]!.outlineD).not.toBe(c.segments[0]!.outlineD)
    expect(a.segments[0]!.bbox.w).toBeLessThanOrEqual(1.35 * 1.25 + 2 * 0.62 + 0.01)
  })

  it('AK-DS-18: destroy() räumt Listener, Observer, Timer und DOM; setMotion ändert nichts', () => {
    const root = setupDom('<div class="u-container" data-rect="16,0,358,900"></div>')
    const handle = mountStaticLeash(root, { preset: 'legal', routeKey: 'R22' })
    handle.setMotion('full')
    expect(handle.inspect().tier).toBe('C')
    handle.rebuild()
    expect(handle.inspect().rebuildCount).toBe(1)
    handle.destroy()
    expect(root.children).toHaveLength(0)
    expect(tracker.openListeners().filter((l) => !l.startsWith('<'))).toEqual([])
    expect(tracker.openObservers()).toEqual([])
    expect(vi.getTimerCount()).toBe(0)
    expect(tracker.sensitive).toEqual([])
  })
})
