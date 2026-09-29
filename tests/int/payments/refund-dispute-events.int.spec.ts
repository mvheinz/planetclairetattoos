import { randomUUID } from 'node:crypto'

import { sql } from '@payloadcms/db-postgres'
import { createLocalReq } from 'payload'
import Stripe from 'stripe'
import { describe, expect, it } from 'vitest'

import { updateOrderFields } from '@/lib/commerce/transitionOrder'
import type { OrderStatus } from '@/lib/enums'
import { stripeEventTemplate } from '@/lib/payments/fixtures'
import type { StripeEventType } from '@/lib/payments/normalize'
import { DISPUTE_LOST_NOTE, DISPUTABLE_STATUSES } from '@/lib/payments/orderEvents'
import { createStripeAdapter } from '@/lib/payments/stripe'
import { handleWebhookRequest } from '@/lib/payments/webhook'
import type { Order } from '@/payload-types'

import { dbOf } from '../helpers/commerce'
import { shopHarness } from '../helpers/shop'

// P4.22 – Erstattungsstatus und Streitfälle (T-02 mit signierten Stripe-Fixtures, doppelte Zustellung ohne
// Doppelwirkung; DM-ORD-01 Teil O16–O18): `refunds[].status` über `stripeRefundId`, `failed` → A08 genau einmal;
// O16 aus jedem erlaubten Status, nicht aus awaiting_prepayment/cancelled/refunded/disputed (A12); O17 zurück auf
// `statusBeforeDispute`; O18 → `refunded` mit genau einer Gutschrift und ohne M09.

const NUMBERS = [990, 991, 992, 993, 994, 995, 996]
const h = shopHarness({ start: '2026-10-06T10:00:00.000Z', numbers: NUMBERS, tag: 'disputes' })
const WHSEC = 'whsec_test_local'
const signer = new Stripe('sk_test_local')

const stripe = () =>
  createStripeAdapter(
    { STRIPE_SECRET_KEY: 'sk_test_local', STRIPE_WEBHOOK_SECRET: WHSEC },
    { clock: h.clock },
  )

/** Signiertes Stripe-Ereignis aus der Fixture mit ersetzten Feldern. */
function signed(type: StripeEventType, object: Record<string, unknown>) {
  const e = stripeEventTemplate(type)
  Object.assign(e.data.object, object)
  const created = Math.floor(h.now().getTime() / 1000)
  const rawBody = JSON.stringify({
    ...e,
    id: `evt_test_${randomUUID().replace(/-/g, '')}`,
    created,
  })
  const header = signer.webhooks.generateTestHeaderString({
    payload: rawBody,
    secret: WHSEC,
    timestamp: created,
  })
  const headers = new Headers({ 'content-type': 'application/json', 'stripe-signature': header })
  return {
    deliver: async () => {
      const res = await handleWebhookRequest(rawBody, headers, {
        payload: h.payload,
        payments: stripe(),
        now: h.now(),
      })
      expect(res.status).toBe(200)
      return res
    },
  }
}

async function paidOrder(nr: number): Promise<Order> {
  const a = await h.piece(nr)
  const { checkoutId, session } = await h.submitted([a])
  await h.deliver(session!, 'checkout.session.completed')
  return h.orderOfCheckout(checkoutId)
}

const pay = (o: Order) => ({
  charge: o.stripe!.chargeId,
  payment_intent: o.stripe!.paymentIntentId,
})
const mails = (orderId: number, template: string) =>
  h.count('email_log', sql`template = ${template} AND order_id = ${orderId}`)
const alerts = () =>
  h.count(
    'email_log',
    sql`template = 'admin_alert' AND idempotency_key LIKE 'admin_alert:dispute_not_applicable@%'`,
  )

async function addRefund(order: Order, row: Record<string, unknown>) {
  const req = await createLocalReq({ context: { system: true } }, h.payload)
  await updateOrderFields(
    req,
    order.id,
    {
      refunds: [
        ...(order.refunds ?? []),
        { reason: 'goodwill', status: 'pending', createdAt: h.now().toISOString(), ...row },
      ],
    },
    h.now(),
  )
}

