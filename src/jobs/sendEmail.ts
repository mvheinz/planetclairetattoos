import type { TaskConfig } from 'payload'

import { getEmailAdapter } from '@/lib/email'
import { renderPlainTemplate } from '@/lib/email/render'
import { jobNow } from '@/lib/jobs/now'
import { createHash } from 'node:crypto'

// Task `sendEmail` (DATENMODELL §11, Queue `email`): versendet eine `email-log`-Zeile im Status `queued`.
// Idempotent: Zeilen, die nicht mehr `queued` sind, werden nie erneut versendet (DM-JOB-01). In P1 nur `admin_alert`.

export const SEND_EMAIL_RETRIES = 5
const MAX_ATTEMPTS = SEND_EMAIL_RETRIES + 1

type SendEmailIO = {
  input: { emailLogId: number }
  output: { status: string }
}

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex')

export const sendEmailTask: TaskConfig<SendEmailIO> = {
  slug: 'sendEmail',
  label: 'Mail versenden',
  retries: SEND_EMAIL_RETRIES,
  inputSchema: [{ name: 'emailLogId', type: 'number', required: true }],
  outputSchema: [{ name: 'status', type: 'text', required: true }],
  handler: async ({ input, req }) => {
    const now = jobNow(req)
    const ctx = { ...req.context, system: true, skipAudit: true }
    const log = await req.payload.findByID({
      collection: 'email-log',
      id: input.emailLogId,
      depth: 0,
      overrideAccess: true,
      req,
    })
    if (log.status !== 'queued') return { output: { status: log.status } }
    const attempts = (log.attempts ?? 0) + 1
    const adapter = getEmailAdapter()
    try {
      const rendered = renderPlainTemplate(log.template, { subject: log.subject })
      const result = await adapter.send({
        to: log.to,
        subject: rendered.subject,
        text: rendered.text,
        html: rendered.html,
        type: log.template,
        idempotencyKey: `${log.template}:email-log:${log.id}`,
      })
      const status = result.suppressed ? 'suppressed' : 'sent'
      await req.payload.update({
        collection: 'email-log',
        id: log.id,
        data: {
          status,
          transport: adapter.driver,
          messageId: result.messageId || undefined,
          smtpResponse: result.response?.slice(0, 300),
          sentAt: status === 'sent' ? now.toISOString() : undefined,
          attempts,
          templateVersion: rendered.templateVersion,
          bodySha256: sha256(rendered.text),
        },
        overrideAccess: true,
        context: ctx,
        req,
      })
      return { output: { status } }
    } catch (e) {
      const message = (e instanceof Error ? e.message : String(e)).slice(0, 1000)
      await req.payload.update({
        collection: 'email-log',
        id: log.id,
        data: {
          attempts,
          lastError: message,
          ...(attempts >= MAX_ATTEMPTS ? { status: 'failed' as const } : {}),
        },
        overrideAccess: true,
        context: ctx,
        req,
      })
      throw e
    }
  },
}
