import {
  APIError,
  ValidationError,
  type CollectionAfterDeleteHook,
  type CollectionBeforeChangeHook,
  type CollectionBeforeDeleteHook,
  type CollectionBeforeOperationHook,
  type CollectionConfig,
  type PayloadRequest,
} from 'payload'

import { isAdmin, isAdminRequest } from '@/access'
import { seedField } from '@/fields'
import { writeAudit } from '@/lib/audit'
import { ENUM_LABELS, enumOptions } from '@/lib/enumLabels'
import {
  PRIVATE_UPLOAD_PURPOSES,
  PRIVATE_UPLOAD_STATUSES,
  PRODUCT_CATEGORIES,
  type InvoiceRetentionYears,
  type PrivateUploadPurpose,
  type PrivateUploadStatus,
} from '@/lib/enums'
import { MediaFileError } from '@/lib/media/pipeline'
import { getAppContext, requestNow } from '@/lib/payload/context'
import {
  EVIDENCE_PURPOSES,
  L_06_INVOICES_DEFAULT_YEARS,
  privateUploadRetention,
} from '@/lib/retention/policy'
import { parseInvoiceYears } from '@/lib/settings/rules'
import { uploadStorage } from '@/lib/storage'
import { formatBerlin } from '@/lib/time'
import {
  PRIVATE_UPLOAD_MIME_TYPES,
  fileBuffer,
  normalizePrivateFile,
  sha256Hex,
} from '@/lib/uploads/files'
import { findUploadReferences, formatUploadReferenceMessage } from '@/lib/uploads/references'

// DATENMODELL §6.4 – private Dateien (Referenzbilder, Packfotos, Nachweise, Beleg-PDFs, Exporte). Privater Speicher
// (`.data/private` bzw. S3_PRIVATE_BUCKET), Auslieferung nur angemeldet (bei `s3` signiert, ≤ 300 s; R-136).
// Keine Versionen/Drafts (Personendaten, R-154). `relatedComplaint` ergänzt P6 (DATENMODELL §10.1).

const SLUG = 'private-uploads'
const SHA256_RE = /^[a-f0-9]{64}$/

/** Zwecke mit Ablage „Unterlagen je Kategorie“ (R-203). */
/** Zwecke mit Bestellbezug (Frist aus der Bestellung, L-05 Stufe C bzw. L-09). */
export const ORDER_PURPOSES: ReadonlySet<PrivateUploadPurpose> = new Set<PrivateUploadPurpose>([
  'packing_photo',
  'return_photo',
  'complaint_photo',
])

/** Beleg-PDFs mit Bezug auf `invoices` (L-06). */
export const INVOICE_PDF_PURPOSES: ReadonlySet<PrivateUploadPurpose> =
  new Set<PrivateUploadPurpose>(['invoice_pdf', 'credit_note_pdf'])

export const COMPLIANCE_PURPOSES: ReadonlySet<PrivateUploadPurpose> = new Set<PrivateUploadPurpose>(
  ['nickel_evidence', 'lab_report', 'supplier_document', 'technical_file'],
)

type Doc = {
  id: number | string
  purpose?: PrivateUploadPurpose
  status?: PrivateUploadStatus
  deleteAfter?: string | Date | null
  retainUntil?: string | Date | null
  createdAt?: string
  seed?: boolean | null
}

const toDate = (v: unknown): Date | null => {
  if (v === null || v === undefined || v === '') return null
  const d = v instanceof Date ? v : new Date(String(v))
  return Number.isNaN(d.getTime()) ? null : d
}
const iso = (d: Date | null) => (d ? d.toISOString() : null)

/** Beziehungsfelder, deren Bezugsobjekt die Frist bestimmt (DATENMODELL §6.4, Tabelle „Aufbewahrung je Zweck“). */
const RETENTION_RELATIONS = [
  'relatedInquiry',
  'relatedOrder',
  'relatedInvoice',
  'relatedPrivacyRequest',
  'relatedGalleryItem',
] as const
type RetentionRelation = (typeof RETENTION_RELATIONS)[number]

const relId = (v: unknown): number | string | null => {
  if (v === null || v === undefined || v === '') return null
  if (typeof v === 'object') return ((v as { id?: number | string }).id ?? null) as never
  return v as number | string
}

type Related = Record<string, unknown> & { timestamps?: Record<string, unknown> | null }

