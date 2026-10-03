import 'server-only'

import { sql } from '@payloadcms/db-postgres'
import { createLocalReq, type Payload, type PayloadRequest } from 'payload'

import { dbFor, type SqlExecutor } from '@/lib/db/tx'
import { getEnv } from '@/lib/env'
import type { EmailTemplate, Locale } from '@/lib/enums'
import { jobAlarm } from '@/lib/jobs/alarm'
import { besideTick } from '@/lib/jobs/lock'
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

/** Ist die Verarbeitung der Bestellung eingeschränkt (`privacy.processingRestricted`, LOESCHKONZEPT §5.7)? */
export async function isOrderRestricted(req: PayloadRequest, orderId: number): Promise<boolean> {
  const db = await dbFor(req)
  const res = await db.execute(
    sql`SELECT privacy_processing_restricted AS r FROM orders WHERE id = ${orderId}`,
  )
  return res.rows[0]?.r === true
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

    // Eingeschränkte Bestellung (Art. 18, P6.18): keine Kund:innen-Mails mehr – Protokoll `suppressed`
    const restricted =
      meta.recipient === 'customer' && input.relations?.order
        ? await isOrderRestricted(req, input.relations.order)
        : false
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
          status: restricted ? 'suppressed' : 'queued',
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
 *
 * Wettlauf mit einem parallelen Lauf (Job-Wecker, `jobs.run`): `payload.jobs.runByID` setzt `processing` ohne
 * Bedingung – hat der andere Lauf den Job schon erledigt und gelöscht, liest Payload `null.log` (TypeError), läuft er
 * noch, würde der Job doppelt ausgeführt. Deshalb läuft der Sofortversand nie gleichzeitig mit dem Tick (geteilte
 * Sperre `tick`) und beansprucht den Job atomar (`UPDATE … WHERE processing = false … RETURNING`); gelingt das nicht,
 * kümmert sich der andere Lauf darum.
 * Gegen Doppelversand bei echten Überschneidungen sichert zusätzlich der Task (`sendEmail`, Sperre je `email-log`).
 */
export async function runEmailJobNow(
  payload: Payload,
  jobId: number | string | null,
  options: { now?: Date } = {},
): Promise<void> {
  if (jobId === null) return
  const now = options.now ?? systemClock.now()
  await jobAlarm.bump(now).catch(() => undefined)
  const db = (payload.db as unknown as { drizzle: SqlExecutor }).drizzle
  const id = Number(jobId)
  // Nie gleichzeitig mit dem Tick (dessen `jobs.run` beansprucht nicht atomar); läuft er gerade, holt er bzw. der
  // nächste Tick den Job (Wecker oben gestellt).
  await besideTick(payload, async () => {
    const claimed = await db.execute(sql`
      UPDATE payload_jobs SET processing = true, updated_at = now()
      WHERE id = ${id} AND processing = false AND completed_at IS NULL AND has_error IS NOT TRUE
      RETURNING id`)
    if (claimed.rows.length === 0) return
    const req = await createLocalReq({ context: { now: now.toISOString() } }, payload)
    try {
      await payload.jobs.runByID({ id: jobId, req })
    } catch (err) {
      // Ein anderer Lauf außerhalb des Ticks (autoRun, „Jetzt ausführen“) hat den Job inzwischen erledigt und gelöscht:
      // kein Fehler – die Mail ist über die Sperre im Task genau einmal versendet.
      const left = await db.execute(sql`SELECT 1 FROM payload_jobs WHERE id = ${id}`)
      if (left.rows.length === 0) return
      // Beanspruchung zurückgeben, damit der nächste Tick den Job nachholt (sonst bliebe er „in Arbeit“ hängen).
      await db
        .execute(
          sql`UPDATE payload_jobs SET processing = false WHERE id = ${id} AND completed_at IS NULL`,
        )
        .catch(() => undefined)
      throw err
    }
  })
}
