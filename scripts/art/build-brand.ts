// `pnpm art:brand` (PLAN P2.5, DESIGN §12.6): erzeugt aus den Quellen unter `src/art/` die ausgelieferten Marken –
// offline und ohne Fremd-Requests:
// - `src/art/wordmark.svg` (Quelle, nur wenn sie fehlt oder mit `--regen-wordmark`): „planet claire“ aus den
//   Mansalva-Umrissen (OFL erlaubt die Umwandlung für ein Logo), Grundlinie wackelt ±1 Einheit, i-Punkt = Planet;
// - `public/art/wordmark.svg` (≤ 5 KB), `src/app/icon.svg`, `src/app/favicon.ico` (16/32), `src/app/apple-icon.png`
//   (180 px, Papiergrund, Planet 70 %), `public/og/default.png` (1200×630, `sharp`).
// Marken sind vorläufig vektorisiert; P9 verfeinert die Quellen von Hand (E-76) und ruft das Skript erneut auf.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import * as fontkit from 'fontkit'
import sharp from 'sharp'
import subsetFont from 'subset-font'

export const INK = '#1C1A17'
export const PAPER = '#F4EFE6'
const GRID = 'rgb(47,107,76)'

const ROOT = process.cwd()
const p = (...parts: string[]) => path.join(ROOT, ...parts)

// ---------------------------------------------------------------------------------------------------------------
// Pfad-Serialisierung (relativ, gerundet, kompakt)

interface PathCommand {
  command: string
  args: number[]
}
type Transform = (x: number, y: number) => [number, number]

const LETTER: Record<string, string> = {
  moveTo: 'm',
  lineTo: 'l',
  quadraticCurveTo: 'q',
  bezierCurveTo: 'c',
}

function fmt(n: number, digits: number): string {
  const f = 10 ** digits
  const r = Math.round(n * f) / f
  return Object.is(r, -0) ? '0' : String(r)
}

function joinNumbers(nums: string[]): string {
  let out = ''
  for (const n of nums) out += out === '' || n.startsWith('-') ? n : ` ${n}`
  return out
}

/**
 * Schreibt Pfadbefehle (absolute Koordinaten) als relative, gerundete SVG-Pfaddaten. Der Stift-Zustand gilt über
 * mehrere `add`-Aufrufe (z. B. Glyphen einer Zeile); der erste Befehl wird absolut (`M`).
 */
export class PathWriter {
  private cx = 0
  private cy = 0
  private sx = 0
  private sy = 0
  private last = ''
  private out = ''
  constructor(private readonly digits = 1) {}

  add(commands: PathCommand[], tf: Transform): this {
    const f = 10 ** this.digits
    const round = (v: number) => Math.round(v * f) / f
    for (const { command, args } of commands) {
      if (command === 'closePath') {
        this.out += 'z'
        this.last = 'z'
        this.cx = this.sx
        this.cy = this.sy
        continue
      }
      const letter = LETTER[command]
      if (!letter) throw new Error(`Unbekannter Pfadbefehl ${command}`)
      const nums: string[] = []
      let px = this.cx
      let py = this.cy
      for (let i = 0; i < args.length; i += 2) {
        const [x, y] = tf(args[i]!, args[i + 1]!)
        const rx = round(x)
        const ry = round(y)
        nums.push(fmt(rx - this.cx, this.digits), fmt(ry - this.cy, this.digits))
        px = rx
        py = ry
      }
      const first = this.out === ''
      const repeat = letter === this.last && letter !== 'm'
      const head = first ? 'M' : repeat ? (nums[0]!.startsWith('-') ? '' : ' ') : letter
      this.out += head + joinNumbers(nums)
      this.last = letter
      this.cx = px
      this.cy = py
      if (letter === 'm') {
        this.sx = px
        this.sy = py
      }
    }
    return this
  }

  toString(): string {
    return this.out
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Quellen

/** Wurzelattribute und Inhalt einer SVG-Quelldatei (ohne `xmlns`/`viewBox`). */
export function splitSvg(svg: string): { attrs: string; inner: string; viewBox: string } {
  const m = /<svg\b([^>]*)>([\s\S]*)<\/svg>/.exec(svg)
  if (!m) throw new Error('Keine SVG-Datei')
  const rawAttrs = m[1]!
  const viewBox = /viewBox="([^"]+)"/.exec(rawAttrs)?.[1] ?? '0 0 64 64'
  const attrs = rawAttrs
    .replace(/\s*xmlns="[^"]*"/, '')
    .replace(/\s*viewBox="[^"]*"/, '')
    .replace(/\s*role="[^"]*"/, '')
    .replace(/\s*aria-label="[^"]*"/, '')
    .trim()
  return { attrs, inner: m[2]!.trim(), viewBox }
}

