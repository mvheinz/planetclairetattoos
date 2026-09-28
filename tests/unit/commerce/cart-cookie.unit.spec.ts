import { describe, expect, it } from 'vitest'

import {
  CART_COOKIE,
  CART_COOKIE_MAX_AGE,
  CART_MAX_ITEMS,
  cartCookieAttributes,
  cartCountFromCookies,
  cartFromCookies,
  decodeCartCookie,
  encodeCartCookie,
  findCartCookie,
  isLocalHost,
  type CartCookie,
} from '@/lib/commerce/cartCookie'
import { BUY_NOTE_CODES, BUY_NOTE_FRAGMENTS, buyFragment } from '@/lib/shop/buyArea'

// P3.11 Korb-Cookie `pc_cart` (ARCHITEKTUR §8.7, T-04/R-130/EK-04): Format, Manipulation, Attribute.

const cart = (n: number, delivery: CartCookie['delivery'] = 'shipping'): CartCookie => ({
  v: 1,
  items: Array.from({ length: n }, (_, i) => ({ id: i + 1, p: 4500 + i })),
  delivery,
})
const raw = (obj: unknown) => Buffer.from(JSON.stringify(obj)).toString('base64url')

describe('Serialisieren und Parsen', () => {
  it('encode → base64url-JSON genau im Format {"v":1,"items":[{"id","p"}],"delivery"} (ohne Padding)', () => {
    const value = encodeCartCookie({ v: 1, items: [{ id: 12, p: 4500 }], delivery: 'shipping' })
    expect(value).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(Buffer.from(value, 'base64url').toString('utf8')).toBe(
      '{"v":1,"items":[{"id":12,"p":4500}],"delivery":"shipping"}',
    )
    expect(decodeCartCookie(value)).toEqual({
      v: 1,
      items: [{ id: 12, p: 4500 }],
      delivery: 'shipping',
    })
  })

  it('Rundreise mit 20 Stücken und Lieferart pickup; Reihenfolge bleibt', () => {
    const full = cart(CART_MAX_ITEMS, 'pickup')
    expect(decodeCartCookie(encodeCartCookie(full))).toEqual(full)
    expect(CART_MAX_ITEMS).toBe(20)
  })

  it('encode schreibt nur id und p (keine weiteren Felder, keine Kennung)', () => {
    const tainted = {
      v: 1,
      items: [{ id: 3, p: 100, name: 'Erika' }],
      delivery: 'shipping',
    } as unknown as CartCookie
    const text = Buffer.from(encodeCartCookie(tainted), 'base64url').toString('utf8')
    expect(JSON.parse(text)).toEqual({ v: 1, items: [{ id: 3, p: 100 }], delivery: 'shipping' })
  })

  it('findCartCookie/cartFromCookies/cartCountFromCookies lesen aus dem Cookie-String', () => {
    const value = encodeCartCookie(cart(3))
    const header = `foo=1; ${CART_COOKIE}=${value}; bar=2`
    expect(findCartCookie(header)).toBe(value)
    expect(findCartCookie('pc_cart_other=1')).toBeNull()
    expect(cartFromCookies(header).items.map((i) => i.id)).toEqual([1, 2, 3])
    expect(cartCountFromCookies(header)).toBe(3)
    expect(cartCountFromCookies('')).toBe(0)
  })
})

describe('Manipulation → ungültig (Server behandelt den Korb als leer und schreibt neu)', () => {
  it.each([
    ['kein base64url', '%%%'],
    ['kein JSON', Buffer.from('nicht json').toString('base64url')],
    ['falsche Version', raw({ v: 2, items: [], delivery: 'shipping' })],
    ['items kein Array', raw({ v: 1, items: {}, delivery: 'shipping' })],
    ['id als Text', raw({ v: 1, items: [{ id: '1', p: 100 }], delivery: 'shipping' })],
    ['id 0', raw({ v: 1, items: [{ id: 0, p: 100 }], delivery: 'shipping' })],
    ['p negativ', raw({ v: 1, items: [{ id: 1, p: -1 }], delivery: 'shipping' })],
    ['p als Kommazahl', raw({ v: 1, items: [{ id: 1, p: 1.5 }], delivery: 'shipping' })],
    ['Zusatzfeld im Stück', raw({ v: 1, items: [{ id: 1, p: 1, n: 'x' }], delivery: 'shipping' })],
    ['Zusatzfeld im Korb', raw({ v: 1, items: [], delivery: 'shipping', uid: 'abc' })],
    [
      'doppeltes Stück',
      raw({
        v: 1,
        items: [
          { id: 1, p: 1 },
          { id: 1, p: 1 },
        ],
        delivery: 'shipping',
      }),
    ],
    ['unbekannte Lieferart', raw({ v: 1, items: [], delivery: 'drone' })],
    ['21 Stücke', encodeCartCookie({ ...cart(20), items: [...cart(21).items] })],
    ['Array statt Objekt', raw([1, 2])],
  ])('%s → null (leer)', (_name, value) => {
    expect(decodeCartCookie(value)).toBeNull()
    expect(cartFromCookies(`${CART_COOKIE}=${value}`)).toEqual({
      v: 1,
      items: [],
      delivery: 'shipping',
    })
  })

  it('manipuliertes p bleibt nur Merkwert (Format gültig) – den Preis rechnet der Server aus der DB', () => {
    const value = raw({ v: 1, items: [{ id: 7, p: 1 }], delivery: 'shipping' })
    expect(decodeCartCookie(value)).toEqual({
      v: 1,
      items: [{ id: 7, p: 1 }],
      delivery: 'shipping',
    })
  })
})

describe('Attribute (ARCHITEKTUR §8.7)', () => {
  it('Path=/; SameSite=Lax; Secure außer localhost; Max-Age=604800; nicht HttpOnly', () => {
    expect(cartCookieAttributes('planetclairetattoos.com')).toEqual({
      path: '/',
      sameSite: 'lax',
      secure: true,
      maxAge: 604_800,
      httpOnly: false,
    })
    expect(CART_COOKIE_MAX_AGE).toBe(7 * 24 * 60 * 60)
    for (const host of ['localhost:3000', 'localhost', '127.0.0.1:3000', '[::1]:3000'])
      expect(cartCookieAttributes(host).secure, host).toBe(false)
    expect(cartCookieAttributes(null).secure).toBe(true)
    expect(isLocalHost('localhost.example.com')).toBe(false)
  })
})

describe('Fragmente ohne JavaScript (303 der Server-Action)', () => {
  it('Erfolg → #in-cart, sonst eine Meldung je Code (eindeutige IDs)', () => {
    expect(buyFragment({ ok: true, added: true, count: 1, state: 'available' })).toBe('in-cart')
    expect(buyFragment({ ok: true, added: false, count: 1, state: 'available' })).toBe('in-cart')
    expect(buyFragment({ ok: false, code: 'cart_full', state: 'available', message: null })).toBe(
      'cart-full',
    )
    const ids = BUY_NOTE_CODES.map((c) => BUY_NOTE_FRAGMENTS[c])
    expect(new Set([...ids, 'in-cart']).size).toBe(BUY_NOTE_CODES.length + 1)
  })
})
