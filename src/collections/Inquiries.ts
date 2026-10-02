import type {
  CollectionAfterChangeHook,
  CollectionBeforeChangeHook,
  CollectionBeforeDeleteHook,
  CollectionConfig,
} from 'payload'

import { isAdmin, none } from '@/access'
import { adminNotesEndpoint } from '@/endpoints/adminNotes'
import { inquiryActionEndpoints } from '@/endpoints/inquiries/actions'
import { privacyFields, seedField } from '@/fields'
import { writeAudit } from '@/lib/audit'
import { ENUM_LABELS, enumOptions } from '@/lib/enumLabels'
import { INQUIRY_OBJECT_TYPES, INQUIRY_STATUSES, LOCALES, type InquiryStatus } from '@/lib/enums'
import { canTransitionInquiry } from '@/lib/inquiries/transitions'
import { getActiveLegalText } from '@/lib/legal/getActive'
import { getAppContext, requestNow } from '@/lib/payload/context'
import { preservingReq } from '@/lib/payload/localReq'
import { inquiryDeleteAfter } from '@/lib/retention/policy'
import { formatBerlin } from '@/lib/time'
import { registerUploadReference } from '@/lib/uploads/references'

import { failField, idOf, rejectChanges } from './hooks/commerce'
import { assignSequenceNumber } from './hooks/numbers'

// DATENMODELL §6.17 – Anfragen Auftragsarbeiten (E-11). Anlage nur über den Route-Handler des Formulars (P7,
// `create: none` für REST); die Nummer AA-JJJJ-NNNN kommt aus `inquiry_number_seq` (§8.7). Mails
// (`inquiry_receipt`, `admin_inquiry_received`) folgen in P7; Statuswechsel nur über `INQUIRY_TRANSITIONS`
// (`src/lib/inquiries/transitions.ts`) mit den Knöpfen der Ansicht „Anfragen“ (P5.20).
// Löschung `createdAt + 6 Monate` (L-10), unabhängig vom Bearbeitungsstand; nur verkürzbar.

const SLUG = 'inquiries'
const fail = (message: string, path: string): never => failField(SLUG, message, path)
const ro = { readOnly: true } as const

type Doc = Record<string, unknown>

export const INQUIRY_REFERENCE_RE = /^AA-\d{4}-\d{4,}$/
/** Höchstzahl Referenzbilder (E-11). */
export const INQUIRY_MAX_IMAGES = 5

registerUploadReference({
  target: 'private-uploads',
  collection: SLUG,
  path: 'referenceImages',
  label: 'Anfrage',
  titleField: 'reference',
})

const len =
  (min: number, max: number, required = true) =>
  (value: unknown): true | string => {
    const s = typeof value === 'string' ? value.trim() : ''
    if (!s) return required ? 'Pflichtfeld.' : true
    return s.length >= min && s.length <= max ? true : `Bitte ${min}–${max} Zeichen eingeben.`
  }

const toDate = (v: unknown): Date | null => {
  if (!v) return null
  const d = new Date(String(v))
  return Number.isNaN(d.getTime()) ? null : d
}

