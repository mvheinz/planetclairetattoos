import { sql } from '@payloadcms/db-postgres'
import { unzipSync } from 'fflate'
import type { Payload, PayloadRequest } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { getTodaySummary } from '@/lib/admin/today'
import { transitionProduct } from '@/lib/commerce/productTransitions'
import { buildInvoiceZip } from '@/lib/export/invoiceZip'
import { missingManualSources, previousMonth } from '@/lib/export/monthlyClose'
import { buildOfflineCsv, offlineCsvFilename } from '@/lib/export/offlineCsv'
import { closeRevenueMonth, monthCloseStates } from '@/lib/revenue/monthClose'
import { workshopReview } from '@/lib/revenue/review'
import { berlinMonthRange } from '@/lib/time'

import { adminReq, resetAdmin } from '../helpers/admin'
import { checkoutData, dbOf, deleteCommerce } from '../helpers/commerce'
import { getTestPayload } from '../helpers/payload'
import {
  completeProduct,
  createProduct,
  createProductFixtures,
  deleteProducts,
  type ProductFixtures,
} from '../helpers/products'
import { rest } from '../helpers/rest'

// P20.6 (U-93): V-38 „Monat abschließen“ – vier Beträge in einem Formular (leer = 0 €), idempotent, danach fehlt keine
// Quelle mehr (gelber Hinweis unter „Heute“ weg), „Markt-Verkäufe schon erfasst“ aus „Offline verkauft“ mit Preis.
// V-65 Monatsexport „Einnahmen außerhalb des Shops“ (Markt-Verkäufe mit Preis, Datum, Nummer; Monatssummen; Cent als
// Dezimalkomma, Datum Europe/Berlin; im ZIP; nur Verwaltung). V-40 Werkstatt-Rückblick aus eigenen Daten (Verkäufe je
// Kategorie und Weg, Liegezeit, „liegt seit über 60 Tagen“, „fast gekauft“ = abgebrochene Kassen je Stück, nur gezählt).

let payload: Payload
let fx: ProductFixtures
let token: string
let admin: PayloadRequest
let nr = 980

// Vormonat (nie Zukunft) für Formular und Hinweis; ein fester älterer Monat für den Export
const MONTH = previousMonth(new Date())
const EXPORT_MONTH = '2025-03'
const auth = () => ({ authorization: `JWT ${token}` })

async function clearEntries() {
  await dbOf(payload).execute(sql`DELETE FROM revenue_entries WHERE seed IS NOT TRUE`)
}

async function piece(overrides: Record<string, unknown> = {}) {
  const p = await createProduct(payload, completeProduct('keramik', nr++, fx, overrides))
  await transitionProduct(admin, p.id as number, 'publish')
  return { id: p.id as number, itemNumber: p.itemNumber as number }
}

async function soldOffline(priceCents: number, soldAt: string, note = '') {
  const p = await piece()
  const res = await rest('POST', `/products/${p.id}/sell-offline`, { priceCents, note }, auth())
  expect(res.status).toBe(200)
  await dbOf(payload).execute(
    sql`UPDATE products SET sold_at = ${soldAt}::timestamptz WHERE id = ${p.id}`,
  )
  return p
}

beforeAll(async () => {
  payload = await getTestPayload()
  await deleteCommerce(payload)
  await deleteProducts(payload)
  await clearEntries()
  fx = await createProductFixtures(payload)
  const acc = await resetAdmin(payload, '198.51.100.71')
  token = acc.token
  admin = await adminReq(payload, acc.userId)
})

afterAll(async () => {
  await clearEntries()
  await deleteCommerce(payload)
  await deleteProducts(payload)
})

