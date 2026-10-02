import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

import type { Payload, PayloadRequest } from 'payload'
import sharp from 'sharp'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { getEnv } from '@/lib/env'
import { runRetentionTask } from '@/lib/retention/jobs'
import { fileResponseHandler } from '@/lib/storage'
import { readStoredFile } from '@/lib/storage/read'
import { withdrawGalleryConsent } from '@/lib/tattoo/admin'
import type { Media, PrivateUpload, TattooGallery } from '@/payload-types'

import { adminReq, resetAdmin } from '../helpers/admin'
import { getTestPayload } from '../helpers/payload'
import { rest } from '../helpers/rest'

// P7.8 – Galerie-Einwilligung widerrufen (DATENMODELL §6.16, R-172, R-152, R-154, L-19 b, L-20, LOESCHKONZEPT §5.10):
// `POST /api/tattoo-gallery/:id/withdraw-consent` nimmt das Foto sofort offline (Bild-URL 404), sperrt die Bilder,
// schreibt Audit `gallery_consent_withdrawn`; nach 24 h sind die Bilddateien gelöscht, der Nachweis bleibt 3 Jahre.
// Bestätigung M16 (Variante Portfolio) nur an eine eingetippte Adresse.

const IMAGE = path.resolve('tests/fixtures/images/landscape-small.jpg')
const HOUR = 3_600_000
const NOW = '2026-10-20T10:00:00.000Z'

let payload: Payload
let token: string
let userId: number
const galleryIds: number[] = []
const mediaIds: number[] = []
const uploadIds: number[] = []

async function customerPhoto(alt: string): Promise<Media> {
  const buf = await readFile(IMAGE)
  const doc = await payload.create({
    collection: 'media',
    data: { alt, showsPerson: 'customer' } as never,
    file: {
      data: buf,
      name: `widerruf-${randomUUID().slice(0, 8)}.jpg`,
      mimetype: 'image/jpeg',
      size: buf.length,
    },
    overrideAccess: true,
  })
  mediaIds.push(doc.id as number)
  return doc as Media
}

async function evidence(): Promise<PrivateUpload> {
  const png = await sharp({ create: { width: 32, height: 32, channels: 3, background: '#335577' } })
    .png()
    .toBuffer()
  const doc = await payload.create({
    collection: 'private-uploads',
    data: { purpose: 'consent_evidence' } as never,
    file: { data: png, name: 'dm-screenshot.png', mimetype: 'image/png', size: png.length },
    overrideAccess: true,
    context: { system: true },
  })
  uploadIds.push(doc.id as number)
  return doc as PrivateUpload
}

/** Veröffentlichtes Foto mit Einwilligung und Nachweis. */
async function publishedEntry(): Promise<{
  entry: TattooGallery
  media: Media
  proof: PrivateUpload
}> {
  const media = await customerPhoto('Fine-Line-Blume am Unterarm')
  const proof = await evidence()
  const entry = (await payload.create({
    collection: 'tattoo-gallery',
    data: {
      image: media.id,
      kind: 'fresh',
      showsCustomer: true,
      consentGiven: true,
      consentDate: '2026-10-01T12:00:00.000Z',
      consentNote: 'per DM am 01.10.2026',
      consentEvidence: proof.id,
      published: true,
    } as never,
    overrideAccess: true,
    context: { now: NOW },
  })) as TattooGallery
  galleryIds.push(entry.id)
  await payload.update({
    collection: 'private-uploads',
    id: proof.id,
    data: { relatedGalleryItem: entry.id } as never,
    overrideAccess: true,
    context: { system: true },
  })
  return { entry, media, proof }
}

async function serve(media: Media): Promise<number | undefined> {
  const handler = fileResponseHandler('media', getEnv())
  const req = { payload, user: null, headers: new Headers() } as unknown as PayloadRequest
  const res = (await handler(req, {
    doc: undefined as never,
    headers: new Headers(),
    params: { collection: 'media', filename: media.filename! },
  })) as Response | undefined
  return res?.status
}

const mailsTo = async (to: string) =>
  (
    await payload.find({
      collection: 'email-log',
      where: {
        and: [{ template: { equals: 'consent_withdrawal_confirmation' } }, { to: { equals: to } }],
      },
      overrideAccess: true,
      limit: 10,
    })
  ).docs

beforeAll(async () => {
  payload = await getTestPayload()
  ;({ token, userId } = await resetAdmin(payload))
})

afterAll(async () => {
  for (const id of galleryIds) {
    await payload
      .delete({ collection: 'tattoo-gallery', id, overrideAccess: true, context: { seed: true } })
      .catch(() => null)
  }
  for (const id of uploadIds) {
    await payload
      .delete({
        collection: 'private-uploads',
        id,
        overrideAccess: true,
        context: { system: true },
      })
      .catch(() => null)
  }
  for (const id of mediaIds) {
    await payload.delete({ collection: 'media', id, overrideAccess: true }).catch(() => null)
  }
})

