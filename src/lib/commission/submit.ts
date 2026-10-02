import 'server-only'

import config from '@payload-config'
import { sql } from '@payloadcms/db-postgres'
import { createLocalReq, getPayload, type Payload } from 'payload'
import { z } from 'zod'

import { INQUIRY_MAX_IMAGES } from '@/collections/Inquiries'
import { dbFor } from '@/lib/db/tx'
import { notifyAdmin } from '@/lib/email/notifyAdmin'
import { enqueueEmail, runEmailJobNow } from '@/lib/email/outbox'
import { INQUIRY_OBJECT_TYPES, LOCALES, type Locale } from '@/lib/enums'
import { createLogger } from '@/lib/monitoring/logger'
import { preservingReq } from '@/lib/payload/localReq'
import { inTransaction } from '@/lib/payload/transaction'
import { ipHash } from '@/lib/security/ipHash'
import { hashRateLimitKey, hit, retryAfterSeconds, windowStart } from '@/lib/security/rateLimit'
import type { Inquiry, PrivateUpload } from '@/payload-types'

import {
  submittedTooFast,
  verifyCommissionFormToken,
  verifyUploadTicket,
  type CommissionFormToken,
} from './formToken'

// Dienst „Anfrage absenden“ (PLAN P7.12, KONZEPT §10, R-160, R-134, R-137, DATENMODELL §6.17, LOESCHKONZEPT L-10):
// 1. Honeypot `website` gefüllt → Schein-Erfolg (nichts gespeichert, keine Mail, kein Zähler).
// 2. Formular-Token prüfen (signiert, ≤ 2 h; sonst „abgelaufen“, Eingaben bleiben stehen); jünger als 3 s →
//    Schein-Erfolg (Zeitfalle).
// 3. Rate-Limit `commission_submit` 5/h und `commission_submit_day` 20/Tag je IP-Hash → 429.
// 4. zod mit den Grenzen aus DATENMODELL §6.17.
// 5. In **einer** Transaktion: Anfrage (`AA-JJJJ-NNNN` aus `inquiry_number_seq`, Status `new`, `privacyNoticeVersion`,
//    `lastActivityAt`, `deleteAfter` = Eingang + 6 Monate – setzt der Collection-Hook), Uploads mit gültigem Ticket
//    anhängen (`attached`, `relatedInquiry`, gleiche Frist über die Fristregel L-10), M11 und A05 in die Outbox; dazu
//    eine Einmal-Marke je Formular-Nonce (doppeltes Absenden → kein zweiter Datensatz).
// 6. Nach dem Commit M11, dann A05 sofort ausführen (Fehler holt der Outbox-Job nach).
// Keine Personendaten in Logs (nur IDs/Referenz, R-137); IP nur als täglich wechselnder Hash im Rate-Limit.

const log = createLogger()

/** Name des unsichtbaren Honeypot-Felds (KONZEPT §10.2, R-134). */
export const COMMISSION_HONEYPOT_FIELD = 'website'
/** Feld mit den hochgeladenen Bildern: je Bild `<uploadId>.<ticket>`. */
export const COMMISSION_IMAGES_FIELD = 'images'
/** Einmal-Marke je Formular (eigene Zeile in `rate_limit_hits`, nach 24 h gelöscht). */
const FORM_DONE_BUCKET = 'commission_form_submit'
const HOUR = 60 * 60 * 1000

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => (v ? v : null))

export const commissionInputSchema = z
  .object({
    name: z.string().trim().min(2).max(100),
    email: z.string().trim().max(254).pipe(z.email()),
    objectType: z.enum(INQUIRY_OBJECT_TYPES),
    objectTypeOther: optionalText(80),
    idea: z.string().trim().min(20).max(3000),
    desiredTimeframe: optionalText(120),
    budget: optionalText(60),
    locale: z.enum(LOCALES),
  })
  .superRefine((v, ctx) => {
    if (v.objectType === 'sonstiges' && (v.objectTypeOther ?? '').length < 2) {
      ctx.addIssue({ code: 'custom', path: ['objectTypeOther'], message: 'required' })
    }
  })
  .transform((v) => ({
    ...v,
    objectTypeOther: v.objectType === 'sonstiges' ? v.objectTypeOther : null,
  }))
export type CommissionInput = z.input<typeof commissionInputSchema>

export const COMMISSION_FIELDS = [
  'name',
  'email',
  'objectType',
  'objectTypeOther',
  'idea',
  'desiredTimeframe',
  'budget',
] as const
export type CommissionField = (typeof COMMISSION_FIELDS)[number]
/** `required` = leer gelassen, `invalid` = Grenze/Format verletzt. */
export type CommissionFieldErrors = Partial<Record<CommissionField, 'required' | 'invalid'>>

