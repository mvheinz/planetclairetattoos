import { mkdtemp, readFile, rm, unlink, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { S3Client } from '@aws-sdk/client-s3'
import { createLocalReq, type Payload } from 'payload'
import { afterAll, afterEach, beforeAll, describe, expect, it, onTestFinished, vi } from 'vitest'

import { getEnv, parseEnv } from '@/lib/env'
import { createInvoiceForOrder } from '@/lib/invoices/create'
import { runInvoiceIntegrityCheck } from '@/lib/invoices/integrity'
import { runInvoicePdfJob } from '@/lib/invoices/issue'
import { uploadStaticDir } from '@/lib/storage'
import { ObjectExistsError, putIfAbsent } from '@/lib/storage/putIfAbsent'
import { StoredFileConflictError, storePrivateFile } from '@/lib/uploads/preStored'
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

// P5.26 – R-122 Unveränderbarkeit der Beleg-PDFs: bedingtes Schreiben (`putIfAbsent`: local `wx`, s3 `IfNoneMatch: *`),
// zweiter Schreibversuch schlägt fehl, `invoiceIntegrityCheck` erkennt manipulierte und fehlende Dateien und meldet sie
// per A12 mit Belegnummern.

let payload: Payload
let restoreBusiness: () => Promise<void>
let item: ItemInput
let orderNr = 960
let tmp: string

async function issuedInvoice(iso = '2026-10-14T09:30:00.000Z'): Promise<Invoice> {
  const order = (await createOrder(payload, orderData(++orderNr, [item]))) as Order
  const now = new Date(iso)
  const req = await createLocalReq({ context: { now: iso } }, payload)
  const { invoice, jobId } = await createInvoiceForOrder(req, order, { paidAt: now, now })
  await runInvoicePdfJob(payload, jobId, { now })
  return payload.findByID({
    collection: 'invoices',
    id: invoice.id,
    depth: 0,
    overrideAccess: true,
  })
}

async function uploadOf(invoice: Invoice): Promise<PrivateUpload> {
  return payload.findByID({
    collection: 'private-uploads',
    id: invoice.pdf as number,
    depth: 0,
    overrideAccess: true,
  })
}

const fileOf = (u: PrivateUpload) => path.join(uploadStaticDir('private'), u.filename as string)

async function alertJobs() {
  const logs = await payload.find({
    collection: 'email-log',
    where: { idempotencyKey: { like: 'admin_alert:invoice_integrity@' } },
    depth: 0,
    overrideAccess: true,
  })
  const jobs = await payload.find({
    collection: 'payload-jobs',
    where: { 'input.emailLogId': { in: logs.docs.map((d) => d.id) } },
    depth: 0,
    overrideAccess: true,
  })
  return {
    logs: logs.docs,
    inputs: jobs.docs.map((j) => j.input as { data: { affected?: string } }),
  }
}

beforeAll(async () => {
  payload = await getTestPayload()
  await deleteCommerce(payload)
  await deleteProducts(payload)
  restoreBusiness = await withBusiness(payload)
  const fx = await createProductFixtures(payload)
  const p = await createProduct(payload, completeProduct('keramik', 961, fx))
  item = { id: p.id as number, itemNumber: 961, priceCents: 4500 }
  tmp = await mkdtemp(path.join(os.tmpdir(), 'pc-r122-'))
})
afterEach(() => vi.restoreAllMocks())
afterAll(async () => {
  await restoreBusiness()
  await deleteCommerce(payload)
  await deleteProducts(payload)
  await rm(tmp, { recursive: true, force: true })
})

describe('R-122 bedingtes Schreiben (putIfAbsent)', () => {
  it('R-122 local: zweiter Schreibversuch auf dieselbe Datei schlägt fehl, Inhalt bleibt', async () => {
    const env = parseEnv({ ...process.env, STORAGE_DRIVER: 'local', STORAGE_LOCAL_DIR: tmp })
    const input = {
      area: 'private' as const,
      prefix: 'private/invoices/2026',
      filename: 'RE-2026-09999.pdf',
      bytes: Buffer.from('%PDF-1.7 original'),
      contentType: 'application/pdf',
    }
    const where = await putIfAbsent(input, env)
    await expect(
      putIfAbsent({ ...input, bytes: Buffer.from('%PDF-1.7 anders') }, env),
    ).rejects.toBeInstanceOf(ObjectExistsError)
    expect((await readFile(where)).toString()).toBe('%PDF-1.7 original')
  })

  it('R-122 s3: PUT mit IfNoneMatch "*" unter private/invoices/{JJJJ}/{Nummer}.pdf; 412 → ObjectExistsError', async () => {
    const env = parseEnv({
      ...process.env,
      STORAGE_DRIVER: 's3',
      S3_ENDPOINT: 'http://127.0.0.1:9',
      S3_REGION: 'auto',
      S3_BUCKET: 'pct-public-test',
      S3_PRIVATE_BUCKET: 'pct-private-test',
      S3_ACCESS_KEY_ID: 'test',
      S3_SECRET_ACCESS_KEY: 'test-secret',
    })
    const sent: Record<string, unknown>[] = []
    const send = vi.spyOn(S3Client.prototype, 'send').mockImplementation((async (cmd: {
      input: Record<string, unknown>
    }) => {
      sent.push(cmd.input)
      if (sent.length > 1) {
        throw Object.assign(new Error('PreconditionFailed'), {
          name: 'PreconditionFailed',
          $metadata: { httpStatusCode: 412 },
        })
      }
      return {}
    }) as never)
    const input = {
      area: 'private' as const,
      prefix: 'private/invoices/2026',
      filename: 'RE-2026-00042.pdf',
      bytes: Buffer.from('%PDF'),
      contentType: 'application/pdf',
    }
    expect(await putIfAbsent(input, env)).toBe('private/invoices/2026/RE-2026-00042.pdf')
    await expect(putIfAbsent(input, env)).rejects.toBeInstanceOf(ObjectExistsError)
    expect(send).toHaveBeenCalledTimes(2)
    expect(sent[0]).toMatchObject({
      Bucket: 'pct-private-test',
      Key: 'private/invoices/2026/RE-2026-00042.pdf',
      IfNoneMatch: '*',
    })
  })

  it('R-122 ausgestelltes Beleg-PDF: zweiter Schreibversuch mit anderem Inhalt wird abgelehnt, Datei unverändert', async () => {
    expect(getEnv().STORAGE_DRIVER).toBe('local')
    const invoice = await issuedInvoice()
    const upload = await uploadOf(invoice)
    const before = await readFile(fileOf(upload))
    const req = await createLocalReq({ context: { system: true } }, payload)
    await expect(
      storePrivateFile(req, {
        purpose: 'invoice_pdf',
        prefix: upload.prefix as string,
        filename: upload.filename as string,
        bytes: Buffer.from('%PDF-1.7 gefälscht'),
        contentType: 'application/pdf',
      }),
    ).rejects.toBeInstanceOf(StoredFileConflictError)
    expect((await readFile(fileOf(upload))).equals(before)).toBe(true)
    expect(invoice.sha256).toBe(upload.sha256)
  })

  it('Anlage ohne Datei nur für vorab geschriebene Belege/Exporte des Systems', async () => {
    await expect(
      payload.create({
        collection: 'private-uploads',
        data: { purpose: 'packing_photo', status: 'attached' } as never,
        overrideAccess: true,
        context: { system: true, preStoredFile: true },
      }),
    ).rejects.toThrow(/file/)
  })
})

describe('R-122 invoiceIntegrityCheck', () => {
  it('R-122 unveränderte Belege → keine Meldung; manipulierte und fehlende Datei → A12 mit Belegnummern', async () => {
    const a = await issuedInvoice()
    const b = await issuedInvoice()
    const c = await issuedInvoice()
    const clean = await runInvoiceIntegrityCheck(payload, new Date('2026-11-01T03:10:00.000Z'))
    expect(clean).toMatchObject({ mismatched: [], missing: [], alert: null })
    expect(clean.checked).toBeGreaterThanOrEqual(3)

    const fileB = fileOf(await uploadOf(b))
    const fileC = fileOf(await uploadOf(c))
    const original = await readFile(fileB)
    const originalC = await readFile(fileC)
    await writeFile(fileB, Buffer.concat([original, Buffer.from('\n% manipuliert')]))
    await unlink(fileC)
    onTestFinished(async () => {
      // Gemeinsamen lokalen Speicher für spätere Läufe wiederherstellen
      await writeFile(fileB, original)
      await writeFile(fileC, originalC)
    })

    const res = await runInvoiceIntegrityCheck(payload, new Date('2026-12-01T03:10:00.000Z'))
    expect(res.mismatched).toEqual([b.number])
    expect(res.missing).toEqual([c.number])
    expect(res.mismatched).not.toContain(a.number)
    expect(res.alert).toBe('queued')
    const { logs, inputs } = await alertJobs()
    expect(logs).toHaveLength(1)
    expect(logs[0]!.subject).toBe('Technisches Problem: Belegprüfung: 2 Beleg-PDF(s) auffällig')
    expect(inputs[0]!.data.affected).toContain(b.number)
    expect(inputs[0]!.data.affected).toContain(c.number)
    // Die Prüfung verändert nichts
    expect((await readFile(fileB)).equals(original)).toBe(false)
  })
})
