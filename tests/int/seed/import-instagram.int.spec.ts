import { createHash } from 'node:crypto'
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import type { Payload } from 'payload'
import sharp from 'sharp'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { cropPixels } from '@/lib/seed/example'
import { expectedCount } from '@/lib/seed/expected'
import { loadSeedData } from '@/lib/seed/loader'
import { uploadStaticDir } from '@/lib/storage'

import { importInstagramExport } from '../../../scripts/seed/import-instagram'
import { getTestPayload } from '../helpers/payload'
import {
  SEED_N,
  SEED_TIMEOUT,
  bySeedKey,
  findAll,
  runCanonicalSeed,
  type SeedDoc,
} from './canonical'

// P8.10: Der Medien-Schritt nimmt für gemappte Kürzel das Original aus dem Instagram-Export – nach
// `seed:example --refresh-media` mit denselben Prozent-Ausschnitten, demselben `seedKey`, `source = instagram_export`
// und unveränderter Anzahl (AK-SEED-19 mit den Pixeln der tatsächlich verwendeten Quelle). Grundlage ist die fiktive
// Mini-Export-Struktur aus tests/fixtures/instagram-export/ (keine echten Daten).

// Zwei Seed-Läufe mit Medien-Pipeline je Test: mehr Zeit als der Standard.
vi.setConfig({ testTimeout: SEED_TIMEOUT * 2, hookTimeout: SEED_TIMEOUT })

const REPO = process.cwd()
const FIXTURE = path.join(REPO, 'tests/fixtures/instagram-export')
const sha = (b: Buffer) => createHash('sha256').update(b).digest('hex')

let payload: Payload
let tmp: string
let mapFile: string
let before: Map<string, SeedDoc>
const beforeSha = new Map<string, string>()
let mediaCount: number

const KEYS = ['media:ig:DaDz8yljp3i', 'media:ig:DdHXUQsDjqm#cap'] as const

async function stored(doc: SeedDoc): Promise<Buffer> {
  return readFile(path.join(uploadStaticDir('media'), String(doc.filename)))
}

beforeAll(async () => {
  payload = await getTestPayload()
  await runCanonicalSeed(payload)
  mediaCount = (await findAll(payload, 'media', { seed: { equals: true } })).length
  before = new Map()
  for (const key of KEYS) {
    const doc = await bySeedKey(payload, 'media', key.slice(6))
    before.set(key, doc)
    beforeSha.set(key, sha(await stored(doc)))
  }
  tmp = await mkdtemp(path.join(tmpdir(), 'pc-ig-int-'))
  mapFile = path.join(tmp, 'instagram-export-map.json')
  const res = await importInstagramExport({
    root: REPO,
    exportDir: FIXTURE,
    extractDir: path.join(tmp, 'extract'),
    mapFile,
  })
  expect(Object.keys(res.map.entries).sort()).toEqual(['DaDz8yljp3i', 'DdHXUQsDjqm'])
}, SEED_TIMEOUT)

afterAll(async () => {
  await rm(tmp, { recursive: true, force: true })
})