describe('Monat abschließen (V-38)', () => {
  it('vier Beträge in einem Schritt (leer = 0 €), idempotent; danach fehlt keine Quelle, der Hinweis ist weg', async () => {
    await clearEntries()
    expect(await missingManualSources(payload, MONTH)).toHaveLength(4)
    const before = await getTodaySummary(new Date(), payload)
    expect(before.hints.some((h) => h.id === 'monthly-sums')).toBe(true)

    const first = await closeRevenueMonth(admin, {
      month: MONTH,
      amounts: { tattoo: '125', flohmarkt: '', auftragsarbeiten: '12,50' },
    })
    expect(first.changed).toEqual(['tattoo', 'flohmarkt', 'auftragsarbeiten', 'sonstiges'])
    expect(first.amounts).toEqual({
      tattoo: 12500,
      flohmarkt: 0,
      auftragsarbeiten: 1250,
      sonstiges: 0,
    })
    expect(await missingManualSources(payload, MONTH)).toEqual([])
    const after = await getTodaySummary(new Date(), payload)
    expect(after.hints.some((h) => h.id === 'monthly-sums')).toBe(false)

    // gleiche Werte noch einmal: nichts geändert; ein Betrag geändert: nur dieser
    const again = await closeRevenueMonth(admin, {
      month: MONTH,
      amounts: { tattoo: '125,00', auftragsarbeiten: '12,5' },
    })
    expect(again.changed).toEqual([])
    const changed = await closeRevenueMonth(admin, {
      month: MONTH,
      amounts: { tattoo: '130', auftragsarbeiten: '12,50' },
    })
    expect(changed.changed).toEqual(['tattoo'])
    const rows = await payload.find({
      collection: 'revenue-entries',
      where: { month: { equals: MONTH } },
      overrideAccess: true,
      pagination: false,
    })
    expect(rows.docs).toHaveLength(4)
    expect(rows.docs.find((d) => d.source === 'tattoo')?.amountCents).toBe(13000)
  })

  it('Endpunkt: nur Verwaltung; ungültiger Betrag mit Feld; Zukunft abgelehnt', async () => {
    const url = '/globals/settings/month-close'
    expect((await rest('POST', url, { month: MONTH, amounts: {} })).status).toBe(403)
    const bad = await rest('POST', url, { month: MONTH, amounts: { tattoo: 'zwölf' } }, auth())
    expect(bad.status).toBe(400)
    expect(((await bad.json()) as { errors: { path: string }[] }).errors[0]?.path).toBe(
      'amounts.tattoo',
    )
    const future = await rest('POST', url, { month: '2099-01', amounts: {} }, auth())
    expect(future.status).toBe(400)
    const ok = await rest('POST', url, { month: MONTH, amounts: { tattoo: '130' } }, auth())
    expect(ok.status).toBe(200)
    // tattoo stand schon auf 130, die übrigen wurden 0 € (vorher 12,50 € Aufträge)
    expect(await ok.json()).toMatchObject({ changed: ['auftragsarbeiten'] })
  })

  it('„Markt-Verkäufe schon erfasst“ aus „Offline verkauft“ mit Preis im Monat', async () => {
    const mid = new Date(
      (berlinMonthRange(MONTH).start.getTime() + berlinMonthRange(MONTH).end.getTime()) / 2,
    ).toISOString()
    await soldOffline(4500, mid)
    await soldOffline(8000, mid)
    const [state] = await monthCloseStates(payload, [MONTH])
    expect(state).toMatchObject({ month: MONTH, marketCents: 12500, complete: true })
    expect(state!.amounts.tattoo).toBe(13000)
  })
})

