import { sql } from '@payloadcms/db-postgres'
import { describe, expect, it } from 'vitest'

import { parseInvoiceData } from '@/lib/invoices/schema'
import type { Invoice } from '@/payload-types'

import { readOutbox } from '../../helpers/outbox'
import { checkoutById, productRow } from '../helpers/checkout'
import { dbOf } from '../helpers/commerce'
import { shopHarness } from '../helpers/shop'

// P4.21 – S4 „Bezahlt, aber schon weg“ (DATENMODELL §8.4, KONZEPT §4.10 Nr. 6): Restfall nachgestellt – Kasse in
// `confirming`, eine Testhilfe setzt Stücke direkt in der DB auf `sold` (Offline-Verkauf trotz Sperre), danach
// signiertes `checkout.session.completed`. Voll- (O19) und Teilfall, Erstattung `failed` → A08.

const NUMBERS = [980, 981, 982, 983, 984, 985]
const h = shopHarness({ start: '2026-10-06T10:00:00.000Z', numbers: NUMBERS, tag: 'oversold' })

/** Offline-Verkauf trotz Sperre: Stück direkt `sold` (die Reservierung bleibt stehen). */
async function soldElsewhere(productId: number) {
  await dbOf(h.payload).execute(sql`
    UPDATE products SET status = 'sold', sold_channel = 'offline', reservation_ref = NULL, reserved_until = NULL
     WHERE id = ${productId}
  `)
}

const mails = (orderId: number, template: string) =>
  h.count('email_log', sql`template = ${template} AND order_id = ${orderId}`)

async function rate(shippingClass: string): Promise<number> {
  const settings = await h.payload.findGlobal({ slug: 'settings', depth: 0, overrideAccess: true })
  const r = settings.shipping?.rates?.find(
    (x) => x.zone === 'DE' && x.shippingClass === shippingClass,
  )
  return r!.priceCents!
}

