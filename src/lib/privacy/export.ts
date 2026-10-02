import 'server-only'

import { strToU8, zipSync, type Zippable } from 'fflate'
import type { PayloadRequest } from 'payload'

import { writeAudit } from '@/lib/audit'
import type { Locale } from '@/lib/enums'
import { preservingReq } from '@/lib/payload/localReq'
import { deletePrivateUpload } from '@/lib/retention/jobs'
import { writeDeletionLog } from '@/lib/retention/log'
import { STORAGE_PREFIX } from '@/lib/storage'
import { readStoredFile } from '@/lib/storage/read'
import { formatBerlin } from '@/lib/time'
import { sha256Hex } from '@/lib/uploads/files'
import { storePrivateFile } from '@/lib/uploads/preStored'
import type { PrivacyRequest, PrivateUpload, Setting } from '@/payload-types'

import { renderAccessReport } from './accessReport'
import { PrivacyActionError } from './errors'
import { loadPrivacyRequest } from './requests'
import {
  countMatches,
  MATCH_COLLECTIONS,
  searchPerson,
  type PersonMatches,
  type PersonQuery,
} from './search'

// Auskunft-Export (PLAN P6.17, KONZEPT §7.15, LOESCHKONZEPT §5.4/§5.8, R-150): ZIP (fflate) mit `daten.json`
// (strukturiert, Art. 20 – alle gefundenen Datensätze je Bereich), `auskunft.html` (Art. 15 Abs. 1 lit. a–h) und Kopien
// der Bilder und Belege unter `dateien/`. Privat abgelegt (`private-uploads`, Zweck `data_export`), an der Anfrage als
// `exportFile` (ein neuer Export ersetzt den alten, die alte Datei wird gelöscht und protokolliert), Audit
// `data_exported` ohne Inhalte. Ohne Daten Dritter: keine internen Notizen, keine Verwaltungs-Mails, keine Token-
// Hashes oder Siegel, keine Seed-Kennzeichen. Die Datei wird 30 Tage nach der Antwort gelöscht (L-17, P6.15).

export const EXPORT_FORMAT = 'planetclaire-dsgvo-auskunft'
export const EXPORT_VERSION = 1

/** Felder, die nie in den Export gehören (intern, Sicherheitsmerkmale, Verweise auf andere Vorgänge). */
const STRIP_ALWAYS = new Set([
  'seed',
  'seedKey',
  'adminNotes',
  'notes',
  'adminAttention',
  'tokenHash',
  'statusTokenHash',
  'statusTokenSealed',
  'remindersSent',
  'idempotencyKey',
  'smtpResponse',
  'lastError',
  'mock',
  'url',
  'thumbnailURL',
  'sizes',
  'prefix',
  '_objectkey',
])
/** Join-Felder (Listen anderer Datensätze) je Bereich – die Datensätze selbst stehen in ihrem eigenen Bereich. */
const STRIP_BY_AREA: Partial<Record<keyof PersonMatches, readonly string[]>> = {
  orders: ['creditNotes', 'withdrawals', 'emails', 'complaints', 'packingChecklistState'],
  privacyRequests: ['exportFile', 'matchedOrders', 'matchedWithdrawals', 'matchedInquiries'],
}

function sanitize(value: unknown, extra: ReadonlySet<string>): unknown {
  if (Array.isArray(value)) return value.map((v) => sanitize(v, extra))
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (STRIP_ALWAYS.has(k) || extra.has(k)) continue
      out[k] = sanitize(v, extra)
    }
    return out
  }
  return value
}

export interface PrivacyExportData {
  format: typeof EXPORT_FORMAT
  version: typeof EXPORT_VERSION
  reference: string
  createdAt: string
  locale: Locale
  query: { email: string | null; orderNumber: string | null; name: string | null }
  counts: Record<keyof PersonMatches, number>
  data: Record<Exclude<keyof PersonMatches, 'files'>, Record<string, unknown>[]>
  files: { path: string; id: number; purpose: string; sha256: string; sizeBytes: number }[]
}

async function loadDocs(
  req: PayloadRequest,
  area: keyof PersonMatches,
  ids: number[],
): Promise<Record<string, unknown>[]> {
  if (ids.length === 0) return []
  const res = await preservingReq(req, () =>
    req.payload.find({
      collection: MATCH_COLLECTIONS[area],
      where: { id: { in: ids } },
      sort: 'id',
      pagination: false,
      depth: 0,
      overrideAccess: true,
      req,
    }),
  )
  const extra = new Set(STRIP_BY_AREA[area] ?? [])
  return res.docs.map((d) => sanitize(d, extra) as Record<string, unknown>)
}

const safeName = (s: string) => s.replace(/[^A-Za-z0-9._-]+/g, '_').slice(0, 120)

