import {
  APIError,
  type CollectionAfterChangeHook,
  type CollectionBeforeChangeHook,
  type CollectionBeforeDeleteHook,
  type CollectionConfig,
} from 'payload'

import { isAdmin, none } from '@/access'
import { moneyField, seedField } from '@/fields'
import { writeAudit } from '@/lib/audit'
import {
  INVOICE_NUMBER_RE,
  invoiceSeriesFor,
  nextInvoiceNumber,
} from '@/lib/commerce/invoiceNumber'
import { ENUM_LABELS, enumOptions } from '@/lib/enumLabels'
import {
  INVOICE_SERIES,
  INVOICE_STATUSES,
  INVOICE_TYPES,
  REFUND_REASONS,
  TAX_MODES,
  type InvoiceType,
  type TaxMode,
} from '@/lib/enums'
import { getAppContext, requestNow } from '@/lib/payload/context'
import { preservingReq } from '@/lib/payload/localReq'
import { invoiceRetainUntil, L_06_INVOICES_DEFAULT_YEARS } from '@/lib/retention/policy'
import { parseInvoiceYears } from '@/lib/settings/rules'
import { getTaxModeAt, type TaxSettings } from '@/lib/tax'
import { berlinYear } from '@/lib/time'

import { failField, idOf, rejectChanges } from './hooks/commerce'

// DATENMODELL §6.9 – Rechnungen und Gutschriften (GoBD, E-04). Nummer lückenlos per Zählerzeile (§8.6) in der
// Transaktion der Anlage; Steuermodus je Beleg eingefroren (E-02). Nach `issued` unveränderlich; der DB-Trigger
// (§9.4) folgt in P1.26, PDF-Job `renderInvoicePdf` und `InvoiceDataV1` (zod) in P4.11.

const SLUG = 'invoices'
const fail = (message: string, path: string): never => failField(SLUG, message, path)
const ro = { readOnly: true } as const

type Doc = Record<string, unknown>

/** Nach der Anlage festgeschrieben (Trigger §9.4 spiegelt diese Liste). */
const CORE_FIELDS = [
  'number',
  'type',
  'series',
  'year',
  'sequenceNumber',
  'order',
  'relatedInvoice',
  'issueDate',
  'deliveryDate',
  'taxMode',
  'isKleinunternehmer',
  'totalGrossCents',
  'totalNetCents',
  'totalTaxCents',
  'reason',
  'retainUntil',
  'seed',
] as const
const PDF_FIELDS = ['pdf', 'sha256', 'renderedAt', 'status'] as const

async function loadSettings(req: Parameters<CollectionBeforeChangeHook>[0]['req']): Promise<Doc> {
  if (!req.payload.config.globals.some((g) => g.slug === 'settings')) return {}
  return (await preservingReq(req, () =>
    req.payload.findGlobal({ slug: 'settings', req, depth: 0, overrideAccess: true }),
  )) as unknown as Doc
}

