import 'server-only'

import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

import type { Transport } from 'nodemailer'

import { HEADER_IDEMPOTENCY_KEY, HEADER_TYPE } from './types'

// Treiber `file` (ARCHITEKTUR §3.4): vollständig gerenderte `.eml` plus `.json` mit Metadaten nach EMAIL_FILE_DIR.
// Dateiname `<ISO-Zeit>__<type>__<idempotencyKey>` (Doppelpunkte ersetzt, damit er auch unter Windows gültig ist).

export interface OutboxRecord {
  messageId: string
  date: string
  type: string
  idempotencyKey: string
  from: string
  to: string[]
  subject: string
  text?: string
  html?: string
  originalTo?: string
  attachments: { filename: string; contentType: string; size: number }[]
  eml: string
}

type Headers = Record<string, unknown>

export function headerValue(headers: unknown, name: string): string | undefined {
  if (!headers || typeof headers !== 'object') return undefined
  const lower = name.toLowerCase()
  if (Array.isArray(headers)) {
    const hit = (headers as { key: string; value: unknown }[]).find(
      (h) => h.key?.toLowerCase() === lower,
    )
    return hit ? String(hit.value) : undefined
  }
  for (const [k, v] of Object.entries(headers as Headers)) {
    if (k.toLowerCase() === lower) return String(v)
  }
  return undefined
}

const safe = (s: string) => s.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 120)

export function fileTransport(dir: string): Transport {
  return {
    name: 'planetclaire-file',
    version: '1',
    send(mail, callback) {
      const data = mail.data
      mail.message.build(async (err, raw) => {
        if (err) return callback(err, undefined)
        try {
          const now = new Date()
          const stamp = now.toISOString().replace(/[:.]/g, '-')
          const type = headerValue(data.headers, HEADER_TYPE) ?? 'payload'
          const messageId = mail.message.messageId()
          const key = headerValue(data.headers, HEADER_IDEMPOTENCY_KEY) ?? messageId
          const envelope = mail.message.getEnvelope()
          await mkdir(dir, { recursive: true })
          let base = `${stamp}__${safe(type)}__${safe(key)}`
          for (let n = 2; ; n++) {
            try {
              await writeFile(path.join(dir, `${base}.eml`), raw, { flag: 'wx' })
              break
            } catch (e) {
              if ((e as NodeJS.ErrnoException).code !== 'EEXIST' || n > 50) throw e
              base = `${stamp}__${safe(type)}__${safe(key)}-${n}`
            }
          }
          const record: OutboxRecord = {
            messageId,
            date: now.toISOString(),
            type,
            idempotencyKey: key,
            from: envelope.from || '',
            to: envelope.to,
            subject: String(data.subject ?? ''),
            text: typeof data.text === 'string' ? data.text : undefined,
            html: typeof data.html === 'string' ? data.html : undefined,
            originalTo: headerValue(data.headers, 'X-Original-To'),
            attachments: (data.attachments ?? []).map((a) => ({
              filename: String(a.filename ?? ''),
              contentType: String(a.contentType ?? ''),
              size: Buffer.isBuffer(a.content) ? a.content.length : String(a.content ?? '').length,
            })),
            eml: `${base}.eml`,
          }
          await writeFile(path.join(dir, `${base}.json`), `${JSON.stringify(record, null, 2)}\n`)
          callback(null, {
            messageId,
            envelope,
            accepted: envelope.to,
            rejected: [],
            response: `file:${base}.eml`,
          })
        } catch (e) {
          callback(e as Error, undefined)
        }
      })
    },
  }
}
