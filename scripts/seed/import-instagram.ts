// `pnpm seed:import-instagram` (PLAN P8.10, SEED-SPEC §4.1, ANLEITUNGEN Anhang): ordnet die Beiträge aus
// `content/seed/instagram/manifest.json` (nur `kind` `post`/`reel-cover`) den Originalbildern aus Juttas
// Instagram-Datenexport zu und schreibt `content/seed/instagram-export-map.json`. Wiederholbar, deterministisch,
// ohne Netz.
//
// Der Export kann in jeder Form aus ANLEITUNGEN Anhang vorliegen: ZIP-Dateien (werden nach `.data/instagram-export/`
// entpackt, gitignored), Monatsordner `<JJJJMM>/…` direkt im Ordner (Beiträge und Stories zusammengelaufen),
// JSON-Ordner, ältere Uploads mit beliebigen Unterpfaden, Mischformen. Medien werden nur über den Dateinamen
// zugeordnet (JSON-`uri` → Basename), nie über einen festen Pfad; Beitrag oder Story bestimmt die `uri`, fehlt das
// JSON, bleibt die Art offen und das Datum kommt aus dem Monatsordner. `LIESMICH.txt` und Videos werden ignoriert.
//
// Zuordnung: Kandidaten ±1 Tag um das Manifest-Datum, dann Wahrnehmungs-Hash (dHash, 64 Bit) gegen das 640-px-Bild –
// Treffer bei Hamming-Abstand ≤ 10 und Seitenverhältnis ±1 %. Genau ein Treffer → gemappt; keiner → „nicht gefunden“;
// mehrere verschiedene Dateien → „mehrdeutig“ (nicht gemappt). `override` in der Map hat Vorrang.
// Highlights, `profil.jpg` und Beiträge außerhalb des Manifests werden nie zugeordnet. Abgeleitete Dateien bleiben in
// `.data/` und werden nie committet; danach `pnpm seed:example --refresh-media`.
import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import { unzipSync } from 'fflate'
import sharp from 'sharp'

import type { ExportMap, ExportMapEntry } from '../../src/lib/seed/exportMap'

export const EXPORT_DIR = 'content/seed/instagram-export'
export const EXTRACT_DIR = '.data/instagram-export'
export const MAP_FILE = 'content/seed/instagram-export-map.json'
export const MANIFEST_FILE = 'content/seed/instagram/manifest.json'
export const MAX_DISTANCE = 10
export const MAX_ASPECT_DEVIATION = 0.01
export const NO_EXPORT_MESSAGE =
  'Kein Instagram-Export gefunden – die Beispielbilder (640 px) bleiben.'

const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif'])
const IGNORED = new Set(['liesmich.txt'])
const DAY = 86_400_000

export type ExportKind = 'post' | 'story' | 'reel' | 'profile' | null

export interface JsonMediaInfo {
  kind: ExportKind
  /** Unix-Sekunden aus `creation_timestamp` (im Objekt oder im nächsten Elternobjekt). */
  timestamp: number | null
}

export interface ExportImage {
  /** Pfad relativ zur Projektwurzel (mit `/`). */
  rel: string
  name: string
  kind: ExportKind
  /** Zeitraum (UTC-Millisekunden), in dem das Bild entstanden ist; `null` = unbekannt. */
  from: number | null
  to: number | null
  sha256: string
  width: number
  height: number
  hash: bigint
}

export interface ImportResult {
  found: boolean
  map: ExportMap
  changed: boolean
  lines: string[]
  status: Record<string, 'gemappt' | 'override' | 'nicht gefunden' | 'mehrdeutig'>
}

export interface ImportOptions {
  /** Projektwurzel; alle übrigen Pfade relativ dazu, sofern nicht absolut. */
  root?: string
  exportDir?: string
  extractDir?: string
  mapFile?: string
  manifestFile?: string
  /** Ordner der 640-px-Bilder (Standard: Ordner des Manifests). */
  imagesDir?: string
}

const posix = (p: string) => p.split(path.sep).join('/')

