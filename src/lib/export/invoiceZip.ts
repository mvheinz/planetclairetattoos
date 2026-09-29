import 'server-only'

import { zipSync, type Zippable } from 'fflate'
import type { Payload } from 'payload'

import type { PaymentsAdapter } from '@/lib/payments'
import { readStoredFile } from '@/lib/storage/read'

import { buildMonthlyCsv } from './monthlyCsv'
import { monthRange } from './documents'

// Rechnungs-ZIP je Monat (KONZEPT §7.15, R-124, PLAN P5.24): alle RE/GS-PDFs des Monats als `{Nummer}.pdf` plus die
// Monats-CSV. Beispielbelege nie. Fester Zeitstempel (Monatsbeginn) und feste Reihenfolge → byte-identische Archive.
// Fehlt noch ein PDF (Beleg `pending_pdf`), wird kein unvollständiges Archiv erzeugt.

export const invoiceZipFilename = (month: string) => `planetclaire-belege-${month}.zip`

export class ExportNotReadyError extends Error {
  constructor(readonly missing: string[]) {
    super(
      `Beleg-PDFs fehlen noch: ${missing.join(', ')} – bitte in ein paar Minuten erneut versuchen.`,
    )
    this.name = 'ExportNotReadyError'
  }
}

export interface InvoiceZipResult {
  filename: string
  bytes: Buffer
  /** Dateinamen im Archiv (Belege nach Nummer, dann die CSV). */
  entries: string[]
}

export async function buildInvoiceZip(
  payload: Payload,
  month: string,
  options: { payments?: Pick<PaymentsAdapter, 'listBalanceTransactions'> } = {},
): Promise<InvoiceZipResult> {
  const csv = await buildMonthlyCsv(payload, month, options)
  const mtime = monthRange(month).start
  const files: Zippable = {}
  const missing: string[] = []
  for (const doc of csv.documents) {
    const upload =
      doc.status === 'issued' && doc.pdfUploadId !== null
        ? await payload.findByID({
            collection: 'private-uploads',
            id: doc.pdfUploadId,
            depth: 0,
            overrideAccess: true,
            disableErrors: true,
          })
        : null
    const bytes = upload
      ? await readStoredFile(
          'private',
          upload.filename ?? '',
          (upload as { prefix?: string | null }).prefix,
        )
      : null
    if (!bytes) {
      missing.push(doc.number)
      continue
    }
    files[`${doc.number}.pdf`] = [new Uint8Array(bytes), { mtime, level: 6 }]
  }
  if (missing.length > 0) throw new ExportNotReadyError(missing)
  files[csv.filename] = [new Uint8Array(csv.bytes), { mtime, level: 6 }]
  const zipped = zipSync(files, { mtime })
  return {
    filename: invoiceZipFilename(month),
    bytes: Buffer.from(zipped),
    entries: Object.keys(files),
  }
}
