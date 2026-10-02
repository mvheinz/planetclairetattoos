import type { PayloadRequest, TaskConfig } from 'payload'

import { getEmailAdapter } from '@/lib/email'
import { sendAdminAlert } from '@/lib/email/alerts'
import { AttachmentNotReadyError } from '@/lib/email/errors'
import { EMAIL_QUEUE, isOrderRestricted } from '@/lib/email/outbox'
import { prepareMail } from '@/lib/email/prepare'
import { templateMeta } from '@/lib/email/registry'
import { jobAlarm } from '@/lib/jobs/alarm'
import { jobNow } from '@/lib/jobs/now'
import { createLogger } from '@/lib/monitoring/logger'
import type { EmailLog } from '@/payload-types'

// Task `sendEmail` (DATENMODELL §11, Queue `email`): versendet eine `email-log`-Zeile im Status `queued`.
// - Idempotent: Zeilen, die nicht mehr `queued` sind, werden nie erneut versendet (DM-JOB-01).
// - Fehlt ein Pflicht-Anhang noch (Rechnung `pending_pdf`, Rechtstext-PDF), wird ohne Fehlversuch mit
//   `waitUntil = jetzt + 1 min` neu eingereiht – höchstens 30×, dann `failed` + A12.
// - Fehlversuche: neuer Job nach 1, 5, 15, 60, 240 min (eigene Kette mit injizierter Uhr statt Payload-Retries),
//   danach `failed` + A12 (höchstens eine je Fehlerart und Stunde). Weckzeit per `jobAlarm.bump`.
// - Empfänger unter reservierten Domains → `suppressed` (Transport, R-180).
// - `withdrawal_receipt` (M08, R-093, P6.7): eigene Kette – nach 1 min, danach alle 5 min bis 24 h nach Eingang
//   des Widerrufs; nach dem 2. Fehlversuch A12 (`withdrawal_receipt_second_failure`, nie gedrosselt), nach 24 h
//   `failed` und erneut A12 (`withdrawal_receipt_failed_24h`). Nach dem Versand `withdrawals.confirmationSentAt`.

export const RETRY_DELAYS_MIN = [1, 5, 15, 60, 240] as const
/** M08: Abstand der Wiederholungen (erster nach 1 min, dann höchstens 5 min) bis 24 h nach Eingang (R-093). */
export const WITHDRAWAL_RETRY_DELAYS_MIN = [1, 5] as const
export const WITHDRAWAL_RETRY_WINDOW_MS = 24 * 60 * 60_000
export const ATTACHMENT_WAIT_MIN = 1
export const MAX_ATTACHMENT_WAITS = 30

const log = createLogger()

type SendEmailInput = { emailLogId: number; data?: Record<string, unknown>; waits?: number }
type SendEmailIO = {
  input: SendEmailInput
  output: { status: string }
}

const ctxOf = (req: PayloadRequest) => ({ ...req.context, system: true, skipAudit: true })
const minutes = (now: Date, n: number) => new Date(now.getTime() + n * 60_000)

async function update(req: PayloadRequest, id: number, data: Record<string, unknown>) {
  await req.payload.update({
    collection: 'email-log',
    id,
    data: data as never,
    depth: 0,
    overrideAccess: true,
    context: ctxOf(req),
    req,
  })
}

async function requeue(req: PayloadRequest, input: SendEmailInput, at: Date): Promise<void> {
  await req.payload.jobs.queue({
    task: 'sendEmail',
    input,
    queue: EMAIL_QUEUE,
    waitUntil: at,
    req,
  })
  await jobAlarm.bump(at).catch(() => undefined)
}

const idOf = (v: unknown): number | null =>
  v === null || v === undefined
    ? null
    : typeof v === 'object'
      ? (v as { id: number }).id
      : Number(v)

