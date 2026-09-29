import { describe, expect, it } from 'vitest'

import { changeCheckoutDelivery, recreatedSessionExpiry } from '@/lib/commerce/changeDelivery'

import { checkoutById } from '../helpers/checkout'
import { shopHarness } from '../helpers/shop'

// P4.10b – Lieferartwechsel an der laufenden Kasse (KONZEPT §4.2/§4.4, DATENMODELL §6.25.1): Versand und Summen neu aus
// `settings.shipping.rates`, Reservierung bleibt; Session per `updateShipping` bzw. bei `recreate_required` neu mit
// derselben Reservierung und `sessionSeq + 1`; AK-4-03 (neue Tarife wirken nur auf neue Kassen bzw. einen Wechsel).

const NUMBERS = [990, 991]
const h = shopHarness({ start: '2026-10-09T10:00:00.000Z', numbers: NUMBERS, tag: 'delivery' })

type Rate = { zone: string; shippingClass: string; priceCents: number }

async function setKeramikRate(cents: number) {
  const settings = (await h.payload.findGlobal({
    slug: 'settings',
    depth: 0,
    overrideAccess: true,
  })) as unknown as { shipping: { rates: Rate[] } }
  const rates = settings.shipping.rates.map(({ zone, shippingClass, priceCents }) => ({
    zone,
    shippingClass,
    priceCents: zone === 'DE' && shippingClass === 'keramik' ? cents : priceCents,
  }))
  await h.payload.updateGlobal({
    slug: 'settings',
    data: { shipping: { rates } } as never,
    overrideAccess: true,
    context: { system: true },
  })
}

