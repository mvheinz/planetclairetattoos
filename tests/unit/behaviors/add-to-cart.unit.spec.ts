// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  CART_ITEM_EVENT,
  CONFIRM_MS,
  HOP_MS,
  hopKeyframes,
  mount,
  viewFor,
} from '@/behaviors/add-to-cart'
import { mount as mountCartCount } from '@/behaviors/cart-count'
import {
  CART_CHANGE_EVENT,
  PRODUCT_STATE_EVENT,
  SOLD_EVENT,
  type BehaviorContext,
} from '@/behaviors/types'
import { encodeCartCookie, type AddToCartResponse } from '@/lib/commerce/cartCookie'
import { installCartDemo } from '@/preview-runtime/cartDemo'

import { installTracker, type Tracker } from './harness'

// P3.11 `add-to-cart` (DESIGN KO-11, MI-01, MI-07; KONZEPT §3.4 Nr. 6, §4.2; AK-DS-18): „In den Korb“ ohne
// Seitenwechsel über die hereingereichte Server-Action, Zustände je Antwort, Vorschau nur Anzeige.

let tracker: Tracker
let animated: { el: Element; keyframes: Keyframe[]; options: KeyframeAnimationOptions }[]

const form = (id: number, extra = '') =>
  `<form data-behavior="add-to-cart" data-product-id="${id}" data-text-add="In den Korb" ` +
  `data-text-reserved="Gerade reserviert – schau in 30 Minuten nochmal"${extra}>` +
  `<input type="hidden" name="productId" value="${id}"><input type="hidden" name="itemNumber" value="${id}">` +
  `<input type="hidden" name="locale" value="de"><button type="submit"><span>In den Korb</span></button></form>`

const area = (id: number, state = 'available', extra = '') =>
  `<div data-buy-area data-buy-state="${state}"><p id="in-cart" data-in-cart hidden>Liegt schon in deinem Korb ` +
  `<a href="/de/warenkorb">Zum Korb</a></p>${form(id, extra)}<div data-buy-notes aria-live="polite">` +
  `<p data-buy-confirm hidden>Liegt im Korb</p>` +
  ['cart_full', 'rate_limited', 'shop_closed', 'product_unavailable', 'invalid']
    .map((c) => `<p data-buy-note="${c}" hidden>${c}</p>`)
    .join('') +
  `</div><div data-sold-view hidden><p data-sold-text>Schon verkauft</p></div></div>`

const bar = (id: number) =>
  `<div data-buy-bar>${form(id)}<a href="/de/warenkorb" data-in-cart hidden>Zum Korb</a></div>`

const COCO = '<div class="coco" data-leash-coco><div class="coco__hop"></div></div>'

let cookieJar = ''
let cookieWrites: string[] = []

function setup(html: string) {
  document.body.innerHTML = html + COCO
  return Array.from(document.querySelectorAll<HTMLFormElement>('[data-behavior="add-to-cart"]'))
}

const q = <T extends Element = HTMLElement>(sel: string) => document.querySelector<T>(sel)!
const flush = () => vi.runAllTimersAsync()
const ok = (added = true, count = 1): AddToCartResponse => ({
  ok: true,
  added,
  count,
  state: 'available',
})
const no = (code: Extract<AddToCartResponse, { ok: false }>['code'], state = null as never) =>
  ({ ok: false, code, state, message: null }) as AddToCartResponse

function app(response: AddToCartResponse | Promise<AddToCartResponse>) {
  const addToCart = vi.fn((_fd: FormData) => Promise.resolve(response))
  const ctx: BehaviorContext = { mode: 'app', actions: { addToCart } }
  return { ctx, addToCart }
}

