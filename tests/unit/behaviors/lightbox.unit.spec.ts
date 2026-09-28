// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { mount } from '@/behaviors/lightbox'

import { installTracker, type Tracker } from './harness'

// P3.10 `lightbox` (DESIGN KO-09; AK-DS-18): Öffnen per Foto-Link, größte Größe, Pfeiltasten, Zoom 1× ↔ 2×, Schließen
// per Knopf, Esc und Zurück (history), Fokus zurück aufs Foto.

const HTML =
  '<section data-behavior="lightbox"><ul>' +
  '<li><a href="/a-zoom.webp" data-zoom-src="/a-zoom.webp" data-zoom-w="2560" data-zoom-h="3200"><img alt="Schale"></a></li>' +
  '<li><a href="/b-card.webp" data-zoom-src="/b-card.webp"><img alt="Rückseite"></a></li></ul>' +
  '<dialog data-lightbox><div data-lightbox-stage></div>' +
  '<p data-lightbox-counter></p><button type="button" data-lightbox-close>Schließen</button></dialog></section>'

let tracker: Tracker
let pushState: ReturnType<typeof vi.spyOn>
let back: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  tracker = installTracker()
  document.body.innerHTML = HTML
  const dialog = document.querySelector('dialog') as HTMLDialogElement
  // jsdom kennt showModal/close nicht vollständig: einfache Nachbildung.
  dialog.showModal = () => dialog.setAttribute('open', '')
  dialog.close = () => dialog.removeAttribute('open')
  pushState = vi.spyOn(window.history, 'pushState').mockImplementation(() => {})
  back = vi.spyOn(window.history, 'back').mockImplementation(() => {})
})

afterEach(() => {
  tracker.restore()
  vi.restoreAllMocks()
  document.body.innerHTML = ''
})

const root = () => document.querySelector('[data-behavior="lightbox"]')!
const dialog = () => document.querySelector<HTMLElement>('[data-lightbox]')!
const img = () => document.querySelector<HTMLImageElement>('[data-lightbox-img]')!
const links = () => Array.from(document.querySelectorAll<HTMLAnchorElement>('a[data-zoom-src]'))

describe('KO-09 Lightbox', () => {
  it('Foto-Link öffnet den Dialog mit der größten Größe, Alt-Text und Zähler; pushState', () => {
    const unmount = mount(root())
    const ev = new MouseEvent('click', { bubbles: true, cancelable: true })
    links()[0]!.dispatchEvent(ev)
    expect(ev.defaultPrevented).toBe(true)
    expect(dialog().hasAttribute('open')).toBe(true)
    expect(img().getAttribute('src')).toBe('/a-zoom.webp')
    expect(img().getAttribute('width')).toBe('2560')
    expect(img().alt).toBe('Schale')
    expect(document.querySelector('[data-lightbox-counter]')!.textContent).toBe('1 / 2')
    expect(pushState).toHaveBeenCalledTimes(1)
    expect(document.activeElement).toBe(document.querySelector('[data-lightbox-close]'))

    dialog().dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
    expect(img().getAttribute('src')).toBe('/b-card.webp')
    expect(img().hasAttribute('width')).toBe(false)
    dialog().dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
    expect(img().getAttribute('src')).toBe('/a-zoom.webp')
    unmount()
  })

  it('Esc (cancel) schließt, geht in der Historie zurück und fokussiert das auslösende Foto', () => {
    const unmount = mount(root())
    links()[1]!.click()
    const cancel = new Event('cancel', { cancelable: true })
    dialog().dispatchEvent(cancel)
    expect(cancel.defaultPrevented).toBe(true)
    expect(dialog().hasAttribute('open')).toBe(false)
    expect(back).toHaveBeenCalledTimes(1)
    expect(document.activeElement).toBe(links()[1])
    // Das folgende popstate (von history.back) schließt nichts erneut.
    window.dispatchEvent(new PopStateEvent('popstate'))
    expect(back).toHaveBeenCalledTimes(1)
    unmount()
  })

  it('Zurück-Taste des Browsers (popstate) schließt ohne weiteres history.back', () => {
    const unmount = mount(root())
    links()[0]!.click()
    window.dispatchEvent(new PopStateEvent('popstate'))
    expect(dialog().hasAttribute('open')).toBe(false)
    expect(back).not.toHaveBeenCalled()
    expect(document.activeElement).toBe(links()[0])
    unmount()
  })

  it('Knopf „Schließen“ schließt', () => {
    const unmount = mount(root())
    links()[0]!.click()
    document.querySelector<HTMLElement>('[data-lightbox-close]')!.click()
    expect(dialog().hasAttribute('open')).toBe(false)
    unmount()
  })

  it('Klick (Maus) schaltet 1× ↔ 2×; Wischen wechselt das Foto', () => {
    const unmount = mount(root())
    links()[0]!.click()
    const stage = document.querySelector<HTMLElement>('[data-lightbox-stage]')!
    const pointer = (type: string, x: number, pointerType = 'mouse', target: Element = img()) => {
      const e = new MouseEvent(type, { bubbles: true, clientX: x, clientY: 10 })
      Object.defineProperty(e, 'pointerType', { value: pointerType })
      Object.defineProperty(e, 'pointerId', { value: 1 })
      target.dispatchEvent(e)
    }
    pointer('pointerdown', 10)
    pointer('pointerup', 10)
    expect(stage.hasAttribute('data-zoomed')).toBe(true)
    expect(img().style.transform).toContain('scale(2)')
    pointer('pointerdown', 10)
    pointer('pointerup', 12)
    expect(stage.hasAttribute('data-zoomed')).toBe(false)
    // Wischen nach links → nächstes Foto
    pointer('pointerdown', 200, 'touch')
    pointer('pointerup', 100, 'touch')
    expect(img().getAttribute('src')).toBe('/b-card.webp')
    unmount()
  })

  it('Modus preview: nimmt das eingebettete Foto der Leiste statt der Zoom-Größe', () => {
    const thumb = links()[0]!.querySelector('img')!
    thumb.src = 'blob:vorschau-1'
    const unmount = mount(root(), { mode: 'preview' })
    links()[0]!.click()
    expect(img().getAttribute('src')).toBe('blob:vorschau-1')
    expect(img().hasAttribute('width')).toBe(false)
    unmount()
    expect(document.querySelector('[data-lightbox-img]')).toBeNull()
  })

  it('AK-DS-18: unmount entfernt alle Listener; Modus preview ohne Netz/Storage', () => {
    const unmount = mount(root(), { mode: 'preview' })
    links()[0]!.click()
    unmount()
    expect(dialog().hasAttribute('open')).toBe(false)
    expect(tracker.openListeners()).toEqual([])
    expect(tracker.openObservers()).toEqual([])
    expect(tracker.sensitive).toEqual([])
  })
})
