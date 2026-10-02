import { readFile } from 'node:fs/promises'
import path from 'node:path'

import type { Payload } from 'payload'
import { PDFParse } from 'pdf-parse'

import { uploadStaticDir } from '@/lib/storage'

// Hilfen für Beleg- und Rechtstext-PDF-Tests (P4.11/P4.12): Verkäuferin in `settings.business`, PDF-Text per
// `pdf-parse` (exakt gepinnte devDependency).

export const TEST_BUSINESS = {
  legalName: 'Jutta Beispiel',
  tradeName: 'Planet Claire',
  street: 'Werkstattweg 7',
  postalCode: '10999',
  city: 'Berlin',
  country: 'DE',
  email: 'jutta@planetclaire.test',
  phone: '+49 30 1234567',
  taxNumber: '12/345/67890',
} as const

/** Setzt `settings.business` (Seed-Kontext, ohne Audit) und gibt die Wiederherstellung zurück. */
export async function withBusiness(
  payload: Payload,
  business: Record<string, unknown> = TEST_BUSINESS,
): Promise<() => Promise<void>> {
  const before = await payload.findGlobal({ slug: 'settings', depth: 0, overrideAccess: true })
  await payload.updateGlobal({
    slug: 'settings',
    data: { business: { ...before.business, ...business } } as never,
    overrideAccess: true,
    context: { seed: true, skipAudit: true },
  })
  return async () => {
    await payload.updateGlobal({
      slug: 'settings',
      data: { business: before.business } as never,
      overrideAccess: true,
      context: { seed: true, skipAudit: true },
    })
  }
}

/** Text eines PDFs (alle Seiten, Leerraum vereinheitlicht). */
export async function pdfText(data: Buffer | Uint8Array): Promise<string> {
  const parser = new PDFParse({ data: new Uint8Array(data) })
  try {
    const res = await parser.getText()
    return res.text.replace(/[ \t]+/g, ' ')
  } finally {
    await parser.destroy()
  }
}

/** Datei einer `private-uploads`-Zeile (Treiber `local`). */
export async function readPrivateUpload(payload: Payload, id: number): Promise<Buffer> {
  const doc = await payload.findByID({
    collection: 'private-uploads',
    id,
    depth: 0,
    overrideAccess: true,
  })
  return readFile(path.join(uploadStaticDir('private'), doc.filename as string))
}

/** Datei einer `documents`-Zeile (Treiber `local`). */
export async function readDocument(payload: Payload, id: number): Promise<Buffer> {
  const doc = await payload.findByID({
    collection: 'documents',
    id,
    depth: 0,
    overrideAccess: true,
  })
  return readFile(path.join(uploadStaticDir('documents'), doc.filename as string))
}
