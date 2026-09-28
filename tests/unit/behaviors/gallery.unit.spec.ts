// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { indexFromScroll, mount } from '@/behaviors/gallery'

import { installTracker, type Tracker } from './harness'

// P3.10 `gallery` (DESIGN KO-09; AK-DS-18): Index aus der Scroll-Position, Punkte/Zähler/Miniaturen, Knöpfe und
// Pfeiltasten, `aria-live` nur nach Knopf/Taste.

const html = (n: number) =>
  `<section data-behavior="gallery"><ul data-gallery-track tabindex="0">` +
  Array.from(
    { length: n },
    (_, i) =>
      `<li data-gallery-slide="${i}"><a href="/${i}.webp" data-zoom-src="/${i}.webp"><img alt="${i}"></a></li>`,
  ).join('') +
  `</ul><button type="button" data-gallery-prev hidden>‹</button><button type="button" data-gallery-next hidden>›</button>` +
  Array.from({ length: n }, (_, i) => `<span data-gallery-dot="${i}"></span>`).join('') +
  `<span data-gallery-counter>1 / ${n}</span><ul data-gallery-thumbs hidden>` +
  Array.from(
    { length: n },
    (_, i) => `<li><button type="button" data-gallery-thumb="${i}">${i}</button></li>`,
  ).join('') +
  `</ul></section>`

let tracker: Tracker
let scrolled: ScrollToOptions[]

beforeEach(() => {
  tracker = installTracker()
  scrolled = []
  document.body.innerHTML = html(5)
  const track = document.querySelector<HTMLElement>('[data-gallery-track]')!
  Object.defineProperty(track, 'clientWidth', { configurable: true, value: 300 })
  track.scrollTo = ((opts: ScrollToOptions) => {
    scrolled.push(opts)
  }) as typeof track.scrollTo
})

afterEach(() => {
  tracker.restore()
  document.documentElement.removeAttribute('data-motion')
  document.body.innerHTML = ''
})

const root = () => document.querySelector('[data-behavior="gallery"]')!
const q = <T extends HTMLElement>(s: string) => document.querySelector<T>(s)!
const counter = () => q('[data-gallery-counter]')

describe('indexFromScroll', () => {
  it('rundet auf das nächste Foto und begrenzt auf 0 … n − 1', () => {
    expect(indexFromScroll(0, 300, 5)).toBe(0)
    expect(indexFromScroll(149, 300, 5)).toBe(0)
    expect(indexFromScroll(151, 300, 5)).toBe(1)
    expect(indexFromScroll(600, 300, 5)).toBe(2)
    expect(indexFromScroll(5000, 300, 5)).toBe(4)
    expect(indexFromScroll(-600, 300, 5)).toBe(2)
    expect(indexFromScroll(300, 0, 5)).toBe(0)
    expect(indexFromScroll(300, 300, 0)).toBe(0)
  })
})

describe('KO-09 Galerie', () => {
  it('zeigt Knöpfe und Miniaturen, Zähler 1 / 5, aktive Miniatur mit aria-current', () => {
    const unmount = mount(root())
    expect(q('[data-gallery-prev]').hidden).toBe(false)
    expect(q('[data-gallery-thumbs]').hidden).toBe(false)
    expect(counter().textContent).toBe('1 / 5')
    expect(q('[data-gallery-thumb="0"]').getAttribute('aria-current')).toBe('true')
    expect(q('[data-gallery-prev]').getAttribute('aria-disabled')).toBe('true')
    unmount()
    expect(q('[data-gallery-prev]').hidden).toBe(true)
  })

  it('Knopf/Taste: wechselt das Foto, Zähler aria-live; Wischen (Scroll) ohne aria-live', () => {
    const unmount = mount(root())
    q('[data-gallery-next]').click()
    expect(scrolled.at(-1)).toMatchObject({ left: 300, behavior: 'smooth' })
    expect(counter().textContent).toBe('2 / 5')
    expect(counter().getAttribute('aria-live')).toBe('polite')
    expect(q('[data-gallery-dot="1"]').hasAttribute('data-active')).toBe(true)
    expect(q('[data-gallery-thumb="1"]').getAttribute('aria-current')).toBe('true')
    expect(q('[data-gallery-thumb="0"]').hasAttribute('aria-current')).toBe(false)

    const track = q('[data-gallery-track]')
    track.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }))
    expect(counter().textContent).toBe('5 / 5')
    expect(q('[data-gallery-next]').getAttribute('aria-disabled')).toBe('true')
    track.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }))
    expect(counter().textContent).toBe('4 / 5')

    // Wischen: Scroll-Position bestimmt das Foto, ohne Ansage.
    track.dispatchEvent(new Event('pointerdown'))
    track.scrollLeft = 300
    track.dispatchEvent(new Event('scroll'))
    expect(counter().textContent).toBe('2 / 5')
    expect(counter().hasAttribute('aria-live')).toBe(false)
    unmount()
  })

  it('Miniatur springt zum Foto; reduzierte Bewegung ohne weiches Scrollen', () => {
    document.documentElement.setAttribute('data-motion', 'reduced')
    const unmount = mount(root())
    q('[data-gallery-thumb="3"]').click()
    expect(scrolled.at(-1)).toMatchObject({ left: 900, behavior: 'auto' })
    expect(counter().textContent).toBe('4 / 5')
    unmount()
  })

  it('AK-DS-18: unmount entfernt alle Listener; Modus preview ohne Netz/Storage', () => {
    const unmount = mount(root(), { mode: 'preview' })
    q('[data-gallery-next]').click()
    unmount()
    expect(tracker.openListeners()).toEqual([])
    expect(tracker.openObservers()).toEqual([])
    expect(tracker.sensitive).toEqual([])
    expect(counter().hasAttribute('aria-live')).toBe(false)
  })

  it('ohne Leiste: kein Fehler', () => {
    document.body.innerHTML = '<section data-behavior="gallery"></section>'
    expect(() => mount(root())()).not.toThrow()
    vi.clearAllTimers()
  })
})
