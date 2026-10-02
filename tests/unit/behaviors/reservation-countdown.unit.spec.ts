// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  announceStep,
  countdownLevel,
  formatRemaining,
  mount,
  PREVIEW_DEMO_MS,
  RESERVATION_EXPIRED_EVENT,
} from '@/behaviors/reservation-countdown'

import { installTracker, type Tracker } from './harness'

// P4.9 Countdown KO-15 (MI-08): Schwellen 5:00/1:00, Ansagen nur bei 10, 5, 1 min und Ablauf, Ablaufblock und Ereignis
// für den Bestellknopf, Zeitbasis Server minus Client-Offset, Demo in der Vorschau; AK-DS-18 (sauberes Lösen).

const SERVER_NOW = Date.parse('2026-10-07T10:00:00.000Z')
const MIN = 60_000

function markup(expiresInMs: number, extra = '') {
  const expires = new Date(SERVER_NOW + expiresInMs).toISOString()
  document.body.innerHTML =
    `<div data-behavior="reservation-countdown" data-expires-at="${expires}" ` +
    `data-server-now="${new Date(SERVER_NOW).toISOString()}" data-text-warn="Noch 5 Minuten reserviert" ` +
    'data-text-last="Nur noch 1 Minute" data-announce-10="Noch 10 Minuten reserviert." ' +
    'data-announce-5="Noch 5 Minuten reserviert." data-announce-1="Nur noch 1 Minute." ' +
    `data-announce-expired="Deine Reservierung ist abgelaufen." ${extra}>` +
    '<p role="timer" aria-live="off" data-countdown-time>--:--</p>' +
    '<p data-countdown-text>Dein Stück ist für dich reserviert.</p>' +
    '<p class="u-sr-only" aria-live="polite" data-countdown-announce></p>' +
    '<div data-countdown-expired hidden><p>Deine Reservierung ist abgelaufen.</p></div></div>'
  return document.querySelector('[data-behavior]')!
}

const q = (sel: string) => document.querySelector<HTMLElement>(sel)!

let tracker: Tracker
beforeEach(() => {
  vi.useFakeTimers()
  tracker = installTracker()
})
afterEach(() => {
  tracker.restore()
  vi.useRealTimers()
  document.body.innerHTML = ''
})

describe('reservation-countdown – reine Funktionen', () => {
  it('Schwellen: > 5:00 normal, ≤ 5:00 warn, ≤ 1:00 last, ≤ 0 expired', () => {
    expect(countdownLevel(5 * MIN + 1000)).toBe('normal')
    expect(countdownLevel(5 * MIN)).toBe('warn')
    expect(countdownLevel(MIN + 1)).toBe('warn')
    expect(countdownLevel(MIN)).toBe('last')
    expect(countdownLevel(1)).toBe('last')
    expect(countdownLevel(0)).toBe('expired')
    expect(countdownLevel(-5)).toBe('expired')
  })

  it('Ansage-Stufen nur 10, 5, 1 und 0', () => {
    expect(announceStep(11 * MIN)).toBeNull()
    expect(announceStep(10 * MIN)).toBe(10)
    expect(announceStep(6 * MIN)).toBe(10)
    expect(announceStep(5 * MIN)).toBe(5)
    expect(announceStep(30_000)).toBe(1)
    expect(announceStep(0)).toBe(0)
  })

  it('mm:ss mit aufgerundeten Sekunden, nie negativ', () => {
    expect(formatRemaining(30 * MIN)).toBe('30:00')
    expect(formatRemaining(24 * MIN + 11_200)).toBe('24:12')
    expect(formatRemaining(999)).toBe('00:01')
    expect(formatRemaining(-3000)).toBe('00:00')
  })
})

