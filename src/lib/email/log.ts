import 'server-only'

import type { Transport } from 'nodemailer'

import type { Logger } from '@/lib/monitoring/logger'

import { headerValue } from './file'
import { domainOf } from './recipients'
import { HEADER_IDEMPOTENCY_KEY, HEADER_TYPE } from './types'

// Treiber `log` (ARCHITEKTUR §3.4): rendert, protokolliert Kopf-Daten ohne Empfänger-Adresse im Klartext und versendet
// nichts – für Vercel-Previews.

export function logTransport(logger: Logger): Transport {
  return {
    name: 'planetclaire-log',
    version: '1',
    send(mail, callback) {
      mail.message.build((err, raw) => {
        if (err) return callback(err, undefined)
        const messageId = mail.message.messageId()
        const envelope = mail.message.getEnvelope()
        logger.info('mail.log_driver', {
          messageId,
          type: headerValue(mail.data.headers, HEADER_TYPE) ?? 'payload',
          idempotencyKey: headerValue(mail.data.headers, HEADER_IDEMPOTENCY_KEY),
          toDomains: envelope.to.map(domainOf),
          bytes: raw.length,
        })
        callback(null, { messageId, envelope, accepted: [], rejected: [], response: 'log' })
      })
    },
  }
}
