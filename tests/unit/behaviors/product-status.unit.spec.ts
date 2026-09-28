// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { STATUS_MAX_IDS, mount as mountStatus, relabel } from '@/behaviors/product-status'
import { PRODUCT_STATE_EVENT, SOLD_EVENT, type BehaviorContext } from '@/behaviors/types'
import { STATUS_ENDPOINT, fetchProductStates } from '@/lib/shop/productStatusClient'

import { installTracker, type Tracker } from './harness'

// P3.11 `product-status` (ARCHITEKTUR §9.3; DESIGN MI-03; AK-DS-18): Live-Zustand nach dem Laden, eine Abfrage ohne
// Cookies (hereingereicht wie in `BehaviorHost`: `fetchProductStates`), Karten-Badges/Name/Dämpfung, Ereignisse an
// Kaufbereich und `sold-stamp`; Vorschau ohne Abfrage.

let tracker: Tracker
let fetchMock: ReturnType<typeof vi.fn>

const card = (id: number, status = 'available') =>
  `<li><a href="/de/shop/${id}" data-product-card data-product-id="${id}" data-status="${status}" ` +
  `aria-label="Stück ${id}, 45 €${status === 'reserved' ? ', gerade reserviert' : ''}">` +
  `<span data-badge="reserved"${status === 'reserved' ? '' : ' hidden'}>reserviert</span>` +
  `<span data-price-tag><span data-sold-stamp hidden>sold</span></span></a></li>`

const LABELS =
  'data-label-reserved=", gerade reserviert" data-label-sold=", verkauft" data-label-gone=", nicht mehr da"'

function setup(html: string) {
  document.body.innerHTML = html
  return document.querySelector('[data-behavior~="product-status"]')!
}

function respond(body: unknown, ok = true) {
  fetchMock.mockImplementation(() =>
    Promise.resolve({ ok, json: () => Promise.resolve(body) } as unknown as Response),
  )
}

const flush = () => vi.runAllTimersAsync()

/** Wie in der App: `BehaviorHost` reicht den Abruf herein. */
const APP: BehaviorContext = { mode: 'app', actions: { productStatus: fetchProductStates } }
const mount = (root: Element, ctx: BehaviorContext) =>
  mountStatus(root, ctx.mode === 'app' ? APP : ctx)

beforeEach(() => {
  vi.useFakeTimers()
  tracker = installTracker()
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  tracker.restore()
  vi.useRealTimers()
  document.body.innerHTML = ''
})