const guardInquiry: CollectionBeforeChangeHook = async ({ data, originalDoc, operation, req }) => {
  const ctx = getAppContext(req)
  const original = (originalDoc ?? {}) as Doc
  const now = requestNow(req)

  if (typeof data.reference === 'string' && !INQUIRY_REFERENCE_RE.test(data.reference)) {
    fail('Format AA-JJJJ-NNNN.', 'reference')
  }
  if (typeof data.email === 'string') data.email = data.email.trim().toLowerCase()

  const merged = { ...original, ...data } as Doc
  if (merged.objectType === 'sonstiges') {
    const other = typeof merged.objectTypeOther === 'string' ? merged.objectTypeOther.trim() : ''
    if (!other) fail('Bitte kurz beschreiben, um welchen Gegenstand es geht.', 'objectTypeOther')
  }

  if (operation === 'create') {
    if (!ctx.system && !ctx.seed) {
      fail('Anfragen entstehen nur über das Anfrageformular.', 'reference')
    }
    if (typeof data.reference !== 'string') fail('Format AA-JJJJ-NNNN.', 'reference')
    const createdAt = ctx.seed ? (toDate(data.createdAt) ?? now) : now
    data.status = ctx.seed && data.status ? data.status : 'new'
    data.lastActivityAt = createdAt.toISOString()
    const until = inquiryDeleteAfter(createdAt)
    const requested = toDate(data.deleteAfter)
    data.deleteAfter = (requested && requested < until ? requested : until).toISOString()
    // Nachweis des Datenschutzhinweises (Art. 13 DSGVO): aktive Datenschutzerklärung beim Absenden
    if (!data.privacyNoticeVersion) {
      const active = await getActiveLegalText('datenschutz', now, { req })
      if (!active)
        fail('Es gibt keine veröffentlichte Datenschutzerklärung.', 'privacyNoticeVersion')
      data.privacyNoticeVersion = active!.id
    }
    return data
  }

  rejectChanges(
    SLUG,
    [
      'reference',
      'name',
      'email',
      'idea',
      'objectType',
      'objectTypeOther',
      'desiredTimeframe',
      'budget',
      'locale',
      'privacyNoticeVersion',
    ],
    original,
    data as Doc,
    'Angaben der Anfrage sind unveränderlich.',
  )
  // Status nur über die Übergänge (INQUIRY_TRANSITIONS, Knöpfe in „Anfragen“, P5.20)
  if ('status' in data && data.status !== original.status && !ctx.seed) {
    if (!ctx.transition) fail('Den Status ändert nur die Bearbeitung der Anfrage.', 'status')
    const from = original.status as InquiryStatus
    const to = data.status as InquiryStatus
    if (!canTransitionInquiry(from, to)) {
      fail(`Die Anfrage kann nicht von „${from}“ nach „${to}“ wechseln.`, 'status')
    }
  }
  // Löschfrist: nur verkürzbar (Legal Hold schiebt die Löschung im Task auf)
  const before = toDate(original.deleteAfter)
  const requested = toDate(data.deleteAfter)
  if ('deleteAfter' in data && before && (!requested || requested > before)) {
    fail(
      `Die Löschfrist kann nur verkürzt werden (spätestens ${formatBerlin(before, 'dd.MM.yyyy')}).`,
      'deleteAfter',
    )
  }
  // Anzeige „zuletzt bearbeitet“ (verlängert die Frist nicht)
  const statusChanged = 'status' in data && data.status !== original.status
  const notesChanged =
    'adminNotes' in data && (data.adminNotes ?? '') !== (original.adminNotes ?? '')
  if (statusChanged || notesChanged) data.lastActivityAt = now.toISOString()
  return data
}

const auditStatus: CollectionAfterChangeHook = async ({ doc, previousDoc, operation, req }) => {
  if (operation !== 'update' || !previousDoc || doc.status === previousDoc.status) return doc
  await writeAudit(req, {
    action: 'inquiry_status_changed',
    entityCollection: SLUG,
    entityId: doc.id,
    summary: `Anfrage ${doc.reference}: ${previousDoc.status} → ${doc.status}`,
    changes: { status: [previousDoc.status, doc.status] },
    transition: getAppContext(req).transition,
    seed: doc.seed ?? false,
  })
  return doc
}

/** Referenzbilder mit der Anfrage löschen (Speicherobjekte über den Upload-Hook). */
const deleteImages: CollectionBeforeDeleteHook = async ({ id, req }) => {
  const doc = await preservingReq(req, () =>
    req.payload.findByID({
      collection: SLUG,
      id,
      depth: 0,
      overrideAccess: true,
      disableErrors: true,
      req,
    }),
  )
  const ids = ((doc?.referenceImages as unknown[] | undefined) ?? [])
    .map(idOf)
    .filter((v): v is number => typeof v === 'number')
  if (ids.length === 0) return
  // Verweis zuerst lösen, sonst sperrt die Anfrage selbst das Löschen ihrer Bilder.
  await preservingReq(req, () =>
    req.payload.update({
      collection: SLUG,
      id,
      data: { referenceImages: [] },
      depth: 0,
      overrideAccess: true,
      req,
      context: { ...req.context, system: true },
    }),
  )
  for (const imageId of ids) {
    await preservingReq(req, () =>
      req.payload.delete({
        collection: 'private-uploads',
        id: imageId,
        overrideAccess: true,
        req,
        context: { ...req.context, system: true },
      }),
    )
  }
}