async function loadRelated(
  req: PayloadRequest,
  collection: 'inquiries' | 'orders' | 'invoices' | 'privacy-requests' | 'tattoo-gallery',
  id: number | string | null,
): Promise<Related | null> {
  if (id === null || !req.payload.collections[collection]) return null
  return (await req.payload.findByID({
    collection,
    id,
    req,
    depth: 0,
    overrideAccess: true,
    disableErrors: true,
  })) as Related | null
}

/** Bezugsdaten für die Fristberechnung (Anfrage, Bestellung, Beleg, Datenschutz-Anfrage, Galerie-Eintrag). */
async function relatedRetentionInput(
  req: PayloadRequest,
  ids: Record<RetentionRelation, number | string | null>,
) {
  const [inquiry, order, invoice, privacy, gallery] = await Promise.all([
    loadRelated(req, 'inquiries', ids.relatedInquiry),
    loadRelated(req, 'orders', ids.relatedOrder),
    loadRelated(req, 'invoices', ids.relatedInvoice),
    loadRelated(req, 'privacy-requests', ids.relatedPrivacyRequest),
    loadRelated(req, 'tattoo-gallery', ids.relatedGalleryItem),
  ])
  const ts = order?.timestamps ?? {}
  return {
    inquiryCreatedAt: toDate(inquiry?.createdAt),
    orderShippedAt: toDate(ts.shippedAt),
    orderPickedUpAt: toDate(ts.pickedUpAt),
    orderReturnReceivedAt: toDate(ts.returnReceivedAt),
    orderRetainUntil: toDate(order?.retainUntil),
    privacyAnsweredAt: toDate(privacy?.answeredAt),
    galleryEndedAt: toDate(gallery?.consentWithdrawnAt),
    /** Beleg-PDF: dieselbe Frist wie der Beleg (`invoices.retainUntil`, L-06). */
    invoiceRetainUntil: toDate(invoice?.retainUntil),
    invoiceIssueDate: toDate(invoice?.issueDate),
  }
}

function fail(message: string, path: string): never {
  throw new ValidationError({ collection: SLUG, errors: [{ message, path }] })
}

/** Das Global `settings` (fehlt z. B. in isolierten Test-Instanzen). */
function hasSettings(req: PayloadRequest): boolean {
  return req.payload.config.globals.some((g) => g.slug === 'settings')
}

/** Aufbewahrung der Beleg-PDFs (L-06): `settings.retention.invoiceYears`, ohne Global Standard 10. */
export async function resolveInvoiceYears(req: PayloadRequest): Promise<InvoiceRetentionYears> {
  if (!hasSettings(req)) return L_06_INVOICES_DEFAULT_YEARS
  const settings = await req.payload.findGlobal({
    slug: 'settings',
    req,
    depth: 0,
    overrideAccess: true,
  })
  return parseInvoiceYears(settings.retention?.invoiceYears) ?? L_06_INVOICES_DEFAULT_YEARS
}

/** Typprüfung am Inhalt, Größe ≤ 10 MB, Bilder gedreht/verkleinert/ohne Metadaten als JPEG q 85 (R-135). */
const normalizeIncomingFile: CollectionBeforeOperationHook = async ({ args, operation, req }) => {
  if ((operation !== 'create' && operation !== 'update') || !req.file) return args
  try {
    const normalized = await normalizePrivateFile(
      await fileBuffer(req.file),
      req.file.name,
      req.file.mimetype,
    )
    req.file = { ...req.file, ...normalized, tempFilePath: undefined }
  } catch (e) {
    if (e instanceof MediaFileError) fail(e.message, 'file')
    throw e
  }
  return args
}

