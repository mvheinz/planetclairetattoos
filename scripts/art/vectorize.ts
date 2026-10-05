// `pnpm art:vectorize` (PLAN P8.14, DESIGN §12.4, ARCHITEKTUR §6.10): Stationszeichnungen der Startseite aus Juttas
// Bildern. Quellen und Parameter in `content/art/sources.json`:
//   - `vectorize`: sharp (Ausschnitt → Graustufe `luma` oder Minimum aus R/G/B `min` → normalise → Hochskalieren
//     (Lanczos3) → blur 0.5 → Schwellwert (Otsu oder fest) → Median 3) → `potrace` (nur devDependency, GPL – nie im
//     Client) → SVGO (floatPrecision 1) → Füllung `currentColor`. Ist das Bild im Instagram-Export gemappt (P8.10),
//     wird das Original genutzt (gleiche Prozent-Ausschnitte).
//   - `derived`: Planet-Marke (`src/art/planet.svg`), Coco `sitzen` aus dem Sprite (`src/art/coco/coco-sprite.svg`),
//     Schmuck als Linienzeichnung im Platzhalter-Stil (`content/art/stations/schmuck.ts`, nicht vektorisiert).
// Ausgabe `src/art/stations/{stationId}.svg` (je ≤ 8 KB; sonst optTolerance in 0,1-Schritten erhöhen) und
// `src/art/stations/stations.generated.ts` (dieselben SVGs als Text für die Station-Komponente, kein Loader nötig).
// Deterministisch: zwei Läufe → byte-gleiche Dateien.
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import sharp from 'sharp'
import { optimize } from 'svgo'

import { exportSource, readExportMap, EXPORT_MAP_FILE } from '../../src/lib/seed/exportMap'
import { handBlob, handStroke, type Ink, placePath, widthClass } from './lib/handline'

export const SOURCES_FILE = path.join('content', 'art', 'sources.json')
export const STATIONS_DIR = path.join('src', 'art', 'stations')
export const STATION_MAX_BYTES = 8000
export const VIEW_WIDTH = 400
const IG_DIR = path.join('content', 'seed', 'instagram')

export interface VectorizeSource {
  id: string
  file: string
  /** Ausschnitt in Prozent der Quelle. */
  crop: { x: number; y: number; w: number; h: number }
  channel: 'luma' | 'min'
  threshold: number | 'otsu'
  upscale: number
  turdSize: number
  alphaMax: number
  optTolerance: number
  /** Optional: Dichte-Schwelle 0–1 – dicht gekritzelte/schraffierte Flächen werden zu einer Fläche geschlossen. */
  dense?: number
}

export interface DerivedSource {
  id: string
  from: string
  /** `drawn`: frei mit der Handlinie neu gezeichnet nach dem Motiv der Vorlage `reference` (P9.12). */
  kind: 'planet-mark' | 'sprite' | 'placeholder-style' | 'drawn'
  reference?: string
}

/** Modul einer gezeichneten Station (`content/art/stations/{id}.ts`). */
interface DrawnStation {
  ink: Ink
  tilt: number
  /** viewBox der Zeichnung (Standard `0 0 400 500`; `drawn`: beliebiger Ausschnitt, Strichstärke per `stationStrokeWidth`). */
  viewBox?: string
}

export interface SourcesFile {
  vectorize: VectorizeSource[]
  derived: DerivedSource[]
}

export function readSources(root = process.cwd()): SourcesFile {
  return JSON.parse(readFileSync(path.join(root, SOURCES_FILE), 'utf8')) as SourcesFile
}

// ---------------------------------------------------------------------------------------------------------------
// Vorverarbeitung (sharp)

/** Otsu-Schwellwert aus einem 8-Bit-Graustufenpuffer. */
export function otsu(gray: Uint8Array): number {
  const hist = new Array<number>(256).fill(0)
  for (const v of gray) hist[v]!++
  const total = gray.length
  let sum = 0
  for (let i = 0; i < 256; i++) sum += i * hist[i]!
  let sumB = 0
  let wB = 0
  let best = 0
  let threshold = 128
  for (let t = 0; t < 256; t++) {
    wB += hist[t]!
    if (wB === 0) continue
    const wF = total - wB
    if (wF === 0) break
    sumB += t * hist[t]!
    const mB = sumB / wB
    const mF = (sum - sumB) / wF
    const between = wB * wF * (mB - mF) ** 2
    if (between > best) {
      best = between
      threshold = t
    }
  }
  return threshold
}

