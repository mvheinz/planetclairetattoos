import sharp from 'sharp'
import { beforeAll, describe, expect, it } from 'vitest'

import type { Order } from '@/payload-types'

import { resetAdmin } from '../helpers/admin'
import { createOrder, orderData, type ItemInput } from '../helpers/commerce'
import { rest } from '../helpers/rest'
import { shopHarness } from '../helpers/shop'

// P5.9–P5.17 – Schutzregeln der Versand- und Abhol-Aktionen (KONZEPT §7.6/§7.9, DATENMODELL §6.8.5/§6.8.8,
// DM-ORD-07/08): falsche Versandart oder falscher Status → 409 ohne Änderung, ungültige Eingaben → 400; Packen
// speichert Checkliste, Verpackung und Packfotos nur in gültiger Form; Sendungsnummer korrigieren, „Zugestellt“,
// Abholung, DHL-Einwilligung und „Erneut senden“ mit ihren Randfällen. Die Hauptwege prüfen `ship.int.spec.ts`,
// `admin-action.int.spec.ts`, `../legal/packing-hints.int.spec.ts`, `../legal/pickup.int.spec.ts` und
// `../legal/transport-risk.int.spec.ts`.

const NUMBERS = [980, 981, 982, 983, 984, 985, 986, 987]
const h = shopHarness({ start: '2026-10-01T08:00:00.000Z', numbers: NUMBERS, tag: 'guards' })
let token: string
let seq = 0

beforeAll(async () => {
  ;({ token } = await resetAdmin(h.payload, '198.51.100.79'))
})

const PICKUP = {
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
}

async function order(
  nr: number,
  overrides: Record<string, unknown> = {},
  item: Partial<ItemInput> = {},
): Promise<Order> {
  const id = await h.piece(nr)
  const status = (overrides.status as string | undefined) ?? 'paid'
  return (await createOrder(
    h.payload,
    orderData(97_500 + ++seq, [{ id, itemNumber: nr, ...item }], overrides),
    status === 'paid' ? { system: true, transition: 'O1' } : { seed: true },
  )) as Order
}

const post = async (orderId: number, action: string, body: unknown = {}) => {
  const res = await rest('POST', `/orders/${orderId}/${action}`, body, {
    authorization: `JWT ${token}`,
    'idempotency-key': crypto.randomUUID(),
  })
  return { status: res.status, json: (await res.json()) as Record<string, unknown> }
}

const errorText = (json: Record<string, unknown>): string => JSON.stringify(json)

async function packingPhoto(relatedOrder?: number): Promise<number> {
  const data = await sharp({
    create: { width: 32, height: 32, channels: 3, background: '#8a6a50' },
  })
    .jpeg()
    .toBuffer()
  const doc = await h.payload.create({
    collection: 'private-uploads',
    data: { purpose: 'packing_photo', ...(relatedOrder ? { relatedOrder } : {}) } as never,
    file: {
      data,
      name: `pack-${crypto.randomUUID()}.jpg`,
      mimetype: 'image/jpeg',
      size: data.length,
    },
    overrideAccess: true,
    context: { system: true },
  })
  return doc.id as number
}