const withAttr = (attrs: string, name: string, value: string) =>
  new RegExp(`\\b${name}="[^"]*"`).test(attrs)
    ? attrs.replace(new RegExp(`\\b${name}="[^"]*"`), `${name}="${value}"`)
    : `${attrs} ${name}="${value}"`

/** Planet-Marke als Gruppe: Mittelpunkt (cx, cy), Breite des 64er-Quadrats `size`. */
export function planetGroup(
  planetSvg: string,
  cx: number,
  cy: number,
  size: number,
  strokeWidth?: number,
): string {
  const { attrs, inner } = splitSvg(planetSvg)
  const k = size / 64
  let a = attrs
  if (strokeWidth !== undefined) a = withAttr(a, 'stroke-width', String(strokeWidth))
  const tx = fmt(cx - 32 * k, 2)
  const ty = fmt(cy - 32 * k, 2)
  return `<g transform="translate(${tx} ${ty}) scale(${fmt(k, 4)})" ${a}>${inner}</g>`
}

// ---------------------------------------------------------------------------------------------------------------
// Wortmarke

export const WORDMARK_TEXT = 'planet claıre' // dotless ı: der i-Punkt ist der Planet
/** Grundlinien-Versatz (±1 Einheit) und Neigung (Grad) je Zeichen – fest, damit das Ergebnis reproduzierbar ist. */
const WOBBLE_Y = [0.4, -0.6, 0.9, -0.3, 0.7, -1, 0, 0.6, -0.8, 0.3, 1, -0.5, 0.2]
const WOBBLE_DEG = [-1.2, 0.8, -0.4, 1.5, -0.9, 0.6, 0, -1.4, 0.9, -0.6, 1.1, -1, 0.5]
/** Geviert der Wortmarke in SVG-Einheiten (ganzzahlig gerundet); die Wackel-Einheit bleibt 1/40 Geviert. */
const WORDMARK_EM = 80
const WOBBLE_UNIT = WORDMARK_EM / 40

export function buildWordmark(mansalva: fontkit.Font, planetSvg: string): string {
  const s = WORDMARK_EM / mansalva.unitsPerEm
  const run = mansalva.layout(WORDMARK_TEXT)
  const baseline = 0
  let pen = 0
  const d = new PathWriter(0)
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  let dot: { x: number; y: number } | undefined
  run.glyphs.forEach((glyph, i) => {
    const pos = run.positions[i]!
    const ox = pen + pos.xOffset
    const bbox = glyph.bbox
    const centerX = (ox + (bbox.minX + bbox.maxX) / 2) * s
    const dy = WOBBLE_Y[i % WOBBLE_Y.length]! * WOBBLE_UNIT
    const rad = ((WOBBLE_DEG[i % WOBBLE_DEG.length] ?? 0) * Math.PI) / 180
    const tf: Transform = (gx, gy) => {
      const x = (ox + gx) * s
      const y = baseline - (gy + pos.yOffset) * s + dy
      const rx = centerX + (x - centerX) * Math.cos(rad) - (y - baseline) * Math.sin(rad)
      const ry = baseline + (x - centerX) * Math.sin(rad) + (y - baseline) * Math.cos(rad)
      minX = Math.min(minX, rx)
      maxX = Math.max(maxX, rx)
      minY = Math.min(minY, ry)
      maxY = Math.max(maxY, ry)
      return [rx, ry]
    }
    const cmds = glyph.path.commands as PathCommand[]
    if (cmds.length > 0) d.add(cmds, tf)
    if (glyph.codePoints.includes(0x131)) {
      dot = { x: centerX, y: baseline - bbox.maxY * s + dy - 0.21 * WORDMARK_EM }
    }
    pen += pos.xAdvance
  })
  if (!dot) throw new Error('Kein ı in der Wortmarke')
  const planetSize = 0.5 * WORDMARK_EM
  minY = Math.min(minY, dot.y - planetSize / 2)
  const pad = 1
  const vx = Math.floor(minX - pad)
  const vy = Math.floor(minY - pad)
  const vw = Math.ceil(maxX + pad) - vx
  const vh = Math.ceil(maxY + pad) - vy
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vx} ${vy} ${vw} ${vh}">` +
    `<path fill="${INK}" d="${d.toString()}"/>` +
    planetGroup(planetSvg, dot.x, dot.y, planetSize, 6) +
    '</svg>\n'
  )
}

