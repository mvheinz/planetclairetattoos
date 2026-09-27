import { randomUUID } from 'node:crypto'

import type { Payload, PayloadRequest } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { getStatusHistory } from '@/lib/audit'
import { transitionProduct } from '@/lib/commerce/productTransitions'

import { adminReq, resetAdmin, systemReq } from '../helpers/admin'
import { checkoutData, createOrder, deleteCommerce, orderData } from '../helpers/commerce'
import { getTestPayload } from '../helpers/payload'
import {
  completeProduct,
  createProduct,
  createProductFixtures,
  createTestImage,
  deleteProducts,
  type ProductFixtures,
} from '../helpers/products'
import { rest } from '../helpers/rest'

// P1.19: Statusautomat der Stücke (DATENMODELL §6.6.7/§6.6.8, KONZEPT §5.1, AK-5-01/-02).

let payload: Payload
let fx: ProductFixtures
let token: string
let admin: PayloadRequest
let nr = 980
let orderNr = 700

type Err = { message?: string; status?: number; data?: { errors?: { message: string }[] } }
async function rejects(promise: Promise<unknown>, re: RegExp): Promise<Err> {
  const err = await promise.then(
    () => null,
    (e: unknown) => e as Err,
  )
  expect(err, 'erwartet Ablehnung').not.toBeNull()
  expect([err!.message, ...(err!.data?.errors ?? []).map((e) => e.message)].join(' | ')).toMatch(re)
  return err!
}

const draft = (overrides: Record<string, unknown> = {}) =>
  createProduct(payload, completeProduct('keramik', nr++, fx, overrides))
const post = (id: number, action: string, body: Record<string, unknown> = {}, auth = true) =>
  rest('POST', `/products/${id}/${action}`, body, auth ? { authorization: `JWT ${token}` } : {})
const byId = (id: number) =>
  payload.findByID({ collection: 'products', id, depth: 0, overrideAccess: true })

async function soldWithOrder(): Promise<{ productId: number; orderId: number }> {
  const p = await draft()
  const sys = await systemReq(payload)
  await transitionProduct(await adminReqFresh(), p.id, 'publish')
  const order = await createOrder(
    payload,
    orderData(++orderNr, [{ id: p.id, itemNumber: p.itemNumber }]),
  )
  await transitionProduct(sys, p.id, 'sell', { orderId: order.id as number, channel: 'online' })
  return { productId: p.id as number, orderId: order.id as number }
}
async function adminReqFresh() {
  return adminReq(payload, Number(admin.user!.id))
}

beforeAll(async () => {
  payload = await getTestPayload()
  await deleteCommerce(payload)
  await deleteProducts(payload)
  fx = await createProductFixtures(payload)
  const acc = await resetAdmin(payload, '198.51.100.41')
  token = acc.token
  admin = await adminReq(payload, acc.userId)
})

afterAll(async () => {
  await deleteCommerce(payload)
  await deleteProducts(payload)
})

describe('Statusänderung nur über Übergänge (DM-PROD-06)', () => {
  it('DM-PROD-06 ein direktes update({ status: sold }) ohne context.transition schlägt fehl', async () => {
    const p = await draft()
    const err = await rejects(
      payload.update({
        collection: 'products',
        id: p.id,
        data: { status: 'sold' },
        overrideAccess: true,
      }),
      /nur über die Aktionen/,
    )
    expect(err.status).toBe(403)
    await rejects(
      payload.update({
        collection: 'products',
        id: p.id,
        data: { status: 'sold', soldChannel: 'offline' },
        overrideAccess: true,
        context: { system: true },
      }),
      /nur über die Aktionen/,
    )
    // Falscher Übergang für das Statuspaar
    await rejects(
      payload.update({
        collection: 'products',
        id: p.id,
        data: { status: 'sold' },
        overrideAccess: true,
        context: { transition: 'publish' },
      }),
      /nicht möglich/,
    )
    // Systemfelder ebenfalls nur per Übergang
    await rejects(
      payload.update({
        collection: 'products',
        id: p.id,
        data: { soldAt: '2026-09-27T10:00:00.000Z' },
        overrideAccess: true,
      }),
      /vom System gesetzt/,
    )
    // Neue Stücke beginnen als Entwurf (P1) – auch im Systemkontext
    await rejects(
      payload.create({
        collection: 'products',
        data: completeProduct('keramik', nr++, fx, { status: 'available' }) as never,
        overrideAccess: true,
        context: { system: true },
      }),
      /beginnen immer als Entwurf/,
    )
    // PATCH per REST ebenso
    const res = await rest(
      'PATCH',
      `/products/${p.id}`,
      { status: 'available' },
      { authorization: `JWT ${token}` },
    )
    expect(res.status).toBe(403)
    expect((await byId(p.id)).status).toBe('draft')
  })

  it('DM-PROD-08 eine Preisänderung bei reserved wird abgelehnt', async () => {
    const p = await draft()
    await transitionProduct(admin, p.id, 'publish')
    const sys = await systemReq(payload)
    const ref = randomUUID()
    const reserved = await transitionProduct(sys, p.id, 'reserve', {
      reservationRef: ref,
      reservedUntil: '2026-09-27T11:00:00.000Z',
    })
    expect(reserved).toMatchObject({ status: 'reserved', reservationRef: ref })
    await rejects(
      payload.update({
        collection: 'products',
        id: p.id,
        data: { priceCents: 5000 },
        overrideAccess: true,
      }),
      /Preis ist gesperrt/,
    )
    await rejects(
      payload.update({
        collection: 'products',
        id: p.id,
        data: { shippingClass: 'brief' },
        overrideAccess: true,
      }),
      /Versandklasse ist gesperrt/,
    )
    // Verwaltung darf nicht reservieren/freigeben (Systemübergänge)
    await rejects(
      transitionProduct(admin, p.id, 'release', { reservationRef: ref }),
      /nur automatisch/,
    )
    const released = await transitionProduct(sys, p.id, 'release', { reservationRef: ref })
    expect(released).toMatchObject({
      status: 'available',
      reservationRef: null,
      reservedUntil: null,
    })
  })
})

