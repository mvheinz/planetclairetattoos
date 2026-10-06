// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'

import { getMotion, onMotionChange } from '@/leash/motion'
import { mountLeash as mountStepwise, type MountOptions } from '@/leash/runtime'

const mountLeash = (root: HTMLElement, o: MountOptions) =>
  mountStepwise(root, { stepwise: false, ...o })

// Bewegungszustand (DESIGN §9.11, §11.7) – angelegt in P2.6 für `cart-count`; P2.16 ergänzt die Engine-Fälle.

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

  it('Engine: onMotionChange → setMotion schaltet die Linie ohne Neuladen auf Stufe C und zurück', async () => {
    stubMatchMedia(false)
    Element.prototype.getBoundingClientRect = function () {
      const h = this.hasAttribute('data-leash-layer') ? 2000 : 0
      return {
        x: 0,
        y: 0,
        left: 0,
        top: 0,
        width: 390,
        height: h,
        right: 390,
        bottom: h,
      } as DOMRect
    }
    document.body.innerHTML = '<div><div data-leash-layer></div><main></main></div>'
    const root = document.querySelector<HTMLElement>('[data-leash-layer]')!
    const handle = mountLeash(root, { preset: 'margin', routeKey: 'R20' })
    const off = onMotionChange((m) => handle.setMotion(m))
    expect(handle.inspect().tier).not.toBe('C')
    document.documentElement.setAttribute('data-motion', 'reduced')
    await Promise.resolve()
    expect(handle.inspect().tier).toBe('C')
    expect(handle.inspect().drawnLen).toBe(handle.inspect().geometry!.totalLength)
    expect(root.querySelector('[mask]')).toBeNull()
    document.documentElement.setAttribute('data-motion', 'full')
    await Promise.resolve()
    expect(handle.inspect().tier).not.toBe('C')
    off()
    handle.destroy()
    document.body.innerHTML = ''
  })
})
