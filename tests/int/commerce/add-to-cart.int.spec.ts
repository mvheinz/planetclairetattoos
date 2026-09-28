import type { Payload } from 'payload'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import { addToCart, productStates, type AddToCartRequest } from '@/lib/commerce/cart'
import {
  CART_MAX_ITEMS,
  decodeCartCookie,
  encodeCartCookie,
  type CartCookie,
} from '@/lib/commerce/cartCookie'
import { handleProductStatus, STATUS_MAX_IDS } from '@/lib/commerce/productStatus'
import { resetEnvCache } from '@/lib/env'

import { getTestPayload } from '../helpers/payload'
import {
  completeProduct,
  createProduct,
  createProductFixtures,
  deleteProducts,
  type ProductFixtures,
} from '../helpers/products'

// P3.11 „In den Korb“ und Live-Zustand (KONZEPT §4.2, AK-3-08; ARCHITEKTUR §8.5, §8.7, §9.3): Dienst
// `src/lib/commerce/cart.ts` (Zustände, Grenzen, Shop geschlossen, Cookie-Inhalt) und `GET /api/public/product-status`.
// Fixture-Nummern 980–999 (Local API, `seed: false`).

let payload: Payload
let fx: ProductFixtures
let ipCounter = 0
const NUMBERS = Array.from({ length: 20 }, (_, i) => 980 + i)
const NOW = new Date('2026-09-28T10:00:00.000Z')
const day = (d: number) => new Date(Date.UTC(2026, 8, d, 10)).toISOString()

/** Eigene IP je Aufruf-Serie, damit das Rate-Limit nur dort greift, wo es geprüft wird. */
const freshIp = () => `10.3.11.${++ipCounter}`

async function piece(nr: number, extra: Record<string, unknown> = {}, category = 'keramik') {
  const doc = await createProduct(
    payload,
    completeProduct(category as never, nr, fx, {
      status: 'available',
      firstPublishedAt: day(1),
      ...extra,
    }),
  )
  return doc.id as number
}

const request = (productId: number, over: Partial<AddToCartRequest> = {}): AddToCartRequest => ({
  productId,
  locale: 'de',
  cookie: null,
  ip: freshIp(),
  now: NOW,
  ...over,
})

const cookieOf = (
  items: { id: number; p: number }[],
  delivery: CartCookie['delivery'] = 'shipping',
) => encodeCartCookie({ v: 1, items, delivery })

async function setShop(shop: Record<string, unknown>) {
  const before = await payload.findGlobal({ slug: 'settings', overrideAccess: true, depth: 0 })
  await payload.updateGlobal({
    slug: 'settings',
    data: { shop: { ...before.shop, ...shop } } as never,
    overrideAccess: true,
    locale: 'de',
    context: { seed: true },
  })
  return async () => {
    await payload.updateGlobal({
      slug: 'settings',
      data: { shop: before.shop } as never,
      overrideAccess: true,
      locale: 'de',
      context: { seed: true },
    })
  }
}

beforeAll(async () => {
  payload = await getTestPayload()
  fx = await createProductFixtures(payload)
})

afterEach(async () => {
  vi.unstubAllEnvs()
  resetEnvCache()
  await deleteProducts(payload, NUMBERS)
})

afterAll(async () => {
  vi.unstubAllEnvs()
  resetEnvCache()
})

