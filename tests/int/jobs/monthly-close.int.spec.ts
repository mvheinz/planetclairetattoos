import { readFile } from 'node:fs/promises'
import path from 'node:path'

import { unzipSync } from 'fflate'
import { createLocalReq, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { createInvoiceForOrder } from '@/lib/invoices/create'
import { runInvoicePdfJob } from '@/lib/invoices/issue'
import { listJobRuns, poolDb } from '@/lib/jobs/runLog'
import { runTaskNow } from '@/lib/jobs/runTask'
import { uploadStaticDir } from '@/lib/storage'
import type { Invoice, Order, PrivateUpload } from '@/payload-types'

import { createOrder, deleteCommerce, orderData, type ItemInput } from '../helpers/commerce'
import { withBusiness } from '../helpers/invoices'
import { getTestPayload } from '../helpers/payload'
import {
  completeProduct,
  createProduct,
  createProductFixtures,
  deleteProducts,
} from '../helpers/products'

// P5.26 – Task `monthlyClose` (AK-8-01, DATENMODELL §11, DM-JOB-01): Lauf am 01.11.2026 04:00 Berlin legt genau ein
// Archiv (CSV + Rechnungs-ZIP) für Oktober privat ab (`monthly_export`, L-07) und sendet genau eine A11 mit Summen und
// Hinweis auf fehlende Monatssummen; zweiter Lauf ohne Wirkung; vor 04:00 nichts.

let payload: Payload
let restoreBusiness: () => Promise<void>
let item: ItemInput
let orderNr = 930
const invoices: Invoice[] = []

// 01.11.2026 04:00 MEZ = 03:00 UTC (Winterzeit seit 25.10.)
const BEFORE = new Date('2026-11-01T02:59:00.000Z')
const AT = new Date('2026-11-01T03:00:00.000Z')
const LATER = new Date('2026-11-01T05:00:00.000Z')

async function exportsOf(month: string): Promise<PrivateUpload[]> {
  const res = await payload.find({
    collection: 'private-uploads',
    where: {
      and: [
        { purpose: { equals: 'monthly_export' } },
        { note: { equals: `monthly_close:${month}` } },
      ],
    },
    sort: 'id',
    depth: 0,
    overrideAccess: true,
  })
  return res.docs
}

async function a11() {
  const logs = await payload.find({
    collection: 'email-log',
    where: { template: { equals: 'admin_monthly_close' } },
    depth: 0,
    overrideAccess: true,
  })
  if (logs.docs.length === 0) return { logs: [], data: [] }
  const jobs = await payload.find({
    collection: 'payload-jobs',
    where: { 'input.emailLogId': { in: logs.docs.map((d) => d.id) } },
    depth: 0,
    overrideAccess: true,
  })
  return {
    logs: logs.docs,
    data: jobs.docs.map((j) => (j.input as { data: Record<string, unknown> }).data),
  }
}

beforeAll(async () => {
  payload = await getTestPayload()
  await deleteCommerce(payload)
  await deleteProducts(payload)
  restoreBusiness = await withBusiness(payload)
  const fx = await createProductFixtures(payload)
  const p = await createProduct(payload, completeProduct('keramik', 931, fx))
  item = { id: p.id as number, itemNumber: 931, priceCents: 4500 }
  for (const iso of ['2026-10-05T10:00:00.000Z', '2026-10-30T22:30:00.000Z']) {
    const order = (await createOrder(payload, orderData(++orderNr, [item]))) as Order
    const now = new Date(iso)
    const req = await createLocalReq({ context: { now: iso } }, payload)
    const { invoice, jobId } = await createInvoiceForOrder(req, order, { paidAt: now, now })
    await runInvoicePdfJob(payload, jobId, { now })
    invoices.push(
      await payload.findByID({
        collection: 'invoices',
        id: invoice.id,
        depth: 0,
        overrideAccess: true,
      }),
    )
  }
  // Nur eine manuelle Monatssumme für Oktober (Tattoo) – die übrigen drei fehlen
  await payload.create({
    collection: 'revenue-entries',
    data: { month: '2026-10', source: 'tattoo', amountCents: 12_000 } as never,
    overrideAccess: true,
    context: { now: AT.toISOString() },
  })
})

afterAll(async () => {
  await restoreBusiness()
  await deleteCommerce(payload)
  await deleteProducts(payload)
})

describe('monthlyClose (AK-8-01)', () => {
  it('vor 04:00 Berlin am 1. → nichts; Lauf protokolliert als „skipped“', async () => {
    await runTaskNow(payload, 'monthlyClose', { now: BEFORE })
    expect(await exportsOf('2026-10')).toHaveLength(0)
    expect((await a11()).logs).toHaveLength(0)
    const [run] = await listJobRuns(poolDb(payload), { task: 'monthlyClose' })
    expect(run!.status).toBe('skipped')
  })

  it('AK-8-01 Lauf am 01.11. 04:00: genau ein Archiv für Oktober und genau eine A11; zweiter Lauf ohne Wirkung', async () => {
    await runTaskNow(payload, 'monthlyClose', { now: AT })
    const files = await exportsOf('2026-10')
    expect(files.map((f) => f.mimeType).sort()).toEqual(['application/zip', 'text/csv'])
    for (const f of files) {
      expect(f.prefix).toBe('private/exports/2026')
      expect(f.retainUntil).toBeTruthy()
      expect(f.deleteAfter).toBeNull()
    }
    const zipFile = files.find((f) => f.mimeType === 'application/zip')!
    const zip = unzipSync(await readFile(path.join(uploadStaticDir('private'), zipFile.filename!)))
    expect(Object.keys(zip).sort()).toEqual(
      [...invoices.map((i) => `${i.number}.pdf`), 'planetclaire-2026-10.csv'].sort(),
    )

    const mail = await a11()
    expect(mail.logs).toHaveLength(1)
    expect(mail.logs[0]!.subject).toBe('Monatsexport Oktober 2026 ist bereit')
    expect(mail.logs[0]!.idempotencyKey).toBe('admin_monthly_close:2026-10')
    expect(mail.data[0]).toMatchObject({
      month: '2026-10',
      invoiceCount: 2,
      invoiceTotalCents: invoices.reduce((n, i) => n + i.totalGrossCents, 0),
      creditNoteCount: 0,
      missingManualSources: ['flohmarkt', 'auftragsarbeiten', 'sonstiges'],
    })

    // Zweiter und dritter Lauf (gleicher Monat): keine weitere Ablage, keine weitere A11
    await runTaskNow(payload, 'monthlyClose', { now: AT })
    await runTaskNow(payload, 'monthlyClose', { now: LATER })
    expect(await exportsOf('2026-10')).toHaveLength(2)
    expect((await a11()).logs).toHaveLength(1)
    const runs = await listJobRuns(poolDb(payload), { task: 'monthlyClose' })
    expect(runs.filter((r) => r.status === 'ok').map((r) => r.counts?.period)).toEqual(['2026-11'])
  })
})