export interface BuiltExport {
  zip: Buffer
  data: PrivacyExportData
  matches: PersonMatches
}

/** Baut das ZIP (ohne es abzulegen) – auch für Tests. */
export async function buildPrivacyExportZip(
  req: PayloadRequest,
  request: PrivacyRequest,
  query: PersonQuery,
  now: Date,
): Promise<BuiltExport> {
  const matches = await searchPerson(req, query, { excludeRequestId: request.id })
  const data = {} as PrivacyExportData['data']
  for (const area of Object.keys(MATCH_COLLECTIONS) as (keyof PersonMatches)[]) {
    if (area === 'files') continue
    data[area] = await loadDocs(req, area, matches[area])
  }
  const zipFiles: Zippable = {}
  const fileList: PrivacyExportData['files'] = []
  if (matches.files.length > 0) {
    const uploads = (await preservingReq(req, () =>
      req.payload.find({
        collection: 'private-uploads',
        where: { id: { in: matches.files } },
        sort: 'id',
        pagination: false,
        depth: 0,
        overrideAccess: true,
        req,
      }),
    )) as { docs: PrivateUpload[] }
    for (const u of uploads.docs) {
      if (!u.filename) continue
      const bytes = await readStoredFile('private', u.filename, u.prefix ?? STORAGE_PREFIX.private)
      if (!bytes) continue
      const path = `dateien/${u.purpose}/${u.id}-${safeName(u.filename)}`
      zipFiles[path] = [new Uint8Array(bytes), { level: 0 }]
      fileList.push({
        path,
        id: u.id,
        purpose: u.purpose,
        sha256: sha256Hex(bytes),
        sizeBytes: bytes.length,
      })
    }
  }
  const q = {
    email: query.email?.trim().toLowerCase() || null,
    orderNumber: query.orderNumber?.trim().toUpperCase() || null,
    name: query.name?.trim() || null,
  }
  const counts = { ...countMatches(matches), files: fileList.length }
  const exportData: PrivacyExportData = {
    format: EXPORT_FORMAT,
    version: EXPORT_VERSION,
    reference: request.reference,
    createdAt: now.toISOString(),
    locale: request.locale,
    query: q,
    counts,
    data,
    files: fileList,
  }
  const settings = (await preservingReq(req, () =>
    req.payload.findGlobal({ slug: 'settings', depth: 0, overrideAccess: true, req }),
  )) as Setting
  const html = renderAccessReport({
    locale: request.locale,
    reference: request.reference,
    createdAt: now,
    business: (settings.business ?? {}) as Parameters<typeof renderAccessReport>[0]['business'],
    counts,
    invoiceYears: Number(settings.retention?.invoiceYears) || undefined,
  })
  zipFiles['daten.json'] = [strToU8(`${JSON.stringify(exportData, null, 2)}\n`), { level: 6 }]
  zipFiles['auskunft.html'] = [strToU8(html), { level: 6 }]
  const zip = Buffer.from(zipSync(zipFiles, { mtime: now }))
  return { zip, data: exportData, matches }
}

export interface CreatedExport {
  request: PrivacyRequest
  upload: PrivateUpload
  counts: PrivacyExportData['counts']
}

/** Export erzeugen, privat ablegen, an der Anfrage hinterlegen (ersetzt einen älteren Export). */
export async function createPrivacyExport(
  req: PayloadRequest,
  id: number,
  query: PersonQuery,
  now: Date,
): Promise<CreatedExport> {
  const request = await loadPrivacyRequest(req, id)
  if (request.status === 'answered' || request.status === 'rejected') {
    throw new PrivacyActionError(409, 'Die Anfrage ist abgeschlossen.')
  }
  const effective: PersonQuery =
    query.email || query.orderNumber || query.name ? query : { email: request.contactEmail }
  const built = await buildPrivacyExportZip(req, request, effective, now)
  const stamp = formatBerlin(now, 'yyyyMMdd-HHmmss')
  const upload = await storePrivateFile(req, {
    purpose: 'data_export',
    prefix: `${STORAGE_PREFIX.private}/privacy-exports`,
    filename: `auskunft-${request.reference}-${stamp}.zip`,
    bytes: built.zip,
    contentType: 'application/zip',
    data: { relatedPrivacyRequest: request.id, seed: request.seed === true },
    context: { now: now.toISOString() },
  })
  const previous =
    typeof request.exportFile === 'object' && request.exportFile
      ? request.exportFile.id
      : (request.exportFile ?? null)
  const updated = (await preservingReq(req, () =>
    req.payload.update({
      collection: 'privacy-requests',
      id: request.id,
      data: {
        exportFile: upload.id,
        matchedOrders: built.matches.orders,
        matchedWithdrawals: built.matches.withdrawals,
        matchedInquiries: built.matches.inquiries,
      } as never,
      depth: 0,
      overrideAccess: true,
      req,
      context: { ...req.context, now: now.toISOString(), skipAudit: true },
    }),
  )) as PrivacyRequest
  if (previous !== null && previous !== upload.id) {
    const removed = await deletePrivateUpload(req, Number(previous))
    if (removed) {
      await writeDeletionLog(req, {
        entityCollection: 'private-uploads',
        entityId: Number(previous),
        ruleId: 'DSGVO',
        action: 'files_deleted',
        trigger: 'privacy_request',
        privacyRequestRef: request.reference,
        storageObjectsCount: removed,
        executedAt: now,
      })
    }
  }
  await writeAudit(req, {
    action: 'data_exported',
    entityCollection: 'privacy-requests',
    entityId: request.id,
    summary: `Datenschutz-Anfrage ${request.reference}: Auskunft-Export erstellt (${Object.values(
      built.data.counts,
    ).reduce((a, b) => a + b, 0)} Einträge).`,
    seed: request.seed === true,
  })
  return { request: updated, upload, counts: built.data.counts }
}

