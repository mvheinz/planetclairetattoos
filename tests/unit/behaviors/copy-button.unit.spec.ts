// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { COPIED_MS, mount } from '@/behaviors/copy-button'

import { installTracker, type Tracker } from './harness'

// P4.17 – `copy-button` (DESIGN §9.12, KO-19): kopiert `data-copy`, meldet „Kopiert“ 2 s in der Live-Region,
// Fehlermeldung ohne Zwischenablage; ohne JS verborgen; unmount räumt auf (AK-DS-18).

let tracker: Tracker

function button(): HTMLButtonElement {
  document.body.innerHTML =
    '<p><button type="button" data-behavior="copy-button" data-copy="DE36000000000000000000" ' +
    'data-copied-text="Kopiert" data-copy-failed-text="Ging nicht" data-copy-status-id="st" hidden>IBAN kopieren' +
    '</button><span id="st" role="status" aria-live="polite"></span></p>'
  return document.querySelector('button')!
}

beforeEach(() => {
  vi.useFakeTimers()
  tracker = installTracker()
})
afterEach(() => {
  tracker.restore()
  vi.useRealTimers()
  document.body.innerHTML = ''
})

describe('copy-button', () => {
  it('kopiert den Wert und meldet „Kopiert“ für 2 s', async () => {
    const writeText = vi.fn(async () => undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    const b = button()
    const unmount = mount(b, { mode: 'app' })
    expect(b.hidden).toBe(false)
    b.click()
    await vi.advanceTimersByTimeAsync(0)
    expect(writeText).toHaveBeenCalledWith('DE36000000000000000000')
    expect(document.getElementById('st')!.textContent).toBe('Kopiert')
    await vi.advanceTimersByTimeAsync(COPIED_MS)
    expect(document.getElementById('st')!.textContent).toBe('')
    unmount()
    expect(tracker.openListeners()).toEqual([])
    expect(vi.getTimerCount()).toBe(0)
  })

  it('ohne Zwischenablage: Fehlermeldung', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true })
    const b = button()
    const unmount = mount(b, { mode: 'preview' })
    b.click()
    await vi.advanceTimersByTimeAsync(0)
    expect(document.getElementById('st')!.textContent).toBe('Ging nicht')
    unmount()
    expect(vi.getTimerCount()).toBe(0)
    expect(tracker.sensitive).toEqual([])
  })
})
