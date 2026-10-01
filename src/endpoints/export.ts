import type { Endpoint, PayloadRequest } from 'payload'

import { isAdminRequest } from '@/access'
import { createLogger } from '@/lib/monitoring/logger'

// Admin-Endpunkte der Exporte (ARCHITEKTUR §2.5, KONZEPT §7.15, R-124; PLAN P5.24/P5.25):
// `GET /api/admin/export/{JJJJ-MM}.csv` (Monats-CSV), `.zip` (Rechnungs-ZIP), `.datev.csv` (DATEV-Buchungsstapel).
// Nur mit Admin-Sitzung (sonst 401), `Cache-Control: private, no-store`, Download als Anhang. Exporte enthalten nie
// Beispieldaten – auch nicht im Vorschau-Modus.

const log = createLogger()
const noStore = { 'cache-control': 'private, no-store' }

export const EXPORT_FILE_RE = /^(\d{4}-(?:0[1-9]|1[0-2]))\.(csv|zip|datev\.csv)$/

type Kind = 'csv' | 'zip' | 'datev.csv'

function download(bytes: Buffer, filename: string, contentType: string): Response {
  return new Response(new Uint8Array(bytes), {
    status: 200,
    headers: {
      ...noStore,
      'content-type': contentType,
      'content-disposition': `attachment; filename="${filename}"`,
      'content-length': String(bytes.length),
      'x-content-type-options': 'nosniff',
    },
  })
}

const error = (status: number, message: string, extra: Record<string, unknown> = {}) =>
  Response.json({ error: message, ...extra }, { status, headers: noStore })

async function handleExport(req: PayloadRequest): Promise<Response> {
  if (!isAdminRequest(req)) return error(401, 'Nur für die Verwaltung.')
  const file = String((req.routeParams as { file?: string } | undefined)?.file ?? '')
  const m = EXPORT_FILE_RE.exec(file)
  if (!m) return error(404, 'Unbekannte Export-Datei. Format: JJJJ-MM.csv, .zip oder .datev.csv')
  const month = m[1]!
  const kind = m[2] as Kind
  try {
    if (kind === 'csv') {
      const { buildMonthlyCsv } = await import('@/lib/export/monthlyCsv')
      const res = await buildMonthlyCsv(req.payload, month)
      return download(res.bytes, res.filename, 'text/csv; charset=utf-8')
    }
    if (kind === 'zip') {
      const { buildInvoiceZip, ExportNotReadyError } = await import('@/lib/export/invoiceZip')
      try {
        const res = await buildInvoiceZip(req.payload, month)
        return download(res.bytes, res.filename, 'application/zip')
      } catch (err) {
        if (err instanceof ExportNotReadyError) {
          return error(409, err.message, { missing: err.missing })
        }
        throw err
      }
    }
    const { buildDatevExport, DatevNotConfiguredError } = await import('@/lib/export/datev')
    try {
      const res = await buildDatevExport(req.payload, month)
      return download(res.bytes, res.filename, 'text/csv; charset=windows-1252')
    } catch (err) {
      if (err instanceof DatevNotConfiguredError) {
        return error(409, err.message, { missing: err.missing })
      }
      throw err
    }
  } catch (err) {
    log.error('export.failed', { kind, month, reason: (err as Error)?.message })
    return error(500, 'Export fehlgeschlagen.')
  }
}

/** `GET /api/admin/packaging-report?year=JJJJ` – Verpackungsmengen eines Jahres (PLAN P5.11, R-201). */
async function handlePackagingReport(req: PayloadRequest): Promise<Response> {
  if (!isAdminRequest(req)) return error(401, 'Nur für die Verwaltung.')
  try {
    const { buildPackagingReport, parseYear, InvalidYearError } =
      await import('@/lib/export/packagingReport')
    let year: number
    try {
      year = parseYear(req.searchParams?.get('year'))
    } catch (err) {
      if (err instanceof InvalidYearError) return error(400, err.message)
      throw err
    }
    const res = await buildPackagingReport(req.payload, year)
    return download(res.bytes, res.filename, 'text/csv; charset=utf-8')
  } catch (err) {
    log.error('export.packaging_failed', { reason: (err as Error)?.message })
    return error(500, 'Export fehlgeschlagen.')
  }
}

export const exportEndpoints: Endpoint[] = [
  { path: '/admin/export/:file', method: 'get', handler: handleExport },
  { path: '/admin/packaging-report', method: 'get', handler: handlePackagingReport },
]
