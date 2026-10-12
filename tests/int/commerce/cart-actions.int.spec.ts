import { createLocalReq, type Payload } from 'payload'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { evaluateCart, readCart, removeFromCart, reservedByYou } from '@/lib/commerce/cart'
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
  setSettingsGroup,
  testClock,
  useMemorySystemFiles,
  useMockPayments,
  type TestClock,
} from '../helpers/checkout'
import { deleteCommerce } from '../helpers/commerce'
import { getTestPayload } from '../helpers/payload'
import { createProductFixtures, deleteProducts, type ProductFixtures } from '../helpers/products'

// P4.7 Warenkorb-Aktionen (KONZEPT §4.2, §4.11 S6/S12; DATENMODELL §6.25.3): Entfernen (offene Kasse → `cart_changed`,
// Freigabe; `confirming` → abgelehnt), Bewertung mit DB-Preis, und `reservedByYou` in `GET /api/public/product-status`.
// V-16: Die Lieferart wählt man nur noch in der Kasse – ist der Versand nicht berechenbar, rechnen Korb und Kassenstart mit
// Abholung (solange Abholung möglich ist). Fixture-Nummern 980–999, Uhr injiziert.

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

describe('Lieferart nur in der Kasse (V-16)', () => {
  /** Versandtarife ohne `paket_klein` – der Versand für ein solches Stück lässt sich nicht berechnen. */
  async function withoutSmallParcelRate(extra: Record<string, unknown> = {}) {
    const settings = (await payload.findGlobal({
      slug: 'settings',
      overrideAccess: true,
      depth: 0,
    })) as unknown as { shipping?: { rates?: { shippingClass?: string }[] } }
    const rates = (settings.shipping?.rates ?? []).filter((r) => r.shippingClass !== 'paket_klein')
    return setSettingsGroup(payload, 'shipping', { rates, ...extra })
  }

  it('Versand nicht berechenbar, Abholung möglich → Korb rechnet mit Abholung ohne Sperre, Kasse startet mit Abholung', async () => {
    const a = await piece(984, { shippingClass: 'paket_klein' })
    const restore = await withoutSmallParcelRate()
    try {
      const ev = await evaluateCart(cartOf([{ id: a }]), clock.now(), { payload })
      expect(ev).toMatchObject({
        delivery: 'pickup',
        pickupFallback: true,
        shippingError: 'no_rate',
        canCheckout: true,
        blockers: [],
      })
      expect(ev.totals?.shippingCents).toBe(0)
      const r = await started([a])
      expect((await checkoutById(payload, r.checkoutId)).fulfillmentMethod).toBe('pickup')
      expect((await productRow(payload, a)).reservation_ref).toBe(r.reservationRef)
    } finally {
      await restore()
    }
  })

  it('… ohne Abholung → Sperrgrund „shipping“, Kassenstart lehnt ab und reserviert nichts', async () => {
    const a = await piece(985, { shippingClass: 'paket_klein' })
    const restore = await withoutSmallParcelRate({ pickupEnabled: false })
    try {
      const ev = await evaluateCart(cartOf([{ id: a }]), clock.now(), { payload })
      expect(ev).toMatchObject({
        delivery: 'shipping',
        pickupFallback: false,
        canCheckout: false,
        blockers: ['shipping'],
      })
      const r = await startCheckout(
        { cart: cartOf([{ id: a }]), locale: 'de', existingToken: null, now: clock.now() },
        { payload },
      )
      expect(r).toMatchObject({ ok: false, code: 'shipping' })
      expect((await productRow(payload, a)).status).toBe('available')
    } finally {
      await restore()
    }
  })

  it('gemerkte Abholung (aus der Kasse) gilt beim nächsten Kassenstart; nur_abholung erzwingt Abholung', async () => {
    const a = await piece(986)
    const p = await piece(987, { shippingClass: 'nur_abholung' })
    const remembered = await started([a], 'pickup')
    expect((await checkoutById(payload, remembered.checkoutId)).fulfillmentMethod).toBe('pickup')
    // Andere Stückliste → die Kasse wird ersetzt (S14); `nur_abholung` setzt Abholung trotz gemerktem Versand
    const forced = await startCheckout(
      {
        cart: cartOf([{ id: a }, { id: p }], 'shipping'),
        locale: 'de',
        existingToken: remembered.token,
        now: clock.now(),
      },
      { payload },
    )
    if (!forced.ok) throw new Error(JSON.stringify(forced))
    expect((await checkoutById(payload, forced.checkoutId)).fulfillmentMethod).toBe('pickup')
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