/** Schwarzweiß-PNG (Tusche schwarz) aus Quelle und Parametern. */
export async function preprocess(
  input: Buffer,
  src: Pick<VectorizeSource, 'crop' | 'channel' | 'threshold' | 'upscale' | 'dense'>,
): Promise<{ png: Buffer; width: number; height: number; threshold: number }> {
  const rotated = await sharp(input).rotate().toBuffer()
  const meta = await sharp(rotated).metadata()
  const W = meta.width!
  const H = meta.height!
  const left = Math.round((src.crop.x / 100) * W)
  const top = Math.round((src.crop.y / 100) * H)
  const width = Math.min(W - left, Math.round((src.crop.w / 100) * W))
  const height = Math.min(H - top, Math.round((src.crop.h / 100) * H))
  const cropped = sharp(rotated).extract({ left, top, width, height })
  let gray: Buffer
  if (src.channel === 'min') {
    const { data, info } = await cropped.removeAlpha().raw().toBuffer({ resolveWithObject: true })
    gray = Buffer.alloc(info.width * info.height)
    for (let i = 0; i < gray.length; i++) {
      gray[i] = Math.min(data[i * 3]!, data[i * 3 + 1]!, data[i * 3 + 2]!)
    }
  } else {
    gray = await cropped.removeAlpha().toColourspace('b-w').extractChannel(0).raw().toBuffer()
  }
  const outW = Math.round(width * src.upscale)
  const outH = Math.round(height * src.upscale)
  const smooth = await sharp(gray, { raw: { width, height, channels: 1 } })
    .normalise()
    .resize(outW, outH, { kernel: 'lanczos3' })
    .blur(0.5)
    .extractChannel(0)
    .raw()
    .toBuffer()
  const t = src.threshold === 'otsu' ? otsu(smooth) : src.threshold
  const bw = Buffer.alloc(smooth.length)
  for (let i = 0; i < smooth.length; i++) bw[i] = smooth[i]! < t ? 0 : 255
  if (src.dense !== undefined) {
    // Tintendichte in der Umgebung; über der Schwelle wird die Fläche geschlossen (Kritzel-Fell → Fläche)
    const ink = Buffer.alloc(bw.length)
    for (let i = 0; i < bw.length; i++) ink[i] = 255 - bw[i]!
    const density = await sharp(ink, { raw: { width: outW, height: outH, channels: 1 } })
      .blur(3 * src.upscale)
      .extractChannel(0)
      .raw()
      .toBuffer()
    const limit = src.dense * 255
    for (let i = 0; i < bw.length; i++) if (density[i]! > limit) bw[i] = 0
  }
  const png = await sharp(bw, { raw: { width: outW, height: outH, channels: 1 } })
    .median(3)
    .png()
    .toBuffer()
  return { png, width: outW, height: outH, threshold: t }
}

// ---------------------------------------------------------------------------------------------------------------
// potrace + SVGO

interface PotraceInstance {
  setParameters(p: Record<string, unknown>): void
  loadImage(input: Buffer, cb: (err: Error | null) => void): void
  getPathTag(): string
}

async function potraceInstance(): Promise<PotraceInstance> {
  // Dynamischer Import: potrace (GPL) bleibt ein reines Entwicklungswerkzeug.
  const mod = (await import('potrace')) as unknown as {
    Potrace?: new () => PotraceInstance
    default?: { Potrace: new () => PotraceInstance }
  }
  const Ctor = mod.Potrace ?? mod.default!.Potrace
  return new Ctor()
}

/** Umriss-Pfad (`d`) des Schwarzweißbilds. */
export async function trace(
  png: Buffer,
  params: Pick<VectorizeSource, 'turdSize' | 'alphaMax' | 'optTolerance'>,
): Promise<string> {
  const p = await potraceInstance()
  p.setParameters({
    threshold: 128,
    blackOnWhite: true,
    turdSize: params.turdSize,
    alphaMax: params.alphaMax,
    optCurve: true,
    optTolerance: params.optTolerance,
  })
  await new Promise<void>((resolve, reject) =>
    p.loadImage(png, (err) => (err ? reject(err) : resolve())),
  )
  const tag = p.getPathTag()
  return /\sd="([^"]*)"/.exec(tag)?.[1] ?? ''
}

