import type {
  CollectionAfterChangeHook,
  CollectionBeforeChangeHook,
  CollectionConfig,
} from 'payload'

import { isAdmin, none } from '@/access'
import { seedField } from '@/fields'
import { writeAudit } from '@/lib/audit'
import { ENUM_LABELS, enumOptions } from '@/lib/enumLabels'
import {
  IDENTITY_CHECK_METHODS,
  LOCALES,
  PRIVACY_REQUEST_CHANNELS,
  PRIVACY_REQUEST_STATUSES,
  PRIVACY_REQUEST_TYPES,
  type PrivacyRequestStatus,
} from '@/lib/enums'
import { getAppContext, requestNow } from '@/lib/payload/context'
import { preservingReq } from '@/lib/payload/localReq'
import { privacyRequestDueAt, privacyRequestMaxExtendedDueAt } from '@/lib/privacy/deadlines'
import { privacyExportDeleteAfter, privacyRequestRetainUntil } from '@/lib/retention/policy'
import { addBerlinDays, berlinDayStart } from '@/lib/time'
import { registerUploadReference } from '@/lib/uploads/references'

import { PRIVACY_REQUEST_REF_REGEX } from './DeletionLog'
import { failField, idOf } from './hooks/commerce'

// DATENMODELL §6.26 – Datenschutz-Anfragen (L-17, R-150 bis R-153, LOESCHKONZEPT §5). Jutta legt jede Anfrage an; Frist
// `receivedAt + 1 Monat` (kalendergenau, Europe/Berlin), keine Fristhemmung während der Identitätsprüfung. Keine
// Versionen, kein Löschen außer durch den Task `retentionPrivacyRequests`. Die Nummer DS-JJJJ-NNNN kommt ab P1.26 aus
// `privacy_request_number_seq` (§8.7). Oberfläche, Such-/Export-Aktionen (mit `deletion-log`, `trigger =
// privacy_request`) und der Erinnerungs-Task folgen in P6.

const SLUG = 'privacy-requests'
const fail = (message: string, path: string): never => failField(SLUG, message, path)
const ro = { readOnly: true } as const

type Doc = Record<string, unknown>

/** Erlaubte Statuswechsel (DATENMODELL §6.26). */
export const PRIVACY_REQUEST_TRANSITIONS: Readonly<
  Record<PrivacyRequestStatus, readonly PrivacyRequestStatus[]>
> = {
  received: ['identity_check', 'in_progress'],
  identity_check: ['in_progress', 'rejected'],
  in_progress: ['answered', 'rejected'],
  answered: [],
  rejected: [],
}

const CLOSED: ReadonlySet<PrivacyRequestStatus> = new Set(['answered', 'rejected'])

registerUploadReference({
  target: 'private-uploads',
  collection: SLUG,
  path: 'exportFile',
  label: 'Datenschutz-Anfrage',
  titleField: 'reference',
})

const toDate = (v: unknown): Date | null => {
  if (!v) return null
  const d = new Date(String(v))
  return Number.isNaN(d.getTime()) ? null : d
}
const iso = (d: Date | null) => (d ? d.toISOString() : null)
const textLen = (v: unknown) => (typeof v === 'string' ? v.trim().length : 0)

