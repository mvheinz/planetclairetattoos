import { readFile } from 'node:fs/promises'
import net from 'node:net'
import path from 'node:path'

import { CreateBucketCommand, HeadBucketCommand, S3Client } from '@aws-sdk/client-s3'
import exifr from 'exifr'
import type { Payload } from 'payload'
import sharp from 'sharp'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { PrivateUploads } from '@/collections/PrivateUploads'
import { PRIVATE_URL_TTL_SECONDS, uploadStaticDir } from '@/lib/storage'
import { sha256Hex } from '@/lib/uploads/files'
import { registerUploadReference } from '@/lib/uploads/references'

import { createOrder, deleteCommerce, orderData } from '../helpers/commerce'
import { getTestPayload } from '../helpers/payload'
import {
  completeProduct,
  createProduct,
  createProductFixtures,
  deleteProducts,
} from '../helpers/products'
import { rest } from '../helpers/rest'
import { createStorageHarness, type StorageHarness } from '../helpers/storageHarness'

// P1.14: `documents` (DATENMODELL §6.3) und `private-uploads` (§6.4) mit Aufbewahrungsmodul (R-135, R-136).

const FIXTURES = path.resolve('tests/fixtures/images')
const ADMIN = { email: 'admin@example.com', password: 'richtig-langes-passwort-2026' }
const PDF_TAIL =
  '1 0 obj<</Type/Catalog>>endobj\nxref\n0 2\n0000000000 65535 f \n0000000009 00000 n \ntrailer<</Size 2/Root 1 0 R>>\nstartxref\n40\n%%EOF\n'
const PDF = Buffer.from(`%PDF-1.4\n${PDF_TAIL}`)

let payload: Payload
const createdPrivate: (number | string)[] = []
const createdDocs: (number | string)[] = []

type PrivateDoc = {
  id: number
  filename: string
  mimeType: string
  width?: number | null
  height?: number | null
  purpose: string
  status: string
  deleteAfter?: string | null
  retainUntil?: string | null
  sha256?: string | null
  sizes?: { thumb?: { filename?: string | null } | null }
}

const fileOf = (data: Buffer, name: string, mimetype: string) => ({
  data,
  name,
  mimetype,
  size: data.length,
})

async function createPrivate(
  data: Record<string, unknown>,
  file: { data: Buffer; name: string; mimetype: string; size: number } = fileOf(
    PDF,
    'nachweis.pdf',
    'application/pdf',
  ),
  context: Record<string, unknown> = {},
): Promise<PrivateDoc> {
  const doc = (await payload.create({
    collection: 'private-uploads',
    data: data as never,
    file,
    overrideAccess: true,
    context,
  })) as unknown as PrivateDoc
  createdPrivate.push(doc.id)
  return doc
}

/** Erwartet eine Ablehnung, deren Meldung (auch in `data.errors`) auf `re` passt. */
async function rejects(promise: Promise<unknown>, re: RegExp): Promise<void> {
  const err = await promise.then(
    () => null,
    (e: unknown) => e as { message?: string; data?: { errors?: { message: string }[] } },
  )
  expect(err, `erwartet Ablehnung mit ${re}`).not.toBeNull()
  const text = [err!.message ?? '', ...(err!.data?.errors ?? []).map((x) => x.message)].join(' | ')
  expect(text).toMatch(re)
}

async function adminToken(): Promise<string> {
  const login = await rest('POST', '/users/login', ADMIN, { 'x-forwarded-for': '198.51.100.9' })
  return ((await login.json()) as { token: string }).token
}

beforeAll(async () => {
  payload = await getTestPayload()
  await payload.delete({
    collection: 'users',
    where: { id: { exists: true } },
    overrideAccess: true,
  })
  await payload.create({
    collection: 'users',
    data: { ...ADMIN, name: 'Jutta', role: 'admin' },
    overrideAccess: true,
  })
})

