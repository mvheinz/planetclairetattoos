import { sql } from '@payloadcms/db-postgres'
import { beforeAll, describe, expect, it } from 'vitest'

import type { Order } from '@/payload-types'

import { readOutbox } from '../../helpers/outbox'
import { resetAdmin } from '../helpers/admin'
import { createOrder, orderData, type ItemInput } from '../helpers/commerce'
import { rest } from '../helpers/rest'
import { shopHarness } from '../helpers/shop'

// P5.15 – „Versendet melden“ (O7, KONZEPT §7.6, DATENMODELL §6.8.5) mit Versandmail M06 (`order_shipped`, R-082):
// Sendungsnummer Pflicht bei `paket_klein`/`keramik`, bei `brief` optional (DM-ORD-08, ohne Nummer kein Link);
// Idempotenz-Schlüssel `order_shipped:<id>:<Nummer | none>`, Doppeltipp → eine Mail; „Erneut senden“ (P5.9).

const NUMBERS = [988, 989, 990, 991, 992]
const h = shopHarness({ start: '2026-10-01T08:00:00.000Z', numbers: NUMBERS, tag: 'ship' })
const EMAIL = 'kundin@planetclairetattoos.com'
let token: string
let seq = 0

beforeAll(async () => {
  ;({ token } = await resetAdmin(h.payload, '198.51.100.78'))
})

async function paidOrder(
  nr: number,
  shippingClass: NonNullable<ItemInput['shippingClass']>,
  locale: 'de' | 'en' = 'de',
): Promise<Order> {
  const id = await h.piece(nr)
  return (await createOrder(
    h.payload,
    orderData(99_500 + ++seq, [{ id, itemNumber: nr, shippingClass }], {
      shippingClass,
      locale,
      customer: { name: 'Erika Beispiel', email: EMAIL },
    }),
  )) as Order
}

const post = async (orderId: number, action: string, body: unknown = {}) => {
  const res = await rest('POST', `/orders/${orderId}/${action}`, body, {
    authorization: `JWT ${token}`,
    'idempotency-key': crypto.randomUUID(),
  })
  return { status: res.status, json: (await res.json()) as Record<string, unknown> }
}

const logRows = async (orderId: number) =>
  (
    await h.payload.find({
      collection: 'email-log',
      where: { and: [{ order: { equals: orderId } }, { template: { equals: 'order_shipped' } }] },
      sort: 'id',
      overrideAccess: true,
      depth: 0,
    })
  ).docs

const sent = async (orderNumber: string) =>
  (await readOutbox({ to: EMAIL, type: 'order_shipped' }, h.outboxDir)).filter((r) =>
    r.subject.includes(orderNumber),
  )

