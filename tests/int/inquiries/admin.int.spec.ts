import { existsSync } from 'node:fs'
import path from 'node:path'

import { sql } from '@payloadcms/db-postgres'
import type { Payload } from 'payload'
import sharp from 'sharp'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { inquiryReplyHref } from '@/admin/views/inquiries/inquiryQuery'
import { INQUIRY_STATUSES, type InquiryStatus } from '@/lib/enums'
import { canTransitionInquiry, INQUIRY_TRANSITIONS } from '@/lib/inquiries/transitions'
import { uploadStaticDir } from '@/lib/storage'
import type { Inquiry, PrivateUpload } from '@/payload-types'

import { resetAdmin } from '../helpers/admin'
import { dbOf } from '../helpers/commerce'
import { ensureLegalTextFixtures } from '../helpers/legal'
import { getTestPayload } from '../helpers/payload'
import { rest } from '../helpers/rest'

// P5.20 – „Anfragen“ in der Verwaltung (KONZEPT §7.11, §5.5): Matrix der Übergänge `INQUIRY_TRANSITIONS` über
// `POST /api/inquiries/:id/status` (AK-5-01 Anfrage), Audit `inquiry_status_changed`, `lastActivityAt` statt
// `deleteAfter` (L-10); Referenzbild nur mit Anmeldung (AK-10-04, Teil Zugriff); „Jetzt löschen“ entfernt Datensatz und
// Dateien, Audit nur mit Referenz und Datum, `deletion-log` mit `ruleId = ADMIN`, `trigger = admin`.

let payload: Payload
let token: string
let nr = 9000

const auth = () => ({ authorization: `JWT ${token}`, 'idempotency-key': crypto.randomUUID() })

async function inquiry(extra: Record<string, unknown> = {}): Promise<Inquiry> {
  return (await payload.create({
    collection: 'inquiries',
    data: {
      reference: `AA-2026-${++nr}`,
      name: 'Erika Beispiel',
      email: 'erika@example.com',
      idea: 'Eine Tasse mit meinem Hund im Planet-Claire-Stil, gern in Blau.',
      objectType: 'tasse',
      locale: 'de',
      seed: true,
      createdAt: '2026-09-01T10:00:00.000Z',
      ...extra,
    } as never,
    overrideAccess: true,
    context: { seed: true },
  })) as Inquiry
}

async function referenceImage(): Promise<PrivateUpload> {
  const png = await sharp({
    create: { width: 64, height: 64, channels: 3, background: '#3355aa' },
  })
    .png()
    .toBuffer()
  return (await payload.create({
    collection: 'private-uploads',
    data: { purpose: 'commission_reference' } as never,
    file: { data: png, name: 'idee.png', mimetype: 'image/png', size: png.length },
    overrideAccess: true,
    context: { system: true },
  })) as PrivateUpload
}

const post = async (id: number, action: string, body: unknown, withAuth = true) => {
  const res = await rest('POST', `/inquiries/${id}/${action}`, body, withAuth ? auth() : {})
  return { status: res.status, json: (await res.json()) as Record<string, unknown> }
}

const reread = (id: number) =>
  payload.findByID({
    collection: 'inquiries',
    id,
    depth: 0,
    overrideAccess: true,
    disableErrors: true,
  }) as Promise<Inquiry | null>

beforeAll(async () => {
  payload = await getTestPayload()
  await ensureLegalTextFixtures(payload)
  ;({ token } = await resetAdmin(payload, '198.51.100.64'))
})

afterAll(async () => {
  await payload.delete({
    collection: 'inquiries',
    where: { reference: { like: 'AA-2026-9' } },
    overrideAccess: true,
    context: { seed: true },
  })
})

