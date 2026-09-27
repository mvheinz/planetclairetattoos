// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'

import { getMotion, onMotionChange } from '@/leash/motion'

// Bewegungszustand (DESIGN §9.11, §11.7) – angelegt in P2.6 für `cart-count`; P2.16 ergänzt Engine-Fälle.

function stubMatchMedia(matches: boolean) {
  const listeners = new Set<() => void>()
  const mql = {
    matches,
    addEventListener: (_: string, fn: () => void) => listeners.add(fn),
    removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
  }
  vi.stubGlobal('matchMedia', () => mql)
  return {
    set(v: boolean) {
      mql.matches = v
      for (const fn of listeners) fn()
    },
    listeners,
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
  document.documentElement.removeAttribute('data-motion')
})

describe('leash/motion', () => {
  it('folgt prefers-reduced-motion, html[data-motion] hat Vorrang', () => {
    stubMatchMedia(true)
    expect(getMotion()).toBe('reduced')
    document.documentElement.setAttribute('data-motion', 'full')
    expect(getMotion()).toBe('full')
    stubMatchMedia(false)
    document.documentElement.removeAttribute('data-motion')
    expect(getMotion()).toBe('full')
    document.documentElement.setAttribute('data-motion', 'reduced')
    expect(getMotion()).toBe('reduced')
  })

  it('onMotionChange meldet Änderungen ohne Neuladen und meldet sich sauber ab', async () => {
    const mm = stubMatchMedia(false)
    const cb = vi.fn()
    const off = onMotionChange(cb)
    mm.set(true)
    expect(cb).toHaveBeenLastCalledWith('reduced')
    document.documentElement.setAttribute('data-motion', 'full')
    await Promise.resolve()
    expect(cb).toHaveBeenLastCalledWith('full')
    off()
    expect(mm.listeners.size).toBe(0)
    document.documentElement.setAttribute('data-motion', 'reduced')
    await Promise.resolve()
    expect(cb).toHaveBeenCalledTimes(2)
  })
})
