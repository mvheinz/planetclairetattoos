import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { addToCart, evaluateCart, setDeliveryMethod } from '@/lib/commerce/cart'
import { decodeCartCookie, encodeCartCookie } from '@/lib/commerce/cartCookie'
import { changeCheckoutDelivery } from '@/lib/commerce/changeDelivery'
import { startCheckout } from '@/lib/commerce/checkout'
import type { CheckoutRawInput } from '@/lib/commerce/checkoutSchema'
import { submitCheckout } from '@/lib/commerce/submitCheckout'
import { loadCheckoutPage } from '@/lib/data/checkout'

import { cartOf, checkoutById, productRow, setSettingsGroup } from '../helpers/checkout'
import { shopHarness } from '../helpers/shop'

// P18.5 – Schalter „Abholung möglich“ (`settings.shipping.pickupEnabled`, KONZEPT §4.3 Regel 7): aus heißt aus. „In den
// Korb“, Lieferart im Korb, Kassenstart, Lieferartwechsel und Absenden lehnen Abholung ab (`pickup_disabled`) und fallen
// auf Versand zurück; `nur_abholung`-Stücke sind nicht bestellbar; die Korb-Bewertung kennt Schalter und Vorkasse für die
// Zahlarten-Zeile (R-036). Fixture-Nummern 980–985.

const NUMBERS = [980, 981, 982, 983, 984, 985]
const h = shopHarness({ start: '2026-10-11T10:00:00.000Z', numbers: NUMBERS, tag: 'pickup-off' })

let ipCounter = 0
const freshIp = () => `10.18.5.${++ipCounter}`
const cookieOf = (ids: number[], delivery: 'shipping' | 'pickup' = 'shipping') =>
  encodeCartCookie(
    cartOf(
      ids.map((id) => ({ id })),
      delivery,
    ),
  )

const pickupInput = (o: Partial<CheckoutRawInput> = {}): CheckoutRawInput => ({
  email: 'erika@planetclaire.local',
  fulfillmentMethod: 'pickup',
  name: 'Erika Beispiel',
  billingLine1: 'Musterstraße 1',
  billingPostalCode: '10115',
  billingCity: 'Berlin',
  paymentChoice: 'stripe',
  ...o,
})

let restore: (() => Promise<void>) | null = null
const pickupOff = async () => {
  restore = await setSettingsGroup(h.payload, 'shipping', { pickupEnabled: false })
}

beforeEach(() => {
  restore = null
})

afterEach(async () => {
  await restore?.()
  restore = null
})

describe('„In den Korb“ bei ausgeschalteter Abholung', () => {
  it('nur_abholung → pickup_disabled ohne Cookie; normales Stück → gemerkte Abholung fällt auf Versand zurück', async () => {
    const a = await h.piece(980)
    const p = await h.piece(981, { shippingClass: 'nur_abholung' })
    await pickupOff()

    const blocked = await addToCart(
      { productId: p, locale: 'de', cookie: null, ip: freshIp(), now: h.now() },
      h.payload,
    )
    expect(blocked.response).toMatchObject({
      ok: false,
      code: 'pickup_disabled',
      state: 'available',
    })
    expect(blocked.cookie).toBeNull()

    const added = await addToCart(
      { productId: a, locale: 'de', cookie: cookieOf([], 'pickup'), ip: freshIp(), now: h.now() },
      h.payload,
    )
    expect(added.response).toMatchObject({ ok: true, added: true })
    expect(decodeCartCookie(added.cookie!)?.delivery).toBe('shipping')
  })

  it('Gegenprobe Schalter an: nur_abholung kommt in den Korb und erzwingt Abholung', async () => {
    const p = await h.piece(981, { shippingClass: 'nur_abholung' })
    const added = await addToCart(
      { productId: p, locale: 'de', cookie: null, ip: freshIp(), now: h.now() },
      h.payload,
    )
    expect(added.response).toMatchObject({ ok: true, added: true })
    expect(decodeCartCookie(added.cookie!)?.delivery).toBe('pickup')
  })
})

describe('Korb: Lieferart und Bewertung', () => {
  it('setDeliveryMethod(pickup) → pickup_disabled, gemerkte Abholung wird Versand; Versand trotz nur_abholung erlaubt', async () => {
    const a = await h.piece(982)
    const p = await h.piece(983, { shippingClass: 'nur_abholung' })
    await pickupOff()

    const out = await setDeliveryMethod(
      { method: 'pickup', cookie: cookieOf([a], 'pickup') },
      h.payload,
    )
    expect(out).toMatchObject({ ok: false, code: 'pickup_disabled' })
    if (out.ok || !out.cookie || !('set' in out.cookie)) throw new Error('Rückfall-Cookie erwartet')
    expect(decodeCartCookie(out.cookie.set)?.delivery).toBe('shipping')

    // Schon Versand gemerkt → abgelehnt, aber nichts neu zu schreiben.
    expect(
      await setDeliveryMethod({ method: 'pickup', cookie: cookieOf([a]) }, h.payload),
    ).toMatchObject({ ok: false, code: 'pickup_disabled', cookie: null })

    // nur_abholung ist ohnehin gesperrt – Versand bleibt wählbar (kein pickup_only).
    expect(
      await setDeliveryMethod(
        { method: 'shipping', cookie: cookieOf([a, p], 'pickup') },
        h.payload,
      ),
    ).toMatchObject({ ok: true })
  })

  it('evaluateCart: Versand statt gemerkter Abholung, nur_abholung gesperrt (Blocker pickup_disabled), Schalter in der Bewertung', async () => {
    const a = await h.piece(982)
    const p = await h.piece(983, { shippingClass: 'nur_abholung' })
    await pickupOff()

    const ev = await evaluateCart(cartOf([{ id: a }, { id: p }], 'pickup'), h.now(), {
      payload: h.payload,
    })
    expect(ev).toMatchObject({
      delivery: 'shipping',
      pickupEnabled: false,
      pickupSelectable: false,
      pickupOnly: [],
      pickupBlocked: [983],
      canCheckout: false,
      blockers: ['pickup_disabled'],
    })
    expect(ev.lines.find((l) => l.id === p)).toMatchObject({
      state: 'available',
      purchasable: false,
      pickupBlocked: true,
    })
    expect(ev.totals?.subtotalCents).toBe(ev.lines.find((l) => l.id === a)!.priceCents)
    expect(ev.totals?.shippingCents).toBeGreaterThan(0)

    const only = await evaluateCart(cartOf([{ id: a }], 'pickup'), h.now(), { payload: h.payload })
    expect(only).toMatchObject({ delivery: 'shipping', canCheckout: true, blockers: [] })
  })
})

