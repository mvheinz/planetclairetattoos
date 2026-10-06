import 'server-only'

import path from 'node:path'

import type { PayloadRequest } from 'payload'

import type { PrivateUploadPurpose } from '@/lib/enums'
import { preservingReq } from '@/lib/payload/localReq'
import { putIfAbsent, ObjectExistsError } from '@/lib/storage/putIfAbsent'
import { readStoredFile } from '@/lib/storage/read'
import type { PrivateUpload } from '@/payload-types'

import { sha256Hex } from './files'

// Unveränderliche private Dateien (R-122, PLAN P5.26): Beleg-PDFs und Monatsexporte schreibt der Server selbst, nur wenn
// das Objekt noch nicht existiert (`putIfAbsent`), und legt danach den `private-uploads`-Datensatz ohne erneutes
// Schreiben an (Kontext `preStoredFile`). Existiert die Datei schon mit **identischem** Inhalt (z. B. Wiederholung nach
// einem abgebrochenen Lauf), wird sie übernommen; bei anderem Inhalt bleibt sie unangetastet und es gibt einen Fehler.

export class StoredFileConflictError extends Error {
  constructor(readonly filename: string) {
    super(
      `„${filename}“ liegt schon mit anderem Inhalt im Speicher und wird nicht überschrieben (R-122).`,
    )
    this.name = 'StoredFileConflictError'
  }
}

export interface StorePrivateFileInput {
  purpose: Extract<
    PrivateUploadPurpose,
    'invoice_pdf' | 'credit_note_pdf' | 'monthly_export' | 'data_export'
  >
  prefix: string
  filename: string
  bytes: Buffer
  contentType: string
  /** Objekt-Metadaten (Belege: `invoice-number`, ARCHITEKTUR §10.4). */
  metadata?: Record<string, string>
  /** Weitere Felder des Datensatzes (z. B. `relatedInvoice`, `note`, `seed`). */
  data?: Record<string, unknown>
  /** Zusätzlicher Kontext für die Anlage (z. B. injizierte Zeit `now`). */
  context?: PayloadRequest['context']
}

export async function storePrivateFile(
  req: PayloadRequest,
  input: StorePrivateFileInput,
): Promise<PrivateUpload> {
  const sha256 = sha256Hex(input.bytes)
  const filename = await writeOnce(req, input, input.filename, sha256).catch(async (e: unknown) => {
    // Verwaiste Datei gleichen Namens (kein Datensatz verweist darauf, z. B. nach abgebrochenem Lauf) mit anderem
    // Inhalt: nie überschreiben, sondern unter `{Name}-{sha256[0..8]}` ablegen (wie Payloads eigene Umbenennung).
    if (!(e instanceof OrphanConflict)) throw e
    const ext = path.extname(input.filename)
    const alt = `${input.filename.slice(0, -ext.length || undefined)}-${sha256.slice(0, 8)}${ext}`
    return writeOnce(req, input, alt, sha256)
  })
  return preservingReq(req, () =>
    req.payload.create({
      collection: 'private-uploads',
      data: {
        ...input.data,
        purpose: input.purpose,
        status: 'attached',
        prefix: input.prefix,
        filename,
        mimeType: input.contentType,
        filesize: input.bytes.length,
        sha256,
      } as never,
      depth: 0,
      overrideAccess: true,
      req,
      context: { ...req.context, ...input.context, system: true, preStoredFile: true },
    }),
  )
}

class OrphanConflict extends Error {}

/** Schreibt genau einmal; vorhandene Datei mit gleichem Inhalt wird übernommen. Liefert den Dateinamen. */
async function writeOnce(
  req: PayloadRequest,
  input: StorePrivateFileInput,
  filename: string,
  sha256: string,
): Promise<string> {
  try {
    await putIfAbsent({
      area: 'private',
      prefix: input.prefix,
      filename,
      bytes: input.bytes,
      contentType: input.contentType,
      ...(input.metadata ? { metadata: input.metadata } : {}),
    })
    return filename
  } catch (e) {
    if (!(e instanceof ObjectExistsError)) throw e
  }
  const existing = await readStoredFile('private', filename, input.prefix)
  if (existing && sha256Hex(existing) === sha256) return filename
  const referenced = await preservingReq(req, () =>
    req.payload.count({
      collection: 'private-uploads',
      where: { filename: { equals: filename } },
      overrideAccess: true,
      req,
    }),
  )
  if (referenced.totalDocs > 0 || filename !== input.filename) {
    throw new StoredFileConflictError(filename)
  }
  throw new OrphanConflict(filename)
}