describe('reservation-countdown – Modul', () => {
  it('Zeitbasis displayExpiresAt minus Client-Offset (Browser-Uhr 2 h vor)', () => {
    vi.setSystemTime(SERVER_NOW + 2 * 3600_000)
    const root = markup(12 * MIN)
    const unmount = mount(root)
    expect(q('[data-countdown-time]').textContent).toBe('12:00')
    vi.advanceTimersByTime(1000)
    expect(q('[data-countdown-time]').textContent).toBe('11:59')
    unmount()
  })

  it('Schwellen, Sätze und Ansagen beim Überschreiten; Ablauf mit Block und Ereignis; nur Textwechsel', () => {
    vi.setSystemTime(SERVER_NOW)
    const root = markup(10 * MIN + 2000)
    const expired = vi.fn()
    document.addEventListener(RESERVATION_EXPIRED_EVENT, expired)
    const unmount = mount(root)
    const announce = q('[data-countdown-announce]')
    expect(root.getAttribute('data-level')).toBe('normal')
    expect(announce.textContent).toBe('')

    vi.advanceTimersByTime(2000)
    expect(q('[data-countdown-time]').textContent).toBe('10:00')
    expect(announce.textContent).toBe('Noch 10 Minuten reserviert.')

    vi.advanceTimersByTime(5 * MIN)
    expect(root.getAttribute('data-level')).toBe('warn')
    expect(q('[data-countdown-text]').textContent).toBe('Noch 5 Minuten reserviert')
    expect(announce.textContent).toBe('Noch 5 Minuten reserviert.')

    vi.advanceTimersByTime(4 * MIN)
    expect(root.getAttribute('data-level')).toBe('last')
    expect(q('[data-countdown-text]').textContent).toBe('Nur noch 1 Minute')
    expect(announce.textContent).toBe('Nur noch 1 Minute.')

    vi.advanceTimersByTime(MIN)
    expect(root.getAttribute('data-level')).toBe('expired')
    expect(q('[data-countdown-time]').textContent).toBe('00:00')
    expect(q('[data-countdown-expired]').hidden).toBe(false)
    expect(announce.textContent).toBe('Deine Reservierung ist abgelaufen.')
    expect(expired).toHaveBeenCalledTimes(1)
    // Nach dem Ablauf kein Takt mehr.
    expect(vi.getTimerCount()).toBe(0)
    expect(document.getAnimations?.() ?? []).toHaveLength(0)
    document.removeEventListener(RESERVATION_EXPIRED_EVENT, expired)
    unmount()
  })

  it('kein Ansage-Spam beim ersten Binden unterhalb einer Stufe', () => {
    vi.setSystemTime(SERVER_NOW)
    const unmount = mount(markup(4 * MIN))
    expect(q('[data-countdown-announce]').textContent).toBe('')
    vi.advanceTimersByTime(1000)
    expect(q('[data-countdown-announce]').textContent).toBe('')
    unmount()
  })

  it('schon abgelaufen beim Laden: Ablaufblock sofort, kein Timer', () => {
    vi.setSystemTime(SERVER_NOW)
    const unmount = mount(markup(-1000))
    expect(q('[data-countdown-expired]').hidden).toBe(false)
    expect(vi.getTimerCount()).toBe(0)
    unmount()
  })

  it('kompakte Wiederholung mit Vorlage „Noch {time} reserviert“', () => {
    vi.setSystemTime(SERVER_NOW)
    const unmount = mount(markup(24 * MIN + 12_000, 'data-time-template="Noch {time} reserviert"'))
    expect(q('[data-countdown-time]').textContent).toBe('Noch 24:12 reserviert')
    unmount()
  })

  it('AK-DS-18 unmount entfernt Timer; zweites mount auf neuem DOM funktioniert; Vorschau ohne Netz/Storage mit Demo ab 30:00', () => {
    vi.setSystemTime(SERVER_NOW)
    const first = mount(markup(20 * MIN))
    expect(vi.getTimerCount()).toBe(1)
    first()
    expect(vi.getTimerCount()).toBe(0)
    expect(tracker.openListeners()).toEqual([])

    const second = mount(markup(-60 * MIN), { mode: 'preview' })
    expect(q('[data-countdown-time]').textContent).toBe(formatRemaining(PREVIEW_DEMO_MS))
    vi.advanceTimersByTime(1000)
    expect(q('[data-countdown-time]').textContent).toBe('29:59')
    second()
    expect(vi.getTimerCount()).toBe(0)
    expect(tracker.sensitive).toEqual([])
  })
})
