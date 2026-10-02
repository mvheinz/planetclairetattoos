import { sql } from '@payloadcms/db-postgres'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

import type { Payload } from 'payload'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { runTaskNow } from '@/lib/jobs/runTask'
import { complianceOverview } from '@/lib/legal/complianceDocs'

import { resetAdmin } from '../helpers/admin'
import { dbOf, deleteCommerce } from '../helpers/commerce'
import { pdfText } from '../helpers/invoices'
import { getTestPayload } from '../helpers/payload'
import {
  completeProduct,
  createProduct,
  createProductFixtures,
  deleteProducts,
  type ProductFixtures,
} from '../helpers/products'
import { rest } from '../helpers/rest'

// P5.13 – Ablage für Produktsicherheits-Unterlagen (R-203, LOESCHKONZEPT L-24, DATENMODELL §6.4/§11): private Ablage
// (T-15), `technical_file` nur mit Kategorie und als PDF, Vorlage als PDF, Task `complianceDocsReview` (A16 einmal je
// Monat ab dem 1. um 08:10 Berlin, ohne Beispieldaten, keine Löschung).

const PDF = Buffer.from(
  '%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\nxref\n0 2\n0000000000 65535 f \n0000000009 00000 n \ntrailer<</Size 2/Root 1 0 R>>\nstartxref\n40\n%%EOF\n',
)
const NUMBERS = [985, 986, 987, 988]
const FIRST_OF_MONTH = new Date('2026-11-01T07:10:00.000Z') // So 01.11.2026 08:10 Berlin (MEZ)
const TOO_EARLY = new Date('2026-11-01T07:09:00.000Z')
const LATER = new Date('2026-11-01T09:00:00.000Z')
const KEY = 'admin_compliance_docs_review:2026-11:monthly'

let payload: Payload
let token: string
let fx: ProductFixtures
const uploads: number[] = []

const db = () => dbOf(payload)

async function upload(
  data: Record<string, unknown>,
  file: { data: Buffer; name: string; mimetype: string } = {
    data: PDF,
    name: `unterlage-${uploads.length}.pdf`,
    mimetype: 'application/pdf',
  },
) {
  const doc = await payload.create({
    collection: 'private-uploads',
    data: data as never,
    file: { ...file, size: file.data.length },
    overrideAccess: true,
  })
  uploads.push(doc.id as number)
  return doc
}

async function mails(key = KEY): Promise<{ id: number; subject: string }[]> {
  const res = await db().execute(
    sql`SELECT id, subject FROM email_log WHERE idempotency_key = ${key} ORDER BY id`,
  )
  return res.rows as { id: number; subject: string }[]
}

async function resetRuns(): Promise<void> {
  await db().execute(sql`DELETE FROM job_runs WHERE task = 'complianceDocsReview'`)
  await db().execute(sql`DELETE FROM email_log WHERE template = 'admin_compliance_docs_review'`)
  await payload.jobs.cancel({ where: { taskSlug: { equals: 'complianceDocsReview' } } })
}

/** Validierungsfehler samt Feldmeldungen (Payload fasst sie in `data.errors` zusammen). */
async function rejection(p: Promise<unknown>): Promise<string> {
  try {
    await p
  } catch (e) {
    const err = e as { message?: string; data?: { errors?: { message?: string }[] } }
    return [err.message, ...(err.data?.errors ?? []).map((x) => x.message)].join(' | ')
  }
  throw new Error('erwartete Ablehnung')
}

const run = (now: Date) => runTaskNow(payload, 'complianceDocsReview', { now })

async function removeUploads(): Promise<void> {
  for (const id of uploads.splice(0)) {
    await payload
      .delete({ collection: 'private-uploads', id, overrideAccess: true, context: { seed: true } })
      .catch(() => null)
  }
}

beforeAll(async () => {
  payload = await getTestPayload()
  ;({ token } = await resetAdmin(payload, '198.51.100.77'))
  await deleteCommerce(payload)
  await deleteProducts(payload)
  fx = await createProductFixtures(payload)
  uploads.push(fx.nickelEvidenceId)
})

beforeEach(async () => {
  await resetRuns()
})

afterAll(async () => {
  await resetRuns()
  await deleteProducts(payload, NUMBERS)
  await removeUploads()
})

