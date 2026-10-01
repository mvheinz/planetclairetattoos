import { sql } from '@payloadcms/db-postgres'
import { beforeAll, describe, expect, it } from 'vitest'

import type { Order } from '@/payload-types'

import { resetAdmin } from '../helpers/admin'
import { createOrder, dbOf, orderData } from '../helpers/commerce'
import { rest } from '../helpers/rest'
import { shopHarness } from '../helpers/shop'

// P5.9 – Aktions-Rahmen der Bestell-Aktionen (`src/endpoints/orders/_action.ts`): Admin-Pflicht, Prüfung gegen
// ORDER_TRANSITIONS (409 ohne Änderung), Statusverlauf mit Auslöser `admin` und O-Nummer, Audit; „Erneut senden“ von
// M01 über die Outbox mit Dialog-Schlüssel (ein Eintrag je Dialog, zweiter Tipp ohne Wirkung).

const NUMBERS = [980, 981, 982, 983, 984]
const h = shopHarness({ start: '2026-09-20T08:00:00.000Z', numbers: NUMBERS, tag: 'admin-action' })
let token: string

beforeAll(async () => {
  ;({ token } = await resetAdmin(h.payload, '198.51.100.71'))
})

async function post(orderId: number, action: string, body: unknown = {}, auth = true) {
  const res = await rest(
    'POST',
    `/orders/${orderId}/${action}`,
    body,
    auth ? { authorization: `JWT ${token}`, 'idempotency-key': crypto.randomUUID() } : {},
  )
  return { status: res.status, json: (await res.json()) as Record<string, unknown> }
}

/** Bezahlte Bestellung über den echten Ablauf (Kasse → Webhook → O1, M01 im Mail-Log). */
async function paidOrder(nr: number): Promise<Order> {
  const a = await h.piece(nr)
  const { session, checkoutId } = await h.submitted([a])
  await h.deliver(session!, 'checkout.session.completed')
  return h.orderOfCheckout(checkoutId)
}

const audits = (orderId: number, action: string) =>
  h.count('audit_log', sql`action = ${action} AND entity_id = ${String(orderId)}`)
const mails = (orderId: number, template: string) =>
  h.count('email_log', sql`template = ${template} AND order_id = ${orderId}`)

describe('Aktions-Rahmen der Bestellungen (P5.9)', () => {
  it('ohne Anmeldung 403, unbekannte Bestellung 404', async () => {
    const order = await paidOrder(980)
    expect((await post(order.id, 'packed', {}, false)).status).toBe(403)
    expect((await post(order.id, 'resend-email', {}, false)).status).toBe(403)
    expect((await post(999_999_999, 'packed')).status).toBe(404)
    expect((await h.order(order.id)).status).toBe('paid')
  })

  it('AK-5-02 unerlaubter Übergang über den Rahmen → 409 ohne Änderung; erlaubter → Historie mit Auslöser admin und O-Nummer, Audit', async () => {
    const a = await h.piece(981)
    const shipped = await createOrder(
      h.payload,
      orderData(98_101, [{ id: a, itemNumber: 981 }], {
        status: 'shipped',
        timestamps: {
          placedAt: '2026-09-18T10:00:00.000Z',
          shippedAt: '2026-09-19T10:00:00.000Z',
        },
      }),
      { seed: true },
    )
    const before = await h.order(shipped.id as number)
    const denied = await post(before.id, 'packed')
    expect(denied.status).toBe(409)
    expect(String(denied.json.error)).toMatch(/kann nicht von/)
    const after = await h.order(before.id)
    expect(after.status).toBe('shipped')
    expect(after.statusHistory).toEqual(before.statusHistory)
    expect(after.packaging?.recordedAt ?? null).toBeNull()

    const order = await paidOrder(982)
    const ok = await post(order.id, 'packed')
    expect(ok.status).toBe(200)
    expect(ok.json.unchanged).toBe(false)
    const packed = await h.order(order.id)
    expect(packed.status).toBe('packed')
    expect(packed.statusHistory?.at(-1)).toMatchObject({
      from: 'paid',
      to: 'packed',
      transition: 'O6',
      actorType: 'admin',
    })
    expect(packed.timestamps.packedAt).toBeTruthy()
    expect(await audits(order.id, 'order_status_changed')).toBe(1)
  })

  it('„Erneut senden“ M01: genau ein neuer email-log-Eintrag je Dialog; zweiter Tipp im selben Dialog ohne Wirkung', async () => {
    const order = await paidOrder(983)
    expect(await mails(order.id, 'order_confirmation')).toBe(1)
    const dialogKey = crypto.randomUUID()
    const first = await post(order.id, 'resend-email', {
      template: 'order_confirmation',
      dialogKey,
    })
    expect(first.status).toBe(200)
    expect(first.json.unchanged).toBe(false)
    expect(await mails(order.id, 'order_confirmation')).toBe(2)

    const again = await post(order.id, 'resend-email', {
      template: 'order_confirmation',
      dialogKey,
    })
    expect(again.status).toBe(200)
    expect(again.json.unchanged).toBe(true)
    expect(await mails(order.id, 'order_confirmation')).toBe(2)

    // neuer Dialog → neue Mail
    const next = await post(order.id, 'resend-email', {
      template: 'order_confirmation',
      dialogKey: crypto.randomUUID(),
    })
    expect(next.status).toBe(200)
    expect(await mails(order.id, 'order_confirmation')).toBe(3)
    const keys = await dbOf(h.payload).execute(
      sql`SELECT idempotency_key FROM email_log WHERE order_id = ${order.id} AND template = 'order_confirmation' ORDER BY id`,
    )
    expect(keys.rows.map((r) => r.idempotency_key)).toEqual([
      `order_confirmation:${order.id}:O1`,
      `order_confirmation:${order.id}:resend-${dialogKey}`,
      expect.stringMatching(new RegExp(`^order_confirmation:${order.id}:resend-`)),
    ])
  })

  it('„Erneut senden“ nur für schon verschickte Mails (M01, M02, M05, M06, M07) und mit gültigem Dialog-Schlüssel', async () => {
    const order = await paidOrder(984)
    // M02 gab es bei einer Kartenzahlung nie
    const never = await post(order.id, 'resend-email', {
      template: 'prepayment_instructions',
      dialogKey: crypto.randomUUID(),
    })
    expect(never.status).toBe(409)
    // andere Mails (z. B. M09) gar nicht
    const other = await post(order.id, 'resend-email', {
      template: 'refund_confirmation',
      dialogKey: crypto.randomUUID(),
    })
    expect(other.status).toBe(400)
    const noKey = await post(order.id, 'resend-email', { template: 'order_confirmation' })
    expect(noKey.status).toBe(400)
    expect(await mails(order.id, 'order_confirmation')).toBe(1)
  })
})
