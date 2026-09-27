// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { MOTION_STORAGE_KEY, mount } from '@/behaviors/motion-toggle'

// P2.10 Schalter „Animationen“ (DESIGN §11.7, R-130 a): Speichern erst nach Klick, Beschriftung je Zustand.

const HTML =
  '<button type="button" data-behavior="motion-toggle" data-label-on="an" data-label-off="aus" ' +
  'data-label-off-system="aus (Systemeinstellung)" aria-pressed="true" hidden>Animationen: ' +
  '<span data-motion-state>an</span></button>'

function setup(systemReduce: boolean) {
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: systemReduce && q.includes('reduce'),
    media: q,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
  document.body.innerHTML = HTML
  return document.querySelector<HTMLButtonElement>('button')!
}

const state = (b: HTMLElement) => [
  b.getAttribute('aria-pressed'),
  b.querySelector('[data-motion-state]')!.textContent,
]

beforeEach(() => {
  localStorage.clear()
  document.documentElement.removeAttribute('data-motion')
})
afterEach(() => {
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

describe('motion-toggle', () => {
  it('R-130 zeigt den Schalter, speichert vor dem Klick nichts; Klick setzt data-motion und pc-motion', () => {
    const b = setup(false)
    const unmount = mount(b, { mode: 'app' })
    expect(b.hidden).toBe(false)
    expect(state(b)).toEqual(['true', 'an'])
    expect(localStorage.length).toBe(0)
    b.click()
    expect(document.documentElement.getAttribute('data-motion')).toBe('reduced')
    expect(localStorage.getItem(MOTION_STORAGE_KEY)).toBe('reduced')
    expect(state(b)).toEqual(['false', 'aus'])
    b.click()
    expect(localStorage.getItem(MOTION_STORAGE_KEY)).toBe('full')
    expect(state(b)).toEqual(['true', 'an'])
    unmount()
  })

  it('Systemeinstellung „reduzieren“: „aus (Systemeinstellung)“, Klick schaltet ausdrücklich ein', () => {
    const b = setup(true)
    const unmount = mount(b, { mode: 'app' })
    expect(state(b)).toEqual(['false', 'aus (Systemeinstellung)'])
    b.click()
    expect(document.documentElement.getAttribute('data-motion')).toBe('full')
    expect(state(b)).toEqual(['true', 'an'])
    unmount()
  })

  it('reagiert ohne Neuladen auf eine gespeicherte Wahl (html[data-motion] von außen)', async () => {
    const b = setup(false)
    const unmount = mount(b, { mode: 'app' })
    document.documentElement.setAttribute('data-motion', 'reduced')
    await Promise.resolve()
    expect(state(b)).toEqual(['false', 'aus'])
    unmount()
  })

  it('Modus preview: kein Web-Storage, Wahl nur im Speicher', () => {
    const b = setup(false)
    const spy = vi.spyOn(Storage.prototype, 'setItem')
    const unmount = mount(b, { mode: 'preview' })
    b.click()
    expect(spy).not.toHaveBeenCalled()
    expect(localStorage.length).toBe(0)
    unmount()
    // neue „Seite“ in der Vorschau: Wahl bleibt erhalten
    document.documentElement.removeAttribute('data-motion')
    const b2 = setup(false)
    const unmount2 = mount(b2, { mode: 'preview' })
    expect(document.documentElement.getAttribute('data-motion')).toBe('reduced')
    expect(state(b2)).toEqual(['false', 'aus'])
    unmount2()
    spy.mockRestore()
  })
})