describe('AK-5-02 Verlauf über das Audit', () => {
  it('AK-5-02 jeder Wechsel erzeugt einen Eintrag mit Auslöser und Übergangs-ID', async () => {
    const p = await draft()
    const sys = await systemReq(payload)
    const ref = randomUUID()
    const published = await transitionProduct(admin, p.id, 'publish')
    expect(published.firstPublishedAt).toBeTruthy()
    await transitionProduct(admin, p.id, 'unpublish')
    const again = await transitionProduct(admin, p.id, 'publish')
    expect(again.firstPublishedAt).toBe(published.firstPublishedAt)
    await transitionProduct(sys, p.id, 'reserve', {
      reservationRef: ref,
      reservedUntil: '2026-09-27T11:00:00.000Z',
    })
    await transitionProduct(sys, p.id, 'release', { reservationRef: ref })
    const sold = await transitionProduct(admin, p.id, 'sellOffline', {
      note: 'Flohmarkt Mauerpark',
      showInArchive: false,
    })
    expect(sold).toMatchObject({
      status: 'sold',
      soldChannel: 'offline',
      offlineSaleNote: 'Flohmarkt Mauerpark',
      showInArchiveAfterSale: false,
    })
    const back = await transitionProduct(admin, p.id, 'returnToStock')
    expect(back).toMatchObject({ status: 'available', soldAt: null, soldChannel: null })
    const archived = await transitionProduct(admin, p.id, 'archive')
    expect(archived.archivedAt).toBeTruthy()
    const restored = await transitionProduct(admin, p.id, 'restore')
    expect(restored).toMatchObject({ status: 'draft', archivedAt: null })

    const history = await getStatusHistory('products', p.id, { payload })
    expect(history.map((h) => [h.from, h.to, h.transition, h.actorType])).toEqual([
      ['draft', 'available', 'P2', 'admin'],
      ['available', 'draft', 'P3', 'admin'],
      ['draft', 'available', 'P2', 'admin'],
      ['available', 'reserved', 'P4', 'system'],
      ['reserved', 'available', 'P5', 'system'],
      ['available', 'sold', 'P9', 'admin'],
      ['sold', 'available', 'P11', 'admin'],
      ['available', 'archived', 'P12', 'admin'],
      ['archived', 'draft', 'P14', 'admin'],
    ])
    const extra = await payload.find({
      collection: 'audit-log',
      where: {
        and: [
          { entityId: { equals: String(p.id) } },
          { action: { in: ['product_published', 'product_offline_sold'] } },
        ],
      },
      overrideAccess: true,
    })
    expect(extra.docs.map((d) => d.action).sort()).toEqual([
      'product_offline_sold',
      'product_published',
    ])
  })
})

