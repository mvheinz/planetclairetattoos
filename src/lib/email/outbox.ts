import 'server-only'

import { sql } from '@payloadcms/db-postgres'
import { createLocalReq, type Payload, type PayloadRequest } from 'payload'

import { dbFor } from '@/lib/db/tx'
import { getEnv } from '@/lib/env'
import type { EmailTemplate, Locale } from '@/lib/enums'
import { jobAlarm } from '@/lib/jobs/alarm'
import { withSystem } from '@/lib/payload/context'
import { preservingReq } from '@/lib/payload/localReq'
import { inTransaction } from '@/lib/payload/transaction'
import { systemClock } from '@/lib/time'

import { getTemplate, templateMeta } from './registry'

// Outbox-Muster (DATENMODELL §1.5, ARCHITEKTUR §3.4, KONZEPT §6.1): `email-log`-Zeile (`queued`) und Job `sendEmail`
// in derselben Transaktion wie das auslösende Ereignis (`req`). Rollt sie zurück, verschwinden beide – keine Mail.
// Derselbe Idempotenz-Schlüssel (Mail-Typ + Objekt-ID + Ereignis) ergibt nie eine zweite Mail (Advisory-Lock je
// Schlüssel, zusätzlich UNIQUE `email_log.idempotency_key`). Die Vorlagen-Daten gehen nur in die Job-Eingabe (nach
// dem Versand löscht Payload den Job); sie enthalten nie Tokens – den Status-Link baut der Job aus dem Siegel.

/** Queue des Tasks `sendEmail` (ARCHITEKTUR Anhang A.3). */
export const EMAIL_QUEUE = 'email'

export interface EmailRelations {
  order?: number | null
  withdrawal?: number | null
  inquiry?: number | null
}

export interface EnqueueEmailInput {
  template: EmailTemplate
  /** Kund:innen-Mails: Pflicht. Verwaltungs-Mails: Standard `settings.adminNotificationEmail` bzw. `ADMIN_NOTIFY_EMAIL`. */
  to?: string
  locale: Locale
  /** Vorlagen-Daten (vom Schema der Vorlage geprüft). */
  data: Record<string, unknown>
  /** `<template>:<Objekt-ID>:<Ereignis>`, z. B. `order_confirmation:17:O1`. */
  idempotencyKey: string
  relations?: EmailRelations
}

export interface EnqueueEmailResult {
  emailLogId: number
  /** `null`, wenn unterdrückt (R-180) oder schon vorhanden. */
  jobId: number | string | null
  status: 'queued' | 'suppressed' | 'duplicate'
}

export class InvalidEmailRequestError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'InvalidEmailRequestError'
  }
}

/** Empfänger der Verwaltungs-Mails: `settings.adminNotificationEmail`, Rückfall `ADMIN_NOTIFY_EMAIL` (KONZEPT §6.4). */
export async function adminRecipient(req: PayloadRequest): Promise<string> {
  const hasSettings = req.payload.config.globals.some((g) => g.slug === 'settings')
  const settings = hasSettings
    ? await preservingReq(req, () =>
        req.payload.findGlobal({ slug: 'settings', depth: 0, overrideAccess: true, req }),
      )
    : null
  return settings?.adminNotificationEmail || getEnv().ADMIN_NOTIFY_EMAIL
}

export async function enqueueEmail(
  req: PayloadRequest,
  input: EnqueueEmailInput,
): Promise<EnqueueEmailResult> {
  const def = getTemplate(input.template)
  const meta = templateMeta(input.template)
  const key = input.idempotencyKey
  if (!key.startsWith(`${input.template}:`) || key.length > 200) {
    throw new InvalidEmailRequestError(
      `Idempotenz-Schlüssel muss mit „${input.template}:“ beginnen (höchstens 200 Zeichen).`,
    )
  }
  const parsed = def.schema.safeParse(input.data)
  if (!parsed.success) {
    throw new InvalidEmailRequestError(
      `Daten für ${input.template} ungültig: ${parsed.error.issues.map((i) => i.path.join('.')).join(', ')}`,
    )
  }
  const locale: Locale = meta.recipient === 'admin' ? 'de' : input.locale

  return inTransaction(req, async () => {
    const db = await dbFor(req)
    await db.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`email-log:${key}`}))`)
    const existing = await preservingReq(req, () =>
      req.payload.find({
        collection: 'email-log',
        where: { idempotencyKey: { equals: key } },
        limit: 1,
        depth: 0,
        overrideAccess: true,
        req,
      }),
    )
    if (existing.docs[0]) {
      return { emailLogId: existing.docs[0].id, jobId: null, status: 'duplicate' as const }
    }
    const to = meta.recipient === 'admin' ? (input.to ?? (await adminRecipient(req))) : input.to
    if (!to) throw new InvalidEmailRequestError(`${input.template}: Empfänger fehlt.`)

    const system = withSystem(req)
    const log = await preservingReq(req, () =>
      req.payload.create({
        collection: 'email-log',
        data: {
          template: input.template,
          to,
          locale,
          subject: def.subject(parsed.data, locale).slice(0, 200),
          idempotencyKey: key,
          status: 'queued',
          attempts: 0,
          order: input.relations?.order ?? undefined,
          withdrawal: input.relations?.withdrawal ?? undefined,
          inquiry: input.relations?.inquiry ?? undefined,
        } as never,
        depth: 0,
        ...system,
        context: { ...system.context, skipAudit: true },
      }),
    )
    if (log.status === 'suppressed') {
      return { emailLogId: log.id, jobId: null, status: 'suppressed' as const }
    }
    const job = await req.payload.jobs.queue({
      task: 'sendEmail',
      input: { emailLogId: log.id, data: parsed.data, waits: 0 },
      queue: EMAIL_QUEUE,
      req,
    })
    return { emailLogId: log.id, jobId: job.id, status: 'queued' as const }
  })
}

/**
 * Direkte Ausführung nach dem Commit (KONZEPT §6.1: „direkt danach“). Weckt zusätzlich den Job-Wecker, damit ein
 * gescheiterter Direktversuch beim nächsten Tick nachgeholt wird.
 */
export async function runEmailJobNow(
  payload: Payload,
  jobId: number | string | null,
  options: { now?: Date } = {},
): Promise<void> {
  if (jobId === null) return
  const now = options.now ?? systemClock.now()
  await jobAlarm.bump(now).catch(() => undefined)
  const req = await createLocalReq({ context: { now: now.toISOString() } }, payload)
  await payload.jobs.runByID({ id: jobId, req })
}
