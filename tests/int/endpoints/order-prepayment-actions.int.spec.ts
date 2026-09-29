import { sql } from '@payloadcms/db-postgres'
import { createLocalReq } from 'payload'
import { beforeAll, describe, expect, it } from 'vitest'

import { LATE_PAYMENT_SOLD_MESSAGE } from '@/endpoints/orders/actions'
import { cancelOverduePrepayments, placePrepaymentOrder } from '@/lib/commerce/prepayment'
import type { Order } from '@/payload-types'

import { productRow } from '../helpers/checkout'
import { dbOf } from '../helpers/commerce'
import { resetAdmin } from '../helpers/admin'
import { rest } from '../helpers/rest'
import { shopHarness } from '../helpers/shop'

// P4.20 – Admin-Endpunkte der Vorkasse: O3 „Zahlung erhalten“, O4 „Stornieren“ (admin), O5 „Nachträglich bezahlt“
// bzw. „Rücküberweisung erledigt“; Doppelaufruf ohne zweite Rechnung/Mail; anonym 403; falsche Ausgangsstatus
// abgelehnt (Matrix-Teil AK-5-01). Die Bestellung entsteht vor der (System-)Zeit der Endpunkte.

const NUMBERS = [980, 981, 982, 983, 984, 985, 986]
const h = shopHarness({ start: '2026-09-20T08:00:00.000Z', numbers: NUMBERS, tag: 'order-actions' })
let token: string

beforeAll(async () => {
  ;({ token } = await resetAdmin(h.payload, '198.51.100.61'))
})

async function prepaymentOrder(nr: number): Promise<{ order: Order; a: number }> {
  const a = await h.piece(nr)
  const { checkoutId } = await h.submitted([a], { confirming: false })
  const req = await createLocalReq(
    { context: { system: true, now: h.now().toISOString() } },
    h.payload,
  )
  const res = await placePrepaymentOrder(req, checkoutId, { now: h.now(), payments: h.mock })
  await res.afterCommit()
  return { order: res.order, a }
}

async function post(orderId: number, action: string, body: unknown, auth = true) {
  const res = await rest(
    'POST',
    `/orders/${orderId}/${action}`,
    body,
    auth ? { authorization: `JWT ${token}`, 'idempotency-key': crypto.randomUUID() } : {},
  )
  return { status: res.status, json: (await res.json()) as Record<string, unknown> }
}

const mails = (orderId: number, template: string) =>
  h.count('email_log', sql`template = ${template} AND order_id = ${orderId}`)
const invoices = (orderId: number) => h.count('invoices', sql`order_id = ${orderId}`)

async function overdue(orderId: number) {
  const order = await h.order(orderId)
  const now = new Date(Date.parse(order.prepayment!.dueAt!) + 60_000)
  await cancelOverduePrepayments(h.payload, now)
  expect((await h.order(orderId)).cancelReason).toBe('payment_timeout')
}