async function giveUp(
  req: PayloadRequest,
  entry: EmailLog,
  now: Date,
  data: Record<string, unknown>,
): Promise<void> {
  await update(req, entry.id, data)
  if (entry.template === 'admin_alert') {
    log.error('mail.alert_failed', { emailLogId: entry.id })
    return
  }
  if (entry.template === 'withdrawal_receipt') {
    await withdrawalAlert(req, entry, now, 'withdrawal_receipt_failed_24h')
    return
  }
  const meta = templateMeta(entry.template)
  await sendAdminAlert(req, {
    kind: `mail_failed.${entry.template}`,
    summary: `Mail ${meta.konzeptId} konnte nicht versendet werden`,
    affected: `Mail-Protokoll Nr. ${entry.id} (${meta.konzeptId}, ${entry.template}).`,
    automatic: 'Mehrere Versuche sind gescheitert; die Mail ist als „gescheitert“ markiert.',
    todo: 'Bitte die Mail-Einstellungen prüfen und die Mail an der Bestellung erneut senden.',
    adminPath: `/collections/email-log/${entry.id}`,
    now,
  })
}

/** A12 zur Eingangsbestätigung eines Widerrufs (R-093): nach dem 2. Fehlversuch und nach 24 h. */
async function withdrawalAlert(
  req: PayloadRequest,
  entry: EmailLog,
  now: Date,
  kind: 'withdrawal_receipt_second_failure' | 'withdrawal_receipt_failed_24h',
): Promise<void> {
  const withdrawalId = idOf(entry.withdrawal)
  const final = kind === 'withdrawal_receipt_failed_24h'
  await sendAdminAlert(req, {
    kind,
    summary: final
      ? 'Eingangsbestätigung eines Widerrufs nach 24 Stunden nicht versendet'
      : 'Eingangsbestätigung eines Widerrufs hängt',
    affected: `Mail-Protokoll Nr. ${entry.id} (M08)${withdrawalId ? `, Widerruf Nr. ${withdrawalId}` : ''}.`,
    automatic: final
      ? 'Der Versand ist 24 Stunden lang alle 5 Minuten versucht worden und jetzt als „gescheitert“ markiert.'
      : 'Zwei Versuche sind gescheitert; der Versand wird alle 5 Minuten bis 24 Stunden nach Eingang wiederholt.',
    todo: final
      ? 'Bitte die Eingangsbestätigung jetzt von Hand an die angegebene Adresse schicken (Inhalt steht in der Kopie A04).'
      : 'Bitte die Mail-Einstellungen prüfen. Klappt der Versand nicht, die Bestätigung von Hand schicken.',
    adminPath: withdrawalId
      ? `/collections/withdrawals/${withdrawalId}`
      : `/collections/email-log/${entry.id}`,
    now,
  })
}

/** Nächster Versuch für M08 bzw. `null`, wenn die 24 h nach Eingang vorbei sind. */
async function nextWithdrawalAttempt(
  req: PayloadRequest,
  entry: EmailLog,
  attempts: number,
  now: Date,
): Promise<Date | null> {
  const withdrawalId = idOf(entry.withdrawal)
  const withdrawal = withdrawalId
    ? await req.payload.findByID({
        collection: 'withdrawals',
        id: withdrawalId,
        depth: 0,
        overrideAccess: true,
        disableErrors: true,
        select: { receivedAt: true },
        req,
      })
    : null
  const start = withdrawal?.receivedAt ? new Date(withdrawal.receivedAt) : new Date(entry.createdAt)
  const deadline = new Date(start.getTime() + WITHDRAWAL_RETRY_WINDOW_MS)
  if (now.getTime() >= deadline.getTime()) return null
  const delay =
    WITHDRAWAL_RETRY_DELAYS_MIN[Math.min(attempts, WITHDRAWAL_RETRY_DELAYS_MIN.length) - 1]!
  const next = minutes(now, delay)
  return next.getTime() > deadline.getTime() ? deadline : next
}

