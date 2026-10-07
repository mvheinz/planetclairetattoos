import { createHash } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

import exifr from 'exifr'
import type { Payload, PayloadRequest } from 'payload'
import sharp from 'sharp'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import { getEnv, resetEnvCache, type Env } from '@/lib/env'
import { cropPixels } from '@/lib/seed/example'
import { fallbackArtSvg, placeholderArtWebp } from '@/lib/seed/fallbackArt'
import { SEED_EXPECTED_DETAIL, expectedCount } from '@/lib/seed/expected'
import { loadSeedData } from '@/lib/seed/loader'
import { fileResponseHandler, uploadStaticDir } from '@/lib/storage'

import { getTestPayload } from '../helpers/payload'
import { rest } from '../helpers/rest'
import {
  SEED_N,
  SEED_TIMEOUT,
  bySeedKey,
  findAll,
  runCanonicalSeed,
  type SeedDoc,
} from './canonical'

// P8.2: Medien und private Dateien des Beispielbestands (SEED-SPEC §4) – Mengen, Felder, Ausschnitte, AK-SEED-19,
// gesperrte Kund:innen-Bilder (DM-MEDIA-04), keine Hochskalierung, keine Metadaten (DM-MEDIA-01), R-136.

const IG_DIR = path.join(process.cwd(), 'content/seed/instagram')
let payload: Payload
let media: SeedDoc[]

type Sizes = Record<string, { filename?: string | null; width?: number | null } | undefined>

function webpChunks(buf: Buffer): string[] {
  const ids: string[] = []
  let off = 12
  while (off + 8 <= buf.length) {
    const id = buf.toString('latin1', off, off + 4)
    const size = buf.readUInt32LE(off + 4)
    ids.push(id)
    off += 8 + size + (size % 2)
  }
  return ids
}

/** Datei-Handler der Mediathek mit injizierter Umgebung (anonym), wie tests/int/legal/gallery-consent.int.spec.ts. */
async function serve(filename: string, env: Env): Promise<Response | undefined> {
  const handler = fileResponseHandler('media', env)
  const req = { payload, user: null, headers: new Headers() } as unknown as PayloadRequest
  return (await handler(req, {
    doc: undefined as never,
    headers: new Headers(),
    params: { collection: 'media', filename },
  })) as Response | undefined
}

const sha256 = (b: Buffer) => createHash('sha256').update(b).digest('hex')

/** Mittlere Abweichung je Kanal (0–255) zweier Bilder, beide auf 80×100 verkleinert. */
async function pixelDiff(a: Buffer, b: Buffer): Promise<number> {
  const raw = (x: Buffer) =>
    sharp(x).resize(80, 100, { fit: 'fill' }).removeAlpha().raw().toBuffer()
  const [pa, pb] = await Promise.all([raw(a), raw(b)])
  let sum = 0
  for (let i = 0; i < pa.length; i++) sum += Math.abs(pa[i]! - pb[i]!)
  return sum / pa.length
}

beforeAll(async () => {
  payload = await getTestPayload()
  await runCanonicalSeed(payload)
  media = await findAll(payload, 'media', { seed: { equals: true } })
}, SEED_TIMEOUT)

afterEach(() => {
  vi.unstubAllEnvs()
  resetEnvCache()
})

afterAll(async () => {
  await runCanonicalSeed(payload, 'remove', { yes: true, dropTexts: true })
}, SEED_TIMEOUT)