const validateAndCompute: CollectionBeforeChangeHook = async ({
  data,
  operation,
  originalDoc,
  req,
}) => {
  const ctx = getAppContext(req)
  const privileged = Boolean(ctx.system || ctx.seed)
  const original = (operation === 'update' ? originalDoc : undefined) as Doc | undefined
  const now = requestNow(req)

  // Zweck: nach Anlage unveränderlich
  const purpose = (original?.purpose ?? data.purpose) as PrivateUploadPurpose | undefined
  if (!purpose) fail('Bitte einen Zweck wählen.', 'purpose')
  if (original && data.purpose !== undefined && data.purpose !== original.purpose) {
    fail('Der Zweck einer Datei kann nach dem Hochladen nicht geändert werden.', 'purpose')
  }
  data.purpose = purpose

  // Status: `pending` nur für Formular-Uploads (Referenzbilder) vor dem Absenden
  const status = (data.status ?? original?.status ?? 'attached') as PrivateUploadStatus
  if (status === 'pending') {
    if (purpose !== 'commission_reference') {
      fail('„Noch nicht zugeordnet“ gibt es nur für Referenzbilder aus dem Formular.', 'status')
    }
    if (original?.status === 'attached' && !privileged) {
      fail('Eine zugeordnete Datei kann nicht zurückgesetzt werden.', 'status')
    }
    if (!original && isAdminRequest(req) && !privileged) {
      fail('„Noch nicht zugeordnet“ setzt nur das Anfrageformular.', 'status')
    }
  }
  data.status = status

  // Unterlagen je Kategorie (R-203) und Angaben zu Nachweisen
  const category = data.complianceCategory ?? null
  if (category && !COMPLIANCE_PURPOSES.has(purpose)) {
    fail('Die Kategorie gibt es nur bei Nachweisen und Unterlagen.', 'complianceCategory')
  }
  if (purpose === 'technical_file' && !category) {
    fail('Bei technischen Unterlagen bitte die Kategorie wählen.', 'complianceCategory')
  }
  if (!EVIDENCE_PURPOSES.has(purpose)) {
    if (data.documentVersion) fail('Version nur bei Nachweisen/Unterlagen.', 'documentVersion')
    if (data.documentDate) fail('Datum nur bei Nachweisen/Unterlagen.', 'documentDate')
  }
  const documentDate = toDate(data.documentDate)
  if (documentDate && documentDate.getTime() > now.getTime()) {
    fail('Das Ausstellungsdatum darf nicht in der Zukunft liegen.', 'documentDate')
  }

  // Prüfsumme der gespeicherten Datei
  if (req.file) data.sha256 = sha256Hex(await fileBuffer(req.file))
  else data.sha256 = (originalDoc as { sha256?: string } | undefined)?.sha256 ?? null

  // Beziehungen je Zweck (DATENMODELL §6.4)
  const ids = Object.fromEntries(
    RETENTION_RELATIONS.map((f) => [
      f,
      relId(
        data[f] !== undefined ? data[f] : (original as Record<string, unknown> | undefined)?.[f],
      ),
    ]),
  ) as Record<RetentionRelation, number | string | null>
  const relationChanged = Boolean(
    original &&
    RETENTION_RELATIONS.some(
      (f) => String(relId((original as Record<string, unknown>)[f])) !== String(ids[f]),
    ),
  )
  const related = await relatedRetentionInput(req, ids)

  // Fristen je Zweck (DATENMODELL §6.4, src/lib/retention/policy.ts)
  const createdAt = toDate(original?.createdAt) ?? now
  const computed = privateUploadRetention({
    purpose,
    status,
    createdAt: status === 'attached' && original?.status === 'pending' ? now : createdAt,
    invoiceYears: await resolveInvoiceYears(req),
    recordDate: related.invoiceIssueDate,
    inquiryCreatedAt: related.inquiryCreatedAt,
    orderShippedAt: related.orderShippedAt,
    orderPickedUpAt: related.orderPickedUpAt,
    orderReturnReceivedAt: related.orderReturnReceivedAt,
    orderRetainUntil: related.orderRetainUntil,
    privacyAnsweredAt: related.privacyAnsweredAt,
    galleryEndedAt: related.galleryEndedAt,
  })
  // Beleg-PDF mit Beleg: exakt `invoices.retainUntil` (beim Ausstellen eingefroren, L-06)
  if (INVOICE_PDF_PURPOSES.has(purpose) && related.invoiceRetainUntil) {
    computed.retainUntil = related.invoiceRetainUntil
  }
  const statusChanged = Boolean(original && original.status !== status)
  const previous = toDate(original?.deleteAfter)
  const base =
    !original || statusChanged || relationChanged
      ? computed.deleteAfter
      : (previous ?? computed.deleteAfter)

  let deleteAfter = base
  if (data.deleteAfter !== undefined) {
    const requested = toDate(data.deleteAfter)
    // Payload übergibt bei Updates das ganze Dokument: der bisherige Wert gilt als „nicht geändert“
    const unchanged = Boolean(original) && iso(requested) === iso(previous)
    if (!unchanged) {
      // Admin darf nur verkürzen (leer = nie automatisch löschen gilt als Verlängerung)
      const longer = base !== null && (requested === null || requested.getTime() > base.getTime())
      if (longer && !privileged) {
        fail(
          `Die Löschfrist kann nur verkürzt werden (spätestens ${formatBerlin(base, 'dd.MM.yyyy HH:mm')}).`,
          'deleteAfter',
        )
      }
      deleteAfter = requested
    }
  }
  data.deleteAfter = iso(deleteAfter)

  // Aufbewahrungspflicht (Beleg-PDFs): beim Anlegen berechnet, danach eingefroren; eine spätere Zuordnung zum
  // Beleg kann die Frist nur verlängern (nie verkürzen).
  if (original) {
    const frozen = toDate(original.retainUntil)
    const linked = relationChanged ? computed.retainUntil : null
    data.retainUntil =
      privileged && data.retainUntil !== undefined
        ? iso(toDate(data.retainUntil))
        : iso(linked && (!frozen || linked.getTime() > frozen.getTime()) ? linked : frozen)
  } else {
    data.retainUntil = iso(computed.retainUntil)
  }
  return data
}

