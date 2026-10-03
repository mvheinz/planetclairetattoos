import 'server-only'

import { readFile } from 'node:fs/promises'
import path from 'node:path'

import type { Payload } from 'payload'
import sharp from 'sharp'

import { getEnv } from '@/lib/env'
import { uploadStaticDir } from '@/lib/storage'

import { enhanceImage } from './pipeline'

// Vorher/Nachher-Vorschau des Foto-Looks für die Verwaltung (DESIGN §12.2 Schritt 6): gespeichertes Bild und dasselbe
// Bild mit Weißabgleich/Belichtung, beide klein (360 px, JPEG) als Data-URL.

const EDGE = 360

export interface EnhancePreview {
  before: string
  after: string
  /** `true`, wenn die Angleichung am Bild nichts ändert. */
  noop: boolean
  gains: [number, number, number]
  gamma: number
}

const dataUrl = (b: Buffer) => `data:image/jpeg;base64,${b.toString('base64')}`

export async function mediaEnhancePreview(payload: Payload, id: number): Promise<EnhancePreview> {
  if (getEnv().STORAGE_DRIVER !== 'local') throw new Error('Vorschau nur mit lokalem Speicher.')
  const doc = await payload.findByID({ collection: 'media', id, depth: 0, overrideAccess: true })
  if (!doc.filename) throw new Error('Datei fehlt')
  const file = await readFile(path.join(uploadStaticDir('media'), path.basename(doc.filename)))
  const small = await sharp(file)
    .rotate()
    .resize({ width: EDGE, height: EDGE, fit: 'inside', withoutEnlargement: true })
    .png({ compressionLevel: 1 })
    .toBuffer()
  const category = doc.source === 'placeholder' || doc.source === 'generated' ? 'drawing' : 'photo'
  const { data, plan } = await enhanceImage(small, category)
  const jpeg = (b: Buffer) => sharp(b).jpeg({ quality: 78 }).toBuffer()
  return {
    before: dataUrl(await jpeg(small)),
    after: dataUrl(await jpeg(data)),
    noop: plan.noop,
    gains: plan.gains,
    gamma: plan.gamma,
  }
}
