// `pnpm art:character-sheet` (PLAN P9.8, DESIGN §10.1/§10.2/§10.7, KUNST-QA CO-02/CO-03): Coco-Charakterblatt
// `content/art/coco/character-sheet.svg` und gerendert `character-sheet.webp` (≤ 300 KB). Seiten- und ¾-Ansicht aus dem
// Zeichen-Generator (`scripts/art/draw-coco.ts`) mit Hilfslinien in der Einheit K, nummerierte Merkmale, Messtabelle
// (gemessen wie `pnpm art:check` CO-02), Fell-/Geschirr-Wash mit Versatz, Strich-Regeln und Gesten-Skizzen aller
// 6 Posen und 4 Brücken. Zeichenvorlage nur – keine eingebetteten Fotos (`<image>` verboten), nie in `public/`, nie im
// Build oder in der Vorschau-Datei.
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import sharp from 'sharp'

import {
  BRIDGES,
  K,
  SPRITE_POSES,
  SPRITE_STYLE,
  figureFor,
  renderSymbol,
  stehen,
  type Figure,
  type P,
} from './draw-coco'
import { cocoProportions, spriteSymbols, type CocoProportions } from './lib/checks/art'

export const SHEET_DIR = 'content/art/coco'
export const SHEET_SVG = path.join(SHEET_DIR, 'character-sheet.svg')
export const SHEET_WEBP = path.join(SHEET_DIR, 'character-sheet.webp')
export const SHEET_MAX_BYTES = 300_000

const W = 1600
const H = 1260
const INK = '#1C1A17'
const PAPER = '#F4EFE6'
const RED = '#C23B2A'
const GUIDE = '#3E7CB1'

/** Messbereiche KUNST-QA CO-02 (Verhältnis zur Kopflänge bzw. Beinlänge). */
export const CO02_RANGES = {
  earToHead: [0.8, 1.1],
  eyeToHead: [0.18, 0.26],
  snoutToHead: [0.3, 0.45],
  noseToHead: [0, 0.15],
  legWidthToLength: [0, 0.18],
} as const satisfies Record<string, readonly [number, number]>

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const de = (n: number, d = 2) => n.toFixed(d).replace('.', ',')

function text(x: number, y: number, s: string, size = 15, attrs = ''): string {
  const fill = attrs.includes('fill=') ? '' : ` fill="${INK}"`
  return `<text x="${x}" y="${y}" font-family="DejaVu Sans, Arial, sans-serif" font-size="${size}"${fill}${attrs}>${esc(s)}</text>`
}

/** Mittelpunkt der ungezitterten Stützpunkte eines Körperteils (für Merkmal-Marken). */
function centroid(fig: Figure, part: string, layer?: string): P {
  const pts = fig.strokes
    .filter((s) => s.part === part && (!layer || s.layer === layer))
    .flatMap((s) => s.pts)
  const n = pts.length || 1
  return [pts.reduce((a, p) => a + p[0], 0) / n, pts.reduce((a, p) => a + p[1], 0) / n]
}

function extent(fig: Figure, part: string, layer = 'line') {
  const pts = fig.strokes.filter((s) => s.part === part && s.layer === layer).flatMap((s) => s.pts)
  const xs = pts.map((p) => p[0])
  const ys = pts.map((p) => p[1])
  return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) }
}

const spec = (id: string, pose: string, frame = 'a') => ({ id, pose, frame, bridge: false })

/** Symbol als eigenständiges Sprite-SVG (für die Messung wie in `art:check`). */
function measureSvg(symbols: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg"><style>${SPRITE_STYLE}</style>${symbols}</svg>`
}

export async function measure(): Promise<{ side: CocoProportions; front: CocoProportions }> {
  const svg = measureSvg(
    renderSymbol(spec('coco-stehen-a', 'stehen'), stehen()) +
      renderSymbol(spec('coco-sitzen-a', 'sitzen')),
  )
  const [side, front] = await Promise.all(spriteSymbols(svg).map((s) => cocoProportions(s)))
  return { side: side!, front: front! }
}

/** Symbol-Inhalt (ohne `<symbol>`-Hülle) skaliert an `x|y` einsetzen. */
function place(symbol: string, x: number, y: number, s: number): string {
  const inner = /<symbol\b[^>]*>([\s\S]*)<\/symbol>/.exec(symbol)![1]!
  return `<g transform="translate(${x} ${y}) scale(${s})">${inner}</g>`
}

