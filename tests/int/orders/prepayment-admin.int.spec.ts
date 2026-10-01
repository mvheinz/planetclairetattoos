import { sql } from '@payloadcms/db-postgres'
import { createLocalReq } from 'payload'
import { beforeAll, describe, expect, it } from 'vitest'

import { loadPrepaymentList } from '@/admin/views/orders/prepaymentQuery'
import { LATE_PAYMENT_SOLD_MESSAGE } from '@/endpoints/orders/actions'
import { cancelOverduePrepayments, placePrepaymentOrder } from '@/lib/commerce/prepayment'
import type { Order } from '@/payload-types'

import { productRow } from '../helpers/checkout'
import { dbOf } from '../helpers/commerce'
import { resetAdmin } from '../helpers/admin'
import { rest } from '../helpers/rest'
import { shopHarness } from '../helpers/shop'

// P5.18 – Ansicht „Vorkasse offen“ (KONZEPT §7.7, §4.8): Daten der Liste (Frist, Erinnerung, Bankdaten, Unterliste
// „Kürzlich automatisch storniert“ mit „alle Stücke frei“) und die Wirkung der Knöpfe über die P4.20-Endpunkte:
// „Zahlung erhalten“ → paid, Rechnung und M05 genau einmal (R-071, R-120); „Nachträglich bezahlt“ (O5) nur, wenn alle
// Stücke frei sind, sonst 409 ohne Änderung. Fixture analog O13 (`awaiting_prepayment`, Versand).

const NUMBERS = [992, 993, 994, 995]
// Sa 26.09.2026 10:00 Berlin → Frist Do 01.10. 23:59:59 Berlin
const h = shopHarness({ start: '2026-09-26T08:00:00.000Z', numbers: NUMBERS, tag: 'p518' })
let token: string

beforeAll(async () => {
  ;({ token } = await resetAdmin(h.payload, '198.51.100.62'))
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

async function post(orderId: number, action: string, body: unknown) {
  const res = await rest('POST', `/orders/${orderId}/${action}`, body, {
    authorization: `JWT ${token}`,
    'idempotency-key': crypto.randomUUID(),
  })
  return { status: res.status, json: (await res.json()) as Record<string, unknown> }
}

const list = async (iso: string) =>
  loadPrepaymentList(await createLocalReq({}, h.payload), new Date(iso))
const mails = (orderId: number, template: string) =>
  h.count('email_log', sql`template = ${template} AND order_id = ${orderId}`)
const invoices = (orderId: number) => h.count('invoices', sql`order_id = ${orderId}`)

async function overdue(orderId: number) {
  const order = await h.order(orderId)
  await cancelOverduePrepayments(h.payload, new Date(Date.parse(order.prepayment!.dueAt!) + 60_000))
  expect((await h.order(orderId)).cancelReason).toBe('payment_timeout')
}

describe('„Vorkasse offen“ (P5.18)', () => {
  it('R-071 Fixture analog O13 erscheint mit Frist, Erinnerung und Bankdaten; „Zahlung erhalten“ → paid, Rechnung, M05 genau einmal (R-120)', async () => {
    const { order } = await prepaymentOrder(992)
    expect(order.fulfillmentMethod).toBe('shipping')

    // Mo 28.09. 12:00 Berlin: noch 3 Tage (Frist Do 01.10.)
    const before = await list('2026-09-28T10:00:00.000Z')
    const card = before.open.find((c) => c.id === order.id)
    expect(card).toMatchObject({
      orderNumber: order.orderNumber,
      totalCents: order.totalCents,
      placedAt: '26.09.2026',
      dueDate: '01.10.2026',
      daysLeft: 3,
      reminderSent: false,
    })
    expect(card!.bankText).toContain(`Verwendungszweck: ${order.orderNumber}`)
    expect(card!.bankText).toMatch(/IBAN: DE\d\d( \d{4}){4} \d\d/)
    // Am letzten Tag: 0 (rot)
    expect(
      (await list('2026-10-01T20:00:00.000Z')).open.find((c) => c.id === order.id)?.daysLeft,
    ).toBe(0)

    const first = await post(order.id, 'prepayment-received', { amountCents: order.totalCents })
    expect(first.status).toBe(200)
    const second = await post(order.id, 'prepayment-received', { amountCents: order.totalCents })
    expect(second.json.unchanged).toBe(true)
    const paid = await h.order(order.id)
    expect(paid.status).toBe('paid')
    expect(paid.prepayment?.receivedAmountCents).toBe(order.totalCents)
    expect(await invoices(order.id)).toBe(1)
    expect(await mails(order.id, 'prepayment_received')).toBe(1)
    expect((await list('2026-09-28T10:00:00.000Z')).open.some((c) => c.id === order.id)).toBe(false)
  })

  it('R-071 O5 „Nachträglich bezahlt“ nur, wenn alle Stücke frei sind; ein verkauftes Stück → 409 ohne Änderung', async () => {
    const free = await prepaymentOrder(993)
    const gone = await prepaymentOrder(994)
    await overdue(free.order.id)
    await overdue(gone.order.id)
    await dbOf(h.payload).execute(
      sql`UPDATE products SET status = 'sold', sold_channel = 'offline' WHERE id = ${gone.a}`,
    )

    const view = await list('2026-10-02T08:00:00.000Z')
    expect(view.cancelled.find((c) => c.id === free.order.id)).toMatchObject({
      allAvailable: true,
      cancelledAt: '02.10.2026',
    })
    expect(view.cancelled.find((c) => c.id === gone.order.id)?.allAvailable).toBe(false)
    // nach 30 Tagen nicht mehr in der Unterliste
    expect(
      (await list('2026-11-02T08:00:00.000Z')).cancelled.some((c) => c.id === free.order.id),
    ).toBe(false)

    const before = await h.order(gone.order.id)
    const refused = await post(gone.order.id, 'late-payment', { action: 'reactivate' })
    expect(refused.status).toBe(409)
    expect(refused.json).toMatchObject({
      error: LATE_PAYMENT_SOLD_MESSAGE,
      code: 'items_unavailable',
    })
    const after = await h.order(gone.order.id)
    expect(after.status).toBe('cancelled')
    expect(after.statusHistory).toHaveLength(before.statusHistory?.length ?? 0)
    expect((await productRow(h.payload, gone.a)).status).toBe('sold')
    expect(await invoices(gone.order.id)).toBe(0)
    expect(await mails(gone.order.id, 'prepayment_received')).toBe(0)

    const ok = await post(free.order.id, 'late-payment', { action: 'reactivate' })
    expect(ok.status).toBe(200)
    const paid = await h.order(free.order.id)
    expect(paid.status).toBe('paid')
    expect(paid.statusHistory?.at(-1)).toMatchObject({ transition: 'O5' })
    expect((await productRow(h.payload, free.a)).status).toBe('sold')
    expect(await invoices(free.order.id)).toBe(1)
    expect(await mails(free.order.id, 'prepayment_received')).toBe(1)
  })
})