describe('Packen speichern und „Gepackt“ – Schutzregeln (P5.10/P5.11)', () => {
  it('Abholbestellung, Widerruf vor dem Versand und versendete Bestellung → 409 ohne Änderung', async () => {
    const pickup = await order(980, PICKUP)
    expect((await post(pickup.id, 'packing', { checklist: {} })).status).toBe(409)
    expect((await post(pickup.id, 'packed')).status).toBe(409)
    expect((await post(pickup.id, 'ship')).status).toBe(409)

    const withdrawn = await order(981, {
      status: 'withdrawal_received',
      statusBeforeWithdrawal: 'paid',
    })
    const w = await post(withdrawn.id, 'packing', { checklist: {} })
    expect(w.status).toBe(409)
    expect(errorText(w.json)).toContain('Nicht mehr versenden – Widerruf!')
    const ws = await post(withdrawn.id, 'ship', { trackingNumber: '00340434312345678' })
    expect(ws.status).toBe(409)
    expect(errorText(ws.json)).toContain('Nicht mehr versenden – Widerruf!')

    const delivered = await order(982, {
      status: 'delivered',
      timestamps: {
        placedAt: '2026-09-20T10:00:00.000Z',
        paidAt: '2026-09-20T10:00:00.000Z',
        shippedAt: '2026-09-22T10:00:00.000Z',
        deliveredAt: '2026-09-24T10:00:00.000Z',
      },
    })
    const d = await post(delivered.id, 'packing', { checklist: {} })
    expect(d.status).toBe(409)
    expect(errorText(d.json)).toContain('nicht (mehr) zu packen')
    const ds = await post(delivered.id, 'ship', { trackingNumber: '00340434312345678' })
    expect(ds.status).toBe(409)
    expect(errorText(ds.json)).toContain('nicht (mehr) als versendet melden')
    expect((await h.order(delivered.id)).status).toBe('delivered')
  })

  it('Checkliste, Verpackung und Packfotos nur in gültiger Form; leere Anfrage ändert nichts', async () => {
    const o = await order(983, {}, { shippingClass: 'keramik' })
    for (const checklist of ['x', [true], null]) {
      expect((await post(o.id, 'packing', { checklist })).status).toBe(400)
    }
    const many = Object.fromEntries(Array.from({ length: 51 }, (_, i) => [`Punkt ${i}`, true]))
    expect((await post(o.id, 'packing', { checklist: many })).status).toBe(400)
    expect(
      (await post(o.id, 'packing', { packaging: { templateKey: 'gibt-es-nicht' } })).status,
    ).toBe(400)
    for (const components of [
      [],
      'x',
      [{ material: 'paper_cardboard', grams: 0 }],
      Array.from({ length: 11 }, () => ({ material: 'paper_cardboard', grams: 5 })),
    ]) {
      const res = await post(o.id, 'packing', {
        packaging: { templateKey: 'keramik-doppelkarton', components },
      })
      expect(res.status, JSON.stringify(components)).toBe(400)
    }
    expect((await h.order(o.id)).packaging?.recordedAt ?? null).toBeNull()

    const unchanged = await post(o.id, 'packing', {})
    expect(unchanged.status).toBe(200)

    const saved = await post(o.id, 'packing', {
      checklist: { 'Karton in Karton': true, kaputt: 'ja' },
      packaging: {
        templateKey: 'keramik-doppelkarton',
        components: [
          { material: 'paper_cardboard', grams: 950 },
          { material: 'plastic', grams: 12 },
        ],
      },
    })
    expect(saved.status).toBe(200)
    const after = await h.order(o.id)
    expect(after.packingChecklistState).toEqual({ 'Karton in Karton': true })
    expect(after.packaging).toMatchObject({
      templateKey: 'keramik-doppelkarton',
      templateName: 'Karton in Karton mit Papierpolster',
    })
    expect(after.packaging?.components?.map((c) => [c.material, c.grams])).toEqual([
      ['paper_cardboard', 950],
      ['plastic', 12],
    ])

    // „Gepackt“ ohne neue Angabe übernimmt die schon erfasste Verpackung unverändert
    expect((await post(o.id, 'packed')).status).toBe(200)
    const packed = await h.order(o.id)
    expect(packed.status).toBe('packed')
    expect(packed.packaging?.components?.map((c) => c.grams)).toEqual([950, 12])
  })

  it('Packfotos: Liste mit gültigen, eigenen Dateien (höchstens 6); fremde Fotos abgelehnt, neue verknüpft', async () => {
    const o = await order(984)
    const other = await order(985)
    for (const packingPhotos of ['x', [0], [-1], [1, 2, 3, 4, 5, 6, 7], [2_000_000_000]]) {
      const res = await post(o.id, 'packing', { packingPhotos })
      expect(res.status, JSON.stringify(packingPhotos)).toBe(400)
    }
    const foreign = await packingPhoto(other.id)
    const f = await post(o.id, 'packing', { packingPhotos: [foreign] })
    expect(f.status).toBe(400)
    expect(errorText(f.json)).toContain('anderen Bestellung')

    const free = await packingPhoto()
    const own = await packingPhoto(o.id)
    const ok = await post(o.id, 'packing', { packingPhotos: [free, own, free] })
    expect(ok.status).toBe(200)
    const after = await h.order(o.id)
    expect((after.packingPhotos ?? []).map((p) => (typeof p === 'object' ? p.id : p))).toEqual([
      free,
      own,
    ])
    const linked = await h.payload.findByID({
      collection: 'private-uploads',
      id: free,
      depth: 0,
      overrideAccess: true,
    })
    const rel = linked.relatedOrder
    expect(typeof rel === 'object' && rel ? rel.id : rel).toBe(o.id)

    expect((await post(o.id, 'packing', { packingPhotos: [] })).status).toBe(200)
    expect((await h.order(o.id)).packingPhotos ?? []).toEqual([])
  })
})