function marker(n: number, [x, y]: P, dx: number, dy: number): string {
  const tx = x + dx
  const ty = y + dy
  return (
    `<path d="M${x} ${y}L${tx} ${ty}" stroke="${RED}" stroke-width="1.4" fill="none"/>` +
    `<path d="M${tx - 11} ${ty}a11 11 0 1 0 22 0a11 11 0 1 0 -22 0Z" fill="${PAPER}" stroke="${RED}" stroke-width="1.6"/>` +
    text(tx - 4.5, ty + 5, String(n), 14, ` fill="${RED}" font-weight="bold"`)
  )
}

export const FEATURES = [
  'Große aufrechte Ohren, breite Basis (0,5 K), leicht asymmetrisch, je eine Innenohr-Linie',
  'Große dunkle Augen, mandelrund, Glanzpunkt oben vorn (Seitenblick)',
  'Kurze helle Schnauze (Papier), deutlicher Stopp',
  'Schwarze, leicht herzförmige Nase (0,12 K)',
  'Helle Blesse zwischen den Augen – nur ausgesparter Wash',
  'Tiefe helle Brust, schlanke Taille',
  'Dünne gerade Beine mit hellen „Söckchen“, kleine Pfoten',
  'Sichelschwanz locker nach oben über den Rücken',
  'Rotes Geschirr: Halsring, Bauchgurt, Rückensteg; D-Ring = Leinen-Anker',
] as const

export const STROKE_RULES = [
  'Monoline Tusche, Strich nur über CSS (--coco-stroke 1,2–2,2 px, non-scaling)',
  'Offene Konturen: ≥ 2 Absetzer je Frame (Lücke 2–3 Einheiten)',
  'Überstände an Beinansätzen (1–3 Einheiten), kleine Haken an Strichenden',
  'Eine Kontur doppelt nachgezogen (Rücken, Versatz 1–1,5)',
  'Nur Nase, Pupillen, Ballen gefüllt; Glanzpunkte in Papierfarbe',
  'Keine Kreise/Ellipsen, keine Spiegelsymmetrie, keine Verläufe, kein Umriss',
  'Frames B/C: jede Linie neu nachgezeichnet (0,5–1,5 Einheiten), Anker ± 2',
  'Schlafen: Augen als Bögen, 5 Schraffurstriche unter 40°',
] as const

