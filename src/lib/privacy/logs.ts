import 'server-only'

import type { PayloadRequest, Where } from 'payload'

import { ENUM_LABELS } from '@/lib/enumLabels'
import { templateMeta } from '@/lib/email/registry'
import {
  CONSENT_PURPOSES,
  EMAIL_STATUSES,
  EMAIL_TEMPLATES,
  type ConsentPurpose,
  type EmailStatus,
  type EmailTemplate,
} from '@/lib/enums'
import { berlinDayStart, addBerlinDays, formatBerlin, parseBerlinLocal } from '@/lib/time'
import type { ConsentLog, EmailLog } from '@/payload-types'

import { maskEmail } from './mask'

// Einwilligungs- und Mail-Protokolle in der Verwaltung (PLAN P6.19, KONZEPT §6.1, §7.15, R-081): Zeilen ohne Inhalte –
// Mail: Typ (KONZEPT-ID), Betreff (aus der Vorlage, nie Kund:innen-Freitext), Zeitpunkt, Anbieter-ID, Status,
// Anhang-Namen; Einwilligung: Zweck, erteilt/widerrufen, Zeitpunkt, Baustein und Version. Empfänger in Listen
// maskiert. Einwilligungstexte (`textSnapshot`) und Mail-Inhalte erscheinen nie in Listen.

export interface EmailLogRow {
  id: number
  template: EmailTemplate
  konzeptId: string
  label: string
  subject: string
  at: string
  status: EmailStatus
  statusLabel: string
  messageId: string | null
  attachments: string[]
  to: string
  admin: boolean
  orderId: number | null
  withdrawalId: number | null
  inquiryId: number | null
}

export interface ConsentLogRow {
  id: number
  purpose: ConsentPurpose
  purposeLabel: string
  granted: boolean
  at: string
  snippet: string
  withdrawnAt: string | null
  email: string
  orderId: number | null
}

const fmt = (iso: string) => formatBerlin(new Date(iso), 'dd.MM.yyyy, HH:mm')
const idOf = (v: unknown): number | null =>
  v === null || v === undefined
    ? null
    : typeof v === 'object'
      ? (v as { id: number }).id
      : Number(v)

export function emailLogRow(m: EmailLog): EmailLogRow {
  const meta = templateMeta(m.template)
  return {
    id: m.id,
    template: m.template,
    konzeptId: meta.konzeptId,
    label: ENUM_LABELS.EMAIL_TEMPLATES[m.template]?.de ?? m.template,
    subject: m.subject,
    at: fmt(m.sentAt ?? m.createdAt),
    status: m.status,
    statusLabel: ENUM_LABELS.EMAIL_STATUSES[m.status]?.de ?? m.status,
    messageId: m.messageId || null,
    attachments: (m.attachments ?? []).map((a) => a.filename),
    to: maskEmail(m.to),
    admin: meta.recipient === 'admin',
    orderId: idOf(m.order),
    withdrawalId: idOf(m.withdrawal),
    inquiryId: idOf(m.inquiry),
  }
}

export function consentLogRow(c: ConsentLog): ConsentLogRow {
  return {
    id: c.id,
    purpose: c.purpose,
    purposeLabel: ENUM_LABELS.CONSENT_PURPOSES[c.purpose]?.de ?? c.purpose,
    granted: c.granted === true,
    at: fmt(c.createdAt),
    snippet:
      [c.snippetKey, c.snippetVersion ? `v${c.snippetVersion}` : null]
        .filter(Boolean)
        .join(' · ') || '–',
    withdrawnAt: c.withdrawnAt ? fmt(c.withdrawnAt) : null,
    email: maskEmail(c.email),
    orderId: idOf(c.order),
  }
}

export async function emailLogsFor(
  req: PayloadRequest,
  where: Where,
  limit = 100,
): Promise<EmailLogRow[]> {
  const res = await req.payload.find({
    collection: 'email-log',
    where,
    sort: '-createdAt',
    limit,
    depth: 0,
    overrideAccess: true,
    req,
  })
  return (res.docs as EmailLog[]).map(emailLogRow)
}

