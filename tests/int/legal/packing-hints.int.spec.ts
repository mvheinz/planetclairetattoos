import { sql } from '@payloadcms/db-postgres'
import { createLocalReq } from 'payload'
import { beforeAll, describe, expect, it } from 'vitest'

import { loadPackingList, type PackingCard } from '@/admin/views/orders/orderQuery'
import type { Order } from '@/payload-types'

import { resetAdmin } from '../helpers/admin'
import { createOrder, orderData, type ItemInput } from '../helpers/commerce'
import { rest } from '../helpers/rest'
import { shopHarness } from '../helpers/shop'

// P5.10 – „Zu packen“ (KONZEPT §7.6): Liste nur `paid`/`packed` mit Versand, älteste zuerst; Hinweise wörtlich
// (R-100 Versicherung, Brief über 25 €, Keramik, DHL-Einwilligung, Widerruf); „Einwilligung widerrufen“ (R-101,
// DM-ORD-09); „Gepackt“ zweimal → ein Statuswechsel.

const NUMBERS = [985, 986, 987, 988, 989, 990, 991, 992]
const h = shopHarness({ start: '2026-09-20T08:00:00.000Z', numbers: NUMBERS, tag: 'packing-hints' })
let token: string
let seq = 0

beforeAll(async () => {
  ;({ token } = await resetAdmin(h.payload, '198.51.100.72'))
})

async function order(
  nr: number,
  overrides: Record<string, unknown> = {},
  item: Partial<ItemInput> = {},
  context: Record<string, unknown> = { system: true, transition: 'O1' },
): Promise<Order> {
  const id = await h.piece(nr)
  return (await createOrder(
    h.payload,
    orderData(98_500 + ++seq, [{ id, itemNumber: nr, ...item }], overrides),
    context,
  )) as Order
}

async function list(): Promise<PackingCard[]> {
  const req = await createLocalReq({}, h.payload)
  return loadPackingList(req)
}

const post = async (orderId: number, action: string, body: unknown = {}) => {
  const res = await rest('POST', `/orders/${orderId}/${action}`, body, {
    authorization: `JWT ${token}`,
  })
  return { status: res.status, json: (await res.json()) as Record<string, unknown> }
}

const hint = (card: PackingCard | undefined, key: string) =>
  card?.hints.find((x) => x.key === key)?.text ?? null