beforeEach(() => {
  vi.useFakeTimers()
  tracker = installTracker()
  cookieJar = ''
  cookieWrites = []
  Object.defineProperty(document, 'cookie', {
    configurable: true,
    get: () => cookieJar,
    set: (v: string) => {
      cookieWrites.push(v)
    },
  })
  animated = []
  const trackedAnimate = Element.prototype.animate
  Element.prototype.animate = function (keyframes, options) {
    animated.push({
      el: this,
      keyframes: keyframes as Keyframe[],
      options: options as KeyframeAnimationOptions,
    })
    return trackedAnimate.call(this, keyframes, options)
  }
})

afterEach(() => {
  tracker.restore()
  vi.useRealTimers()
  document.documentElement.removeAttribute('data-motion')
  document.body.innerHTML = ''
})

describe('Erfolg ohne Seitenwechsel', () => {
  it('ruft die Server-Action mit productId, itemNumber, locale und via=script; Knopf → „Liegt schon in deinem Korb“ + „Zum Korb“', async () => {
    const [f] = setup(area(17))
    const { ctx, addToCart } = app(ok())
    const unmount = mount(f!, ctx)
    const submit = new Event('submit', { cancelable: true, bubbles: true })
    f!.dispatchEvent(submit)
    expect(submit.defaultPrevented).toBe(true)
    await vi.advanceTimersByTimeAsync(0)
    expect(addToCart).toHaveBeenCalledTimes(1)
    const fd = addToCart.mock.calls[0]![0]
    expect(Object.fromEntries(fd.entries())).toEqual({
      productId: '17',
      itemNumber: '17',
      locale: 'de',
      via: 'script',
    })
    expect(f!.hidden).toBe(true)
    expect(q('[data-in-cart]').hidden).toBe(false)
    expect(q('[data-buy-area]').getAttribute('data-buy-state')).toBe('in-cart')
    expect(cookieWrites).toEqual([])
    unmount()
  })

  it('kurze Bestätigung „Liegt im Korb“ (3 s), MI-07 (CART_CHANGE_EVENT), MI-01 Coco-Hüpfer (nur transform)', async () => {
    const [f] = setup(area(17))
    const changes: Event[] = []
    const onChange = (e: Event) => changes.push(e)
    document.addEventListener(CART_CHANGE_EVENT, onChange)
    const unmount = mount(f!, app(ok()).ctx)
    f!.querySelector('button')!.focus()
    f!.requestSubmit()
    await vi.advanceTimersByTimeAsync(0)
    expect(q('[data-buy-confirm]').hidden).toBe(false)
    expect(changes).toHaveLength(1)
    const hop = animated.find((a) => a.el.matches('.coco__hop'))!
    expect(hop.options.duration).toBe(HOP_MS)
    expect(hop.keyframes.map((k) => k.transform)).toContain('translateY(-14px) scaleY(1)')
    expect(
      hop.keyframes.every((k) =>
        Object.keys(k).every((p) => ['offset', 'transform', 'easing'].includes(p)),
      ),
    ).toBe(true)
    // Fokus bleibt nutzbar: vom verborgenen Knopf auf „Zum Korb“.
    expect(document.activeElement?.textContent).toBe('Zum Korb')
    await vi.advanceTimersByTimeAsync(CONFIRM_MS)
    expect(q('[data-buy-confirm]').hidden).toBe(true)
    unmount()
    document.removeEventListener(CART_CHANGE_EVENT, onChange)
  })

  it('schon im Korb (added=false): keine Bestätigung, keine Zählung, kein Hüpfer', async () => {
    const [f] = setup(area(17))
    const changes: Event[] = []
    const onChange = (e: Event) => changes.push(e)
    document.addEventListener(CART_CHANGE_EVENT, onChange)
    mount(f!, app(ok(false)).ctx)
    f!.requestSubmit()
    await vi.advanceTimersByTimeAsync(0)
    expect(q('[data-in-cart]').hidden).toBe(false)
    expect(q('[data-buy-confirm]').hidden).toBe(true)
    expect(changes).toHaveLength(0)
    expect(animated).toHaveLength(0)
    document.removeEventListener(CART_CHANGE_EVENT, onChange)
  })

  it('reduzierte Bewegung: kein Hüpfer, Zustand sofort', async () => {
    document.documentElement.setAttribute('data-motion', 'reduced')
    const [f] = setup(area(17))
    mount(f!, app(ok()).ctx)
    f!.requestSubmit()
    await vi.advanceTimersByTimeAsync(0)
    expect(animated).toHaveLength(0)
    expect(q('[data-in-cart]').hidden).toBe(false)
  })

  it('Kauf-Leiste und Kaufbereich desselben Stücks wechseln gemeinsam', async () => {
    const [main, inBar] = setup(area(17) + bar(17))
    const { ctx } = app(ok())
    mount(main!, ctx)
    mount(inBar!, ctx)
    inBar!.requestSubmit()
    await vi.advanceTimersByTimeAsync(0)
    expect(main!.hidden).toBe(true)
    expect(inBar!.hidden).toBe(true)
    expect(q('[data-buy-bar] [data-in-cart]').hidden).toBe(false)
    expect(q('[data-buy-area] [data-in-cart]').hidden).toBe(false)
  })

  it('beim Binden: Stück laut pc_cart schon im Korb → sofort „Liegt schon in deinem Korb“, nichts geschrieben', () => {
    cookieJar = `pc_cart=${encodeCartCookie({ v: 1, items: [{ id: 17, p: 4500 }], delivery: 'shipping' })}`
    const [f] = setup(area(17))
    mount(f!, app(ok()).ctx)
    expect(f!.hidden).toBe(true)
    expect(q('[data-in-cart]').hidden).toBe(false)
    expect(cookieWrites).toEqual([])
  })

  it('ohne hereingereichte Action: normales Absenden (Weg ohne JavaScript)', () => {
    const [f] = setup(area(17))
    const submit = vi.fn()
    f!.submit = submit
    mount(f!, { mode: 'app' })
    f!.requestSubmit()
    expect(submit).toHaveBeenCalledTimes(1)
  })
})