describe('Admin-Endpunkte (DATENMODELL §6.6.10)', () => {
  it('publish, unpublish, archive, restore per REST; ohne Anmeldung 403; Fehler mit deutscher Meldung', async () => {
    const p = await draft()
    expect((await post(p.id, 'publish', {}, false)).status).toBe(403)
    const pub = await post(p.id, 'publish')
    expect(pub.status).toBe(200)
    expect(((await pub.json()) as { doc: { status: string } }).doc.status).toBe('available')
    const wrong = await post(p.id, 'restore')
    expect(wrong.status).toBe(409)
    expect(((await wrong.json()) as { error: string }).error).toMatch(/nicht möglich/)
    expect((await post(p.id, 'unpublish')).status).toBe(200)
    expect((await post(p.id, 'archive')).status).toBe(200)
    expect((await post(p.id, 'restore')).status).toBe(200)
    expect((await byId(p.id)).status).toBe('draft')
  })

  it('P10 sell-offline aus laufender Kasse: nur mit Bestätigung und offener Kasse; Kasse und Reservierungen enden', async () => {
    const a = await draft()
    const b = await draft()
    for (const p of [a, b]) await transitionProduct(admin, p.id, 'publish')
    const { data } = checkoutData([
      { id: a.id, itemNumber: a.itemNumber },
      { id: b.id, itemNumber: b.itemNumber },
    ])
    const checkout = await payload.create({
      collection: 'checkouts',
      data: data as never,
      overrideAccess: true,
    })
    const sys = await systemReq(payload)
    for (const p of [a, b]) {
      await payload.create({
        collection: 'reservations',
        data: {
          ref: data.reservationRef,
          checkout: checkout.id,
          product: p.id,
          expiresAt: data.expiresAt,
        } as never,
        overrideAccess: true,
      })
      await transitionProduct(sys, p.id, 'reserve', {
        reservationRef: data.reservationRef as string,
        reservedUntil: data.expiresAt as string,
      })
    }
    const unconfirmed = await post(a.id, 'sell-offline', { note: 'Atelierverkauf' })
    expect(unconfirmed.status).toBe(409)
    expect(((await unconfirmed.json()) as { error: string }).error).toMatch(/bestätigen/)

    await payload.update({
      collection: 'checkouts',
      id: checkout.id,
      data: { status: 'confirming' },
      overrideAccess: true,
      context: { system: true, transition: 'submitCheckout' },
    })
    const confirming = await post(a.id, 'sell-offline', { confirmReservedCheckout: true })
    expect(((await confirming.json()) as { error: string }).error).toMatch(/Zahlung läuft gerade/)
    await payload.update({
      collection: 'checkouts',
      id: checkout.id,
      data: { status: 'open' },
      overrideAccess: true,
      context: { system: true, transition: 'paymentFailed' },
    })

    const ok = await post(a.id, 'sell-offline', {
      confirmReservedCheckout: true,
      note: 'Atelierverkauf',
    })
    expect(ok.status).toBe(200)
    expect(await byId(a.id)).toMatchObject({
      status: 'sold',
      soldChannel: 'offline',
      reservationRef: null,
    })
    expect(await byId(b.id)).toMatchObject({ status: 'available', reservationRef: null })
    const c = await payload.findByID({
      collection: 'checkouts',
      id: checkout.id,
      overrideAccess: true,
    })
    expect(c).toMatchObject({ status: 'cancelled', closeReason: 'sold_offline' })
    const res = await payload.find({
      collection: 'reservations',
      where: { checkout: { equals: checkout.id } },
      overrideAccess: true,
    })
    expect(res.docs.map((r) => [r.status, r.releaseReason])).toEqual([
      ['released', 'admin'],
      ['released', 'admin'],
    ])
  })

  it('P10 abgelehnt bei Vorkasse-Reservierung', async () => {
    const p = await draft()
    await transitionProduct(admin, p.id, 'publish')
    const { data } = checkoutData([{ id: p.id, itemNumber: p.itemNumber }])
    const checkout = await payload.create({
      collection: 'checkouts',
      data: data as never,
      overrideAccess: true,
    })
    await payload.create({
      collection: 'reservations',
      data: {
        ref: data.reservationRef,
        checkout: checkout.id,
        product: p.id,
        source: 'prepayment',
        expiresAt: data.expiresAt,
      } as never,
      overrideAccess: true,
    })
    await transitionProduct(await systemReq(payload), p.id, 'reserve', {
      reservationRef: data.reservationRef as string,
      reservedUntil: data.expiresAt as string,
    })
    const res = await post(p.id, 'sell-offline', { confirmReservedCheckout: true })
    expect(res.status).toBe(409)
    expect(((await res.json()) as { error: string }).error).toMatch(
      /Vorkasse-Bestellung reserviert/,
    )
  })

  it('P13 archive-after-return nur nach Rücksendung oder Bruch; sonst deutsche Meldung', async () => {
    const { productId, orderId } = await soldWithOrder()
    expect((await byId(productId)).currentOrder).toBe(orderId)
    const denied = await post(productId, 'archive-after-return')
    expect(denied.status).toBe(409)
    expect(((await denied.json()) as { error: string }).error).toMatch(
      /Rücksendung oder nach Erstattung wegen Bruch/,
    )
    await payload.update({
      collection: 'orders',
      id: orderId,
      data: {
        refunds: [
          {
            amountCents: 4500,
            reason: 'breakage',
            status: 'succeeded',
            createdAt: '2026-09-28T10:00:00.000Z',
          },
        ],
      } as never,
      overrideAccess: true,
    })
    const ok = await post(productId, 'archive-after-return')
    expect(ok.status).toBe(200)
    expect(await byId(productId)).toMatchObject({
      status: 'archived',
      soldAt: null,
      soldChannel: null,
      currentOrder: null,
    })

    // Rückgabe: Position erstattet und Ware zurück
    const second = await soldWithOrder()
    const order = await payload.findByID({
      collection: 'orders',
      id: second.orderId,
      overrideAccess: true,
      depth: 0,
    })
    await payload.update({
      collection: 'orders',
      id: second.orderId,
      data: {
        items: order.items.map((i) => ({ ...i, status: 'refunded', refundedCents: i.priceCents })),
        timestamps: { ...order.timestamps, returnReceivedAt: '2026-10-10T10:00:00.000Z' },
      } as never,
      overrideAccess: true,
    })
    expect((await post(second.productId, 'archive-after-return')).status).toBe(200)
  })

  it('P11 return-to-stock nach Storno vor dem Versand (admin_cancellation), nicht nach dem Versand', async () => {
    const { productId, orderId } = await soldWithOrder()
    const refund = {
      amountCents: 5390,
      reason: 'admin_cancellation',
      status: 'succeeded',
      createdAt: '2026-09-28T10:00:00.000Z',
    }
    const order = await payload.findByID({
      collection: 'orders',
      id: orderId,
      overrideAccess: true,
      depth: 0,
    })
    await payload.update({
      collection: 'orders',
      id: orderId,
      data: {
        refunds: [refund],
        timestamps: { ...order.timestamps, shippedAt: '2026-09-28T09:00:00.000Z' },
      } as never,
      overrideAccess: true,
    })
    const denied = await post(productId, 'return-to-stock')
    expect(denied.status).toBe(409)
    expect(((await denied.json()) as { error: string }).error).toMatch(/Wieder verkaufen/)
    await payload.update({
      collection: 'orders',
      id: orderId,
      data: { timestamps: { ...order.timestamps, shippedAt: null } } as never,
      overrideAccess: true,
    })
    const ok = await post(productId, 'return-to-stock')
    expect(ok.status).toBe(200)
    expect(await byId(productId)).toMatchObject({
      status: 'available',
      currentOrder: null,
      soldChannel: null,
    })
  })
})