describe('„Zu packen“ (P5.10)', () => {
  it('Liste: genau die Versandbestellungen paid (analog O14) und packed (analog O12), älteste zuerst – ohne Abholung und shipped', async () => {
    const paid = await order(985, { timestamps: { placedAt: '2026-09-18T10:00:00.000Z' } })
    const packed = await order(
      986,
      { status: 'packed', timestamps: { placedAt: '2026-09-17T10:00:00.000Z' } },
      {},
      { seed: true },
    )
    await order(
      987,
      {
        fulfillmentMethod: 'pickup',
        shippingAddress: undefined,
        shippingZone: undefined,
        shippingClass: undefined,
        shippingCents: 0,
        totalCents: 4500,
        billingAddress: {
          name: 'Erika Beispiel',
          addressLine1: 'Musterstraße 1',
          postalCode: '10115',
          city: 'Berlin',
          country: 'DE',
        },
        timestamps: { placedAt: '2026-09-16T10:00:00.000Z' },
      },
      { shippingClass: 'paket_klein' },
    )
    await order(
      988,
      {
        status: 'shipped',
        timestamps: { placedAt: '2026-09-15T10:00:00.000Z', shippedAt: '2026-09-16T10:00:00.000Z' },
      },
      {},
      { seed: true },
    )
    const cards = await list()
    expect(cards.map((c) => c.orderNumber)).toEqual([packed.orderNumber, paid.orderNumber])
    const card = cards[1]!
    expect(card).toMatchObject({ name: 'Erika Beispiel', city: 'Berlin', shippingClass: 'keramik' })
    expect(card.items[0]).toMatchObject({ nr: 'Nr. 985' })
    expect(hint(card, 'ceramic')).toBe('Keramik – Karton in Karton')
    expect(hint(card, 'carrierEmail')).toBe('E-Mail an DHL: nein')
  })

  it('R-100 Versicherungshinweis: Zwischensumme 50.001 Cent zeigt ihn, 50.000 Cent nicht', async () => {
    const over = await order(985, {}, { priceCents: 50_001 })
    const at = await order(986, {}, { priceCents: 50_000 })
    const cards = await list()
    const byId = (id: number) => cards.find((c) => c.id === id)
    expect(hint(byId(over.id), 'insurance')).toBe(
      'Warenwert > 500 € – Transportversicherung buchen',
    )
    expect(hint(byId(at.id), 'insurance')).toBeNull()
  })

  it('R-100 Brief über 25 € – Einschreiben haftet nur bis 25 €; Widerruf vor dem Versand → „Nicht mehr versenden – Widerruf!“', async () => {
    const letter = await order(
      989,
      { shippingClass: 'brief' },
      { shippingClass: 'brief', priceCents: 2_501 },
    )
    const cheap = await order(
      990,
      { shippingClass: 'brief' },
      { shippingClass: 'brief', priceCents: 2_500 },
    )
    const withdrawn = await order(
      991,
      { status: 'withdrawal_received', statusBeforeWithdrawal: 'paid' },
      {},
      { seed: true },
    )
    const cards = await list()
    const byId = (id: number) => cards.find((c) => c.id === id)
    expect(hint(byId(letter.id), 'letter')).toBe(
      'Brief über 25 € – Einschreiben haftet nur bis 25 €',
    )
    expect(hint(byId(cheap.id), 'letter')).toBeNull()
    expect(hint(byId(letter.id), 'ceramic')).toBeNull()
    expect(hint(byId(withdrawn.id), 'withdrawal')).toBe('Nicht mehr versenden – Widerruf!')
    expect((await post(withdrawn.id, 'packed')).status).toBe(409)
  })

  it('R-101/DM-ORD-09 „Einwilligung widerrufen“: Zeitpunkt an der Bestellung, consent-log withdrawnAt + Widerrufs-Eintrag, Audit; copyAddressText ohne E-Mail', async () => {
    const o = await order(992, {
      carrierEmailConsent: true,
      customer: { name: 'Erika Beispiel', email: 'erika@planetclaire.local' },
    })
    const consent = await h.payload.create({
      collection: 'consent-log',
      data: {
        purpose: 'carrier_email_forwarding',
        granted: true,
        textSnapshot: 'Ich bin einverstanden, dass meine E-Mail-Adresse an DHL weitergegeben wird.',
        snippetKey: 'checkout.dhlEmailConsent',
        snippetVersion: 'draft-1',
        locale: 'de',
        email: 'erika@planetclaire.local',
        order: o.id,
      } as never,
      overrideAccess: true,
      context: { system: true },
    })
    const before = (await list()).find((c) => c.id === o.id)
    expect(hint(before, 'carrierEmail')).toBe('E-Mail an DHL: ja')
    expect(before?.addressLines.at(-1)).toBe('erika@planetclaire.local')
    const read = await h.payload.findByID({ collection: 'orders', id: o.id, overrideAccess: true })
    expect((read as unknown as { copyAddressText: string }).copyAddressText).toContain(
      'erika@planetclaire.local',
    )

    const res = await post(o.id, 'withdraw-carrier-consent')
    expect(res.status).toBe(200)
    const after = await h.order(o.id)
    expect(after.carrierEmailConsentRevokedAt).toBeTruthy()
    const entries = await h.payload.find({
      collection: 'consent-log',
      where: { order: { equals: o.id } },
      sort: 'createdAt',
      overrideAccess: true,
    })
    expect(entries.docs).toHaveLength(2)
    expect(entries.docs.find((d) => d.id === consent.id)?.withdrawnAt).toBeTruthy()
    expect(entries.docs.find((d) => d.id !== consent.id)).toMatchObject({
      purpose: 'carrier_email_forwarding',
      granted: false,
    })
    expect(
      await h.count(
        'audit_log',
        sql`action = 'carrier_consent_withdrawn' AND entity_id = ${String(o.id)}`,
      ),
    ).toBe(1)
    const card = (await list()).find((c) => c.id === o.id)
    expect(hint(card, 'carrierEmail')).toBe('E-Mail an DHL: nein')
    expect(card?.addressLines.join('\n')).not.toContain('@')
    const reread = await h.payload.findByID({
      collection: 'orders',
      id: o.id,
      overrideAccess: true,
    })
    expect((reread as unknown as { copyAddressText: string }).copyAddressText).not.toContain('@')
    // zweiter Tipp: nichts mehr zu tun
    const again = await post(o.id, 'withdraw-carrier-consent')
    expect(again.json.unchanged).toBe(true)
  })

  it('„Gepackt“ zweimal getippt → ein Statuswechsel; Verpackung mit Standard-Vorlage erfasst', async () => {
    const o = await order(985)
    const [a, b] = await Promise.all([post(o.id, 'packed'), post(o.id, 'packed')])
    expect([a.status, b.status]).toEqual([200, 200])
    expect([a.json.unchanged, b.json.unchanged].sort()).toEqual([false, true])
    const packed = await h.order(o.id)
    expect(packed.status).toBe('packed')
    expect(packed.statusHistory?.filter((x) => x.transition === 'O6')).toHaveLength(1)
    expect(packed.packaging).toMatchObject({
      templateKey: 'keramik-doppelkarton',
      templateName: 'Karton in Karton mit Papierpolster',
      components: [expect.objectContaining({ material: 'paper_cardboard', grams: 900 })],
    })
    expect(packed.packaging?.recordedAt).toBeTruthy()
  })
})