describe('Hinzufügen – Erfolg und Cookie-Inhalt', () => {
  it('available → ok, neues Cookie nur mit id, p (DB-Preis in Cent) und Lieferart shipping', async () => {
    const id = await piece(980, { priceCents: 4500 })
    const out = await addToCart(request(id), payload)
    expect(out.response).toEqual({ ok: true, added: true, count: 1, state: 'available' })
    expect(decodeCartCookie(out.cookie!)).toEqual({
      v: 1,
      items: [{ id, p: 4500 }],
      delivery: 'shipping',
    })
    expect(Buffer.from(out.cookie!, 'base64url').toString('utf8')).toBe(
      `{"v":1,"items":[{"id":${id},"p":4500}],"delivery":"shipping"}`,
    )
    expect(out.product).toMatchObject({ id, itemNumber: 980 })
  })

  it('dasselbe Stück zweimal → kein Duplikat, Cookie unverändert (kein neuer Wert)', async () => {
    const id = await piece(981)
    const cookie = cookieOf([{ id, p: 4500 }])
    const out = await addToCart(request(id, { cookie }), payload)
    expect(out.response).toEqual({ ok: true, added: false, count: 1, state: 'available' })
    expect(out.cookie).toBeNull()
  })

  it('das 21. Stück wird abgelehnt (cart_full), Cookie unverändert', async () => {
    const id = await piece(982)
    const full = Array.from({ length: CART_MAX_ITEMS }, (_, i) => ({ id: 900_000 + i, p: 100 }))
    const out = await addToCart(request(id, { cookie: cookieOf(full) }), payload)
    expect(out.response).toMatchObject({ ok: false, code: 'cart_full', state: 'available' })
    expect(out.cookie).toBeNull()
    // Das 20. Stück passt noch.
    const nineteen = full.slice(0, CART_MAX_ITEMS - 1)
    const ok = await addToCart(request(id, { cookie: cookieOf(nineteen) }), payload)
    expect(ok.response).toMatchObject({ ok: true, added: true, count: 20 })
  })

  it('ungültiges oder manipuliertes Cookie → als leer behandelt und neu geschrieben', async () => {
    const id = await piece(983)
    for (const cookie of [
      'kaputt',
      Buffer.from(
        '{"v":1,"items":[{"id":1,"p":1,"email":"a@b.de"}],"delivery":"shipping"}',
      ).toString('base64url'),
      Buffer.from('{"v":1,"items":[{"id":5,"p":1},{"id":5,"p":1}],"delivery":"shipping"}').toString(
        'base64url',
      ),
    ]) {
      const out = await addToCart(request(id, { cookie }), payload)
      expect(out.response).toMatchObject({ ok: true, added: true, count: 1 })
      expect(decodeCartCookie(out.cookie!)!.items).toEqual([{ id, p: 4500 }])
    }
  })

  it('manipuliertes p ändert keinen Preis: neues Stück bekommt den DB-Preis, fremdes p bleibt nur Merkwert', async () => {
    const a = await piece(984, { priceCents: 3800 })
    const b = await piece(985, { priceCents: 6200 })
    const out = await addToCart(request(b, { cookie: cookieOf([{ id: a, p: 1 }]) }), payload)
    expect(decodeCartCookie(out.cookie!)!.items).toEqual([
      { id: a, p: 1 },
      { id: b, p: 6200 },
    ])
  })

  it('Lieferart: Standard shipping, nur_abholung erzwingt pickup, pickup bleibt pickup', async () => {
    const pickupOnly = await piece(986, { shippingClass: 'nur_abholung' }, 'sonstiges')
    const normal = await piece(987)
    const first = await addToCart(request(pickupOnly), payload)
    expect(decodeCartCookie(first.cookie!)!.delivery).toBe('pickup')
    const second = await addToCart(request(normal, { cookie: first.cookie }), payload)
    expect(decodeCartCookie(second.cookie!)!.delivery).toBe('pickup')
    const alone = await addToCart(request(normal), payload)
    expect(decodeCartCookie(alone.cookie!)!.delivery).toBe('shipping')
  })
})

describe('AK-3-08 Ablehnung mit aktuellem Zustand', () => {
  it('reserviert, verkauft (Archiv), verkauft ohne Archiv, Entwurf, archiviert, unbekannt', async () => {
    const reserved = await piece(988, {
      status: 'reserved',
      reservedUntil: day(28),
      reservationRef: 'res-p311',
    })
    const sold = await piece(989, {
      status: 'sold',
      soldAt: day(20),
      soldChannel: 'offline',
      showInArchiveAfterSale: true,
    })
    const soldHidden = await piece(990, {
      status: 'sold',
      soldAt: day(20),
      soldChannel: 'offline',
      showInArchiveAfterSale: false,
    })
    const draft = await piece(991, { status: 'draft', firstPublishedAt: undefined })
    const archived = await piece(992, { status: 'archived', archivedAt: day(5) })
    const cases: [number, string][] = [
      [reserved, 'reserved'],
      [sold, 'sold'],
      [soldHidden, 'gone'],
      [draft, 'gone'],
      [archived, 'gone'],
      [2_000_000_000, 'gone'],
    ]
    for (const [id, state] of cases) {
      const out = await addToCart(request(id), payload)
      expect(out.response, String(id)).toEqual({
        ok: false,
        code: 'product_unavailable',
        state,
        message: null,
      })
      expect(out.cookie).toBeNull()
    }
    // Nur öffentliche Stücke verraten ihre Eckdaten (Weiterleitung ohne JavaScript).
    expect((await addToCart(request(draft), payload)).product).toBeNull()
    expect((await addToCart(request(reserved), payload)).product).toMatchObject({ itemNumber: 988 })
  })

  it('Seed-Stück außerhalb der Vorschau (SEED_PREVIEW_MODE=false) gilt als nicht öffentlich', async () => {
    vi.stubEnv('SEED_PREVIEW_MODE', 'false')
    resetEnvCache()
    const id = await piece(993, { seed: true })
    const out = await addToCart(request(id), payload)
    expect(out.response).toMatchObject({ ok: false, code: 'product_unavailable', state: 'gone' })
  })

  it('Shop geschlossen (settings.shop.isOpen = false) → shop_closed mit closedMessage, kein Cookie', async () => {
    const id = await piece(994)
    const restore = await setShop({ isOpen: false, closedMessage: 'Ich bin im Urlaub.' })
    try {
      const out = await addToCart(request(id), payload)
      expect(out.response).toEqual({
        ok: false,
        code: 'shop_closed',
        state: 'available',
        message: 'Ich bin im Urlaub.',
      })
      expect(out.cookie).toBeNull()
    } finally {
      await restore()
    }
    const open = await addToCart(request(id), payload)
    expect(open.response).toMatchObject({ ok: true, added: true })
  })
})

