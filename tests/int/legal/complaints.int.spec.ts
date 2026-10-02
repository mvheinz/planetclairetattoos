import { sql } from '@payloadcms/db-postgres'
import { beforeAll, describe, expect, it } from 'vitest'

import type { Complaint, Order } from '@/payload-types'

import { FORBIDDEN_CONTENT_PATTERNS } from '../../helpers/forbiddenPatterns'
import { readOutbox } from '../../helpers/outbox'
import { resetAdmin } from '../helpers/admin'
import { createOrder, dbOf, orderData } from '../helpers/commerce'
import { rest } from '../helpers/rest'
import { shopHarness } from '../helpers/shop'

// P6.11 – Reklamationen, „Recht auf Reparatur“ und § 37 VSBG (KONZEPT §7.8, R-110, R-111, R-112): Akte aus dem
// Bestell-Detail anlegen (`POST /api/orders/:id/complaint`), „Reklamation beantworten“ → M12 über die Outbox mit
// `repairChoiceSentAt`, Wahl „Reparatur“ verlängert `warrantyEndsAt` um 12 Monate, „Streitbeilegungshinweis senden“ →
// M13 mit `vsbgNoticeSentAt`. Doppeltipp ohne zweite Mail.

const NOW = '2026-10-12T10:00:00.000Z'
const NUMBERS = [987, 988, 989]
const h = shopHarness({ start: NOW, numbers: NUMBERS, tag: 'complaints-p611' })
const EMAIL = 'reklamation@planetclaire.local'
let token: string
let seq = 0

beforeAll(async () => {
  ;({ token } = await resetAdmin(h.payload, '198.51.100.72'))
})

async function post(orderId: number, action: string, body: unknown = {}, auth = true) {
  const res = await rest(
    'POST',
    `/orders/${orderId}/${action}`,
    body,
    auth
      ? {
          authorization: `JWT ${token}`,
          'idempotency-key': crypto.randomUUID(),
        }
      : {},
  )
  return { status: res.status, json: (await res.json()) as Record<string, unknown> }
}

/** Bezahlte Bestellung, Übergabe direkt gesetzt (Zustellung bzw. Abholung). */
async function handedOver(
  nrs: number[],
  ts: { deliveredAt?: string; pickedUpAt?: string },
  locale: 'de' | 'en' = 'de',
): Promise<Order> {
  const items = []
  for (const nr of nrs) items.push({ id: await h.piece(nr), itemNumber: nr })
  const order = (await createOrder(
    h.payload,
    orderData(98_700 + ++seq, items, {
      locale,
      customer: { name: 'Rita Reklamation', email: EMAIL },
      timestamps: { placedAt: '2026-07-20T10:00:00.000Z', paidAt: '2026-07-20T10:05:00.000Z' },
    }),
  )) as Order
  const db = dbOf(h.payload)
  if (ts.deliveredAt) {
    await db.execute(
      sql`UPDATE orders SET timestamps_delivered_at = ${ts.deliveredAt} WHERE id = ${order.id}`,
    )
  }
  if (ts.pickedUpAt) {
    await db.execute(
      sql`UPDATE orders SET timestamps_picked_up_at = ${ts.pickedUpAt} WHERE id = ${order.id}`,
    )
  }
  return h.order(order.id)
}

const complaintDoc = (id: number) =>
  h.payload.findByID({
    collection: 'complaints',
    id,
    depth: 0,
    overrideAccess: true,
  }) as Promise<Complaint>

const choose = (id: number, choice: 'repair' | 'replacement') =>
  h.payload.update({
    collection: 'complaints',
    id,
    data: { customerChoice: choice, customerChoiceAt: '2026-08-05T10:00:00.000Z' },
    overrideAccess: true,
    context: { now: NOW },
  }) as Promise<Complaint>

const mailRows = (complaintTemplate: string, orderId: number) =>
  h.count('email_log', sql`template = ${complaintTemplate} AND order_id = ${orderId}`)

const outboxFor = async (type: string, orderNumber: string) =>
  (await readOutbox({ type }, h.outboxDir)).filter((m) => m.subject.includes(orderNumber))