/** Nur suchen und Treffer an der Anfrage speichern (Anzeige „Gefunden“). */
export async function searchForRequest(
  req: PayloadRequest,
  id: number,
  query: PersonQuery,
  now: Date,
): Promise<{ request: PrivacyRequest; matches: PersonMatches }> {
  const request = await loadPrivacyRequest(req, id)
  const effective: PersonQuery =
    query.email || query.orderNumber || query.name ? query : { email: request.contactEmail }
  const matches = await searchPerson(req, effective, { excludeRequestId: request.id })
  const updated = (await preservingReq(req, () =>
    req.payload.update({
      collection: 'privacy-requests',
      id: request.id,
      data: {
        matchedOrders: matches.orders,
        matchedWithdrawals: matches.withdrawals,
        matchedInquiries: matches.inquiries,
      } as never,
      depth: 0,
      overrideAccess: true,
      req,
      context: { ...req.context, now: now.toISOString(), skipAudit: true },
    }),
  )) as PrivacyRequest
  return { request: updated, matches }
}

/**
 * Antwort M14 (LOESCHKONZEPT §5.4 Nr. 3/4): nur mit Export und geprüfter Identität, nur an die gespeicherte Adresse der
 * Anfrage. Setzt `answeredAt` (falls leer) – damit beginnt die 30-Tage-Frist der Exportdatei (L-17). Ein neuer Export
 * darf erneut verschickt werden (Idempotenz je Exportdatei).
 */
export async function sendAccessResponse(
  req: PayloadRequest,
  id: number,
  now: Date,
): Promise<{ request: PrivacyRequest; jobId: number | string | null; unchanged: boolean }> {
  const request = await loadPrivacyRequest(req, id)
  const fileId =
    typeof request.exportFile === 'object' && request.exportFile
      ? request.exportFile.id
      : (request.exportFile ?? null)
  if (!fileId) throw new PrivacyActionError(409, 'Bitte zuerst den Export erstellen.')
  if (request.identityVerified !== true) {
    throw new PrivacyActionError(
      409,
      'Bitte zuerst die Identität prüfen – Daten gehen nur an eine gespeicherte Adresse.',
    )
  }
  const answeredAt = request.answeredAt ? new Date(request.answeredAt) : now
  const updated = request.answeredAt
    ? request
    : ((await preservingReq(req, () =>
        req.payload.update({
          collection: 'privacy-requests',
          id: request.id,
          data: { answeredAt: now.toISOString() } as never,
          depth: 0,
          overrideAccess: true,
          req,
          context: { ...req.context, now: now.toISOString() },
        }),
      )) as PrivacyRequest)
  const { enqueueEmail } = await import('@/lib/email/outbox')
  const { privacyExportDeleteAfter } = await import('@/lib/retention/policy')
  const { PRIVACY_EXPORT_LINK_DAYS } = await import('./exportToken')
  const linkExpiresAt = new Date(now.getTime() + PRIVACY_EXPORT_LINK_DAYS * 86_400_000)
  const res = await enqueueEmail(req, {
    template: 'privacy_access_response',
    to: request.contactEmail,
    locale: request.locale,
    data: {
      privacyRequestId: request.id,
      reference: request.reference,
      name: request.contactName ?? null,
      linkExpiresAt: linkExpiresAt.toISOString(),
      fileDeleteAt: privacyExportDeleteAfter(answeredAt).toISOString(),
    },
    idempotencyKey: `privacy_access_response:${request.id}:${fileId}`,
  })
  return { request: updated, jobId: res.jobId, unchanged: res.status === 'duplicate' }
}