describe('Abfrage', () => {
  it('eine GET-Abfrage für alle IDs (Wurzel + Karten, ohne Doppelte), ohne Cookies und ohne Cache', async () => {
    const root = setup(
      `<article data-behavior="product-status" data-product-id="7" data-status="available" ${LABELS}>` +
        `<ul>${card(8)}${card(9)}${card(8)}</ul></article>`,
    )
    respond({})
    const unmount = mount(root, { mode: 'app' })
    await flush()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe(`${STATUS_ENDPOINT}?ids=7,8,9`)
    expect(init).toMatchObject({ credentials: 'omit', cache: 'no-store' })
    expect(root.hasAttribute('data-status-live')).toBe(true)
    unmount()
  })

  it(`höchstens ${STATUS_MAX_IDS} IDs je Abfrage`, async () => {
    const cards = Array.from({ length: 30 }, (_, i) => card(i + 1)).join('')
    const root = setup(`<ul data-behavior="product-status" ${LABELS}>${cards}</ul>`)
    respond({})
    mount(root, { mode: 'app' })()
    const url = String(fetchMock.mock.calls[0]![0])
    expect(url.split('=')[1]!.split(',')).toHaveLength(24)
  })

  it('ohne hereingereichten Abruf (z. B. Vertragstest) keine Abfrage', async () => {
    const root = setup(`<ul data-behavior="product-status" ${LABELS}>${card(1)}</ul>`)
    mountStatus(root, { mode: 'app' })()
    await flush()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('Modus preview: keine Abfrage, kein Cookie, kein Speicher (auch mit hereingereichtem Abruf)', async () => {
    const root = setup(`<ul data-behavior="product-status" ${LABELS}>${card(1)}</ul>`)
    const unmount = mountStatus(root, { mode: 'preview', actions: APP.actions })
    await flush()
    unmount()
    expect(fetchMock).not.toHaveBeenCalled()
    expect(tracker.sensitive).toEqual([])
  })

  it('Fehler (429, Netz) ändern nichts', async () => {
    const root = setup(`<ul data-behavior="product-status" ${LABELS}>${card(1)}</ul>`)
    respond({ error: 'rate_limited' }, false)
    mount(root, { mode: 'app' })
    await flush()
    fetchMock.mockImplementation(() => Promise.reject(new Error('offline')))
    mount(root, { mode: 'app' })
    await flush()
    expect(document.querySelector('[data-product-card]')!.getAttribute('data-status')).toBe(
      'available',
    )
  })
})

describe('Live-Wechsel', () => {
  it('Karten: reserviert → Badge sichtbar, Name mit Zusatz; verkauft → SOLD_EVENT (MI-03); gone → gedämpft', async () => {
    const root = setup(
      `<ul data-behavior="product-status" ${LABELS}>${card(1)}${card(2, 'reserved')}${card(3)}${card(4)}</ul>`,
    )
    respond({ 1: 'reserved', 2: 'available', 3: 'sold', 4: 'gone' })
    const states: unknown[] = []
    const sold: unknown[] = []
    const onState = (e: Event) => states.push((e as CustomEvent).detail)
    const onSold = (e: Event) => sold.push((e as CustomEvent).detail)
    document.addEventListener(PRODUCT_STATE_EVENT, onState)
    document.addEventListener(SOLD_EVENT, onSold)
    const unmount = mount(root, { mode: 'app' })
    await flush()
    const el = (id: number) => document.querySelector<HTMLElement>(`[data-product-id="${id}"]`)!
    expect(el(1).getAttribute('data-status')).toBe('reserved')
    expect(el(1).querySelector<HTMLElement>('[data-badge]')!.hidden).toBe(false)
    expect(el(1).getAttribute('aria-label')).toBe('Stück 1, 45 €, gerade reserviert')
    expect(el(2).querySelector<HTMLElement>('[data-badge]')!.hidden).toBe(true)
    expect(el(2).getAttribute('aria-label')).toBe('Stück 2, 45 €')
    expect(el(3).getAttribute('aria-label')).toBe('Stück 3, 45 €, verkauft')
    expect(el(4).getAttribute('data-status')).toBe('gone')
    expect(el(4).getAttribute('aria-label')).toBe('Stück 4, 45 €, nicht mehr da')
    expect(states).toEqual([
      { id: '1', state: 'reserved' },
      { id: '2', state: 'available' },
      { id: '3', state: 'sold' },
      { id: '4', state: 'gone' },
    ])
    expect(sold).toEqual([{ id: '3' }])
    unmount()
    document.removeEventListener(PRODUCT_STATE_EVENT, onState)
    document.removeEventListener(SOLD_EVENT, onSold)
  })

  it('unveränderter Zustand → keine Ereignisse; unbekannte Werte werden ignoriert', async () => {
    const root = setup(`<ul data-behavior="product-status" ${LABELS}>${card(1)}${card(2)}</ul>`)
    respond({ 1: 'available', 2: 'deleted' })
    const events: unknown[] = []
    const on = (e: Event) => events.push(e)
    document.addEventListener(PRODUCT_STATE_EVENT, on)
    mount(root, { mode: 'app' })
    await flush()
    expect(events).toEqual([])
    document.removeEventListener(PRODUCT_STATE_EVENT, on)
  })

  it('nach unmount wird eine späte Antwort nicht mehr angewandt', async () => {
    const root = setup(`<ul data-behavior="product-status" ${LABELS}>${card(1)}</ul>`)
    respond({ 1: 'sold' })
    mount(root, { mode: 'app' })()
    await flush()
    expect(document.querySelector('[data-product-card]')!.getAttribute('data-status')).toBe(
      'available',
    )
    expect(root.hasAttribute('data-status-live')).toBe(false)
  })

  it('relabel tauscht nur den Zusatz', () => {
    const suffix = (s: string) => ({ reserved: ', r', sold: ', s' })[s] ?? ''
    expect(relabel('Vase, 45 €, r', 'reserved', 'sold', suffix)).toBe('Vase, 45 €, s')
    expect(relabel('Vase, 45 €', 'available', 'reserved', suffix)).toBe('Vase, 45 €, r')
  })
})

describe('AK-DS-18 product-status', () => {
  it('mount → unmount entfernt alles; zweites mount auf neuem DOM funktioniert', async () => {
    for (const mode of ['app', 'preview'] as const) {
      const root = setup(`<ul data-behavior="product-status" ${LABELS}>${card(1)}</ul>`)
      respond({ 1: 'reserved' })
      const unmount = mount(root, { mode })
      await flush()
      unmount()
      expect(tracker.openListeners(), mode).toEqual([])
      expect(tracker.openObservers(), mode).toEqual([])
      expect(vi.getTimerCount(), mode).toBe(0)
      expect(document.getAnimations(), mode).toEqual([])
    }
  })
})
