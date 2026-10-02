import type {
  CollectionAfterChangeHook,
  CollectionBeforeChangeHook,
  CollectionConfig,
  FieldAccess,
  PayloadRequest,
} from 'payload'

import { isAdmin, none } from '@/access'
import { adminNotesEndpoint } from '@/endpoints/adminNotes'
import { WITHDRAWAL_ADMIN_ENDPOINTS } from '@/endpoints/withdrawals/actions'
import { privacyFields, seedField } from '@/fields'
import { writeAudit } from '@/lib/audit'
import {
  canTransitionWithdrawal,
  WITHDRAWAL_TIMESTAMP_FIELD,
} from '@/lib/commerce/withdrawalTransitions'
import { ENUM_LABELS, enumOptions } from '@/lib/enumLabels'
import {
  LOCALES,
  WITHDRAWAL_CHANNELS,
  WITHDRAWAL_CLOSE_REASONS,
  WITHDRAWAL_MATCH_STATUSES,
  WITHDRAWAL_STATUSES,
  type WithdrawalStatus,
} from '@/lib/enums'
import { getAppContext, requestNow } from '@/lib/payload/context'
import { preservingReq } from '@/lib/payload/localReq'
import { withdrawalRetainUntil } from '@/lib/retention/policy'
import { addBerlinDays, formatBerlin } from '@/lib/time'

import { failField, groupOf, idOf, rejectChanges } from './hooks/commerce'
import { assignSequenceNumber } from './hooks/numbers'
import { auditPrivacyFlags } from './hooks/privacy'

// DATENMODELL §6.11 – Widerrufe (§ 356a BGB, E-44): jede Erklärung unveränderlich mit Server-Zeitstempel, ohne IP und
// User-Agent (R-093). Anlage nur über die Widerrufsfunktion (R26, P6) bzw. die manuelle Erfassung (R-094, P6).
// Die Nummer WR-JJJJ-NNNNN kommt aus `withdrawal_number_seq` (§8.7); Mails und Bestellwechsel (O4/O11)
// folgen mit den Services in P6.

const SLUG = 'withdrawals'
const fail = (message: string, path: string): never => failField(SLUG, message, path)
const ro = { readOnly: true } as const

type Doc = Record<string, unknown>

export const WITHDRAWAL_REFERENCE_RE = /^WR-\d{4}-\d{5,}$/
const ORDER_NUMBER_IN_TEXT = /PC-\d{4}-\d{5}/i

/** Unveränderlich nach dem Eingang (DM-WDR-03). */
export const WITHDRAWAL_IMMUTABLE = [
  'reference',
  'channel',
  'receivedAt',
  'name',
  'contractIdentification',
  'email',
  'itemsText',
  'reason',
  'locale',
  'submissionSnapshot',
] as const

// Feldzugriff: nach dem Anlegen nie änderbar (REST/Verwaltung); die Local API sperrt der Hook.
const lockedAfterCreate: FieldAccess = () => false
const immutable = { access: { update: lockedAfterCreate } }

const textLen =
  (min: number, max: number, required: boolean) =>
  (value: unknown): true | string => {
    const s = typeof value === 'string' ? value.trim() : ''
    if (!s) return required ? 'Pflichtfeld.' : true
    return s.length >= min && s.length <= max ? true : `Bitte ${min}–${max} Zeichen eingeben.`
  }

async function findOrder(req: PayloadRequest, where: object) {
  const res = await preservingReq(req, () =>
    req.payload.find({
      collection: 'orders',
      where: where as never,
      limit: 1,
      depth: 0,
      select: { customer: true, retainUntil: true, orderNumber: true },
      overrideAccess: true,
      req,
    }),
  )
  return res.docs[0] ?? null
}

async function orderRetainUntil(req: PayloadRequest, order: unknown): Promise<Date | null> {
  const id = idOf(order)
  if (id === null) return null
  const doc = await findOrder(req, { id: { equals: id } })
  return doc?.retainUntil ? new Date(doc.retainUntil) : null
}