describe('Übernahme (DATENMODELL §13.4)', () => {
  it('adopt: Seed-Stück wird echt (seed = false), Bilder mit; Audit; zweites Mal 409', async () => {
    const p = await createProduct(
      payload,
      completeProduct('keramik', 950, fx, { seed: true, seedKey: 'products:950' }),
      { seed: true },
    )
    const res = await post(p.id, 'adopt')
    expect(res.status).toBe(200)
    expect(await byId(p.id)).toMatchObject({
      seed: false,
      seedKey: 'products:950',
      itemNumber: 950,
    })
    expect(
      (await payload.findByID({ collection: 'media', id: fx.mediaId, overrideAccess: true })).seed,
    ).toBe(false)
    const audit = await payload.find({
      collection: 'audit-log',
      where: {
        and: [{ action: { equals: 'product_adopted' } }, { entityId: { equals: String(p.id) } }],
      },
      overrideAccess: true,
    })
    expect(audit.totalDocs).toBe(1)
    expect((await post(p.id, 'adopt')).status).toBe(409)
  })
})

describe('Löschen (P15)', () => {
  it('ein veröffentlichtes Stück kann nicht gelöscht werden; ein nie veröffentlichter Entwurf schon – samt eigener Bilder', async () => {
    const live = await draft()
    await transitionProduct(admin, live.id, 'publish')
    await rejects(
      payload.delete({ collection: 'products', id: live.id, overrideAccess: true }),
      /ins Archiv gelegt, nicht gelöscht/,
    )
    await transitionProduct(admin, live.id, 'unpublish')
    await rejects(
      payload.delete({ collection: 'products', id: live.id, overrideAccess: true }),
      /ins Archiv gelegt/,
    )
    const own = await createTestImage(payload, 'Gelbe Schale mit Fisch')
    const fresh = await draft({ images: [own, fx.mediaId] })
    await payload.delete({ collection: 'products', id: fresh.id, overrideAccess: true, req: admin })
    await expect(
      payload.findByID({ collection: 'media', id: own, overrideAccess: true }),
    ).rejects.toThrow()
    // Das Bild anderer Stücke bleibt
    expect(
      (await payload.findByID({ collection: 'media', id: fx.mediaId, overrideAccess: true })).id,
    ).toBe(fx.mediaId)
    const audit = await payload.find({
      collection: 'audit-log',
      where: {
        and: [
          { action: { equals: 'product_deleted' } },
          { entityId: { equals: String(fresh.id) } },
        ],
      },
      overrideAccess: true,
    })
    expect(audit.totalDocs).toBe(1)
  })
})
