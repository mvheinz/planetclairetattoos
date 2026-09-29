import { createLocalReq, type Payload } from 'payload'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import {
  evaluateCart,
  readCart,
  removeFromCart,
  reservedByYou,
  setDeliveryMethod,
} from '@/lib/commerce/cart'
import { decodeCartCookie, encodeCartCookie } from '@/lib/commerce/cartCookie'
import { startCheckout, type StartCheckoutResult } from '@/lib/commerce/checkout'
import { transitionCheckout } from '@/lib/commerce/checkoutTransitions'
import { handleProductStatus } from '@/lib/commerce/productStatus'
import { __setPaymentsAdapterForTests } from '@/lib/payments'
import { __setSystemFilesForTests } from '@/lib/storage/systemFiles'

import {
  cartOf,
  checkoutById,
  piece as makePiece,
  productRow,
  reservationsOf,
  testClock,
  useMemorySystemFiles,
  useMockPayments,
  type TestClock,
} from '../helpers/checkout'
import { deleteCommerce } from '../helpers/commerce'
import { getTestPayload } from '../helpers/payload'
import { createProductFixtures, deleteProducts, type ProductFixtures } from '../helpers/products'

// P4.7 Warenkorb-Aktionen (KONZEPT §4.2, §4.11 S6/S12; DATENMODELL §6.25.3): Entfernen (offene Kasse → `cart_changed`,
// Freigabe; `confirming` → abgelehnt), Lieferart (AK-4-02, Reservierung bleibt), Bewertung mit DB-Preis, und
// `reservedByYou` in `GET /api/public/product-status`. Fixture-Nummern 980–999, Uhr injiziert.

let payload: Payload
let fx: ProductFixtures
let clock: TestClock
let ipCounter = 0
const NUMBERS = Array.from({ length: 20 }, (_, i) => 980 + i)
const T0 = '2026-09-28T10:00:00.000Z'

const piece = (nr: number, extra: Record<string, unknown> = {}) => makePiece(payload, fx, nr, extra)

type Ok = Extract<StartCheckoutResult, { ok: true }>
async function started(ids: number[], delivery: 'shipping' | 'pickup' = 'shipping'): Promise<Ok> {
  const r = await startCheckout(
    {
      cart: cartOf(
        ids.map((id) => ({ id })),
        delivery,
      ),
      locale: 'de',
      existingToken: null,
      now: clock.now(),
    },
    { payload },
  )
  if (!r.ok) throw new Error(JSON.stringify(r))
  return r
}

const cookieOf = (ids: number[], delivery: 'shipping' | 'pickup' = 'shipping') =>
  encodeCartCookie(
    cartOf(
      ids.map((id) => ({ id })),
      delivery,
    ),
  )

beforeAll(async () => {
  payload = await getTestPayload()
  fx = await createProductFixtures(payload)
})

beforeEach(() => {
  clock = testClock(T0)
  useMockPayments(clock)
  useMemorySystemFiles()
})

afterEach(async () => {
  await deleteCommerce(payload)
  await deleteProducts(payload, NUMBERS)
})

afterAll(() => {
  __setPaymentsAdapterForTests(undefined)
  __setSystemFilesForTests(undefined)
})

describe('readCart – tolerant (Cookie ist nur Merkliste)', () => {
  it('fehlend, kaputt oder manipuliert → leerer Korb; gültig → Inhalt', () => {
    const empty = { v: 1, items: [], delivery: 'shipping' }
    expect(readCart(undefined)).toEqual(empty)
    expect(readCart('%%%')).toEqual(empty)
    expect(
      readCart(Buffer.from('{"v":2,"items":[],"delivery":"shipping"}').toString('base64url')),
    ).toEqual(empty)
    expect(readCart(cookieOf([7], 'pickup'))).toEqual({
      v: 1,
      items: [{ id: 7, p: 4500 }],
      delivery: 'pickup',
    })
  })
})