describe('changeCheckoutDelivery (P4.10b)', () => {
  it('Versand → Abholung → Versand: Summen neu, reservationRef und expiresAt unverändert, Session per updateShipping', async () => {
    const a = await h.piece(990)
    const r = await h.start([a])
    const before = await checkoutById(h.payload, r.checkoutId)
    expect(before.fulfillmentMethod).toBe('shipping')
    expect(before.shippingCents).toBeGreaterThan(0)

    const res = await changeCheckoutDelivery(
      { token: r.token, method: 'pickup', now: h.now() },
      { payload: h.payload, payments: h.mock },
    )
    expect(res).toMatchObject({ ok: true, changed: true, session: 'updated', shippingCents: 0 })
    const c = await checkoutById(h.payload, r.checkoutId)
    expect(c.fulfillmentMethod).toBe('pickup')
    expect(c.shippingCents).toBe(0)
    expect(c.totalCents).toBe(before.subtotalCents)
    expect(c.subtotalCents).toBe(before.subtotalCents)
    expect(c.reservationRef).toBe(before.reservationRef)
    expect(c.expiresAt).toBe(before.expiresAt)
    expect(c.stripe?.checkoutSessionId).toBe(before.stripe?.checkoutSessionId)
    expect(c.stripe?.sessionSeq).toBe(1)
    const session = await h.mock.getCheckoutSession(c.stripe!.checkoutSessionId!)
    expect(session.amountTotalCents).toBe(before.subtotalCents)

    const back = await changeCheckoutDelivery(
      { token: r.token, method: 'shipping', now: h.now() },
      { payload: h.payload, payments: h.mock },
    )
    expect(back).toMatchObject({ ok: true, changed: true, shippingCents: before.shippingCents })
    const same = await changeCheckoutDelivery(
      { token: r.token, method: 'shipping', now: h.now() },
      { payload: h.payload, payments: h.mock },
    )
    expect(same).toMatchObject({ ok: true, changed: false, session: 'unchanged' })
  })

  it('recreate_required → neue Session für dieselbe Reservierung mit sessionSeq + 1', async () => {
    const a = await h.piece(990)
    const r = await h.start([a])
    const before = await checkoutById(h.payload, r.checkoutId)
    const oldSession = before.stripe!.checkoutSessionId!
    // Session nicht mehr offen → updateShipping meldet recreate_required
    await h.mock.expireCheckoutSession(oldSession)

    const res = await changeCheckoutDelivery(
      { token: r.token, method: 'pickup', now: h.now() },
      { payload: h.payload, payments: h.mock },
    )
    expect(res).toMatchObject({ ok: true, changed: true, session: 'recreated' })
    const c = await checkoutById(h.payload, r.checkoutId)
    expect(c.reservationRef).toBe(before.reservationRef)
    expect(c.expiresAt).toBe(before.expiresAt)
    expect(c.stripe?.sessionSeq).toBe(2)
    expect(c.stripe?.checkoutSessionId).not.toBe(oldSession)
    const fresh = await h.mock.getCheckoutSession(c.stripe!.checkoutSessionId!)
    expect(fresh).toMatchObject({ status: 'open', amountTotalCents: before.subtotalCents })
    expect(new Date(c.stripe!.sessionExpiresAt!).getTime()).toBeGreaterThanOrEqual(
      h.now().getTime() + 30 * 60_000,
    )
  })

  it('AK-4-03 geänderte Klassenpreise wirken auf neue Kassen und beim Wechsel; eine laufende Kasse ohne Wechsel behält ihren Snapshot', async () => {
    const a = await h.piece(990)
    const b = await h.piece(991)
    const r = await h.start([a])
    const before = await checkoutById(h.payload, r.checkoutId)
    await setKeramikRate(before.shippingCents + 150)

    expect((await checkoutById(h.payload, r.checkoutId)).shippingCents).toBe(before.shippingCents)
    const other = await h.start([b])
    expect((await checkoutById(h.payload, other.checkoutId)).shippingCents).toBe(
      before.shippingCents + 150,
    )

    await changeCheckoutDelivery(
      { token: r.token, method: 'pickup', now: h.now() },
      { payload: h.payload, payments: h.mock },
    )
    const res = await changeCheckoutDelivery(
      { token: r.token, method: 'shipping', now: h.now() },
      { payload: h.payload, payments: h.mock },
    )
    expect(res).toMatchObject({ ok: true, shippingCents: before.shippingCents + 150 })
  })

  it('nur Abholung, Kasse in confirming oder abgelaufen, ungültige Lieferart → abgelehnt', async () => {
    const a = await h.piece(990, { shippingClass: 'nur_abholung' })
    const r = await h.start([a], { delivery: 'pickup' })
    expect(
      await changeCheckoutDelivery(
        { token: r.token, method: 'shipping', now: h.now() },
        { payload: h.payload, payments: h.mock },
      ),
    ).toEqual({ ok: false, code: 'pickup_only' })
    expect(
      await changeCheckoutDelivery(
        { token: r.token, method: 'drohne', now: h.now() },
        { payload: h.payload, payments: h.mock },
      ),
    ).toEqual({ ok: false, code: 'invalid' })

    const b = await h.piece(991)
    const s = await h.submitted([b])
    const token = s.r.token
    expect(
      await changeCheckoutDelivery(
        { token, method: 'pickup', now: h.now() },
        { payload: h.payload, payments: h.mock },
      ),
    ).toEqual({ ok: false, code: 'not_open' })
    expect(
      await changeCheckoutDelivery(
        { token: r.token, method: 'pickup', now: new Date(h.now().getTime() + 3600_000) },
        { payload: h.payload, payments: h.mock },
      ),
    ).toEqual({ ok: false, code: 'expired' })
  })

  it('Ablauf einer neuen Session: mindestens 31 min ab jetzt, sonst wie bisher', () => {
    const now = new Date('2026-10-09T10:00:00.000Z')
    expect(recreatedSessionExpiry(null, now).toISOString()).toBe('2026-10-09T10:31:00.000Z')
    expect(recreatedSessionExpiry(new Date('2026-10-09T10:45:00.000Z'), now).toISOString()).toBe(
      '2026-10-09T10:45:00.000Z',
    )
  })
})
