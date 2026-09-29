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
//
// P3.14 (DESIGN §12.6, ARCHITEKTUR §1.2): TTF-Dateien für die OG-Bilder nach `src/og/fonts/` – satori liest weder WOFF2
// noch variable Schriften. Mansalva 400 und Bricolage Grotesque **statisch** 600 (`@fontsource/bricolage-grotesque`)
// werden offline mit `wawoff2` (WOFF2 → TTF) umgewandelt, ohne Download. Das Skript prüft die Glyphen (Umlaute, ß, €,
// „“) und schreibt Zeichenabdeckung und Laufweiten nach `src/og/fontMetrics.generated.ts` (Zeilenumbruch und
// Zeichenfilter der OG-Bilder ohne Schriftbibliothek zur Laufzeit). Die TTF-Dateien gehen nie an den Browser.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import * as fontkit from 'fontkit'
import subsetFont from 'subset-font'
import { decompress } from 'wawoff2'

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

// --- OG-Schriften (P3.14) -------------------------------------------------------------------------------------------

/** Zielordner der OG-Schriften (nur `.ttf`). */
export const OG_FONT_DIR = 'src/og/fonts'
/** Erzeugtes Modul mit Abdeckung und Laufweiten. */
export const OG_METRICS_MODULE = 'src/og/fontMetrics.generated.ts'
/** Pflicht-Glyphen der OG-Schriften (Umlaute, ß, €, deutsche Anführungszeichen, P3.14). */
export const OG_REQUIRED_GLYPHS = 'äöüÄÖÜß€„“'

export interface OgFontJob {
  /** Schlüssel im erzeugten Modul. */
  key: 'mansalva400' | 'bricolage600'
  /** Dateiname unter `src/og/fonts/`. */
  file: string
  /** WOFF2-Quelle relativ zu `node_modules` (statischer Schnitt). */
  source: string
}

export const OG_FONT_JOBS: readonly OgFontJob[] = [
  {
    key: 'mansalva400',
    file: 'mansalva-400.ttf',
    source: '@fontsource/mansalva/files/mansalva-latin-400-normal.woff2',
  },
  {
    key: 'bricolage600',
    file: 'bricolage-grotesque-600.ttf',
    source: '@fontsource/bricolage-grotesque/files/bricolage-grotesque-latin-600-normal.woff2',
  },
]

export interface BuiltOgFont extends BuiltFont {
  key: OgFontJob['key']
}

/** WOFF2 → TTF (offline, deterministisch); wirft bei variabler Schrift oder fehlenden Pflicht-Glyphen. */
export async function buildOgFonts(nodeModules: string): Promise<BuiltOgFont[]> {
  const out: BuiltOgFont[] = []
  for (const job of OG_FONT_JOBS) {
    // `decompress` gibt eine Sicht auf den WASM-Speicher zurück – sofort kopieren.
    const data = Buffer.from(await decompress(readFileSync(path.join(nodeModules, job.source))))
    const font = fontkit.create(data) as fontkit.Font
    const tables = (font as unknown as { directory: { tables: Record<string, unknown> } }).directory
      .tables
    if ('fvar' in tables)
      throw new Error(`${job.file}: variable Schrift (fvar) – satori braucht statische Schnitte.`)
    const missing = [...OG_REQUIRED_GLYPHS].filter(
      (c) => !font.hasGlyphForCodePoint(c.codePointAt(0)!),
    )
    if (missing.length > 0) throw new Error(`${job.file}: Glyphen fehlen: ${missing.join(' ')}`)
    out.push({ key: job.key, file: job.file, data })
  }
  return out
}

/** Laufweiten je Code Point (Einheiten pro em) einer Schrift. */
export function advanceTable(font: Buffer): { unitsPerEm: number; advances: [number, number][] } {
  const parsed = fontkit.create(font) as fontkit.Font
  const points = [...new Set(parsed.characterSet)].sort((a, b) => a - b)
  return {
    unitsPerEm: parsed.unitsPerEm,
    advances: points.map((cp) => [cp, parsed.glyphForCodePoint(cp).advanceWidth]),
  }
}

