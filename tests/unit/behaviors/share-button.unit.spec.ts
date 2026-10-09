// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { COPIED_MS } from '@/behaviors/copy-button'
import { canShareNatively, mount } from '@/behaviors/share-button'

import { installTracker, type Tracker } from './harness'

// P14.12 (U-61) – `share-button`: öffnet das Teilen-Menü des Geräts mit URL/Titel; ohne Web Share API oder in der
// Vorschau-Datei bleibt der Knopf verborgen (Rückfall „Link kopieren“ über `copy-button` bleibt sichtbar); Abbruch durch
// die Person → nichts; anderer Fehler → Link kopieren + Meldung; kein Netz, kein Speicher; unmount räumt auf.

const URL_ = 'https://planetclairetattoos.com/de/tattoo/flash#f-012'
let tracker: Tracker

function markup(): HTMLButtonElement {
  document.body.innerHTML =
    '<p data-share=""><button type="button" data-behavior="share-button" ' +
    `data-share-url="${URL_}" data-share-title="F-012 – Kelch" data-copied-text="Link kopiert" ` +
    'data-copy-failed-text="Ging nicht" data-copy-status-id="st" hidden>Teilen</button>' +
    '<button type="button" data-behavior="copy-button" data-share-fallback="" hidden>Link kopieren</button>' +
    '<span id="st" role="status" aria-live="polite"></span></p>'
  return document.querySelector('[data-behavior="share-button"]')!
}

function stubShare(share: ((d: ShareData) => Promise<void>) | undefined) {
  Object.defineProperty(navigator, 'share', { value: share, configurable: true })
  Object.defineProperty(navigator, 'canShare', { value: undefined, configurable: true })
}

beforeEach(() => {
  vi.useFakeTimers()
  tracker = installTracker()
})
afterEach(() => {
  tracker.restore()
  vi.useRealTimers()
  stubShare(undefined)
  document.body.innerHTML = ''
})

describe('share-button (U-61)', () => {
  it('mit Teilen-Menü: Knopf sichtbar, Rückfall ausgeblendet, teilt URL und Titel', async () => {
    const share = vi.fn(async () => undefined)
    stubShare(share)
    const b = markup()
    const unmount = mount(b, { mode: 'app' })
    expect(b.hidden).toBe(false)
    expect(document.querySelector('[data-share]')!.hasAttribute('data-share-native')).toBe(true)
    b.click()
    await vi.advanceTimersByTimeAsync(0)
    expect(share).toHaveBeenCalledWith({ url: URL_, title: 'F-012 – Kelch', text: undefined })
    unmount()
    expect(b.hidden).toBe(true)
    expect(document.querySelector('[data-share]')!.hasAttribute('data-share-native')).toBe(false)
    expect(tracker.openListeners()).toEqual([])
  })

  it('ohne Teilen-Menü oder in der Vorschau: verborgen, Rückfall bleibt', () => {
    stubShare(undefined)
    const b = markup()
    mount(b, { mode: 'app' })()
    expect(b.hidden).toBe(true)
    stubShare(vi.fn(async () => undefined))
    const unmount = mount(markup(), { mode: 'preview' })
    expect(
      document.querySelector<HTMLButtonElement>('[data-behavior="share-button"]')!.hidden,
    ).toBe(true)
    unmount()
  })

  it('Abbruch → keine Meldung; anderer Fehler → Link kopiert und gemeldet', async () => {
    const writeText = vi.fn(async () => undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    stubShare(vi.fn(async () => Promise.reject(new DOMException('abgebrochen', 'AbortError'))))
    let b = markup()
    let unmount = mount(b, { mode: 'app' })
    b.click()
    await vi.advanceTimersByTimeAsync(0)
    expect(writeText).not.toHaveBeenCalled()
    expect(document.getElementById('st')!.textContent).toBe('')
    unmount()

    stubShare(vi.fn(async () => Promise.reject(new DOMException('nein', 'NotAllowedError'))))
    b = markup()
    unmount = mount(b, { mode: 'app' })
    b.click()
    await vi.advanceTimersByTimeAsync(0)
    expect(writeText).toHaveBeenCalledWith(URL_)
    expect(document.getElementById('st')!.textContent).toBe('Link kopiert')
    await vi.advanceTimersByTimeAsync(COPIED_MS)
    expect(document.getElementById('st')!.textContent).toBe('')
    unmount()
    expect(vi.getTimerCount()).toBe(0)
    expect(tracker.sensitive).toEqual([])
  })

  it('canShare wird beachtet', () => {
    const nav = { share: () => Promise.resolve(), canShare: () => false } as unknown as Navigator
    expect(canShareNatively(nav, { url: URL_ })).toBe(false)
    expect(canShareNatively(undefined, { url: URL_ })).toBe(false)
  })
})