afterAll(async () => {
  for (const id of createdPrivate) {
    // Aufbewahrte Belege im Test über den Seed-Weg entfernen
    await payload
      .update({
        collection: 'private-uploads',
        id,
        data: { seed: true } as never,
        overrideAccess: true,
        context: { system: true },
      })
      .catch(() => null)
    await payload
      .delete({
        collection: 'private-uploads',
        id,
        overrideAccess: true,
        context: { seed: true, skipAudit: true },
      })
      .catch(() => null)
  }
  for (const id of createdDocs) {
    await payload
      .update({ collection: 'documents', id, data: { seed: true } as never, overrideAccess: true })
      .catch(() => null)
    await payload.delete({ collection: 'documents', id, overrideAccess: true }).catch(() => null)
  }
  await payload.delete({
    collection: 'users',
    where: { id: { exists: true } },
    overrideAccess: true,
  })
})

describe('private-uploads – Zugriff (R-136)', () => {
  it('DM-PRIV-01 ohne Login liefert jede Dateiroute 401/403, auch Liste, Einzelabruf und Anlegen', async () => {
    const img = await readFile(path.join(FIXTURES, 'gps-orientation-6.jpg'))
    const doc = await createPrivate(
      { purpose: 'commission_reference' },
      fileOf(img, 'referenz.jpg', 'image/jpeg'),
    )
    const pdf = await createPrivate({ purpose: 'lab_report', complianceCategory: 'keramik' })
    const thumb = doc.sizes?.thumb?.filename
    expect(thumb).toBeTruthy()
    for (const name of [doc.filename, thumb!, pdf.filename]) {
      const res = await rest('GET', `/private-uploads/file/${name}`)
      expect([401, 403], name).toContain(res.status)
    }
    expect([401, 403]).toContain((await rest('GET', `/private-uploads/${doc.id}`)).status)
    expect([401, 403]).toContain((await rest('GET', '/private-uploads')).status)
    expect([401, 403]).toContain(
      (await rest('POST', '/private-uploads', { purpose: 'lab_report' })).status,
    )
    expect([401, 403]).toContain((await rest('DELETE', `/private-uploads/${doc.id}`)).status)
  })

  it('DM-PRIV-01 mit Verwaltungs-Sitzung abrufbar, nie im geteilten Cache', async () => {
    const doc = await createPrivate({ purpose: 'supplier_document', complianceCategory: 'textil' })
    const res = await rest('GET', `/private-uploads/file/${doc.filename}`, undefined, {
      authorization: `JWT ${await adminToken()}`,
    })
    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toContain('private')
    expect(res.headers.get('cache-control')).toContain('no-store')
    expect(Buffer.from(await res.arrayBuffer())).toEqual(PDF)
  })

  it('Dateien liegen im privaten Speicher außerhalb von public/', async () => {
    const doc = await createPrivate({ purpose: 'processor_agreement' })
    const stored = await readFile(path.join(uploadStaticDir('private'), doc.filename))
    expect(stored).toEqual(PDF)
    expect(uploadStaticDir('private')).not.toContain(`${path.sep}public${path.sep}`)
  })
})