describe('Instagram-Export im Medien-Schritt (P8.10)', () => {
  it('ohne --refresh-media bleibt die Datei; mit --refresh-media ersetzt der Seed sie – seedKey und Anzahl gleich, source = instagram_export', async () => {
    await runCanonicalSeed(payload, 'example', { exportMapFile: mapFile })
    for (const key of KEYS) {
      const doc = await bySeedKey(payload, 'media', key.slice(6))
      expect(doc.filename, key).toBe(before.get(key)!.filename)
      expect(doc.source, key).toBe('instagram_seed')
    }

    const { report } = await runCanonicalSeed(payload, 'example', {
      exportMapFile: mapFile,
      refreshMedia: true,
    })
    expect(report.get('media', 'created')).toBe(0)
    expect((await findAll(payload, 'media', { seed: { equals: true } })).length).toBe(mediaCount)
    expect(mediaCount).toBe(expectedCount('media'))
    for (const key of KEYS) {
      const old = before.get(key)!
      const doc = await bySeedKey(payload, 'media', key.slice(6))
      expect(doc.id, key).toBe(old.id)
      expect(doc.seedKey, key).toBe(key)
      expect(doc.source, key).toBe('instagram_export')
      expect(sha(await stored(doc)), key).not.toBe(beforeSha.get(key))
    }
    // Nicht gemappte Instagram-Bilder bleiben beim 640-px-Bild.
    const other = await bySeedKey(payload, 'media', 'ig:DcrENrOjlGP')
    expect(other.source).toBe('instagram_seed')
  })

  it('AK-SEED-19: Ausschnitte in Prozent, Pixel aus den Maßen der tatsächlich verwendeten Quelle (Original > 640 px)', async () => {
    const data = await loadSeedData({ now: SEED_N, requireBase: false })
    const map = JSON.parse(await readFile(mapFile, 'utf8')) as {
      entries: Record<string, { width: number; height: number }>
    }
    for (const [key, code] of [
      ['ig:DaDz8yljp3i', 'DaDz8yljp3i'],
      ['ig:DdHXUQsDjqm#cap', 'DdHXUQsDjqm'],
    ] as const) {
      const entry = data.media.instagram.find((e) => e.key === key)!
      const src = map.entries[code]!
      expect(Math.max(src.width, src.height), key).toBeGreaterThan(640)
      const px = cropPixels(entry.crop!, src.width, src.height)
      const doc = await bySeedKey(payload, 'media', key)
      expect([doc.width, doc.height], key).toEqual([px.width, px.height])
      // breiter als derselbe Ausschnitt aus dem 640-px-Bild
      const small = await sharp(path.join(REPO, 'content/seed/instagram', entry.file)).metadata()
      expect(Number(doc.width), key).toBeGreaterThan(
        cropPixels(entry.crop!, small.width!, small.height!).width,
      )
    }
    // DdHXUQsDjqm nur als Ausschnitt #cap
    const caps = await findAll(payload, 'media', { sourceRef: { like: 'DdHXUQsDjqm' } })
    expect(caps.map((m) => m.sourceRef)).toEqual(['DdHXUQsDjqm#cap'])
  })

  it('kein Export-Bild landet ungeschnitten in media (SHA-256 und Wahrnehmung), Kundenfotos bleiben gesperrt', async () => {
    const fixture = new Set<string>()
    for (const e of await readdir(FIXTURE, { withFileTypes: true, recursive: true })) {
      if (!e.isFile() || !e.name.endsWith('.jpg')) continue
      const buf = await readFile(path.join(e.parentPath, e.name))
      fixture.add(sha(buf))
      fixture.add(sha(await sharp(buf).webp({ quality: 90 }).toBuffer()))
    }
    for (const doc of await findAll(payload, 'media', { seed: { equals: true } })) {
      expect(fixture.has(sha(await stored(doc))), String(doc.seedKey)).toBe(false)
    }
    const cap = await bySeedKey(payload, 'media', 'ig:DdHXUQsDjqm#cap')
    // Ausschnitt, nicht das ganze Foto: Seitenverhältnis des Ausschnitts (~1,13:1), nicht 3:4.
    expect(Number(cap.width) / Number(cap.height)).toBeGreaterThan(1.05)
    for (const key of ['ig:DOZTG7PjLAD', 'ig:DZqBCSZDDiE']) {
      const doc = await bySeedKey(payload, 'media', key)
      expect([doc.showsPerson, doc.restricted, doc.source], key).toEqual([
        'customer',
        true,
        'instagram_seed',
      ])
    }
  })

  it('ein normaler Lauf danach ändert source und Datei nicht', async () => {
    const now = await bySeedKey(payload, 'media', 'ig:DaDz8yljp3i')
    await runCanonicalSeed(payload, 'example', { exportMapFile: mapFile })
    const after = await bySeedKey(payload, 'media', 'ig:DaDz8yljp3i')
    expect([after.source, after.filename]).toEqual(['instagram_export', now.filename])
  })
})
