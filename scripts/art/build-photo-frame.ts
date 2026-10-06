// `pnpm art:frame` (PLAN P12.3, U-13, DESIGN §12.2a): erzeugt den viktorianischen Goth-Fotorahmen als **eine** wiederverwendete
// SVG-Datei `public/art/photo-frame.v1.svg` (9-Teile-Rahmen für `border-image`, kein Element und kein SVG je Foto).
// Dünne Tuschelinien (außen und innen), dazwischen ein Filigranband aus Ranken und Schnecken; in den Ecken ein
// symmetrisches Schneckenpaar mit Knospe und Perlen. Die Ecke wird für die vier Ecken gespiegelt, das Kantenstück
// (40 × 40 Einheiten) wiederholt sich nahtlos (Ranke beginnt und endet bei y = 19, waagerecht).
// Deterministisch (feste Wackelwerte), offline, keine Fremdquellen.
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

export const FRAME_FILE = 'public/art/photo-frame.v1.svg'
/** Kantenlänge einer Rahmenkachel in SVG-Einheiten; `border-image-slice` ist ebenfalls 40. */
export const FRAME_TILE = 40
export const FRAME_SIZE = 3 * FRAME_TILE

const INK = '#1C1A17'
const BAND = '#F8F9EC'

const r1 = (n: number) => String(Math.round(n * 10) / 10)

/** Handgezeichnete Spirale (Schnecke) als glatter Pfad: Mittelpunkt, Radien, Windungen, Startwinkel (Grad), Richtung. */
function spiral(
  cx: number,
  cy: number,
  rOuter: number,
  turns: number,
  startDeg: number,
  dir: 1 | -1,
): string {
  const steps = Math.round(turns * 9)
  const pts: [number, number][] = []
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const r = rOuter * (1 - t * 0.9)
    const a = ((startDeg + dir * t * turns * 360) * Math.PI) / 180
    // leichtes, festes Zittern
    const w = 1 + 0.045 * Math.sin(i * 2.3 + startDeg)
    pts.push([cx + r * w * Math.cos(a), cy + r * w * Math.sin(a)])
  }
  return smooth(pts)
}

/** Catmull-Rom → kubische Bézier. */
function smooth(pts: [number, number][]): string {
  let d = `M${r1(pts[0]![0])},${r1(pts[0]![1])}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)]!
    const p1 = pts[i]!
    const p2 = pts[i + 1]!
    const p3 = pts[Math.min(pts.length - 1, i + 2)]!
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6]
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6]
    d += `C${r1(c1[0]!)},${r1(c1[1]!)} ${r1(c2[0]!)},${r1(c2[1]!)} ${r1(p2[0])},${r1(p2[1])}`
  }
  return d
}

const stroke = (d: string, w: number) =>
  `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`
const dot = (cx: number, cy: number, r: number) =>
  `<circle cx="${r1(cx)}" cy="${r1(cy)}" r="${r}" fill="${INK}"/>`

/** Kante (oben): Linien bei y = 5 und y = 33, Ranke bei y = 19, kleine Schnecken und Perlen. */
function edgeTile(): string {
  return [
    stroke('M0,5Q10,4.6 20,5.1T40,5', 2),
    stroke('M0,33Q10,33.4 20,32.9T40,33', 1.4),
    // Ranke, beginnt und endet waagerecht bei y = 19
    stroke('M0,19C7,19 11,11.5 20,19S33,26.5 40,19', 1.5),
    stroke(spiral(10.6, 12.2, 3.1, 1.25, 80, 1), 1.3),
    stroke(spiral(29.4, 25.8, 3.1, 1.25, 260, 1), 1.3),
    dot(29.6, 12.4, 1),
    dot(10.4, 26.4, 1),
  ].join('')
}

/** Ecke (oben links): Kerbe außen, symmetrisches Schneckenpaar, Knospe, Perlen, Ranken zu den beiden Kanten. */
function cornerTile(): string {
  return [
    // Außenlinie mit eingekerbter Ecke (Viertelkreis um (5,5)), Innenlinie mit rechtem Winkel
    stroke('M40,5H14.2A9,9 0 0 1 5,14.2V40', 2),
    stroke('M40,33H33V40', 1.4),
    // Kerben-Perle
    dot(5.2, 5.2, 1.5),
    // Schneckenpaar an der Diagonale (zueinander gespiegelt)
    stroke(spiral(13.4, 25, 5.4, 1.5, 300, -1), 1.5),
    stroke(spiral(25, 13.4, 5.4, 1.5, 150, 1), 1.5),
    // Knospe zwischen den Schnecken und Perlen
    stroke('M13.2,13.2C17,13.8 19.4,16.4 20.2,20.4C16.2,19.6 13.6,17.2 13.2,13.2Z', 1.3),
    dot(10.6, 10.6, 1),
    // Ranken zu den Kanten (enden waagerecht bei (40,19) bzw. senkrecht bei (19,40))
    stroke('M20.2,20.4C25,21.4 28,16.6 40,19', 1.5),
    stroke('M20.2,20.4C21.4,25 16.6,28 19,40', 1.5),
    dot(27.4, 25.6, 1),
    dot(25.6, 27.4, 1),
  ].join('')
}

export function buildPhotoFrame(): string {
  const S = FRAME_SIZE
  const T = FRAME_TILE
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">` +
    '<defs>' +
    `<g id="e"><rect width="${T}" height="${T}" fill="${BAND}"/>${edgeTile()}</g>` +
    `<g id="k"><rect width="${T}" height="${T}" fill="${BAND}"/>${cornerTile()}</g>` +
    '</defs>' +
    `<use href="#k"/>` +
    `<use href="#e" x="${T}"/>` +
    `<use href="#k" transform="translate(${S} 0) scale(-1 1)"/>` +
    `<use href="#e" transform="translate(0 ${2 * T}) rotate(-90)"/>` +
    `<use href="#e" transform="translate(${S} ${T}) rotate(90)"/>` +
    `<use href="#k" transform="translate(0 ${S}) scale(1 -1)"/>` +
    `<use href="#e" transform="translate(${2 * T} ${S}) rotate(180)"/>` +
    `<use href="#k" transform="translate(${S} ${S}) scale(-1 -1)"/>` +
    '</svg>\n'
  )
}

async function main(): Promise<void> {
  const out = path.join(process.cwd(), FRAME_FILE)
  mkdirSync(path.dirname(out), { recursive: true })
  writeFileSync(out, buildPhotoFrame())
  console.log(`art:frame: ${FRAME_FILE} (${Buffer.byteLength(buildPhotoFrame())} B)`)
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) void main()
