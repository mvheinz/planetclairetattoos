import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { copyFile, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import exifr from 'exifr'
import sharp from 'sharp'
import { afterEach, describe, expect, it } from 'vitest'

import {
  buildCocoRefs,
  NO_PHOTOS_NOTE,
  poseFromName,
  type CocoRefsOptions,
} from '../../../scripts/art/coco-refs'

// P8.11: Import-Skript für Coco-Fotos (Zeichenvorlagen). Echte Coco-Fotos gibt es noch nicht – getestet wird mit der
// GPS-Fixture aus tests/fixtures/images/ (EXIF-Orientierung 6 + GPS), einer PNG mit Transparenz, einer HEIC-Attrappe,
// einer Video-Attrappe und Juttas Skizzen aus content/art/jutta-skizzen/.

const REPO = process.cwd()
const MANIFEST = path.join(REPO, 'content/seed/instagram/manifest.json')
const GPS_FIXTURE = path.join(REPO, 'tests/fixtures/images/gps-orientation-6.jpg')
const sha = (b: Buffer) => createHash('sha256').update(b).digest('hex')

const roots: string[] = []
afterEach(async () => {
  for (const r of roots.splice(0)) await rm(r, { recursive: true, force: true })
})

async function tmpRoot(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), 'pc-coco-'))
  roots.push(root)
  return root
}

function opts(root: string, extra: Partial<CocoRefsOptions> = {}): CocoRefsOptions {
  return {
    root,
    manifestFile: MANIFEST,
    photoDirs: ['content/seed/coco'],
    sketchDirs: ['content/art/jutta-skizzen'],
    ...extra,
  }
}

/** Coco-Ordner wie von Jutta hochgeladen (fiktiv). */
async function cocoFolder(root: string): Promise<string> {
  const dir = path.join(root, 'content/seed/coco')
  await mkdir(dir, { recursive: true })
  await writeFile(path.join(dir, 'LIESMICH.txt'), 'Hier kommen Fotos von Coco hin.\n')
  await copyFile(GPS_FIXTURE, path.join(dir, 'coco-sitzen-1.jpg'))
  await writeFile(
    path.join(dir, 'Coco-Schnüffeln-2.png'),
    await sharp({
      create: {
        width: 400,
        height: 300,
        channels: 4,
        background: { r: 200, g: 120, b: 60, alpha: 0.5 },
      },
    })
      .png()
      .toBuffer(),
  )
  // HEIC-Attrappe: gültiger ftyp-Kopf, aber kein dekodierbares Bild
  await writeFile(
    path.join(dir, 'IMG_4711.HEIC'),
    Buffer.concat([
      Buffer.from([0, 0, 0, 24]),
      Buffer.from('ftypheic\0\0\0\0mif1heic'),
      Buffer.alloc(64),
    ]),
  )
  await writeFile(path.join(dir, 'coco-rennen.mp4'), 'keine echte Videodatei\n')
  return dir
}