describe('„Anfragen“ (P5.20)', () => {
  it('AK-5-01 Anfrage: Matrix aller Übergänge (erlaubt → 200 + Audit, sonst 409 ohne Änderung)', async () => {
    const doc = await inquiry()
    const db = dbOf(payload)
    for (const from of INQUIRY_STATUSES) {
      for (const to of INQUIRY_STATUSES) {
        await db.execute(sql`UPDATE inquiries SET status = ${from} WHERE id = ${doc.id}`)
        const before = (await reread(doc.id))!
        const res = await post(doc.id, 'status', { status: to })
        const after = (await reread(doc.id))!
        const label = `${from} → ${to}`
        if (from === to) {
          expect(res.status, label).toBe(200)
          expect(res.json.unchanged, label).toBe(true)
        } else if (canTransitionInquiry(from, to)) {
          expect(res.status, label).toBe(200)
          expect(after.status, label).toBe(to)
          expect(after.deleteAfter, label).toBe(before.deleteAfter)
          expect(Date.parse(after.lastActivityAt), label).toBeGreaterThan(
            Date.parse('2026-09-01T10:00:00.000Z'),
          )
        } else {
          expect(res.status, label).toBe(409)
          expect(after.status, label).toBe(from)
        }
      }
    }
    // Tabelle wie KONZEPT §5.5
    expect(INQUIRY_TRANSITIONS.new).toEqual(['in_progress', 'offer_sent', 'declined', 'closed'])
    expect(INQUIRY_TRANSITIONS.closed).toEqual(['in_progress'])
    const allowed = INQUIRY_STATUSES.flatMap((f) =>
      INQUIRY_TRANSITIONS[f as InquiryStatus].map((t) => `${f}→${t}`),
    )
    const audit = await payload.find({
      collection: 'audit-log',
      where: {
        and: [
          { action: { equals: 'inquiry_status_changed' } },
          { entityId: { equals: String(doc.id) } },
        ],
      },
      pagination: false,
      overrideAccess: true,
    })
    expect(audit.docs).toHaveLength(allowed.length)
    expect(audit.docs.every((d) => d.actorType === 'admin')).toBe(true)
    // anonym kein Zugriff; Status direkt (ohne Übergang) abgelehnt
    expect((await post(doc.id, 'status', { status: 'in_progress' }, false)).status).toBe(403)
    expect((await post(doc.id, 'status', { status: 'unbekannt' })).status).toBe(400)
  })

  it('Notiz setzt lastActivityAt, nicht deleteAfter (L-10)', async () => {
    const doc = await inquiry()
    const res = await post(doc.id, 'notes', { adminNotes: 'Rückfrage zur Größe gestellt.' })
    expect(res.status).toBe(200)
    const after = (await reread(doc.id))!
    expect(after.adminNotes).toBe('Rückfrage zur Größe gestellt.')
    expect(after.deleteAfter).toBe(doc.deleteAfter)
    expect(after.lastActivityAt).not.toBe(doc.lastActivityAt)
  })

  it('„Antworten“: mailto mit Betreff nach Sprache der Anfrage', () => {
    expect(inquiryReplyHref('erika@example.com', 'AA-2026-0007', 'de')).toBe(
      'mailto:erika@example.com?subject=Deine%20Anfrage%20AA-2026-0007',
    )
    expect(inquiryReplyHref('a@example.com', 'AA-2026-0007', 'en')).toBe(
      'mailto:a@example.com?subject=Your%20request%20AA-2026-0007',
    )
  })

  it('AK-10-04 Referenzbild ohne Anmeldung nicht abrufbar; „Jetzt löschen“ entfernt Datensatz und Dateien (Speicher leer)', async () => {
    const image = await referenceImage()
    const doc = await inquiry({ referenceImages: [image.id] })
    const files = [image.filename!, image.sizes?.thumb?.filename].filter(Boolean) as string[]
    expect(files.length).toBeGreaterThanOrEqual(1)
    for (const name of files) {
      expect([401, 403]).toContain((await rest('GET', `/private-uploads/file/${name}`)).status)
      expect(existsSync(path.join(uploadStaticDir('private'), name))).toBe(true)
    }
    const ok = await rest('GET', `/private-uploads/file/${image.filename}`, undefined, auth())
    expect(ok.status).toBe(200)

    // falsche Referenz → nichts passiert
    expect((await post(doc.id, 'delete-now', { reference: 'AA-2026-0000' })).status).toBe(400)
    expect((await post(doc.id, 'delete-now', { reference: doc.reference }, false)).status).toBe(403)
    expect(await reread(doc.id)).not.toBeNull()

    const res = await post(doc.id, 'delete-now', { reference: doc.reference })
    expect(res.status).toBe(200)
    expect(await reread(doc.id)).toBeNull()
    expect(
      await payload.findByID({
        collection: 'private-uploads',
        id: image.id,
        overrideAccess: true,
        disableErrors: true,
      }),
    ).toBeNull()
    for (const name of files) {
      expect(existsSync(path.join(uploadStaticDir('private'), name)), name).toBe(false)
    }
    const audit = await payload.find({
      collection: 'audit-log',
      where: {
        and: [{ action: { equals: 'inquiry_deleted' } }, { entityId: { equals: String(doc.id) } }],
      },
      overrideAccess: true,
    })
    expect(audit.docs).toHaveLength(1)
    expect(audit.docs[0]!.summary).toContain(doc.reference)
    expect(JSON.stringify(audit.docs[0])).not.toMatch(/Erika|erika@example|Tasse mit meinem Hund/)
    const logs = await payload.find({
      collection: 'deletion-log',
      where: {
        and: [
          { entityCollection: { equals: 'inquiries' } },
          { entityId: { equals: String(doc.id) } },
        ],
      },
      overrideAccess: true,
    })
    expect(logs.docs).toHaveLength(1)
    expect(logs.docs[0]).toMatchObject({
      ruleId: 'ADMIN',
      trigger: 'admin',
      action: 'deleted',
      storageObjectsCount: files.length,
    })
  })
})
