import { randomBytes } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

import exifr from 'exifr'
import type { Payload } from 'payload'
import sharp from 'sharp'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import {
  createCommissionFormToken,
  uploadTicket,
  verifyCommissionFormToken,
} from '@/lib/commission/formToken'
import { COMMISSION_UPLOAD_MAX_BYTES, handleCommissionUpload } from '@/lib/commission/upload'
import { uploadStaticDir } from '@/lib/storage'
import type { PrivateUpload } from '@/payload-types'

import { getTestPayload } from '../helpers/payload'
import { rest } from '../helpers/rest'

// P7.11 – `POST /api/uploads/commission` (ARCHITEKTUR §2.5, §8.8, KONZEPT §10.2/§10.3): Formular-Token Pflicht,
// Rate-Limit 15/h je IP-Hash, > 4,5 MB → 413, Typ am Inhalt (sonst 415), Neukodierung ohne EXIF/GPS (R-135), privat
// abgelegt als `pending` mit Löschung nach 24 h, höchstens 5 Uploads je Formular-Nonce.

const FIXTURES = path.resolve('tests/fixtures/images')
const NOW = new Date('2026-10-02T10:00:00.000Z')
const HOUR = 3_600_000
const PDF = Buffer.from(
  '%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\nxref\n0 2\n0000000000 65535 f \n0000000009 00000 n \ntrailer<</Size 2/Root 1 0 R>>\nstartxref\n40\n%%EOF\n',
)

let payload: Payload
let tinyPng: Buffer
const created: number[] = []

/** Eigene Test-IP je Lauf (Rate-Limit-Zähler überleben bis zur nächsten Rücksetzung der Test-DB). */
const freshIp = () => `2001:db8::${randomBytes(4).toString('hex')}`

function uploadRequest(opts: {
  token?: string | null
  ip: string
  file?: Buffer
  name?: string
  type?: string
  headers?: Record<string, string>
}): Request {
  const form = new FormData()
  if (opts.file) {
    form.append(
      'file',
      new Blob([new Uint8Array(opts.file)], { type: opts.type ?? 'image/jpeg' }),
      opts.name ?? 'bild.jpg',
    )
  }
  return new Request('http://localhost:3000/api/uploads/commission?locale=de', {
    method: 'POST',
    headers: {
      'x-forwarded-for': opts.ip,
      ...(opts.token ? { 'x-form-token': opts.token } : {}),
      ...opts.headers,
    },
    body: form,
  })
}

async function upload(opts: Parameters<typeof uploadRequest>[0], now = NOW) {
  const res = await handleCommissionUpload(uploadRequest(opts), payload, now)
  const body = (await res.json()) as Record<string, unknown>
  if (res.status === 201) created.push(body.uploadId as number)
  return { res, body }
}

beforeAll(async () => {
  payload = await getTestPayload()
  tinyPng = await sharp({ create: { width: 6, height: 4, channels: 3, background: '#c33' } })
    .png()
    .toBuffer()
})

afterAll(async () => {
  for (const id of created) {
    await payload
      .delete({
        collection: 'private-uploads',
        id,
        overrideAccess: true,
        context: { system: true },
      })
      .catch(() => undefined)
  }
})

