import { sql } from '@payloadcms/db-postgres'
import type { Payload, PayloadRequest } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { transitionProduct } from '@/lib/commerce/productTransitions'
import { getRevenueStatus } from '@/lib/revenue/check'
import { berlinMonthKey } from '@/lib/time'

import { adminReq, resetAdmin } from '../helpers/admin'
import { dbOf, deleteCommerce } from '../helpers/commerce'
import { getTestPayload } from '../helpers/payload'
import {
  completeProduct,
  createProduct,
  createProductFixtures,
  deleteProducts,
  type ProductFixtures,
} from '../helpers/products'
import { rest } from '../helpers/rest'

// U-60 (P14.11): Markt-Verkauf einem Tour-Termin zuordnen, optional mit Preis. „Offline verkauft“ speichert Termin und
// Preis (ganze Cent) neben der Notiz; mit Preis zählt der Verkauf im Umsatz-Wächter (Spalte „Markt-Verkäufe“, nach
// Verkaufsdatum), ohne Beleg oder Monatssumme (E-28 bleibt: keine Bestellung, keine Rechnung, kein `revenue-entries`).
// „Zurück ins Lager“ nimmt den Betrag wieder heraus.

let payload: Payload
let fx: ProductFixtures
let token: string
let admin: PayloadRequest
let tourId: number
let nr = 980

const sellOffline = (id: number, body: Record<string, unknown>) =>
  rest('POST', `/products/${id}/sell-offline`, body, { authorization: `JWT ${token}` })
const byId = (id: number) =>
  payload.findByID({ collection: 'products', id, depth: 0, overrideAccess: true })
const status = () => getRevenueStatus(payload, new Date(), { includeSeed: false })
const month = () => berlinMonthKey(new Date())

async function available() {
  const p = await createProduct(payload, completeProduct('keramik', nr++, fx))
  await transitionProduct(admin, p.id as number, 'publish')
  return p.id as number
}

async function cleanupTours() {
  await payload.delete({
    collection: 'tour-dates',
    where: { id: { exists: true } },
    overrideAccess: true,
    context: { seed: true },
  })
}

beforeAll(async () => {
  payload = await getTestPayload()
  await deleteCommerce(payload)
  await deleteProducts(payload)
  await cleanupTours()
  fx = await createProductFixtures(payload)
  const acc = await resetAdmin(payload, '198.51.100.63')
  token = acc.token
  admin = await adminReq(payload, acc.userId)
  const tour = await payload.create({
    collection: 'tour-dates',
    data: {
      name: 'Hofflohmarkt Wedding (Test)',
      place: 'Berlin-Wedding',
      startsAt: new Date().toISOString(),
    } as never,
    overrideAccess: true,
  })
  tourId = tour.id
})

afterAll(async () => {
  await deleteCommerce(payload)
  await deleteProducts(payload)
  await cleanupTours()
})

describe('Markt-Verkauf zum Termin (U-60)', () => {
  it('speichert Termin, Preis und Notiz; zählt im Umsatz-Wächter (Spalte offline); Job eingereiht; keine Monatssumme', async () => {
    const before = await status()
    const entriesBefore = (
      await payload.count({ collection: 'revenue-entries', overrideAccess: true })
    ).totalDocs
    await dbOf(payload).execute(sql`DELETE FROM payload_jobs WHERE task_slug = 'revenueGuardCheck'`)

    const id = await available()
    const res = await sellOffline(id, { tourDate: tourId, priceCents: 4500, note: 'Stand 12' })
    expect(res.status).toBe(200)
    const doc = await byId(id)
    expect(doc).toMatchObject({
      status: 'sold',
      soldChannel: 'offline',
      offlineSaleNote: 'Stand 12',
      offlineSaleTourDate: tourId,
      offlineSalePriceCents: 4500,
    })

    const after = await status()
    expect(after.offlineCents - before.offlineCents).toBe(4500)
    expect(after.totalCents - before.totalCents).toBe(4500)
    const row = (s: typeof after) => s.months.find((m) => m.month === month())!
    expect(row(after).cents.offline - row(before).cents.offline).toBe(4500)
    expect(
      (await payload.count({ collection: 'revenue-entries', overrideAccess: true })).totalDocs,
    ).toBe(entriesBefore)
    const jobs = await payload.count({
      collection: 'payload-jobs',
      where: { taskSlug: { equals: 'revenueGuardCheck' } },
      overrideAccess: true,
    })
    expect(jobs.totalDocs).toBeGreaterThanOrEqual(1)

    // „Zurück ins Lager“ (P11): Verkauf rückgängig → zählt nicht mehr, Termin und Notiz bleiben als Verlauf.
    await transitionProduct(admin, id, 'returnToStock')
    const back = await byId(id)
    expect(back.status).toBe('available')
    expect(back.offlineSalePriceCents ?? null).toBeNull()
    expect((await status()).offlineCents).toBe(before.offlineCents)
  })

  it('ohne Preis (nur Termin) oder ganz ohne Angaben wie bisher: kein Umsatz', async () => {
    const before = await status()
    const a = await available()
    expect((await sellOffline(a, { tourDate: tourId })).status).toBe(200)
    expect(await byId(a)).toMatchObject({ offlineSaleTourDate: tourId })
    expect((await byId(a)).offlineSalePriceCents ?? null).toBeNull()
    const b = await available()
    expect((await sellOffline(b, { note: 'Flohmarkt Mauerpark' })).status).toBe(200)
    expect((await byId(b)).offlineSaleTourDate ?? null).toBeNull()
    expect((await status()).offlineCents).toBe(before.offlineCents)
  })

  it('ungültiger Preis → 400 mit deutscher Meldung, Stück bleibt verfügbar; unbekannter Termin → abgelehnt', async () => {
    const id = await available()
    for (const priceCents of [12.5, -100, 'zehn']) {
      const res = await sellOffline(id, { priceCents })
      expect(res.status, String(priceCents)).toBe(400)
      expect(((await res.json()) as { error: string }).error).toMatch(/Preis/)
    }
    const res = await sellOffline(id, { tourDate: 999_999_999, priceCents: 1000 })
    expect(res.status).toBeGreaterThanOrEqual(400)
    expect((await byId(id)).status).toBe('available')
  })

  it('Termin gelöscht → Zuordnung wird leer, Preis und Verkauf bleiben', async () => {
    const tour = await payload.create({
      collection: 'tour-dates',
      data: {
        name: 'Kunstmarkt (Test)',
        place: 'Berlin-Mitte',
        startsAt: new Date().toISOString(),
      } as never,
      overrideAccess: true,
    })
    const id = await available()
    expect((await sellOffline(id, { tourDate: tour.id, priceCents: 2000 })).status).toBe(200)
    await payload.delete({ collection: 'tour-dates', id: tour.id, overrideAccess: true })
    const doc = await byId(id)
    expect(doc.offlineSaleTourDate ?? null).toBeNull()
    expect(doc).toMatchObject({ status: 'sold', offlineSalePriceCents: 2000 })
  })
})
