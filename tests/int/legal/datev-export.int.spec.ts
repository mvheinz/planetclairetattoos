import { readFile } from 'node:fs/promises'
import path from 'node:path'

import { createLocalReq, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { resetEnvCache } from '@/lib/env'
import {
  buildDatevExport,
  datevConfigStatus,
  DatevNotConfiguredError,
  encodeWindows1252,
} from '@/lib/export/datev'
import { createCreditNote, createInvoiceForOrder } from '@/lib/invoices/create'
import type { Invoice, Order } from '@/payload-types'

import { resetAdmin } from '../helpers/admin'
import { createOrder, deleteCommerce, orderData, SYSTEM, type ItemInput } from '../helpers/commerce'
import { withBusiness } from '../helpers/invoices'
import { getTestPayload } from '../helpers/payload'
import {
  completeProduct,
  createProduct,
  createProductFixtures,
  deleteProducts,
} from '../helpers/products'
import { rest } from '../helpers/rest'

// P5.25 – DATEV-Buchungsstapel (KONZEPT §7.15, R-124): ohne Konten 409, mit Test-Konten byte-genau gegen die Fixture,
// zweiter Export identisch, keine Namen/E-Mails, kein `BSP-`-Beleg (auch mit SEED_PREVIEW_MODE=true).

const FIXTURE = path.resolve(process.cwd(), 'tests/fixtures/csv/2026-10.datev.csv')
const TEST_ACCOUNTS = {
  consultantNumber: '1234567',
  clientNumber: '10001',
  fiscalYearStart: '01-01',
  revenueAccount: '8195',
  stripeTransitAccount: '1361',
  bankAccount: '1200',
  feeAccount: '4970',
}
const EMPTY_ACCOUNTS = Object.fromEntries(Object.keys(TEST_ACCOUNTS).map((k) => [k, null]))

let payload: Payload
let restoreBusiness: () => Promise<void>
let item: ItemInput
let token = ''

async function setAccounts(datev: Record<string, unknown>): Promise<void> {
  await payload.updateGlobal({
    slug: 'settings',
    data: { export: { datev } } as never,
    overrideAccess: true,
    context: { seed: true, skipAudit: true },
  })
}

async function order(overrides: Record<string, unknown> = {}): Promise<Order> {
  return (await createOrder(
    payload,
    orderData(0, [{ ...item, priceCents: 7100 }], overrides),
  )) as Order
}

async function invoiceAt(o: Order, iso: string): Promise<Invoice> {
  const now = new Date(iso)
  const req = await createLocalReq({ context: { now: iso } }, payload)
  const res = await createInvoiceForOrder(req, o, { paidAt: now, now })
  if (res.jobId !== null) await payload.jobs.cancelByID({ id: res.jobId })
  return res.invoice
}

async function creditAt(
  inv: Invoice,
  iso: string,
  amountCents: number,
  reason: 'withdrawal' | 'admin_cancellation',
): Promise<Invoice> {
  const req = await createLocalReq({ context: { now: iso } }, payload)
  const res = await createCreditNote(req, inv, { amountCents, reason, now: new Date(iso) })
  if (res.jobId !== null) await payload.jobs.cancelByID({ id: res.jobId })
  return res.invoice
}

beforeAll(async () => {
  payload = await getTestPayload()
  await deleteCommerce(payload)
  await deleteProducts(payload)
  restoreBusiness = await withBusiness(payload)
  token = (await resetAdmin(payload)).token
  const fx = await createProductFixtures(payload)
  const p = await createProduct(payload, completeProduct('keramik', 986, fx))
  item = { id: p.id as number, itemNumber: 986 }

  await invoiceAt(await order(), '2026-09-30T21:59:00.000Z') // RE-2026-00001, September
  const card = await order({
    stripe: { chargeId: 'ch_fixture_0001', paymentIntentId: 'pi_fixture_0001' },
  })
  const cardInvoice = await invoiceAt(card, '2026-10-15T08:05:00.000Z') // RE-2026-00002
  const credit = await creditAt(cardInvoice, '2026-10-17T08:00:00.000Z', 4500, 'withdrawal')
  await payload.update({
    collection: 'orders',
    id: card.id,
    data: {
      refunds: [
        {
          amountCents: 4500,
          reason: 'withdrawal',
          status: 'succeeded',
          stripeRefundId: 're_fixture_0001',
          creditNote: credit.id,
          createdAt: '2026-10-17T08:00:00.000Z',
        },
      ],
    } as never,
    overrideAccess: true,
    context: SYSTEM,
  })
  const pre = await order({ paymentMethod: 'prepayment', paymentProvider: 'bank_transfer' })
  const preInvoice = await invoiceAt(pre, '2026-10-20T10:00:00.000Z') // RE-2026-00003
  await creditAt(preInvoice, '2026-10-21T10:00:00.000Z', 7990, 'admin_cancellation') // GS-2026-00002
  const sample = await invoiceAt(await order({ seed: true }), '2026-10-16T09:00:00.000Z')
  await creditAt(sample, '2026-10-18T09:00:00.000Z', 1000, 'withdrawal')
})

afterAll(async () => {
  vi.unstubAllEnvs()
  resetEnvCache()
  await setAccounts(EMPTY_ACCOUNTS)
  await restoreBusiness()
  await deleteCommerce(payload)
  await deleteProducts(payload)
})

describe('DATEV-Buchungsstapel (R-124, KONZEPT §7.15)', () => {
  it('R-124 DATEV ohne Konten → 409 mit Hinweis „Konten mit der Steuerberatung festlegen“ (Knopf ausgegraut)', async () => {
    await setAccounts(EMPTY_ACCOUNTS)
    expect(datevConfigStatus(EMPTY_ACCOUNTS)).toEqual({
      ready: false,
      missing: [
        'consultantNumber',
        'clientNumber',
        'fiscalYearStart',
        'revenueAccount',
        'stripeTransitAccount',
        'bankAccount',
        'feeAccount',
      ],
    })
    await expect(buildDatevExport(payload, '2026-10')).rejects.toBeInstanceOf(
      DatevNotConfiguredError,
    )
    const auth = { authorization: `JWT ${token}` }
    const res = await rest('GET', '/admin/export/2026-10.datev.csv', undefined, auth)
    expect(res.status).toBe(409)
    const body = (await res.json()) as { error: string; missing: string[] }
    expect(body.error).toContain('Konten mit der Steuerberatung festlegen')
    expect(body.missing).toContain('revenueAccount')
    expect((await rest('GET', '/admin/export/2026-10.datev.csv')).status).toBe(401)
  })

  it('R-124 DATEV mit Test-Konten: Datei = Fixture (EXTF 700/21, Windows-1252), zweiter Export byte-identisch, keine Namen/E-Mails, kein BSP-', async () => {
    await setAccounts(TEST_ACCOUNTS)
    vi.stubEnv('SEED_PREVIEW_MODE', 'true')
    vi.stubEnv('APP_ENV', 'preview')
    resetEnvCache()
    const first = await buildDatevExport(payload, '2026-10')
    vi.unstubAllEnvs()
    resetEnvCache()
    const fixture = await readFile(FIXTURE)
    expect(first.bytes.toString('latin1')).toBe(fixture.toString('latin1'))
    expect(first.bytes.equals(fixture)).toBe(true)
    expect(first.filename).toBe('planetclaire-2026-10-datev.csv')
    const second = await buildDatevExport(payload, '2026-10')
    expect(second.bytes.equals(first.bytes)).toBe(true)
    const content = first.bytes.toString('latin1')
    expect(content.startsWith('"EXTF";700;21;"Buchungsstapel";13;')).toBe(true)
    expect(content).not.toContain('BSP-')
    expect(content).not.toContain('@')
    for (const needle of ['Erika', 'Beispiel', 'Musterstraße', '10115']) {
      expect(content).not.toContain(needle)
    }
    // „ü“ in Windows-1252 (0xFC), nicht UTF-8
    expect(first.bytes.includes(Buffer.from([0xfc]))).toBe(true)
    expect(first.bytes.includes(Buffer.from('ü', 'utf8'))).toBe(false)

    const auth = { authorization: `JWT ${token}` }
    const res = await rest('GET', '/admin/export/2026-10.datev.csv', undefined, auth)
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('text/csv; charset=windows-1252')
    expect(res.headers.get('cache-control')).toBe('private, no-store')
    expect(Buffer.from(await res.arrayBuffer()).equals(fixture)).toBe(true)
  })

  it('R-124 DATEV Windows-1252: Sonderzeichen korrekt, nicht darstellbare Zeichen als „?“', () => {
    expect([...encodeWindows1252('Gebühr – €„“')]).toEqual([
      0x47, 0x65, 0x62, 0xfc, 0x68, 0x72, 0x20, 0x96, 0x20, 0x80, 0x84, 0x93,
    ])
    expect(encodeWindows1252('🙂').toString('latin1')).toBe('?')
  })
})