const guardInvoice: CollectionBeforeChangeHook = async ({ data, originalDoc, operation, req }) => {
  const ctx = getAppContext(req)
  const original = (originalDoc ?? {}) as Doc

  if (operation === 'create') {
    const type = data.type as InvoiceType
    const seed = ctx.seed === true || data.seed === true
    const now = requestNow(req)
    const issueDate = seed && data.issueDate ? new Date(String(data.issueDate)) : now
    const settings = await loadSettings(req)
    const taxMode: TaxMode = getTaxModeAt(settings as TaxSettings, issueDate)
    const series = invoiceSeriesFor(type, seed)
    const year = berlinYear(issueDate)

    if (type === 'credit_note') {
      if (!data.reason) fail('Grund der Gutschrift fehlt.', 'reason')
      const parentId = idOf(data.relatedInvoice)
      if (parentId === null) fail('Gutschrift ohne Bezugsrechnung.', 'relatedInvoice')
      const parent = await preservingReq(req, () =>
        req.payload.findByID({
          collection: SLUG,
          id: parentId!,
          depth: 0,
          overrideAccess: true,
          disableErrors: true,
          req,
        }),
      )
      if (!parent || parent.type !== 'invoice' || idOf(parent.order) !== idOf(data.order)) {
        fail('Bezug muss eine Rechnung derselben Bestellung sein.', 'relatedInvoice')
      }
    }
    const gross = data.totalGrossCents as number
    if (taxMode === 'kleinunternehmer') {
      data.totalNetCents ??= gross
      data.totalTaxCents ??= 0
      if (data.totalNetCents !== gross || data.totalTaxCents !== 0) {
        fail('Kleinunternehmer: keine Umsatzsteuer (Netto = Brutto).', 'totalTaxCents')
      }
    } else if (
      typeof data.totalNetCents !== 'number' ||
      typeof data.totalTaxCents !== 'number' ||
      data.totalNetCents + data.totalTaxCents !== gross
    ) {
      fail('Netto + Steuer = Brutto.', 'totalNetCents')
    }
    const payloadData = data.data as Doc | null | undefined
    if (!payloadData || typeof payloadData !== 'object' || payloadData.version !== 1) {
      fail('Belegdaten fehlen (InvoiceDataV1).', 'data')
    }

    const { number, sequenceNumber } = await nextInvoiceNumber(req, series, year, now)
    const years = parseInvoiceYears((settings.retention as Doc | undefined)?.invoiceYears)
    Object.assign(data, {
      number,
      sequenceNumber,
      series,
      year,
      seed,
      issueDate: issueDate.toISOString(),
      taxMode,
      isKleinunternehmer: taxMode === 'kleinunternehmer',
      status: seed && data.status === 'issued' ? 'issued' : 'pending_pdf',
      retainUntil: invoiceRetainUntil(
        issueDate,
        years ?? L_06_INVOICES_DEFAULT_YEARS,
      ).toISOString(),
    })
    return data
  }

  if (ctx.seed) return data
  const anonymize = ctx.transition === 'anonymize'
  rejectChanges(SLUG, CORE_FIELDS, original, data, 'Belege sind unveränderlich (GoBD).')
  if (!anonymize) {
    rejectChanges(
      SLUG,
      ['data', 'anonymizedAt'],
      original,
      data,
      'Belege sind unveränderlich (GoBD).',
    )
  }
  if (original.status === 'issued' && !anonymize) {
    rejectChanges(SLUG, PDF_FIELDS, original, data, 'Das PDF des Belegs ist festgeschrieben.')
  }
  if (data.status !== undefined && data.status !== original.status) {
    if (original.status !== 'pending_pdf' || data.status !== 'issued') {
      fail('Der Belegstatus wechselt nur einmal von „PDF folgt“ nach „ausgestellt“.', 'status')
    }
    const pdf = data.pdf ?? original.pdf
    const sha = data.sha256 ?? original.sha256
    if (!pdf || typeof sha !== 'string' || !/^[0-9a-f]{64}$/.test(sha)) {
      fail('Ausgestellt nur mit PDF und Prüfsumme.', 'pdf')
    }
    data.renderedAt ??= requestNow(req).toISOString()
  }
  return data
}

const afterInvoiceChange: CollectionAfterChangeHook = async ({ doc, previousDoc, req }) => {
  if (getAppContext(req).seed) return doc
  if (doc.status === 'issued' && previousDoc?.status !== 'issued') {
    await writeAudit(req, {
      action: doc.type === 'invoice' ? 'invoice_issued' : 'credit_note_issued',
      entityCollection: SLUG,
      entityId: doc.id,
      summary: `${doc.type === 'invoice' ? 'Rechnung' : 'Gutschrift'} ${doc.number} ausgestellt`,
    })
  }
  return doc
}

const guardInvoiceDelete: CollectionBeforeDeleteHook = async ({ id, req }) => {
  const doc = await preservingReq(req, () =>
    req.payload.findByID({ collection: SLUG, id, depth: 0, overrideAccess: true, req }),
  )
  if (doc.seed !== true) {
    throw new APIError(
      `GoBD: Beleg ${doc.number} darf nicht gelöscht werden (nach Fristende wird anonymisiert, L-06).`,
      403,
      undefined,
      true,
    )
  }
}

