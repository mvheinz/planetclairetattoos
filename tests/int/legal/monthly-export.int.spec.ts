import { readFile } from 'node:fs/promises'
import path from 'node:path'

import { sql } from '@payloadcms/db-postgres'
import { unzipSync } from 'fflate'
import { createLocalReq, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { resetEnvCache, seedPreviewModeActive } from '@/lib/env'
import { buildInvoiceZip, ExportNotReadyError } from '@/lib/export/invoiceZip'
import { buildMonthlyCsv } from '@/lib/export/monthlyCsv'
import { createCreditNote, createInvoiceForOrder } from '@/lib/invoices/create'
import { runInvoicePdfJob } from '@/lib/invoices/issue'
import type { Invoice, Order } from '@/payload-types'

import { resetAdmin } from '../helpers/admin'
import {
  createOrder,
  dbOf,
  deleteCommerce,
  orderData,
  SYSTEM,
  type ItemInput,
} from '../helpers/commerce'
import { withBusiness } from '../helpers/invoices'
import { getTestPayload } from '../helpers/payload'
import {
  completeProduct,
  createProduct,
  createProductFixtures,
  deleteProducts,
} from '../helpers/products'
import { rest } from '../helpers/rest'

// P5.24 – Monats-CSV und Rechnungs-ZIP (KONZEPT §7.15, R-124): byte-genau gegen die Fixture, byte-identisch beim
// zweiten Export, keine Personendaten, keine Beispielbelege (auch nicht bei SEED_PREVIEW_MODE=true), ZIP genau mit den
// Belegen des Monats. Gebühren/Auszahlungen aus den Mock-Fixtures (`tests/fixtures/stripe/balance_transactions.json`).

const FIXTURE = path.resolve(process.cwd(), 'tests/fixtures/csv/2026-10.csv')
const CUSTOMER = { name: 'Erika Beispiel', email: 'Erika@Example.com' }

let payload: Payload
let restoreBusiness: () => Promise<void>
let item: ItemInput
let orderNr = 700
let token = ''

async function order(overrides: Record<string, unknown> = {}): Promise<Order> {
  return (await createOrder(
    payload,
    orderData(++orderNr, [{ ...item, priceCents: 7100 }], { customer: CUSTOMER, ...overrides }),
  )) as Order
}

async function issued(created: { invoice: Invoice; jobId: number | string | null }, iso: string) {
  await runInvoicePdfJob(payload, created.jobId, { now: new Date(iso) })
  return payload.findByID({
    collection: 'invoices',
    id: created.invoice.id,
    depth: 0,
    overrideAccess: true,
  })
}

async function invoiceAt(o: Order, iso: string): Promise<Invoice> {
  const now = new Date(iso)
  const req = await createLocalReq({ context: { now: iso } }, payload)
  return issued(await createInvoiceForOrder(req, o, { paidAt: now, now }), iso)
}

async function creditAt(
  inv: Invoice,
  iso: string,
  amountCents: number,
  reason: 'withdrawal' | 'admin_cancellation',
): Promise<Invoice> {
  const req = await createLocalReq({ context: { now: iso } }, payload)
  return issued(await createCreditNote(req, inv, { amountCents, reason, now: new Date(iso) }), iso)
}

async function addRefund(o: Order, credit: Invoice, stripeRefundId: string | null, iso: string) {
  await payload.update({
    collection: 'orders',
    id: o.id,
    data: {
      refunds: [
        {
          amountCents: credit.totalGrossCents,
          reason: credit.reason,
          status: 'succeeded',
          stripeRefundId,
          creditNote: credit.id,
          createdAt: iso,
        },
      ],
    } as never,
    overrideAccess: true,
    context: SYSTEM,
  })
}

const text = (b: Buffer) => b.toString('utf8')

beforeAll(async () => {
  payload = await getTestPayload()
  await deleteCommerce(payload)
  await deleteProducts(payload)
  restoreBusiness = await withBusiness(payload)
  token = (await resetAdmin(payload)).token
  // Feste Bestellnummern ab PC-2026-00701 (Sequenz, DATENMODELL §8.7) – die Fixture enthält sie
  await dbOf(payload).execute(sql`SELECT setval('order_number_seq', 700, true)`)
  const fx = await createProductFixtures(payload)
  const p = await createProduct(payload, completeProduct('keramik', 985, fx))
  item = { id: p.id as number, itemNumber: 985 }

  // September (23:59 Berlin) und November (00:30 Berlin) – gehören nicht in den Oktober-Export
  await invoiceAt(await order(), '2026-09-30T21:59:00.000Z')
  // RE-2026-00002: Karte, Stripe-Charge aus der Fixture (Gebühr 1,45 €, Auszahlung po_fixture_0001)
  const card = await order({
    stripe: { chargeId: 'ch_fixture_0001', paymentIntentId: 'pi_fixture_0001' },
  })
  const cardInvoice = await invoiceAt(card, '2026-10-15T08:05:00.000Z')
  // GS-2026-00001: Widerruf, Stripe-Erstattung aus der Fixture
  const credit = await creditAt(cardInvoice, '2026-10-17T08:00:00.000Z', 4500, 'withdrawal')
  await addRefund(card, credit, 're_fixture_0001', '2026-10-17T08:00:00.000Z')
  // RE-2026-00003: Vorkasse (keine Stripe-Daten); GS-2026-00002: Stornierung → „Stornorechnung“
  const pre = await order({ paymentMethod: 'prepayment', paymentProvider: 'bank_transfer' })
  const preInvoice = await invoiceAt(pre, '2026-10-20T10:00:00.000Z')
  const storno = await creditAt(preInvoice, '2026-10-21T10:00:00.000Z', 7990, 'admin_cancellation')
  await addRefund(pre, storno, null, '2026-10-21T10:00:00.000Z')
  await invoiceAt(await order(), '2026-10-31T23:30:00.000Z')
  // Beispielbelege (seed = true, BSP-RE/BSP-GS) im selben Monat
  const sample = await invoiceAt(await order({ seed: true }), '2026-10-16T09:00:00.000Z')
  await creditAt(sample, '2026-10-18T09:00:00.000Z', 1000, 'withdrawal')
})

afterAll(async () => {
  vi.unstubAllEnvs()
  resetEnvCache()
  await restoreBusiness()
  await deleteCommerce(payload)
  await deleteProducts(payload)
})

describe('Monatsexport (R-124, KONZEPT §7.15)', () => {
  it('R-124 CSV 2026-10 entspricht byte-genau der Fixture; zweiter Export byte-identisch', async () => {
    const first = await buildMonthlyCsv(payload, '2026-10')
    expect(first.filename).toBe('planetclaire-2026-10.csv')
    expect(first.bytes.subarray(0, 3)).toEqual(Buffer.from([0xef, 0xbb, 0xbf]))
    expect(text(first.bytes)).toContain('\r\n')
    expect(text(first.bytes).replace(/\r\n/g, '')).not.toContain('\n')
    const fixture = await readFile(FIXTURE)
    expect(text(first.bytes)).toBe(text(fixture))
    expect(first.bytes.equals(fixture)).toBe(true)
    const second = await buildMonthlyCsv(payload, '2026-10')
    expect(second.bytes.equals(first.bytes)).toBe(true)
  })

  it('R-124 keine Beispielbelege (BSP-) in CSV und ZIP, auch mit SEED_PREVIEW_MODE=true', async () => {
    vi.stubEnv('SEED_PREVIEW_MODE', 'true')
    vi.stubEnv('APP_ENV', 'preview')
    resetEnvCache()
    try {
      expect(seedPreviewModeActive()).toBe(true)
      const csv = await buildMonthlyCsv(payload, '2026-10')
      expect(text(csv.bytes)).not.toContain('BSP-')
      const zip = await buildInvoiceZip(payload, '2026-10')
      expect(zip.entries.some((e) => e.includes('BSP-'))).toBe(false)
      const files = unzipSync(new Uint8Array(zip.bytes))
      expect(Object.keys(files).some((f) => f.includes('BSP-'))).toBe(false)
      expect(new TextDecoder().decode(files['planetclaire-2026-10.csv'])).not.toContain('BSP-')
    } finally {
      vi.unstubAllEnvs()
      resetEnvCache()
    }
  })

  it('R-124 CSV enthält kein „@“ und keinen Kund:innen-Namen aus den Fixtures', async () => {
    const csv = text((await buildMonthlyCsv(payload, '2026-10')).bytes)
    expect(csv).not.toContain('@')
    for (const needle of ['Erika', 'Beispiel', 'Musterstraße', '10115']) {
      expect(csv).not.toContain(needle)
    }
  })

  it('R-124 ZIP enthält genau die Belege des Monats ({Nummer}.pdf) plus die CSV; byte-identisch beim zweiten Export', async () => {
    const zip = await buildInvoiceZip(payload, '2026-10')
    expect(zip.filename).toBe('planetclaire-belege-2026-10.zip')
    const files = unzipSync(new Uint8Array(zip.bytes))
    expect(Object.keys(files).sort()).toEqual([
      'GS-2026-00001.pdf',
      'GS-2026-00002.pdf',
      'RE-2026-00002.pdf',
      'RE-2026-00003.pdf',
      'planetclaire-2026-10.csv',
    ])
    for (const [name, bytes] of Object.entries(files)) {
      if (name.endsWith('.pdf')) expect(Buffer.from(bytes.subarray(0, 5)).toString()).toBe('%PDF-')
    }
    const csv = await buildMonthlyCsv(payload, '2026-10')
    expect(Buffer.from(files['planetclaire-2026-10.csv']!).equals(csv.bytes)).toBe(true)
    expect((await buildInvoiceZip(payload, '2026-10')).bytes.equals(zip.bytes)).toBe(true)
  })

  it('R-124 ZIP ohne fertiges PDF → ExportNotReadyError statt unvollständigem Archiv', async () => {
    const o = await order()
    const req = await createLocalReq({ context: { now: '2026-12-02T10:00:00.000Z' } }, payload)
    const now = new Date('2026-12-02T10:00:00.000Z')
    const pending = await createInvoiceForOrder(req, o, { paidAt: now, now })
    await expect(buildInvoiceZip(payload, '2026-12')).rejects.toBeInstanceOf(ExportNotReadyError)
    await payload.jobs.cancelByID({ id: pending.jobId! })
  })

  it('R-124 Endpunkte GET /api/admin/export/{JJJJ-MM}.csv und .zip: nur Verwaltung, Download no-store', async () => {
    expect((await rest('GET', '/admin/export/2026-10.csv')).status).toBe(401)
    const auth = { authorization: `JWT ${token}` }
    const csv = await rest('GET', '/admin/export/2026-10.csv', undefined, auth)
    expect(csv.status).toBe(200)
    expect(csv.headers.get('content-type')).toBe('text/csv; charset=utf-8')
    expect(csv.headers.get('content-disposition')).toBe(
      'attachment; filename="planetclaire-2026-10.csv"',
    )
    expect(csv.headers.get('cache-control')).toBe('private, no-store')
    expect(Buffer.from(await csv.arrayBuffer()).equals(await readFile(FIXTURE))).toBe(true)
    const zip = await rest('GET', '/admin/export/2026-10.zip', undefined, auth)
    expect(zip.status).toBe(200)
    expect(zip.headers.get('content-type')).toBe('application/zip')
    expect((await rest('GET', '/admin/export/2026-13.csv', undefined, auth)).status).toBe(404)
    expect((await rest('GET', '/admin/export/2026-12.zip', undefined, auth)).status).toBe(409)
  })
})