const guardPrivacyRequest: CollectionBeforeChangeHook = async ({
  data,
  originalDoc,
  operation,
  req,
}) => {
  const ctx = getAppContext(req)
  const original = (originalDoc ?? {}) as Doc
  const now = requestNow(req)
  const endOfToday = berlinDayStart(addBerlinDays(now, 1))

  if (operation === 'create') {
    if (typeof data.reference !== 'string' || !PRIVACY_REQUEST_REF_REGEX.test(data.reference)) {
      fail('Format DS-JJJJ-NNNN.', 'reference')
    }
    if (!ctx.seed) data.status = 'received'
    data.remindersSent = data.remindersSent ?? {}
  } else if (data.reference !== undefined && data.reference !== original.reference) {
    fail('Die Nummer ist unveränderlich.', 'reference')
  }
  if (typeof data.contactEmail === 'string')
    data.contactEmail = data.contactEmail.trim().toLowerCase()

  const merged = { ...original, ...data } as Doc
  if (!Array.isArray(merged.types) || merged.types.length === 0) {
    fail('Bitte mindestens eine Art der Anfrage wählen.', 'types')
  }

  // Eingang und Frist (Art. 12 Abs. 3 DSGVO)
  const receivedAt = toDate(merged.receivedAt) ?? now
  if (!ctx.seed && receivedAt.getTime() >= endOfToday.getTime()) {
    fail('Das Eingangsdatum darf nicht in der Zukunft liegen.', 'receivedAt')
  }
  data.receivedAt = receivedAt.toISOString()
  const dueAt = privacyRequestDueAt(receivedAt)
  data.dueAt = dueAt.toISOString()

  const extended = toDate(merged.extendedDueAt)
  if (extended) {
    if (extended.getTime() > privacyRequestMaxExtendedDueAt(receivedAt).getTime()) {
      fail('Verlängern höchstens um zwei weitere Monate.', 'extendedDueAt')
    }
    const reason = textLen(merged.extensionReason)
    if (reason < 10 || reason > 300) {
      fail('Bitte die Verlängerung begründen (10–300 Zeichen).', 'extensionReason')
    }
    const notified = toDate(merged.extensionNotifiedAt)
    if (!notified) fail('Bitte angeben, wann die Person informiert wurde.', 'extensionNotifiedAt')
    if (notified!.getTime() > dueAt.getTime()) {
      fail(
        'Die Verlängerung muss innerhalb des ersten Monats mitgeteilt werden.',
        'extensionNotifiedAt',
      )
    }
  }

  // Status
  const before = (original.status ?? 'received') as PrivacyRequestStatus
  const status = (merged.status ?? 'received') as PrivacyRequestStatus
  if (operation === 'update' && status !== before && !ctx.seed) {
    if (!PRIVACY_REQUEST_TRANSITIONS[before].includes(status)) {
      fail(`Statuswechsel ${before} → ${status} ist nicht erlaubt.`, 'status')
    }
  }
  if (CLOSED.has(status)) {
    const answeredAt = toDate(merged.answeredAt)
    if (!answeredAt) fail('Bitte das Antwortdatum angeben.', 'answeredAt')
    if (answeredAt!.getTime() < berlinDayStart(receivedAt).getTime()) {
      fail('Die Antwort kann nicht vor dem Eingang liegen.', 'answeredAt')
    }
    if (status === 'rejected' && textLen(merged.resultNote) === 0) {
      fail('Bitte Ergebnis und Begründung notieren.', 'resultNote')
    }
    data.retainUntil = privacyRequestRetainUntil(answeredAt!).toISOString()
  } else {
    data.retainUntil = null
  }

  // Identität
  if (merged.identityVerified === true) {
    if (!merged.identityMethod)
      fail('Bitte angeben, wie die Identität geprüft wurde.', 'identityMethod')
    if (original.identityVerified !== true || !merged.identityVerifiedAt) {
      data.identityVerifiedAt = now.toISOString()
    }
  } else {
    data.identityVerifiedAt = null
  }

  // Exportdatei
  const exportId = idOf(merged.exportFile)
  if (exportId !== null && idOf(original.exportFile) !== exportId) {
    const upload = await preservingReq(req, () =>
      req.payload.findByID({
        collection: 'private-uploads',
        id: exportId,
        depth: 0,
        select: { purpose: true },
        overrideAccess: true,
        disableErrors: true,
        req,
      }),
    )
    if (upload?.purpose !== 'data_export')
      fail('Als Export nur Dateien mit Zweck „DSGVO-Export“.', 'exportFile')
  }
  return data
}

/** Audit ohne Inhalte; Frist der Exportdatei `answeredAt + 30 Tage` (L-17). */
const afterPrivacyRequest: CollectionAfterChangeHook = async ({
  doc,
  previousDoc,
  operation,
  req,
}) => {
  const ctx = getAppContext(req)
  const exportId = idOf(doc.exportFile)
  if (exportId !== null && doc.answeredAt) {
    await preservingReq(req, () =>
      req.payload.update({
        collection: 'private-uploads',
        id: exportId,
        data: {
          relatedPrivacyRequest: doc.id,
          deleteAfter: iso(privacyExportDeleteAfter(new Date(doc.answeredAt))),
        },
        depth: 0,
        overrideAccess: true,
        req,
        context: { ...req.context, system: true },
      }),
    )
  }
  if (ctx.seed) return doc
  const from = operation === 'create' ? null : (previousDoc?.status ?? null)
  const summary =
    from && from !== doc.status
      ? `Datenschutz-Anfrage ${doc.reference}: ${from} → ${doc.status}`
      : `Datenschutz-Anfrage ${doc.reference} ${operation === 'create' ? 'angelegt' : 'bearbeitet'}`
  await writeAudit(req, {
    action: 'privacy_request_changed',
    entityCollection: SLUG,
    entityId: doc.id,
    summary,
    changes: from !== doc.status ? { status: [from, doc.status] } : undefined,
  })
  return doc
}

