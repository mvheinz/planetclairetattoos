import { sql } from '@payloadcms/db-postgres'
import { createLocalReq } from 'payload'
import { describe, expect, it } from 'vitest'

import { transitionCheckout } from '@/lib/commerce/checkoutTransitions'
import { S17_NOTE } from '@/lib/commerce/fulfillCheckout'
import { placePrepaymentOrder, PrepaymentError } from '@/lib/commerce/prepayment'
import { jobAlarm } from '@/lib/jobs/alarm'
import { processPaymentEvent } from '@/lib/payments/processPaymentEvent'

import { readOutbox } from '../../helpers/outbox'
import { checkoutById, productRow, reservationsOf } from '../helpers/checkout'
import { dbOf } from '../helpers/commerce'
import { shopHarness } from '../helpers/shop'

// P4.19 – Vorkasse bestellen (O2, DATENMODELL §8.5): Bestellung `awaiting_prepayment`, Reservierung auf `prepayment`
// umgestellt, Kasse `completed`, M02 + A02, keine Rechnung; Session danach beendet (S17 bei „bezahlt“); Wechsel nach
// abgelehntem Kartenversuch; S13 ohne Session. Die Server-Action `submitCheckout` bindet den Dienst mit P4.10a an.

const NUMBERS = [980, 981, 982, 983, 984, 985]
const h = shopHarness({ start: '2026-10-06T10:00:00.000Z', numbers: NUMBERS, tag: 'prepay' })

async function place(checkoutId: number) {
  const req = await createLocalReq(
    { context: { system: true, now: h.now().toISOString() } },
    h.payload,
  )
  const res = await placePrepaymentOrder(req, checkoutId, { now: h.now(), payments: h.mock })
  await res.afterCommit()
  return res
}