describe('Monatsexport: Einnahmen außerhalb des Shops (V-65)', () => {
  it('Markt-Verkäufe mit Preis, Datum (Berlin) und Nummer, dann die Monatssummen; im ZIP; Endpunkt nur Verwaltung', async () => {
    // 31.03.2025 23:30 Berlin (21:30 UTC) gehört noch in den März; 01.04. 00:10 Berlin nicht mehr
    const march = await soldOffline(3900, '2025-03-31T21:30:00.000Z', 'Hofflohmarkt')
    await soldOffline(2000, '2025-03-31T22:10:00.000Z')
    await closeRevenueMonth(admin, {
      month: EXPORT_MONTH,
      amounts: { tattoo: '480', flohmarkt: '35,50' },
    })
    const csv = await buildOfflineCsv(payload, EXPORT_MONTH)
    expect(csv.filename).toBe(offlineCsvFilename(EXPORT_MONTH))
    const lines = csv.bytes.toString('utf8').replace(/^﻿/, '').split('\r\n')
    expect(lines[0]).toBe('Monat;Datum;Art;Stück-Nr.;Bezeichnung;Betrag brutto;Notiz')
    expect(lines[1]).toMatch(
      new RegExp(
        `^03\\.2025;31\\.03\\.2025;Markt-Verkauf \\(Stück\\);Nr\\. ${String(march.itemNumber).padStart(3, '0')};[^;]*;39,00;Hofflohmarkt$`,
      ),
    )
    expect(lines.slice(2, 6)).toEqual([
      '03.2025;;Monatssumme;;Tattoo;480,00;',
      '03.2025;;Monatssumme;;Flohmarkt;35,50;',
      '03.2025;;Monatssumme;;Auftragsarbeiten;0,00;',
      '03.2025;;Monatssumme;;Sonstiges;0,00;',
    ])
    expect(lines[6]).toBe('')
    expect(csv.bytes.toString('utf8')).not.toContain('@')
    // byte-identisch beim zweiten Export
    expect((await buildOfflineCsv(payload, EXPORT_MONTH)).bytes.equals(csv.bytes)).toBe(true)

    const zip = await buildInvoiceZip(payload, EXPORT_MONTH)
    const files = unzipSync(new Uint8Array(zip.bytes))
    expect(Buffer.from(files[csv.filename]!).equals(csv.bytes)).toBe(true)

    const url = `/admin/export/${EXPORT_MONTH}.ausserhalb.csv`
    expect((await rest('GET', url)).status).toBe(401)
    const res = await rest('GET', url, undefined, auth())
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('text/csv; charset=utf-8')
    expect(res.headers.get('cache-control')).toBe('private, no-store')
    expect(Buffer.from(await res.arrayBuffer()).equals(csv.bytes)).toBe(true)
  })
})

describe('Werkstatt-Rückblick (V-40)', () => {
  it('Verkäufe je Kategorie und Weg, Liegezeit, „liegt seit über 60 Tagen“, „fast gekauft“ – nur gezählt', async () => {
    const now = new Date()
    const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000).toISOString()
    const db = dbOf(payload)
    const base = await workshopReview(payload, now, { includeSeed: false })

    // online verkauft nach 10 Tagen, Abholung nach 20 Tagen
    const a = await piece()
    await db.execute(sql`UPDATE products SET status = 'sold', sold_channel = 'online',
      first_published_at = ${daysAgo(15)}::timestamptz, sold_at = ${daysAgo(5)}::timestamptz WHERE id = ${a.id}`)
    const b = await piece()
    await db.execute(sql`UPDATE products SET status = 'sold', sold_channel = 'pickup',
      first_published_at = ${daysAgo(30)}::timestamptz, sold_at = ${daysAgo(10)}::timestamptz WHERE id = ${b.id}`)
    // liegt seit 75 Tagen
    const long = await piece()
    await db.execute(
      sql`UPDATE products SET first_published_at = ${daysAgo(75)}::timestamptz WHERE id = ${long.id}`,
    )
    // fast gekauft: zwei abgebrochene Kassen (eine davon älter als 30 Tage zählt nicht), eine offene zählt nicht
    const almost = await piece()
    for (const [status, age] of [
      ['expired', 2],
      ['cancelled', 5],
      ['expired', 40],
      ['open', 1],
    ] as const) {
      const { data } = checkoutData([almost], { customer: { email: 'kundin@example.com' } })
      const c = await payload.create({
        collection: 'checkouts',
        data: data as never,
        overrideAccess: true,
      })
      // Status und Alter direkt setzen (der Statusautomat der Kasse ist hier nicht Thema)
      await db.execute(
        sql`UPDATE checkouts SET status = ${status}, created_at = ${daysAgo(age)}::timestamptz WHERE id = ${c.id}`,
      )
    }

    const r = await workshopReview(payload, now, { includeSeed: false })
    expect(r.sales.keramik.online - base.sales.keramik.online).toBe(1)
    expect(r.sales.keramik.pickup - base.sales.keramik.pickup).toBe(1)
    expect(r.salesTotal - base.salesTotal).toBe(2)
    expect(r.averageDaysToSale).not.toBeNull()
    expect(r.longListed.find((p) => p.id === long.id)).toMatchObject({ days: 75 })
    expect(r.longListed.some((p) => p.id === almost.id)).toBe(false)
    const hit = r.almostBought.find((p) => p.id === almost.id)
    expect(hit).toMatchObject({ count: 2, available: true, itemNumber: almost.itemNumber })
    // keine Personendaten im Ergebnis
    expect(JSON.stringify(r)).not.toContain('kundin@example.com')
  })
})