describe('AK-3-08 Ablehnung zeigt den aktuellen Zustand', () => {
  it('verkauft (veraltete Seite) → „Schon verkauft“ statt Knopf, Stempel-Knall (SOLD_EVENT)', async () => {
    const [f] = setup(area(17))
    const sold: unknown[] = []
    const onSold = (e: Event) => sold.push((e as CustomEvent).detail)
    document.addEventListener(SOLD_EVENT, onSold)
    mount(f!, app(no('product_unavailable', 'sold' as never)).ctx)
    f!.requestSubmit()
    await vi.advanceTimersByTimeAsync(0)
    expect(f!.hidden).toBe(true)
    expect(q('[data-sold-view]').hidden).toBe(false)
    expect(q('[data-buy-area]').getAttribute('data-buy-state')).toBe('sold')
    expect(sold).toEqual([{ id: '17' }])
    document.removeEventListener(SOLD_EVENT, onSold)
  })

  it('reserviert → Knopf deaktiviert mit „Gerade reserviert – schau in 30 Minuten nochmal“', async () => {
    const [f] = setup(area(17))
    mount(f!, app(no('product_unavailable', 'reserved' as never)).ctx)
    f!.requestSubmit()
    await vi.advanceTimersByTimeAsync(0)
    const button = f!.querySelector('button')!
    expect(button.textContent).toBe('Gerade reserviert – schau in 30 Minuten nochmal')
    expect(button.disabled).toBe(true)
    expect(button.getAttribute('aria-disabled')).toBe('true')
  })

  it('nicht mehr öffentlich (gone) → Meldung, Knopf deaktiviert', async () => {
    const [f] = setup(area(17))
    mount(f!, app(no('product_unavailable', 'gone' as never)).ctx)
    f!.requestSubmit()
    await vi.advanceTimersByTimeAsync(0)
    expect(q('[data-buy-note="product_unavailable"]').hidden).toBe(false)
    expect(f!.querySelector('button')!.disabled).toBe(true)
  })

  it('Shop pausiert → closedMessage als Meldung, Knopf deaktiviert', async () => {
    const [f] = setup(area(17))
    const res: AddToCartResponse = {
      ok: false,
      code: 'shop_closed',
      state: 'available',
      message: 'Ich bin im Urlaub.',
    }
    mount(f!, app(res).ctx)
    f!.requestSubmit()
    await vi.advanceTimersByTimeAsync(0)
    expect(q('[data-buy-note="shop_closed"]').textContent).toBe('Ich bin im Urlaub.')
    expect(q('[data-buy-note="shop_closed"]').hidden).toBe(false)
    expect(f!.querySelector('button')!.disabled).toBe(true)
  })

  it('Korb voll / zu viele Versuche / Fehler → Meldung, Knopf bleibt', async () => {
    for (const code of ['cart_full', 'rate_limited', 'invalid'] as const) {
      const [f] = setup(area(17))
      const unmount = mount(f!, app(no(code)).ctx)
      f!.requestSubmit()
      await vi.advanceTimersByTimeAsync(0)
      expect(q(`[data-buy-note="${code}"]`).hidden, code).toBe(false)
      expect(f!.hidden, code).toBe(false)
      expect(f!.querySelector('button')!.disabled, code).toBe(false)
      unmount()
    }
  })

  it('Action wirft (Netz) → Fehlermeldung', async () => {
    const [f] = setup(area(17))
    mount(f!, app(Promise.reject(new Error('offline'))).ctx)
    f!.requestSubmit()
    await flush()
    expect(q('[data-buy-note="invalid"]').hidden).toBe(false)
  })

  it('viewFor: Abbildung der Antworten', () => {
    expect(viewFor(ok(), 'available')).toEqual({ view: 'in-cart', added: true })
    expect(viewFor(no('cart_full'), 'available')).toEqual({ view: 'available', note: 'cart_full' })
    expect(viewFor(no('product_unavailable', 'available' as never), 'available')).toEqual({
      view: 'gone',
      note: 'product_unavailable',
    })
  })
})