describe('Vorkasse bestellen (O2)', () => {
  it('Bestellung awaiting_prepayment, Reservierung umgestellt, Kasse completed, M02 + A02, keine Rechnung; nachfolgendes expired gibt nichts frei', async () => {
    const a = await h.piece(980)
    const { checkoutId, session, email, r } = await h.submitted([a], { confirming: false })
    const counterBefore = await h.count('invoice_counters')
    const { order, statusToken } = await place(checkoutId)

    expect(statusToken).toBeTruthy()
    expect(order.status).toBe('awaiting_prepayment')
    expect(order.paymentMethod).toBe('prepayment')
    expect(order.paymentProvider).toBe('bank_transfer')
    const placedAt = new Date(order.timestamps.placedAt)
    expect(order.prepayment?.dueAt).toBeTruthy()
    expect(new Date(order.prepayment!.reminderDueAt!).getTime() - placedAt.getTime()).toBe(
      72 * 3600_000,
    )
    expect(order.statusHistory?.at(-1)).toMatchObject({ transition: 'O2', actorType: 'customer' })

    const res = (await reservationsOf(h.payload, a))[0]!
    expect(res).toMatchObject({ status: 'active', source: 'prepayment' })
    expect(new Date(res.expires_at).toISOString()).toBe(
      new Date(order.prepayment!.dueAt!).toISOString(),
    )
    const p = await dbOf(h.payload).execute(
      sql`SELECT status, reserved_until, current_order_id, reservation_ref FROM products WHERE id = ${a}`,
    )
    expect(p.rows[0]).toMatchObject({ status: 'reserved', current_order_id: order.id })
    expect(new Date(p.rows[0]!.reserved_until as string).toISOString()).toBe(
      new Date(order.prepayment!.dueAt!).toISOString(),
    )
    const c = await checkoutById(h.payload, checkoutId)
    expect(c.status).toBe('completed')
    expect(c.order).toBe(order.id)
    expect(c.paymentChoice).toBe('prepayment')
    expect(c.timestamps?.completedAt).toBeTruthy()

    expect(await h.count('invoices')).toBe(0)
    expect(await h.count('invoice_counters')).toBe(counterBefore)
    expect(
      await readOutbox({ to: email, type: 'prepayment_instructions' }, h.outboxDir),
    ).toHaveLength(1)
    expect(
      await h.count('email_log', sql`template = 'admin_order_placed' AND order_id = ${order.id}`),
    ).toBe(1)
    // Session nach dem Commit beendet; Weckzeit höchstens bis zur Erinnerung
    expect((await h.mock.getCheckoutSession(session!)).status).toBe('expired')
    const alarm = (await jobAlarm.read()).nextDueAt
    expect(alarm && Date.parse(alarm)).toBeLessThanOrEqual(
      Date.parse(order.prepayment!.reminderDueAt!),
    )

    // nachfolgendes checkout.session.expired: Kasse completed, Quelle prepayment → nichts freigegeben
    const expired = await h.emit(session!, 'checkout.session.expired')
    const result = await processPaymentEvent(expired.event, {
      payload: h.payload,
      payments: h.mock,
      now: h.now(),
    })
    expect(result.action).toBe('expired_ignored')
    expect((await productRow(h.payload, a)).status).toBe('reserved')
    expect((await reservationsOf(h.payload, a))[0]!.status).toBe('active')
    expect(r.reservationRef).toBeTruthy()
  })

  it('Wechsel von Karte auf Vorkasse: nach abgelehntem Kartenversuch (Kasse wieder open) genau eine Bestellung awaiting_prepayment', async () => {
    const a = await h.piece(981)
    const { checkoutId } = await h.submitted([a], { confirming: true })
    const req = await createLocalReq({ context: { system: true } }, h.payload)
    // Karte abgelehnt: die Kasse geht zurück nach `open` (KONZEPT §4.10)
    await transitionCheckout(req, checkoutId, 'open', { now: h.now() })
    await place(checkoutId)
    const orders = await h.payload.find({
      collection: 'orders',
      where: { checkout: { equals: checkoutId } },
      overrideAccess: true,
      depth: 0,
    })
    expect(orders.docs).toHaveLength(1)
    expect(orders.docs[0]!.status).toBe('awaiting_prepayment')
    // Ein zweiter Versuch mit derselben Kasse legt nichts an
    await expect(place(checkoutId)).rejects.toMatchObject({ code: 'checkout_not_open' })
    expect(await h.count('orders')).toBe(1)
  })

  it('Kasse confirming (Kartenzahlung läuft) → abgelehnt', async () => {
    const a = await h.piece(982)
    const { checkoutId } = await h.submitted([a], { confirming: true })
    await expect(place(checkoutId)).rejects.toBeInstanceOf(PrepaymentError)
    expect(await h.count('orders')).toBe(0)
  })

  it('S13 Kasse ohne Zahlungs-Session: Vorkasse funktioniert', async () => {
    const a = await h.piece(983)
    const failing = {
      ...h.mock,
      createCheckoutSession: async () => {
        throw new Error('ECONNREFUSED')
      },
    }
    const r = await h.start([a], { payments: failing })
    const { submitForTest } = await import('../helpers/checkout')
    await submitForTest(h.payload, r.checkoutId, { now: h.now(), legal: h.legal })
    const { order } = await place(r.checkoutId)
    expect(order.status).toBe('awaiting_prepayment')
    expect((await productRow(h.payload, a)).status).toBe('reserved')
  })

  it('DM-38/S17 Session meldet already_complete_paid → adminAttention manual + A12', async () => {
    const a = await h.piece(984)
    const { checkoutId, session } = await h.submitted([a], { confirming: false })
    await dbOf(h.payload).execute(sql`DELETE FROM email_log WHERE template = 'admin_alert'`)
    // theoretisch: Kartenzahlung ging ein, ohne dass die Kasse `confirming` war
    await h.emit(session!, 'checkout.session.completed')
    const { order } = await place(checkoutId)
    const fresh = await h.order(order.id)
    expect(fresh.adminAttention).toMatchObject({ flag: true, reason: 'manual', note: S17_NOTE })
    expect(
      await h.count(
        'email_log',
        sql`template = 'admin_alert' AND idempotency_key LIKE 'admin_alert:s17_paid_despite_prepayment@%'`,
      ),
    ).toBe(1)
    expect(fresh.status).toBe('awaiting_prepayment')
  })

  it('Vorkasse ausgeschaltet → abgelehnt, keine Bestellung', async () => {
    const a = await h.piece(985)
    const { checkoutId } = await h.submitted([a], { confirming: false })
    const before = await h.payload.findGlobal({ slug: 'settings', depth: 0, overrideAccess: true })
    await h.payload.updateGlobal({
      slug: 'settings',
      data: { payment: { ...before.payment, prepaymentEnabled: false } } as never,
      overrideAccess: true,
      context: { seed: true, skipAudit: true },
    })
    try {
      await expect(place(checkoutId)).rejects.toMatchObject({ code: 'prepayment_disabled' })
      expect(await h.count('orders')).toBe(0)
      expect((await checkoutById(h.payload, checkoutId)).status).toBe('open')
    } finally {
      await h.payload.updateGlobal({
        slug: 'settings',
        data: { payment: before.payment } as never,
        overrideAccess: true,
        context: { seed: true, skipAudit: true },
      })
    }
  })
})
