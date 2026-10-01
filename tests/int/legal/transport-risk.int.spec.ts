import { readFile } from 'node:fs/promises'
import path from 'node:path'

import { sql } from '@payloadcms/db-postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { SHIP_WITHOUT_PHOTO_QUESTION } from '@/lib/commerce/shipOrder'
import type { Order } from '@/payload-types'

import { resetAdmin } from '../helpers/admin'
import { createOrder, orderData, type ItemInput } from '../helpers/commerce'
import { rest } from '../helpers/rest'
import { shopHarness } from '../helpers/shop'

// P5.11 – Transportrisiko (R-100, DATENMODELL §6.8.5 O7): Keramik ohne Packfoto ist kein Zwang, „Versendet melden“
// fragt „Ohne Packfoto versenden?“ (409 mit Rückfrage), mit Bestätigung → `shipped` und Audit `packing_photo_skipped`.
// Versand ohne erfasste Verpackung → 409 (DM-ORD-07). Packfotos sind privat (DM-PRIV-01).

const NUMBERS = [993, 994, 995, 996, 997]
const h = shopHarness({ start: '2026-09-20T08:00:00.000Z', numbers: NUMBERS, tag: 'transport' })
const PHOTO = path.resolve('tests/fixtures/images/gps-orientation-6.jpg')
let token: string
let seq = 0

const photos: number[] = []

beforeAll(async () => {
  ;({ token } = await resetAdmin(h.payload, '198.51.100.74'))
})

afterAll(async () => {
  for (const id of photos) {
    await h.payload
      .delete({ collection: 'private-uploads', id, overrideAccess: true, context: { seed: true } })
      .catch(() => undefined)
  }
})

async function paidOrder(nr: number, item: Partial<ItemInput> = {}, extra = {}): Promise<Order> {
  const id = await h.piece(nr)
  return (await createOrder(
    h.payload,
    orderData(99_300 + ++seq, [{ id, itemNumber: nr, ...item }], extra),
  )) as Order
}

const post = async (orderId: number, action: string, body: unknown = {}) => {
  const res = await rest('POST', `/orders/${orderId}/${action}`, body, {
    authorization: `JWT ${token}`,
  })
  return { status: res.status, json: (await res.json()) as Record<string, unknown> }
}

const skipped = (orderId: number) =>
  h.count('audit_log', sql`action = 'packing_photo_skipped' AND entity_id = ${String(orderId)}`)

async function packingPhoto(orderId: number) {
  const data = await readFile(PHOTO)
  const doc = await h.payload.create({
    collection: 'private-uploads',
    data: { purpose: 'packing_photo', relatedOrder: orderId } as never,
    file: { data, name: 'packfoto.jpg', mimetype: 'image/jpeg', size: data.length },
    overrideAccess: true,
  })
  photos.push(doc.id)
  return doc
}