describe('POST /api/uploads/commission (P7.11)', () => {
  it('R-135 T-05 GPS-Fixture → gespeicherte Datei ohne EXIF/GPS, richtig gedreht; pending mit Löschung nach 24 h', async () => {
    const img = await readFile(path.join(FIXTURES, 'gps-orientation-6.jpg'))
    expect((await exifr.gps(img))?.latitude).toBeGreaterThan(52)
    const token = createCommissionFormToken(NOW)
    const { res, body } = await upload({ token, ip: freshIp(), file: img, name: 'urlaub.jpg' })
    expect(res.status).toBe(201)
    expect(res.headers.get('cache-control')).toBe('no-store')
    expect(res.headers.get('set-cookie')).toBeNull()
    expect(Object.keys(body).sort()).toEqual(['ticket', 'uploadId'])
    const nonce = verifyCommissionFormToken(token, NOW)!.nonce
    expect(body.ticket).toBe(uploadTicket(body.uploadId as number, nonce))

    const doc = (await payload.findByID({
      collection: 'private-uploads',
      id: body.uploadId as number,
      overrideAccess: true,
      depth: 0,
    })) as PrivateUpload
    expect(doc.purpose).toBe('commission_reference')
    expect(doc.status).toBe('pending')
    expect(new Date(doc.deleteAfter!).getTime()).toBe(NOW.getTime() + 24 * HOUR)
    expect(doc.mimeType).toBe('image/jpeg')

    const stored = await readFile(path.join(uploadStaticDir('private'), doc.filename!))
    const meta = await sharp(stored).metadata()
    expect(meta.exif).toBeUndefined()
    expect(meta.xmp).toBeUndefined()
    expect(meta.iptc).toBeUndefined()
    expect(meta.orientation ?? 1).toBe(1)
    expect(await exifr.gps(stored).catch(() => undefined)).toBeUndefined()
    const original = await sharp(img).metadata()
    // Orientation 6: Hochformat-Pixel werden als Querformat gespeichert (gedreht)
    expect(original.orientation).toBe(6)
    expect((meta.width ?? 0) > (meta.height ?? 0)).toBe(
      (original.height ?? 0) > (original.width ?? 0),
    )
  })

  it('AK-10-04 Datei ohne Admin-Anmeldung nicht abrufbar; Antwort ohne URL', async () => {
    const token = createCommissionFormToken(NOW)
    const { res, body } = await upload({ token, ip: freshIp(), file: tinyPng, type: 'image/png' })
    expect(res.status).toBe(201)
    expect(JSON.stringify(body)).not.toMatch(/url|filename|\//i)
    const doc = (await payload.findByID({
      collection: 'private-uploads',
      id: body.uploadId as number,
      overrideAccess: true,
      depth: 0,
    })) as PrivateUpload
    for (const name of [doc.filename, doc.sizes?.thumb?.filename].filter(Boolean)) {
      expect([401, 403], name!).toContain(
        (await rest('GET', `/private-uploads/file/${name}`)).status,
      )
    }
    expect([401, 403]).toContain((await rest('GET', `/private-uploads/${doc.id}`)).status)
  })

  it('Formular-Token Pflicht: fehlt, manipuliert oder älter als 2 h → 403', async () => {
    const ip = freshIp()
    expect((await upload({ token: null, ip, file: tinyPng })).res.status).toBe(403)
    const token = createCommissionFormToken(NOW)
    expect((await upload({ token: `${token}x`, ip, file: tinyPng })).res.status).toBe(403)
    const late = new Date(NOW.getTime() + 2 * HOUR + 60_000)
    expect((await upload({ token, ip, file: tinyPng }, late)).res.status).toBe(403)
  })

  it('umbenanntes PDF → 415 mit Text; 5 MB → 413 mit Text', async () => {
    const ip = freshIp()
    const token = createCommissionFormToken(NOW)
    const pdf = await upload({ token, ip, file: PDF, name: 'foto.jpg', type: 'image/jpeg' })
    expect(pdf.res.status).toBe(415)
    expect(pdf.body.message).toMatch(/JPEG, PNG oder WebP/)

    const big = Buffer.alloc(5 * 1024 * 1024, 1)
    expect(big.length).toBeGreaterThan(COMMISSION_UPLOAD_MAX_BYTES)
    // ohne Content-Length (gestreamt) …
    const streamed = await upload({ token, ip, file: big })
    expect(streamed.res.status).toBe(413)
    expect(streamed.body.message).toMatch(/zu groß/)
    // … und mit angekündigter Länge (vor dem Lesen abgelehnt)
    const declared = await upload({
      token,
      ip,
      file: tinyPng,
      headers: { 'content-length': String(big.length) },
    })
    expect(declared.res.status).toBe(413)
  })

  it('16. Upload je Stunde vom selben IP-Hash → 429 mit Retry-After', async () => {
    const ip = freshIp()
    for (let i = 0; i < 15; i++) {
      const token = createCommissionFormToken(NOW)
      expect((await upload({ token, ip, file: PDF, type: 'application/pdf' })).res.status).toBe(415)
    }
    const token = createCommissionFormToken(NOW)
    const { res, body } = await upload({ token, ip, file: tinyPng, type: 'image/png' })
    expect(res.status).toBe(429)
    expect(Number(res.headers.get('retry-after'))).toBeGreaterThan(0)
    expect(body.message).toMatch(/später/)
  })

  it('6. Upload je Formular → 409', async () => {
    const ip = freshIp()
    const token = createCommissionFormToken(NOW)
    for (let i = 0; i < 5; i++) {
      expect((await upload({ token, ip, file: tinyPng, type: 'image/png' })).res.status).toBe(201)
    }
    const sixth = await upload({ token, ip, file: tinyPng, type: 'image/png' })
    expect(sixth.res.status).toBe(409)
    // ein neues Formular darf wieder hochladen
    const other = createCommissionFormToken(NOW)
    expect((await upload({ token: other, ip, file: tinyPng, type: 'image/png' })).res.status).toBe(
      201,
    )
  })
})