describe('private-uploads – Dateien (R-135)', () => {
  it('DM-PRIV-02/R-135 Referenzbild mit GPS wird ohne EXIF/GPS/XMP/IPTC, gedreht und als JPEG q85 gespeichert', async () => {
    const img = await readFile(path.join(FIXTURES, 'gps-orientation-6.jpg'))
    expect((await exifr.gps(img))?.latitude).toBeGreaterThan(52)
    const doc = await createPrivate(
      { purpose: 'commission_reference' },
      fileOf(img, 'mein-tattoo-wunsch.jpg', 'image/jpeg'),
    )
    expect(doc.mimeType).toBe('image/jpeg')
    expect(doc.filename).toMatch(/^mein-tattoo-wunsch-[a-f0-9]{10}\.jpg$/)
    const stored = await readFile(path.join(uploadStaticDir('private'), doc.filename))
    const meta = await sharp(stored).metadata()
    expect(meta.format).toBe('jpeg')
    expect(meta.exif).toBeUndefined()
    expect(meta.xmp).toBeUndefined()
    expect(meta.iptc).toBeUndefined()
    expect(meta.orientation ?? 1).toBe(1)
    expect(await exifr.gps(stored).catch(() => undefined)).toBeUndefined()
    const parsed = await exifr.parse(stored, { tiff: true, gps: true, xmp: true, iptc: true })
    expect(parsed ?? {}).toEqual({})
    // 2000×3000 mit Orientation 6 → Querformat, höchstens 2560 px lang
    expect([meta.width, meta.height]).toEqual([2560, 1707])
    expect(doc.sha256).toBe(sha256Hex(stored))
  })

  it('nur JPEG, PNG, WebP und PDF (am Inhalt geprüft), höchstens 10 MB', async () => {
    const gif = await sharp({ create: { width: 8, height: 8, channels: 3, background: '#000' } })
      .gif()
      .toBuffer()
    const big = Buffer.concat([
      Buffer.from('%PDF-1.4\n'),
      Buffer.alloc(10 * 1024 * 1024),
      Buffer.from(PDF_TAIL),
    ])
    const cases: [Buffer, string, string][] = [
      [gif, 'bild.gif', 'image/gif'],
      [gif, 'getarnt.jpg', 'image/jpeg'],
      [Buffer.from('kein pdf'), 'getarnt.pdf', 'application/pdf'],
      [big, 'gross.pdf', 'application/pdf'],
    ]
    for (const [data, name, mime] of cases) {
      await expect(
        payload.create({
          collection: 'private-uploads',
          data: { purpose: 'lab_report' } as never,
          file: fileOf(data, name, mime),
          overrideAccess: true,
        }),
        name,
      ).rejects.toThrow()
    }
  })

  it('Zweck ist unveränderlich; Kategorie nur bei Unterlagen, bei technischen Unterlagen Pflicht', async () => {
    const doc = await createPrivate({ purpose: 'lab_report', complianceCategory: 'keramik' })
    await rejects(
      payload.update({
        collection: 'private-uploads',
        id: doc.id,
        data: { purpose: 'packing_photo' } as never,
        overrideAccess: true,
      }),
      /Zweck/,
    )
    await rejects(createPrivate({ purpose: 'technical_file' }), /Kategorie/)
    await rejects(
      createPrivate({ purpose: 'invoice_pdf', complianceCategory: 'keramik' }),
      /Kategorie/,
    )
    await rejects(createPrivate({ purpose: 'invoice_pdf', documentVersion: 'v1' }), /Version/)
  })

  it('„pending“ nur für Referenzbilder aus dem Formular', async () => {
    await expect(createPrivate({ purpose: 'lab_report', status: 'pending' })).rejects.toThrow()
    const admin = (await payload.find({ collection: 'users', limit: 1, overrideAccess: true }))
      .docs[0]!
    await expect(
      payload.create({
        collection: 'private-uploads',
        data: { purpose: 'commission_reference', status: 'pending' } as never,
        file: fileOf(PDF, 'x.pdf', 'application/pdf'),
        user: { ...admin, collection: 'users' },
        overrideAccess: true,
      }),
    ).rejects.toThrow()
  })
})

