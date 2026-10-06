// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { CocoController } from '@/leash/coco'
import { attachTravel, transitionTarget } from '@/leash/cocoTravel'

// P12.12 (U-23, KUNST-QA MO-14): Coco reist mit – im Moment des Aufbruchs wechselt sie in den Lauf (`rennen`),
// nur vor Seitenwechseln mit Übergang (nie von/zu calm), und kehrt zurück, wenn der Wechsel ausbleibt.

class FakeNavigation extends EventTarget {
  go(url: string, extra: Record<string, unknown> = {}) {
    const e = Object.assign(new Event('navigate'), {
      destination: { url },
      hashChange: false,
      downloadRequest: null,
      navigationType: 'push',
      ...extra,
    })
    this.dispatchEvent(e)
  }
}

function fakeCoco() {
  const x = { p: vi.fn(), s: vi.fn(), b: vi.fn() }
  return { coco: { x, pose: () => 'sitzen' } as unknown as CocoController, x }
}

describe('transitionTarget', () => {
  const o = 'https://example.test'
  it('Registry-Routen mit Übergang ja, calm und fremde Adressen nein', () => {
    expect(transitionTarget('/de/kontakt', o)).toBe(true)
    expect(transitionTarget('/de/shop', o)).toBe(true)
    expect(transitionTarget('/en/shop', o)).toBe(true)
    expect(transitionTarget('/de/warenkorb', o)).toBe(false)
    expect(transitionTarget('/de/vertrag-widerrufen', o)).toBe(false)
    expect(transitionTarget('https://other.test/de/shop', o)).toBe(false)
    expect(transitionTarget('/de/gibt-es-nicht', o)).toBe(false)
  })
})

describe('attachTravel', () => {
  let nav: FakeNavigation
  beforeEach(() => {
    vi.useFakeTimers()
    nav = new FakeNavigation()
    ;(globalThis as { navigation?: unknown }).navigation = nav
    window.history.replaceState({}, '', '/de')
  })
  afterEach(() => {
    vi.useRealTimers()
    delete (globalThis as { navigation?: unknown }).navigation
  })

  it('Aufbruch zu einer Seite mit Übergang: Lauf-Pose und Boil an, nach Frist zurück', () => {
    const { coco, x } = fakeCoco()
    attachTravel(coco)
    nav.go('http://localhost:3000/de/kontakt')
    expect(x.s).toHaveBeenCalledWith('rennen')
    expect(x.b).toHaveBeenCalledWith(true)
    vi.advanceTimersByTime(1500)
    expect(x.b).toHaveBeenLastCalledWith(false)
    expect(x.s).toHaveBeenLastCalledWith('sitzen')
  })

  it('kein Lauf bei calm-Ziel, Anker, gleicher Seite, Download und Reload', () => {
    const { coco, x } = fakeCoco()
    attachTravel(coco)
    nav.go('http://localhost:3000/de/warenkorb')
    nav.go('http://localhost:3000/de#oben', { hashChange: true })
    nav.go('http://localhost:3000/de')
    nav.go('http://localhost:3000/de/kontakt', { downloadRequest: 'x.pdf' })
    nav.go('http://localhost:3000/de/kontakt', { navigationType: 'reload' })
    expect(x.s).not.toHaveBeenCalled()
  })

  it('Abmelden: keine Reaktion mehr, kein Timer; ohne Navigation-API passiert nichts', () => {
    const { coco, x } = fakeCoco()
    const off = attachTravel(coco)
    nav.go('http://localhost:3000/de/kontakt')
    off()
    vi.advanceTimersByTime(3000)
    expect(x.s).toHaveBeenCalledTimes(1)
    nav.go('http://localhost:3000/de/shop')
    expect(x.s).toHaveBeenCalledTimes(1)
    delete (globalThis as { navigation?: unknown }).navigation
    expect(() => attachTravel(coco)()).not.toThrow()
  })
})
