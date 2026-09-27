import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

import exifr from 'exifr'
import type { Payload, Where } from 'payload'
import sharp from 'sharp'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { MEDIA_IMAGE_SIZES } from '@/collections/Media'
import { registerMediaReference } from '@/lib/media/references'
import { uploadStaticDir } from '@/lib/storage'

import { makeFixtures } from '../../../scripts/fixtures/make-exif-fixture'
import { getTestPayload } from '../helpers/payload'
import { rest } from '../helpers/rest'

// P1.13: Collection `media` und Bildpipeline (DATENMODELL §6.2, DESIGN §12.2, ARCHITEKTUR §7.4 T-05).

const FIXTURES = path.resolve('tests/fixtures/images')
const ADMIN = { email: 'admin@example.com', password: 'richtig-langes-passwort-2026' }
const SIZE_NAMES = MEDIA_IMAGE_SIZES.map((s) => s.name)

let payload: Payload
const created: number[] = []

type MediaDoc = Awaited<ReturnType<Payload['findByID']>> & {
  id: number
  filename: string
  mimeType: string
  width: number
  height: number
  restricted?: boolean | null
  placeholderDataUrl?: string | null
  dominantColor?: string | null
  sizes: Record<
    string,
    {
      filename: string | null
      width: number | null
      height: number | null
      mimeType: string | null
    }
  >
}

const fileOf = (data: Buffer, name: string, mimetype: string) => ({
  data,
  name,
  mimetype,
  size: data.length,
})

async function upload(
  name: string,
  data: Record<string, unknown> = {},
  mimetype = 'image/jpeg',
  buffer?: Buffer,
): Promise<MediaDoc> {
  const buf = buffer ?? (await readFile(path.join(FIXTURES, name)))
  const doc = (await payload.create({
    collection: 'media',
    data: { alt: 'Blaue Schale mit Hund', ...data } as never,
    file: fileOf(buf, name, mimetype),
    overrideAccess: true,
  })) as unknown as MediaDoc
  created.push(doc.id)
  return doc
}