const guardWithdrawal: CollectionBeforeChangeHook = async ({
  data,
  originalDoc,
  operation,
  req,
}) => {
  const ctx = getAppContext(req)
  const original = (originalDoc ?? {}) as Doc
  const now = requestNow(req)

  if (operation === 'create') {
    if (!ctx.system && !ctx.seed) {
      fail(
        'Widerrufe entstehen nur über die Widerrufsfunktion oder die manuelle Erfassung.',
        'channel',
      )
    }
    if (typeof data.reference !== 'string' || !WITHDRAWAL_REFERENCE_RE.test(data.reference)) {
      fail('Format WR-JJJJ-NNNNN.', 'reference')
    }
    const channel = data.channel ?? 'online_form'
    data.channel = channel
    if (!ctx.seed) {
      if (channel === 'online_form') {
        // Clientwert wird ignoriert: Eingang = Serverzeit (R-093)
        data.receivedAt = now.toISOString()
        if (!data.email) fail('Pflichtfeld.', 'email')
      } else {
        const at = data.receivedAt ? new Date(String(data.receivedAt)) : null
        if (!at || Number.isNaN(at.getTime()))
          fail('Bitte den Zugangszeitpunkt angeben.', 'receivedAt')
        if (at!.getTime() > now.getTime())
          fail('Der Zugang darf nicht in der Zukunft liegen.', 'receivedAt')
      }
      data.status = 'received'
      // Auto-Zuordnung: Bestellnummer im Text und gleiche E-Mail (case-insensitive)
      const match = ORDER_NUMBER_IN_TEXT.exec(String(data.contractIdentification ?? ''))
      const email = typeof data.email === 'string' ? data.email.trim().toLowerCase() : null
      const order =
        match && email
          ? await findOrder(req, { orderNumber: { equals: match[0].toUpperCase() } })
          : null
      // E-Mail ohne Groß-/Kleinschreibung (R-093); die Bestellung speichert sie wie eingegeben
      if (order && order.customer?.email?.trim().toLowerCase() === email) {
        data.order = order.id
        data.matchStatus = 'auto_matched'
      } else if (data.order) {
        data.matchStatus = 'manually_matched'
      } else {
        data.matchStatus = 'needs_manual_match'
      }
    }
    const receivedAt = new Date(String(data.receivedAt))
    if (!data.submissionSnapshot) {
      data.submissionSnapshot = {
        name: data.name ?? null,
        contractIdentification: data.contractIdentification ?? null,
        email: data.email ?? null,
        itemsText: data.itemsText ?? null,
        reason: data.reason ?? null,
        receivedAt: receivedAt.toISOString(),
        receivedAtBerlin: `${formatBerlin(receivedAt, 'dd.MM.yyyy, HH:mm:ss')} Uhr (Europe/Berlin)`,
      }
    }
    // 14 Berliner Kalendertage (gleiche Uhrzeit, auch über die Zeitumstellung, R-094)
    data.refundDueAt = addBerlinDays(receivedAt, 14).toISOString()
  } else if (!ctx.seed) {
    rejectChanges(SLUG, WITHDRAWAL_IMMUTABLE, original, data, 'Der Widerruf ist unveränderlich.')
    const from = original.status as WithdrawalStatus
    const to = (data.status ?? from) as WithdrawalStatus
    if (to !== from) {
      if (!ctx.transition) fail('Der Status ändert sich nur über die Aktionsknöpfe.', 'status')
      if (!canTransitionWithdrawal(from, to)) {
        fail(`Der Widerruf kann nicht von „${from}“ nach „${to}“ wechseln.`, 'status')
      }
      if (to === 'rejected' && req.user?.collection !== 'users') {
        fail('Ablehnen nur durch dich – nie automatisch (R-094).', 'status')
      }
      const field = WITHDRAWAL_TIMESTAMP_FIELD[to]
      if (field) data[field] ??= now.toISOString()
    }
    const newOrder = idOf(data.order)
    if ('order' in data && newOrder !== null && newOrder !== idOf(original.order)) {
      data.matchStatus = 'manually_matched'
    }
  }

  const merged = { ...original, ...data }
  const status = merged.status as WithdrawalStatus
  if (status === 'closed' && !merged.closeReason) fail('Bitte den Grund angeben.', 'closeReason')
  const note = typeof merged.closeNote === 'string' ? merged.closeNote.trim() : ''
  if (
    (status === 'rejected' || merged.closeReason === 'other') &&
    (note.length < 10 || note.length > 300)
  ) {
    fail('Bitte begründen (10–300 Zeichen).', 'closeNote')
  }
  const spam = groupOf(merged, 'spam')
  if (spam.markedAt) {
    const reason = typeof spam.reason === 'string' ? spam.reason.trim() : ''
    if (reason.length < 10 || reason.length > 300) {
      fail('Markierung „Test/Spam“ nur mit Begründung (10–300 Zeichen).', 'spam.reason')
    }
  }
  data.retainUntil = withdrawalRetainUntil({
    receivedAt: new Date(String(merged.receivedAt)),
    orderRetainUntil: await orderRetainUntil(req, merged.order),
    spamMarkedAt: spam.markedAt ? new Date(String(spam.markedAt)) : null,
  }).toISOString()
  return data
}