/** SVG-Text optimieren (SVGO, floatPrecision 1, viewBox bleibt). */
export function compact(svg: string, floatPrecision = 1): string {
  return optimize(svg, {
    multipass: true,
    floatPrecision,
    plugins: [
      { name: 'preset-default' },
      { name: 'convertPathData', params: { floatPrecision } },
      'mergePaths',
    ],
  }).data
}

/** Gefülltes Umriss-SVG in `currentColor`, auf 400 Einheiten Breite skaliert. */
export function outlineSvg(
  d: string,
  width: number,
  height: number,
  view = VIEW_WIDTH,
  precision = 0,
): string {
  const s = view / width
  const h = Math.round(height * s)
  const scaled = placePath(d, { s })
  return compact(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${view} ${h}"><path fill="currentColor" fill-rule="evenodd" d="${scaled}"/></svg>`,
    precision,
  )
}

/**
 * Eine Quelle vektorisieren. Ganzzahlige Koordinaten (SVGO floatPrecision 0) auf einer 400 Einheiten breiten viewBox
 * (≈ 0,75 px Genauigkeit bei 300 px Darstellung; mit floatPrecision 1 lägen die Stationen bei 12–40 KB); passt das
 * nicht ins Budget, optTolerance in 0,1-Schritten erhöhen (DESIGN §12.4 Nr. 5).
 */
export async function vectorizeSource(input: Buffer, src: VectorizeSource): Promise<string> {
  const pre = await preprocess(input, src)
  let tol = src.optTolerance
  let last = ''
  for (;;) {
    const d = await trace(pre.png, { ...src, optTolerance: tol })
    for (const view of [VIEW_WIDTH]) {
      last = outlineSvg(d, pre.width, pre.height, view, 0)
      if (Buffer.byteLength(last) <= STATION_MAX_BYTES) return last
    }
    if (tol >= 2) return last
    tol = Math.round((tol + 0.1) * 10) / 10
  }
}

async function sourceBuffer(
  root: string,
  file: string,
): Promise<{ buf: Buffer; fromExport: boolean }> {
  const map = await readExportMap(path.join(root, EXPORT_MAP_FILE))
  const shortcode = file.replace(/^post-/, '').replace(/\.jpg$/, '')
  const original = await exportSource(root, map, shortcode)
  if (original) return { buf: original, fromExport: true }
  return { buf: readFileSync(path.join(root, IG_DIR, file)), fromExport: false }
}

// ---------------------------------------------------------------------------------------------------------------
// Abgeleitete Stationen

const LINE_ATTRS =
  'fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"'

/**
 * Einheitliche Strichstärke aller Stationen (P9.12, Prüf-Linse AR-07 „Strichstärken uneinheitlich“): Stationen stehen
 * in einem 4:5-Rahmen mit 208 × 260 px Zeichenfläche (Home.module.css `.artFrame`/`.art`, `meet`). Die Strichbreite in
 * viewBox-Einheiten wird so gewählt, dass sie dort {@link STATION_STROKE_PX} px ergibt – egal wie groß der Ausschnitt ist.
 */
export const STATION_STROKE_PX = 2
/** Stützpunkt-Abstand der Handlinie in Stationen (statt 14): spart Pfaddaten für das Startseiten-Budget (PF-10). */
const STATION_MAX_STEP = 28
export const STATION_BOX = { w: 208, h: 260 } as const

export function stationStrokeWidth(viewBox: string, px = STATION_STROKE_PX): number {
  const [, , vw, vh] = viewBox.split(' ').map(Number) as [number, number, number, number]
  const scale = Math.min(STATION_BOX.w / vw, STATION_BOX.h / vh)
  return Math.round((px / scale) * 100) / 100
}