/** Art aus dem `uri`-Pfad des JSON (`media/posts/…`, `media/stories/…`). */
export function kindFromUri(uri: string): ExportKind {
  const u = `/${uri.toLowerCase()}`
  if (u.includes('/stories/')) return 'story'
  if (u.includes('/posts/')) return 'post'
  if (u.includes('/reels/')) return 'reel'
  if (u.includes('/profile')) return 'profile'
  return null
}

/** Alle Objekte mit `uri` aus einer JSON-Datei des Exports (jede Struktur), Schlüssel = Basename. */
export function collectJsonMedia(json: unknown, out = new Map<string, JsonMediaInfo>()) {
  const walk = (node: unknown, inherited: number | null) => {
    if (Array.isArray(node)) {
      for (const n of node) walk(n, inherited)
      return
    }
    if (!node || typeof node !== 'object') return
    const obj = node as Record<string, unknown>
    const ts = typeof obj.creation_timestamp === 'number' ? obj.creation_timestamp : inherited
    if (typeof obj.uri === 'string' && !/^https?:/i.test(obj.uri)) {
      const name = path.posix.basename(obj.uri.replace(/\\/g, '/'))
      if (!out.has(name)) out.set(name, { kind: kindFromUri(obj.uri), timestamp: ts })
    }
    for (const v of Object.values(obj)) if (v && typeof v === 'object') walk(v, ts)
  }
  walk(json, null)
  return out
}

/** Monatsordner `<JJJJMM>` im Pfad → Zeitraum des Monats (UTC). */
export function monthRange(rel: string): { from: number; to: number } | null {
  const segments = rel.split('/').slice(0, -1).reverse()
  for (const s of segments) {
    const m = /^(20\d\d)(0[1-9]|1[0-2])$/.exec(s)
    if (m) {
      const y = Number(m[1])
      const mo = Number(m[2]) - 1
      return { from: Date.UTC(y, mo, 1), to: Date.UTC(y, mo + 1, 1) - 1 }
    }
  }
  return null
}

/** Art und Zeitraum eines Bildes: JSON hat Vorrang, sonst Monatsordner, Art offen. */
export function describeExportFile(
  rel: string,
  json: ReadonlyMap<string, JsonMediaInfo>,
): { kind: ExportKind; from: number | null; to: number | null } {
  const info = json.get(path.posix.basename(rel))
  if (info?.timestamp != null) {
    const t = info.timestamp * 1000
    return { kind: info.kind, from: t, to: t }
  }
  const month = monthRange(rel)
  return { kind: info?.kind ?? null, from: month?.from ?? null, to: month?.to ?? null }
}

/** dHash 64 Bit (9×8 Graustufen, Vergleich benachbarter Pixel je Zeile). */
export async function dHash(input: Buffer): Promise<bigint> {
  const { data } = await sharp(input)
    .rotate()
    .grayscale()
    .resize(9, 8, { fit: 'fill' })
    .raw()
    .toBuffer({ resolveWithObject: true })
  let hash = 0n
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      hash = (hash << 1n) | (data[y * 9 + x]! > data[y * 9 + x + 1]! ? 1n : 0n)
    }
  }
  return hash
}

export function hamming(a: bigint, b: bigint): number {
  let x = a ^ b
  let n = 0
  while (x) {
    n += Number(x & 1n)
    x >>= 1n
  }
  return n
}

async function orientedSize(buf: Buffer): Promise<{ width: number; height: number }> {
  const meta = await sharp(buf).metadata()
  const w = meta.width ?? 0
  const h = meta.height ?? 0
  return (meta.orientation ?? 1) >= 5 ? { width: h, height: w } : { width: w, height: h }
}

async function walkFiles(dir: string): Promise<string[]> {
  if (!existsSync(dir)) return []
  const out: string[] = []
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) out.push(...(await walkFiles(full)))
    else if (entry.isFile()) out.push(full)
  }
  return out.sort()
}

const sha256 = (b: Buffer | Uint8Array) => createHash('sha256').update(b).digest('hex')