// ---------------------------------------------------------------------------------------------------------------
// Favicon, App-Icon, OG

export function buildIconSvg(planetSvg: string): string {
  return (
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">' +
    `<circle cx="32" cy="32" r="31.5" fill="${PAPER}"/>` +
    planetGroup(planetSvg, 32, 32, 60, 3.6) +
    '</svg>\n'
  )
}

function appleIconSvg(planetSvg: string): string {
  return (
    '<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180" viewBox="0 0 180 180">' +
    `<rect width="180" height="180" fill="${PAPER}"/>` +
    planetGroup(planetSvg, 90, 90, 126, 3) +
    '</svg>'
  )
}

/** ICO-Container mit PNG-Einträgen (Windows Vista+ und alle aktuellen Browser). */
export function buildIco(images: { size: number; png: Buffer }[]): Buffer {
  const header = Buffer.alloc(6 + 16 * images.length)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(images.length, 4)
  let offset = header.length
  images.forEach(({ size, png }, i) => {
    const e = 6 + 16 * i
    header.writeUInt8(size >= 256 ? 0 : size, e)
    header.writeUInt8(size >= 256 ? 0 : size, e + 1)
    header.writeUInt8(0, e + 2)
    header.writeUInt8(0, e + 3)
    header.writeUInt16LE(1, e + 4)
    header.writeUInt16LE(32, e + 6)
    header.writeUInt32LE(png.length, e + 8)
    header.writeUInt32LE(offset, e + 12)
    offset += png.length
  })
  return Buffer.concat([header, ...images.map((i) => i.png)])
}

/** Text als Umrisse (für OG-Bilder ohne Schriftdateien im Renderer). */
function textPath(font: fontkit.Font, text: string, x: number, y: number, size: number): string {
  const s = size / font.unitsPerEm
  const run = font.layout(text)
  let pen = 0
  const d = new PathWriter(1)
  run.glyphs.forEach((glyph, i) => {
    const pos = run.positions[i]!
    const ox = pen + pos.xOffset
    const cmds = glyph.path.commands as PathCommand[]
    if (cmds.length > 0) d.add(cmds, (gx, gy) => [x + (ox + gx) * s, y - (gy + pos.yOffset) * s])
    pen += pos.xAdvance
  })
  return d.toString()
}

export const OG_TAGLINE = 'Tattoos & Unikate aus Berlin'

/** Coco `rennen` (Frame A) aus dem Sprite, gespiegelt, D-Ring (Anker) auf (x, y); Klassen in Attribute übersetzt. */
function cocoRennen(x: number, y: number, s: number): string {
  const sprite = readFileSync(p('src/art/coco/coco-sprite.svg'), 'utf8')
  const symbol = /<symbol id="coco-rennen-a"[^>]*>([\s\S]*?)<\/symbol>/.exec(sprite)
  if (!symbol) throw new Error('coco-rennen-a fehlt im Sprite')
  const anchors = JSON.parse(readFileSync(p('src/art/coco/coco-anchors.json'), 'utf8')) as {
    anchors: Record<string, [number, number]>
  }
  const [ax, ay] = anchors.anchors.rennen ?? [80, 60]
  const inner = symbol[1]!
    .replace(/ data-part="[^"]*"/g, '')
    .replace(/class="fur"/g, 'fill="#E2BF8E"')
    .replace(
      /class="harness"/g,
      `fill="#C23B2A" stroke="${INK}" stroke-width="1.2" stroke-linejoin="round"`,
    )
    .replace(
      /class="line"/g,
      `fill="none" stroke="${INK}" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"`,
    )
    .replace(/class="solid"/g, `fill="${INK}"`)
    .replace(/class="hi"/g, `fill="${PAPER}"`)
  return `<g transform="translate(${fmt(x + ax * s, 2)} ${fmt(y - ay * s, 2)}) scale(${-s} ${s})">${inner}</g>`
}