/** Beleg-PDFs vor `retainUntil` nie löschen (außer Seed); Nachweise mit bestehendem Verweis ebenfalls nicht. */
const guardDelete: CollectionBeforeDeleteHook = async ({ id, req }) => {
  const doc = (await req.payload.findByID({
    collection: SLUG,
    id,
    req,
    depth: 0,
    overrideAccess: true,
    disableErrors: true,
  })) as Doc | null
  if (!doc || doc.seed) return
  const until = toDate(doc.retainUntil)
  if (until && requestNow(req).getTime() < until.getTime()) {
    throw new APIError(
      `Diese Datei muss aufbewahrt werden und kann erst ab ${formatBerlin(until, 'dd.MM.yyyy')} gelöscht werden.`,
      409,
      null,
      true,
    )
  }
  const refs = await findUploadReferences(req.payload, SLUG, id, req)
  if (hasSettings(req)) {
    // AV-Verträge in `settings.processorAgreements[].file` (DM-40)
    const settings = await req.payload.findGlobal({
      slug: 'settings',
      req,
      depth: 0,
      overrideAccess: true,
    })
    const used = (settings.processorAgreements ?? []).find(
      (a) => String(typeof a.file === 'object' && a.file ? a.file.id : a.file) === String(id),
    )
    if (used) refs.push({ collection: 'settings', label: 'AV-Vertrag', id, title: used.serviceId })
  }
  if (refs.length > 0) throw new APIError(formatUploadReferenceMessage(refs), 409, null, true)
}

/** Audit `private_upload_deleted` – nur ID, Zweck, Datum (keine Dateinamen). */
const auditDelete: CollectionAfterDeleteHook = async ({ doc, id, req }) => {
  const d = doc as Doc
  const purpose = d.purpose
  const label = purpose ? ENUM_LABELS.PRIVATE_UPLOAD_PURPOSES[purpose].de : 'unbekannt'
  await writeAudit(req, {
    action: 'private_upload_deleted',
    entityCollection: SLUG,
    entityId: id,
    summary: `Private Datei ${id} (${label}) gelöscht.`,
    changes: { purpose: [purpose ?? null, null] },
    seed: Boolean(d.seed),
  })
  return doc
}