describe('Versand, Sendungsnummer und „Zugestellt“ – Randfälle (P5.15/P5.16)', () => {
  it('„Versendet melden“ mit gewählter Verpackung (EN-Link), danach Nummer korrigieren und „Zugestellt“', async () => {
    const o = await order(
      986,
      { shippingClass: 'paket_klein', locale: 'en' },
      {
        shippingClass: 'paket_klein',
      },
    )
    // vor dem Versand: Korrektur und „Zugestellt“ nicht möglich
    expect((await post(o.id, 'tracking', { trackingNumber: '00340434312345678' })).status).toBe(409)
    expect((await post(o.id, 'delivered')).status).toBe(409)

    const shipped = await post(o.id, 'ship', {
      carrier: 'dhl',
      trackingNumber: '00340434312345678',
      packaging: { templateKey: 'tasche-papier' },
    })
    expect(shipped.status).toBe(200)
    const s = await h.order(o.id)
    expect(s.status).toBe('shipped')
    expect(s.packaging).toMatchObject({ templateKey: 'tasche-papier' })
    expect(s.shipment?.trackingUrl).toContain('00340434312345678')

    // Korrektur: ungültig → 400, gleiche Nummer → unverändert, neue Nummer ohne Anbieter → bisheriger Anbieter
    expect((await post(o.id, 'tracking', { trackingNumber: 42 })).status).toBe(400)
    const same = await post(o.id, 'tracking', { trackingNumber: '00340434312345678' })
    expect(same.status).toBe(200)
    expect(same.json.unchanged).toBe(true)
    const fixed = await post(o.id, 'tracking', { trackingNumber: '00340434399999999' })
    expect(fixed.status).toBe(200)
    expect(fixed.json.unchanged).toBe(false)
    const f = await h.order(o.id)
    expect(f.shipment).toMatchObject({ carrier: 'dhl', trackingNumber: '00340434399999999' })
    const post2 = await post(o.id, 'tracking', {
      carrier: 'deutsche_post',
      trackingNumber: 'RR123456789DE',
    })
    expect(post2.status).toBe(200)
    expect((await h.order(o.id)).shipment?.carrier).toBe('deutsche_post')

    const delivered = await post(o.id, 'delivered')
    expect(delivered.status).toBe(200)
    expect(delivered.json.unchanged).toBe(false)
    const d = await h.order(o.id)
    expect(d.status).toBe('delivered')
    expect(d.shipment?.deliveredSource).toBe('manual')
    expect((await post(o.id, 'delivered')).json.unchanged).toBe(true)
    // auch nach der Zustellung lässt sich die Nummer noch korrigieren
    expect((await post(o.id, 'tracking', { trackingNumber: '00340434311111111' })).status).toBe(200)
  })
})

