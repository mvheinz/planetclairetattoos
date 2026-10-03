import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import sharp from 'sharp'

import { CALIBRATION_SHEET, SHEET_MAX_BYTES } from './lib/bundle'
import { ART_ROOT, existingRuns } from './lib/run'

// `pnpm art:sheets [<lauf-id>]` (KUNST-QA §4.5; PLAN P9.5): Kontaktbögen für die Prüf-Linsen – sharp setzt die Frames
// eines Laufs in ein Raster (≤ 2400 px breit, 6 Spalten, Beschriftung Szenario/Profil/`t`/`y` unter jedem Frame), je
// Szenario × Profil × Variante (bei Überlänge in Seiten `-pNN`), Coco-Bögen je Pose (Frames A/B/C nebeneinander plus
// `?parts=1`-Fassung), Stationszeichnungen neben ihrer Quelle (SC-13) und der Kalibrierbogen aus P9.2. Ablage
// `sheets/art|motion|a11y/*.webp`, je ≤ 1,5 MB (WebP q 85, bei Überschreitung niedriger bzw. weniger Zeilen).

export const SHEET_WIDTH = 2400
export const SHEET_COLS = 6
const GAP = 8
const LABEL_H = 24
const TITLE_H = 36
const CALIBRATION_SOURCE = path.join('docs', 'design', 'qa-log', 'img', 'calibration-p2-placeholder.webp')