export const PrivateUploads: CollectionConfig = {
  slug: SLUG,
  labels: { singular: 'Private Datei', plural: 'Private Dateien' },
  admin: {
    useAsTitle: 'filename',
    defaultColumns: ['filename', 'purpose', 'status', 'deleteAfter', 'createdAt'],
    group: 'Dateien',
    description:
      'Nicht öffentliche Dateien (Referenzbilder, Packfotos, Nachweise, Belege). Nur angemeldet abrufbar; Standortdaten werden aus Fotos entfernt. Höchstens 10 MB je Datei.',
  },
  access: {
    read: isAdmin,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  upload: {
    ...uploadStorage('private'),
    mimeTypes: [...PRIVATE_UPLOAD_MIME_TYPES],
    imageSizes: [
      {
        name: 'thumb',
        width: 400,
        withoutEnlargement: true,
        formatOptions: { format: 'webp', options: { quality: 75 } },
      },
    ],
    adminThumbnail: 'thumb',
    focalPoint: false,
    crop: false,
  },
  fields: [
    {
      name: 'purpose',
      type: 'select',
      label: 'Zweck',
      required: true,
      index: true,
      options: enumOptions(PRIVATE_UPLOAD_PURPOSES, ENUM_LABELS.PRIVATE_UPLOAD_PURPOSES),
      admin: {
        position: 'sidebar',
        description: 'Nach dem Hochladen nicht mehr änderbar – bestimmt die Löschfrist.',
      },
    },
    {
      name: 'status',
      type: 'select',
      label: 'Status',
      required: true,
      defaultValue: 'attached',
      index: true,
      options: enumOptions(PRIVATE_UPLOAD_STATUSES, ENUM_LABELS.PRIVATE_UPLOAD_STATUSES),
      admin: { position: 'sidebar', readOnly: true },
    },
    {
      name: 'deleteAfter',
      type: 'date',
      label: 'Wird automatisch gelöscht am',
      index: true,
      admin: {
        position: 'sidebar',
        date: { pickerAppearance: 'dayAndTime' },
        description: 'Wird automatisch berechnet. Du kannst die Frist nur verkürzen.',
      },
    },
    {
      name: 'retainUntil',
      type: 'date',
      label: 'Aufbewahren bis',
      admin: {
        position: 'sidebar',
        readOnly: true,
        description: 'Belege: vorher ist Löschen nicht möglich.',
      },
    },
    {
      name: 'sha256',
      type: 'text',
      label: 'Prüfsumme (SHA-256)',
      admin: { readOnly: true, position: 'sidebar' },
      validate: (value: string | null | undefined) =>
        !value || SHA256_RE.test(value) ? true : 'Ungültige Prüfsumme.',
    },
    {
      name: 'complianceCategory',
      type: 'select',
      label: 'Kategorie (Unterlagen)',
      options: enumOptions(PRODUCT_CATEGORIES, ENUM_LABELS.PRODUCT_CATEGORIES),
      admin: {
        description: 'Nur bei Nachweisen und Unterlagen; bei technischen Unterlagen Pflicht.',
        condition: (data) => COMPLIANCE_PURPOSES.has(data?.purpose as PrivateUploadPurpose),
      },
    },
    {
      name: 'documentVersion',
      type: 'text',
      label: 'Version der Unterlage',
      maxLength: 40,
      admin: {
        description: 'z. B. „Datenblatt 2026-03“',
        condition: (data) => EVIDENCE_PURPOSES.has(data?.purpose as PrivateUploadPurpose),
      },
    },
    {
      name: 'documentDate',
      type: 'date',
      label: 'Ausstellungsdatum',
      admin: {
        condition: (data) => EVIDENCE_PURPOSES.has(data?.purpose as PrivateUploadPurpose),
      },
    },
    {
      name: 'relatedDeclaration',
      type: 'relationship',
      label: 'Konformitätserklärung',
      relationTo: 'conformity-declarations',
      admin: { condition: (data) => data?.purpose === 'lab_report' },
    },
    {
      name: 'relatedOrder',
      type: 'relationship',
      label: 'Bestellung',
      relationTo: 'orders',
      index: true,
      admin: {
        condition: (data) => ORDER_PURPOSES.has(data?.purpose as PrivateUploadPurpose),
        description:
          'Die Löschfrist richtet sich nach Versand, Rückgabe bzw. Aufbewahrung der Bestellung.',
      },
    },
    {
      name: 'relatedProduct',
      type: 'relationship',
      label: 'Stück',
      relationTo: 'products',
      index: true,
      admin: {
        condition: (data) =>
          EVIDENCE_PURPOSES.has(data?.purpose as PrivateUploadPurpose) ||
          ORDER_PURPOSES.has(data?.purpose as PrivateUploadPurpose),
      },
    },
    {
      name: 'relatedInvoice',
      type: 'relationship',
      label: 'Beleg',
      relationTo: 'invoices',
      index: true,
      admin: {
        condition: (data) => INVOICE_PDF_PURPOSES.has(data?.purpose as PrivateUploadPurpose),
        description: 'Aufbewahrung wie der Beleg.',
      },
    },
    {
      name: 'relatedInquiry',
      type: 'relationship',
      label: 'Anfrage',
      relationTo: 'inquiries',
      admin: { condition: (data) => data?.purpose === 'commission_reference' },
    },
    {
      name: 'relatedPrivacyRequest',
      type: 'relationship',
      label: 'Datenschutz-Anfrage',
      relationTo: 'privacy-requests',
      admin: { condition: (data) => data?.purpose === 'data_export' },
    },
    {
      name: 'relatedGalleryItem',
      type: 'relationship',
      label: 'Galerie-Foto',
      relationTo: 'tattoo-gallery',
      admin: { condition: (data) => data?.purpose === 'consent_evidence' },
    },
    { name: 'note', type: 'textarea', label: 'Notiz', maxLength: 500 },
    ...seedField(),
  ],
  hooks: {
    beforeOperation: [normalizeIncomingFile],
    beforeChange: [validateAndCompute],
    beforeDelete: [guardDelete],
    afterDelete: [auditDelete],
  },
}