describe('R-203 Dokumentablage (P5.13)', () => {
  it('R-203 Dokumentablage: technical_file ohne complianceCategory abgelehnt, nur als PDF; mit Kategorie gespeichert', async () => {
    expect(await rejection(upload({ purpose: 'technical_file' }))).toMatch(/Kategorie/)
    const img = await readFile(path.resolve('tests/fixtures/images/landscape-small.jpg'))
    expect(
      await rejection(
        upload(
          { purpose: 'technical_file', complianceCategory: 'keramik' },
          { data: img, name: 'foto.jpg', mimetype: 'image/jpeg' },
        ),
      ),
    ).toMatch(/als PDF/)
    const doc = await upload({
      purpose: 'technical_file',
      complianceCategory: 'textil',
      documentVersion: 'Risikoanalyse v1',
      documentDate: '2026-09-01T10:00:00.000Z',
      note: 'Textilfarben',
    })
    expect(doc.complianceCategory).toBe('textil')
    expect(doc.deleteAfter ?? null).toBeNull() // keine Auto-Löschung (L-24)
  })

  it('R-203 Dokumentablage T-15: Unterlage ohne Anmeldung weder als Datensatz noch als Datei abrufbar; Vorlage nur für die Verwaltung', async () => {
    const doc = await upload({ purpose: 'supplier_document', complianceCategory: 'textil' })
    expect([401, 403]).toContain((await rest('GET', `/private-uploads/${doc.id}`)).status)
    expect([401, 403]).toContain((await rest('GET', '/private-uploads')).status)
    expect([401, 403]).toContain(
      (await rest('GET', `/private-uploads/file/${doc.filename}`)).status,
    )
    expect((await rest('GET', '/admin/compliance/template.pdf?category=keramik')).status).toBe(403)
    const auth = { authorization: `JWT ${token}` }
    const file = await rest('GET', `/private-uploads/file/${doc.filename}`, undefined, auth)
    expect(file.status).toBe(200)
  })

  it('R-203 Dokumentablage: Vorlage „Technische Unterlagen je Kategorie“ als PDF (Gliederung, keine Rechtsberatung)', async () => {
    const auth = { authorization: `JWT ${token}` }
    const res = await rest(
      'GET',
      '/admin/compliance/template.pdf?category=schmuck',
      undefined,
      auth,
    )
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('application/pdf')
    expect(res.headers.get('cache-control')).toContain('no-store')
    const data = Buffer.from(await res.arrayBuffer())
    expect(data.subarray(0, 5).toString('latin1')).toBe('%PDF-')
    const text = await pdfText(data)
    expect(text).toContain('Technische Unterlagen – Schmuck')
    expect(text).toContain('keine Rechtsberatung')
    expect(text).toContain('Risikoanalyse')
    expect(text).toContain('Nickel')
    const bad = await rest('GET', '/admin/compliance/template.pdf?category=x', undefined, auth)
    expect(bad.status).toBe(400)
  })

  it('R-203 Dokumentablage AK-8-01: am 1. des Monats ab 08:10 genau eine Erinnerung A16, zweiter Lauf ohne zweite Mail', async () => {
    // Keramik: letztes Stück 2015 verkauft → Frist 2025 abgelaufen; Textil: Stück online ohne technische Unterlagen
    await createProduct(payload, {
      ...completeProduct('keramik', 985, fx),
      status: 'sold',
      firstPublishedAt: '2015-03-01T10:00:00.000Z',
      soldAt: '2015-05-01T10:00:00.000Z',
      soldChannel: 'offline',
    })
    await createProduct(payload, {
      ...completeProduct('textil', 986, fx),
      status: 'available',
      firstPublishedAt: '2026-09-01T10:00:00.000Z',
    })
    await upload({
      purpose: 'lab_report',
      complianceCategory: 'keramik',
      documentVersion: 'Blei 2015',
    })

    const overview = await complianceOverview(payload, FIRST_OF_MONTH, { includeSeed: false })
    const keramik = overview.categories.find((c) => c.category === 'keramik')!
    expect(keramik.keepUntil).toBe('2025-05-01T10:00:00.000Z')
    expect(keramik.documents.find((d) => d.kind === 'lab_report')?.deletable).toBe(true)
    const textil = overview.categories.find((c) => c.category === 'textil')!
    expect(textil.onMarket).toBe(true)

    await run(TOO_EARLY)
    expect(await mails()).toHaveLength(0)

    await run(FIRST_OF_MONTH)
    const sent = await mails()
    expect(sent).toHaveLength(1)
    expect(sent[0]!.subject).toBe('Produktsicherheits-Unterlagen prüfen')
    const job = await payload.find({
      collection: 'email-log',
      where: { id: { equals: sent[0]!.id } },
      overrideAccess: true,
    })
    expect(job.docs[0]?.to).toBeTruthy()

    await run(LATER)
    expect(await mails()).toHaveLength(1)
    // Nichts gelöscht (nur Erinnerung)
    expect(
      (await payload.count({ collection: 'private-uploads', where: { id: { in: uploads } } }))
        .totalDocs,
    ).toBe(uploads.length)
    await deleteProducts(payload, [985, 986])
  })

  it('R-203 Dokumentablage: nur Stücke und Unterlagen mit seed = true → keine A16 (Ablage zeigt sie trotzdem)', async () => {
    await removeUploads()
    await createProduct(payload, {
      ...completeProduct('zeichnung', 987, fx),
      status: 'sold',
      firstPublishedAt: '2014-03-01T10:00:00.000Z',
      soldAt: '2014-05-01T10:00:00.000Z',
      soldChannel: 'offline',
      seed: true,
    })
    const seedDoc = await upload({
      purpose: 'supplier_document',
      complianceCategory: 'zeichnung',
      seed: true,
    })
    await run(FIRST_OF_MONTH)
    expect(await mails()).toHaveLength(0)

    const visible = await complianceOverview(payload, FIRST_OF_MONTH, { includeSeed: true })
    const zeichnung = visible.categories.find((c) => c.category === 'zeichnung')!
    expect(zeichnung.documents.map((d) => d.id)).toContain(seedDoc.id)
    expect(zeichnung.documents.find((d) => d.id === seedDoc.id)?.seed).toBe(true)
    await deleteProducts(payload, [987])
  })
})
