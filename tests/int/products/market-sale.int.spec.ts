import type { Payload, PayloadRequest } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { transitionProduct } from '@/lib/commerce/productTransitions'
import { getRevenueStatus } from '@/lib/revenue/check'
import { berlinDateKey } from '@/lib/time'
import { normalizeTourRange } from '@/lib/tour/dates'

import { adminReq, resetAdmin, systemReq } from '../helpers/admin'
import { checkoutData, deleteCommerce } from '../helpers/commerce'
import { getTestPayload } from '../helpers/payload'
import { prepaymentReserved, removePrepayment } from '../helpers/pieces'
import {
  completeProduct,
  createProduct,
  createProductFixtures,
  deleteProducts,
  type ProductFixtures,
} from '../helpers/products'
import { rest } from '../helpers/rest'

// P20.6 (V-33 a, U-93): Markt-Knopf unter „Heute“ – Nummer → Stück, „verkauft“ über denselben Übergang wie
// „Verkauft (Markt/privat)“ (P9): sofort aus dem Shop, Datum heute, heutiger Markt-Termin (nur wenn genau einer),
// Preis freiwillig (zählt im Umsatz-Wächter). Reserviert (Kasse oder Vorkasse), Entwurf, weggelegt → klare Ablehnung
// ohne Wirkung; zweiter Tipp nach dem Erfolg ändert nichts. Wie R-127: keine Bestellung, kein Beleg.

let payload: Payload
let fx: ProductFixtures
let token: string
let admin: PayloadRequest
let nr = 980

const FUTURE = '2099-01-01T10:00:00.000Z'
const auth = () => ({ authorization: `JWT ${token}` })
const sell = (body: Record<string, unknown>) => rest('POST', '/products/market-sale', body, auth())
const lookup = (n: string | number) =>
  rest('GET', `/products/market-sale?nr=${n}`, undefined, auth())
const byId = (id: number) =>
  payload.findByID({ collection: 'products', id, depth: 0, overrideAccess: true })

async function counts() {
  const [orders, invoices, revenue] = await Promise.all(
    (['orders', 'invoices', 'revenue-entries'] as const).map((collection) =>
      payload.count({ collection, overrideAccess: true }).then((r) => r.totalDocs),
    ),
  )
  return { orders, invoices, revenue }
}

async function available(overrides: Record<string, unknown> = {}) {
  const p = await createProduct(payload, completeProduct('keramik', nr++, fx, overrides))
  await transitionProduct(admin, p.id as number, 'publish')
  return { id: p.id as number, itemNumber: p.itemNumber as number }
}

async function inCheckout() {
  const p = await available()
  const { data } = checkoutData([p], { expiresAt: FUTURE, displayExpiresAt: FUTURE })
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
      source: 'checkout_session',
      expiresAt: FUTURE,
    } as never,
    overrideAccess: true,
  })
  await transitionProduct(await systemReq(payload), p.id, 'reserve', {
    reservationRef: data.reservationRef as string,
    reservedUntil: FUTURE,
  })
  return p
}

async function cleanupTours() {
  await payload.delete({
    collection: 'tour-dates',
    where: { id: { exists: true } },
    overrideAccess: true,
    context: { seed: true },
  })
}

async function tourToday(name: string) {
  const { startsAt, endsAt } = normalizeTourRange(new Date())
  const doc = await payload.create({
    collection: 'tour-dates',
    data: {
      name,
      place: 'Berlin-Wedding',
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
    } as never,
    overrideAccess: true,
  })
  return doc.id as number
}

beforeAll(async () => {
  payload = await getTestPayload()
  await deleteCommerce(payload)
  await deleteProducts(payload)
  await cleanupTours()
  fx = await createProductFixtures(payload)
  const acc = await resetAdmin(payload, '198.51.100.131')
  token = acc.token
  admin = await adminReq(payload, acc.userId)
})

afterAll(async () => {
  await deleteCommerce(payload)
  await deleteProducts(payload)
  await cleanupTours()
})