export function ogMetricsModule(fonts: readonly BuiltOgFont[]): string {
  const entries = fonts.map((f) => {
    const { unitsPerEm, advances } = advanceTable(f.data)
    const rows = advances.map(([cp, w]) => `[${cp}, ${w}]`).join(', ')
    return `  ${f.key}: {\n    file: '${f.file}',\n    unitsPerEm: ${unitsPerEm},\n    advances: [${rows}],\n  },`
  })
  return [
    '// Erzeugt von `pnpm fonts:copy` (scripts/fonts/copy.ts) – nicht von Hand ändern.',
    '// Abdeckung und Laufweiten (Code Point, Einheiten pro em) der OG-Schriften in src/og/fonts/ (P3.14, DESIGN §12.6).',
    '/* prettier-ignore */',
    'export const OG_FONT_METRICS = {',
    ...entries,
    '} as const',
    '',
  ].join('\n')
}

// --- PDF-Schriften (P4.11) ------------------------------------------------------------------------------------------

/** Zielordner der PDF-Schriften (`@react-pdf/renderer`, nur `.ttf`, nie im Browser). */
export const PDF_FONT_DIR = 'src/lib/pdf/fonts'

export interface PdfFontJob {
  file: string
  source: string
}

/** Statische Schnitte (react-pdf liest keine variablen Schriften): Text 400/700, Ziffern/Nummern Mono 400. */
export const PDF_FONT_JOBS: readonly PdfFontJob[] = [
  {
    file: 'bricolage-grotesque-400.ttf',
    source: '@fontsource/bricolage-grotesque/files/bricolage-grotesque-latin-400-normal.woff2',
  },
  {
    file: 'bricolage-grotesque-700.ttf',
    source: '@fontsource/bricolage-grotesque/files/bricolage-grotesque-latin-700-normal.woff2',
  },
  {
    file: 'ibm-plex-mono-400.ttf',
    source: '@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-400-normal.woff2',
  },
]

/** WOFF2 → TTF für die Beleg- und Rechtstext-PDFs (offline); wirft bei fehlenden Pflicht-Glyphen. */
export async function buildPdfFonts(nodeModules: string): Promise<BuiltFont[]> {
  const out: BuiltFont[] = []
  for (const job of PDF_FONT_JOBS) {
    const data = Buffer.from(await decompress(readFileSync(path.join(nodeModules, job.source))))
    const font = fontkit.create(data) as fontkit.Font
    const missing = [...`${OG_REQUIRED_GLYPHS}§`].filter(
      (c) => !font.hasGlyphForCodePoint(c.codePointAt(0)!),
    )
    if (missing.length > 0) throw new Error(`${job.file}: Glyphen fehlen: ${missing.join(' ')}`)
    out.push({ file: job.file, data })
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

  const ogDir = path.join(root, OG_FONT_DIR)
  mkdirSync(ogDir, { recursive: true })
  const ogFonts = await buildOgFonts(path.join(root, 'node_modules'))
  for (const font of ogFonts) {
    writeFileSync(path.join(ogDir, font.file), font.data)
    console.log(
      `fonts:copy: ${OG_FONT_DIR}/${font.file} ${(font.data.length / 1000).toFixed(1)} KB (OG, TTF)`,
    )
  }
  writeFileSync(path.join(root, OG_METRICS_MODULE), ogMetricsModule(ogFonts))

  const pdfDir = path.join(root, PDF_FONT_DIR)
  mkdirSync(pdfDir, { recursive: true })
  for (const font of await buildPdfFonts(path.join(root, 'node_modules'))) {
    writeFileSync(path.join(pdfDir, font.file), font.data)
    console.log(
      `fonts:copy: ${PDF_FONT_DIR}/${font.file} ${(font.data.length / 1000).toFixed(1)} KB (PDF, TTF)`,
    )
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) await main()