describe('private-uploads – Aufbewahrung (DATENMODELL §6.4, LOESCHKONZEPT)', () => {
  it('Formular-Upload „pending“: deleteAfter = Anlage + 24 h (L-13 f); nach Absenden Anfrage + 6 Monate (L-10)', async () => {
    const doc = await createPrivate(
      { purpose: 'commission_reference', status: 'pending' },
      undefined,
      { now: '2026-10-15T10:00:00.000Z' },
    )
    expect(doc.status).toBe('pending')
    expect(doc.deleteAfter).toBe('2026-10-16T10:00:00.000Z')
    const attached = await payload.update({
      collection: 'private-uploads',
      id: doc.id,
      data: { status: 'attached' } as never,
      overrideAccess: true,
      context: { system: true, now: '2026-10-15T10:05:00.000Z' },
    })
    expect(attached.deleteAfter).toBe('2027-04-15T10:05:00.000Z')
  })

  it('Beleg-PDF: retainUntil = 01.01.(Jahr + 10 + 1) Berlin; Monatsexport ebenso 10 Jahre (L-06, L-07)', async () => {
    const inv = await createPrivate({ purpose: 'invoice_pdf' }, undefined, {
      now: '2027-03-15T09:00:00.000Z',
    })
    expect(inv.retainUntil).toBe('2037-12-31T23:00:00.000Z')
    expect(inv.deleteAfter ?? null).toBeNull()
    const exp = await createPrivate({ purpose: 'monthly_export' }, undefined, {
      now: '2027-01-05T09:00:00.000Z',
    })
    expect(exp.retainUntil).toBe('2037-12-31T23:00:00.000Z')
    // retainUntil ist eingefroren
    const upd = await payload.update({
      collection: 'private-uploads',
      id: inv.id,
      data: { retainUntil: '2028-01-01T00:00:00.000Z', note: 'Beleg' } as never,
      overrideAccess: true,
    })
    expect(upd.retainUntil).toBe('2037-12-31T23:00:00.000Z')
  })

  it('ein PDF mit retainUntil in der Zukunft lässt sich nicht löschen (auch nicht per REST); Seed schon', async () => {
    const inv = await createPrivate({ purpose: 'credit_note_pdf' })
    await rejects(
      payload.delete({ collection: 'private-uploads', id: inv.id, overrideAccess: true }),
      /aufbewahrt/,
    )
    const res = await rest('DELETE', `/private-uploads/${inv.id}`, undefined, {
      authorization: `JWT ${await adminToken()}`,
    })
    expect(res.status).toBe(409)
    // Nach Ablauf der Frist erlaubt
    const later = await createPrivate({ purpose: 'invoice_pdf' }, undefined, {
      now: '2010-06-01T10:00:00.000Z',
    })
    expect(later.retainUntil).toBe('2020-12-31T23:00:00.000Z')
    await payload.delete({ collection: 'private-uploads', id: later.id, overrideAccess: true })
    // Seed-Beleg
    const seeded = await createPrivate({ purpose: 'invoice_pdf', seed: true })
    await payload.delete({
      collection: 'private-uploads',
      id: seeded.id,
      overrideAccess: true,
      context: { seed: true, skipAudit: true },
    })
  })

  it('deleteAfter darf nur verkürzt werden', async () => {
    const doc = await createPrivate({ purpose: 'commission_reference' }, undefined, {
      now: '2026-10-15T10:00:00.000Z',
    })
    expect(doc.deleteAfter).toBe('2027-04-15T10:00:00.000Z')
    const update = (deleteAfter: string | null) =>
      payload.update({
        collection: 'private-uploads',
        id: doc.id,
        data: { deleteAfter } as never,
        overrideAccess: true,
      })
    await rejects(update('2027-05-01T10:00:00.000Z'), /verkürzt/)
    await rejects(update(null), /verkürzt/)
    const shorter = await update('2026-12-01T10:00:00.000Z')
    expect(shorter.deleteAfter).toBe('2026-12-01T10:00:00.000Z')
    await rejects(update('2027-01-01T10:00:00.000Z'), /verkürzt/)
    // Beim Anlegen: längere Frist als berechnet wird abgelehnt, kürzere übernommen
    await rejects(
      createPrivate({ purpose: 'commission_reference', deleteAfter: '2099-01-01T00:00:00.000Z' }),
      /verkürzt/,
    )
    // Nachweise ohne Auto-Löschung: eine Frist setzen ist eine Verkürzung
    const lab = await createPrivate({ purpose: 'lab_report', complianceCategory: 'keramik' })
    expect(lab.deleteAfter ?? null).toBeNull()
    const set = await payload.update({
      collection: 'private-uploads',
      id: lab.id,
      data: { deleteAfter: '2030-01-01T00:00:00.000Z' } as never,
      overrideAccess: true,
    })
    expect(set.deleteAfter).toBe('2030-01-01T00:00:00.000Z')
  })

  it('Nachweise mit bestehendem Verweis sind gesperrt; Löschen schreibt Audit private_upload_deleted', async () => {
    const lab = await createPrivate({ purpose: 'lab_report', complianceCategory: 'keramik' })
    const unregister = registerUploadReference({
      target: 'private-uploads',
      collection: 'audit-log',
      path: 'entityId',
      label: 'Test-Verweis',
    })
    await payload.create({
      collection: 'audit-log',
      data: {
        action: 'settings_changed',
        actorType: 'system',
        entityCollection: 'private-uploads',
        entityId: String(lab.id),
        summary: 'Verweis-Test',
        retainUntil: '2030-01-01T00:00:00.000Z',
      } as never,
      overrideAccess: true,
      context: { skipAudit: true },
    })
    try {
      await rejects(
        payload.delete({ collection: 'private-uploads', id: lab.id, overrideAccess: true }),
        /Test-Verweis/,
      )
    } finally {
      unregister()
    }
    await payload.delete({ collection: 'private-uploads', id: lab.id, overrideAccess: true })
    const audit = await payload.find({
      collection: 'audit-log',
      where: {
        and: [
          { action: { equals: 'private_upload_deleted' } },
          { entityId: { equals: String(lab.id) } },
        ],
      },
      overrideAccess: true,
    })
    expect(audit.docs).toHaveLength(1)
    expect(audit.docs[0]!.summary).toBe(`Private Datei ${lab.id} (Laborbericht) gelöscht.`)
    expect(audit.docs[0]!.summary).not.toContain('.pdf')
  })
})

