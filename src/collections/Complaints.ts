import type {
  CollectionAfterChangeHook,
  CollectionBeforeChangeHook,
  CollectionBeforeValidateHook,
  CollectionConfig,
} from 'payload'

import { isAdmin } from '@/access'
import { seedField } from '@/fields'
import { writeAudit } from '@/lib/audit'
import { ENUM_LABELS, enumOptions } from '@/lib/enumLabels'
import {
  COMPLAINT_KINDS,
  COMPLAINT_REMEDIES,
  COMPLAINT_STATUSES,
  type ComplaintKind,
  type ComplaintRemedy,
} from '@/lib/enums'
import { complaintDeadlines } from '@/lib/legal/complaints'
import { getAppContext, requestNow } from '@/lib/payload/context'
import { preservingReq } from '@/lib/payload/localReq'

import { failField, groupOf, idOf, rejectChanges } from './hooks/commerce'
import { changedFields } from './hooks/immutable'

// DATENMODELL §6.29 – Reklamationen (R-110, R-111, R-112): Akte je Bestellung (Transportschaden oder Mangel) mit
// Eingang, Fotos, Abhilfe, Wahl der Kund:in, Fristen und versendeten Vorlagen. Personendaten: keine Versionen, kein
// `trash` (R-154). Aufbewahrung mit der Bestellung (L-09, `retentionOrders`).

const SLUG = 'complaints'
const fail = (message: string, path: string): never => failField(SLUG, message, path)
const ro = { readOnly: true } as const

type Doc = Record<string, unknown>

/** Felder, deren Änderung im Audit `complaint_changed` steht (ohne Freitexte, LOESCHKONZEPT §3.6). */
const AUDITED = [
  'kind',
  'status',
  'remedy',
  'customerChoice',
  'carrierClaimFiledAt',
  'repairChoiceSentAt',
  'vsbgNoticeSentAt',
] as const

const toDate = (v: unknown): Date | null => {
  if (v === null || v === undefined || v === '') return null
  const d = new Date(String(v))
  return Number.isNaN(d.getTime()) ? null : d
}

/** Eingang „heute“, wenn nichts angegeben ist (vor der Pflichtfeld-Prüfung). */
const defaultReceivedAt: CollectionBeforeValidateHook = ({ data, operation, req }) => {
  if (data && operation === 'create' && !data.receivedAt) {
    data.receivedAt = requestNow(req).toISOString()
  }
  return data
}

const computeComplaint: CollectionBeforeChangeHook = async ({
  data,
  originalDoc,
  operation,
  req,
}) => {
  const original = (originalDoc ?? {}) as Doc
  const now = requestNow(req)
  if (operation === 'update') {
    rejectChanges(SLUG, ['order'], original, data as Doc, 'Die Bestellung ist unveränderlich.')
  }
  const orderId = idOf(data.order ?? original.order)
  if (orderId === null || orderId === undefined) fail('Bitte eine Bestellung wählen.', 'order')
  const order = (await preservingReq(req, () =>
    req.payload.findByID({
      collection: 'orders',
      id: orderId!,
      depth: 0,
      overrideAccess: true,
      disableErrors: true,
      req,
    }),
  )) as Doc | null
  if (!order) fail('Bestellung nicht gefunden.', 'order')
  const ts = groupOf(order!, 'timestamps')
  if (operation === 'create' && !ts.paidAt) {
    fail('Reklamationen gibt es nur zu bezahlten Bestellungen.', 'order')
  }

  const receivedAt = toDate(data.receivedAt ?? original.receivedAt) ?? now
  if (receivedAt.getTime() > now.getTime() + 60_000) {
    fail('Der Eingang darf nicht in der Zukunft liegen.', 'receivedAt')
  }
  data.receivedAt = receivedAt.toISOString()

  const customerChoice = (data.customerChoice ??
    original.customerChoice ??
    null) as ComplaintRemedy | null
  if (customerChoice === 'none') fail('„Keine“ ist keine Wahl der Kund:in.', 'customerChoice')
  if (customerChoice && !(data.customerChoiceAt ?? original.customerChoiceAt)) {
    fail('Bitte das Datum der Wahl angeben.', 'customerChoiceAt')
  }

  const photos = (data.photos ?? original.photos ?? []) as unknown[]
  if (Array.isArray(photos) && photos.length > 6) fail('Höchstens 6 Fotos.', 'photos')

  const due = complaintDeadlines({
    kind: (data.kind ?? original.kind ?? 'transport_damage') as ComplaintKind,
    receivedAt,
    customerChoice,
    order: { deliveredAt: ts.deliveredAt as string, pickedUpAt: ts.pickedUpAt as string },
  })
  data.carrierClaimDueAt = due.carrierClaimDueAt?.toISOString() ?? null
  data.warrantyEndsAt = due.warrantyEndsAt?.toISOString() ?? null
  return data
}