describe('art:coco-refs (P8.11)', () => {
  it('ohne Coco-Ordner: läuft durch, coco-refs.json enthält nur die Highlights mit Hinweis „keine eigenen Fotos“', async () => {
    const root = await tmpRoot()
    const res = await buildCocoRefs(opts(root))
    expect(res.file.note).toBe(NO_PHOTOS_NOTE)
    expect(res.file.refs.every((r) => r.origin === 'instagram-highlight')).toBe(true)
    const highlights = (
      JSON.parse(await readFile(MANIFEST, 'utf8')) as {
        images: Array<{ file: string; use?: string }>
      }
    ).images.filter((i) => i.use === 'coco-reference')
    expect(res.file.refs.map((r) => path.basename(r.source))).toEqual(highlights.map((h) => h.file))
    expect(res.file.refs.some((r) => r.source.includes('profil'))).toBe(false)
    expect(res.file.refs.find((r) => r.source.endsWith('highlight-healed.jpg'))?.pose).toBe(
      'kopfschief',
    )
    expect(existsSync(path.join(root, 'content/art/coco-refs.json'))).toBe(true)
  })

  it('Ausgabebilder ohne EXIF/GPS, Orientierung angewandt, sRGB, längste Kante ≤ 1600 px; HEIC übersprungen, Video nur gelistet', async () => {
    const root = await tmpRoot()
    await cocoFolder(root)
    expect((await exifr.gps(GPS_FIXTURE))?.latitude).toBeTypeOf('number')
    const res = await buildCocoRefs(opts(root))
    expect(res.file.note).toBeNull()
    const photos = res.file.refs.filter((r) => r.origin === 'foto')
    expect(photos.map((r) => [path.basename(r.source), r.pose])).toEqual([
      ['Coco-Schnüffeln-2.png', 'schnueffeln'],
      ['coco-sitzen-1.jpg', 'sitzen'],
    ])
    const sit = photos.find((r) => r.pose === 'sitzen')!
    // 2000×3000 mit Orientierung 6 (90° gedreht) → 3000×2000 → auf 1600 px begrenzt
    expect([sit.width, sit.height]).toEqual([1600, 1067])
    expect(sit.sha256).toBe(sha(await readFile(GPS_FIXTURE)))
    for (const ref of photos) {
      const out = await readFile(path.join(root, ref.output!))
      expect(await exifr.parse(out, true), ref.source).toBeUndefined()
      expect(await exifr.gps(out), ref.source).toBeUndefined()
      const meta = await sharp(out).metadata()
      expect([meta.format, meta.space, meta.exif, meta.icc, meta.orientation], ref.source).toEqual([
        'jpeg',
        'srgb',
        undefined,
        undefined,
        undefined,
      ])
      expect(Math.max(meta.width!, meta.height!)).toBeLessThanOrEqual(1600)
    }
    expect(res.file.skipped).toEqual([
      {
        source: 'content/seed/coco/IMG_4711.HEIC',
        reason: 'HEIC kann sharp hier nicht lesen – bitte als JPG schicken',
      },
    ])
    expect(res.file.videos).toEqual(['content/seed/coco/coco-rennen.mp4'])
    expect(res.file.refs.some((r) => r.source.endsWith('LIESMICH.txt'))).toBe(false)
    expect(res.lines.join('\n')).toContain('übersprungen: content/seed/coco/IMG_4711.HEIC')
  })

  it('Juttas Skizzen werden als Herkunft „skizze“ eingelesen (Ordner wählbar) und ebenfalls ohne Metadaten normalisiert', async () => {
    const root = await tmpRoot()
    const res = await buildCocoRefs(
      opts(root, { sketchDirs: [path.join(REPO, 'content/art/jutta-skizzen')] }),
    )
    const sketches = res.file.refs.filter((r) => r.origin === 'skizze')
    expect(sketches.length).toBeGreaterThanOrEqual(5)
    expect(res.file.note).toBe(NO_PHOTOS_NOTE)
    for (const s of sketches) {
      expect(s.pose).toBe('unbekannt')
      expect(s.output).toMatch(/^\.data\/art-refs\/coco\/skizze-/)
      const out = await readFile(path.join(root, s.output!))
      expect(await exifr.gps(out)).toBeUndefined()
      expect(Math.max(s.width, s.height)).toBeLessThanOrEqual(1600)
    }
  })

  it('Posen-Erkennung am Dateinamen (DESIGN §10.3), sonst „unbekannt“', () => {
    expect(poseFromName('coco-rennen-1.jpg')).toBe('rennen')
    expect(poseFromName('coco-schnueffeln-2.JPG')).toBe('schnueffeln')
    expect(poseFromName('Coco_Schnüffeln_3.heic')).toBe('schnueffeln')
    expect(poseFromName('coco-sitzen.png')).toBe('sitzen')
    expect(poseFromName('coco-schlafen-10.jpg')).toBe('schlafen')
    expect(poseFromName('coco-springen-1.jpg')).toBe('springen')
    expect(poseFromName('coco-kopfschief-1.jpg')).toBe('kopfschief')
    expect(poseFromName('coco-kopf-schief-1.jpg')).toBe('kopfschief')
    expect(poseFromName('coco-oh-01.jpg')).toBe('unbekannt')
    expect(poseFromName('IMG_4711.jpg')).toBe('unbekannt')
    expect(poseFromName('hund-rennen-1.jpg')).toBe('unbekannt')
  })

  it('zweiter Lauf erzeugt eine byte-gleiche coco-refs.json und unveränderte Ausgabebilder', async () => {
    const root = await tmpRoot()
    await cocoFolder(root)
    await buildCocoRefs(opts(root))
    const json = await readFile(path.join(root, 'content/art/coco-refs.json'))
    const outDir = path.join(root, '.data/art-refs/coco')
    const outputs = new Map<string, string>()
    for (const f of await readdir(outDir)) outputs.set(f, sha(await readFile(path.join(outDir, f))))
    const second = await buildCocoRefs(opts(root))
    expect(second.changed).toBe(false)
    expect((await readFile(path.join(root, 'content/art/coco-refs.json'))).equals(json)).toBe(true)
    for (const [f, h] of outputs) expect(sha(await readFile(path.join(outDir, f))), f).toBe(h)
  })

  it('die committete coco-refs.json ist aktuell (Highlights + Skizzen, keine eigenen Fotos)', async () => {
    const committed = JSON.parse(
      await readFile(path.join(REPO, 'content/art/coco-refs.json'), 'utf8'),
    ) as { note: string | null; refs: Array<{ source: string; origin: string; sha256: string }> }
    for (const ref of committed.refs) {
      expect(sha(await readFile(path.join(REPO, ref.source))), ref.source).toBe(ref.sha256)
    }
    if (!committed.refs.some((r) => r.origin === 'foto'))
      expect(committed.note).toBe(NO_PHOTOS_NOTE)
  })

  it('Vorlagen werden nie veröffentlicht: kein Hash aus content/seed/coco, content/art oder .data/art-refs unter public/, .next/static, in der Vorschau-Datei oder in den Seed-Medien', async () => {
    const hashes = new Set<string>()
    const b64: string[] = []
    const collect = async (dir: string) => {
      if (!existsSync(dir)) return
      for (const e of await readdir(dir, { withFileTypes: true, recursive: true })) {
        if (!e.isFile() || !/\.(jpe?g|png|heic|webp)$/i.test(e.name)) continue
        const buf = await readFile(path.join(e.parentPath, e.name))
        hashes.add(sha(buf))
        b64.push(buf.toString('base64').slice(0, 200))
      }
    }
    for (const d of ['content/seed/coco', 'content/art', '.data/art-refs'])
      await collect(path.join(REPO, d))
    for (const dir of ['public', '.next/static']) {
      const full = path.join(REPO, dir)
      if (!existsSync(full)) continue
      for (const e of await readdir(full, { withFileTypes: true, recursive: true })) {
        if (!e.isFile() || !/\.(jpe?g|png|webp|avif)$/i.test(e.name)) continue
        expect(hashes.has(sha(await readFile(path.join(e.parentPath, e.name)))), e.name).toBe(false)
      }
    }
    const preview = path.join(REPO, 'dist/planet-claire-vorschau.html')
    if (existsSync(preview)) {
      const html = await readFile(preview, 'utf8')
      for (const head of b64) expect(html.includes(head)).toBe(false)
    }
    // Der Seed nimmt Bilder nur aus content/seed/instagram (Beiträge) und den Platzhaltern.
    const media = await readFile(path.join(REPO, 'content/seed/data/media.json'), 'utf8')
    expect(media).not.toMatch(/content\/seed\/coco|art-refs|jutta-skizzen|highlight-/)
  })
})
