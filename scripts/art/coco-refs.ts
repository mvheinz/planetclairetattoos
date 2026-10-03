// `pnpm art:coco-refs` (PLAN P8.11, DESIGN §10.1/§10.7, ANLEITUNGEN C1 und Anhang): sammelt die Zeichenvorlagen für
// Coco. Liest die Fotos aus `content/seed/coco/` (JPG, PNG, HEIC; `.mp4` wird nur gelistet) und Juttas Skizzen aus
// `content/art/jutta-skizzen/`, normalisiert sie mit sharp (Orientierung anwenden, sRGB, **alle Metadaten entfernen**
// – Fotos könnten über GPS Juttas Wohnort verraten –, längste Kante ≤ 1600 px) nach `.data/art-refs/coco/`
// (gitignored) und schreibt `content/art/coco-refs.json` (committet: Quelldatei, `sha256`, Maße, Pose aus dem
// Dateinamen `coco-<pose>-<n>` oder `unbekannt`, Herkunft). Die Highlight-Referenzen aus dem Manifest
// (`use: coco-reference`, DESIGN §10.1) stehen immer mit drin. HEIC, das sharp nicht dekodieren kann, wird
// übersprungen und gemeldet. Wiederholbar und deterministisch (byte-gleiche JSON), ohne Netz.
// Die Vorlagen werden nie veröffentlicht: nichts davon gelangt in `media`, `public/`, `.next/static` oder die
// Vorschau-Datei. Weitere Ordner: `pnpm art:coco-refs -- --dir=<ordner>` (Herkunft `foto`).
import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import sharp from 'sharp'

import { SPRITE_POSES } from '../../src/leash/poses'

export const COCO_DIR = 'content/seed/coco'
export const SKETCH_DIR = 'content/art/jutta-skizzen'
export const OUT_DIR = '.data/art-refs/coco'
export const REFS_FILE = 'content/art/coco-refs.json'
export const MANIFEST_FILE = 'content/seed/instagram/manifest.json'
export const MAX_EDGE = 1600
export const NO_PHOTOS_NOTE = 'keine eigenen Fotos'

const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.heic', '.heif', '.webp'])
const VIDEO_EXT = new Set(['.mp4', '.mov', '.m4v'])

export type CocoRefOrigin = 'instagram-highlight' | 'foto' | 'skizze'
export type CocoRefPose = (typeof SPRITE_POSES)[number] | 'unbekannt'

export interface CocoRef {
  /** Quelldatei relativ zur Projektwurzel. */
  source: string
  origin: CocoRefOrigin
  /** SHA-256 der Quelldatei. */
  sha256: string
  /** Maße der Vorlage (bei Fotos/Skizzen nach der Normalisierung). */
  width: number
  height: number
  pose: CocoRefPose
  /** Normalisierte Kopie (nur lokal, gitignored); Highlights werden unverändert genutzt. */
  output: string | null
}

export interface CocoRefsFile {
  _hinweis: string
  note: string | null
  refs: CocoRef[]
  videos: string[]
  skipped: Array<{ source: string; reason: string }>
}

export interface CocoRefsOptions {
  root?: string
  /** Ordner mit Fotos (Herkunft `foto`); Standard `content/seed/coco`. */
  photoDirs?: string[]
  /** Ordner mit Skizzen (Herkunft `skizze`); Standard `content/art/jutta-skizzen`. */
  sketchDirs?: string[]
  outDir?: string
  refsFile?: string
  manifestFile?: string
}

export interface CocoRefsResult {
  file: CocoRefsFile
  changed: boolean
  lines: string[]
}

/** Pose aus dem Dateinamen `coco-<pose>-<n>` (Umlaute und Bindestriche tolerant), sonst `unbekannt`. */
export function poseFromName(file: string): CocoRefPose {
  const base = path
    .basename(file, path.extname(file))
    .toLowerCase()
    .replace(/ü/g, 'ue')
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
  const tokens = base.split(/[-_\s]+/).filter(Boolean)
  if (tokens[0] !== 'coco') return 'unbekannt'
  const word = tokens
    .slice(1)
    .filter((t) => !/^\d+$/.test(t))
    .join('')
  return (SPRITE_POSES as readonly string[]).includes(word) ? (word as CocoRefPose) : 'unbekannt'
}

/** Posen der Highlights laut DESIGN §10.1 (nur, wo das Bild eine Pose zeigt). */
const HIGHLIGHT_POSES: Record<string, CocoRefPose> = {
  'highlight-healed.jpg': 'kopfschief',
  'highlight-hi.jpg': 'schnueffeln',
}

const sha256 = (b: Buffer) => createHash('sha256').update(b).digest('hex')
const posix = (p: string) => p.split(path.sep).join('/')

