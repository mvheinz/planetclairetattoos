// `pnpm fonts:copy` (ARCHITEKTUR §6.10, DESIGN §4.1, PLAN P2.4): kopiert genau drei WOFF2-Dateien aus den
// `@fontsource*`-Paketen nach `src/styles/fonts/` – offline, ohne Python, deterministisch (harfbuzz-wasm über das
// npm-Paket `subset-font`). Budget laut AK-DS-04: genau 3 Dateien, zusammen ≤ 100 KB.
//
// Damit das Budget hält (Rohdateien zusammen ~123 KB), wird jede Datei neu verpackt, ohne den Zeichenumfang
// „latin“ zu ändern (`keepAllGlyphs`):
// - Mansalva 400: ohne TrueType-Hinting (nur ≥ 24 px im Einsatz, DESIGN §4.3) und nur die Layout-Features, die
//   Handschrift und Text brauchen (`calt`, `ccmp`, `liga`, `kern`); die Bruchziffern-Features entfallen.
// - Bricolage Grotesque (variabel): Achse `wght` auf 400–700 beschnitten (DESIGN §4.1; die Skala nutzt 400–700).
// - IBM Plex Mono 400: ohne TrueType-Hinting.
// Außerdem schreibt das Skript die Zeichenabdeckung der Mansalva-Datei nach `src/styles/mansalvaCoverage.generated.ts`
// (Grundlage für `GlyphFallback`, DESIGN §4.4).
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import * as fontkit from 'fontkit'
import subsetFont from 'subset-font'

export interface FontJob {
  /** Dateiname unter `src/styles/fonts/` (= Fontsource-Name). */
  file: string
  /** Quelle relativ zu `node_modules`. */
  source: string
  options: Parameters<typeof subsetFont>[2]
}

/** Achsenbereich der beschnittenen Bricolage-Datei. */
export const BRICOLAGE_WGHT = { min: 400, max: 700 } as const
/** Budget AK-DS-04 (Bytes). */
export const FONT_BUDGET_BYTES = 100 * 1000

export const FONT_JOBS: readonly FontJob[] = [
  {
    file: 'mansalva-latin-400-normal.woff2',
    source: '@fontsource/mansalva/files/mansalva-latin-400-normal.woff2',
    options: {
      targetFormat: 'woff2',
      keepAllGlyphs: true,
      noHinting: true,
      keepFeatures: ['calt', 'ccmp', 'liga', 'kern'],
    },
  },
  {
    file: 'bricolage-grotesque-latin-wght-normal.woff2',
    source:
      '@fontsource-variable/bricolage-grotesque/files/bricolage-grotesque-latin-wght-normal.woff2',
    options: {
      targetFormat: 'woff2',
      keepAllGlyphs: true,
      variationAxes: { wght: { ...BRICOLAGE_WGHT } },
    },
  },
  {
    file: 'ibm-plex-mono-latin-400-normal.woff2',
    source: '@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-400-normal.woff2',
    options: { targetFormat: 'woff2', keepAllGlyphs: true, noHinting: true },
  },
]

export interface BuiltFont {
  file: string
  data: Buffer
}

/** Erzeugt die drei Schriftdateien im Speicher (ohne Netz). */
export async function buildFonts(nodeModules: string): Promise<BuiltFont[]> {
  const out: BuiltFont[] = []
  for (const job of FONT_JOBS) {
    const original = readFileSync(path.join(nodeModules, job.source))
    const data = await subsetFont(original, '', job.options)
    out.push({ file: job.file, data: Buffer.from(data) })
  }
  return out
}

/** Zusammenhängende Bereiche der Code Points, die eine Schrift abdeckt. */
export function coverageRanges(font: Buffer): [number, number][] {
  const parsed = fontkit.create(font) as fontkit.Font
  const points = [...new Set(parsed.characterSet)].sort((a, b) => a - b)
  const ranges: [number, number][] = []
  for (const cp of points) {
    const last = ranges.at(-1)
    if (last && cp === last[1] + 1) last[1] = cp
    else ranges.push([cp, cp])
  }
  return ranges
}

export function coverageModule(ranges: [number, number][]): string {
  const body = ranges.map(([a, b]) => `  [0x${a.toString(16)}, 0x${b.toString(16)}],`).join('\n')
  return [
    '// Erzeugt von `pnpm fonts:copy` (scripts/fonts/copy.ts) – nicht von Hand ändern.',
    '// Zeichenabdeckung von src/styles/fonts/mansalva-latin-400-normal.woff2 (DESIGN §4.4, GlyphFallback).',
    'export const MANSALVA_COVERAGE: readonly (readonly [number, number])[] = [',
    body,
    ']',
    '',
  ].join('\n')
}

async function main(): Promise<void> {
  const root = process.cwd()
  const outDir = path.join(root, 'src/styles/fonts')
  mkdirSync(outDir, { recursive: true })
  const fonts = await buildFonts(path.join(root, 'node_modules'))
  let total = 0
  for (const font of fonts) {
    writeFileSync(path.join(outDir, font.file), font.data)
    total += font.data.length
    console.log(`fonts:copy: ${font.file} ${(font.data.length / 1000).toFixed(1)} KB`)
  }
  const mansalva = fonts.find((f) => f.file.startsWith('mansalva'))!
  writeFileSync(
    path.join(root, 'src/styles/mansalvaCoverage.generated.ts'),
    coverageModule(coverageRanges(mansalva.data)),
  )
  console.log(`fonts:copy: zusammen ${(total / 1000).toFixed(1)} KB (Budget 100 KB)`)
  if (fonts.length !== 3 || total > FONT_BUDGET_BYTES) {
    console.error('fonts:copy: Budget verletzt (genau 3 Dateien, ≤ 100 KB, AK-DS-04).')
    process.exit(1)
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) await main()
