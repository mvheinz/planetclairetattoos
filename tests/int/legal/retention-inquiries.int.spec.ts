import { randomBytes } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

import { sql } from '@payloadcms/db-postgres'
import type { Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { loadInquiryDetail } from '@/admin/views/inquiries/inquiryQuery'
import { __setEmailAdapterForTests, createEmailAdapter } from '@/lib/email'
import { parseEnv } from '@/lib/env'
import { createCommissionFormToken } from '@/lib/commission/formToken'
import { submitCommission } from '@/lib/commission/submit'
import { handleCommissionUpload } from '@/lib/commission/upload'
import { runRetentionTask } from '@/lib/retention/jobs'
import { L_10_INQUIRIES, L_13F_PENDING_UPLOADS, retainUntil } from '@/lib/retention/policy'
import { readStoredFile } from '@/lib/storage/read'
import { formatBerlin } from '@/lib/time'
import type { PrivateUpload } from '@/payload-types'

import { systemReq } from '../helpers/admin'
import { dbOf } from '../helpers/commerce'
import { withBusiness } from '../helpers/invoices'
import { getTestPayload } from '../helpers/payload'

// P7.14 – Löschung der Anfragen (LOESCHKONZEPT L-10, KONZEPT AK-8-03, DATENMODELL DM-INQ-01, R-154): Anfragen aus dem
// echten Formular-Weg (Upload → Absenden) analog zu den Seed-Anfragen A1–A7 (SEED-SPEC §11: `deleteAfter = createdAt +
// 6 Monate`). `retentionCommissionInquiries` löscht Anfrage und Bilder am Tag nach Eingang + 6 Monate – auch nach
// späterer Aktivität; mit Aufbewahrungssperre bleibt sie; je Anfrage ein `deletion-log`-Eintrag ohne Inhalte.
// `retentionTechnical` löscht nicht abgeschickte Uploads nach 24 h (L-13 f).

const RECEIVED = new Date('2026-04-15T09:30:00.000Z')
const LOADED = new Date(RECEIVED.getTime() - 5 * 60_000)
const DAY = 86_400_000
const EMAIL = 'loeschung-test@planetclaire.local'
let payload: Payload
let restoreBusiness: () => Promise<void>

const iso = (d: Date) => d.toISOString()
const plus = (d: Date, ms: number) => new Date(d.getTime() + ms)
const ip = () => `2001:db8:a::${randomBytes(4).toString('hex')}`
const exists = async (table: string, id: number) =>
  (await dbOf(payload).execute(sql.raw(`SELECT 1 FROM "${table}" WHERE id = ${Number(id)}`))).rows
    .length > 0
const fileExists = async (doc: { filename?: string | null; prefix?: string | null }) =>
  (await readStoredFile('private', doc.filename ?? '', doc.prefix)) !== null

async function upload(token: string, at: Date): Promise<{ uploadId: number; ticket: string }> {
  const img = await readFile(path.resolve('tests/fixtures/images/landscape-small.jpg'))
  const body = new FormData()
  body.append('file', new Blob([new Uint8Array(img)], { type: 'image/jpeg' }), 'skizze.jpg')
  const res = await handleCommissionUpload(
    new Request('http://localhost:3000/api/uploads/commission', {
      method: 'POST',
      headers: { 'x-form-token': token, 'x-forwarded-for': ip() },
      body,
    }),
    payload,
    at,
  )
  expect(res.status).toBe(201)
  return (await res.json()) as { uploadId: number; ticket: string }
}

async function inquiry(images: number): Promise<{ id: number; uploads: PrivateUpload[] }> {
  const token = createCommissionFormToken(LOADED)
  const ups = []
  for (let i = 0; i < images; i++) ups.push(await upload(token, LOADED))
  const r = await submitCommission(
    {
      name: 'Lotte Beispiel',
      email: EMAIL,
      objectType: 'teller',
      idea: 'Ein Teller mit einem kleinen Hasen und dem Spruch „Guten Appetit“.',
      locale: 'de',
      formToken: token,
      images: ups.map((u) => `${u.uploadId}.${u.ticket}`),
    },
    { now: RECEIVED, ip: ip(), payload },
  )
  if (!r.ok || r.spam || !r.inquiryId) throw new Error('Anfrage nicht angelegt')
  const docs = await Promise.all(
    ups.map(
      (u) =>
        payload.findByID({
          collection: 'private-uploads',
          id: u.uploadId,
          overrideAccess: true,
          depth: 0,
        }) as Promise<PrivateUpload>,
    ),
  )
  return { id: r.inquiryId, uploads: docs }
}

async function logsFor(collection: string, id: number) {
  return (
    await payload.find({
      collection: 'deletion-log',
      where: {
        and: [{ entityCollection: { equals: collection } }, { entityId: { equals: String(id) } }],
      },
      overrideAccess: true,
      limit: 20,
    })
  ).docs
}

async function cleanup() {
  const res = await payload.find({
    collection: 'inquiries',
    where: { email: { equals: EMAIL } },
    overrideAccess: true,
    depth: 0,
    limit: 50,
  })
  for (const q of res.docs) {
    await dbOf(payload).execute(
      sql`UPDATE inquiries SET privacy_legal_hold = false WHERE id = ${q.id}`,
    )
    await dbOf(payload).execute(sql`DELETE FROM email_log WHERE inquiry_id = ${q.id}`)
    await payload.delete({ collection: 'inquiries', id: q.id, overrideAccess: true })
  }
}

beforeAll(async () => {
  payload = await getTestPayload()
  restoreBusiness = await withBusiness(payload)
  __setEmailAdapterForTests(
    createEmailAdapter(parseEnv({ ...process.env, EMAIL_DRIVER: 'memory' })),
  )
  await cleanup()
})

afterAll(async () => {
  await cleanup()
  __setEmailAdapterForTests(undefined)
  await restoreBusiness()
})

describe('Anfragen: Löschung nach 6 Monaten (P7.14)', () => {
  it('R-154 DM-INQ-01 L-10 Anfrage bleibt bis Eingang + 6 Monate, ist am Tag danach samt Dateien gelöscht – auch nach späterer Aktivität; deletion-log ohne Inhalte', async () => {
    const q = await inquiry(2)
    const due = retainUntil(L_10_INQUIRIES, RECEIVED)
    expect(due.getTime()).toBeGreaterThan(plus(RECEIVED, 180 * DAY).getTime())
    // Verwaltung zeigt „wird gelöscht am {Eingang + 6 Monate}“
    const detail = await loadInquiryDetail(await systemReq(payload), q.id)
    expect(detail?.card.deleteAfter).toBe(formatBerlin(due, 'dd.MM.yyyy'))
    // Bilder mit derselben Frist
    for (const u of q.uploads) expect(iso(new Date(u.deleteAfter!))).toBe(iso(due))
    // spätere Aktivität (Status, Notiz) verlängert nichts
    await dbOf(payload).execute(
      sql`UPDATE inquiries SET status = 'in_progress', last_activity_at = ${iso(plus(due, -DAY))}::timestamptz WHERE id = ${q.id}`,
    )

    await runRetentionTask(payload, 'retentionCommissionInquiries', { now: plus(due, -DAY) })
    expect(await exists('inquiries', q.id)).toBe(true)
    for (const u of q.uploads) expect(await fileExists(u)).toBe(true)

    await runRetentionTask(payload, 'retentionCommissionInquiries', { now: plus(due, DAY) })
    expect(await exists('inquiries', q.id)).toBe(false)
    for (const u of q.uploads) {
      expect(await exists('private_uploads', u.id)).toBe(false)
      expect(await fileExists(u)).toBe(false)
    }
    const logs = await logsFor('inquiries', q.id)
    expect(logs).toHaveLength(1)
    expect(logs[0]).toMatchObject({ ruleId: 'L-10', storageObjectsCount: 2 })
    const text = JSON.stringify(logs[0])
    for (const secret of [EMAIL, 'Lotte', 'Hasen']) expect(text).not.toContain(secret)
  })

  it('R-154 L-10 mit Aufbewahrungssperre bleibt die Anfrage samt Bild', async () => {
    const q = await inquiry(1)
    await dbOf(payload).execute(
      sql`UPDATE inquiries SET privacy_legal_hold = true, privacy_legal_hold_reason = 'Streit um Angebot',
            privacy_legal_hold_since = ${iso(RECEIVED)}::timestamptz WHERE id = ${q.id}`,
    )
    const due = retainUntil(L_10_INQUIRIES, RECEIVED)
    await runRetentionTask(payload, 'retentionCommissionInquiries', { now: plus(due, 30 * DAY) })
    expect(await exists('inquiries', q.id)).toBe(true)
    expect(await fileExists(q.uploads[0]!)).toBe(true)
    expect(await logsFor('inquiries', q.id)).toHaveLength(0)
  })

  it('R-154 L-13 f nicht abgeschickte Uploads: nach 24 h gelöscht (retentionTechnical)', async () => {
    const at = new Date('2026-09-01T10:00:00.000Z')
    const u = await upload(createCommissionFormToken(at), at)
    const doc = (await payload.findByID({
      collection: 'private-uploads',
      id: u.uploadId,
      overrideAccess: true,
      depth: 0,
    })) as PrivateUpload
    expect(doc.status).toBe('pending')
    const due = retainUntil(L_13F_PENDING_UPLOADS, at)
    expect(due.getTime() - at.getTime()).toBe(DAY)
    await runRetentionTask(payload, 'retentionTechnical', { now: plus(at, 23 * 3_600_000) })
    expect(await exists('private_uploads', u.uploadId)).toBe(true)
    await runRetentionTask(payload, 'retentionTechnical', { now: plus(at, DAY + 3_600_000) })
    expect(await exists('private_uploads', u.uploadId)).toBe(false)
    expect(await fileExists(doc)).toBe(false)
  })

  it('SEED-SPEC §11 und KONZEPT AK-8-03 nennen die Löschung 6 Monate nach Eingang', async () => {
    const seedSpec = await readFile(path.resolve('content/seed/SEED-SPEC.md'), 'utf8')
    const section = seedSpec.slice(seedSpec.indexOf('## 11. Anfragen'), seedSpec.indexOf('## 11a.'))
    expect(section).toContain('`deleteAfter = createdAt + 6 Monate`')
    const konzept = await readFile(path.resolve('docs/KONZEPT.md'), 'utf8')
    expect(konzept).toMatch(/\*\*AK-8-03\*\*[^\n]*Eingang \+ 6 Monate/)
  })
})