export const Invoices: CollectionConfig = {
  slug: SLUG,
  labels: { singular: 'Beleg', plural: 'Rechnungen & Gutschriften' },
  admin: {
    group: 'Shop',
    useAsTitle: 'number',
    defaultColumns: ['number', 'type', 'issueDate', 'totalGrossCents', 'status'],
    description: 'Rechnungen und Gutschriften – unveränderlich (GoBD). Nur lesen.',
  },
  access: { read: isAdmin, create: none, update: none, delete: none },
  defaultSort: '-issueDate',
  indexes: [{ fields: ['year', 'type'] }],
  fields: [
    {
      name: 'number',
      type: 'text',
      label: 'Nummer',
      required: true,
      unique: true,
      admin: ro,
      validate: (v: unknown) =>
        INVOICE_NUMBER_RE.test(String(v)) ? true : 'Format RE-JJJJ-NNNNN bzw. GS-JJJJ-NNNNN.',
    },
    {
      name: 'type',
      type: 'select',
      label: 'Art',
      required: true,
      options: enumOptions(INVOICE_TYPES, ENUM_LABELS.INVOICE_TYPES),
      admin: ro,
    },
    {
      name: 'series',
      type: 'select',
      label: 'Serie',
      required: true,
      options: enumOptions(INVOICE_SERIES, ENUM_LABELS.INVOICE_SERIES),
      admin: ro,
    },
    { name: 'year', type: 'number', label: 'Jahr', required: true, admin: ro },
    {
      name: 'sequenceNumber',
      type: 'number',
      label: 'Laufende Nummer',
      required: true,
      min: 1,
      admin: ro,
    },
    {
      name: 'status',
      type: 'select',
      label: 'Status',
      required: true,
      defaultValue: 'pending_pdf',
      options: enumOptions(INVOICE_STATUSES, ENUM_LABELS.INVOICE_STATUSES),
      admin: ro,
    },
    {
      name: 'order',
      type: 'relationship',
      label: 'Bestellung',
      relationTo: 'orders',
      required: true,
      index: true,
      admin: ro,
    },
    {
      name: 'relatedInvoice',
      type: 'relationship',
      label: 'Bezugsrechnung',
      relationTo: 'invoices',
      admin: ro,
    },
    {
      name: 'issueDate',
      type: 'date',
      label: 'Ausgestellt am',
      required: true,
      index: true,
      admin: ro,
    },
    {
      name: 'deliveryDate',
      type: 'date',
      label: 'Leistungszeitpunkt',
      required: true,
      admin: ro,
    },
    {
      name: 'taxMode',
      type: 'select',
      label: 'Steuermodus',
      required: true,
      options: enumOptions(TAX_MODES, ENUM_LABELS.TAX_MODES),
      admin: ro,
    },
    { name: 'isKleinunternehmer', type: 'checkbox', label: 'Kleinunternehmer', admin: ro },
    {
      ...moneyField('totalGrossCents', { label: 'Brutto', required: true, admin: ro }),
      validate: (v: unknown) =>
        typeof v === 'number' && Number.isInteger(v) && v > 0 ? true : 'Betrag > 0 (ganze Cent).',
    },
    moneyField('totalNetCents', { label: 'Netto', required: true, admin: ro }),
    moneyField('totalTaxCents', { label: 'Steuer', required: true, admin: ro }),
    { name: 'data', type: 'json', label: 'Belegdaten', required: true, admin: ro },
    {
      name: 'pdf',
      type: 'upload',
      label: 'PDF',
      relationTo: 'private-uploads',
      filterOptions: { purpose: { in: ['invoice_pdf', 'credit_note_pdf'] } },
      admin: ro,
    },
    { name: 'sha256', type: 'text', label: 'SHA-256', admin: ro },
    { name: 'renderedAt', type: 'date', label: 'PDF erzeugt am', admin: ro },
    {
      name: 'reason',
      type: 'select',
      label: 'Grund der Gutschrift',
      options: enumOptions(REFUND_REASONS, ENUM_LABELS.REFUND_REASONS),
      admin: ro,
    },
    { name: 'retainUntil', type: 'date', label: 'Aufbewahren bis', required: true, admin: ro },
    { name: 'anonymizedAt', type: 'date', label: 'Anonymisiert am', admin: ro },
    ...seedField(),
  ],
  hooks: {
    beforeChange: [guardInvoice],
    afterChange: [afterInvoiceChange],
    beforeDelete: [guardInvoiceDelete],
  },
}
