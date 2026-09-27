import type { CollectionConfig, PayloadRequest } from 'payload'

import { isAdmin, none } from '@/access'
import { isSuppressedRecipient } from '@/lib/email/recipients'
import { seedField } from '@/fields'
import { ENUM_LABELS, enumOptions } from '@/lib/enumLabels'
import { EMAIL_STATUSES, EMAIL_TEMPLATES, EMAIL_TRANSPORTS, LOCALES } from '@/lib/enums'
import { preservingReq } from '@/lib/payload/localReq'
import {
  L_12_EMAIL_LOG_UNRELATED,
  orderRelatedRetainUntil,
  retainUntil,
} from '@/lib/retention/policy'

import { immutableFields } from './hooks/immutable'

// DATENMODELL §6.22 – Versandnachweis ohne Inhalt. Relationen `order` (P1.20), `withdrawal` (P1.21) und `inquiry`
// (P1.24). Ohne Bezug gilt L-12; mit Bezug die Frist des Bezugsobjekts (Service bzw. Bestell-Hook; bei Anfragen deren
// `deleteAfter`, L-10).

/** Reservierte Empfänger-Domains werden in allen Umgebungen unterdrückt (R-180, ARCHITEKTUR §3.4). */
export { isSuppressedRecipient }

const RELATION_FIELDS = ['order', 'withdrawal', 'inquiry'] as const

/** Frist aus der Bezugsbestellung (L-12/L-19 a mit Bezug), `null` ohne Bestellung. */
async function retainUntilFromOrder(
  req: PayloadRequest,
  order: unknown,
  eventAt: Date,
): Promise<string | null> {
  const id = typeof order === 'object' && order ? (order as { id: number }).id : order
  if (id === null || id === undefined || id === '') return null
  const doc = await preservingReq(req, () =>
    req.payload.findByID({
      collection: 'orders',
      id: id as number,
      depth: 0,
      select: { retainUntil: true },
      overrideAccess: true,
      disableErrors: true,
      req,
    }),
  )
  const until = doc?.retainUntil ? new Date(doc.retainUntil) : null
  return orderRelatedRetainUntil(until, eventAt).toISOString()
}

/** Frist aus der Bezugsanfrage (`inquiries.deleteAfter`, L-10), `null` ohne Anfrage. */
export async function retainUntilFromInquiry(
  req: PayloadRequest,
  inquiry: unknown,
): Promise<string | null> {
  const id = typeof inquiry === 'object' && inquiry ? (inquiry as { id: number }).id : inquiry
  if (id === null || id === undefined || id === '') return null
  const doc = await preservingReq(req, () =>
    req.payload.findByID({
      collection: 'inquiries',
      id: id as number,
      depth: 0,
      select: { deleteAfter: true },
      overrideAccess: true,
      disableErrors: true,
      req,
    }),
  )
  return doc?.deleteAfter ? new Date(doc.deleteAfter).toISOString() : null
}