describe('private-uploads – Bezüge zu Bestellung, Stück und Beleg (DATENMODELL §6.4)', () => {
  let productId: number
  let shipped: { id: number; retainUntil?: string | null }
  let invoice: { id: number; retainUntil: string }

  beforeAll(async () => {
    await deleteCommerce(payload)
    await deleteProducts(payload, [982])
    const fx = await createProductFixtures(payload)
    const p = await createProduct(payload, completeProduct('keramik', 982, fx))
    productId = p.id as number
    const item = { id: productId, itemNumber: 982 }
    shipped = (await createOrder(
      payload,
      orderData(90982, [item], {
        seed: true,
        status: 'shipped',
        timestamps: {
          placedAt: '2026-09-27T10:00:00.000Z',
          shippedAt: '2026-10-01T08:00:00.000Z',
        },
        retainUntil: '2033-12-31T23:00:00.000Z',
      }),
      { seed: true },
    )) as never
    const paid = await createOrder(payload, orderData(983, [item]))
    invoice = (await payload.create({
      collection: 'invoices',
      data: {
        type: 'invoice',
        order: paid.id,
        deliveryDate: '2026-09-27T10:00:00.000Z',
        totalGrossCents: 5390,
        data: { version: 1 },
      } as never,
      overrideAccess: true,
      context: { system: true, now: '2026-09-27T10:00:00.000Z' },
    })) as never
  })
  afterAll(async () => {
    await deleteCommerce(payload)
    await deleteProducts(payload, [982])
  })

  it('Packfoto mit Bestellung: deleteAfter = shippedAt + 12 Monate (L-05 Stufe C); Stück wird gespeichert', async () => {
    const doc = (await createPrivate({
      purpose: 'packing_photo',
      relatedOrder: shipped.id,
      relatedProduct: productId,
    })) as PrivateDoc & { relatedOrder?: { id: number }; relatedProduct?: { id: number } }
    expect(doc.relatedOrder?.id).toBe(shipped.id)
    expect(doc.relatedProduct?.id).toBe(productId)
    expect(doc.deleteAfter).toBe('2027-10-01T08:00:00.000Z')
  })

  it('Reklamationsfoto: deleteAfter = orders.retainUntil (L-09); ohne Bestellung zunächst leer', async () => {
    const doc = await createPrivate({ purpose: 'complaint_photo', relatedOrder: shipped.id })
    expect(doc.deleteAfter).toBe('2033-12-31T23:00:00.000Z')
    const loose = await createPrivate({ purpose: 'complaint_photo' })
    expect(loose.deleteAfter ?? null).toBeNull()
    // spätere Zuordnung zieht die Frist nach
    const linked = await payload.update({
      collection: 'private-uploads',
      id: loose.id,
      data: { relatedOrder: shipped.id } as never,
      overrideAccess: true,
    })
    expect(linked.deleteAfter).toBe('2033-12-31T23:00:00.000Z')
  })

  it('L-06 Beleg-PDF mit Beleg: retainUntil = invoices.retainUntil; spätere Zuordnung verlängert nur', async () => {
    expect(invoice.retainUntil).toBe('2036-12-31T23:00:00.000Z')
    const pdf = (await createPrivate(
      { purpose: 'invoice_pdf', relatedInvoice: invoice.id },
      undefined,
      { now: '2027-02-01T10:00:00.000Z' },
    )) as PrivateDoc & { relatedInvoice?: { id: number } }
    expect(pdf.relatedInvoice?.id).toBe(invoice.id)
    expect(pdf.retainUntil).toBe(invoice.retainUntil)
    // ohne Beleg ab Anlagejahr 2027 (bis 01.01.2038); Zuordnung zum Beleg 2026 verkürzt nicht
    const loose = await createPrivate({ purpose: 'invoice_pdf' }, undefined, {
      now: '2027-02-01T10:00:00.000Z',
    })
    expect(loose.retainUntil).toBe('2037-12-31T23:00:00.000Z')
    const linked = await payload.update({
      collection: 'private-uploads',
      id: loose.id,
      data: { relatedInvoice: invoice.id } as never,
      overrideAccess: true,
    })
    expect(linked.retainUntil).toBe('2037-12-31T23:00:00.000Z')
  })
})