/** Planet-Marke in `currentColor` (Körper in Papierfarbe). */
function planetMarkGroup(
  root: string,
  at: { x: number; y: number; s: number },
  strokeWidth = 2.6,
): string {
  const src = readFileSync(path.join(root, 'src/art/planet.svg'), 'utf8')
  const inner = /<svg[^>]*>([\s\S]*)<\/svg>/
    .exec(src)![1]!
    .replace(/fill="#F4EFE6"/g, 'style="fill:var(--paper,#F4EFE6)"')
    .replace(/#1C1A17/g, 'currentColor')
  return `<g transform="translate(${at.x} ${at.y}) scale(${at.s})" ${LINE_ATTRS} stroke-width="${Math.round(strokeWidth * 100) / 100}">${inner}</g>`
}

const COCO_VIEWBOX = '30 -6 96 120'
const COCO_SW = stationStrokeWidth(COCO_VIEWBOX)

/** Coco `sitzen` (Frame A) aus dem Sprite, Klassen in Attribute übersetzt (kein globales CSS im Seiten-HTML). */
function cocoSitzen(root: string): string {
  const sprite = readFileSync(path.join(root, 'src/art/coco/coco-sprite.svg'), 'utf8')
  const symbol = /<symbol id="coco-sitzen-a"[^>]*>([\s\S]*?)<\/symbol>/.exec(sprite)
  if (!symbol) throw new Error('coco-sitzen-a fehlt im Sprite')
  return (
    symbol[1]!
      .replace(/ data-part="[^"]*"/g, '')
      // Präsentationsattribute der Sprite-Ebenen (WebKit, P9.17) weichen den Kunst-Token mit Rückfall (E-73)
      .replace(/(<g class="[a-z]+")( (?:fill|stroke)="[^"]*")+/g, '$1')
      .replace(/class="fur"/g, 'style="fill:var(--coco-fur,#E2BF8E)"')
      .replace(
        /class="harness"/g,
        `style="fill:var(--coco-harness,#C23B2A)" stroke="currentColor" stroke-width="${COCO_SW}" stroke-linejoin="round"`,
      )
      .replace(/class="line"/g, `${LINE_ATTRS} stroke-width="${COCO_SW}"`)
      .replace(/class="solid"/g, 'fill="currentColor"')
      .replace(/class="hi"/g, 'style="fill:var(--paper,#F4EFE6)"')
  )
}

/** Linienzeichnung im Platzhalter-Stil (DESIGN §12.3), aber ohne Grund und Wash, Tusche über `currentColor`. */
export function lineStation(
  ink: Ink,
  seed: number,
  tilt = 0,
  opts: { viewBox?: string; strokeWidth?: number } = {},
): string {
  // Strichstärken-Gruppen (R1-03-01): dünn / normal / kräftig je (Teil-)Strich, nicht konstant
  const groups: [string[], string[], string[]] = [[], [], []]
  let n = 0
  ink.strokes.forEach((s, i) => {
    for (const piece of handStroke(s, seed + i * 104729, {
      maxStep: STATION_MAX_STEP,
      press: true,
      coarseFrom: 12,
      pressRate: 0.3,
    }))
      groups[widthClass(seed, n++)].push(piece)
  })
  const sw = opts.strokeWidth ?? 3.2
  const [thin, normal, thick] = groups.map((g) => g.join('')) as [string, string, string]
  const dots = (ink.dots ?? []).map((d, i) => handBlob(d, seed + 11 + i * 31, 0.45)).join('')
  const lights = (ink.lights ?? []).map((d, i) => handBlob(d, seed + 23 + i * 31, 0.45)).join('')
  const vb = opts.viewBox ?? '0 0 400 500'
  const [, , vw, vh] = vb.split(' ').map(Number) as [number, number, number, number]
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}"><g transform="rotate(${tilt} ${vw / 2} ${vh / 2})">`,
    `<path ${LINE_ATTRS} stroke-width="${sw}" d="${normal}"/>`,
    thin
      ? `<path ${LINE_ATTRS} stroke-width="${Math.round(sw * 0.82 * 10) / 10}" d="${thin}"/>`
      : '',
    thick
      ? `<path ${LINE_ATTRS} stroke-width="${Math.round(sw * 1.22 * 10) / 10}" d="${thick}"/>`
      : '',
    dots ? `<path fill="currentColor" d="${dots}"/>` : '',
    lights ? `<path style="fill:var(--paper,#F4EFE6)" d="${lights}"/>` : '',
    '</g></svg>',
  ].join('')
}

