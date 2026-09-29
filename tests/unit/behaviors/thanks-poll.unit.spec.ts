// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { mount, navigation, POLL_INTERVAL_MS, POLL_MAX_MS } from '@/behaviors/thanks-poll'
import type { BehaviorContext } from '@/behaviors/types'

import { installTracker, type Tracker } from './harness'

// P4.17 – `thanks-poll` (KONZEPT §4.12): Abfrage alle 2 s bis 60 s, Neuladen bei geändertem Zustand, danach Hinweis
// „Das dauert länger als sonst …“; im Modus preview aus; `unmount()` stoppt alles (AK-DS-18).

const URL = '/api/checkout/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA/state'
let tracker: Tracker
let reload: ReturnType<typeof vi.fn>
const original = navigation.reload

function root(): HTMLElement {
  document.body.innerHTML =
    `<div data-behavior="thanks-poll" data-state="waiting" data-state-url="${URL}">` +
    '<p data-thanks-long hidden>Das dauert länger als sonst.</p></div>'
  return document.querySelector<HTMLElement>('[data-behavior="thanks-poll"]')!
}

const ctx = (thanksState: (url: string) => Promise<string | null>): BehaviorContext => ({
  mode: 'app',
  actions: { thanksState },
})

beforeEach(() => {
  vi.useFakeTimers()
  tracker = installTracker()
  reload = vi.fn()
  navigation.reload = reload as unknown as typeof navigation.reload
})

afterEach(() => {
  navigation.reload = original
  tracker.restore()
  vi.useRealTimers()
  document.body.innerHTML = ''
})

describe('thanks-poll', () => {
  it('fragt im 2-s-Takt ab und lädt neu, sobald der Zustand wechselt (S10)', async () => {
    const answers = ['waiting', 'waiting', 'paid']
    const fetchState = vi.fn(async () => answers.shift() ?? 'paid')
    const unmount = mount(root(), ctx(fetchState))
    expect(fetchState).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS - 1)
    expect(fetchState).toHaveBeenCalledTimes(0)
    await vi.advanceTimersByTimeAsync(1)
    expect(fetchState).toHaveBeenCalledTimes(1)
    expect(fetchState).toHaveBeenCalledWith(URL, expect.any(AbortSignal))
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS)
    expect(fetchState).toHaveBeenCalledTimes(2)
    expect(reload).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS)
    expect(fetchState).toHaveBeenCalledTimes(3)
    expect(reload).toHaveBeenCalledTimes(1)
    // danach keine weiteren Abfragen
    await vi.advanceTimersByTimeAsync(10 * POLL_INTERVAL_MS)
    expect(fetchState).toHaveBeenCalledTimes(3)
    expect(vi.getTimerCount()).toBe(0)
    unmount()
  })

  it('endet nach 60 s und zeigt „Das dauert länger als sonst“', async () => {
    const fetchState = vi.fn(async () => 'waiting')
    const el = root()
    const unmount = mount(el, ctx(fetchState))
    await vi.advanceTimersByTimeAsync(POLL_MAX_MS - POLL_INTERVAL_MS)
    expect(el.querySelector<HTMLElement>('[data-thanks-long]')!.hidden).toBe(true)
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS)
    expect(fetchState).toHaveBeenCalledTimes(POLL_MAX_MS / POLL_INTERVAL_MS)
    expect(el.querySelector<HTMLElement>('[data-thanks-long]')!.hidden).toBe(false)
    await vi.advanceTimersByTimeAsync(30_000)
    expect(fetchState).toHaveBeenCalledTimes(30)
    expect(vi.getTimerCount()).toBe(0)
    expect(reload).not.toHaveBeenCalled()
    unmount()
  })

  it('Fehler (null, Ausnahme) zählen wie „wartet“', async () => {
    const fetchState = vi
      .fn<(url: string) => Promise<string | null>>()
      .mockResolvedValueOnce(null)
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue('unpaid')
    const unmount = mount(root(), ctx(fetchState))
    await vi.advanceTimersByTimeAsync(3 * POLL_INTERVAL_MS)
    expect(fetchState).toHaveBeenCalledTimes(3)
    expect(reload).toHaveBeenCalledTimes(1)
    unmount()
  })

  it('AK-DS-18 unmount() stoppt Abfrage und Timer; laufende Anfrage wird abgebrochen', async () => {
    let signal: AbortSignal | undefined
    const fetchState = vi.fn(
      (_url: string, s?: AbortSignal) =>
        new Promise<string | null>((resolve) => {
          signal = s
          s?.addEventListener('abort', () => resolve(null))
        }),
    )
    const unmount = mount(root(), { mode: 'app', actions: { thanksState: fetchState } })
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS)
    expect(fetchState).toHaveBeenCalledTimes(1)
    unmount()
    expect(signal?.aborted).toBe(true)
    await vi.advanceTimersByTimeAsync(POLL_MAX_MS)
    expect(fetchState).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(0)
    expect(reload).not.toHaveBeenCalled()
  })

  it('AK-DS-18 Modus preview: keine Abfrage, kein Timer, kein Netz/Speicher', async () => {
    const fetchState = vi.fn(async () => 'paid')
    const unmount = mount(root(), { mode: 'preview', actions: { thanksState: fetchState } })
    expect(vi.getTimerCount()).toBe(0)
    await vi.advanceTimersByTimeAsync(POLL_MAX_MS)
    expect(fetchState).not.toHaveBeenCalled()
    unmount()
    expect(tracker.sensitive).toEqual([])
    expect(tracker.openListeners()).toEqual([])
  })

  it('zweites mount auf neuem DOM funktioniert', async () => {
    const fetchState = vi.fn(async () => 'waiting')
    mount(root(), ctx(fetchState))()
    const unmount = mount(root(), ctx(fetchState))
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS)
    expect(fetchState).toHaveBeenCalledTimes(1)
    unmount()
    expect(vi.getTimerCount()).toBe(0)
  })
})