describe('documents – öffentliche PDFs (DATENMODELL §6.3)', () => {
  async function createDoc(data: Record<string, unknown>, buf = PDF, name = 'erklaerung.pdf') {
    const doc = (await payload.create({
      collection: 'documents',
      data: data as never,
      file: fileOf(buf, name, 'application/pdf'),
      overrideAccess: true,
    })) as unknown as { id: number; filename: string; sha256: string; kind: string }
    createdDocs.push(doc.id)
    return doc
  }

  it('nur PDF, sha256 beim Upload berechnet, öffentlich abrufbar', async () => {
    const doc = await createDoc({ title: 'Pflegeanleitung', kind: 'aftercare_pdf', language: 'de' })
    expect(doc.sha256).toBe(sha256Hex(PDF))
    const png = await sharp({ create: { width: 4, height: 4, channels: 3, background: '#fff' } })
      .png()
      .toBuffer()
    await rejects(createDoc({ title: 'Kein PDF' }, png, 'bild.pdf'), /PDF/)
    const res = await rest('GET', `/documents/file/${doc.filename}`)
    expect(res.status).toBe(200)
  })

  it('PDFs von Rechtstexten lassen sich nie löschen (außer Seed); andere schon', async () => {
    const legal = await createDoc({ title: 'AGB Fassung 1', kind: 'legal_text_pdf' })
    await rejects(
      payload.delete({ collection: 'documents', id: legal.id, overrideAccess: true }),
      /Rechtstext/,
    )
    const other = await createDoc({ title: 'Sonstiges PDF', kind: 'other' })
    await payload.delete({ collection: 'documents', id: other.id, overrideAccess: true })
    expect([401, 403]).toContain((await rest('DELETE', `/documents/${legal.id}`)).status)
  })
})

