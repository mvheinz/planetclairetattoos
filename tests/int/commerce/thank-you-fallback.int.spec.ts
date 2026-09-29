import { sql } from '@payloadcms/db-postgres'
import { describe, expect, it, vi } from 'vitest'

import { getThanksState } from '@/lib/commerce/thanksState'
import { handleCheckoutState } from '@/lib/commerce/tokenPages'
import { statusTokenOf } from '@/lib/commerce/orderView'

import { checkoutById, productRow } from '../helpers/checkout'
import { dbOf } from '../helpers/commerce'
import { shopHarness } from '../helpers/shop'

// P4.17 – Danke-Seite: Rückfall 2 über `getCheckoutSession` (KONZEPT §4.10) für Seite und Endpunkt, S9/S10, Reihenfolge
// Kassen-Token → Status-Token, 404 nach gelöschter Kasse (L-03) mit dem Kassen-Token.

const NUMBERS = [986, 987, 988, 989]
const h = shopHarness({ start: '2026-10-07T10:00:00.000Z', numbers: NUMBERS, tag: 'thanks' })

const request = (ip: string) =>
  new Request('http://localhost/api/checkout/x/state', { headers: { 'x-forwarded-for': ip } })

/** Kasse `confirming`, Mock-Session „Verzögert“: abgeschlossen, aber unbezahlt – kein Ereignis verarbeitet (S10). */
async function delayed(nr: number) {
  const id = await h.piece(nr)
  const s = await h.submitted([id])
  await h.mock.setNextOutcome(s.session!, { result: 'delayed' })
  await h.emit(s.session!, 'checkout.session.completed')
  return { ...s, productId: id, token: s.r.token }
}

describe('Danke-Seite: Zustand und Rückfall (P4.17)', () => {
  it('S10 Rückfall 2 (Seite): „wartet“, dann bezahlt beim Anbieter → nächste Abfrage legt die Bestellung an; höchstens eine Anbieter-Abfrage je Aufruf', async () => {
    const d = await delayed(986)
    const spy = vi.spyOn(h.mock, 'getCheckoutSession')
    const first = await getThanksState(d.token, h.now(), { payload: h.payload, payments: h.mock })
    expect(first?.code).toBe('waiting')
    expect(spy).toHaveBeenCalledTimes(1)
    expect(await h.count('orders')).toBe(0)

    // Testhilfe: Mock-Zustand der Session auf bezahlt (ohne das Ereignis zu verarbeiten)
    await h.emit(d.session!, 'checkout.session.async_payment_succeeded')
    const second = await getThanksState(d.token, h.now(), { payload: h.payload, payments: h.mock })
    expect(spy).toHaveBeenCalledTimes(2)
    expect(second?.code).toBe('paid')
    expect(second && 'order' in second ? second.order.status : null).toBe('paid')
    expect(await h.count('orders')).toBe(1)
    expect((await productRow(h.payload, d.productId)).status).toBe('sold')
    expect((await checkoutById(h.payload, d.checkoutId)).status).toBe('completed')

    // weitere Aufrufe: keine Anbieter-Abfrage mehr, weiter „bezahlt“, keine zweite Bestellung
    const third = await getThanksState(d.token, h.now(), { payload: h.payload, payments: h.mock })
    expect(third?.code).toBe('paid')
    expect(spy).toHaveBeenCalledTimes(2)
    expect(await h.count('orders')).toBe(1)
    spy.mockRestore()
  })

  it('S10 Rückfall 2 (Endpunkt): `GET /api/checkout/[token]/state` liefert erst waiting, dann paid', async () => {
    const d = await delayed(987)
    const call = () =>
      handleCheckoutState(request('198.51.100.21'), d.token, h.now(), {
        payload: h.payload,
        payments: h.mock,
      })
    expect(await (await call()).json()).toEqual({ state: 'waiting' })
    await h.emit(d.session!, 'checkout.session.async_payment_succeeded')
    expect(await (await call()).json()).toEqual({ state: 'paid' })
    expect(await h.count('orders')).toBe(1)
  })

  it('S9 Abbruch: Session offen → Kasse confirming → open, „nicht bezahlt“ mit „Zurück zur Kasse“; Reservierung läuft weiter', async () => {
    const id = await h.piece(988)
    const s = await h.submitted([id])
    const before = await checkoutById(h.payload, s.checkoutId)
    const state = await getThanksState(s.r.token, h.now(), { payload: h.payload, payments: h.mock })
    expect(state).toMatchObject({ code: 'unpaid', backToCheckout: true })
    const after = await checkoutById(h.payload, s.checkoutId)
    expect(after.status).toBe('open')
    expect(after.expiresAt).toBe(before.expiresAt)
    expect((await productRow(h.payload, id)).status).toBe('reserved')
    expect(await h.count('orders')).toBe(0)

    // nach Ablauf der Reservierung: „Zum Korb“ statt „Zurück zur Kasse“
    const late = new Date(new Date(after.expiresAt).getTime() + 1000)
    const expired = await getThanksState(s.r.token, late, { payload: h.payload, payments: h.mock })
    expect(expired).toMatchObject({ code: 'unpaid', backToCheckout: false })
  })

  it('Token-Reihenfolge Kasse → Bestellung; 404 nach gelöschter Kasse mit dem Kassen-Token, Status-Link bleibt', async () => {
    const id = await h.piece(989)
    const s = await h.submitted([id])
    await h.deliver(s.session!, 'checkout.session.completed')
    const viaCheckout = await getThanksState(s.r.token, h.now(), { payload: h.payload })
    expect(viaCheckout).toMatchObject({ code: 'paid', via: 'checkout' })
    const order = viaCheckout && 'order' in viaCheckout ? viaCheckout.order : null
    const statusToken = statusTokenOf(order!)
    expect(statusToken).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(statusToken).not.toBe(s.r.token)
    const viaOrder = await getThanksState(statusToken!, h.now(), { payload: h.payload })
    expect(viaOrder).toMatchObject({ code: 'paid', via: 'order' })
    expect(viaOrder && 'order' in viaOrder ? viaOrder.order.id : null).toBe(order!.id)

    // Kasse nach 30 Tagen gelöscht (L-03): der Kassen-Token ist unbekannt, der Status-Token gilt weiter
    const db = dbOf(h.payload)
    await db.execute(sql`UPDATE orders SET checkout_id = NULL WHERE id = ${order!.id}`)
    await db.execute(sql`DELETE FROM reservations WHERE checkout_id = ${s.checkoutId}`)
    await db.execute(sql`DELETE FROM checkouts WHERE id = ${s.checkoutId}`)
    expect(await getThanksState(s.r.token, h.now(), { payload: h.payload })).toBeNull()
    expect((await getThanksState(statusToken!, h.now(), { payload: h.payload }))?.code).toBe('paid')
    expect(await getThanksState('x'.repeat(43), h.now(), { payload: h.payload })).toBeNull()
    expect(await getThanksState('kurz', h.now(), { payload: h.payload })).toBeNull()
  })
})