describe('Reklamationen (P6.11)', () => {
  it('R-110 warrantyEndsAt = Zustellung bzw. Abholung + 2 Jahre ohne Reparatur; Akte aus dem Bestell-Detail mit Art, Eingang, Stücken und DHL-Frist', async () => {
    const order = await handedOver([987, 988], { deliveredAt: '2026-08-01T10:00:00.000Z' })
    expect((await post(order.id, 'complaint', { kind: 'transport_damage' }, false)).status).toBe(
      403,
    )
    const wrong = await post(order.id, 'complaint', { affectedItemIds: ['fremd'] })
    expect(wrong.status).toBe(400)

    const res = await post(order.id, 'complaint', {
      kind: 'transport_damage',
      receivedAt: '2026-08-03T09:00:00.000Z',
      description: 'Henkel abgebrochen',
      affectedItemIds: [order.items[0]!.id],
    })
    expect(res.status).toBe(200)
    const c = await complaintDoc(res.json.complaintId as number)
    expect(c).toMatchObject({
      kind: 'transport_damage',
      receivedAt: '2026-08-03T09:00:00.000Z',
      description: 'Henkel abgebrochen',
      affectedItemIds: [order.items[0]!.id],
      carrierClaimDueAt: '2026-08-08T10:00:00.000Z',
      warrantyEndsAt: '2028-08-01T10:00:00.000Z',
      status: 'open',
    })
    // Ersatz verlängert nicht
    expect((await choose(c.id, 'replacement')).warrantyEndsAt).toBe('2028-08-01T10:00:00.000Z')

    // Abholung: Gewährleistung ab Abholung, Mangel ohne DHL-Frist, Eingang ohne Angabe = heute
    const pickup = await handedOver([989], { pickedUpAt: '2026-07-25T15:00:00.000Z' })
    const p = await post(pickup.id, 'complaint', { kind: 'defect' })
    const pc = await complaintDoc(p.json.complaintId as number)
    expect(Math.abs(new Date(pc.receivedAt).getTime() - Date.now())).toBeLessThan(120_000)
    expect(pc.carrierClaimDueAt ?? null).toBeNull()
    expect(pc.warrantyEndsAt).toBe('2028-07-25T15:00:00.000Z')
  })

  it('R-111 „Reklamation beantworten“: M12 über die Outbox (Wahlrecht, Unikat, + 12 Monate), repairChoiceSentAt; Wahl „Reparatur“ verlängert warrantyEndsAt um 12 Monate', async () => {
    const order = await handedOver([987], { deliveredAt: '2026-08-01T10:00:00.000Z' })
    const created = await post(order.id, 'complaint', { kind: 'defect' })
    const id = created.json.complaintId as number

    expect((await post(order.id, 'complaint-reply', { complaintId: id }, false)).status).toBe(403)
    expect((await post(order.id, 'complaint-reply', { complaintId: 999_999 })).status).toBe(404)

    const first = await post(order.id, 'complaint-reply', { complaintId: id })
    expect(first.status).toBe(200)
    expect(first.json.unchanged).toBe(false)
    const sent = await complaintDoc(id)
    expect(sent.repairChoiceSentAt).toBeTruthy()
    // Doppeltipp: keine zweite Mail
    expect((await post(order.id, 'complaint-reply', { complaintId: id })).json.unchanged).toBe(true)
    expect(await mailRows('complaint_repair_choice', order.id)).toBe(1)
    const [log] = (
      await h.payload.find({
        collection: 'email-log',
        where: {
          and: [
            { template: { equals: 'complaint_repair_choice' } },
            { order: { equals: order.id } },
          ],
        },
        overrideAccess: true,
      })
    ).docs
    expect(log).toMatchObject({
      idempotencyKey: `complaint_repair_choice:${id}:1`,
      status: 'sent',
      templateVersion: 'm12-v1',
    })

    const mails = await outboxFor('complaint_repair_choice', order.orderNumber)
    expect(mails).toHaveLength(1)
    const m = mails[0]!
    expect(m.subject).toBe(`Deine Reklamation zu ${order.orderNumber}: Reparatur oder Ersatz`)
    expect(m.text).toContain('reparieren')
    expect(m.text).toContain('Ersatzstück')
    expect(m.text).toContain('Unikat')
    expect(m.text).toContain('um 12 Monate')
    expect(m.text).toContain('Nr. 987')
    expect(m.text).not.toMatch(/\{\{|\}\}|\{[a-zA-Z]+\}/)
    expect(m.text).not.toMatch(/Garantie/)

    // Wahl der Kundin: Reparatur → + 12 Monate (auch am virtuellen Feld der Bestellung)
    const chosen = await choose(id, 'repair')
    expect(chosen.warrantyEndsAt).toBe('2029-08-01T10:00:00.000Z')
    expect(
      (
        (await h.payload.findByID({
          collection: 'orders',
          id: order.id,
          overrideAccess: true,
        })) as { warrantyEndsAt?: string }
      ).warrantyEndsAt,
    ).toBe('2029-08-01T10:00:00.000Z')
    const audits = await h.count(
      'audit_log',
      sql`action = 'complaint_changed' AND entity_id = ${String(id)}`,
    )
    expect(audits).toBeGreaterThanOrEqual(3)
  })

  it('R-112 „Streitbeilegungshinweis senden“: M13 mit Universalschlichtungsstelle (Anschrift, URL), ohne OS-Link; vsbgNoticeSentAt; EN in der Sprache der Bestellung', async () => {
    const order = await handedOver([988], { deliveredAt: '2026-08-01T10:00:00.000Z' }, 'en')
    const created = await post(order.id, 'complaint', { kind: 'defect' })
    const id = created.json.complaintId as number
    const res = await post(order.id, 'complaint-dispute', { complaintId: id })
    expect(res.status).toBe(200)
    expect((await complaintDoc(id)).vsbgNoticeSentAt).toBeTruthy()
    expect((await post(order.id, 'complaint-dispute', { complaintId: id })).json.unchanged).toBe(
      true,
    )
    expect(await mailRows('dispute_vsbg', order.id)).toBe(1)
    const mails = await outboxFor('dispute_vsbg', order.orderNumber)
    expect(mails).toHaveLength(1)
    const m = mails[0]!
    expect(m.subject).toBe(
      `Your complaint about order ${order.orderNumber}: information on dispute resolution`,
    )
    expect(m.text).toContain('Universalschlichtungsstelle des Bundes')
    expect(m.text).toContain('Straßburger Straße 8, 77694 Kehl am Rhein')
    expect(m.text).toMatch(/universalschlichtungsstelle\.de/)
    for (const p of FORBIDDEN_CONTENT_PATTERNS.filter((x) => x.id === 'V-01')) {
      expect(`${m.text}\n${m.html}`).not.toMatch(p.re)
    }
  })
})
