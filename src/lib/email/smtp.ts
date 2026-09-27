import 'server-only'

import nodemailer, { type Transport } from 'nodemailer'

import type { Env } from '@/lib/env'
import { ConfigError } from '@/lib/errors'

// Treiber `smtp` (ARCHITEKTUR §3.4): lokal Mailpit (127.0.0.1:1025), Produktion Lettermint.

export function smtpTransport(env: Env): Transport {
  if (!env.SMTP_HOST) throw new ConfigError('EMAIL_DRIVER=smtp, aber SMTP_HOST fehlt.')
  const inner = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS ?? '' } : undefined,
    // Kein Verbindungsaufbau beim Start; Zeitlimits, damit ein hängender Server den Job nicht blockiert.
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  })
  return inner.transporter
}