async function listFiles(dir: string): Promise<string[]> {
  if (!existsSync(dir)) return []
  const out: string[] = []
  for (const e of await readdir(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.')) continue
    const full = path.join(dir, e.name)
    if (e.isDirectory()) out.push(...(await listFiles(full)))
    else if (e.isFile()) out.push(full)
  }
  return out.sort()
}

/** Normalisiert ein Bild: Orientierung, sRGB, ohne Metadaten, längste Kante ≤ 1600 px, JPEG. */
export async function normalizeRef(
  input: Buffer,
): Promise<{ data: Buffer; width: number; height: number }> {
  const { data, info } = await sharp(input, { failOn: 'error' })
    .rotate()
    .resize(MAX_EDGE, MAX_EDGE, { fit: 'inside', withoutEnlargement: true })
    .flatten({ background: '#ffffff' })
    .toColourspace('srgb')
    .jpeg({ quality: 90, chromaSubsampling: '4:4:4' })
    .toBuffer({ resolveWithObject: true })
  return { data, width: info.width, height: info.height }
}

export function serializeRefs(file: CocoRefsFile): string {
  return `${JSON.stringify(file, null, 2)}\n`
}

export async function buildCocoRefs(options: CocoRefsOptions = {}): Promise<CocoRefsResult> {
  const root = path.resolve(options.root ?? process.cwd())
  const abs = (p: string) => (path.isAbsolute(p) ? p : path.join(root, p))
  const rel = (p: string) => posix(path.relative(root, p))
  const outDir = abs(options.outDir ?? OUT_DIR)
  const refsFile = abs(options.refsFile ?? REFS_FILE)
  const manifestFile = abs(options.manifestFile ?? MANIFEST_FILE)
  const lines: string[] = []
  const refs: CocoRef[] = []
  const videos: string[] = []
  const skipped: CocoRefsFile['skipped'] = []

  // 1. Highlights aus dem Manifest (immer, unverändert, 150 px).
  const manifest = JSON.parse(await readFile(manifestFile, 'utf8')) as {
    images: Array<{ file: string; use?: string }>
  }
  for (const img of manifest.images.filter((i) => i.use === 'coco-reference')) {
    const file = path.join(path.dirname(manifestFile), img.file)
    const buf = await readFile(file)
    const meta = await sharp(buf).metadata()
    refs.push({
      source: rel(file),
      origin: 'instagram-highlight',
      sha256: sha256(buf),
      width: meta.width ?? 0,
      height: meta.height ?? 0,
      pose: HIGHLIGHT_POSES[img.file] ?? 'unbekannt',
      output: null,
    })
  }

  // 2. Fotos und Skizzen normalisieren.
  const groups: Array<[CocoRefOrigin, string[]]> = [
    ['foto', (options.photoDirs ?? [COCO_DIR]).map(abs)],
    ['skizze', (options.sketchDirs ?? [SKETCH_DIR]).map(abs)],
  ]
  let photos = 0
  for (const [origin, dirs] of groups) {
    for (const dir of dirs) {
      for (const file of await listFiles(dir)) {
        const ext = path.extname(file).toLowerCase()
        if (VIDEO_EXT.has(ext)) {
          videos.push(rel(file))
          continue
        }
        if (!IMAGE_EXT.has(ext)) continue
        const buf = await readFile(file)
        let normalized: Awaited<ReturnType<typeof normalizeRef>>
        try {
          normalized = await normalizeRef(buf)
        } catch {
          const reason =
            ext === '.heic' || ext === '.heif'
              ? 'HEIC kann sharp hier nicht lesen – bitte als JPG schicken'
              : 'Bild nicht lesbar'
          skipped.push({ source: rel(file), reason })
          lines.push(`übersprungen: ${rel(file)} (${reason})`)
          continue
        }
        const name = `${origin === 'skizze' ? 'skizze-' : ''}${path.basename(file, ext)}.jpg`
        const out = path.join(outDir, name)
        await mkdir(outDir, { recursive: true })
        const existing = existsSync(out) ? await readFile(out) : null
        if (!existing || !existing.equals(normalized.data)) await writeFile(out, normalized.data)
        refs.push({
          source: rel(file),
          origin,
          sha256: sha256(buf),
          width: normalized.width,
          height: normalized.height,
          pose: poseFromName(file),
          output: rel(out),
        })
        if (origin === 'foto') photos++
      }
    }
  }

  const file: CocoRefsFile = {
    _hinweis:
      'Erzeugt von pnpm art:coco-refs (PLAN P8.11). Nur Zeichenvorlagen – nie veröffentlichen (ANLEITUNGEN C1). Normalisierte Kopien liegen lokal in .data/art-refs/coco/.',
    note: photos === 0 ? NO_PHOTOS_NOTE : null,
    refs,
    videos,
    skipped,
  }
  const next = serializeRefs(file)
  const before = existsSync(refsFile) ? await readFile(refsFile, 'utf8') : null
  const changed = before !== next
  if (changed) {
    await mkdir(path.dirname(refsFile), { recursive: true })
    await writeFile(refsFile, next)
  }
  const count = (o: CocoRefOrigin) => refs.filter((r) => r.origin === o).length
  lines.push(
    `Coco-Vorlagen: ${count('instagram-highlight')} Highlights, ${count('foto')} Fotos, ${count('skizze')} Skizzen, ${videos.length} Videos (nur gelistet), ${skipped.length} übersprungen${photos === 0 ? ` – ${NO_PHOTOS_NOTE}` : ''}${changed ? '' : ' (unverändert)'}.`,
  )
  return { file, changed, lines }
}

function parseArgs(argv: readonly string[]): CocoRefsOptions {
  const dirs = argv.filter((a) => a.startsWith('--dir=')).map((a) => a.slice('--dir='.length))
  return dirs.length > 0 ? { photoDirs: [COCO_DIR, ...dirs] } : {}
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  buildCocoRefs(parseArgs(process.argv.slice(2)))
    .then((res) => {
      for (const line of res.lines) console.log(line)
    })
    .catch((e: unknown) => {
      console.error(e instanceof Error ? e.message : e)
      process.exit(1)
    })
}