describe('S4 bezahlt, aber schon weg (P4.21)', () => {
  it('AK-4-10/O19 alle Stücke weg: Bestellung refunded mit O19, keine Rechnung, keine M01, genau eine Erstattung, M10 und A06; zweite Zustellung erstattet nicht erneut', async () => {
    const a = await h.piece(980)
    const { checkoutId, session, email } = await h.submitted([a])
    await soldElsewhere(a)

    const emission = await h.emit(session!, 'checkout.session.completed')
    const { processPaymentEvent } = await import('@/lib/payments/processPaymentEvent')
    const deliver = () =>
      processPaymentEvent(emission.event, { payload: h.payload, payments: h.mock, now: h.now() })
    const result = await deliver()
    expect(result).toMatchObject({ status: 'processed', action: 'oversold_refunded' })

    const order = await h.orderOfCheckout(checkoutId)
    expect(order.status).toBe('refunded')
    expect(order.statusHistory).toHaveLength(1)
    expect(order.statusHistory![0]).toMatchObject({ transition: 'O19', to: 'refunded' })
    expect(order.invoice ?? null).toBeNull()
    expect(await h.count('invoices')).toBe(0)
    expect(order.items.every((i) => i.status === 'refunded')).toBe(true)
    expect(order.refunds).toHaveLength(1)
    expect(order.refunds![0]).toMatchObject({
      reason: 'item_unavailable',
      amountCents: order.totalCents,
      includesShipping: true,
      status: 'succeeded',
    })
    expect(order.refunds![0]!.stripeRefundId).toMatch(/^re_mock_/)
    expect(order.adminAttention).toMatchObject({ flag: true, reason: 'oversold' })
    expect((await checkoutById(h.payload, checkoutId)).status).toBe('completed')
    expect((await productRow(h.payload, a)).status).toBe('sold')
    expect(await mails(order.id, 'order_confirmation')).toBe(0)
    expect(await mails(order.id, 'oversold_apology')).toBe(1)
    expect(await mails(order.id, 'admin_oversold')).toBe(1)
    expect(await readOutbox({ to: email, type: 'oversold_apology' }, h.outboxDir)).toHaveLength(1)
    expect(
      await h.count(
        'audit_log',
        sql`action = 'reservation_conflict' AND entity_id = ${String(order.id)}`,
      ),
    ).toBe(1)

    // doppelte Zustellung desselben Ereignisses bzw. ein zweites Ereignis derselben Session
    expect((await deliver()).status).toBe('duplicate')
    const again = await h.deliver(session!, 'checkout.session.async_payment_succeeded')
    expect(again.action).toBe('already_fulfilled')
    const after = await h.order(order.id)
    expect(after.refunds).toHaveLength(1)
    expect(await h.count('orders')).toBe(1)
    expect(await mails(order.id, 'oversold_apology')).toBe(1)
  })

  it('AK-4-10 Teilfall: richtige Teil-Erstattung (Stückpreis + Versanddifferenz), Rechnung ohne das fehlende Stück, keine Gutschrift, Hinweis in M01, A06', async () => {
    const a = await h.piece(981) // Keramik (fehlt)
    const b = await h.piece(982, { shippingClass: 'paket_klein' })
    const { checkoutId, session, email } = await h.submitted([a, b])
    await soldElsewhere(a)
    const res = await h.deliver(session!, 'checkout.session.completed')
    expect(res.action).toBe('fulfilled_partially')

    const order = await h.orderOfCheckout(checkoutId)
    expect(order.status).toBe('paid')
    const itemA = order.items.find((i) => i.itemNumber === 981)!
    const itemB = order.items.find((i) => i.itemNumber === 982)!
    expect(itemA).toMatchObject({ status: 'refunded', refundedCents: itemA.priceCents })
    expect(itemB.status).toBe('active')
    const remainingShipping = Math.min(order.shippingCents, await rate('paket_klein'))
    expect(order.shippingCents - remainingShipping).toBeGreaterThan(0)
    const expected = itemA.priceCents + (order.shippingCents - remainingShipping)
    expect(order.refunds).toHaveLength(1)
    expect(order.refunds![0]).toMatchObject({
      reason: 'item_unavailable',
      amountCents: expected,
      status: 'succeeded',
      itemIds: [itemA.id],
    })
    expect(order.adminAttention).toMatchObject({ flag: true, reason: 'oversold' })
    expect((await productRow(h.payload, a)).status).toBe('sold')
    const pb = await dbOf(h.payload).execute(
      sql`SELECT status, current_order_id FROM products WHERE id = ${b}`,
    )
    expect(pb.rows[0]).toMatchObject({ status: 'sold', current_order_id: order.id })

    const invoice = (await h.payload.findByID({
      collection: 'invoices',
      id: order.invoice as number,
      depth: 0,
      overrideAccess: true,
    })) as Invoice
    const data = parseInvoiceData(invoice.data)
    expect(data.lines.map((l) => l.itemNumber)).toEqual([982])
    expect(data.shipping?.totalCents ?? 0).toBe(remainingShipping)
    expect(data.totalGrossCents).toBe(itemB.priceCents + remainingShipping)
    expect(await h.count('invoices', sql`type = 'credit_note'`)).toBe(0)

    expect(await mails(order.id, 'admin_oversold')).toBe(1)
    const m01 = await readOutbox({ to: email, type: 'order_confirmation' }, h.outboxDir)
    expect(m01).toHaveLength(1)
    expect(m01[0]!.text).toContain('Leider schon weg')
  })

  it('Erstattung failed → refunds[].status failed, adminAttention refund_failed, genau eine A08', async () => {
    const a = await h.piece(983)
    const { checkoutId, session } = await h.submitted([a])
    await soldElsewhere(a)
    await h.mock.setNextOutcome(session!, { refund: 'failed' })
    await h.deliver(session!, 'checkout.session.completed')
    const order = await h.orderOfCheckout(checkoutId)
    expect(order.refunds![0]!.status).toBe('failed')
    expect(order.adminAttention).toMatchObject({ flag: true, reason: 'refund_failed' })
    expect(await mails(order.id, 'admin_refund_failed')).toBe(1)
    expect(await mails(order.id, 'admin_oversold')).toBe(1)
  })
})
