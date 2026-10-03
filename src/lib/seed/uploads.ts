import 'server-only'

import type { PayloadRequest } from 'payload'

import { seedDrawing } from './drawings'
import type { SeedData } from './loader'
import { simplePdf } from './pdf'
import type { SeedReport } from './report'
import { upsertBySeedKey } from './upsert'

// Private Dateien des Beispielbestands (SEED-SPEC §4.4): erzeugte Linienzeichnung (JPEG/PNG) oder einseitiges
// Beispiel-PDF. Create-only (§1.3).

type Obj = Record<string, unknown>

const fileOf = (data: Buffer, name: string, mimetype: string) => ({
  data,
  name,
  mimetype,
  size: data.length,
})

/** Eine private Datei anlegen (create-only); `link` = Bezug, der schon beim Anlegen Pflicht ist. */
export async function importPrivateUpload(
  req: PayloadRequest,
  entry: SeedData['privateUploads'][number],
  report: SeedReport,
  link: Obj = {},
) {
  return upsertBySeedKey({
    req,
    report,
    collection: 'private-uploads',
    seedKey: `private-uploads:${entry.key}`,
    group: 'process',
    create: () => ({
      purpose: entry.purpose,
      ...(entry.complianceCategory ? { complianceCategory: entry.complianceCategory } : {}),
      ...(entry.note ? { note: entry.note } : {}),
      ...link,
    }),
    file: async () => {
      const name = entry.key.replace(/[^A-Za-z0-9_-]/g, '-')
      if (entry.image) {
        const ext = entry.image.format === 'png' ? 'png' : 'jpg'
        return fileOf(
          await seedDrawing(entry.image),
          `${name}.${ext}`,
          `image/${entry.image.format}`,
        )
      }
      return fileOf(
        simplePdf('BEISPIELDOKUMENT', entry.pdfText ?? ''),
        `${name}.pdf`,
        'application/pdf',
      )
    },
  })
}