export async function consentLogsFor(
  req: PayloadRequest,
  where: Where,
  limit = 100,
): Promise<ConsentLogRow[]> {
  const res = await req.payload.find({
    collection: 'consent-log',
    where,
    sort: '-createdAt',
    limit,
    depth: 0,
    overrideAccess: true,
    req,
  })
  return (res.docs as ConsentLog[]).map(consentLogRow)
}

/** Mails einer Datenschutz-Anfrage (M14/M15 über den Idempotenz-Schlüssel, A14). */
export function privacyRequestMailsWhere(id: number): Where {
  return {
    or: [
      { idempotencyKey: { like: `privacy_access_response:${id}:` } },
      { idempotencyKey: { equals: `privacy_erasure_response:${id}` } },
      { idempotencyKey: { like: `admin_privacy_request_due:${id}:` } },
    ],
  }
}

export type ProtocolKind = 'email' | 'consent'

export interface ProtocolFilters {
  kind: ProtocolKind
  /** `JJJJ-MM-TT` (Berlin), inklusive. */
  from: string | null
  to: string | null
  /** E-Mail-Status bzw. `granted`/`withdrawn` bei Einwilligungen. */
  status: string | null
  /** Vorlage (nur Mails). */
  template: string | null
}

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/

export function parseProtocolFilters(
  params: Record<string, string | string[] | undefined> | undefined,
): ProtocolFilters {
  const one = (k: string) => {
    const v = params?.[k]
    return typeof v === 'string' && v !== '' ? v : null
  }
  const kind = one('art') === 'einwilligungen' ? 'consent' : 'email'
  const from = one('von')
  const to = one('bis')
  const status = one('status')
  const template = one('typ')
  const okStatus =
    kind === 'email'
      ? (EMAIL_STATUSES as readonly string[]).includes(status ?? '')
      : status === 'granted' || status === 'withdrawn'
  return {
    kind,
    from: from && DAY_RE.test(from) ? from : null,
    to: to && DAY_RE.test(to) ? to : null,
    status: okStatus ? status : null,
    template:
      kind === 'email' && template && (EMAIL_TEMPLATES as readonly string[]).includes(template)
        ? template
        : null,
  }
}

function range(field: string, f: ProtocolFilters): Where[] {
  const out: Where[] = []
  const start = f.from ? parseBerlinLocal(`${f.from}T00:00`) : null
  const end = f.to ? parseBerlinLocal(`${f.to}T00:00`) : null
  if (start) out.push({ [field]: { greater_than_equal: berlinDayStart(start).toISOString() } })
  if (end) out.push({ [field]: { less_than: addBerlinDays(berlinDayStart(end), 1).toISOString() } })
  return out
}

/** Gesamtliste `/export/protokolle` (höchstens `limit` Zeilen, neueste zuerst). */
export async function listProtocols(
  req: PayloadRequest,
  f: ProtocolFilters,
  limit = 200,
): Promise<{ emails: EmailLogRow[]; consents: ConsentLogRow[] }> {
  if (f.kind === 'consent') {
    const and: Where[] = range('createdAt', f)
    if (f.status === 'granted')
      and.push({ granted: { equals: true } }, { withdrawnAt: { exists: false } })
    if (f.status === 'withdrawn') and.push({ withdrawnAt: { exists: true } })
    return { emails: [], consents: await consentLogsFor(req, and.length ? { and } : {}, limit) }
  }
  const and: Where[] = range('createdAt', f)
  if (f.status) and.push({ status: { equals: f.status } })
  if (f.template) and.push({ template: { equals: f.template } })
  return { emails: await emailLogsFor(req, and.length ? { and } : {}, limit), consents: [] }
}

export const PROTOCOL_PURPOSES = CONSENT_PURPOSES