const auditComplaint: CollectionAfterChangeHook = async ({ doc, previousDoc, operation, req }) => {
  if (getAppContext(req).seed) return doc
  const prev = (operation === 'create' ? {} : (previousDoc ?? {})) as Doc
  const changed = changedFields(AUDITED, prev, doc as Doc)
  if (operation !== 'create' && changed.length === 0) return doc
  const changes = Object.fromEntries(
    changed.map((f) => [f, [prev[f] ?? null, (doc as Doc)[f] ?? null] as const]),
  )
  await writeAudit(req, {
    action: 'complaint_changed',
    entityCollection: SLUG,
    entityId: doc.id,
    summary:
      operation === 'create'
        ? `Reklamation zu Bestellung ${String(idOf(doc.order))} angelegt`
        : `Reklamation ${String(doc.id)} geändert: ${changed.join(', ')}`,
    changes,
    seed: doc.seed ?? false,
  })
  return doc
}

export const Complaints: CollectionConfig = {
  slug: SLUG,
  labels: { singular: 'Reklamation', plural: 'Reklamationen' },
  admin: {
    group: 'Shop',
    defaultColumns: ['order', 'kind', 'status', 'receivedAt', 'carrierClaimDueAt'],
    description: 'Reklamationsakte je Bestellung (Transportschaden oder Mangel).',
  },
  access: { read: isAdmin, create: isAdmin, update: isAdmin, delete: isAdmin },
  defaultSort: '-receivedAt',
  fields: [
    {
      name: 'order',
      type: 'relationship',
      label: 'Bestellung',
      relationTo: 'orders',
      required: true,
      index: true,
    },
    {
      name: 'kind',
      type: 'select',
      label: 'Art',
      required: true,
      defaultValue: 'transport_damage',
      options: enumOptions(COMPLAINT_KINDS, ENUM_LABELS.COMPLAINT_KINDS),
    },
    { name: 'receivedAt', type: 'date', label: 'Eingang der Reklamation', required: true },
    {
      name: 'description',
      type: 'textarea',
      label: 'Beschreibung',
      maxLength: 2000,
      admin: { description: 'Kurze Beschreibung; keine Gesundheitsangaben.' },
    },
    {
      name: 'affectedItemIds',
      type: 'json',
      label: 'Betroffene Stücke',
      validate: (v: unknown) =>
        v === null ||
        v === undefined ||
        (Array.isArray(v) && v.every((x) => typeof x === 'string' || typeof x === 'number'))
          ? true
          : 'Liste der Positionen erwartet.',
    },
    {
      name: 'photos',
      type: 'upload',
      label: 'Fotos',
      relationTo: 'private-uploads',
      hasMany: true,
      maxRows: 6,
      filterOptions: { purpose: { equals: 'complaint_photo' } },
    },
    {
      name: 'carrierClaimDueAt',
      type: 'date',
      label: 'Bei DHL reklamieren bis',
      admin: { ...ro, description: 'Zustellung + 7 Tage (R-100, § 438 HGB).' },
    },
    { name: 'carrierClaimFiledAt', type: 'date', label: 'Bei DHL reklamiert am' },
    {
      name: 'remedy',
      type: 'select',
      label: 'Abhilfe',
      options: enumOptions(COMPLAINT_REMEDIES, ENUM_LABELS.COMPLAINT_REMEDIES),
    },
    {
      name: 'repairChoiceSentAt',
      type: 'date',
      label: 'Wahl angeboten am',
      admin: { ...ro, description: 'Mail „Reklamation beantworten“ (R-111).' },
    },
    {
      name: 'customerChoice',
      type: 'select',
      label: 'Wahl der Kund:in',
      options: enumOptions(
        COMPLAINT_REMEDIES.filter((r) => r !== 'none'),
        ENUM_LABELS.COMPLAINT_REMEDIES,
      ),
    },
    { name: 'customerChoiceAt', type: 'date', label: 'Gewählt am' },
    {
      name: 'warrantyEndsAt',
      type: 'date',
      label: 'Gewährleistung bis',
      admin: { ...ro, description: 'Übergabe + 2 Jahre; + 12 Monate bei gewählter Reparatur.' },
    },
    {
      name: 'vsbgNoticeSentAt',
      type: 'date',
      label: 'Streitbeilegungshinweis am',
      admin: { ...ro, description: 'Mail § 37 VSBG (R-112).' },
    },
    {
      name: 'status',
      type: 'select',
      label: 'Status',
      required: true,
      defaultValue: 'open',
      index: true,
      options: enumOptions(COMPLAINT_STATUSES, ENUM_LABELS.COMPLAINT_STATUSES),
    },
    { name: 'notes', type: 'textarea', label: 'Notizen (intern)', maxLength: 3000 },
    ...seedField(),
  ],
  hooks: {
    beforeValidate: [defaultReceivedAt],
    beforeChange: [computeComplaint],
    afterChange: [auditComplaint],
  },
}