export const EmailLog: CollectionConfig = {
  slug: 'email-log',
  labels: { singular: 'Mail-Protokoll', plural: 'Mail-Protokoll' },
  admin: {
    group: 'System',
    useAsTitle: 'subject',
    defaultColumns: ['createdAt', 'template', 'subject', 'status'],
    description: 'Welche Mail wann verschickt wurde (ohne Inhalt). Nur lesen.',
  },
  access: { read: isAdmin, create: none, update: none, delete: none },
  defaultSort: '-createdAt',
  fields: [
    {
      name: 'template',
      type: 'select',
      label: 'Vorlage',
      required: true,
      index: true,
      options: enumOptions(EMAIL_TEMPLATES, ENUM_LABELS.EMAIL_TEMPLATES),
    },
    { name: 'to', type: 'email', label: 'Empfänger', required: true },
    {
      name: 'locale',
      type: 'select',
      label: 'Sprache',
      required: true,
      options: enumOptions(LOCALES, ENUM_LABELS.LOCALES),
    },
    { name: 'subject', type: 'text', label: 'Betreff', required: true, maxLength: 200 },
    {
      name: 'status',
      type: 'select',
      label: 'Status',
      required: true,
      index: true,
      defaultValue: 'queued',
      options: enumOptions(EMAIL_STATUSES, ENUM_LABELS.EMAIL_STATUSES),
    },
    {
      name: 'transport',
      type: 'select',
      label: 'Versandweg',
      options: enumOptions(EMAIL_TRANSPORTS, ENUM_LABELS.EMAIL_TRANSPORTS),
      admin: { readOnly: true },
    },
    { name: 'messageId', type: 'text', label: 'Message-ID', admin: { readOnly: true } },
    {
      name: 'smtpResponse',
      type: 'text',
      label: 'Antwort des Mailservers',
      maxLength: 300,
      admin: { readOnly: true },
    },
    { name: 'sentAt', type: 'date', label: 'Gesendet am', admin: { readOnly: true } },
    {
      name: 'attempts',
      type: 'number',
      label: 'Versuche',
      defaultValue: 0,
      min: 0,
      admin: { readOnly: true },
    },
    {
      name: 'lastError',
      type: 'text',
      label: 'Letzter Fehler',
      maxLength: 1000,
      admin: { readOnly: true },
    },
    {
      name: 'attachments',
      type: 'array',
      label: 'Anhänge',
      admin: { readOnly: true },
      fields: [
        { name: 'filename', type: 'text', required: true },
        { name: 'sha256', type: 'text', required: true },
        { name: 'sizeBytes', type: 'number', required: true, min: 0 },
      ],
    },
    { name: 'templateVersion', type: 'text', label: 'Vorlagen-Version', admin: { readOnly: true } },
    { name: 'bodySha256', type: 'text', label: 'Prüfsumme Inhalt', admin: { readOnly: true } },
    {
      name: 'retainUntil',
      type: 'date',
      label: 'Aufbewahren bis',
      required: true,
      index: true,
      admin: { readOnly: true, position: 'sidebar' },
    },
    {
      name: 'order',
      type: 'relationship',
      label: 'Bestellung',
      relationTo: 'orders',
      index: true,
      admin: { readOnly: true },
    },
    {
      name: 'withdrawal',
      type: 'relationship',
      label: 'Widerruf',
      relationTo: 'withdrawals',
      index: true,
      admin: { readOnly: true },
    },
    {
      name: 'inquiry',
      type: 'relationship',
      label: 'Anfrage',
      relationTo: 'inquiries',
      index: true,
      admin: { readOnly: true },
    },
    ...seedField(),
  ],
  hooks: {
    beforeValidate: [
      async ({ operation, data, originalDoc, req }) => {
        if (!data) return data
        if (
          operation === 'create' &&
          typeof data.to === 'string' &&
          isSuppressedRecipient(data.to)
        ) {
          data.status = 'suppressed'
        }
        // L-12: ohne Bezug Versand + 90 Tage (vor dem Versand ab Anlage); mit Bezug die Frist des Bezugsobjekts.
        const doc = { ...(originalDoc ?? {}), ...data } as Record<string, unknown>
        if ((operation === 'create' || 'order' in data) && data.order && !data.retainUntil) {
          const base = doc.createdAt ? new Date(doc.createdAt as string) : new Date()
          const until = await retainUntilFromOrder(req, data.order, base)
          if (until) data.retainUntil = until
        }
        if (
          (operation === 'create' || 'withdrawal' in data) &&
          data.withdrawal &&
          !data.retainUntil
        ) {
          const id = typeof data.withdrawal === 'object' ? data.withdrawal.id : data.withdrawal
          const w = await preservingReq(req, () =>
            req.payload.findByID({
              collection: 'withdrawals',
              id,
              depth: 0,
              select: { retainUntil: true },
              overrideAccess: true,
              disableErrors: true,
              req,
            }),
          )
          if (w?.retainUntil) data.retainUntil = w.retainUntil
        }
        if ((operation === 'create' || 'inquiry' in data) && data.inquiry && !data.retainUntil) {
          const until = await retainUntilFromInquiry(req, data.inquiry)
          if (until) data.retainUntil = until
        }
        const related = RELATION_FIELDS.some((f) => doc[f])
        if (!related && (operation === 'create' || 'sentAt' in data)) {
          const base = doc.sentAt ?? doc.createdAt
          const at = base ? new Date(base as string) : new Date()
          data.retainUntil = retainUntil(L_12_EMAIL_LOG_UNRELATED, at).toISOString()
        }
        return data
      },
    ],
    beforeChange: [
      immutableFields([
        'status',
        'transport',
        'messageId',
        'smtpResponse',
        'sentAt',
        'attempts',
        'lastError',
        'attachments',
        'templateVersion',
        'bodySha256',
        'retainUntil',
        ...RELATION_FIELDS,
      ]),
    ],
  },
}
