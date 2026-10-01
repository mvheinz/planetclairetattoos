import { createLocalReq } from 'payload'
import { beforeAll, describe, expect, it } from 'vitest'

import { loadPickupList } from '@/admin/views/orders/fulfillmentQuery'
import { goodsReceivedAt, warrantyStart, withdrawalPeriodEnd } from '@/lib/legal/periods'
import type { Order } from '@/payload-types'

import { PICKUP_READY_FIXTURE, renderFixture, scanMail } from '../../helpers/mails'
import { readOutbox } from '../../helpers/outbox'
import { plain, rawTokens, snapshotPath } from '../../unit/email/templates/helpers'
import { resetAdmin } from '../helpers/admin'
import { createOrder, orderData } from '../helpers/commerce'
import { TEST_BUSINESS } from '../helpers/invoices'
import { rest } from '../helpers/rest'
import { shopHarness } from '../helpers/shop'

// P5.17 – Abholung (KONZEPT §4.9/§7.9, E-29, R-083, R-102): „Bereit zur Abholung“ (O8) mit vorbelegtem, bestätigtem
// Abholtext (an der Bestellung gespeichert) und Mail M07 mit Text und Adresse; „Erneut senden“ (P5.9); „Abgeholt“ (O9)
// setzt `pickedUpAt` = Beginn von Widerrufsfrist (Ende des Berliner Tages + 14) und Gewährleistung.

const NUMBERS = [993, 994, 995, 996]
const h = shopHarness({ start: '2026-10-01T08:00:00.000Z', numbers: NUMBERS, tag: 'pickup' })
const EMAIL = 'kundin@planetclairetattoos.com'
let token: string
let seq = 0

beforeAll(async () => {
  ;({ token } = await resetAdmin(h.payload, '198.51.100.80'))
})

async function pickupOrder(
  nr: number,
  extra: Record<string, unknown> = {},
  context?: Record<string, unknown>,
): Promise<Order> {
  const id = await h.piece(nr)
  return (await createOrder(
    h.payload,
    orderData(99_800 + ++seq, [{ id, itemNumber: nr }], {
      fulfillmentMethod: 'pickup',
      shippingAddress: undefined,
      shippingZone: undefined,
      shippingClass: undefined,
      shippingCents: 0,
      totalCents: 4500,
      customer: { name: 'Erika Beispiel', email: EMAIL },
      billingAddress: {
        name: 'Erika Beispiel',
        addressLine1: 'Musterstraße 1',
        postalCode: '10115',
        city: 'Berlin',
        country: 'DE',
      },
      timestamps: { placedAt: '2026-09-30T10:00:00.000Z', paidAt: '2026-09-30T10:05:00.000Z' },
      ...extra,
    }),
    ...(context ? [context] : []),
  )) as Order
}

const post = async (orderId: number, action: string, body: unknown = {}) => {
  const res = await rest('POST', `/orders/${orderId}/${action}`, body, {
    authorization: `JWT ${token}`,
    'idempotency-key': crypto.randomUUID(),
  })
  return { status: res.status, json: (await res.json()) as Record<string, unknown> }
}

const m07Rows = async (orderId: number) =>
  (
    await h.payload.find({
      collection: 'email-log',
      where: { and: [{ order: { equals: orderId } }, { template: { equals: 'pickup_ready' } }] },
      sort: 'id',
      overrideAccess: true,
      depth: 0,
    })
  ).docs