describe('„Versendet melden“ mit M06 (P5.15)', () => {
  it('AK-7-05 paid → „Gepackt“ → Sendungsnummer → „Versendet melden“: shipped, M06 im Mail-Log und zugestellt; Doppeltipp → eine Mail', async () => {
    const order = await paidOrder(988, 'paket_klein')
    expect((await post(order.id, 'packed')).status).toBe(200)
    const [a, b] = await Promise.all([
      post(order.id, 'ship', { carrier: 'dhl', trackingNumber: '00340 4343 1234 5678 90' }),
      post(order.id, 'ship', { carrier: 'dhl', trackingNumber: '00340 4343 1234 5678 90' }),
    ])
    expect([a.status, b.status]).toEqual([200, 200])
    expect([a.json.unchanged, b.json.unchanged].sort()).toEqual([false, true])
    const shipped = await h.order(order.id)
    expect(shipped.status).toBe('shipped')
    expect(shipped.shipment).toMatchObject({
      carrier: 'dhl',
      trackingNumber: '0034043431234567890',
    })
    expect(shipped.shipment?.trackingUrl).toContain('piececode=0034043431234567890')
    const rows = await logRows(order.id)
    expect(rows).toHaveLength(1)
    expect(rows[0]!.idempotencyKey).toBe(`order_shipped:${order.id}:0034043431234567890`)
    expect(rows[0]!.status).toBe('sent')
    const mails = await sent(order.orderNumber)
    expect(mails).toHaveLength(1)
    expect(mails[0]!.subject).toBe(`Dein Paket ist unterwegs – ${order.orderNumber}`)
    expect(mails[0]!.text).toContain('Sendungsnummer: 0034043431234567890')
    expect(mails[0]!.html).toContain('piececode=0034043431234567890')
    expect(mails[0]!.text).toContain('unberührt')
    expect(mails[0]!.text).toContain('Vertrag widerrufen')
    // Status-Link mit echtem Token (aus dem Siegel), kein Platzhalter
    expect(mails[0]!.text).not.toContain('__STATUS_TOKEN__')
  })

  it('DM-ORD-08 paket_klein und keramik ohne Sendungsnummer → 409 ohne Änderung; ungültige Nummer → 400', async () => {
    for (const [nr, cls] of [
      [989, 'paket_klein'],
      [990, 'keramik'],
    ] as const) {
      const order = await paidOrder(nr, cls)
      expect((await post(order.id, 'packed')).status).toBe(200)
      const res = await post(order.id, 'ship', { confirmWithoutPackingPhoto: true })
      expect(res.status, cls).toBe(409)
      expect(String(res.json.error)).toMatch(/Sendungsnummer/)
      expect((await post(order.id, 'ship', { trackingNumber: 'ABC' })).status).toBe(400)
      expect((await post(order.id, 'ship', { trackingNumber: 'JJD-0003-9000' })).status).toBe(400)
      expect((await h.order(order.id)).status).toBe('packed')
      expect(await logRows(order.id)).toHaveLength(0)
    }
  })

  it('DM-ORD-08 brief ohne Sendungsnummer → shipped, M06 ohne Sendungsnummer und ohne Verfolgungslink (EN nach Bestellsprache)', async () => {
    const order = await paidOrder(991, 'brief', 'en')
    expect((await post(order.id, 'packed')).status).toBe(200)
    const res = await post(order.id, 'ship', {})
    expect(res.status).toBe(200)
    const shipped = await h.order(order.id)
    expect(shipped.status).toBe('shipped')
    expect(shipped.shipment?.carrier).toBe('deutsche_post')
    expect(shipped.shipment?.trackingNumber ?? null).toBeNull()
    expect(shipped.shipment?.trackingUrl ?? null).toBeNull()
    const rows = await logRows(order.id)
    expect(rows.map((r) => r.idempotencyKey)).toEqual([`order_shipped:${order.id}:none`])
    const mails = await sent(order.orderNumber)
    expect(mails).toHaveLength(1)
    expect(mails[0]!.subject).toBe(`Your parcel is on its way – ${order.orderNumber}`)
    expect(mails[0]!.text).not.toMatch(/Tracking number/)
    expect(mails[0]!.html).not.toContain('dhl.de')
    expect(mails[0]!.text).toContain('Deutsche Post')
  })

  it('„Erneut senden“ von M06 legt genau einen neuen email-log-Eintrag an, zweiter Tipp im selben Dialog keinen', async () => {
    const order = await paidOrder(992, 'paket_klein')
    expect((await post(order.id, 'packed')).status).toBe(200)
    expect((await post(order.id, 'ship', { trackingNumber: 'JJD000390007123456' })).status).toBe(
      200,
    )
    expect(await logRows(order.id)).toHaveLength(1)
    const dialogKey = crypto.randomUUID()
    const first = await post(order.id, 'resend-email', { template: 'order_shipped', dialogKey })
    expect(first.status).toBe(200)
    expect(first.json.unchanged).toBe(false)
    const second = await post(order.id, 'resend-email', { template: 'order_shipped', dialogKey })
    expect(second.status).toBe(200)
    expect(second.json.unchanged).toBe(true)
    const rows = await logRows(order.id)
    expect(rows).toHaveLength(2)
    expect(rows[1]!.idempotencyKey).toBe(`order_shipped:${order.id}:resend-${dialogKey}`)
    expect(
      await h.count('email_log', sql`template = 'order_shipped' AND order_id = ${order.id}`),
    ).toBe(2)
    expect(await sent(order.orderNumber)).toHaveLength(2)
  })
})