export interface SheetFrame {
  file: string
  label: string
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** Kategorie eines Bogens (KUNST-QA §4.5): Kunst-Standbilder, Barrierefreiheit (reduziert, erzwungene Farben), Bewegung. */
export function sheetCategory(sc: string, variant: string): 'art' | 'motion' | 'a11y' {
  if (['SC-12', 'SC-13', 'SC-16'].includes(sc)) return 'art'
  if (variant === 'reduced' || sc === 'SC-17' || sc === 'SC-02') return 'a11y'
  return 'motion'
}

/** Beschriftung unter dem Frame: Szenario, Profil, `t`/`y` (aus dem Dateinamen). */
export function frameCaption(sc: string, profile: string, variant: string, file: string): string {
  const label = path.basename(file, '.webp').replace(/^\d{3}-/, '')
  return `${sc} · ${profile.replace(/^art-/, '')}${variant === 'reduced' ? ' · reduced' : ''} · ${label}`
}

/** Ein Bogen aus Frames (Zeilen zu `cols`), Rückgabe WebP; `quality` wie §4.4 (Bögen q 85). */
export async function renderSheet(
  frames: readonly SheetFrame[],
  title: string,
  opts: { cols?: number; quality?: number; maxCellH?: number } = {},
): Promise<Buffer> {
  const cols = opts.cols ?? SHEET_COLS
  const cellW = Math.floor((SHEET_WIDTH - (cols + 1) * GAP) / cols)
  const maxCellH = opts.maxCellH ?? Math.round(cellW * 2.2)
  const cells: { buf: Buffer; w: number; h: number; label: string }[] = []
  for (const f of frames) {
    const img = sharp(f.file).resize({ width: cellW, height: maxCellH, fit: 'inside', withoutEnlargement: false })
    const { data, info } = await img.png().toBuffer({ resolveWithObject: true })
    cells.push({ buf: data, w: info.width, h: info.height, label: f.label })
  }
  const rows: (typeof cells)[] = []
  for (let i = 0; i < cells.length; i += cols) rows.push(cells.slice(i, i + cols))
  const rowH = rows.map((r) => Math.max(...r.map((c) => c.h)) + LABEL_H + GAP)
  const height = TITLE_H + rowH.reduce((a, b) => a + b, 0) + GAP
  const composites: sharp.OverlayOptions[] = []
  const texts: string[] = [
    `<text x="${GAP}" y="24" font-family="sans-serif" font-size="20" font-weight="bold" fill="#1C1A17">${esc(title)}</text>`,
  ]
  let y = TITLE_H
  rows.forEach((row, ri) => {
    row.forEach((c, ci) => {
      const x = GAP + ci * (cellW + GAP)
      composites.push({ input: c.buf, left: x, top: y })
      texts.push(
        `<text x="${x}" y="${y + c.h + 17}" font-family="sans-serif" font-size="13" fill="#1C1A17">${esc(c.label.slice(0, 58))}</text>`,
      )
    })
    y += rowH[ri]!
  })
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${SHEET_WIDTH}" height="${height}">${texts.join('')}</svg>`
  composites.push({ input: Buffer.from(svg), left: 0, top: 0 })
  return sharp({ create: { width: SHEET_WIDTH, height, channels: 3, background: '#FFFFFF' } })
    .composite(composites)
    .webp({ quality: opts.quality ?? 85 })
    .toBuffer()
}

/**
 * Bogen(-Seiten) unter dem Größenbudget: zuerst `rowsPerPage` Zeilen in q 85, dann q 70/55, dann halb so viele Zeilen.
 * Gibt die geschriebenen Pfade zurück.
 */
export async function writeSheets(
  outBase: string,
  frames: readonly SheetFrame[],
  title: string,
  opts: { cols?: number; rowsPerPage?: number } = {},
): Promise<string[]> {
  const cols = opts.cols ?? SHEET_COLS
  let rows = opts.rowsPerPage ?? 6
  for (;;) {
    const per = rows * cols
    const pages: SheetFrame[][] = []
    for (let i = 0; i < frames.length; i += per) pages.push(frames.slice(i, i + per))
    const bufs: Buffer[] = []
    let fits = true
    for (const [i, page] of pages.entries()) {
      let buf: Buffer | null = null
      for (const q of [85, 70, 55]) {
        buf = await renderSheet(page, pages.length > 1 ? `${title} (${i + 1}/${pages.length})` : title, { cols, quality: q })
        if (buf.length <= SHEET_MAX_BYTES) break
      }
      if (buf!.length > SHEET_MAX_BYTES) {
        fits = false
        break
      }
      bufs.push(buf!)
    }
    if (fits || rows === 1) {
      mkdirSync(path.dirname(outBase), { recursive: true })
      return bufs.map((b, i) => {
        const file = bufs.length > 1 ? `${outBase}-p${String(i + 1).padStart(2, '0')}.webp` : `${outBase}.webp`
        writeFileSync(file, b)
        return file
      })
    }
    rows = Math.max(1, Math.floor(rows / 2))
  }
}

const webps = (dir: string) => (existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.webp')).sort() : [])
const dirs = (dir: string) => (existsSync(dir) ? readdirSync(dir).filter((f) => !f.includes('.')).sort() : [])

/** Coco-Bögen (SC-12): je Pose die Frames A/B/C nebeneinander und darunter die `?parts=1`-Fassung. */
export function cocoGroups(files: readonly string[]): Map<string, { a?: string; b?: string; c?: string; parts?: string }> {
  const out = new Map<string, { a?: string; b?: string; c?: string; parts?: string }>()
  for (const f of files) {
    const label = f.replace(/^\d{3}-/, '').replace(/-y\d+\.webp$/, '').replace(/\.webp$/, '')
    const m = /^(.+)-(a|b|c|parts)$/.exec(label)
    if (!m) continue
    const g = out.get(m[1]!) ?? {}
    g[m[2] as 'a' | 'b' | 'c' | 'parts'] = f
    out.set(m[1]!, g)
  }
  return out
}

async function main(): Promise<void> {
  const runId = process.argv.slice(2).find((a) => !a.startsWith('--')) ?? existingRuns().sort().at(-1)
  const runDir = runId ? path.join(ART_ROOT, runId) : null
  if (!runDir || !existsSync(runDir)) {
    console.error(`art:sheets: Lauf ${runId ?? '(keiner)'} nicht gefunden.`)
    process.exit(2)
  }
  const sheetsDir = path.join(runDir, 'sheets')
  rmSync(sheetsDir, { recursive: true, force: true })
  const written: string[] = []
  const framesDir = path.join(runDir, 'frames')
  for (const sc of dirs(framesDir))
    for (const profile of dirs(path.join(framesDir, sc)))
      for (const variant of dirs(path.join(framesDir, sc, profile))) {
        const dir = path.join(framesDir, sc, profile, variant)
        const frames = webps(dir).map((f) => ({ file: path.join(dir, f), label: frameCaption(sc, profile, variant, f) }))
        if (!frames.length) continue
        const cat = sheetCategory(sc, variant)
        written.push(
          ...(await writeSheets(path.join(sheetsDir, cat, `${sc}-${profile}-${variant}`), frames, `${runId} · ${sc} · ${profile} · ${variant}`)),
        )
      }

  // Coco je Pose (SC-12, Desktop): A | B | C, darunter Teile-Fassung.
  const coco = path.join(framesDir, 'SC-12', 'art-desktop', 'motion')
  for (const [pose, g] of cocoGroups(webps(coco))) {
    const frames = (['a', 'b', 'c', 'parts'] as const)
      .filter((k) => g[k])
      .map((k) => ({ file: path.join(coco, g[k]!), label: `SC-12 · desktop · ${pose} ${k === 'parts' ? '?parts=1' : `Frame ${k.toUpperCase()}`}` }))
    written.push(...(await writeSheets(path.join(sheetsDir, 'art', `coco-${pose}`), frames, `${runId} · Coco ${pose}`, { cols: 3 })))
  }

  // Stationszeichnungen neben der Quelle (SC-13 `/qa/art` zeigt beide im gleichen Maßstab).
  const qaArt = path.join(framesDir, 'SC-13', 'art-desktop', 'motion')
  const stations = webps(qaArt).filter((f) => /stations-/.test(f))
  if (stations.length)
    written.push(
      ...(await writeSheets(
        path.join(sheetsDir, 'art', 'stations-vs-source'),
        stations.map((f) => ({ file: path.join(qaArt, f), label: `SC-13 · desktop · ${f.replace(/\.webp$/, '')}` })),
        `${runId} · Stationszeichnungen neben der Quelle`,
        { cols: 2, rowsPerPage: 1 },
      )),
    )

  // Kalibrierbogen aus P9.2 (KUNST-QA §3.1) liegt in jedem Bündel.
  if (existsSync(CALIBRATION_SOURCE)) {
    const dst = path.join(runDir, CALIBRATION_SHEET)
    mkdirSync(path.dirname(dst), { recursive: true })
    copyFileSync(CALIBRATION_SOURCE, dst)
    written.push(dst)
  } else console.error(`art:sheets: Kalibrierbogen ${CALIBRATION_SOURCE} fehlt.`)

  console.log(`art:sheets: ${written.length} Bögen → ${sheetsDir}`)
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href)
  main().catch((e) => {
    console.error(e)
    process.exit(2)
  })