describe('Galerie: Einwilligung widerrufen (P7.8)', () => {
  it('DM-GAL-01 published = true ohne Einwilligung bei showsCustomer wird abgelehnt (Text der Verwaltung)', async () => {
    const media = await customerPhoto('Frisches Tattoo an der Wade')
    const res = await rest(
      'POST',
      '/tattoo-gallery?locale=de&depth=0',
      { image: media.id, kind: 'fresh', showsCustomer: true, published: true },
      { authorization: `JWT ${token}` },
    )
    expect(res.status).toBe(400)
    expect(JSON.stringify(await res.json())).toContain(
      'Ohne Einwilligung der Kundin/des Kunden nicht veröffentlichen',
    )
  })

  it('R-172 Widerruf: sofort offline, Bild-URL 404, Audit; zweiter Aufruf ändert nichts', async () => {
    const { entry, media } = await publishedEntry()
    expect(await serve(media)).toBe(200)

    const res = await rest(
      'POST',
      `/tattoo-gallery/${entry.id}/withdraw-consent`,
      {},
      { authorization: `JWT ${token}` },
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      doc: TattooGallery
      mailQueued: boolean
      unchanged: boolean
    }
    expect(body.doc).toMatchObject({ consentGiven: false, published: false })
    expect(body.doc.consentWithdrawnAt).toBeTruthy()
    expect(body.mailQueued).toBe(false)
    // Bild sofort nicht mehr auslieferbar und gesperrt
    expect(await serve(media)).toBe(404)
    const m = await payload.findByID({ collection: 'media', id: media.id, overrideAccess: true })
    expect(m.restricted).toBe(true)
    // nicht in öffentlichen Abfragen
    const pub = await rest('GET', `/tattoo-gallery/${entry.id}`)
    expect([403, 404]).toContain(pub.status)
    const audit = await payload.find({
      collection: 'audit-log',
      where: {
        and: [
          { action: { equals: 'gallery_consent_withdrawn' } },
          { entityId: { equals: String(entry.id) } },
        ],
      },
      overrideAccess: true,
    })
    expect(audit.totalDocs).toBe(1)
    // Feld nur über die Aktion setzbar; zweiter Aufruf: nichts geändert
    const again = await rest(
      'POST',
      `/tattoo-gallery/${entry.id}/withdraw-consent`,
      {},
      { authorization: `JWT ${token}` },
    )
    expect(((await again.json()) as { unchanged: boolean }).unchanged).toBe(true)
    expect((await rest('POST', `/tattoo-gallery/${entry.id}/withdraw-consent`, {})).status).toBe(
      403,
    )
  })

  it('R-154 L-20 nach 24 h sind die Bilddateien gelöscht; der Nachweis bleibt bis zur Frist (L-19 b, 3 Jahre)', async () => {
    const { entry, media, proof } = await publishedEntry()
    const req = await adminReq(payload, userId)
    req.context = { now: NOW }
    await withdrawGalleryConsent(req, entry.id)
    const original = () => readStoredFile('media', media.filename ?? '', media.prefix)
    expect(await original()).not.toBeNull()

    const withdrawn = new Date(NOW)
    await runRetentionTask(payload, 'retentionConsentEvidence', {
      now: new Date(withdrawn.getTime() + 23 * HOUR),
    })
    expect(await original()).not.toBeNull()
    await runRetentionTask(payload, 'retentionConsentEvidence', {
      now: new Date(withdrawn.getTime() + 25 * HOUR),
    })
    expect(await original()).toBeNull()

    // Nachweis: Frist 3 Jahre ab Widerruf, Datei noch da
    const kept = (await payload.findByID({
      collection: 'private-uploads',
      id: proof.id,
      overrideAccess: true,
    })) as PrivateUpload
    expect(kept.deleteAfter?.slice(0, 10)).toBe('2029-10-20')
    expect(await readStoredFile('private', kept.filename ?? '', kept.prefix)).not.toBeNull()
    // Eintrag bleibt (Nachweis des Widerrufs)
    const still = await payload.findByID({
      collection: 'tattoo-gallery',
      id: entry.id,
      overrideAccess: true,
    })
    expect(still.consentWithdrawnAt).toBe(NOW)
  })

  it('R-152 Galerie-Widerruf: mit eingetippter Adresse genau eine M16 (Portfolio), ohne Adresse keine', async () => {
    const to = `widerruf-${randomUUID().slice(0, 6)}@example.com`
    const withMail = await publishedEntry()
    const res = await rest(
      'POST',
      `/tattoo-gallery/${withMail.entry.id}/withdraw-consent`,
      { email: to, locale: 'en' },
      { authorization: `JWT ${token}` },
    )
    expect(res.status).toBe(200)
    expect(((await res.json()) as { mailQueued: boolean }).mailQueued).toBe(true)
    const mails = await mailsTo(to)
    expect(mails).toHaveLength(1)
    expect(mails[0]).toMatchObject({ locale: 'en' })
    // Galerie-Eintrag speichert keine Adresse
    const raw = await payload.findByID({
      collection: 'tattoo-gallery',
      id: withMail.entry.id,
      overrideAccess: true,
    })
    expect(JSON.stringify(raw)).not.toContain(to)

    const withoutMail = await publishedEntry()
    const before = await payload.count({
      collection: 'email-log',
      where: { template: { equals: 'consent_withdrawal_confirmation' } },
      overrideAccess: true,
    })
    await rest(
      'POST',
      `/tattoo-gallery/${withoutMail.entry.id}/withdraw-consent`,
      { email: '' },
      { authorization: `JWT ${token}` },
    )
    const after = await payload.count({
      collection: 'email-log',
      where: { template: { equals: 'consent_withdrawal_confirmation' } },
      overrideAccess: true,
    })
    expect(after.totalDocs).toBe(before.totalDocs)
    // ungültige Adresse → Ablehnung ohne Wirkung
    const third = await publishedEntry()
    const bad = await rest(
      'POST',
      `/tattoo-gallery/${third.entry.id}/withdraw-consent`,
      { email: 'kein-at-zeichen' },
      { authorization: `JWT ${token}` },
    )
    expect(bad.status).toBe(400)
    const unchanged = await payload.findByID({
      collection: 'tattoo-gallery',
      id: third.entry.id,
      overrideAccess: true,
    })
    expect(unchanged.published).toBe(true)
  })
})