describe('Live-Zustand (product-status)', () => {
  it('PRODUCT_STATE_EVENT: reserviert → deaktiviert; wieder verfügbar → „In den Korb“; verkauft → Verkauft-Ansicht', () => {
    const [f] = setup(area(17))
    mount(f!, app(ok()).ctx)
    const live = (state: string) =>
      document.dispatchEvent(new CustomEvent(PRODUCT_STATE_EVENT, { detail: { id: '17', state } }))
    const button = f!.querySelector('button')!
    live('reserved')
    expect(button.disabled).toBe(true)
    expect(button.textContent).toContain('Gerade reserviert')
    live('available')
    expect(button.disabled).toBe(false)
    expect(button.textContent).toBe('In den Korb')
    live('sold')
    expect(f!.hidden).toBe(true)
    expect(q('[data-sold-view]').hidden).toBe(false)
  })

  it('P4.7 reservedByYou → „Du hast es gerade in der Kasse“ + „Zur Kasse“, Formular ausgeblendet', () => {
    document.body.innerHTML = area(17, 'reserved').replace(
      '<form',
      '<p data-in-checkout hidden>Du hast es gerade in der Kasse <a href="/de/kasse">Zur Kasse</a></p><form',
    )
    const f = document.querySelector<HTMLFormElement>('form')!
    mount(f, app(ok()).ctx)
    document.dispatchEvent(
      new CustomEvent(PRODUCT_STATE_EVENT, {
        detail: { id: '17', state: 'reserved', reservedByYou: true },
      }),
    )
    expect(f.hidden).toBe(true)
    expect(q('[data-in-checkout]').hidden).toBe(false)
    expect(q('[data-in-cart]').hidden).toBe(true)
    expect(q('[data-buy-area]').getAttribute('data-buy-state')).toBe('in-checkout')
  })

  it('anderes Stück → keine Änderung; Shop pausiert bleibt deaktiviert', () => {
    const [f] = setup(area(17, 'closed', ' data-closed'))
    mount(f!, app(ok()).ctx)
    document.dispatchEvent(
      new CustomEvent(PRODUCT_STATE_EVENT, { detail: { id: '99', state: 'sold' } }),
    )
    expect(f!.hidden).toBe(false)
    document.dispatchEvent(
      new CustomEvent(PRODUCT_STATE_EVENT, { detail: { id: '17', state: 'available' } }),
    )
    expect(f!.querySelector('button')!.disabled).toBe(true)
  })
})

