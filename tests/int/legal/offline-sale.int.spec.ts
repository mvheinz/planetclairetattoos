import type { Payload, PayloadRequest } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { transitionProduct } from '@/lib/commerce/productTransitions'

import { adminReq, resetAdmin, systemReq } from '../helpers/admin'
import { checkoutData, deleteCommerce } from '../helpers/commerce'
import { getTestPayload } from '../helpers/payload'
import {
  completeProduct,
  createProduct,
  createProductFixtures,
  deleteProducts,
  type ProductFixtures,
} from '../helpers/products'
import { rest } from '../helpers/rest'

// P5.7 – „Offline verkauft“ (E-28, R-127): nur Status und Vermerk am Stück – keine Bestellung, kein Beleg, kein Umsatz.

let payload: Payload
let fx: ProductFixtures
let token: string
let admin: PayloadRequest
let nr = 995

const FUTURE = '2099-01-01T10:00:00.000Z'
const sellOffline = (id: number, body: Record<string, unknown>) =>
  rest('POST', `/products/${id}/sell-offline`, body, { authorization: `JWT ${token}` })

async function counts() {
  const [orders, invoices, revenue] = await Promise.all(
    (['orders', 'invoices', 'revenue-entries'] as const).map((collection) =>
      payload.count({ collection, overrideAccess: true }).then((r) => r.totalDocs),
    ),
  )
  return { orders, invoices, revenue }
}

async function reserved(source: 'checkout_session' | 'prepayment') {
  const p = await createProduct(payload, completeProduct('keramik', nr++, fx))
  await transitionProduct(admin, p.id, 'publish')
  const { data } = checkoutData([{ id: p.id, itemNumber: p.itemNumber }], {
    expiresAt: FUTURE,
    displayExpiresAt: FUTURE,
  })
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
      source,
      expiresAt: FUTURE,
    } as never,
    overrideAccess: true,
  })
  await transitionProduct(await systemReq(payload), p.id, 'reserve', {
    reservationRef: data.reservationRef as string,
    reservedUntil: FUTURE,
  })
  return p.id as number
}

beforeAll(async () => {
  payload = await getTestPayload()
  await deleteCommerce(payload)
  await deleteProducts(payload)
  fx = await createProductFixtures(payload)
  const acc = await resetAdmin(payload, '198.51.100.48')
  token = acc.token
  admin = await adminReq(payload, acc.userId)
})

afterAll(async () => {
  await deleteCommerce(payload)
  await deleteProducts(payload)
})

describe('R-127 „Offline verkauft“', () => {
  it('R-127 setzt nur Status, Kanal, Datum, Notiz und Archiv-Schalter – keine Bestellung, keine Rechnung, kein Umsatz-Eintrag', async () => {
    const p = await createProduct(payload, completeProduct('keramik', nr++, fx))
    await transitionProduct(admin, p.id, 'publish')
    const before = await counts()
    const res = await sellOffline(p.id, { note: 'Flohmarkt Mauerpark', showInArchive: false })
    expect(res.status).toBe(200)
    const doc = await payload.findByID({
      collection: 'products',
      id: p.id,
      depth: 0,
      overrideAccess: true,
    })
    expect(doc).toMatchObject({
      status: 'sold',
      soldChannel: 'offline',
      offlineSaleNote: 'Flohmarkt Mauerpark',
      showInArchiveAfterSale: false,
      currentOrder: null,
      priceCents: 4500,
    })
    expect(doc.soldAt).toBeTruthy()
    expect(await counts()).toEqual(before)
    const audit = await payload.find({
      collection: 'audit-log',
      where: {
        and: [
          { entityId: { equals: String(p.id) } },
          { action: { in: ['product_status_changed', 'product_offline_sold'] } },
        ],
      },
      sort: 'createdAt',
      overrideAccess: true,
    })
    expect(
      audit.docs
        .map((d) => [
          d.action,
          (d.changes as { $transition?: string } | null)?.$transition,
          d.actorType,
        ])
        .slice(-2),
    ).toEqual([
      ['product_status_changed', 'P9', 'admin'],
      ['product_offline_sold', 'P9', 'admin'],
    ])
  })

  it('R-127 auch aus laufender Kasse (P10, mit Bestätigung): keine Bestellung, kein Beleg, kein Umsatz', async () => {
    const id = await reserved('checkout_session')
    const before = await counts()
    const res = await sellOffline(id, { confirmReservedCheckout: true })
    expect(res.status).toBe(200)
    expect(await counts()).toEqual(before)
    const doc = await payload.findByID({ collection: 'products', id, overrideAccess: true })
    expect(doc).toMatchObject({ status: 'sold', soldChannel: 'offline', reservationRef: null })
  })

  it('R-127 Vorkasse-reserviertes Stück: 409 „für eine Vorkasse-Bestellung reserviert“', async () => {
    const id = await reserved('prepayment')
    const res = await sellOffline(id, { confirmReservedCheckout: true })
    expect(res.status).toBe(409)
    expect(((await res.json()) as { error: string }).error).toMatch(
      /für eine Vorkasse-Bestellung reserviert/,
    )
    const doc = await payload.findByID({ collection: 'products', id, overrideAccess: true })
    expect(doc.status).toBe('reserved')
  })
})