describe('Vorkasse-Aktionen der Verwaltung (P4.20)', () => {
  it('anonym → 403 für alle drei Endpunkte', async () => {
    const { order } = await prepaymentOrder(980)
    for (const [action, body] of [
      ['prepayment-received', { amountCents: order.totalCents }],
      ['cancel', { reason: 'Test' }],
      ['late-payment', { action: 'reactivate' }],
    ] as const) {
      expect((await post(order.id, action, body, false)).status).toBe(403)
    }
    expect((await h.order(order.id)).status).toBe('awaiting_prepayment')
  })

  it('O3 „Zahlung erhalten“: Verkauf, receivedAt/Betrag, paidAt, Rechnung, M05; Doppelaufruf ohne zweite Rechnung/Mail', async () => {
    const { order, a } = await prepaymentOrder(981)
    const receivedAt = '2026-09-22T09:00:00.000Z'
    const first = await post(order.id, 'prepayment-received', {
      amountCents: order.totalCents,
      receivedAt,
    })
    expect(first.status).toBe(200)
    const paid = await h.order(order.id)
    expect(paid.status).toBe('paid')
    expect(paid.statusHistory?.at(-1)).toMatchObject({ transition: 'O3', actorType: 'admin' })
    expect(paid.prepayment).toMatchObject({ receivedAt, receivedAmountCents: order.totalCents })
    expect(paid.timestamps.paidAt).toBe(receivedAt)
    expect(paid.invoice).toBeTruthy()
    const p = await dbOf(h.payload).execute(
      sql`SELECT status, current_order_id FROM products WHERE id = ${a}`,
    )
    expect(p.rows[0]).toMatchObject({ status: 'sold', current_order_id: order.id })
    expect(await invoices(order.id)).toBe(1)
    expect(await mails(order.id, 'prepayment_received')).toBe(1)

    const second = await post(order.id, 'prepayment-received', { amountCents: order.totalCents })
    expect(second.status).toBe(200)
    expect(second.json.alreadyDone).toBe(true)
    expect(await invoices(order.id)).toBe(1)
    expect(await mails(order.id, 'prepayment_received')).toBe(1)
  })

  it('O3 Betrag ≠ Summe: ohne Bestätigung 409, mit confirmMismatch bezahlt + adminAttention payment_amount_mismatch', async () => {
    const { order } = await prepaymentOrder(982)
    const wrong = await post(order.id, 'prepayment-received', {
      amountCents: order.totalCents - 100,
    })
    expect(wrong.status).toBe(409)
    expect(wrong.json.code).toBe('amount_mismatch')
    expect((await h.order(order.id)).status).toBe('awaiting_prepayment')
    expect(await invoices(order.id)).toBe(0)
    const ok = await post(order.id, 'prepayment-received', {
      amountCents: order.totalCents - 100,
      confirmMismatch: true,
    })
    expect(ok.status).toBe(200)
    const paid = await h.order(order.id)
    expect(paid.status).toBe('paid')
    expect(paid.adminAttention).toMatchObject({ flag: true, reason: 'payment_amount_mismatch' })
  })

  it('O4 (Admin) „Stornieren“: Grund Pflicht, Freigabe, M04 mit Juttas Text, keine A03; Doppelaufruf ohne zweite Mail', async () => {
    const { order, a } = await prepaymentOrder(983)
    expect((await post(order.id, 'cancel', {})).status).toBe(400)
    const res = await post(order.id, 'cancel', { reason: 'Kundin hat abgesagt' })
    expect(res.status).toBe(200)
    const cancelled = await h.order(order.id)
    expect(cancelled).toMatchObject({
      status: 'cancelled',
      cancelReason: 'admin',
      cancelNote: 'Kundin hat abgesagt',
    })
    expect(cancelled.statusHistory?.at(-1)).toMatchObject({ transition: 'O4', actorType: 'admin' })
    expect((await productRow(h.payload, a)).status).toBe('available')
    expect(await mails(order.id, 'prepayment_cancelled')).toBe(1)
    expect(await mails(order.id, 'admin_prepayment_cancelled')).toBe(0)
    const log = await h.payload.find({
      collection: 'email-log',
      where: { template: { equals: 'prepayment_cancelled' }, order: { equals: order.id } },
      depth: 0,
      overrideAccess: true,
    })
    expect(log.docs).toHaveLength(1)
    const again = await post(order.id, 'cancel', { reason: 'Kundin hat abgesagt' })
    expect(again.json.alreadyDone).toBe(true)
    expect(await mails(order.id, 'prepayment_cancelled')).toBe(1)
    expect(await invoices(order.id)).toBe(0)
  })

  it('O5 „Nachträglich bezahlt“: alle Stücke available → paid (O5), Rechnung, M05; Doppelaufruf ohne Wirkung', async () => {
    const { order, a } = await prepaymentOrder(984)
    await overdue(order.id)
    const res = await post(order.id, 'late-payment', { action: 'reactivate' })
    expect(res.status).toBe(200)
    const paid = await h.order(order.id)
    expect(paid.status).toBe('paid')
    expect(paid.statusHistory?.at(-1)).toMatchObject({ transition: 'O5' })
    expect((await productRow(h.payload, a)).status).toBe('sold')
    expect(await invoices(order.id)).toBe(1)
    expect(await mails(order.id, 'prepayment_received')).toBe(1)
    const again = await post(order.id, 'late-payment', { action: 'reactivate' })
    expect(again.json.alreadyDone).toBe(true)
    expect(await invoices(order.id)).toBe(1)
    expect(await mails(order.id, 'prepayment_received')).toBe(1)
  })

  it('O5 Stück inzwischen verkauft → 409 „Stück inzwischen verkauft – bitte Geld zurücküberweisen“; danach „Rücküberweisung erledigt“ als Notiz ohne Rechnung', async () => {
    const { order, a } = await prepaymentOrder(985)
    await overdue(order.id)
    await dbOf(h.payload).execute(
      sql`UPDATE products SET status = 'sold', sold_channel = 'offline' WHERE id = ${a}`,
    )
    const res = await post(order.id, 'late-payment', { action: 'reactivate' })
    expect(res.status).toBe(409)
    expect(res.json.error).toBe(LATE_PAYMENT_SOLD_MESSAGE)
    expect((await h.order(order.id)).status).toBe('cancelled')
    expect(await invoices(order.id)).toBe(0)
    const note = await post(order.id, 'late-payment', {
      action: 'refund_transfer_done',
      note: 'am 03.10. überwiesen',
    })
    expect(note.status).toBe(200)
    const after = await h.order(order.id)
    expect(after.status).toBe('cancelled')
    expect(after.notes).toContain('Rücküberweisung erledigt – am 03.10. überwiesen')
    expect(await invoices(order.id)).toBe(0)
  })

  it('AK-5-01 (Matrix-Teil): falsche Ausgangsstatus werden abgelehnt', async () => {
    const { order } = await prepaymentOrder(986)
    // awaiting_prepayment: „Nachträglich bezahlt“ nicht möglich
    expect((await post(order.id, 'late-payment', { action: 'reactivate' })).status).toBe(409)
    await overdue(order.id)
    // cancelled (payment_timeout): weder „Zahlung erhalten“ noch „Stornieren“
    expect(
      (await post(order.id, 'prepayment-received', { amountCents: order.totalCents })).status,
    ).toBe(409)
    expect((await post(order.id, 'cancel', { reason: 'nochmal' })).status).toBe(409)
    expect((await post(order.id, 'late-payment', { action: 'unbekannt' })).status).toBe(400)
    expect((await h.order(order.id)).status).toBe('cancelled')
  })
})
