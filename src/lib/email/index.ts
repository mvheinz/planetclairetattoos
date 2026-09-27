import 'server-only'

import path from 'node:path'

import nodemailer, { type SendMailOptions, type Transport, type Transporter } from 'nodemailer'

import { getEnv, type Env } from '@/lib/env'
import { logger as defaultLogger, type Logger } from '@/lib/monitoring/logger'

import { fileTransport } from './file'
import { logTransport } from './log'
import { memoryTransport } from './memory'
import { addressList, isSuppressedRecipient } from './recipients'
import { smtpTransport } from './smtp'
import {
  HEADER_IDEMPOTENCY_KEY,
  HEADER_TYPE,
  type EmailAdapter,
  type EmailDriver,
  type MailMessage,
  type SendResult,
} from './types'

export { clearMemoryOutbox, getMemoryOutbox, type MemoryMail } from './memory'
export { isSuppressedRecipient } from './recipients'
export type { EmailAdapter, EmailDriver, MailMessage, SendResult } from './types'

// E-Mail (ARCHITEKTUR §3.4): eine Transport-Fabrik für alle Treiber. Unterdrückung (R-180) und Umleitung
// (MAIL_REDIRECT_ALL_TO) wirken im Transport – damit auch für Payloads eigene Mails (Passwort-Reset).

const SUPPRESSED = Symbol.for('planetclaire.mailSuppressed')

type MailData = SendMailOptions & { [SUPPRESSED]?: string[] }

/** „Planet Claire <shop@…>“ → Name und Adresse. */
export function parseMailFrom(from: string): { name: string; address: string } {
  const m = /^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/.exec(from)
  if (m) return { name: m[1]!.trim(), address: m[2]!.trim() }
  return { name: '', address: from.trim() }
}

function innerTransport(env: Env, log: Logger): Transport {
  switch (env.EMAIL_DRIVER) {
    case 'smtp':
      return smtpTransport(env)
    case 'memory':
      return memoryTransport()
    case 'log':
      return logTransport(log)
    case 'file':
    default:
      return fileTransport(path.resolve(process.cwd(), env.EMAIL_FILE_DIR))
  }
}

/** Nimmt vollständig unterdrückte Mails vor dem eigentlichen Transport ab – es entsteht keine Verbindung. */
function guardTransport(inner: Transport): Transport {
  return {
    name: `guarded-${inner.name}`,
    version: inner.version,
    send(mail, callback) {
      const suppressed = (mail.data as MailData)[SUPPRESSED]
      if (suppressed) {
        return callback(null, {
          messageId: mail.message.messageId(),
          envelope: { from: '', to: [] },
          accepted: [],
          rejected: suppressed,
          suppressed: true,
          response: 'suppressed',
        })
      }
      return inner.send(mail, callback)
    },
    close: inner.close?.bind(inner),
    verify: inner.verify?.bind(inner),
  } as Transport
}

/** Eine Transport-Fabrik für alle Treiber (auch für `nodemailerAdapter` in payload.config.ts). */
export function createMailTransport(env: Env, log: Logger = defaultLogger): Transporter {
  const redirectTo = env.MAIL_REDIRECT_ALL_TO
  if (redirectTo && env.APP_ENV === 'production') {
    log.error('mail.redirect_ignored', {
      reason: 'MAIL_REDIRECT_ALL_TO wird in Produktion ignoriert',
    })
  }
  const redirect = redirectTo && env.APP_ENV !== 'production' ? redirectTo : undefined
  const transporter = nodemailer.createTransport(guardTransport(innerTransport(env, log)))
  transporter.use('compile', (mail, done) => {
    const data = mail.data as MailData
    const kept: string[] = []
    const dropped: string[] = []
    for (const field of ['to', 'cc', 'bcc'] as const) {
      const list = addressList(data[field])
      const keep = list.filter((a) => !isSuppressedRecipient(a))
      dropped.push(...list.filter((a) => isSuppressedRecipient(a)))
      kept.push(...keep)
      data[field] = keep.length > 0 ? keep : undefined
    }
    if (kept.length === 0) {
      data[SUPPRESSED] = dropped
      return done()
    }
    if (redirect) {
      data.to = redirect
      data.cc = undefined
      data.bcc = undefined
      data.subject = `[${env.APP_ENV}] ${data.subject ?? ''}`
      data.headers = {
        ...(data.headers as Record<string, string>),
        'X-Original-To': kept.join(', '),
      }
    }
    done()
  })
  return transporter
}

export function createEmailAdapter(env: Env, log: Logger = defaultLogger): EmailAdapter {
  const transporter = createMailTransport(env, log)
  const from = env.MAIL_FROM
  const replyTo = env.MAIL_REPLY_TO
  return {
    driver: env.EMAIL_DRIVER as EmailDriver,
    transport: () => transporter,
    async send(message: MailMessage): Promise<SendResult> {
      const info = (await transporter.sendMail({
        from: message.from ?? from,
        replyTo: message.replyTo ?? replyTo,
        to: message.to,
        subject: message.subject,
        text: message.text,
        html: message.html,
        attachments: message.attachments?.map((a) => ({
          filename: a.filename,
          content: a.content,
          contentType: a.contentType,
          cid: a.cid,
        })),
        headers: {
          ...message.headers,
          [HEADER_TYPE]: message.type,
          [HEADER_IDEMPOTENCY_KEY]: message.idempotencyKey,
        },
      })) as { messageId?: string; accepted?: unknown[]; suppressed?: boolean; response?: string }
      return {
        messageId: info.suppressed ? '' : (info.messageId ?? ''),
        accepted: (info.accepted ?? []).map((a) =>
          typeof a === 'string' ? a : String((a as { address?: string }).address ?? a),
        ),
        suppressed: info.suppressed === true,
        response: info.response,
      }
    },
  }
}

let instance: EmailAdapter | undefined

export function getEmailAdapter(): EmailAdapter {
  if (!instance) instance = createEmailAdapter(getEnv())
  return instance
}

/** Nur in Tests benutzen. */
export function __setEmailAdapterForTests(adapter?: EmailAdapter): void {
  instance = adapter
}