describe('Modus preview', () => {
  it('nur Anzeige: kein Server-Aufruf, kein fetch, kein Cookie, kein Web-Storage', async () => {
    const [f] = setup(area(18))
    const { addToCart } = app(ok())
    const unmount = mount(f!, { mode: 'preview', actions: { addToCart } })
    f!.querySelector('button')!.click()
    await flush()
    unmount()
    expect(addToCart).not.toHaveBeenCalled()
    expect(q('[data-in-cart]').hidden).toBe(false)
    expect(tracker.sensitive).toEqual([])
  })

  it('mit Vorschau-Laufzeit: Korb-Anzeige zählt genau +1 im Speicher (MI-07), zweiter Klick nicht möglich', async () => {
    document.body.innerHTML =
      '<a data-behavior="cart-count"><span data-cart-count hidden></span></a>' + area(19) + COCO
    const demo = installCartDemo(document)
    const counter = q('[data-behavior="cart-count"]')
    const before = Number(counter.getAttribute('data-count') ?? '0')
    const offCount = mountCartCount(counter, { mode: 'preview' })
    const offAdd = mount(q('form'), { mode: 'preview' })
    q('form button').click()
    expect(counter.getAttribute('data-count')).toBe(String(before + 1))
    expect(q<HTMLFormElement>('form').hidden).toBe(true)
    q('form button').click()
    expect(demo.count()).toBe(1)
    offAdd()
    offCount()
    demo.destroy()
    await flush()
    expect(tracker.sensitive).toEqual([])
  })
})

describe('AK-DS-18 add-to-cart', () => {
  it('mount → unmount entfernt Listener, Timer (Bestätigung) und Animationen (Hüpfer); zweites mount funktioniert', async () => {
    for (const mode of ['app', 'preview'] as const) {
      const [f] = setup(area(mode === 'app' ? 20 : 21))
      const unmount = mount(f!, mode === 'app' ? app(ok()).ctx : { mode })
      if (mode === 'app') f!.requestSubmit()
      else f!.querySelector('button')!.click()
      await vi.advanceTimersByTimeAsync(0)
      expect(vi.getTimerCount(), mode).toBe(1)
      expect(document.getAnimations().length, mode).toBe(1)
      unmount()
      expect(tracker.openListeners(), mode).toEqual([])
      expect(vi.getTimerCount(), mode).toBe(0)
      expect(document.getAnimations(), mode).toEqual([])
    }
  })

  it('Ereignis CART_ITEM_EVENT hält alle Formulare eines Stücks gleich', () => {
    const [f] = setup(area(22))
    const unmount = mount(f!, app(ok()).ctx)
    document.dispatchEvent(
      new CustomEvent(CART_ITEM_EVENT, { detail: { id: '22', view: 'in-cart' } }),
    )
    expect(f!.hidden).toBe(true)
    unmount()
  })

  it('hopKeyframes: 83 ms Abspringen, −14 px, Landung scaleY(0.92)', () => {
    const k = hopKeyframes('a', 'b')
    expect(k[0]!.offset).toBe(0)
    expect(k.at(-1)!.offset).toBe(1)
    expect(k.map((f) => f.transform)).toContain('translateY(0) scaleY(0.92)')
    expect(HOP_MS).toBe(523)
  })
})