describe('Transportrisiko und Packfotos (P5.11)', () => {
  it('R-100 Keramik ohne Packfoto – Rückfrage: ohne confirmWithoutPackingPhoto 409, mit Bestätigung shipped und Audit packing_photo_skipped', async () => {
    const order = await paidOrder(993)
    expect((await post(order.id, 'packed')).status).toBe(200)

    const ask = await post(order.id, 'ship', { trackingNumber: '00340 4343 1234 5678 90' })
    expect(ask.status).toBe(409)
    expect(ask.json).toMatchObject({
      error: SHIP_WITHOUT_PHOTO_QUESTION,
      code: 'packing_photo_missing',
    })
    expect(ask.json.error).toBe('Ohne Packfoto versenden?')
    expect((await h.order(order.id)).status).toBe('packed')
    expect(await skipped(order.id)).toBe(0)

    const ok = await post(order.id, 'ship', {
      trackingNumber: '00340 4343 1234 5678 90',
      confirmWithoutPackingPhoto: true,
    })
    expect(ok.status).toBe(200)
    const shipped = await h.order(order.id)
    expect(shipped.status).toBe('shipped')
    expect(shipped.statusHistory?.at(-1)).toMatchObject({ transition: 'O7', actorType: 'admin' })
    expect(shipped.shipment).toMatchObject({
      carrier: 'dhl',
      trackingNumber: '0034043431234567890',
    })
    expect(shipped.shipment?.trackingUrl).toContain('0034043431234567890')
    expect(shipped.timestamps.shippedAt).toBeTruthy()
    expect(await skipped(order.id)).toBe(1)

    // Doppeltipp: keine zweite Wirkung
    const again = await post(order.id, 'ship', { confirmWithoutPackingPhoto: true })
    expect(again.json.unchanged).toBe(true)
    expect(await skipped(order.id)).toBe(1)
  })

  it('R-100 Keramik mit Packfoto: keine Rückfrage, kein Audit; Packfoto ohne Anmeldung nicht abrufbar (DM-PRIV-01)', async () => {
    const order = await paidOrder(994)
    const photo = await packingPhoto(order.id)
    const saved = await post(order.id, 'packing', { packingPhotos: [photo.id] })
    expect(saved.status).toBe(200)
    expect((await post(order.id, 'packed')).status).toBe(200)
    const ok = await post(order.id, 'ship', { trackingNumber: 'JJD000390007123456' })
    expect(ok.status).toBe(200)
    expect((await h.order(order.id)).status).toBe('shipped')
    expect(await skipped(order.id)).toBe(0)

    for (const name of [photo.filename, photo.sizes?.thumb?.filename].filter(Boolean)) {
      const anon = await rest('GET', `/private-uploads/file/${name}`)
      expect([401, 403, 404], String(name)).toContain(anon.status)
    }
    expect([401, 403]).toContain((await rest('GET', `/private-uploads/${photo.id}`)).status)
    const admin = await rest('GET', `/private-uploads/file/${photo.filename}`, undefined, {
      authorization: `JWT ${token}`,
    })
    expect(admin.status).toBe(200)
  })

  it('DM-ORD-07 Versand ohne erfasste Verpackung → 409 ohne Änderung; mit Verpackung im Versand-Aufruf → shipped', async () => {
    const order = await paidOrder(
      995,
      { shippingClass: 'paket_klein' },
      { shippingClass: 'paket_klein' },
    )
    const denied = await post(order.id, 'ship', { trackingNumber: 'JJD000390007654321' })
    expect(denied.status).toBe(409)
    expect(denied.json.code).toBe('packaging_missing')
    const still = await h.order(order.id)
    expect(still.status).toBe('paid')
    expect(still.packaging?.recordedAt ?? null).toBeNull()

    const ok = await post(order.id, 'ship', {
      trackingNumber: 'JJD000390007654321',
      packaging: {
        templateKey: 'tasche-papier',
        components: [
          { material: 'paper_cardboard', grams: 95 },
          { material: 'plastic', grams: 4 },
        ],
      },
    })
    expect(ok.status).toBe(200)
    const shipped = await h.order(order.id)
    expect(shipped.status).toBe('shipped')
    expect(shipped.packaging).toMatchObject({
      templateKey: 'tasche-papier',
      templateName: 'Papier-Versandtasche',
    })
    expect(shipped.packaging?.components?.map((c) => [c.material, c.grams])).toEqual([
      ['paper_cardboard', 95],
      ['plastic', 4],
    ])
    expect(shipped.packaging?.recordedAt).toBeTruthy()
  })

  it('Sendungsnummer: Pflicht bei Paket/Keramik, bei Brief freiwillig (ohne Verfolgungslink); ungültige Verpackung 400', async () => {
    const parcel = await paidOrder(996)
    await post(parcel.id, 'packed')
    expect((await post(parcel.id, 'ship', { confirmWithoutPackingPhoto: true })).status).toBe(409)
    expect(
      (await post(parcel.id, 'ship', { trackingNumber: 'AB-12', confirmWithoutPackingPhoto: true }))
        .status,
    ).toBe(400)

    const letter = await paidOrder(997, { shippingClass: 'brief' }, { shippingClass: 'brief' })
    const bad = await post(letter.id, 'packing', {
      packaging: {
        templateKey: 'brief-karton',
        components: [{ material: 'paper_cardboard', grams: 0 }],
      },
    })
    expect(bad.status).toBe(400)
    expect((await post(letter.id, 'packed')).status).toBe(200)
    const ok = await post(letter.id, 'ship', {})
    expect(ok.status).toBe(200)
    const shipped = await h.order(letter.id)
    expect(shipped.status).toBe('shipped')
    expect(shipped.shipment).toMatchObject({ carrier: 'deutsche_post' })
    expect(shipped.shipment?.trackingNumber ?? null).toBeNull()
    expect(shipped.shipment?.trackingUrl ?? null).toBeNull()
  })
})
