import 'server-only'

import type { Transport } from 'nodemailer'

import { headerValue } from './file'
import { HEADER_IDEMPOTENCY_KEY, HEADER_TYPE } from './types'

// Treiber `memory` (ARCHITEKTUR §3.4): Array im Prozess, nur für Unit-/Int-Tests.

export interface MemoryMail {
  messageId: string
  type: string
  idempotencyKey: string
  from: string
  to: string[]
  subject: string
  text?: string
  html?: string
  headers: Record<string, string>
  attachments: { filename: string; contentType: string }[]
  raw: string
}

const outbox: MemoryMail[] = []

export function getMemoryOutbox(): readonly MemoryMail[] {
  return outbox
}

export function clearMemoryOutbox(): void {
  outbox.length = 0
}

export function memoryTransport(): Transport {
  return {
    name: 'planetclaire-memory',
    version: '1',
    send(mail, callback) {
      const data = mail.data
      mail.message.build((err, raw) => {
        if (err) return callback(err, undefined)
        const messageId = mail.message.messageId()
        const envelope = mail.message.getEnvelope()
        const headers: Record<string, string> = {}
        for (const name of ['X-Original-To', HEADER_TYPE, HEADER_IDEMPOTENCY_KEY]) {
          const v = headerValue(data.headers, name)
          if (v !== undefined) headers[name] = v
        }
        outbox.push({
          messageId,
          type: headers[HEADER_TYPE] ?? 'payload',
          idempotencyKey: headers[HEADER_IDEMPOTENCY_KEY] ?? messageId,
          from: envelope.from || '',
          to: envelope.to,
          subject: String(data.subject ?? ''),
          text: typeof data.text === 'string' ? data.text : undefined,
          html: typeof data.html === 'string' ? data.html : undefined,
          headers,
          attachments: (data.attachments ?? []).map((a) => ({
            filename: String(a.filename ?? ''),
            contentType: String(a.contentType ?? ''),
          })),
          raw: raw.toString('utf8'),
        })
        callback(null, {
          messageId,
          envelope,
          accepted: envelope.to,
          rejected: [],
          response: 'memory',
        })
      })
    },
  }
}