describe('removeFromCart', () => {
  it('S6: offene Kasse → cancelled (cart_changed), Reservierung released (customer_cancelled), Stück sofort öffentlich frei', async () => {
    const a = await piece(980)
    const b = await piece(981)
    const r = await started([a, b])
    const out = await removeFromCart(
      { productId: a, cookie: cookieOf([a, b]), checkoutToken: r.token, now: clock.now() },
      { payload },
    )
    expect(out.ok).toBe(true)
    if (!out.ok || !out.cookie || !('set' in out.cookie)) throw new Error('Cookie erwartet')
    expect(decodeCartCookie(out.cookie.set)?.items.map((i) => i.id)).toEqual([b])

    const c = await checkoutById(payload, r.checkoutId)
    expect(c.status).toBe('cancelled')
    expect(c.closeReason).toBe('cart_changed')
    for (const id of [a, b]) {
      expect((await productRow(payload, id)).status).toBe('available')
      expect((await reservationsOf(payload, id))[0]).toMatchObject({
        status: 'released',
        release_reason: 'customer_cancelled',
      })
    }
    // öffentlich frei: der Live-Zustand kommt direkt aus der DB (no-store), ohne Wartezeit
    const res = await handleProductStatus(
      new Request(`http://localhost/api/public/product-status?ids=${a}`, {
        headers: { 'x-forwarded-for': `10.4.7.${++ipCounter}` },
      }),
      payload,
      clock.now(),
    )
    expect((await res.json())[a]).toBe('available')
  })

  it('letztes Stück entfernt → Cookie löschen; Stück nicht im Korb → nichts ändern', async () => {
    const a = await piece(982)
    const last = await removeFromCart(
      { productId: a, cookie: cookieOf([a]), checkoutToken: null, now: clock.now() },
      { payload },
    )
    expect(last).toMatchObject({ ok: true, cookie: { delete: true } })
    const none = await removeFromCart(
      { productId: 999_999, cookie: cookieOf([a]), checkoutToken: null, now: clock.now() },
      { payload },
    )
    expect(none).toMatchObject({ ok: true, cookie: null })
  })

  it('Kasse in confirming → abgelehnt („Deine Zahlung läuft gerade“), nichts freigegeben', async () => {
    const a = await piece(983)
    const r = await started([a])
    const req = await createLocalReq({}, payload)
    await transitionCheckout(req, r.checkoutId, 'confirming', { now: clock.now() })
    const out = await removeFromCart(
      { productId: a, cookie: cookieOf([a]), checkoutToken: r.token, now: clock.now() },
      { payload },
    )
    expect(out).toMatchObject({ ok: false, code: 'payment_running', cookie: null })
    expect((await checkoutById(payload, r.checkoutId)).status).toBe('confirming')
    expect((await productRow(payload, a)).status).toBe('reserved')
  })
})

describe('setDeliveryMethod', () => {
  it('AK-4-02: shipping mit einem nur_abholung-Stück wird abgelehnt; pickup geht', async () => {
    const a = await piece(984)
    const p = await piece(985, { shippingClass: 'nur_abholung' })
    const cookie = cookieOf([a, p], 'pickup')
    expect(await setDeliveryMethod({ method: 'shipping', cookie }, payload)).toMatchObject({
      ok: false,
      code: 'pickup_only',
      itemNumbers: [985],
      cookie: null,
    })
    const back = await setDeliveryMethod(
      { method: 'shipping', cookie: cookieOf([a], 'pickup') },
      payload,
    )
    if (!back.ok || !back.cookie || !('set' in back.cookie)) throw new Error('Cookie erwartet')
    expect(decodeCartCookie(back.cookie.set)?.delivery).toBe('shipping')
    expect(await setDeliveryMethod({ method: 'pickup', cookie }, payload)).toMatchObject({
      ok: true,
      cookie: null,
    })
  })

  it('ohne Korb entsteht kein Cookie', async () => {
    expect(await setDeliveryMethod({ method: 'pickup', cookie: undefined }, payload)).toMatchObject(
      {
        ok: true,
        cookie: null,
      },
    )
  })

  it('Lieferartwechsel gibt nichts frei (Reservierung und Kasse bleiben)', async () => {
    const a = await piece(986)
    const r = await started([a])
    const out = await setDeliveryMethod({ method: 'pickup', cookie: cookieOf([a]) }, payload)
    expect(out.ok).toBe(true)
    expect((await checkoutById(payload, r.checkoutId)).status).toBe('open')
    expect((await productRow(payload, a)).reservation_ref).toBe(r.reservationRef)
    expect((await reservationsOf(payload, a)).map((x) => x.status)).toEqual(['active'])
  })
})

