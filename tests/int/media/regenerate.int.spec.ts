import { readFile } from 'node:fs/promises'
import path from 'node:path'

import type { Payload } from 'payload'
import sharp from 'sharp'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { DERIVATIVES_VERSION } from '@/lib/media/version'
import { regenerateMedia } from '@/lib/media/regenerate'
import { uploadStaticDir } from '@/lib/storage'

import { getTestPayload } from '../helpers/payload'

// P9.14 – Foto-Look (DESIGN §12.2 Schritte 4–6, AK-DS-17) und `media:regenerate` (DATENMODELL §6.2).

const FIX = path.resolve('tests/fixtures/images/graycard.jpg')
let payload: Payload
const created: number[] = []

async function upload(enhance: 'auto' | 'off') {
  const buf = await readFile(FIX)
  const doc = await payload.create({
    collection: 'media',
    data: { alt: 'Graukarte auf hellem Papier', enhance } as never,
    file: { data: buf, name: 'graycard.jpg', mimetype: 'image/jpeg', size: buf.length },
    overrideAccess: true,
  })
  created.push(doc.id as number)
  return doc as unknown as {
    id: number
    filename: string
    derivativesVersion: number
    sizes: Record<string, { filename: string | null }>
  }
}

const cardPixel = async (doc: Awaited<ReturnType<typeof upload>>) => {
  const f = path.join(
    uploadStaticDir('media'),
    doc.sizes.card?.filename ?? doc.sizes.thumb!.filename!,
  )
  const { data } = await sharp(await readFile(f))
    .raw()
    .toBuffer({ resolveWithObject: true })
  return [data[0]!, data[1]!, data[2]!] as [number, number, number]
}

describe('Foto-Look und media:regenerate (P9.14)', () => {
  beforeAll(async () => {
    payload = await getTestPayload()
  })
  afterAll(async () => {
    for (const id of created)
      await payload.delete({ collection: 'media', id, overrideAccess: true }).catch(() => undefined)
  })

  it('AK-DS-17 auto neutralisiert, off lässt die Datei wie P1; Version aktuell', async () => {
    const auto = await upload('auto')
    const off = await upload('off')
    const [ar, , ab] = await cardPixel(auto)
    const [or, , ob] = await cardPixel(off)
    expect(Math.abs(ar - ab)).toBeLessThan(Math.abs(or - ob))
    expect(auto.derivativesVersion).toBe(DERIVATIVES_VERSION)
  })

  it('media:regenerate ist idempotent und erzeugt alte Versionen neu', async () => {
    const doc = await upload('auto')
    await payload.update({
      collection: 'media',
      id: doc.id,
      data: { derivativesVersion: 1 } as never,
      overrideAccess: true,
    })
    const first = await regenerateMedia(payload, { ids: [doc.id] })
    expect(first.regenerated).toEqual([doc.id])
    const after = await payload.findByID({ collection: 'media', id: doc.id, overrideAccess: true })
    expect(after.derivativesVersion).toBe(DERIVATIVES_VERSION)
    const second = await regenerateMedia(payload, { ids: [doc.id] })
    expect(second.regenerated).toEqual([])
    expect(second.skipped).toBe(1)
    expect(first.failed).toEqual([])
  })
})