describe('Abholung, DHL-Einwilligung und „Erneut senden“ – Randfälle (P5.9/P5.10/P5.17)', () => {
  it('Abholung: nur bei Abholung und bezahlt, Text Pflicht und begrenzt; „Abgeholt“ erst nach „bereit“', async () => {
    const shipping = await order(987)
    expect((await post(shipping.id, 'pickup-ready', { messageText: 'Hallo' })).status).toBe(409)
    expect((await post(shipping.id, 'picked-up')).status).toBe(409)

    const p = await order(980, PICKUP)
    for (const messageText of [undefined, 42, '   ']) {
      expect((await post(p.id, 'pickup-ready', { messageText })).status).toBe(400)
    }
    expect((await post(p.id, 'pickup-ready', { messageText: 'x'.repeat(1501) })).status).toBe(400)
    expect((await post(p.id, 'picked-up')).status).toBe(409)
    expect((await h.order(p.id)).status).toBe('paid')

    const done = await order(981, {
      ...PICKUP,
      status: 'picked_up',
      timestamps: {
        placedAt: '2026-09-20T10:00:00.000Z',
        paidAt: '2026-09-20T10:00:00.000Z',
        pickedUpAt: '2026-09-25T10:00:00.000Z',
      },
    })
    const late = await post(done.id, 'pickup-ready', { messageText: 'Abholung im Studio' })
    expect(late.status).toBe(409)
    expect(errorText(late.json)).toContain('Nur bezahlte Abholbestellungen')
    expect((await post(done.id, 'picked-up')).json.unchanged).toBe(true)
  })

  it('DHL-Einwilligung: ohne Einwilligung 409; Widerruf ohne Protokolleintrag legt einen neuen an; zweiter Tipp ohne Wirkung', async () => {
    const none = await order(982)
    expect((await post(none.id, 'withdraw-carrier-consent')).status).toBe(409)

    const o = await order(983, { carrierEmailConsent: true })
    const res = await post(o.id, 'withdraw-carrier-consent')
    expect(res.status).toBe(200)
    expect(res.json.unchanged).toBe(false)
    expect((await h.order(o.id)).carrierEmailConsentRevokedAt).toBeTruthy()
    const log = await h.payload.find({
      collection: 'consent-log',
      where: { order: { equals: o.id } },
      depth: 0,
      overrideAccess: true,
    })
    expect(log.docs).toHaveLength(1)
    expect(log.docs[0]).toMatchObject({
      granted: false,
      snippetKey: 'checkout.dhlEmailConsent',
      purpose: 'carrier_email_forwarding',
    })
    expect((await post(o.id, 'withdraw-carrier-consent')).json.unchanged).toBe(true)
  })

  it('„Erneut senden“ M06 vor dem Versand → 409 mit verständlicher Meldung; anonymisierte Bestellung → 409', async () => {
    const o = await order(984)
    await h.payload.create({
      collection: 'email-log',
      data: {
        template: 'order_shipped',
        to: 'erika@example.com',
        locale: 'de',
        subject: 'Dein Paket ist unterwegs',
        status: 'sent',
        retainUntil: '2032-12-31T23:00:00.000Z',
        order: o.id,
      } as never,
      overrideAccess: true,
      context: { system: true },
    })
    const early = await post(o.id, 'resend-email', {
      template: 'order_shipped',
      dialogKey: crypto.randomUUID(),
    })
    expect(early.status).toBe(409)
    expect(errorText(early.json)).toContain('noch nicht als versendet gemeldet')

    const { createLocalReq } = await import('payload')
    const { resendOrderEmail, ResendError } = await import('@/lib/commerce/resendEmail')
    const req = await createLocalReq({}, h.payload)
    const anonymized = {
      ...(await h.order(o.id)),
      privacy: { anonymizedAt: '2026-10-01T10:00:00.000Z' },
    } as Order
    await expect(
      resendOrderEmail(req, anonymized, 'order_shipped', crypto.randomUUID()),
    ).rejects.toBeInstanceOf(ResendError)
    await expect(
      resendOrderEmail(req, anonymized, 'order_shipped', crypto.randomUUID()),
    ).rejects.toThrow('anonymisiert')
  })
})