describe('Medien des Beispielbestands (SEED-SPEC §4.1, §4.2)', () => {
  it('Menge laut SEED_EXPECTED_COUNTS; alle seed = true mit seedKey media:ig:… bzw. media:ph:… und passender Quelle', () => {
    expect(media).toHaveLength(expectedCount('media'))
    const ig = media.filter((m) => String(m.seedKey).startsWith('media:ig:'))
    const ph = media.filter((m) => String(m.seedKey).startsWith('media:ph:'))
    expect(ig).toHaveLength(SEED_EXPECTED_DETAIL.media.instagram)
    expect(ph).toHaveLength(SEED_EXPECTED_DETAIL.media.placeholders)
    for (const m of ig) {
      expect(m.source).toBe('instagram_seed')
      expect(m.sourceRef).toBe(String(m.seedKey).slice('media:ig:'.length))
    }
    for (const m of ph) {
      expect(m.source).toBe('placeholder')
      expect(m.alt).toMatch(/^Platzhalter-Zeichnung: /)
      expect([m.width, m.height]).toEqual([800, 1000])
    }
  })

  it('P8.12 P8.13: kein Platzhalter stammt mehr aus fallbackArt – jedes Bild ist die gerasterte Zeichnung aus src/art/placeholders', async () => {
    const data = await loadSeedData({ now: SEED_N })
    const dir = uploadStaticDir('media')
    expect(data.media.placeholders).toHaveLength(SEED_EXPECTED_DETAIL.media.placeholders)
    for (const entry of data.media.placeholders) {
      const art = await placeholderArtWebp(entry.key, entry.wash)
      expect(art.fromFile, entry.key).toBe(true)
      const doc = media.find((m) => m.seedKey === `media:${entry.key}`)!
      const stored = await readFile(path.join(dir, String(doc.filename)))
      const fallback = Buffer.from(fallbackArtSvg(entry.key, entry.wash))
      // gespeichertes Bild (ggf. neu kodiert) gleicht der Zeichnung, nicht der Ersatzzeichnung
      const toArt = await pixelDiff(stored, art.data)
      expect(toArt, entry.key).toBeLessThan(3)
      expect(toArt, entry.key).toBeLessThan(await pixelDiff(stored, fallback))
    }
  })

  it('Ausschnitt-Pixel der 640-px-Quellen entsprechen der Kontrollspalte (§2.4, §4.1)', async () => {
    const data = await loadSeedData({ now: SEED_N })
    for (const entry of data.media.instagram) {
      const doc = media.find((m) => m.seedKey === `media:${entry.key}`)!
      const meta = await sharp(path.join(IG_DIR, entry.file)).metadata()
      const expected = entry.crop
        ? cropPixels(entry.crop, meta.width!, meta.height!)
        : { width: meta.width!, height: meta.height! }
      expect([doc.width, doc.height], entry.key).toEqual([expected.width, expected.height])
    }
    const cap = await bySeedKey(payload, 'media', 'ig:DdHXUQsDjqm#cap')
    expect([cap.width, cap.height]).toEqual([326, 288])
    expect([cap.focalX, cap.focalY]).toEqual([50, 55])
  })

  it('AK-SEED-19: kein Bild aus Highlights/profil.jpg (SHA-256); DdHXUQsDjqm nur als Ausschnitt #cap', async () => {
    const forbidden = new Set<string>()
    for (const f of await readdir(IG_DIR)) {
      if (/^(highlight-.*|profil)\.jpg$/.test(f)) {
        const buf = await readFile(path.join(IG_DIR, f))
        forbidden.add(sha256(buf))
        forbidden.add(sha256(await sharp(buf).webp().toBuffer()))
      }
    }
    const dir = uploadStaticDir('media')
    for (const m of media) {
      const stored = await readFile(path.join(dir, String(m.filename)))
      expect(forbidden.has(sha256(stored)), String(m.seedKey)).toBe(false)
      expect(String(m.sourceRef ?? '')).not.toMatch(/highlight|profil/)
    }
    const cap = media.filter((m) => String(m.sourceRef).startsWith('DdHXUQsDjqm'))
    expect(cap.map((m) => m.sourceRef)).toEqual(['DdHXUQsDjqm#cap'])
  })

  it('DM-MEDIA-04: Kund:innen-Tattoofotos showsPerson = customer, restricted; ohne Anmeldung 404 (ohne Vorschau-Modus)', async () => {
    vi.stubEnv('SEED_PREVIEW_MODE', 'false')
    resetEnvCache()
    const env = getEnv()
    for (const key of ['ig:DOZTG7PjLAD', 'ig:DZqBCSZDDiE']) {
      const doc = await bySeedKey(payload, 'media', key)
      expect([doc.showsPerson, doc.restricted], key).toEqual(['customer', true])
      expect((await serve(String(doc.filename), env))?.status, key).toBe(404)
      const thumb = (doc.sizes as Sizes).thumb?.filename
      if (thumb) expect((await serve(thumb, env))?.status).toBe(404)
      // REST-Abruf des Dokuments ohne Anmeldung
      expect([403, 404]).toContain((await rest('GET', `/media/${doc.id}`)).status)
    }
    const others = media.filter(
      (m) =>
        !['media:ig:DOZTG7PjLAD', 'media:ig:DZqBCSZDDiE'].includes(String(m.seedKey)) &&
        !String(m.seedKey).startsWith('media:own:'), // P12.16: von Jutta freigegebene Fotos
    )
    expect(others.every((m) => m.showsPerson === 'none' && m.restricted !== true)).toBe(true)
  })

  it('DM-MEDIA-01: keine Größe hochskaliert, keine gespeicherte Datei mit EXIF/XMP', async () => {
    const dir = uploadStaticDir('media')
    for (const m of media) {
      const names = [
        String(m.filename),
        ...Object.values((m.sizes ?? {}) as Sizes).flatMap((s) => {
          if (!s?.filename) return []
          expect(s.width ?? 0, `${String(m.seedKey)} ${s.filename}`).toBeLessThanOrEqual(
            m.width as number,
          )
          return [s.filename]
        }),
      ]
      for (const name of names) {
        const buf = await readFile(path.join(dir, name))
        if (buf.toString('latin1', 8, 12) === 'WEBP') {
          expect(webpChunks(buf), name).not.toContain('EXIF')
          expect(webpChunks(buf), name).not.toContain('XMP ')
        } else {
          const parsed = await exifr.parse(buf, { tiff: true, gps: true, xmp: true, icc: false })
          expect(parsed ?? {}, name).toEqual({})
        }
      }
    }
  })
})

describe('Private Dateien des Beispielbestands (SEED-SPEC §4.4, R-136)', () => {
  it('alle Einträge aus private-uploads.json mit seed = true und Zweck; ohne Anmeldung nie abrufbar', async () => {
    const data = await loadSeedData({ now: SEED_N })
    for (const entry of data.privateUploads) {
      const doc = await bySeedKey(payload, 'private-uploads', entry.key)
      expect([doc.seed, doc.purpose], entry.key).toEqual([true, entry.purpose])
      expect(doc.sha256).toMatch(/^[0-9a-f]{64}$/)
      const anon = await rest('GET', `/private-uploads/file/${String(doc.filename)}`)
      expect([401, 403, 404], entry.key).toContain(anon.status)
      expect((await rest('GET', `/private-uploads/${doc.id}`)).status).toBeGreaterThanOrEqual(401)
    }
    const packing = await bySeedKey(payload, 'private-uploads', 'O12:packing-1')
    expect([packing.mimeType, packing.width, packing.height]).toEqual(['image/jpeg', 1200, 900])
    const sketch = await bySeedKey(payload, 'private-uploads', 'A2:sketch-1')
    expect([sketch.width, sketch.height]).toEqual([1000, 1000])
  })
})
