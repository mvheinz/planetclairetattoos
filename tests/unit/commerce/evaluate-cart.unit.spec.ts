import { describe, expect, it } from 'vitest'

import type { CartCookie } from '@/lib/commerce/cartCookie'
import {
  evaluateCartItems,
  type CartEvaluationSettings,
  type CartProductFacts,
} from '@/lib/commerce/evaluateCart'

// P4.7 `evaluateCart` (KONZEPT §4.2, §4.11 S12): das Cookie ist nur Merkliste – je Position der Zustand aus der DB,
// „Preis wurde aktualisiert“ bei DB-Preis ≠ `p` (gerechnet wird immer mit dem DB-Preis), Versand und Summen über den
// Rechenkern, `canCheckout`. Reine Funktion ohne DB.

const NOW = new Date('2026-09-28T10:00:00.000Z')
const OWN = '11111111-1111-4111-8111-111111111111'
const OTHER = '22222222-2222-4222-8222-222222222222'

const SETTINGS: CartEvaluationSettings = {
  shop: { isOpen: true, closedMessage: 'Pause.', maxItemsPerCheckout: 10 },
  shipping: {
    rates: [
      { zone: 'DE', shippingClass: 'brief', priceCents: 195 },
      { zone: 'DE', shippingClass: 'keramik', priceCents: 890 },
    ],
  },
  tax: { modes: [{ mode: 'kleinunternehmer', validFrom: '1970-01-01T00:00:00.000Z' }] },
}

const product = (id: number, over: Partial<CartProductFacts> = {}): CartProductFacts => ({
  id,
  itemNumber: id,
  status: 'available',
  priceCents: 4500,
  vatCategory: 'standard',
  shippingClass: 'keramik',
  ...over,
})

const cart = (
  items: { id: number; p?: number }[],
  delivery: CartCookie['delivery'] = 'shipping',
): CartCookie => ({ v: 1, items: items.map((i) => ({ id: i.id, p: i.p ?? 4500 })), delivery })

const evaluate = (
  c: CartCookie,
  products: CartProductFacts[],
  over: { own?: string | null; settings?: CartEvaluationSettings } = {},
) =>
  evaluateCartItems({
    cart: c,
    products,
    ownReservationRef: over.own ?? null,
    settings: over.settings ?? SETTINGS,
    now: NOW,
  })

describe('Zustand je Position (serverseitig neu geprüft)', () => {
  it('available, eigene Kasse, fremde Kasse/Vorkasse (S12), verkauft, nicht öffentlich', () => {
    const r = evaluate(
      cart([{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }, { id: 6 }]),
      [
        product(1),
        product(2, {
          status: 'reserved',
          reservationRef: OWN,
          reservedUntil: '2026-09-28T10:30:00Z',
        }),
        product(3, {
          status: 'reserved',
          reservationRef: OTHER,
          reservedUntil: '2026-09-28T10:30:00Z',
        }),
        product(4, { status: 'sold' }),
        product(5, { status: null }),
        // 6 fehlt ganz (gelöscht) → verkauft
      ],
      { own: OWN },
    )
    expect(r.lines.map((l) => [l.id, l.state, l.purchasable])).toEqual([
      [1, 'available', true],
      [2, 'reserved_by_you', true],
      [3, 'reserved', false],
      [4, 'sold', false],
      [5, 'sold', false],
      [6, 'sold', false],
    ])
    expect(r.lines[4]!.priceCents).toBeNull()
    expect(r.canCheckout).toBe(false)
    expect(r.blockers).toEqual(['unavailable'])
  })

  it('abgelaufene, noch nicht freigegebene Reservierung zählt als frei (lazy release beim Start)', () => {
    const r = evaluate(cart([{ id: 1 }]), [
      product(1, {
        status: 'reserved',
        reservationRef: OTHER,
        reservedUntil: '2026-09-28T09:59:59Z',
      }),
    ])
    expect(r.lines[0]!.state).toBe('available')
    expect(r.canCheckout).toBe(true)
  })

  it('ohne eigene Kasse ist jede Reservierung „gerade reserviert“', () => {
    const r = evaluate(cart([{ id: 1 }]), [
      product(1, {
        status: 'reserved',
        reservationRef: OWN,
        reservedUntil: '2026-09-28T10:30:00Z',
      }),
    ])
    expect(r.lines[0]!.state).toBe('reserved')
  })
})