export type SubmitCommissionResult =
  | { ok: true; status: 200; spam: true }
  | {
      ok: true
      status: 201
      spam: false
      inquiryId: number | null
      reference: string | null
      imageCount: number
      duplicate: boolean
    }
  | { ok: false; status: 400; code: 'expired' }
  | { ok: false; status: 400; code: 'invalid'; errors: CommissionFieldErrors }
  | { ok: false; status: 429; code: 'rate_limited'; retryAfterSeconds: number }

export interface SubmitCommissionOptions {
  now: Date
  /** Client-IP nur für den Rate-Limit-Schlüssel (täglich wechselnder Hash, nie am Datensatz). */
  ip?: string | null
  payload?: Payload
}

const isFilled = (v: unknown) => typeof v === 'string' && v.trim() !== ''

function rawOf(input: unknown): Record<string, unknown> {
  if (typeof FormData !== 'undefined' && input instanceof FormData) {
    const out: Record<string, unknown> = {}
    for (const [k, v] of input.entries()) {
      if (typeof v !== 'string') continue
      if (k === COMMISSION_IMAGES_FIELD) {
        out[k] = [...((out[k] as string[] | undefined) ?? []), v]
      } else out[k] = v
    }
    return out
  }
  return input && typeof input === 'object' ? (input as Record<string, unknown>) : {}
}

export function commissionFieldErrors(
  error: z.ZodError,
  raw: Record<string, unknown>,
): CommissionFieldErrors {
  const out: CommissionFieldErrors = {}
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? 'name') as CommissionField
    if (!(COMMISSION_FIELDS as readonly string[]).includes(key)) continue
    out[key] ??= isFilled(raw[key]) ? 'invalid' : 'required'
  }
  return out
}

/** Bild-Verweise `<id>.<ticket>` mit gültigem Ticket des Formulars (höchstens 5, ohne Doppelte). */
export function validImageIds(value: unknown, token: CommissionFormToken): number[] {
  const list = Array.isArray(value) ? value : typeof value === 'string' ? [value] : []
  const ids: number[] = []
  for (const entry of list.slice(0, 20)) {
    if (typeof entry !== 'string') continue
    const [idText, ticket, rest] = entry.split('.')
    const id = Number(idText)
    if (rest !== undefined || !Number.isSafeInteger(id) || id < 1) continue
    if (!verifyUploadTicket(id, token.nonce, ticket)) continue
    if (!ids.includes(id)) ids.push(id)
    if (ids.length >= INQUIRY_MAX_IMAGES) break
  }
  return ids
}

async function responseTime(payload: Payload, locale: Locale): Promise<string | null> {
  try {
    const texts = (await payload.findGlobal({
      slug: 'site-texts',
      locale,
      fallbackLocale: 'de',
      depth: 0,
      overrideAccess: true,
    })) as { emails?: { inquiryResponseTime?: string | null } | null }
    return texts.emails?.inquiryResponseTime?.trim() || null
  } catch {
    return null
  }
}

/**
 * Anfrage annehmen (siehe Kopf). `input` ist ein Objekt oder `FormData` der Server Action (Felder laut DATENMODELL,
 * dazu `formToken`, `website`, `images`, `locale`); `now` kommt vom Server, nie aus dem Client.
 */