async function setStatus(orderId: number, status: OrderStatus) {
  await dbOf(h.payload).execute(sql`
    UPDATE orders SET status = ${status}::enum_orders_status, status_before_dispute = NULL,
                      dispute_status = 'none', dispute_stripe_dispute_id = NULL,
                      cancel_reason = ${status === 'cancelled' ? 'admin' : null}
     WHERE id = ${orderId}
  `)
}

const disputeCreated = (o: Order, id = `du_${randomUUID().slice(0, 8)}`) =>
  signed('charge.dispute.created', {
    id,
    ...pay(o),
    amount: o.totalCents,
    status: 'needs_response',
    reason: 'fraudulent',
  })

describe('Erstattungsstatus (P4.22)', () => {
  it('T-02 refund.updated pending → Status bleibt, succeeded → succeeded; doppelte Zustellung ohne Wirkung', async () => {
    const order = await paidOrder(990)
    await addRefund(order, { amountCents: 4500, stripeRefundId: 're_test_upd' })
    const pending = signed('refund.updated', {
      id: 're_test_upd',
      ...pay(order),
      amount: 4500,
      status: 'pending',
    })
    await pending.deliver()
    expect((await h.order(order.id)).refunds![0]!.status).toBe('pending')
    const done = signed('refund.updated', {
      id: 're_test_upd',
      ...pay(order),
      amount: 4500,
      status: 'succeeded',
    })
    await done.deliver()
    await done.deliver()
    const after = await h.order(order.id)
    expect(after.refunds).toHaveLength(1)
    expect(after.refunds![0]!.status).toBe('succeeded')
    expect(after.status).toBe('paid')
    // ein späteres „pending“ überschreibt ein Ergebnis nicht
    await pending.deliver()
    expect((await h.order(order.id)).refunds![0]!.status).toBe('succeeded')
  })

  it('T-02 refund.failed bzw. refund.updated failed → failed, adminAttention refund_failed, A08 genau einmal, kein Statuswechsel', async () => {
    const order = await paidOrder(991)
    await addRefund(order, { amountCents: 4500, stripeRefundId: 're_test_fail' })
    const failed = signed('refund.failed', {
      id: 're_test_fail',
      ...pay(order),
      amount: 4500,
      status: 'failed',
    })
    await failed.deliver()
    await failed.deliver()
    await signed('refund.updated', {
      id: 're_test_fail',
      ...pay(order),
      amount: 4500,
      status: 'failed',
    }).deliver()
    const after = await h.order(order.id)
    expect(after.refunds![0]!.status).toBe('failed')
    expect(after.adminAttention).toMatchObject({ flag: true, reason: 'refund_failed' })
    expect(after.status).toBe('paid')
    expect(await mails(order.id, 'admin_refund_failed')).toBe(1)
  })

  it('T-02 charge.refunded → offene Erstattung bis zur erstatteten Summe succeeded', async () => {
    const order = await paidOrder(992)
    await addRefund(order, { amountCents: 4500 })
    await signed('charge.refunded', {
      id: order.stripe!.chargeId,
      payment_intent: order.stripe!.paymentIntentId,
      amount: order.totalCents,
      amount_refunded: 4500,
      refunded: false,
    }).deliver()
    expect((await h.order(order.id)).refunds![0]!.status).toBe('succeeded')
  })
})

