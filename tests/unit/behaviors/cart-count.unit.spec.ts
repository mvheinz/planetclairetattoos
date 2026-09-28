// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { CART_CHANGE_EVENT, mount } from '@/behaviors/cart-count'
import {
  cartCountFromCookies,
  CART_COOKIE,
  decodeCartCookie,
  findCartCookie,
} from '@/lib/commerce/cartCookie'

// P2.6 `cart-count` (KO-02, DESIGN §9.12, MI-07): liest `pc_cart` nur, wenn es existiert, setzt nichts.

const encode = (obj: unknown) =>
  btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const cartValue = (n: number) =>
  encode({
    v: 1,
    items: Array.from({ length: n }, (_, i) => ({ id: i + 1, p: 3850 })),
    delivery: 'shipping',
  })

let cookieJar = ''
let cookieWrites: string[] = []
let animateCalls: { keyframes: Keyframe[]; options: KeyframeAnimationOptions }[] = []

beforeEach(() => {
  cookieJar = ''
  cookieWrites = []
  animateCalls = []
  Object.defineProperty(document, 'cookie', {
    configurable: true,
    get: () => cookieJar,
    set: (v: string) => {
      cookieWrites.push(v)
    },
  })
  Element.prototype.animate = function (keyframes, options) {
    animateCalls.push({
      keyframes: keyframes as Keyframe[],
      options: options as KeyframeAnimationOptions,
    })
    return { cancel: vi.fn(), onfinish: null } as unknown as Animation
  }
  document.documentElement.style.setProperty('--ease-stamp', 'cubic-bezier(0.18, 1.6, 0.4, 1)')
  document.body.innerHTML =
    '<a href="/de/korb" data-behavior="cart-count">Korb <span data-cart-count hidden></span></a>'
})

afterEach(() => {
  delete (document as unknown as { cookie?: string }).cookie
  document.documentElement.removeAttribute('data-motion')
  document.body.innerHTML = ''
})

const root = () => document.querySelector('[data-behavior="cart-count"]')!
const badge = () => document.querySelector<HTMLElement>('[data-cart-count]')!
const change = (detail?: { count: number }) =>
  document.dispatchEvent(new CustomEvent(CART_CHANGE_EVENT, { detail }))

describe('pc_cart lesen (ARCHITEKTUR §8.7)', () => {
  it('dekodiert base64url-JSON und zählt die Stücke', () => {
    expect(cartCountFromCookies(`foo=1; ${CART_COOKIE}=${cartValue(3)}; bar=2`)).toBe(3)
    expect(decodeCartCookie(cartValue(1))).toEqual({
      v: 1,
      items: [{ id: 1, p: 3850 }],
      delivery: 'shipping',
    })
  })

  it('fehlendes oder ungültiges Cookie ergibt 0', () => {
    expect(findCartCookie('pc_cart_other=1')).toBeNull()
    expect(cartCountFromCookies('')).toBe(0)
    expect(cartCountFromCookies(`${CART_COOKIE}=kaputt`)).toBe(0)
    expect(cartCountFromCookies(`${CART_COOKIE}=${encode({ v: 2, items: [] })}`)).toBe(0)
    expect(cartCountFromCookies(`${CART_COOKIE}=${cartValue(21)}`)).toBe(0)
    expect(
      cartCountFromCookies(`${CART_COOKIE}=${encode({ v: 1, items: [{ id: 'x', p: 1 }] })}`),
    ).toBe(0)
  })
})

describe('cart-count im Modus app', () => {
  it('ohne pc_cart: keine Anzahl, nichts gesetzt', () => {
    const unmount = mount(root())
    expect(badge().hidden).toBe(true)
    expect(badge().textContent).toBe('')
    expect(root().getAttribute('data-count')).toBe('0')
    unmount()
    expect(cookieWrites).toEqual([])
  })

  it('mit pc_cart: zeigt die Anzahl ohne Hüpfen beim ersten Zeichnen', () => {
    cookieJar = `${CART_COOKIE}=${cartValue(2)}`
    const unmount = mount(root(), { mode: 'app' })
    expect(badge().hidden).toBe(false)
    expect(badge().textContent).toBe('2')
    expect(animateCalls).toEqual([])
    unmount()
    expect(cookieWrites).toEqual([])
  })

  it('MI-07 Änderung → Cookie neu lesen, Zahl hüpft (scale 1 → 1.25 → 1, 240 ms, --ease-stamp)', () => {
    cookieJar = `${CART_COOKIE}=${cartValue(1)}`
    const unmount = mount(root())
    cookieJar = `${CART_COOKIE}=${cartValue(2)}`
    change()
    expect(badge().textContent).toBe('2')
    expect(animateCalls).toHaveLength(1)
    expect(animateCalls[0]!.keyframes).toEqual([
      { transform: 'scale(1)' },
      { transform: 'scale(1.25)' },
      { transform: 'scale(1)' },
    ])
    expect(animateCalls[0]!.options).toEqual({
      duration: 240,
      easing: 'cubic-bezier(0.18, 1.6, 0.4, 1)',
    })
    // Gleiche Anzahl → kein erneutes Hüpfen.
    change()
    expect(animateCalls).toHaveLength(1)
    unmount()
    expect(cookieWrites).toEqual([])
  })

  it('MI-07 bei reduzierter Bewegung wechselt die Zahl sofort ohne Animation', () => {
    document.documentElement.setAttribute('data-motion', 'reduced')
    cookieJar = `${CART_COOKIE}=${cartValue(1)}`
    const unmount = mount(root())
    cookieJar = `${CART_COOKIE}=${cartValue(3)}`
    change()
    expect(badge().textContent).toBe('3')
    expect(animateCalls).toEqual([])
    unmount()
  })

  it('nach unmount keine Reaktion mehr auf Änderungen', () => {
    const unmount = mount(root())
    unmount()
    cookieJar = `${CART_COOKIE}=${cartValue(4)}`
    change()
    expect(badge().hidden).toBe(true)
  })
})

describe('cart-count im Modus preview', () => {
  it('zählt nur im Speicher aus dem Ereignis, liest und setzt kein Cookie', () => {
    const reads = vi.fn(() => cookieJar)
    Object.defineProperty(document, 'cookie', { configurable: true, get: reads, set: reads })
    let unmount = mount(root(), { mode: 'preview' })
    change({ count: 0 })
    expect(badge().hidden).toBe(true)
    change({ count: 1 })
    expect(badge().textContent).toBe('1')
    expect(animateCalls).toHaveLength(1)
    unmount()
    // Seitenwechsel in der Vorschau: neues DOM, Anzahl bleibt im Speicher.
    document.body.innerHTML =
      '<a data-behavior="cart-count">Basket <span data-cart-count hidden></span></a>'
    unmount = mount(root(), { mode: 'preview' })
    expect(badge().textContent).toBe('1')
    unmount()
    expect(reads).not.toHaveBeenCalled()
  })
})