describe('Preis und Summen (KONZEPT §4.2)', () => {
  it('Preisänderung nach dem Hinzufügen → priceChanged und Summe mit dem DB-Preis', () => {
    const r = evaluate(
      cart([
        { id: 1, p: 4500 },
        { id: 2, p: 3000 },
      ]),
      [product(1, { priceCents: 5200 }), product(2, { priceCents: 3000, shippingClass: 'brief' })],
    )
    expect(r.lines.map((l) => [l.priceChanged, l.priceCents, l.addedPriceCents])).toEqual([
      [true, 5200, 4500],
      [false, 3000, 3000],
    ])
    // höchste Versandklasse zählt (Keramik 8,90 €)
    expect(r.totals).toMatchObject({
      subtotalCents: 8200,
      shippingCents: 890,
      totalCents: 9090,
      shippingClass: 'keramik',
    })
    expect(r.canCheckout).toBe(true)
  })

  it('nicht kaufbare Positionen sind aus der Summe ausgeschlossen', () => {
    const r = evaluate(cart([{ id: 1 }, { id: 2 }]), [
      product(1, { priceCents: 2000, shippingClass: 'brief' }),
      product(2, { status: 'sold', priceCents: 9000 }),
    ])
    expect(r.totals).toMatchObject({ subtotalCents: 2000, shippingCents: 195, totalCents: 2195 })
  })

  it('Abholung: 0 € Versand; nur_abholung erzwingt pickup und meldet die Nummer', () => {
    const pickup = evaluate(cart([{ id: 1 }], 'pickup'), [product(1)])
    expect(pickup.totals?.shippingCents).toBe(0)
    const forced = evaluate(cart([{ id: 1 }, { id: 23 }], 'shipping'), [
      product(1),
      product(23, { shippingClass: 'nur_abholung' }),
    ])
    expect(forced.delivery).toBe('pickup')
    expect(forced.pickupOnly).toEqual([23])
    expect(forced.totals?.shippingCents).toBe(0)
  })

  it('fehlender Versandtarif → kein stilles 0 €, „Zur Kasse“ gesperrt', () => {
    const r = evaluate(cart([{ id: 1 }]), [product(1, { shippingClass: 'paket_klein' })])
    expect(r.totals).toBeNull()
    expect(r.shippingError).toBe('no_rate')
    expect(r.blockers).toEqual(['shipping'])
    expect(r.canCheckout).toBe(false)
  })
})

describe('canCheckout', () => {
  it('mehr als maxItemsPerCheckout → falsch', () => {
    const settings = { ...SETTINGS, shop: { ...SETTINGS.shop, maxItemsPerCheckout: 2 } }
    const ids = [1, 2, 3]
    const r = evaluate(
      cart(ids.map((id) => ({ id }))),
      ids.map((id) => product(id)),
      { settings },
    )
    expect(r.maxItemsPerCheckout).toBe(2)
    expect(r.blockers).toEqual(['too_many'])
    expect(r.canCheckout).toBe(false)
  })

  it('geschlossener Shop → falsch, closedMessage steht bereit', () => {
    const settings = { ...SETTINGS, shop: { ...SETTINGS.shop, isOpen: false } }
    const r = evaluate(cart([{ id: 1 }]), [product(1)], { settings })
    expect(r).toMatchObject({ shopOpen: false, closedMessage: 'Pause.', canCheckout: false })
    expect(r.blockers).toEqual(['shop_closed'])
  })

  it('leerer Korb → falsch, keine Summen', () => {
    const r = evaluate(cart([]), [])
    expect(r).toMatchObject({ count: 0, totals: null, canCheckout: false, blockers: ['empty'] })
  })
})