const afterWithdrawalChange: CollectionAfterChangeHook = async ({
  doc,
  previousDoc,
  operation,
  req,
}) => {
  if (getAppContext(req).seed) return doc
  if (operation === 'create') {
    await writeAudit(req, {
      action: 'withdrawal_received',
      entityCollection: SLUG,
      entityId: doc.id,
      summary: `Widerruf ${doc.reference} eingegangen (${doc.channel})`,
      changes: { status: [null, doc.status] },
      transition: 'W1',
    })
    return doc
  }
  if (previousDoc && idOf(previousDoc.order) !== idOf(doc.order) && doc.order) {
    await writeAudit(req, {
      action: 'withdrawal_matched',
      entityCollection: SLUG,
      entityId: doc.id,
      summary: `Widerruf ${doc.reference} einer Bestellung zugeordnet`,
      transition: 'W2',
    })
  }
  if (previousDoc && previousDoc.status !== doc.status) {
    await writeAudit(req, {
      action: 'withdrawal_status_changed',
      entityCollection: SLUG,
      entityId: doc.id,
      summary: `Widerruf ${doc.reference}: ${previousDoc.status} → ${doc.status}`,
      changes: { status: [previousDoc.status, doc.status] },
    })
  }
  return doc
}

export const Withdrawals: CollectionConfig = {
  slug: SLUG,
  labels: { singular: 'Widerruf', plural: 'Widerrufe' },
  admin: {
    group: 'Shop',
    useAsTitle: 'reference',
    defaultColumns: ['reference', 'receivedAt', 'status', 'matchStatus', 'refundDueAt'],
  },
  access: { read: isAdmin, update: isAdmin, create: none, delete: none },
  defaultSort: '-receivedAt',
  fields: [
    {
      name: 'reference',
      type: 'text',
      label: 'Nummer',
      required: true,
      unique: true,
      admin: ro,
      ...immutable,
    },
    {
      name: 'channel',
      type: 'select',
      label: 'Eingangskanal',
      required: true,
      defaultValue: 'online_form',
      options: enumOptions(WITHDRAWAL_CHANNELS, ENUM_LABELS.WITHDRAWAL_CHANNELS),
      admin: ro,
      ...immutable,
    },
    {
      name: 'receivedAt',
      type: 'date',
      label: 'Eingegangen am',
      required: true,
      index: true,
      admin: { ...ro, date: { pickerAppearance: 'dayAndTime' } },
      ...immutable,
    },
    { name: 'name', type: 'text', label: 'Name', validate: textLen(2, 100, true), ...immutable },
    {
      name: 'contractIdentification',
      type: 'textarea',
      label: 'Vertrag (Bestellnummer o. Ä.)',
      validate: textLen(3, 500, true),
      ...immutable,
    },
    { name: 'email', type: 'email', label: 'E-Mail', index: true, ...immutable },
    {
      name: 'itemsText',
      type: 'textarea',
      label: 'Betroffene Stücke',
      maxLength: 1000,
      ...immutable,
    },
    {
      name: 'reason',
      type: 'textarea',
      label: 'Grund (freiwillig)',
      maxLength: 2000,
      ...immutable,
    },
    {
      name: 'locale',
      type: 'select',
      label: 'Sprache',
      required: true,
      options: enumOptions(LOCALES, ENUM_LABELS.LOCALES),
      ...immutable,
    },
    {
      name: 'submissionSnapshot',
      type: 'json',
      label: 'Übermittelt',
      required: true,
      admin: ro,
      ...immutable,
    },
    { name: 'order', type: 'relationship', label: 'Bestellung', relationTo: 'orders', index: true },
    {
      name: 'matchStatus',
      type: 'select',
      label: 'Zuordnung',
      required: true,
      options: enumOptions(WITHDRAWAL_MATCH_STATUSES, ENUM_LABELS.WITHDRAWAL_MATCH_STATUSES),
      admin: ro,
    },
    { name: 'affectedItemIds', type: 'json', label: 'Betroffene Positionen' },
    {
      name: 'status',
      type: 'select',
      label: 'Status',
      required: true,
      defaultValue: 'received',
      index: true,
      options: enumOptions(WITHDRAWAL_STATUSES, ENUM_LABELS.WITHDRAWAL_STATUSES),
      admin: ro,
    },
    { name: 'confirmationSentAt', type: 'date', label: 'Bestätigt am', admin: ro },
    {
      name: 'confirmationEmail',
      type: 'relationship',
      label: 'Eingangsbestätigung',
      relationTo: 'email-log',
      admin: ro,
    },
    {
      name: 'refundDueAt',
      type: 'date',
      label: 'Erstattung fällig bis',
      required: true,
      admin: ro,
    },
    {
      name: 'returnTrackingNumber',
      type: 'text',
      label: 'Sendungsnummer Rücksendung',
      maxLength: 40,
    },
    {
      name: 'returnProofReceivedAt',
      type: 'date',
      label: 'Rücksendenachweis liegt vor seit',
      // „≤ heute“ gegen die Uhr des Requests (injizierte Zeit in Tests und Jobs)
      validate: (v: unknown, { req }: { req: PayloadRequest }) =>
        !v || new Date(String(v)).getTime() <= requestNow(req).getTime() + 60_000
          ? true
          : 'Nicht in der Zukunft.',
    },
    { name: 'goodsReturnedAt', type: 'date', label: 'Ware zurück am', admin: ro },
    {
      name: 'returnConditionNote',
      type: 'textarea',
      label: 'Zustand der Rücksendung',
      maxLength: 500,
      admin: { description: 'Notiz bei „Ware ist zurück“ (KONZEPT §7.10).' },
    },
    { name: 'refundedAt', type: 'date', label: 'Erstattet am', admin: ro },
    { name: 'closedAt', type: 'date', label: 'Abgeschlossen am', admin: ro },
    { name: 'rejectedAt', type: 'date', label: 'Abgelehnt am', admin: ro },
    {
      name: 'closeReason',
      type: 'select',
      label: 'Grund für den Abschluss',
      options: enumOptions(WITHDRAWAL_CLOSE_REASONS, ENUM_LABELS.WITHDRAWAL_CLOSE_REASONS),
    },
    { name: 'closeNote', type: 'text', label: 'Begründung', maxLength: 300 },
    { name: 'deadlineReminderSentAt', type: 'date', label: 'Erinnert am', admin: ro },
    {
      name: 'spam',
      type: 'group',
      label: 'Test/Spam',
      fields: [
        { name: 'markedAt', type: 'date', label: 'Markiert am', admin: ro },
        { name: 'reason', type: 'text', label: 'Begründung', maxLength: 300 },
      ],
    },
    { name: 'adminNotes', type: 'textarea', label: 'Interne Notiz', maxLength: 2000 },
    privacyFields(),
    {
      name: 'retainUntil',
      type: 'date',
      label: 'Aufbewahren bis',
      index: true,
      admin: { ...ro, position: 'sidebar' },
    },
    ...seedField(),
  ],
  endpoints: [...WITHDRAWAL_ADMIN_ENDPOINTS, adminNotesEndpoint(SLUG, 2000)],
  hooks: {
    beforeValidate: [assignSequenceNumber('reference', 'withdrawal')],
    beforeChange: [guardWithdrawal],
    afterChange: [afterWithdrawalChange, auditPrivacyFlags(SLUG)],
  },
}

export const WITHDRAWALS_SLUG = SLUG