describe('evaluateCart (mit DB)', () => {
  it('Preisänderung nach dem Hinzufügen → „Preis wurde aktualisiert“, Summe mit neuem Preis', async () => {
    const a = await piece(987, { priceCents: 4500 })
    await payload.update({
      collection: 'products',
      id: a,
      data: { priceCents: 5900 } as never,
      overrideAccess: true,
      context: { seed: true },
    })
    const ev = await evaluateCart(cartOf([{ id: a, p: 4500 }]), clock.now(), { payload })
    expect(ev.lines[0]).toMatchObject({
      state: 'available',
      priceCents: 5900,
      addedPriceCents: 4500,
      priceChanged: true,
    })
    expect(ev.totals?.subtotalCents).toBe(5900)
    expect(ev.canCheckout).toBe(true)
  })

  it('eigene Kasse (pc_checkout) → kaufbar; fremde Kasse → „gerade reserviert“; nicht öffentlich → verkauft', async () => {
    const mine = await piece(988)
    const other = await piece(989)
    const hidden = await piece(990, { status: 'draft', firstPublishedAt: undefined })
    const own = await started([mine])
    await started([other])
    const ev = await evaluateCart(
      cartOf([{ id: mine }, { id: other }, { id: hidden }]),
      clock.now(),
      { payload, checkoutToken: own.token },
    )
    expect(ev.lines.map((l) => [l.itemNumber, l.state])).toEqual([
      [988, 'reserved_by_you'],
      [989, 'reserved'],
      [990, 'sold'],
    ])
    expect(ev.canCheckout).toBe(false)
    expect(ev.totals?.subtotalCents).toBe(4500)
  })
})

describe('GET /api/public/product-status – reservedByYou', () => {
  it('mit pc_checkout true nur für Stücke der eigenen Kasse; ohne Cookie immer false; no-store', async () => {
    const mine = await piece(991)
    const other = await piece(992)
    const own = await started([mine])
    await started([other])
    const get = (cookie?: string) =>
      handleProductStatus(
        new Request(`http://localhost/api/public/product-status?ids=${mine},${other}`, {
          headers: {
            'x-forwarded-for': `10.4.7.${++ipCounter}`,
            ...(cookie ? { cookie } : {}),
          },
        }),
        payload,
        clock.now(),
      )
    const withCookie = await get(`pc_cart=x; pc_checkout=${own.token}`)
    expect(withCookie.headers.get('cache-control')).toBe('no-store')
    expect(withCookie.headers.get('set-cookie')).toBeNull()
    expect(await withCookie.json()).toEqual({
      [mine]: 'reserved',
      [other]: 'reserved',
      reservedByYou: { [mine]: true, [other]: false },
    })
    expect((await (await get()).json()).reservedByYou).toEqual({ [mine]: false, [other]: false })
    // abgelaufene eigene Kasse zählt nicht mehr
    expect(
      await reservedByYou(payload, [mine], own.token, new Date(Date.parse(T0) + 60 * 60_000)),
    ).toEqual({ [mine]: false })
  })
})