async function ogSvg(wordmarkSvg: string, planetSvg: string, bricolage600: fontkit.Font) {
  const W = 1200
  const H = 630
  let grid = ''
  for (let x = 24; x < W; x += 24) grid += `M${x} 0V${H}`
  for (let y = 24; y < H; y += 24) grid += `M0 ${y}H${W}`
  let major = ''
  for (let x = 120; x < W; x += 120) major += `M${x} 0V${H}`
  for (let y = 120; y < H; y += 120) major += `M0 ${y}H${W}`
  const wm = splitSvg(wordmarkSvg)
  const [vx, vy, vw, vh] = wm.viewBox.split(/\s+/).map(Number) as [number, number, number, number]
  const wmWidth = 640
  const k = wmWidth / vw
  const wmX = 88
  const wmY = 170
  // Tuschelinie: kommt von links unten, schwingt unter der Wortmarke entlang und umkreist die Planet-Marke.
  // Coco `rennen` an der Linienspitze links unten (DESIGN §12.6), gespiegelt: sie läuft die Leine entlang nach links.
  const line =
    'M210 516C270 500 330 470 470 480S760 560 880 520C1010 476 1080 380 1040 292' +
    'C1000 206 880 176 830 244C790 300 850 392 950 398C1060 404 1130 330 1150 250'
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
    `<rect width="${W}" height="${H}" fill="${PAPER}"/>` +
    `<path d="${grid}" stroke="${GRID}" stroke-opacity="0.07" stroke-width="1"/>` +
    `<path d="${major}" stroke="${GRID}" stroke-opacity="0.12" stroke-width="1.5"/>` +
    `<path d="${line}" fill="none" stroke="${INK}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>` +
    planetGroup(planetSvg, 960, 300, 250, 2.4) +
    cocoRennen(210, 516, 1.75) +
    `<g transform="translate(${fmt(wmX - vx * k, 2)} ${fmt(wmY - vy * k, 2)}) scale(${fmt(k, 4)})">${wm.inner}</g>` +
    `<path fill="${INK}" d="${textPath(bricolage600, OG_TAGLINE, wmX + 6, wmY + vh * k + 78, 46)}"/>` +
    '</svg>'
  )
}

// ---------------------------------------------------------------------------------------------------------------

export function loadMansalva(): fontkit.Font {
  return fontkit.create(
    readFileSync(p('src/styles/fonts/mansalva-latin-400-normal.woff2')),
  ) as fontkit.Font
}

async function loadBricolage600(): Promise<fontkit.Font> {
  const src = readFileSync(
    p(
      'node_modules/@fontsource-variable/bricolage-grotesque/files/bricolage-grotesque-latin-wght-normal.woff2',
    ),
  )
  // Statische Instanz wght 600 als TrueType (fontkit kann variable WOFF2 nicht instanziieren).
  const ttf = await subsetFont(src, OG_TAGLINE, {
    targetFormat: 'sfnt',
    variationAxes: { wght: 600 },
  })
  return fontkit.create(ttf) as fontkit.Font
}

export interface BrandOutputs {
  wordmark: string
  icon: string
}

/** Reine SVG-Ergebnisse (für Tests: eingecheckt = erzeugt). */
export function buildBrandSvgs(): BrandOutputs {
  const planet = readFileSync(p('src/art/planet.svg'), 'utf8')
  const wordmark = readFileSync(p('src/art/wordmark.svg'), 'utf8')
  return { wordmark, icon: buildIconSvg(planet) }
}

async function main(): Promise<void> {
  const planet = readFileSync(p('src/art/planet.svg'), 'utf8')
  const wordmarkSrc = p('src/art/wordmark.svg')
  if (!existsSync(wordmarkSrc) || process.argv.includes('--regen-wordmark')) {
    writeFileSync(wordmarkSrc, buildWordmark(loadMansalva(), planet))
    console.log('art:brand: src/art/wordmark.svg aus Mansalva erzeugt')
  }
  const { wordmark, icon } = buildBrandSvgs()
  mkdirSync(p('public/art'), { recursive: true })
  mkdirSync(p('public/og'), { recursive: true })
  writeFileSync(p('public/art/wordmark.svg'), wordmark)
  writeFileSync(p('src/app/icon.svg'), icon)

  const png = (svg: string, size: number) =>
    sharp(Buffer.from(svg), { density: 72 * (size / 64) })
      .resize(size, size)
      .png({ compressionLevel: 9 })
      .toBuffer()
  const ico = buildIco([
    { size: 16, png: await png(icon, 16) },
    { size: 32, png: await png(icon, 32) },
  ])
  writeFileSync(p('src/app/favicon.ico'), ico)
  writeFileSync(
    p('src/app/apple-icon.png'),
    await sharp(Buffer.from(appleIconSvg(planet)))
      .png({ compressionLevel: 9 })
      .toBuffer(),
  )
  const og = await ogSvg(wordmark, planet, await loadBricolage600())
  writeFileSync(
    p('public/og/default.png'),
    await sharp(Buffer.from(og)).png({ compressionLevel: 9, palette: false }).toBuffer(),
  )
  console.log(
    `art:brand: wordmark ${Buffer.byteLength(wordmark)} B, icon.svg ${Buffer.byteLength(icon)} B, favicon.ico ${ico.length} B`,
  )
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) await main()