describe('Rate-Limit cart_add (60 / 10 min je IP-Hash)', () => {
  it('der 61. Versuch derselben IP im Fenster wird abgelehnt, andere IPs nicht', async () => {
    const id = await piece(995)
    const ip = '10.3.11.250'
    for (let i = 0; i < 60; i++) {
      const out = await addToCart(request(id, { ip }), payload)
      expect(out.response.ok, `Versuch ${i + 1}`).toBe(true)
    }
    const blocked = await addToCart(request(id, { ip }), payload)
    expect(blocked.response).toEqual({
      ok: false,
      code: 'rate_limited',
      state: null,
      message: null,
    })
    expect(blocked.cookie).toBeNull()
    expect((await addToCart(request(id), payload)).response.ok).toBe(true)
    // Neues Fenster (10 min später) → wieder erlaubt.
    const later = new Date(NOW.getTime() + 10 * 60 * 1000)
    expect((await addToCart(request(id, { ip, now: later }), payload)).response.ok).toBe(true)
  })
})

describe('GET /api/public/product-status', () => {
  const get = (query: string, ip = freshIp(), now = NOW) =>
    handleProductStatus(
      new Request(`http://localhost/api/public/product-status${query}`, {
        headers: { 'x-forwarded-for': ip },
      }),
      payload,
      now,
    )

  it('je ID nur available | reserved | sold | gone; no-store; kein Set-Cookie', async () => {
    const a = await piece(980)
    const r = await piece(981, { status: 'reserved', reservedUntil: day(28), reservationRef: 'x' })
    const s = await piece(982, {
      status: 'sold',
      soldAt: day(20),
      soldChannel: 'offline',
      showInArchiveAfterSale: true,
    })
    const d = await piece(983, { status: 'draft', firstPublishedAt: undefined })
    const res = await get(`?ids=${a},${r},${s},${d},2000000000`)
    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toBe('no-store')
    expect(res.headers.get('set-cookie')).toBeNull()
    expect(await res.json()).toEqual({
      [a]: 'available',
      [r]: 'reserved',
      [s]: 'sold',
      [d]: 'gone',
      '2000000000': 'gone',
    })
    expect(await productStates(payload, [a])).toEqual({ [a]: 'available' })
  })

  it(`ungültige Abfragen → 400 (zod): leer, Text, mehr als ${STATUS_MAX_IDS} IDs, 0`, async () => {
    const many = Array.from({ length: STATUS_MAX_IDS + 1 }, (_, i) => i + 1).join(',')
    for (const q of ['', '?ids=', '?ids=abc', '?ids=1,,2', `?ids=${many}`, '?ids=0', '?ids=1;2']) {
      const res = await get(q)
      expect(res.status, q).toBe(400)
      expect(res.headers.get('cache-control')).toBe('no-store')
    }
    const ok = await get(
      `?ids=${Array.from({ length: STATUS_MAX_IDS }, (_, i) => i + 1).join(',')}`,
    )
    expect(ok.status).toBe(200)
  })

  it('Rate-Limit product_status: 120 / min je IP-Hash → 429 mit Retry-After', async () => {
    const ip = '10.3.11.251'
    const now = new Date('2026-09-28T11:00:05.000Z')
    for (let i = 0; i < 120; i++) expect((await get('?ids=1', ip, now)).status).toBe(200)
    const blocked = await get('?ids=1', ip, now)
    expect(blocked.status).toBe(429)
    expect(Number(blocked.headers.get('retry-after'))).toBe(55)
    expect(blocked.headers.get('cache-control')).toBe('no-store')
  })
})