describe('Kasse', () => {
  it('Start mit gemerkter Abholung → Kasse mit Versand; mit nur_abholung → pickup_disabled ohne Reservierung', async () => {
    const a = await h.piece(984)
    const p = await h.piece(985, { shippingClass: 'nur_abholung' })
    await pickupOff()

    const r = await startCheckout(
      { cart: cartOf([{ id: a }], 'pickup'), locale: 'de', existingToken: null, now: h.now() },
      { payload: h.payload },
    )
    if (!r.ok) throw new Error(JSON.stringify(r))
    const c = await checkoutById(h.payload, r.checkoutId)
    expect(c.fulfillmentMethod).toBe('shipping')
    expect(c.shippingCents).toBeGreaterThan(0)

    const blocked = await startCheckout(
      { cart: cartOf([{ id: p }], 'pickup'), locale: 'de', existingToken: null, now: h.now() },
      { payload: h.payload },
    )
    expect(blocked).toEqual({ ok: false, code: 'pickup_disabled', itemNumbers: [985] })
    expect((await productRow(h.payload, p)).status).toBe('available')
  })

  it('offene Kasse mit Abholung: Seite schickt zurück in den Korb, Absenden 409, „Zur Kasse“ ersetzt sie durch Versand', async () => {
    const a = await h.piece(984)
    const r = await h.start([a], { delivery: 'pickup' })
    expect((await checkoutById(h.payload, r.checkoutId)).fulfillmentMethod).toBe('pickup')
    await pickupOff()

    expect(await loadCheckoutPage({ token: r.token, locale: 'de', now: h.now() })).toEqual({
      state: 'redirect',
      notice: 'pickup_disabled',
    })

    const submitted = await submitCheckout(
      { token: r.token, raw: pickupInput(), cartItemIds: [a], now: h.now() },
      { payload: h.payload, payments: h.mock },
    )
    expect(submitted).toMatchObject({
      ok: false,
      status: 409,
      code: 'pickup_disabled',
      errors: { fulfillmentMethod: 'choice' },
    })
    expect((await checkoutById(h.payload, r.checkoutId)).status).toBe('open')

    // Gleiche Stückliste, Countdown läuft noch – trotzdem nicht wiederverwendet (S14), sondern ersetzt.
    const again = await startCheckout(
      { cart: cartOf([{ id: a }], 'pickup'), locale: 'de', existingToken: r.token, now: h.now() },
      { payload: h.payload },
    )
    if (!again.ok) throw new Error(JSON.stringify(again))
    expect(again.reused).toBe(false)
    expect(again.checkoutId).not.toBe(r.checkoutId)
    expect((await checkoutById(h.payload, r.checkoutId)).status).toBe('cancelled')
    expect((await checkoutById(h.payload, again.checkoutId)).fulfillmentMethod).toBe('shipping')
    expect((await productRow(h.payload, a)).reservation_ref).toBe(again.reservationRef)
  })

  it('Lieferartwechsel zu Abholung → pickup_disabled, Kasse unverändert; Versand bleibt wählbar', async () => {
    const a = await h.piece(984)
    const r = await h.start([a])
    const before = await checkoutById(h.payload, r.checkoutId)
    await pickupOff()

    expect(
      await changeCheckoutDelivery(
        { token: r.token, method: 'pickup', now: h.now() },
        { payload: h.payload, payments: h.mock },
      ),
    ).toEqual({ ok: false, code: 'pickup_disabled' })
    const after = await checkoutById(h.payload, r.checkoutId)
    expect(after.fulfillmentMethod).toBe('shipping')
    expect(after.totalCents).toBe(before.totalCents)
    expect(
      await changeCheckoutDelivery(
        { token: r.token, method: 'shipping', now: h.now() },
        { payload: h.payload, payments: h.mock },
      ),
    ).toMatchObject({ ok: true, changed: false })
  })
})

describe('Zahlarten im Korb (R-036)', () => {
  it('Vorkasse aus → prepaymentEnabled false in der Bewertung', async () => {
    const a = await h.piece(982)
    const back = await setSettingsGroup(h.payload, 'payment', { prepaymentEnabled: false })
    try {
      const ev = await evaluateCart(cartOf([{ id: a }]), h.now(), { payload: h.payload })
      expect(ev).toMatchObject({ prepaymentEnabled: false, pickupEnabled: true })
    } finally {
      await back()
    }
    const ev = await evaluateCart(cartOf([{ id: a }]), h.now(), { payload: h.payload })
    expect(ev).toMatchObject({ prepaymentEnabled: true, pickupSelectable: true })
  })
})