// ---------------------------------------------------------------------------------------------------------------------
// DM-PRIV-01 mit STORAGE_DRIVER=s3: echte Collection gegen MinIO (docker compose --profile s3); ohne MinIO übersprungen
// (wie tests/int/adapters/storage.contract.int.spec.ts).

const S3_TEST = {
  endpoint: process.env.S3_TEST_ENDPOINT ?? 'http://127.0.0.1:9000',
  accessKeyId: process.env.S3_TEST_ACCESS_KEY_ID ?? 'minioadmin',
  secretAccessKey: process.env.S3_TEST_SECRET_ACCESS_KEY ?? 'minioadmin',
  bucket: 'pct-media-dev',
  privateBucket: 'pct-private-dev',
}

async function reachable(endpoint: string): Promise<boolean> {
  const u = new URL(endpoint)
  if (!['127.0.0.1', 'localhost', '::1'].includes(u.hostname)) return false
  return new Promise((resolve) => {
    const socket = net.connect({ host: u.hostname, port: Number(u.port || 80) })
    socket.setTimeout(1000)
    socket.once('connect', () => (socket.destroy(), resolve(true)))
    socket.once('error', () => resolve(false))
    socket.once('timeout', () => (socket.destroy(), resolve(false)))
  })
}
const s3Available = await reachable(S3_TEST.endpoint)

describe.skipIf(!s3Available)('private-uploads – STORAGE_DRIVER=s3 (MinIO)', () => {
  let h: StorageHarness
  beforeAll(async () => {
    const s3 = new S3Client({
      endpoint: S3_TEST.endpoint,
      region: 'us-east-1',
      forcePathStyle: true,
      credentials: { accessKeyId: S3_TEST.accessKeyId, secretAccessKey: S3_TEST.secretAccessKey },
    })
    for (const Bucket of [S3_TEST.bucket, S3_TEST.privateBucket]) {
      try {
        await s3.send(new HeadBucketCommand({ Bucket }))
      } catch {
        await s3.send(new CreateBucketCommand({ Bucket }))
      }
    }
    h = await createStorageHarness(
      'private_uploads_s3',
      {
        STORAGE_DRIVER: 's3',
        S3_ENDPOINT: S3_TEST.endpoint,
        S3_REGION: 'us-east-1',
        S3_BUCKET: S3_TEST.bucket,
        S3_PRIVATE_BUCKET: S3_TEST.privateBucket,
        S3_ACCESS_KEY_ID: S3_TEST.accessKeyId,
        S3_SECRET_ACCESS_KEY: S3_TEST.secretAccessKey,
        S3_FORCE_PATH_STYLE: 'true',
      },
      {
        // Beziehungen auf Collections, die die Test-Instanz nicht kennt, entfallen
        privateUploads: {
          ...PrivateUploads,
          fields: PrivateUploads.fields.filter((f) => f.type !== 'relationship'),
        },
      },
    )
  })
  afterAll(async () => {
    await h?.close()
  })

  it('DM-PRIV-01 anonym 403; Admin-URL ist signiert mit ≤ 300 s Gültigkeit', async () => {
    const img = await readFile(path.join(FIXTURES, 'landscape-small.jpg'))
    const doc = (await h.payload.create({
      collection: 'private-uploads' as 'media',
      data: { purpose: 'commission_reference' } as never,
      file: fileOf(img, 'referenz.jpg', 'image/jpeg'),
      overrideAccess: true,
    })) as unknown as PrivateDoc
    expect([401, 403]).toContain((await h.request(`/private-uploads/file/${doc.filename}`)).status)
    const admin = await h.request(`/private-uploads/file/${doc.filename}`, await h.adminHeaders())
    expect(admin.status).toBe(302)
    const signed = new URL(admin.headers.get('location') as string)
    expect(signed.searchParams.get('X-Amz-Signature')).toBeTruthy()
    expect(Number(signed.searchParams.get('X-Amz-Expires'))).toBeLessThanOrEqual(
      PRIVATE_URL_TTL_SECONDS,
    )
  })
})
