// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'

import { DESKTOP_QUERY, mount } from '@/behaviors/tour-fold'

// U-51 (P14.2): Schaukasten am Desktop offen (auch für Screenreader), darunter zugeklappt; Wechsel der Breite folgt.

type Listener = () => void

function fakeMatchMedia(initial: boolean) {
  const listeners = new Set<Listener>()
  const mq = {
    matches: initial,
    media: DESKTOP_QUERY,
    addEventListener: (_: string, l: Listener) => listeners.add(l),
    removeEventListener: (_: string, l: Listener) => listeners.delete(l),
  }
  vi.stubGlobal('matchMedia', (q: string) => {
    expect(q).toBe(DESKTOP_QUERY)
    return mq
  })
  return {
    set(v: boolean) {
      mq.matches = v
      for (const l of [...listeners]) l()
    },
    count: () => listeners.size,
  }
}

const details = () => {
  document.body.innerHTML =
    '<details data-behavior="tour-fold"><summary>Planet Claire on Tour</summary><p>Termine</p></details>'
  return document.querySelector('details')!
}

afterEach(() => {
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

describe('tour-fold (U-51)', () => {
  it('Desktop: öffnet; Handy: bleibt zu; Wechsel der Breite folgt; unmount entfernt den Listener', () => {
    const mm = fakeMatchMedia(true)
    const d = details()
    const un = mount(d)
    expect(d.open).toBe(true)
    mm.set(false)
    expect(d.open).toBe(false)
    mm.set(true)
    expect(d.open).toBe(true)
    un()
    expect(mm.count()).toBe(0)
  })

  it('Handy: bleibt zugeklappt', () => {
    fakeMatchMedia(false)
    const d = details()
    mount(d)
    expect(d.open).toBe(false)
  })
})