describe('V-33 a Markt-Knopf', () => {
  it('nur für die Verwaltung (anonym 403)', async () => {
    expect((await rest('POST', '/products/market-sale', { itemNumber: 1 })).status).toBe(403)
    expect((await rest('GET', '/products/market-sale?nr=1')).status).toBe(403)
  })

  it('Nummer → Stück (auch „0…“); unbekannte Nummer 404, keine Nummer 400', async () => {
    const p = await available({ title: 'Markt-Schale' })
    const res = await lookup(`0${p.itemNumber}`)
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({
      piece: { id: p.id, itemNumber: p.itemNumber, title: 'Markt-Schale', priceCents: 4500 },
      refusal: null,
    })
    expect((await lookup(97_999)).status).toBe(404)
    expect((await lookup('abc')).status).toBe(400)
  })

  it('verkauft sofort (P9): Status sold, Kanal offline, Datum heute, Preis freiwillig – keine Bestellung, kein Beleg', async () => {
    const p = await available()
    const before = await counts()
    const res = await sell({ itemNumber: p.itemNumber })
    expect(res.status).toBe(200)
    const body = (await res.json()) as { doc: { status: string }; unchanged: boolean }
    expect(body).toMatchObject({ unchanged: false, doc: { status: 'sold' } })
    const doc = await byId(p.id)
    expect(doc).toMatchObject({ status: 'sold', soldChannel: 'offline' })
    expect(doc.offlineSalePriceCents ?? null).toBeNull()
    expect(doc.offlineSaleTourDate ?? null).toBeNull()
    expect(doc.currentOrder ?? null).toBeNull()
    expect(berlinDateKey(new Date(doc.soldAt as string))).toBe(berlinDateKey(new Date()))
    expect(await counts()).toEqual(before)
    // zweiter Tipp: nichts mehr ändern
    const again = await sell({ itemNumber: p.itemNumber })
    expect(again.status).toBe(200)
    expect(await again.json()).toMatchObject({ unchanged: true })
    // Preis später nachtragen (V-33 a: „im Stück“)
    const patch = await rest(
      'PATCH',
      `/products/${p.id}?depth=0`,
      { offlineSalePriceCents: 3800 },
      auth(),
    )
    expect(patch.status).toBe(200)
    expect((await byId(p.id)).offlineSalePriceCents).toBe(3800)
  })

  it('mit Preis zählt der Verkauf im Umsatz-Wächter; genau ein Markt-Termin heute wird zugeordnet', async () => {
    await cleanupTours()
    const tour = await tourToday('Hofflohmarkt heute (Test)')
    const status = () => getRevenueStatus(payload, new Date(), { includeSeed: false })
    const before = (await status()).totalCents
    const p = await available()
    const res = await sell({ itemNumber: p.itemNumber, priceCents: 4200 })
    expect(res.status).toBe(200)
    expect(await byId(p.id)).toMatchObject({
      offlineSalePriceCents: 4200,
      offlineSaleTourDate: tour,
    })
    expect((await status()).totalCents).toBe(before + 4200)
    // zwei Termine heute → keiner (nichts raten)
    await tourToday('Zweiter Markt heute (Test)')
    const q = await available()
    expect((await sell({ itemNumber: q.itemNumber })).status).toBe(200)
    expect((await byId(q.id)).offlineSaleTourDate ?? null).toBeNull()
    await cleanupTours()
  })

  it('ungültiger Preis 400 ohne Wirkung', async () => {
    const p = await available()
    const res = await sell({ itemNumber: p.itemNumber, priceCents: -5 })
    expect(res.status).toBe(400)
    expect((await byId(p.id)).status).toBe('available')
  })

  it('reserviert in einer Kasse oder für Vorkasse → Ablehnung mit klarer Meldung, Stück und Kasse unverändert', async () => {
    const checkoutPiece = await inCheckout()
    const res = await sell({ itemNumber: checkoutPiece.itemNumber })
    expect(res.status).toBe(409)
    expect(((await res.json()) as { error: string }).error).toMatch(/gerade reserviert/)
    expect((await byId(checkoutPiece.id)).status).toBe('reserved')
    const lookupRes = (await (await lookup(checkoutPiece.itemNumber)).json()) as {
      refusal: string | null
    }
    expect(lookupRes.refusal).toMatch(/gerade reserviert/)

    const p = await available()
    const pre = await prepaymentReserved(payload, p, 90_000 + p.itemNumber, { seed: true })
    try {
      const r = await sell({ itemNumber: p.itemNumber })
      expect(r.status).toBe(409)
      expect((await byId(p.id)).status).toBe('reserved')
    } finally {
      await removePrepayment(payload, pre)
    }
  })

  it('Entwurf und weggelegtes Stück: nicht im Shop → Meldung ohne Wirkung', async () => {
    const draft = await createProduct(payload, completeProduct('keramik', nr++, fx))
    const r1 = await sell({ itemNumber: draft.itemNumber })
    expect(r1.status).toBe(409)
    expect(((await r1.json()) as { error: string }).error).toMatch(/Entwurf/)
    const gone = await available()
    await transitionProduct(admin, gone.id, 'archive')
    const r2 = await sell({ itemNumber: gone.itemNumber })
    expect(r2.status).toBe(409)
    expect((await byId(gone.id)).status).toBe('archived')
  })
})