export async function submitCommission(
  input: unknown,
  options: SubmitCommissionOptions,
): Promise<SubmitCommissionResult> {
  const { now } = options
  const raw = rawOf(input)
  if (isFilled(raw[COMMISSION_HONEYPOT_FIELD])) return { ok: true, status: 200, spam: true }

  const token = verifyCommissionFormToken(raw.formToken, now)
  if (!token) return { ok: false, status: 400, code: 'expired' }
  if (submittedTooFast(token, now)) return { ok: true, status: 200, spam: true }

  const payload = options.payload ?? (await getPayload({ config }))
  const ipKey = ipHash(options.ip ?? 'unknown', { now: () => now })
  const [hour, day] = [
    await hit('commission_submit', ipKey, now, payload),
    await hit('commission_submit_day', ipKey, now, payload),
  ]
  const blocked = [hour, day].filter((r) => !r.allowed)
  if (blocked.length > 0) {
    return {
      ok: false,
      status: 429,
      code: 'rate_limited',
      retryAfterSeconds: Math.max(...blocked.map((r) => retryAfterSeconds(r, now))),
    }
  }

  const parsed = commissionInputSchema.safeParse(raw)
  if (!parsed.success) {
    return {
      ok: false,
      status: 400,
      code: 'invalid',
      errors: commissionFieldErrors(parsed.error, raw),
    }
  }
  const value = parsed.data
  const imageIds = validImageIds(raw[COMMISSION_IMAGES_FIELD], token)
  const receivedAt = now.toISOString()
  const reply = await responseTime(payload, value.locale)

  const req = await createLocalReq({ context: { system: true, now: receivedAt } }, payload)
  const nonceKey = hashRateLimitKey(token.nonce)
  const tx = await inTransaction(req, async () => {
    const db = await dbFor(req)
    // Einmal je Formular: paralleles bzw. doppeltes Absenden wartet auf die erste Transaktion und findet ihre Marke
    await db.execute(
      sql`SELECT pg_advisory_xact_lock(hashtext(${`commission-form:${token.nonce}`}))`,
    )
    const done = await db.execute(
      sql`SELECT 1 FROM rate_limit_hits WHERE bucket = ${FORM_DONE_BUCKET} AND key_hash = ${nonceKey} LIMIT 1`,
    )
    if (done.rows.length > 0) return null

    // Nur eigene, noch offene Referenzbilder dieses Formulars
    const uploads: number[] = []
    for (const id of imageIds) {
      const doc = (await preservingReq(req, () =>
        req.payload.findByID({
          collection: 'private-uploads',
          id,
          depth: 0,
          overrideAccess: true,
          disableErrors: true,
          req,
        }),
      )) as PrivateUpload | null
      if (doc && doc.purpose === 'commission_reference' && doc.status === 'pending') {
        uploads.push(doc.id)
      }
    }

    const created = (await preservingReq(req, () =>
      req.payload.create({
        collection: 'inquiries',
        data: {
          name: value.name,
          email: value.email,
          objectType: value.objectType,
          objectTypeOther: value.objectTypeOther,
          idea: value.idea,
          desiredTimeframe: value.desiredTimeframe,
          budget: value.budget,
          locale: value.locale,
          referenceImages: uploads,
        } as never,
        depth: 0,
        overrideAccess: true,
        req,
        context: { ...req.context, system: true, now: receivedAt },
      }),
    )) as Inquiry
    for (const id of uploads) {
      await preservingReq(req, () =>
        req.payload.update({
          collection: 'private-uploads',
          id,
          data: { status: 'attached', relatedInquiry: created.id } as never,
          depth: 0,
          overrideAccess: true,
          req,
          context: { ...req.context, system: true, now: receivedAt },
        }),
      )
    }

    const m11 = await enqueueEmail(req, {
      template: 'inquiry_receipt',
      to: value.email,
      locale: value.locale,
      data: {
        inquiryId: created.id,
        reference: created.reference,
        receivedAt,
        deleteAfter: new Date(created.deleteAfter).toISOString(),
        name: value.name,
        objectType: value.objectType,
        objectTypeOther: value.objectTypeOther,
        idea: value.idea,
        desiredTimeframe: value.desiredTimeframe,
        budget: value.budget,
        imageCount: uploads.length,
        responseTime: reply,
      },
      idempotencyKey: `inquiry_receipt:${created.id}:new`,
      relations: { inquiry: created.id },
    })
    // A05 nur mit Referenz, Gegenstand, Anzahl Bilder und Admin-Link (R-160)
    const a05 = await notifyAdmin(
      req,
      'admin_inquiry_received',
      {
        inquiryId: created.id,
        reference: created.reference,
        objectType: value.objectType,
        imageCount: uploads.length,
      },
      {
        now,
        idempotencyKey: `admin_inquiry_received:${created.id}:new`,
        relations: { inquiry: created.id },
      },
    )
    await db.execute(sql`
      INSERT INTO rate_limit_hits (bucket, key_hash, window_start, count)
      VALUES (${FORM_DONE_BUCKET}, ${nonceKey}, ${windowStart(new Date(token.iat), HOUR).toISOString()}::timestamptz, 1)
      ON CONFLICT (bucket, key_hash, window_start) DO NOTHING`)
    return { inquiry: created, imageCount: uploads.length, jobs: [m11.jobId, a05.jobId] }
  })

  if (!tx) {
    return {
      ok: true,
      status: 201,
      spam: false,
      inquiryId: null,
      reference: null,
      imageCount: 0,
      duplicate: true,
    }
  }
  log.info('commission.inquiry_created', {
    inquiryId: tx.inquiry.id,
    reference: tx.inquiry.reference,
    images: tx.imageCount,
  })
  for (const job of tx.jobs) {
    await runEmailJobNow(payload, job, { now }).catch((e: unknown) =>
      log.error('commission.mail_failed', { error: (e as Error)?.message }),
    )
  }
  return {
    ok: true,
    status: 201,
    spam: false,
    inquiryId: tx.inquiry.id,
    reference: tx.inquiry.reference,
    imageCount: tx.imageCount,
    duplicate: false,
  }
}
