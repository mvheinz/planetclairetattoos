import 'server-only'

import type { PayloadRequest } from 'payload'

import type { EmailTemplate, Locale } from '@/lib/enums'
import { withSystem } from '@/lib/payload/context'

import { JOB_QUEUE_OF } from '@/jobs/index'

// Outbox-Muster (DATENMODELL §1.5, ARCHITEKTUR §3.4): `email-log`-Zeile (`queued`) und Job `sendEmail` im selben
// Transaktionskontext (`req`). Rollt die Transaktion zurück, verschwinden beide.

export interface EnqueueEmailInput {
  template: EmailTemplate
  to: string
  locale: Locale
  subject: string
}

export interface EnqueueEmailResult {
  emailLogId: number
  /** `null`, wenn der Empfänger unterdrückt ist (R-180): dann gibt es nichts zu versenden. */
  jobId: number | string | null
  status: 'queued' | 'suppressed'
}

export async function enqueueEmail(
  req: PayloadRequest,
  input: EnqueueEmailInput,
): Promise<EnqueueEmailResult> {
  const system = withSystem(req)
  const log = await req.payload.create({
    collection: 'email-log',
    data: {
      template: input.template,
      to: input.to,
      locale: input.locale,
      subject: input.subject,
      status: 'queued',
      attempts: 0,
    } as never,
    ...system,
    context: { ...system.context, skipAudit: true },
  })
  if (log.status === 'suppressed') return { emailLogId: log.id, jobId: null, status: 'suppressed' }
  const job = await req.payload.jobs.queue({
    task: 'sendEmail',
    input: { emailLogId: log.id },
    queue: JOB_QUEUE_OF.sendEmail,
    req,
  })
  return { emailLogId: log.id, jobId: job.id, status: 'queued' }
}