/** Entpackt Bilder und JSON einer ZIP-Datei nach `<extractDir>/<zip-name>/` (Videos werden übersprungen). */
export async function extractZip(zipFile: string, extractDir: string): Promise<string> {
  const target = path.join(extractDir, path.basename(zipFile).replace(/\.zip$/i, ''))
  const buf = await readFile(zipFile)
  const marker = path.join(target, '.zip-sha256')
  const digest = sha256(buf)
  if (existsSync(marker) && (await readFile(marker, 'utf8')) === digest) return target
  const files = unzipSync(new Uint8Array(buf), {
    filter: (f) => {
      const ext = path.posix.extname(f.name).toLowerCase()
      return IMAGE_EXT.has(ext) || ext === '.json'
    },
  })
  for (const [name, data] of Object.entries(files)) {
    const clean = path.posix.normalize(name.replace(/\\/g, '/'))
    if (clean.startsWith('..') || path.posix.isAbsolute(clean) || clean.endsWith('/')) continue
    const out = path.join(target, clean)
    await mkdir(path.dirname(out), { recursive: true })
    await writeFile(out, data)
  }
  await mkdir(target, { recursive: true })
  await writeFile(marker, digest)
  return target
}

interface ManifestImage {
  file: string
  date: string
  kind: string
}

function shortcodeOf(file: string): string {
  return file.replace(/^post-/, '').replace(/\.[a-z]+$/i, '')
}

export function serializeMap(map: ExportMap): string {
  const entries = Object.fromEntries(
    Object.keys(map.entries)
      .sort()
      .map((k) => {
        const e = map.entries[k]!
        return [
          k,
          {
            path: e.path,
            sha256: e.sha256,
            width: e.width,
            height: e.height,
            distance: e.distance,
            override: e.override,
          },
        ]
      }),
  )
  return `${JSON.stringify(
    {
      _hinweis:
        'Erzeugt von pnpm seed:import-instagram (PLAN P8.10). Manuelle Korrektur: "override" auf einen Pfad relativ zur Projektwurzel setzen.',
      entries,
    },
    null,
    2,
  )}\n`
}

async function readMap(file: string): Promise<ExportMap> {
  try {
    const raw = JSON.parse(await readFile(file, 'utf8')) as Partial<ExportMap>
    return { entries: raw.entries ?? {} }
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return { entries: {} }
    throw e
  }
}