export const PrivacyRequests: CollectionConfig = {
  slug: SLUG,
  labels: { singular: 'Datenschutz-Anfrage', plural: 'Datenschutz-Anfragen' },
  admin: {
    group: 'System',
    useAsTitle: 'reference',
    defaultColumns: ['reference', 'types', 'status', 'dueAt', 'receivedAt'],
    description:
      'Anfragen zu Auskunft, Löschung usw. (DSGVO). Bitte innerhalb eines Werktags anlegen; Antwort binnen eines Monats.',
  },
  access: { read: isAdmin, create: isAdmin, update: isAdmin, delete: none },
  defaultSort: 'dueAt',
  fields: [
    {
      name: 'reference',
      type: 'text',
      label: 'Nummer',
      required: true,
      unique: true,
      admin: { ...ro, position: 'sidebar' },
    },
    {
      name: 'types',
      type: 'select',
      label: 'Art der Anfrage',
      hasMany: true,
      required: true,
      options: enumOptions(PRIVACY_REQUEST_TYPES, ENUM_LABELS.PRIVACY_REQUEST_TYPES),
    },
    {
      name: 'channel',
      type: 'select',
      label: 'Eingangskanal',
      required: true,
      defaultValue: 'email',
      options: enumOptions(PRIVACY_REQUEST_CHANNELS, ENUM_LABELS.PRIVACY_REQUEST_CHANNELS),
    },
    { name: 'receivedAt', type: 'date', label: 'Eingangsdatum', required: true },
    {
      name: 'dueAt',
      type: 'date',
      label: 'Antwort bis',
      required: true,
      index: true,
      admin: { ...ro, position: 'sidebar' },
    },
    {
      name: 'extendedDueAt',
      type: 'date',
      label: 'Verlängert bis',
      admin: { description: 'Verlängerung um höchstens 2 Monate.' },
    },
    { name: 'extensionReason', type: 'text', label: 'Grund der Verlängerung', maxLength: 300 },
    { name: 'extensionNotifiedAt', type: 'date', label: 'Verlängerung mitgeteilt am' },
    {
      name: 'status',
      type: 'select',
      label: 'Status',
      required: true,
      defaultValue: 'received',
      index: true,
      options: enumOptions(PRIVACY_REQUEST_STATUSES, ENUM_LABELS.PRIVACY_REQUEST_STATUSES),
      admin: { position: 'sidebar' },
    },
    {
      name: 'contactEmail',
      type: 'email',
      label: 'E-Mail der Person',
      required: true,
      index: true,
      admin: { description: 'Antworten nur an eine in den Daten gespeicherte Adresse.' },
    },
    { name: 'contactName', type: 'text', label: 'Name', maxLength: 100 },
    {
      name: 'locale',
      type: 'select',
      label: 'Sprache der Antwort',
      required: true,
      defaultValue: 'de',
      options: enumOptions(LOCALES, ENUM_LABELS.LOCALES),
    },
    { name: 'identityVerified', type: 'checkbox', label: 'Identität geprüft', defaultValue: false },
    {
      name: 'identityMethod',
      type: 'select',
      label: 'Wie geprüft',
      options: enumOptions(IDENTITY_CHECK_METHODS, ENUM_LABELS.IDENTITY_CHECK_METHODS),
      admin: {
        condition: (data) => data?.identityVerified === true,
        description: 'Keine Ausweiskopie außer bei begründeten Zweifeln.',
      },
    },
    { name: 'identityVerifiedAt', type: 'date', label: 'Geprüft am', admin: ro },
    {
      name: 'matchedOrders',
      type: 'relationship',
      label: 'Gefundene Bestellungen',
      relationTo: 'orders',
      hasMany: true,
    },
    {
      name: 'matchedWithdrawals',
      type: 'relationship',
      label: 'Gefundene Widerrufe',
      relationTo: 'withdrawals',
      hasMany: true,
    },
    {
      name: 'matchedInquiries',
      type: 'relationship',
      label: 'Gefundene Anfragen',
      relationTo: 'inquiries',
      hasMany: true,
    },
    {
      name: 'exportFile',
      type: 'upload',
      label: 'Export (ZIP)',
      relationTo: 'private-uploads',
      filterOptions: { purpose: { equals: 'data_export' } },
    },
    { name: 'answeredAt', type: 'date', label: 'Beantwortet am' },
    { name: 'resultNote', type: 'textarea', label: 'Ergebnis', maxLength: 2000 },
    { name: 'remindersSent', type: 'json', label: 'Erinnerungen', admin: { hidden: true } },
    { name: 'adminNotes', type: 'textarea', label: 'Notizen', maxLength: 3000 },
    {
      name: 'retainUntil',
      type: 'date',
      label: 'Aufbewahren bis',
      index: true,
      admin: { ...ro, position: 'sidebar' },
    },
    ...seedField(),
  ],
  hooks: {
    beforeChange: [guardPrivacyRequest],
    afterChange: [afterPrivacyRequest],
  },
}