export async function buildSheet(): Promise<{
  svg: string
  side: CocoProportions
  front: CocoProportions
}> {
  const { side, front } = await measure()
  const S = 4.2
  const out: string[] = []
  out.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">`,
    `<style>${SPRITE_STYLE.replace(/var\(--[\w-]+,([^)]+)\)/g, '$1')}.line,.harness{stroke-width:2.4px}</style>`,
    `<path d="M0 0H${W}V${H}H0Z" fill="${PAPER}"/>`,
    text(40, 46, 'Coco – Charakterblatt (P9.8)', 30, ' font-weight="bold"'),
    text(
      40,
      74,
      'Grundlage: Juttas Skizzen (content/art/jutta-skizzen: coco-oh-01, narrenkappe-01, hund-vogel-01) und die 9 Highlight-Bilder (150 px). Eigene Coco-Fotos fehlen noch – Annahme, siehe OFFENE-PUNKTE.',
      14,
    ),
  )

  // --- Seitenansicht mit Hilfslinien in K ---
  const fig = stehen()
  const ox = 30
  const oy = 96
  const X = (x: number) => ox + x * S
  const Y = (y: number) => oy + y * S
  out.push(
    text(
      ox + 10,
      oy + 14,
      'Seitenansicht (stehend), Einheit K = Kopflänge',
      17,
      ' font-weight="bold"',
    ),
  )
  const head = extent(fig, 'head')
  const nose = extent(fig, 'nose', 'solid')
  const ear = extent(fig, 'ear-l')
  const ground = 112
  const withers = 60.5
  const guide = (y: number, label: string) =>
    `<path d="M${X(8)} ${Y(y)}H${X(152)}" stroke="${GUIDE}" stroke-width="1" stroke-dasharray="6 5" fill="none"/>` +
    text(X(152) + 6, Y(y) + 5, label, 13, ` fill="${GUIDE}"`)
  const k = (v: number) => de((ground - v) / K, 1)
  out.push(
    guide(ground, 'Boden'),
    guide(withers, `Widerrist ${k(withers)} K`),
    guide(ear.y0, `Ohrspitze ${k(ear.y0)} K`),
    // Kopflänge K als Klammer über dem Kopf
    `<path d="M${X(head.x0)} ${Y(head.y0) - 30}v-8H${X(nose.x1)}v8" stroke="${GUIDE}" stroke-width="1.4" fill="none"/>`,
    text(
      (X(head.x0) + X(nose.x1)) / 2 - 22,
      Y(head.y0) - 44,
      `1 K = ${de(K, 1)} E.`,
      13,
      ` fill="${GUIDE}"`,
    ),
    // K-Raster unten
    ...Array.from({ length: 4 }, (_, i) => {
      const x0 = 30 + i * K
      return `<path d="M${X(x0)} ${Y(ground) + 26}v-6H${X(x0 + K)}v6" stroke="${GUIDE}" stroke-width="1.2" fill="none"/>${text(X(x0 + K / 2) - 10, Y(ground) + 42, `${i + 1} K`, 12, ` fill="${GUIDE}"`)}`
    }),
    place(renderSymbol(spec('coco-stehen-a', 'stehen'), fig), ox, oy, S),
    marker(1, [X(ear.x0 + 6), Y(ear.y0 + 10)], -70, -10),
    marker(
      2,
      [X(centroid(fig, 'eye-l', 'solid')[0]), Y(centroid(fig, 'eye-l', 'solid')[1])],
      30,
      -70,
    ),
    marker(3, [X(centroid(fig, 'snout')[0]), Y(centroid(fig, 'snout')[1] + 2)], 40, 40),
    marker(4, [X(nose.x1), Y((nose.y0 + nose.y1) / 2)], 40, -20),
    marker(6, [X(110), Y(86)], 60, 40),
    marker(7, [X(centroid(fig, 'leg-fl')[0]), Y(106)], 60, 10),
    marker(8, [X(centroid(fig, 'tail')[0]), Y(centroid(fig, 'tail')[1])], -50, -30),
    marker(9, [X(fig.ring[0]), Y(fig.ring[1])], -10, -80),
  )

  // --- ¾-Ansicht sitzend ---
  const sit = figureFor('sitzen', 'a')
  const sx = 800
  const sy = 96
  const X2 = (x: number) => sx + x * S
  const Y2 = (y: number) => sy + y * S
  out.push(
    text(sx + 30, sy + 14, '¾-Ansicht (sitzen, Kopf zum Betrachter)', 17, ' font-weight="bold"'),
    place(renderSymbol(spec('coco-sitzen-a', 'sitzen')), sx, sy, S),
    marker(1, [X2(centroid(sit, 'ear-r')[0]), Y2(centroid(sit, 'ear-r')[1])], 60, -20),
    marker(
      2,
      [X2(centroid(sit, 'eye-r', 'solid')[0]), Y2(centroid(sit, 'eye-r', 'solid')[1])],
      90,
      -10,
    ),
    marker(
      4,
      [X2(centroid(sit, 'nose', 'solid')[0]), Y2(centroid(sit, 'nose', 'solid')[1])],
      90,
      20,
    ),
    marker(5, [X2(86), Y2(32)], -10, -60),
    marker(6, [X2(100), Y2(70)], 80, 0),
    marker(7, [X2(96), Y2(100)], 80, 0),
    marker(9, [X2(sit.ring[0]), Y2(sit.ring[1])], -90, -10),
  )

  // --- Messtabelle ---
  const tx = 40
  const ty = 690
  const rows: [string, string, keyof typeof CO02_RANGES][] = [
    ['Ohrhöhe / K', '0,95', 'earToHead'],
    ['Augenbreite / K', '0,22', 'eyeToHead'],
    ['Schnauzenlänge / K', '0,38', 'snoutToHead'],
    ['Nase / K', '0,12', 'noseToHead'],
    ['Beinbreite / Beinlänge', '0,12 / 1,0', 'legWidthToLength'],
  ]
  out.push(
    text(tx, ty, 'Messtabelle (wie art:check CO-02, Bbox der Teile)', 17, ' font-weight="bold"'),
  )
  const cols = [tx, tx + 230, tx + 360, tx + 500, tx + 610, tx + 720]
  const head2 = ['Maß', 'Soll §10.1', 'Bereich CO-02', 'Seite', '¾', 'ok']
  head2.forEach((h, i) => out.push(text(cols[i]!, ty + 30, h, 14, ' font-weight="bold"')))
  rows.forEach(([label, soll, key], r) => {
    const y = ty + 56 + r * 24
    const [lo, hi] = CO02_RANGES[key]
    const vs = side[key]
    const vf = key === 'legWidthToLength' ? null : front[key]
    const ok = [vs, vf].every((v) => v === null || (v >= lo && v <= hi))
    out.push(
      text(cols[0]!, y, label, 14),
      text(cols[1]!, y, soll, 14),
      text(cols[2]!, y, `${de(lo)}–${de(hi)}`, 14),
      text(cols[3]!, y, vs === null ? '–' : de(vs), 14, ` data-measure="side:${key}"`),
      text(cols[4]!, y, vf === null ? '–' : de(vf), 14, ` data-measure="front:${key}"`),
      text(cols[5]!, y, ok ? 'ja' : 'NEIN', 14, ok ? '' : ` fill="${RED}"`),
    )
  })
  const y2 = ty + 56 + rows.length * 24 + 6
  out.push(
    text(
      tx,
      y2,
      `Ohren-Asymmetrie Seite ${de((side.earAsym ?? 0) * 100, 0)} %, ¾ ${de((front.earAsym ?? 0) * 100, 0)} % (CO-06: 5–15 %); Augen ¾ ${de((front.eyeDiff ?? 0) * 100, 0)} % verschieden (≥ 3 %).`,
      13,
    ),
    text(
      tx,
      y2 + 20,
      `Gezeichnet: Widerrist ${k(withers)} K, Ohrspitze ${k(ear.y0)} K über Boden (Soll 1,3 / 2,2 K):`,
      13,
    ),
    text(
      tx,
      y2 + 38,
      'Kopf höher getragen wie auf highlight-more-ceramics (Annahme, OFFENE-PUNKTE).',
      13,
    ),
  )

  // --- Merkmale ---
  const fx = 820
  const fy = 690
  out.push(text(fx, fy, 'Merkmale (Nummern in den Zeichnungen)', 17, ' font-weight="bold"'))
  FEATURES.forEach((f, i) => out.push(text(fx, fy + 28 + i * 21, `${i + 1}  ${f}`, 13)))

  // --- Wash-Versatz und Strich-Regeln ---
  const wy = 948
  out.push(
    text(
      40,
      wy,
      'Wash mit Versatz (Riso): Fläche 1,5/1,2 E. nach rechts unten',
      15,
      ' font-weight="bold"',
    ),
    `<path d="M${46 + 6} ${wy + 20 + 5}h90v40h-90Z" fill="#E2BF8E"/>`,
    `<path d="M46 ${wy + 20}h90v40h-62" stroke="${INK}" stroke-width="2.6" fill="none" stroke-linecap="round"/>`,
    `<path d="M${166 + 6} ${wy + 20 + 5}h24v40h-24Z" fill="${RED}"/>`,
    `<path d="M166 ${wy + 20}h24v40h-24Z" stroke="${INK}" stroke-width="2.2" fill="none"/>`,
    text(210, wy + 46, 'Fell --coco-fur · Geschirr --coco-harness · Grenzen ohne eigene Linie', 13),
    text(820, wy, 'Strich (§10.2, wie Juttas Skizzen)', 15, ' font-weight="bold"'),
    ...STROKE_RULES.map((r, i) => text(820, wy + 22 + i * 17, `· ${r}`, 12)),
  )

  // --- Gesten-Skizzen ---
  const gy = 1120
  out.push(text(40, gy - 8, 'Gesten: 6 Posen (Frame A) und 4 Brücken', 15, ' font-weight="bold"'))
  const all = [
    ...SPRITE_POSES.map((p) => ({ id: `coco-${p}-a`, pose: p, label: p })),
    ...BRIDGES.map((b) => ({ id: `coco-bridge-${b}`, pose: b, label: `Brücke ${b}` })),
  ]
  all.forEach((g, i) => {
    const x = 40 + i * 154
    const sym = renderSymbol({
      id: g.id,
      pose: g.pose,
      frame: 'a',
      bridge: g.id.includes('bridge'),
    })
    out.push(place(sym, x, gy, 0.9), text(x + 4, gy + 118, g.label, 11))
  })
  out.push('</svg>\n')
  return { svg: out.join(''), side, front }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const { svg } = await buildSheet()
  mkdirSync(SHEET_DIR, { recursive: true })
  writeFileSync(SHEET_SVG, svg)
  await sharp(Buffer.from(svg), { density: 96 }).webp({ quality: 82 }).toFile(SHEET_WEBP)
  console.log(`art:character-sheet: ${SHEET_SVG} und ${SHEET_WEBP} geschrieben.`)
}
