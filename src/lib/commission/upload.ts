import 'server-only'

import { randomBytes } from 'node:crypto'

import type { Payload } from 'payload'
import sharp from 'sharp'

import de from '@/i18n/messages/de.json'
import en from '@/i18n/messages/en.json'
import type { Locale } from '@/lib/enums'
import { createLogger } from '@/lib/monitoring/logger'
import { ipHash } from '@/lib/security/ipHash'
import { clientIp, hit, retryAfterSeconds } from '@/lib/security/rateLimit'

import { uploadTicket, verifyCommissionFormToken } from './formToken'

// `POST /api/uploads/commission` (ARCHITEKTUR §2.5, §8.8, KONZEPT §10.2/§10.3, PLAN P7.11): ein Referenzbild je Anfrage
// (multipart: `token` = Formular-Token, `file` = Bild). Reihenfolge der Prüfungen:
// 1. Formular-Token gültig (signiert, ≤ 2 h) → sonst 403.
// 2. Rate-Limit `commission_upload` 15/h je IP-Hash → 429 mit `Retry-After`.
// 3. Körper > 4,5 MB (Hosting-Grenze) → 413 mit Text (zuerst `Content-Length`, dann beim Lesen gezählt).
// 4. Typ am Inhalt (`sharp(buf).metadata().format`: JPEG/PNG/WebP) → sonst 415 (z. B. umbenanntes PDF).
// 5. Höchstens 5 Uploads je Formular-Nonce → 6. = 409.
// 6. Ablage als `private-uploads` (`purpose = commission_reference`, `status = pending`, `deleteAfter = jetzt + 24 h`
//    über die Fristregel L-13 f); der Collection-Hook kodiert neu (Orientierung angewendet, ≤ 2560 px, ohne EXIF/GPS/
//    XMP/IPTC, R-135). Antwort `{ uploadId, ticket }`; keine öffentliche URL (Abruf nur angemeldet, R-136).
// Antworten `Cache-Control: no-store`, nie ein Cookie, keine Personendaten im Log (R-137).

const log = createLogger()

/** Hosting-Grenze je Anfrage (Vercel 4,5 MB, ARCHITEKTUR §8.8). */
export const COMMISSION_UPLOAD_MAX_BYTES = 4.5 * 1024 * 1024
const ALLOWED_FORMATS = new Set(['jpeg', 'png', 'webp'])
const FORMAT_MIME: Record<string, string> = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
}

const NO_STORE = { 'cache-control': 'no-store' } as const

export type CommissionUploadError =
  'token' | 'rate_limited' | 'too_large' | 'type' | 'too_many' | 'invalid' | 'failed'

const MESSAGES = { de: de.commission.upload, en: en.commission.upload } as const

function json(body: unknown, status: number, headers: Record<string, string> = {}): Response {
  return Response.json(body, { status, headers: { ...NO_STORE, ...headers } })
}

function error(
  code: CommissionUploadError,
  status: number,
  locale: Locale,
  headers: Record<string, string> = {},
): Response {
  return json({ error: code, message: MESSAGES[locale][code] }, status, headers)
}

class BodyTooLarge extends Error {}

/** Liest den Körper höchstens bis `max` Bytes; darüber `BodyTooLarge`. */
async function readCapped(request: Request, max: number): Promise<Buffer> {
  if (!request.body) return Buffer.alloc(0)
  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > max) {
      await reader.cancel().catch(() => undefined)
      throw new BodyTooLarge()
    }
    chunks.push(value)
  }
  return Buffer.concat(chunks)
}

const localeOf = (request: Request): Locale =>
  new URL(request.url).searchParams.get('locale') === 'en' ? 'en' : 'de'

export async function handleCommissionUpload(
  request: Request,
  payload: Payload,
  now: Date,
): Promise<Response> {
  const locale = localeOf(request)
  // 1. Formular-Token: kommt als Kopfzeile, damit es vor dem Lesen des Körpers geprüft werden kann
  const token = verifyCommissionFormToken(request.headers.get('x-form-token'), now)
  if (!token) return error('token', 403, locale)

  // 2. Rate-Limit je IP-Hash
  const ip = clientIp(request.headers) ?? 'unknown'
  const limit = await hit('commission_upload', ipHash(ip, { now: () => now }), now, payload)
  if (!limit.allowed) {
    return error('rate_limited', 429, locale, {
      'retry-after': String(retryAfterSeconds(limit, now)),
    })
  }

  // 3. Größe
  const declared = Number(request.headers.get('content-length') ?? '')
  if (Number.isFinite(declared) && declared > COMMISSION_UPLOAD_MAX_BYTES) {
    return error('too_large', 413, locale)
  }
  let file: File | null = null
  try {
    const body = await readCapped(request, COMMISSION_UPLOAD_MAX_BYTES)
    const form = await new Response(new Uint8Array(body), {
      headers: { 'content-type': request.headers.get('content-type') ?? '' },
    }).formData()
    const value = form.get('file')
    file = value instanceof File ? value : null
  } catch (e) {
    if (e instanceof BodyTooLarge) return error('too_large', 413, locale)
    return error('invalid', 400, locale)
  }
  if (!file || file.size === 0) return error('invalid', 400, locale)
  const bytes = Buffer.from(await file.arrayBuffer())

  // 4. Typ am Inhalt
  let format: string | undefined
  try {
    format = (await sharp(bytes, { failOn: 'error' }).metadata()).format
  } catch {
    format = undefined
  }
  if (!format || !ALLOWED_FORMATS.has(format)) return error('type', 415, locale)

  // 5. Höchstens 5 Uploads je Formular (Fenster am `iat` des Tokens ausgerichtet)
  const perForm = await hit('commission_form_uploads', token.nonce, new Date(token.iat), payload)
  if (!perForm.allowed) return error('too_many', 409, locale)

  // 6. Ablage (Neukodierung im Collection-Hook)
  try {
    const doc = await payload.create({
      collection: 'private-uploads',
      data: {
        purpose: 'commission_reference',
        status: 'pending',
        createdAt: now.toISOString(),
      } as never,
      file: {
        data: bytes,
        // Eindeutiger Name je Upload: Payload macht gleiche Namen nur per Abfrage eindeutig („anfrage-1.jpg“) – bei
        // gleichzeitigen Uploads verletzte das den UNIQUE-Index auf `filename` (500, Bild verloren).
        name: `anfrage-${randomBytes(8).toString('hex')}.${format === 'jpeg' ? 'jpg' : format}`,
        mimetype: FORMAT_MIME[format]!,
        size: bytes.length,
      },
      depth: 0,
      overrideAccess: true,
      context: { system: true, now: now.toISOString() },
    })
    log.info('commission.upload_stored', { uploadId: doc.id })
    return json({ uploadId: doc.id, ticket: uploadTicket(doc.id, token.nonce) }, 201)
  } catch (e) {
    log.error('commission.upload_failed', { reason: (e as Error)?.message })
    return error('failed', 500, locale)
  }
}