export async function importInstagramExport(options: ImportOptions = {}): Promise<ImportResult> {
  const root = path.resolve(options.root ?? process.cwd())
  const abs = (p: string) => (path.isAbsolute(p) ? p : path.join(root, p))
  const exportDir = abs(options.exportDir ?? EXPORT_DIR)
  const extractDir = abs(options.extractDir ?? EXTRACT_DIR)
  const mapFile = abs(options.mapFile ?? MAP_FILE)
  const manifestFile = abs(options.manifestFile ?? MANIFEST_FILE)
  const imagesDir = abs(options.imagesDir ?? path.dirname(manifestFile))
  const relOf = (p: string) => posix(path.relative(root, p))

  const previous = await readMap(mapFile)
  const lines: string[] = []

  // 1. Dateien sammeln (ZIPs entpacken), LIESMICH.txt und Videos ignorieren.
  const files = (await walkFiles(exportDir)).filter(
    (f) => !IGNORED.has(path.basename(f).toLowerCase()),
  )
  const zips = files.filter((f) => f.toLowerCase().endsWith('.zip'))
  const all = [...files]
  for (const zip of zips) {
    const target = await extractZip(zip, extractDir)
    lines.push(`ZIP entpackt: ${relOf(zip)} → ${relOf(target)}`)
    all.push(...(await walkFiles(target)))
  }
  const jsonFiles = all.filter((f) => f.toLowerCase().endsWith('.json'))
  const imageFiles = all.filter((f) => IMAGE_EXT.has(path.extname(f).toLowerCase()))
  if (imageFiles.length === 0) {
    return { found: false, map: previous, changed: false, lines: [NO_EXPORT_MESSAGE], status: {} }
  }

  const json = new Map<string, JsonMediaInfo>()
  for (const f of jsonFiles) {
    try {
      collectJsonMedia(JSON.parse(await readFile(f, 'utf8')), json)
    } catch {
      lines.push(`JSON nicht lesbar, übersprungen: ${relOf(f)}`)
    }
  }

  // 2. Bilder beschreiben (gleiche Datei mehrfach → einmal), HEIC ohne Dekoder überspringen.
  const images: ExportImage[] = []
  const seen = new Set<string>()
  for (const f of imageFiles) {
    const rel = relOf(f)
    const buf = await readFile(f)
    const digest = sha256(buf)
    if (seen.has(digest)) continue
    seen.add(digest)
    try {
      const size = await orientedSize(buf)
      const hash = await dHash(buf)
      const d = describeExportFile(rel, json)
      images.push({ rel, name: path.basename(f), sha256: digest, hash, ...size, ...d })
    } catch {
      lines.push(`Bild nicht lesbar, übersprungen: ${rel}`)
    }
  }

  // 3. Manifest-Beiträge zuordnen.
  const manifest = JSON.parse(await readFile(manifestFile, 'utf8')) as { images: ManifestImage[] }
  const posts = manifest.images
    .filter((i) => i.kind === 'post' || i.kind === 'reel-cover')
    .sort((a, b) => a.file.localeCompare(b.file))
  const entries: Record<string, ExportMapEntry> = {}
  const status: ImportResult['status'] = {}
  for (const post of posts) {
    const code = shortcodeOf(post.file)
    const ref = await readFile(path.join(imagesDir, post.file))
    const refHash = await dHash(ref)
    const refSize = await orientedSize(ref)
    const refAspect = refSize.width / refSize.height
    const override = previous.entries[code]?.override ?? null
    if (override) {
      const buf = await readFile(abs(override))
      const size = await orientedSize(buf)
      entries[code] = {
        path: override,
        sha256: sha256(buf),
        ...size,
        distance: hamming(refHash, await dHash(buf)),
        override,
      }
      status[code] = 'override'
      lines.push(`${code}: gemappt (override) → ${override}`)
      continue
    }
    const day = Date.parse(`${post.date}T00:00:00Z`)
    const lo = day - DAY
    const hi = day + 2 * DAY - 1
    const matches = images
      .filter((img) => img.kind !== 'story' && img.kind !== 'profile')
      .filter((img) => img.from === null || (img.to! >= lo && img.from <= hi))
      .map((img) => ({ img, distance: hamming(refHash, img.hash) }))
      .filter(
        ({ img, distance }) =>
          distance <= MAX_DISTANCE &&
          Math.abs(img.width / img.height / refAspect - 1) <= MAX_ASPECT_DEVIATION,
      )
    if (matches.length === 1) {
      const { img, distance } = matches[0]!
      entries[code] = {
        path: img.rel,
        sha256: img.sha256,
        width: img.width,
        height: img.height,
        distance,
        override: null,
      }
      status[code] = 'gemappt'
      lines.push(`${code}: gemappt → ${img.rel} (${img.width}×${img.height}, Abstand ${distance})`)
    } else if (matches.length === 0) {
      status[code] = 'nicht gefunden'
      lines.push(`${code}: nicht gefunden`)
    } else {
      status[code] = 'mehrdeutig'
      lines.push(
        `${code}: mehrdeutig (${matches.length} Kandidaten: ${matches.map((m) => m.img.rel).join(', ')})`,
      )
    }
  }

  const map: ExportMap = { entries }
  const next = serializeMap(map)
  const before = existsSync(mapFile) ? await readFile(mapFile, 'utf8') : null
  const changed = before !== next
  if (changed) await writeFile(mapFile, next)
  const count = (s: string) => Object.values(status).filter((v) => v === s).length
  lines.push(
    `Instagram-Export: ${count('gemappt') + count('override')} gemappt, ${count('nicht gefunden')} nicht gefunden, ${count('mehrdeutig')} mehrdeutig${changed ? '' : ' (Map unverändert)'}.`,
  )
  if (count('gemappt') + count('override') > 0) {
    lines.push('Weiter mit: pnpm seed:example --refresh-media')
  }
  return { found: true, map, changed, lines, status }
}

async function main(): Promise<void> {
  const res = await importInstagramExport()
  for (const line of res.lines) console.log(line)
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((e: unknown) => {
    console.error(e instanceof Error ? e.message : e)
    process.exit(1)
  })
}