export const Inquiries: CollectionConfig = {
  slug: SLUG,
  labels: { singular: 'Anfrage', plural: 'Anfragen (Auftragsarbeiten)' },
  admin: {
    group: 'Anfragen',
    useAsTitle: 'reference',
    defaultColumns: ['reference', 'objectType', 'status', 'lastActivityAt', 'deleteAfter'],
    description:
      'Anfragen aus dem Formular. Sie werden 6 Monate nach Eingang automatisch gelöscht.',
  },
  access: { read: isAdmin, create: none, update: isAdmin, delete: isAdmin },
  defaultSort: '-createdAt',
  fields: [
    {
      name: 'reference',
      type: 'text',
      label: 'Nummer',
      required: true,
      unique: true,
      admin: { ...ro, position: 'sidebar' },
    },
    { name: 'name', type: 'text', label: 'Name', required: true, validate: len(2, 100) },
    { name: 'email', type: 'email', label: 'E-Mail', required: true, index: true },
    {
      name: 'idea',
      type: 'textarea',
      label: 'Was stellst du dir vor?',
      required: true,
      validate: len(20, 3000),
    },
    {
      name: 'objectType',
      type: 'select',
      label: 'Gegenstand',
      required: true,
      options: enumOptions(INQUIRY_OBJECT_TYPES, ENUM_LABELS.INQUIRY_OBJECT_TYPES),
    },
    {
      name: 'objectTypeOther',
      type: 'text',
      label: 'Gegenstand (sonstiges)',
      maxLength: 80,
      admin: { condition: (data) => data?.objectType === 'sonstiges' },
    },
    { name: 'desiredTimeframe', type: 'text', label: 'Wunschzeitraum', maxLength: 120 },
    { name: 'budget', type: 'text', label: 'Budget', maxLength: 60 },
    {
      name: 'referenceImages',
      type: 'upload',
      label: 'Referenzbilder',
      relationTo: 'private-uploads',
      hasMany: true,
      maxRows: INQUIRY_MAX_IMAGES,
      filterOptions: { purpose: { equals: 'commission_reference' } },
    },
    {
      name: 'locale',
      type: 'select',
      label: 'Sprache',
      required: true,
      options: enumOptions(LOCALES, ENUM_LABELS.LOCALES),
    },
    {
      name: 'privacyNoticeVersion',
      type: 'relationship',
      label: 'Datenschutzhinweis (Fassung)',
      relationTo: 'legal-texts',
      required: true,
      admin: ro,
    },
    {
      name: 'status',
      type: 'select',
      label: 'Status',
      required: true,
      defaultValue: 'new',
      index: true,
      options: enumOptions(INQUIRY_STATUSES, ENUM_LABELS.INQUIRY_STATUSES),
      // Wechsel nur über die Status-Knöpfe der Ansicht „Anfragen“ (P5.20)
      admin: { position: 'sidebar', readOnly: true },
    },
    {
      name: 'lastActivityAt',
      type: 'date',
      label: 'Zuletzt bearbeitet',
      required: true,
      admin: { ...ro, position: 'sidebar' },
    },
    {
      name: 'deleteAfter',
      type: 'date',
      label: 'Wird gelöscht am',
      required: true,
      index: true,
      admin: { position: 'sidebar', description: 'Nur verkürzbar („Jetzt löschen“).' },
    },
    { name: 'adminNotes', type: 'textarea', label: 'Notizen', maxLength: 3000 },
    privacyFields(),
    ...seedField(),
  ],
  endpoints: [adminNotesEndpoint(SLUG, 3000), ...inquiryActionEndpoints],
  hooks: {
    beforeValidate: [assignSequenceNumber('reference', 'inquiry')],
    beforeChange: [guardInquiry],
    afterChange: [auditStatus],
    beforeDelete: [deleteImages],
  },
}