export const sendEmailTask: TaskConfig<SendEmailIO> = {
  slug: 'sendEmail',
  label: 'Mail versenden',
  // Wiederholungen steuert der Task selbst (feste Kette mit injizierter Zeit).
  retries: 0,
  inputSchema: [
    { name: 'emailLogId', type: 'number', required: true },
    { name: 'data', type: 'json' },
    { name: 'waits', type: 'number' },
  ],
  outputSchema: [{ name: 'status', type: 'text', required: true }],
  handler: async ({ input, req }) => {
    const now = jobNow(req)
    const entry = await req.payload.findByID({
      collection: 'email-log',
      id: input.emailLogId,
      depth: 0,
      overrideAccess: true,
      req,
    })
    if (entry.status !== 'queued') return { output: { status: entry.status } }
    // Inzwischen eingeschränkte Bestellung (Art. 18, P6.18): Kund:innen-Mail nicht mehr versenden
    const orderId = idOf(entry.order)
    if (
      orderId !== null &&
      templateMeta(entry.template).recipient === 'customer' &&
      (await isOrderRestricted(req, orderId))
    ) {
      await update(req, entry.id, { status: 'suppressed', lastError: 'processing_restricted' })
      return { output: { status: 'suppressed' } }
    }
    const attempts = (entry.attempts ?? 0) + 1
    const data = (input.data ?? {}) as Record<string, unknown>
    const adapter = getEmailAdapter()

    try {
      const mail = await prepareMail(req, entry, data, now)
      const result = await adapter.send({
        to: entry.to,
        subject: mail.subject,
        text: mail.text,
        html: mail.html,
        attachments: mail.attachments,
        type: entry.template,
        idempotencyKey: entry.idempotencyKey ?? `${entry.template}:email-log:${entry.id}`,
      })
      const status = result.suppressed ? 'suppressed' : 'sent'
      await update(req, entry.id, {
        status,
        transport: adapter.driver,
        messageId: result.messageId || undefined,
        smtpResponse: result.response?.slice(0, 300),
        sentAt: status === 'sent' ? now.toISOString() : undefined,
        attempts,
        lastError: null,
        templateVersion: mail.templateVersion,
        bodySha256: mail.bodySha256,
        attachments: mail.attachmentLog,
      })
      const withdrawalId = idOf(entry.withdrawal)
      if (entry.template === 'withdrawal_receipt' && status === 'sent' && withdrawalId) {
        await req.payload.update({
          collection: 'withdrawals',
          id: withdrawalId,
          data: { confirmationSentAt: now.toISOString(), confirmationEmail: entry.id },
          depth: 0,
          overrideAccess: true,
          context: { ...ctxOf(req), now: now.toISOString() },
          req,
        })
      }
      return { output: { status } }
    } catch (e) {
      const message = (e instanceof Error ? e.message : String(e)).slice(0, 1000)
      if (e instanceof AttachmentNotReadyError) {
        const waits = (input.waits ?? 0) + 1
        if (waits <= MAX_ATTACHMENT_WAITS) {
          await update(req, entry.id, { lastError: message })
          await requeue(req, { ...input, waits }, minutes(now, ATTACHMENT_WAIT_MIN))
          return { output: { status: 'waiting' } }
        }
        await giveUp(req, entry, now, { status: 'failed', lastError: message })
        return { output: { status: 'failed' } }
      }
      log.warn('mail.send_failed', { emailLogId: entry.id, attempts, error: message })
      if (entry.template === 'withdrawal_receipt') {
        const next = await nextWithdrawalAttempt(req, entry, attempts, now)
        if (next) {
          await update(req, entry.id, { attempts, lastError: message })
          if (attempts === 2) {
            await withdrawalAlert(req, entry, now, 'withdrawal_receipt_second_failure')
          }
          await requeue(req, input, next)
          return { output: { status: 'retry' } }
        }
        await giveUp(req, entry, now, { status: 'failed', attempts, lastError: message })
        return { output: { status: 'failed' } }
      }
      const delay = RETRY_DELAYS_MIN[attempts - 1]
      if (delay !== undefined) {
        await update(req, entry.id, { attempts, lastError: message })
        await requeue(req, input, minutes(now, delay))
        return { output: { status: 'retry' } }
      }
      await giveUp(req, entry, now, { status: 'failed', attempts, lastError: message })
      return { output: { status: 'failed' } }
    }
  },
}
