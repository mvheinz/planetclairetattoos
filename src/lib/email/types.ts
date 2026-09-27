import 'server-only'

import type { Transporter } from 'nodemailer'

import type { EmailTemplate } from '@/lib/enums'

// E-Mail-Adapter (ARCHITEKTUR §3.4). Eigene Typen, keine Anbieter-Typen nach außen (außer dem Transport für Payload).

export type EmailDriver = 'file' | 'smtp' | 'memory' | 'log'

export interface MailAttachment {
  filename: string
  content: Buffer
  contentType: string
  cid?: string
}

export interface MailMessage {
  to: string
  subject: string
  html: string
  text: string
  /** Standard aus MAIL_FROM / MAIL_REPLY_TO. */
  from?: string
  replyTo?: string
  attachments?: MailAttachment[]
  headers?: Record<string, string>
  /** Schlüssel aus EMAIL_TEMPLATES, z. B. 'order_confirmation' (M01), 'admin_alert' (A12). */
  type: EmailTemplate
  /** Mail-Typ + Objekt-ID + Ereignis (KONZEPT §6.1). */
  idempotencyKey: string
}

export interface SendResult {
  messageId: string
  accepted: string[]
  suppressed: boolean
  /** Antwort des Transports (SMTP-Antwortzeile bzw. Ablageort), gekürzt gespeichert. */
  response?: string
}

export interface EmailAdapter {
  readonly driver: EmailDriver
  send(message: MailMessage): Promise<SendResult>
  /** Derselbe Transport für Payloads eigene Mails (Passwort-Reset). */
  transport(): Transporter
}

/** Kopfzeilen, über die Adapter und Transporte Typ und Idempotenz-Schlüssel weiterreichen. */
export const HEADER_TYPE = 'X-PC-Type'
export const HEADER_IDEMPOTENCY_KEY = 'X-PC-Idempotency-Key'
