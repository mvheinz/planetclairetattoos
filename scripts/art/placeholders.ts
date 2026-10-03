// `pnpm art:placeholders` (PLAN P8.12/P8.13, DESIGN §12.3, SEED-SPEC §4.2): liest die Motiv-Skizzen
// `content/art/placeholders/{typ}-{n}.ts` (gezeichnete Bezier-Kontrollpunkte, Bausteine aus `_parts.ts`) und schreibt
// `src/art/placeholders/{typ}-{n}.svg` (400×500, Strich 2.4 Tusche, eine Wash-Fläche laut `content/seed/data/media.json`).
// Deterministisch: zweimal ausführen → byte-gleiche Dateien. Danach `pnpm seed:example --refresh-media`.
//
// Optionen: `--sheet` schreibt den Kontaktbogen `artifacts/placeholders-sheet.webp` (nicht committen, für die
// Prüf-Linse KUNST-QA §6.7); `--png=<ordner>` schreibt zusätzlich jedes Motiv als PNG 800×1000 (Sichtprüfung).
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import sharp from 'sharp'

import { type Motif, renderMotif, type WashName } from './lib/handline'

export const MOTIF_DIR = path.join('content', 'art', 'placeholders')
export const OUTPUT_DIR = path.join('src', 'art', 'placeholders')
export const PLACEHOLDER_MAX_BYTES = 6000

interface MediaPlaceholder {
  key: string
  wash: WashName | null
}

export function placeholderWashes(root = process.cwd()): Map<string, WashName | null> {
  const media = JSON.parse(
    readFileSync(path.join(root, 'content/seed/data/media.json'), 'utf8'),
  ) as {
    placeholders: MediaPlaceholder[]
  }
  return new Map(media.placeholders.map((p) => [p.key.replace(/^ph:/, ''), p.wash]))
}

export function motifNames(root = process.cwd()): string[] {
  return readdirSync(path.join(root, MOTIF_DIR))
    .filter((f) => /^[a-z]+-\d+\.ts$/.test(f))
    .map((f) => f.replace(/\.ts$/, ''))
    .sort()
}

/** Alle Platzhalter als SVG-Text (ohne zu schreiben). */
export async function buildPlaceholders(root = process.cwd()): Promise<Map<string, string>> {
  const washes = placeholderWashes(root)
  const out = new Map<string, string>()
  for (const name of motifNames(root)) {
    if (!washes.has(name))
      throw new Error(`${name}: kein Eintrag ph:${name} in content/seed/data/media.json`)
    const mod = (await import(pathToFileURL(path.join(root, MOTIF_DIR, `${name}.ts`)).href)) as {
      default: Motif
    }
    out.set(name, renderMotif(mod.default, { key: `ph:${name}`, wash: washes.get(name) ?? null }))
  }
  return out
}

export async function rasterize(svg: string, width = 800, height = 1000): Promise<Buffer> {
  return sharp(Buffer.from(svg), { density: 144 })
    .resize(width, height, { fit: 'fill' })
    .png()
    .toBuffer()
}

/** Kontaktbogen: alle Motive in einem Raster mit Namen darunter (nur für die Prüfung, nicht im Repo). */
export async function contactSheet(
  svgs: Map<string, string>,
  file: string,
  cols = 6,
): Promise<void> {
  const w = 320
  const h = 400
  const label = 28
  const names = [...svgs.keys()]
  const rows = Math.ceil(names.length / cols)
  const tiles = await Promise.all(
    names.map(async (name, i) => {
      const img = await sharp(Buffer.from(svgs.get(name)!), { density: 72 })
        .resize(w, h, { fit: 'fill' })
        .png()
        .toBuffer()
      const text = Buffer.from(
        `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${label}"><rect width="100%" height="100%" fill="#fff"/><text x="8" y="20" font-family="monospace" font-size="16" fill="#000">${name}</text></svg>`,
      )
      const x = (i % cols) * (w + 8)
      const y = Math.floor(i / cols) * (h + label + 8)
      return [
        { input: img, left: x, top: y },
        { input: await sharp(text).png().toBuffer(), left: x, top: y + h },
      ]
    }),
  )
  mkdirSync(path.dirname(file), { recursive: true })
  await sharp({
    create: {
      width: cols * (w + 8),
      height: rows * (h + label + 8),
      channels: 3,
      background: '#ffffff',
    },
  })
    .composite(tiles.flat())
    .webp({ quality: 90 })
    .toFile(file)
}

async function main() {
  const args = process.argv.slice(2)
  const svgs = await buildPlaceholders()
  mkdirSync(OUTPUT_DIR, { recursive: true })
  const lines: string[] = []
  let errors = 0
  for (const [name, svg] of svgs) {
    const file = path.join(OUTPUT_DIR, `${name}.svg`)
    writeFileSync(file, svg)
    const bytes = Buffer.byteLength(svg)
    const over = bytes > PLACEHOLDER_MAX_BYTES
    if (over) errors++
    lines.push(`${name.padEnd(16)} ${String(bytes).padStart(5)} B${over ? '  ÜBER BUDGET' : ''}`)
  }
  const png = args.find((a) => a.startsWith('--png='))?.slice(6)
  if (png) {
    mkdirSync(png, { recursive: true })
    for (const [name, svg] of svgs)
      writeFileSync(path.join(png, `${name}.png`), await rasterize(svg))
  }
  if (args.includes('--sheet'))
    await contactSheet(svgs, path.join('artifacts', 'placeholders-sheet.webp'))
  process.stdout.write(
    `${lines.join('\n')}\n${svgs.size} Platzhalter geschrieben nach ${OUTPUT_DIR}.\n`,
  )
  if (errors) {
    process.stderr.write(`${errors} Datei(en) über ${PLACEHOLDER_MAX_BYTES} B.\n`)
    process.exitCode = 1
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((err: unknown) => {
    process.stderr.write(`${err instanceof Error ? err.stack : String(err)}\n`)
    process.exitCode = 1
  })
}