/** Fester Seed je Station (FNV-1a über die ID) – gleiche Zeichnung bei jedem Lauf. */
function fnvSeed(id: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 0x01000193)
  return (h >>> 0) % 100000
}

async function derivedStation(root: string, src: DerivedSource): Promise<string> {
  switch (src.kind === 'drawn' ? 'drawn' : src.id) {
    case 'planet-claire':
      return compact(
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 500">${planetMarkGroup(root, { x: 40, y: 90, s: 5 }, 0.8)}</svg>`,
      )
    case 'hallo':
      return compact(
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${COCO_VIEWBOX}">${cocoSitzen(root)}</svg>`,
      )
    case 'jutta-und-coco':
      return compact(
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${COCO_VIEWBOX}">${cocoSitzen(root)}${planetMarkGroup(root, { x: 31, y: -4, s: 0.42 }, COCO_SW / 0.42)}</svg>`,
      )
    default: {
      if (src.kind !== 'placeholder-style' && src.kind !== 'drawn')
        throw new Error(`Unbekannte abgeleitete Station „${src.id}“`)
      // Linienzeichnung aus Kontrollpunkten (Schmuck: Platzhalter-Stil; drawn: frei nach dem Motiv der Vorlage)
      const mod = (await import(pathToFileURL(path.join(root, src.from)).href)) as {
        default: DrawnStation
      }
      const d = mod.default
      const seed = src.id === 'schmuck' ? 0x5c4d : fnvSeed(src.id)
      return compact(
        lineStation(d.ink, seed, d.tilt, {
          viewBox: d.viewBox,
          strokeWidth: stationStrokeWidth(d.viewBox ?? '0 0 400 500'),
        }),
      )
    }
  }
}

// ---------------------------------------------------------------------------------------------------------------

/** Alle Stationszeichnungen als SVG-Text (ohne zu schreiben). */
export async function buildStations(
  root = process.cwd(),
): Promise<{ svgs: Map<string, string>; notes: string[] }> {
  const sources = readSources(root)
  const svgs = new Map<string, string>()
  const notes: string[] = []
  for (const src of sources.vectorize) {
    const { buf, fromExport } = await sourceBuffer(root, src.file)
    svgs.set(src.id, await vectorizeSource(buf, src))
    notes.push(`${src.id}: ${src.file}${fromExport ? ' (Export-Original)' : ' (640 px)'}`)
  }
  for (const src of sources.derived) {
    svgs.set(src.id, await derivedStation(root, src))
    notes.push(`${src.id}: ${src.kind}`)
  }
  return { svgs: new Map([...svgs].sort(([a], [b]) => a.localeCompare(b))), notes }
}

export function generatedModule(svgs: Map<string, string>): string {
  const lines = [
    '// Erzeugt von `pnpm art:vectorize` (scripts/art/vectorize.ts) – nicht von Hand ändern.',
    '// Stationszeichnungen (DESIGN §12.4) als SVG-Text; Quellen: content/art/sources.json.',
    'export const STATION_SVGS: Readonly<Record<string, string>> = {',
    ...[...svgs].map(([id, svg]) => `  ${JSON.stringify(id)}: ${JSON.stringify(svg)},`),
    '}',
    '',
  ]
  return lines.join('\n')
}

async function main() {
  const { svgs, notes } = await buildStations()
  const lines: string[] = []
  let errors = 0
  for (const [id, svg] of svgs) {
    writeFileSync(path.join(STATIONS_DIR, `${id}.svg`), svg)
    const bytes = Buffer.byteLength(svg)
    if (bytes > STATION_MAX_BYTES) errors++
    lines.push(
      `${id.padEnd(16)} ${String(bytes).padStart(5)} B${bytes > STATION_MAX_BYTES ? '  ÜBER BUDGET' : ''}`,
    )
  }
  writeFileSync(path.join(STATIONS_DIR, 'stations.generated.ts'), generatedModule(svgs))
  process.stdout.write(`${[...lines, ...notes].join('\n')}\n`)
  if (errors) process.exitCode = 1
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((err: unknown) => {
    process.stderr.write(`${err instanceof Error ? err.stack : String(err)}\n`)
    process.exitCode = 1
  })
}
