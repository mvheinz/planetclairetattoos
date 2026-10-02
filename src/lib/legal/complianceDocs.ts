import 'server-only'

import type { Payload, PayloadRequest } from 'payload'

import { ENUM_LABELS } from '@/lib/enumLabels'
import {
  PRODUCT_CATEGORIES,
  type PrivateUploadPurpose,
  type ProductCategory,
  type ProductStatus,
} from '@/lib/enums'
import { addBerlinMonths } from '@/lib/time'

// Produktsicherheits-Unterlagen (PLAN P5.13, RECHT R-203, LOESCHKONZEPT L-24, DATENMODELL §6.4): Ablage in
// `private-uploads` mit den Zwecken `technical_file`, `supplier_document`, `lab_report`, `nickel_evidence` plus
// `conformity-declarations`. Frist: 10 Jahre nach dem letzten Inverkehrbringen eines Stücks der Kategorie – nur
// Erinnerung (A16 über den Task `complianceDocsReview`), nie automatische Löschung.
//
// Inverkehrbringen je Stück (Annahme, OFFENE-PUNKTE P5.13): solange ein Stück der Kategorie online oder reserviert ist,
// läuft die Frist noch nicht; sonst zählt der späteste Zeitpunkt aus „verkauft“, „ausgeblendet“ und „erstmals
// veröffentlicht“. Unterlagen ohne bestimmbare Kategorie gelten nie als löschbar (konservativ).

export const COMPLIANCE_DOC_PURPOSES = [
  'technical_file',
  'supplier_document',
  'lab_report',
  'nickel_evidence',
] as const satisfies readonly PrivateUploadPurpose[]
export type ComplianceDocPurpose = (typeof COMPLIANCE_DOC_PURPOSES)[number]

/** Aufbewahrung nach dem letzten Inverkehrbringen (L-24): 10 Jahre. */
export const COMPLIANCE_KEEP_MONTHS = 120

export const isComplianceDocPurpose = (v: unknown): v is ComplianceDocPurpose =>
  (COMPLIANCE_DOC_PURPOSES as readonly string[]).includes(String(v))

export interface ComplianceDocument {
  kind: ComplianceDocPurpose | 'conformity_declaration'
  /** `private-uploads`- bzw. `conformity-declarations`-ID. */
  id: number
  title: string
  category: ProductCategory | null
  documentVersion: string | null
  documentDate: string | null
  note: string | null
  /** Datei-URL (nur angemeldet abrufbar). */
  url: string | null
  seed: boolean
  /** Ende der 10-Jahres-Frist; `null` = Frist läuft noch nicht (Stück im Verkauf) bzw. unbestimmt. */
  keepUntil: string | null
  /** Frist abgelaufen – „kann gelöscht werden“ (nur Hinweis). */
  deletable: boolean
}

export interface ComplianceCategoryState {
  category: ProductCategory
  label: string
  /** Stücke der Kategorie (alle Status). */
  pieces: number
  /** Mindestens ein Stück online oder reserviert. */
  onMarket: boolean
  /** Letztes Inverkehrbringen (ISO) – `null`, solange im Verkauf oder nie veröffentlicht. */
  lastPlacedAt: string | null
  keepUntil: string | null
  /** Stücke vorhanden, aber keine technischen Unterlagen. */
  missingTechnicalFile: boolean
  documents: ComplianceDocument[]
}

export interface ComplianceOverview {
  categories: ComplianceCategoryState[]
  /** Unterlagen ohne bestimmbare Kategorie. */
  uncategorized: ComplianceDocument[]
}

type ProductRow = {
  id: number
  category: ProductCategory
  status: ProductStatus
  firstPublishedAt?: string | null
  soldAt?: string | null
  archivedAt?: string | null
  seed?: boolean | null
}

type UploadRow = {
  id: number
  purpose: PrivateUploadPurpose
  filename?: string | null
  url?: string | null
  complianceCategory?: ProductCategory | null
  documentVersion?: string | null
  documentDate?: string | null
  note?: string | null
  relatedProduct?: number | { id: number } | null
  relatedDeclaration?: number | { id: number } | null
  seed?: boolean | null
  createdAt: string
}

type DeclarationRow = {
  id: number
  name?: string | null
  validFrom?: string | null
  notes?: string | null
  seed?: boolean | null
}

const ON_MARKET: ReadonlySet<ProductStatus> = new Set(['available', 'reserved'])

const ts = (v: string | null | undefined): number | null => {
  if (!v) return null
  const t = new Date(v).getTime()
  return Number.isNaN(t) ? null : t
}

const relId = (v: number | { id: number } | null | undefined): number | null =>
  v === null || v === undefined ? null : typeof v === 'object' ? v.id : v

export interface ComplianceOptions {
  /** Beispieldaten einbeziehen (Ablage zeigt sie, der Fristen-Task nicht; DATENMODELL §11). */
  includeSeed: boolean
  req?: PayloadRequest
}