/** RIFF-Block-Kennungen einer WebP-Datei (z. B. `VP8 `, `VP8X`, `EXIF`, `XMP `). */
function webpChunks(buf: Buffer): string[] {
  expect(buf.toString('latin1', 0, 4)).toBe('RIFF')
  expect(buf.toString('latin1', 8, 12)).toBe('WEBP')
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

const stored = (filename: string) => path.join(uploadStaticDir('media'), filename)

async function storedFiles(doc: MediaDoc): Promise<{ name: string; buffer: Buffer }[]> {
  const names = [
    doc.filename,
    ...SIZE_NAMES.map((n) => doc.sizes[n]?.filename).filter((f): f is string => !!f),
  ]
  return Promise.all(names.map(async (name) => ({ name, buffer: await readFile(stored(name)) })))
}

beforeAll(async () => {
  payload = await getTestPayload()
  // Fixtures liegen im Repo; bei Bedarf neu erzeugen (deterministisch).
  await readFile(path.join(FIXTURES, 'gps-orientation-6.jpg')).catch(() => makeFixtures())
  await payload.delete({
    collection: 'users',
    where: { id: { exists: true } },
    overrideAccess: true,
  })
  await payload.create({
    collection: 'users',
    data: { ...ADMIN, name: 'Jutta', role: 'admin' },
    overrideAccess: true,
  })
})

afterAll(async () => {
  for (const id of created) {
    await payload.delete({ collection: 'media', id, overrideAccess: true }).catch(() => null)
  }
  await payload.delete({
    collection: 'users',
    where: { id: { exists: true } },
    overrideAccess: true,
  })
})

describe('media – Normierung (DESIGN §12.2 Schritt 2)', () => {
  it('Fixture enthält GPS, EXIF, XMP, IPTC und Orientation=6', async () => {
    const buf = await readFile(path.join(FIXTURES, 'gps-orientation-6.jpg'))
    const meta = await sharp(buf).metadata()
    expect(meta.orientation).toBe(6)
    expect(meta.exif).toBeDefined()
    expect(meta.xmp).toBeDefined()
    expect(meta.iptc).toBeDefined()
    const gps = await exifr.gps(buf)
    expect(gps?.latitude).toBeGreaterThan(52)
  })

  it('DM-MEDIA-01/T-05/R-135 Original und alle Größen ohne EXIF/GPS/XMP/IPTC und richtig gedreht', async () => {
    const doc = await upload('gps-orientation-6.jpg')
    // Gespeichert 2000×3000 mit Orientation 6 → angezeigt 3000×2000 → Original höchstens 2560 px lang
    expect(doc.mimeType).toBe('image/webp')
    expect(doc.filename).toMatch(/^gps-orientation-6-[a-f0-9]{10}\.webp$/)
    expect(doc.width).toBe(2560)
    expect(doc.height).toBe(1707)
    const files = await storedFiles(doc)
    expect(files).toHaveLength(6) // Original + 5 Größen
    for (const { name, buffer } of files) {
      const meta = await sharp(buffer).metadata()
      expect(meta.exif, name).toBeUndefined()
      expect(meta.xmp, name).toBeUndefined()
      expect(meta.iptc, name).toBeUndefined()
      expect(meta.orientation ?? 1, name).toBe(1)
      if (meta.format === 'webp') {
        // exifr liest kein WebP: Metadaten stünden in eigenen RIFF-Blöcken
        expect(webpChunks(buffer), name).not.toEqual(expect.arrayContaining(['EXIF']))
        expect(webpChunks(buffer), name).not.toContain('XMP ')
        expect(webpChunks(buffer), name).not.toContain('ICCP')
      } else {
        const parsed = await exifr.parse(buffer, {
          tiff: true,
          gps: true,
          xmp: true,
          iptc: true,
          icc: false,
          mergeOutput: false,
        })
        expect(parsed ?? {}, name).toEqual({})
      }
      // richtig gedreht: Querformat, rote Markierung (gespeichert oben links) jetzt oben rechts
      // (thumb/card sind 4:5-Zuschnitte und damit hochformatig)
      if (!/-(400x500|800x1000)\./.test(name))
        expect(meta.width!, name).toBeGreaterThan(meta.height!)
    }
    const original = await readFile(stored(doc.filename))
    const { data, info } = await sharp(original).raw().toBuffer({ resolveWithObject: true })
    const px = (x: number, y: number) => {
      const i = (y * info.width + x) * info.channels
      return [data[i]!, data[i + 1]!, data[i + 2]!]
    }
    const [r1, g1, b1] = px(info.width - 20, 20)
    expect(r1).toBeGreaterThan(200)
    expect(g1).toBeLessThan(60)
    expect(b1).toBeLessThan(60)
    const [r2] = px(20, 20)
    expect(r2).toBeGreaterThan(200) // Papierton, nicht rot
    const [, g2] = px(20, 20)
    expect(g2).toBeGreaterThan(150)
  })

  it('DM-MEDIA-01 LQIP (WebP ≤ 2 KB) und Dominanzfarbe', async () => {
    const doc = await upload('landscape-small.jpg')
    expect(doc.placeholderDataUrl).toMatch(/^data:image\/webp;base64,/)
    expect(
      Buffer.from(doc.placeholderDataUrl!.split(',')[1]!, 'base64').length,
    ).toBeLessThanOrEqual(2048)
    expect(doc.dominantColor).toMatch(/^#[0-9a-f]{6}$/)
  })
})

describe('media – Bildgrößen (DATENMODELL §6.2, DESIGN §12.2 Schritte 3, 7)', () => {
  it('DM-MEDIA-02/AK-DS-17 thumb/card 4:5 WebP, detail/zoom Originalformat, og 1200×630 JPEG', async () => {
    const doc = await upload('gps-orientation-6.jpg', { alt: 'Blauer Kreis auf Papier' })
    const { thumb, card, detail, zoom, og } = doc.sizes
    for (const [s, w, h] of [
      [thumb, 400, 500],
      [card, 800, 1000],
    ] as const) {
      expect(s!.mimeType).toBe('image/webp')
      expect(s!.width).toBe(w)
      expect(s!.height).toBe(h)
      const meta = await sharp(await readFile(stored(s!.filename!))).metadata()
      expect(meta.format).toBe('webp')
      expect(Math.abs(meta.width! / meta.height! - 0.8)).toBeLessThanOrEqual(0.002)
    }
    const ratio = doc.width / doc.height
    for (const [s, w] of [
      [detail, 1600],
      [zoom, 2560],
    ] as const) {
      expect(s!.mimeType).toBe('image/webp')
      expect(s!.width).toBe(w)
      expect(Math.abs(s!.width! / s!.height! - ratio)).toBeLessThanOrEqual(0.01)
    }
    expect(og!.mimeType).toBe('image/jpeg')
    expect([og!.width, og!.height]).toEqual([1200, 630])
    const ogMeta = await sharp(await readFile(stored(og!.filename!))).metadata()
    expect(ogMeta.format).toBe('jpeg')
  })

  it('DM-MEDIA-02 nichts wird hochskaliert: zu kleine Größen entfallen', async () => {
    const doc = await upload('landscape-small.jpg', { alt: 'Rotes Rechteck auf Papier' })
    expect([doc.width, doc.height]).toEqual([640, 427])
    for (const name of SIZE_NAMES) {
      const s = doc.sizes[name]
      expect(s?.filename ?? null, name).toBeNull()
    }
    const files = await storedFiles(doc)
    expect(files).toHaveLength(1)
    // Auch keine verwaisten Dateien der entfallenen Größen im Speicher
    const base = doc.filename.replace(/\.webp$/, '')
    const onDisk = (await readdir(uploadStaticDir('media'))).filter((f) => f.startsWith(base))
    expect(onDisk).toEqual([doc.filename])
  })

  it('DM-MEDIA-02 Instagram-Format 640×640: nur thumb entsteht (DESIGN §12.2)', async () => {
    const square = await sharp({
      create: { width: 640, height: 640, channels: 3, background: '#88aa55' },
    })
      .jpeg()
      .toBuffer()
    const doc = await upload('insta.jpg', { alt: 'Grüne Fläche als Test' }, 'image/jpeg', square)
    expect(doc.sizes.thumb?.width).toBe(400)
    expect(doc.sizes.thumb?.height).toBe(500)
    for (const name of ['card', 'detail', 'zoom', 'og']) {
      expect(doc.sizes[name]?.filename ?? null, name).toBeNull()
    }
  })
})

describe('media – Validierung', () => {
  it('DM-MEDIA-03 Speichern ohne DE-Alt-Text schlägt fehl', async () => {
    const buf = await readFile(path.join(FIXTURES, 'landscape-small.jpg'))
    const err = await payload
      .create({
        collection: 'media',
        data: {} as never,
        file: fileOf(buf, 'ohne-alt.jpg', 'image/jpeg'),
        overrideAccess: true,
      })
      .then(
        () => null,
        (e: unknown) => e as { data?: { errors?: { path: string; message: string }[] } },
      )
    expect(err).not.toBeNull()
    expect(err!.data?.errors?.[0]?.path).toBe('alt')
  })

  it('DM-MEDIA-03 Alt-Text: nicht der Dateiname, kein „Bild von“, EN optional', async () => {
    const buf = await readFile(path.join(FIXTURES, 'landscape-small.jpg'))
    for (const alt of ['Bild von einer Schale', 'abc']) {
      await expect(
        payload.create({
          collection: 'media',
          data: { alt } as never,
          file: fileOf(buf, 'x.jpg', 'image/jpeg'),
          overrideAccess: true,
        }),
      ).rejects.toThrow()
    }
    const doc = await upload('landscape-small.jpg', { alt: 'Schale mit Hund, blau' })
    await expect(
      payload.update({
        collection: 'media',
        id: doc.id,
        data: { alt: doc.filename } as never,
        overrideAccess: true,
      }),
    ).rejects.toThrow()
    const en = await payload.update({
      collection: 'media',
      id: doc.id,
      locale: 'en',
      data: { alt: '' } as never,
      overrideAccess: true,
    })
    expect(en.id).toBe(doc.id)
  })

  it('GIF- und SVG-Uploads werden abgelehnt (auch als .jpg getarnt)', async () => {
    const gif = await sharp({ create: { width: 10, height: 10, channels: 3, background: '#000' } })
      .gif()
      .toBuffer()
    const svg = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>',
    )
    const cases: [Buffer, string, string][] = [
      [gif, 'bild.gif', 'image/gif'],
      [svg, 'bild.svg', 'image/svg+xml'],
      [gif, 'getarnt.jpg', 'image/jpeg'],
      [svg, 'getarnt2.jpg', 'image/jpeg'],
    ]
    for (const [data, name, mime] of cases) {
      await expect(
        payload.create({
          collection: 'media',
          data: { alt: 'Unzulässiges Format' } as never,
          file: fileOf(data, name, mime),
          overrideAccess: true,
        }),
        name,
      ).rejects.toThrow()
    }
  })
})

describe('media – Zugriff (DATENMODELL §6.2 Access)', () => {
  it('DM-MEDIA-04 Datei eines restricted-Bildes ohne Login nicht abrufbar, mit Login schon', async () => {
    const doc = await upload('landscape-small.jpg', {
      alt: 'Tattoo am Unterarm, Linien',
      showsPerson: 'customer',
    })
    expect(doc.restricted).toBe(true)
    const anon = await rest('GET', `/media/file/${doc.filename}`)
    expect([403, 404]).toContain(anon.status)
    const anonDoc = await rest('GET', `/media/${doc.id}`)
    expect([403, 404]).toContain(anonDoc.status)

    const login = await rest('POST', '/users/login', ADMIN, { 'x-forwarded-for': '198.51.100.7' })
    const { token } = (await login.json()) as { token: string }
    const authed = await rest('GET', `/media/file/${doc.filename}`, undefined, {
      authorization: `JWT ${token}`,
    })
    expect(authed.status).toBe(200)
    expect(authed.headers.get('cache-control')).toContain('private')
  })

  it('DM-MEDIA-04 Größen eines restricted-Bildes sind ebenfalls gesperrt; öffentliche Bilder abrufbar', async () => {
    const restricted = await upload('gps-orientation-6.jpg', {
      alt: 'Tattoo am Oberarm, Kreis',
      showsPerson: 'customer',
    })
    const thumb = await rest('GET', `/media/file/${restricted.sizes.thumb!.filename}`)
    expect([403, 404]).toContain(thumb.status)
    const open = await upload('landscape-small.jpg', { alt: 'Rote Fliese auf Papier' })
    expect(open.restricted).toBe(false)
    const res = await rest('GET', `/media/file/${open.filename}`)
    expect(res.status).toBe(200)
  })

  it('anonym: kein Anlegen, Ändern, Löschen', async () => {
    const doc = await upload('landscape-small.jpg', { alt: 'Rote Fliese, zweite Ansicht' })
    expect((await rest('PATCH', `/media/${doc.id}`, { alt: 'Geändert von außen' })).status).toBe(
      403,
    )
    expect((await rest('DELETE', `/media/${doc.id}`)).status).toBe(403)
  })
})

describe('media – Verweise (src/lib/media/references.ts)', () => {
  it('beforeDelete verweigert das Löschen, solange ein registrierter Eintrag das Bild nutzt', async () => {
    const doc = await upload('landscape-small.jpg', { alt: 'Schale für den Verweistest' })
    const audit = await payload.create({
      collection: 'audit-log',
      data: {
        action: 'product_created',
        actorType: 'system',
        entityCollection: 'media',
        entityId: String(doc.id),
        summary: 'Verweis-Test',
        retainUntil: '2030-01-01T00:00:00.000Z',
      } as never,
      overrideAccess: true,
      context: { skipAudit: true },
    })
    const unregister = registerMediaReference({
      collection: 'audit-log',
      path: 'entityId',
      label: 'Test-Eintrag',
      match: (id): Where => ({
        and: [{ entityCollection: { equals: 'media' } }, { entityId: { equals: String(id) } }],
      }),
    })
    try {
      await expect(
        payload.delete({ collection: 'media', id: doc.id, overrideAccess: true }),
      ).rejects.toThrow(/wird noch verwendet.*Test-Eintrag/)
    } finally {
      unregister()
    }
    await payload.delete({ collection: 'media', id: doc.id, overrideAccess: true })
    await expect(readFile(stored(doc.filename))).rejects.toThrow()
    expect(audit.id).toBeTruthy()
  })
})