describe('Anfechtungen O16–O18 (DM-ORD-01 Teil)', () => {
  it('DM-ORD-01 O16 aus jedem erlaubten Ausgangsstatus: disputed, statusBeforeDispute, disputedAt, dispute open, Hinweis, A07 je Ereignis genau einmal', async () => {
    const order = await paidOrder(993)
    for (const from of DISPUTABLE_STATUSES) {
      await setStatus(order.id, from)
      const ev = disputeCreated(order)
      await ev.deliver()
      await ev.deliver()
      const o = await h.order(order.id)
      expect(o.status, from).toBe('disputed')
      expect(o.statusBeforeDispute).toBe(from)
      expect(o.timestamps.disputedAt).toBeTruthy()
      expect(o.dispute?.status).toBe('open')
      expect(o.dispute?.stripeDisputeId).toMatch(/^du_/)
      expect(o.adminAttention).toMatchObject({ flag: true, reason: 'dispute_open' })
      expect(o.statusHistory?.at(-1)).toMatchObject({ transition: 'O16', from, to: 'disputed' })
    }
    expect(await mails(order.id, 'admin_dispute_opened')).toBe(DISPUTABLE_STATUSES.size)
  })

  it('DM-ORD-01 O16 nicht aus awaiting_prepayment, cancelled, refunded, disputed → kein Statuswechsel, A12', async () => {
    const order = await paidOrder(994)
    let n = await alerts()
    for (const from of ['awaiting_prepayment', 'cancelled', 'refunded', 'disputed'] as const) {
      await setStatus(order.id, from)
      h.clock.set(new Date(h.now().getTime() + 61 * 60_000)) // A12 wird stündlich gedrosselt
      await disputeCreated(order).deliver()
      expect((await h.order(order.id)).status, from).toBe(from)
      expect(await alerts(), from).toBe(++n)
    }
    expect(await mails(order.id, 'admin_dispute_opened')).toBe(0)
  })

  it('O17 gewonnen → genau der gespeicherte statusBeforeDispute, dispute won, Hinweis entfernt', async () => {
    const order = await paidOrder(995)
    await setStatus(order.id, 'shipped')
    const id = 'du_test_won'
    await disputeCreated(order, id).deliver()
    const closed = signed('charge.dispute.closed', {
      id,
      ...pay(order),
      amount: order.totalCents,
      status: 'won',
    })
    await closed.deliver()
    await closed.deliver()
    const o = await h.order(order.id)
    expect(o.status).toBe('shipped')
    expect(o.dispute?.status).toBe('won')
    expect(o.adminAttention?.flag).toBe(false)
    expect(o.statusHistory?.at(-1)).toMatchObject({
      transition: 'O17',
      from: 'disputed',
      to: 'shipped',
    })
    expect(o.statusHistory?.at(-1)?.note).toBeTruthy()
  })

  it('O18 verloren → refunded, refunds[] dispute succeeded, genau eine Gutschrift zur Rechnung, keine M09', async () => {
    const order = await paidOrder(996)
    await setStatus(order.id, 'delivered')
    const id = 'du_test_lost'
    await disputeCreated(order, id).deliver()
    const closed = signed('charge.dispute.closed', {
      id,
      ...pay(order),
      amount: order.totalCents,
      status: 'lost',
    })
    await closed.deliver()
    await closed.deliver()
    const o = await h.order(order.id)
    expect(o.status).toBe('refunded')
    expect(o.dispute?.status).toBe('lost')
    expect(o.refunds).toHaveLength(1)
    expect(o.refunds![0]).toMatchObject({
      reason: 'dispute',
      status: 'succeeded',
      amountCents: order.totalCents,
    })
    expect(o.statusHistory?.at(-1)).toMatchObject({
      transition: 'O18',
      to: 'refunded',
      note: DISPUTE_LOST_NOTE,
    })
    const credits = await h.payload.find({
      collection: 'invoices',
      where: { type: { equals: 'credit_note' }, order: { equals: order.id } },
      depth: 0,
      overrideAccess: true,
    })
    expect(credits.docs).toHaveLength(1)
    expect(credits.docs[0]!.relatedInvoice).toBe(order.invoice)
    expect(o.refunds![0]!.creditNote).toBe(credits.docs[0]!.id)
    expect(await mails(order.id, 'refund_confirmation')).toBe(0)
  })
})