/** Übersicht je Kategorie mit Unterlagen, Fristen und fehlenden technischen Unterlagen. */
export async function complianceOverview(
  payload: Payload,
  now: Date,
  options: ComplianceOptions,
): Promise<ComplianceOverview> {
  const seedFilter = options.includeSeed ? [] : [{ seed: { not_equals: true } }]
  const common = { depth: 0, pagination: false, overrideAccess: true, req: options.req } as const
  const [products, uploads, declarations] = await Promise.all([
    payload.find({
      collection: 'products',
      where: seedFilter.length ? { and: seedFilter } : {},
      select: {
        category: true,
        status: true,
        firstPublishedAt: true,
        soldAt: true,
        archivedAt: true,
        seed: true,
      },
      ...common,
    }),
    payload.find({
      collection: 'private-uploads',
      where: { and: [{ purpose: { in: [...COMPLIANCE_DOC_PURPOSES] } }, ...seedFilter] },
      sort: 'createdAt',
      ...common,
    }),
    payload.find({
      collection: 'conformity-declarations',
      where: seedFilter.length ? { and: seedFilter } : {},
      sort: 'createdAt',
      ...common,
    }),
  ])

  const productRows = products.docs as unknown as ProductRow[]
  const productCategory = new Map(productRows.map((p) => [p.id, p.category]))
  const state = new Map<
    ProductCategory,
    { pieces: number; onMarket: boolean; last: number | null }
  >()
  for (const c of PRODUCT_CATEGORIES) state.set(c, { pieces: 0, onMarket: false, last: null })
  for (const p of productRows) {
    const s = state.get(p.category)
    if (!s) continue
    s.pieces += 1
    if (ON_MARKET.has(p.status)) s.onMarket = true
    const times = [ts(p.soldAt), ts(p.archivedAt), ts(p.firstPublishedAt)].filter(
      (t): t is number => t !== null,
    )
    if (times.length) s.last = Math.max(s.last ?? 0, ...times)
  }
  const keepUntilOf = (category: ProductCategory | null): Date | null => {
    if (!category) return null
    const s = state.get(category)
    if (!s || s.onMarket || s.last === null) return null
    return addBerlinMonths(new Date(s.last), COMPLIANCE_KEEP_MONTHS)
  }

  const docs: ComplianceDocument[] = []
  for (const u of uploads.docs as unknown as UploadRow[]) {
    if (!isComplianceDocPurpose(u.purpose)) continue
    const category =
      u.complianceCategory ??
      productCategory.get(relId(u.relatedProduct) ?? -1) ??
      (u.purpose === 'nickel_evidence'
        ? 'schmuck'
        : relId(u.relatedDeclaration) !== null
          ? 'keramik'
          : null)
    const keep = keepUntilOf(category)
    docs.push({
      kind: u.purpose,
      id: u.id,
      title:
        (u.documentVersion ? `${u.filename ?? ''} (${u.documentVersion})` : u.filename) ||
        `#${u.id}`,
      category,
      documentVersion: u.documentVersion ?? null,
      documentDate: u.documentDate ?? null,
      note: u.note ?? null,
      url: u.url ?? null,
      seed: u.seed === true,
      keepUntil: keep?.toISOString() ?? null,
      deletable: keep !== null && keep.getTime() <= now.getTime(),
    })
  }
  // Konformitätserklärungen betreffen Keramik mit Lebensmittelkontakt (DATENMODELL §6.18).
  for (const d of declarations.docs as unknown as DeclarationRow[]) {
    const keep = keepUntilOf('keramik')
    docs.push({
      kind: 'conformity_declaration',
      id: d.id,
      title: d.name || `#${d.id}`,
      category: 'keramik',
      documentVersion: null,
      documentDate: d.validFrom ?? null,
      note: d.notes ?? null,
      url: null,
      seed: d.seed === true,
      keepUntil: keep?.toISOString() ?? null,
      deletable: keep !== null && keep.getTime() <= now.getTime(),
    })
  }

  const categories = PRODUCT_CATEGORIES.map((category): ComplianceCategoryState => {
    const s = state.get(category)!
    const documents = docs.filter((d) => d.category === category)
    const keep = keepUntilOf(category)
    return {
      category,
      label: ENUM_LABELS.PRODUCT_CATEGORIES[category].de,
      pieces: s.pieces,
      onMarket: s.onMarket,
      lastPlacedAt: !s.onMarket && s.last !== null ? new Date(s.last).toISOString() : null,
      keepUntil: keep?.toISOString() ?? null,
      missingTechnicalFile: s.pieces > 0 && !documents.some((d) => d.kind === 'technical_file'),
      documents,
    }
  })
  return { categories, uncategorized: docs.filter((d) => d.category === null) }
}

export interface ComplianceReviewResult {
  sent: boolean
  missingCategories: ProductCategory[]
  deletable: number
}

/**
 * Monatliche Erinnerung A16 (Task `complianceDocsReview`): Kategorien mit Stücken ohne technische Unterlagen und
 * Unterlagen mit abgelaufener 10-Jahres-Frist. Beispieldaten zählen nicht; ohne Befund keine Mail. Eine Mail je
 * Berliner Monat (Idempotenz-Schlüssel mit `period`).
 */
export async function runComplianceDocsReview(
  req: PayloadRequest,
  now: Date,
  period: string,
): Promise<ComplianceReviewResult> {
  const overview = await complianceOverview(req.payload, now, { includeSeed: false, req })
  const missing = overview.categories.filter((c) => c.missingTechnicalFile)
  const deletable = overview.categories.flatMap((c) => c.documents).filter((d) => d.deletable)
  if (missing.length === 0 && deletable.length === 0) {
    return { sent: false, missingCategories: [], deletable: 0 }
  }
  const { notifyAdmin } = await import('@/lib/email/notifyAdmin')
  const res = await notifyAdmin(
    req,
    'admin_compliance_docs_review',
    {
      missingCategories: missing.map((c) => c.label),
      documents: deletable.slice(0, 500).map((d) => ({
        kind: d.kind,
        title: d.title.slice(0, 200),
        keepUntil: d.keepUntil,
        deletable: true,
      })),
    },
    { now, idempotencyKey: `admin_compliance_docs_review:${period}:monthly` },
  )
  return {
    sent: 'status' in res && res.status === 'queued',
    missingCategories: missing.map((c) => c.category),
    deletable: deletable.length,
  }
}
