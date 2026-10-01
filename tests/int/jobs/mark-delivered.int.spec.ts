import { sql } from '@payloadcms/db-postgres'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { runTaskNow } from '@/lib/jobs/runTask'
import type { Order } from '@/payload-types'

import { resetAdmin } from '../helpers/admin'
import { createOrder, dbOf, orderData } from '../helpers/commerce'
import { rest } from '../helpers/rest'
import { shopHarness } from '../helpers/shop'

// P5.16 – Task `markDelivered` (DATENMODELL §6.8.5 O10, DM-14, ARCHITEKTUR Anhang A.3): `shipped` mit Versandtag
// (Berlin) mindestens 10 Kalendertage zurück → `delivered`, `deliveredSource = auto`, `deliveredAt`, keine Mail;
// täglich ab 03:00 Berlin, zweiter Lauf ohne Wirkung (AK-8-01). Dazu „Zugestellt“ (manuell) und
// „Sendungsnummer korrigieren“ mit bzw. ohne neue Versandmail.

const NUMBERS = [980, 981, 982]
const h = shopHarness({ start: '2026-10-01T08:00:00.000Z', numbers: NUMBERS, tag: 'delivered' })
const EMAIL = 'kundin@planetclairetattoos.com'
let token: string
let seq = 0

beforeAll(async () => {
  ;({ token } = await resetAdmin(h.payload, '198.51.100.79'))
})

beforeEach(async () => {
  await dbOf(h.payload).execute(sql`DELETE FROM job_runs WHERE task = 'markDelivered'`)
})

async function shippedOrder(nr: number, shippedAt: string): Promise<Order> {
  const id = await h.piece(nr)
  return (await createOrder(
    h.payload,
    orderData(99_700 + ++seq, [{ id, itemNumber: nr, shippingClass: 'paket_klein' }], {
      status: 'shipped',
      shippingClass: 'paket_klein',
      customer: { name: 'Erika Beispiel', email: EMAIL },
      shipment: { carrier: 'dhl', trackingNumber: 'JJD000390007123456' },
      timestamps: { placedAt: '2026-09-30T10:00:00.000Z', shippedAt },
    }),
    { seed: true },
  )) as Order
}

const run = (iso: string) => runTaskNow(h.payload, 'markDelivered', { now: new Date(iso) })

const post = async (orderId: number, action: string, body: unknown = {}) => {
  const res = await rest('POST', `/orders/${orderId}/${action}`, body, {
    authorization: `JWT ${token}`,
    'idempotency-key': crypto.randomUUID(),
  })
  return { status: res.status, json: (await res.json()) as Record<string, unknown> }
}

const shippedMails = (orderId: number) =>
  h.count('email_log', sql`template = 'order_shipped' AND order_id = ${orderId}`)

describe('markDelivered (P5.16)', () => {
  it('AK-8-01 Versand am 01.10. 10:00: Lauf am 10.10. ändert nichts, erster Lauf am 11.10. ab 03:00 setzt delivered (auto, ohne Mail); zweiter Lauf ohne Wirkung', async () => {
    const order = await shippedOrder(980, '2026-10-01T08:00:00.000Z') // 10:00 Berlin
    await run('2026-10-10T20:00:00.000Z') // 10.10. 22:00 Berlin
    expect((await h.order(order.id)).status).toBe('shipped')
    await run('2026-10-11T00:30:00.000Z') // 11.10. 02:30 Berlin – vor 03:00
    expect((await h.order(order.id)).status).toBe('shipped')

    await run('2026-10-11T01:05:00.000Z') // 11.10. 03:05 Berlin
    const delivered = await h.order(order.id)
    expect(delivered.status).toBe('delivered')
    expect(delivered.shipment?.deliveredSource).toBe('auto')
    expect(delivered.timestamps.deliveredAt).toBe('2026-10-11T01:05:00.000Z')
    expect(delivered.statusHistory?.at(-1)).toMatchObject({ transition: 'O10', actorType: 'job' })
    expect(await h.count('email_log', sql`order_id = ${order.id}`)).toBe(0)

    const history = delivered.statusHistory?.length
    await run('2026-10-11T05:00:00.000Z')
    await run('2026-10-12T05:00:00.000Z')
    const again = await h.order(order.id)
    expect(again.statusHistory?.length).toBe(history)
    expect(again.timestamps.deliveredAt).toBe('2026-10-11T01:05:00.000Z')
  })

  it('„Zugestellt“ (O10 manuell) und „Sendungsnummer korrigieren“: „nein“ ohne Mail, „ja“ genau eine', async () => {
    const order = await shippedOrder(981, '2026-10-01T08:00:00.000Z')
    const no = await post(order.id, 'tracking', {
      trackingNumber: '00340 4343 1234 5678 90',
      resendMail: false,
    })
    expect(no.status).toBe(200)
    expect(no.json.mailQueued).toBe(false)
    let current = await h.order(order.id)
    expect(current.shipment?.trackingNumber).toBe('0034043431234567890')
    expect(current.shipment?.trackingUrl).toContain('piececode=0034043431234567890')
    expect(await shippedMails(order.id)).toBe(0)

    const yes = await post(order.id, 'tracking', {
      trackingNumber: 'JJD000390007654321',
      resendMail: true,
    })
    expect(yes.status).toBe(200)
    expect(yes.json.mailQueued).toBe(true)
    // Doppeltipp „ja“ → keine zweite Mail
    const twice = await post(order.id, 'tracking', {
      trackingNumber: 'JJD000390007654321',
      resendMail: true,
    })
    expect(twice.json.mailQueued).toBe(false)
    expect(twice.json.unchanged).toBe(true)
    expect(await shippedMails(order.id)).toBe(1)
    expect((await post(order.id, 'tracking', { trackingNumber: 'ABC' })).status).toBe(400)

    const done = await post(order.id, 'delivered')
    expect(done.status).toBe(200)
    current = await h.order(order.id)
    expect(current.status).toBe('delivered')
    expect(current.shipment?.deliveredSource).toBe('manual')
    expect(current.statusHistory?.at(-1)).toMatchObject({ transition: 'O10', actorType: 'admin' })
    expect((await post(order.id, 'delivered')).json.unchanged).toBe(true)
  })

  it('„Zugestellt“ nur bei versendeten Bestellungen (paid → 409)', async () => {
    const id = await h.piece(982)
    const paid = (await createOrder(
      h.payload,
      orderData(99_700 + ++seq, [{ id, itemNumber: 982 }]),
    )) as Order
    expect((await post(paid.id, 'delivered')).status).toBe(409)
    expect((await h.order(paid.id)).status).toBe('paid')
  })
})
