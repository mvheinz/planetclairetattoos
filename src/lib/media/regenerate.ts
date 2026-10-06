import 'server-only'

import { readFile } from 'node:fs/promises'
import path from 'node:path'

import type { Payload } from 'payload'

import { getEnv } from '@/lib/env'
import { uploadStaticDir } from '@/lib/storage'

import { DERIVATIVES_VERSION } from './version'

// `pnpm media:regenerate` (DATENMODELL §6.2 `derivativesVersion`, DESIGN §12.2): erzeugt alle Größen neu, wenn sich die
// Bildpipeline geändert hat. Idempotent: Bilder mit `derivativesVersion` ≥ aktueller Version bleiben unberührt, ein
// zweiter Lauf tut nichts. Das Original wird durch Payload erneut verarbeitet (Normieren, Foto-Look nach Schalter
// `enhance`, alle Größen); die alte Datei räumt Payload ab.

export interface RegenerateResult {
  checked: number
  regenerated: number[]
  skipped: number
  failed: { id: number; message: string }[]
}

const MIME_BY_EXT: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
}

export async function regenerateMedia(
  payload: Payload,
  options: { force?: boolean; ids?: number[] } = {},
): Promise<RegenerateResult> {
  if (getEnv().STORAGE_DRIVER !== 'local') {
    throw new Error(
      'media:regenerate liest die Originale vom lokalen Speicher (STORAGE_DRIVER=local).',
    )
  }
  const dir = uploadStaticDir('media')
  const result: RegenerateResult = { checked: 0, regenerated: [], skipped: 0, failed: [] }
  const page = await payload.find({
    collection: 'media',
    limit: 0,
    depth: 0,
    pagination: false,
    overrideAccess: true,
    where: options.ids ? { id: { in: options.ids } } : undefined,
  })
  for (const doc of page.docs) {
    result.checked++
    if (!options.force && (doc.derivativesVersion ?? 1) >= DERIVATIVES_VERSION) {
      result.skipped++
      continue
    }
    try {
      if (!doc.filename) throw new Error('Datei fehlt')
      const data = await readFile(path.join(dir, path.basename(doc.filename)))
      const ext = path.extname(doc.filename).toLowerCase()
      await payload.update({
        collection: 'media',
        id: doc.id,
        overrideAccess: true,
        depth: 0,
        data: { enhance: doc.enhance, source: doc.source },
        file: {
          data,
          mimetype: MIME_BY_EXT[ext] ?? doc.mimeType ?? 'image/webp',
          name: doc.filename,
          size: data.length,
        },
      })
      result.regenerated.push(doc.id)
    } catch (e) {
      result.failed.push({ id: doc.id, message: e instanceof Error ? e.message : String(e) })
    }
  }
  return result
}