describe('Abholung (P5.17)', () => {
  it('R-083 bezahlte Abholbestellung → „Bereit zur Abholung“: vorbelegter Text mit Adresse, gespeichert, M07 mit Text und Adresse; erneut senden genau ein neuer Eintrag', async () => {
    const order = await pickupOrder(993)
    const req = await createLocalReq({}, h.payload)
    const card = (await loadPickupList(req, h.now())).find((c) => c.id === order.id)!
    expect(card.status).toBe('paid')
    expect(card.template).toContain('Abholung in Berlin nach Absprache')
    expect(card.template).toContain(TEST_BUSINESS.street)
    expect(card.template).toContain(`${TEST_BUSINESS.postalCode} ${TEST_BUSINESS.city}`)

    const text = `${card.template}\nMöglich: Di und Do 16–19 Uhr.`
    expect((await post(order.id, 'pickup-ready', { messageText: '  ' })).status).toBe(400)
    const ok = await post(order.id, 'pickup-ready', { messageText: text })
    expect(ok.status).toBe(200)
    const ready = await h.order(order.id)
    expect(ready.status).toBe('ready_for_pickup')
    expect(ready.pickup?.messageText).toBe(text)
    expect(ready.timestamps.readyForPickupAt).toBeTruthy()
    expect(ready.statusHistory?.at(-1)).toMatchObject({ transition: 'O8', actorType: 'admin' })
    // Doppeltipp → keine zweite Mail
    expect((await post(order.id, 'pickup-ready', { messageText: text })).json.unchanged).toBe(true)
    const rows = await m07Rows(order.id)
    expect(rows.map((r) => r.idempotencyKey)).toEqual([`pickup_ready:${order.id}:O8`])
    const mails = (await readOutbox({ to: EMAIL, type: 'pickup_ready' }, h.outboxDir)).filter((m) =>
      m.subject.includes(order.orderNumber),
    )
    expect(mails).toHaveLength(1)
    expect(mails[0]!.subject).toBe(`Abholbereit: Bestellung ${order.orderNumber}`)
    expect(mails[0]!.text).toContain('Möglich: Di und Do 16–19 Uhr.')
    expect(mails[0]!.text).toContain(TEST_BUSINESS.street)
    expect(mails[0]!.text).toContain('Antworte einfach auf diese Mail')

    const dialogKey = crypto.randomUUID()
    const again = await post(order.id, 'resend-email', { template: 'pickup_ready', dialogKey })
    expect(again.status).toBe(200)
    expect(
      (await post(order.id, 'resend-email', { template: 'pickup_ready', dialogKey })).json
        .unchanged,
    ).toBe(true)
    expect(await m07Rows(order.id)).toHaveLength(2)
  })

  for (const locale of ['de', 'en'] as const) {
    it(`R-083 M07 Snapshot ${locale}: bestätigter Text und Adresse, keine Werbung, keine externen Links`, async () => {
      const m = plain(
        await renderFixture('pickup_ready', PICKUP_READY_FIXTURE, locale, {
          withStatusLink: true,
        }),
      )
      expect(m.text).toContain('Abholung im Atelier nach Absprache')
      expect(m.text).toContain('Planet Claire, Musterstraße 1, 10115 Berlin')
      expect(m.subject).toBe(
        locale === 'de'
          ? 'Abholbereit: Bestellung PC-2026-00017'
          : 'Ready for pickup: order PC-2026-00017',
      )
      expect(rawTokens(m)).toEqual([])
      expect(scanMail(m)).toEqual([])
      await expect(m.text).toMatchFileSnapshot(snapshotPath('pickup_ready', locale, 'txt'))
      await expect(m.html).toMatchFileSnapshot(snapshotPath('pickup_ready', locale, 'html'))
    })
  }

  it('R-083 Fixture analog O09 (ready_for_pickup) erscheint mit Wartetagen; mehr als 14 Tage markiert', async () => {
    const waiting = await pickupOrder(
      994,
      {
        status: 'ready_for_pickup',
        pickup: { messageText: 'Abholung nach Absprache.' },
        timestamps: {
          placedAt: '2026-09-10T10:00:00.000Z',
          paidAt: '2026-09-10T10:05:00.000Z',
          readyForPickupAt: '2026-09-12T10:00:00.000Z',
        },
      },
      { seed: true },
    )
    const req = await createLocalReq({}, h.payload)
    const at = new Date('2026-10-01T08:00:00.000Z')
    const card = (await loadPickupList(req, at)).find((c) => c.id === waiting.id)!
    expect(card.status).toBe('ready_for_pickup')
    expect(card.waitingDays).toBe(19)
    expect(card.overdue).toBe(true)
    const early = (await loadPickupList(req, new Date('2026-09-20T08:00:00.000Z'))).find(
      (c) => c.id === waiting.id,
    )!
    expect(early.waitingDays).toBe(8)
    expect(early.overdue).toBe(false)
  })

  it('R-102 „Abgeholt“ (O9): pickedUpAt bestimmt Widerrufsfrist-Ende (Ende des Berliner Tages + 14) und Gewährleistungsbeginn', async () => {
    const order = await pickupOrder(995)
    expect((await post(order.id, 'picked-up')).status).toBe(409) // erst abholbereit
    expect(
      (await post(order.id, 'pickup-ready', { messageText: 'Abholung nach Absprache.' })).status,
    ).toBe(200)
    const done = await post(order.id, 'picked-up')
    expect(done.status).toBe(200)
    const picked = await h.order(order.id)
    expect(picked.status).toBe('picked_up')
    expect(picked.statusHistory?.at(-1)).toMatchObject({ transition: 'O9', actorType: 'admin' })
    expect(picked.timestamps.pickedUpAt).toBeTruthy()
    expect(goodsReceivedAt(picked)?.toISOString()).toBe(picked.timestamps.pickedUpAt)
    expect(warrantyStart(picked)?.toISOString()).toBe(picked.timestamps.pickedUpAt)
    expect((await post(order.id, 'picked-up')).json.unchanged).toBe(true)
  })

  it('R-083 Widerrufsfrist: Übergabe 05.10. 23:30 Berlin → Ende 19.10. 23:59:59 Berlin; Versand: Zustellung zählt; ohne Erhalt keine Frist', () => {
    const pickup = {
      fulfillmentMethod: 'pickup',
      timestamps: { pickedUpAt: '2026-10-05T21:30:00.000Z', deliveredAt: null },
    }
    expect(withdrawalPeriodEnd(pickup)?.toISOString()).toBe('2026-10-19T21:59:59.999Z')
    // Zeitumstellung (25.10.): Ende in MEZ
    expect(
      withdrawalPeriodEnd({
        fulfillmentMethod: 'pickup',
        timestamps: { pickedUpAt: '2026-10-20T10:00:00.000Z' },
      })?.toISOString(),
    ).toBe('2026-11-03T22:59:59.999Z')
    expect(
      withdrawalPeriodEnd({
        fulfillmentMethod: 'shipping',
        timestamps: { deliveredAt: '2026-10-11T01:05:00.000Z', pickedUpAt: null },
      })?.toISOString(),
    ).toBe('2026-10-25T22:59:59.999Z')
    expect(withdrawalPeriodEnd({ fulfillmentMethod: 'pickup', timestamps: {} })).toBeNull()
  })
})
