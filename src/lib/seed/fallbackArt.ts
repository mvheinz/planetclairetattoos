import 'server-only'

import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

import sharp from 'sharp'

// Ersatzzeichnung bis P8 (SEED-SPEC §4.3): Fehlt `src/art/placeholders/{typ}-{n}.svg`, erzeugt der Seed
// deterministisch ein SVG 400×500 – Grund `--paper-2`, die Wash-Fläche als versetztes Rechteck, eine einfache
// Tusche-Form je Typ, kein Text. Gleicher Rasterpfad wie die echten Platzhalter (sharp → WebP 800×1000).

/** Farbwerte aus den Design-Tokens (DESIGN §3, `src/app/(frontend)/styles.css`). */
export const ART_TOKENS = {
  paper2: '#EAE2D4',
  ink: '#1C1A17',
  wash: {
    clay: '#E3D3BA',
    pink: '#F4CCDA',
    mat: '#CFE2D5',
    sky: '#D6E4EC',
  },
} as const
export type WashToken = keyof typeof ART_TOKENS.wash

export const PLACEHOLDER_TYPES = [
  'teller',
  'fliese',
  'shirt',
  'kleid',
  'cap',
  'zeichnung',
  'anhaenger',
  'spiegel',
  'flash',
  'tattoo',
] as const
export type PlaceholderType = (typeof PLACEHOLDER_TYPES)[number]

export const PLACEHOLDER_DIR = path.join('src', 'art', 'placeholders')
export const PLACEHOLDER_RASTER = { width: 800, height: 1000 } as const

/** `ph:teller-01` → `{ type: 'teller', n: '01' }`. */
export function parsePlaceholderKey(key: string): { type: PlaceholderType; n: string } {
  const m = /^(?:media:)?ph:([a-z]+)-(\d+)$/.exec(key)
  const type = m?.[1] as PlaceholderType | undefined
  if (!m || !type || !PLACEHOLDER_TYPES.includes(type)) {
    throw new Error(`Unbekannter Platzhalter-Schlüssel „${key}“ (SEED-SPEC §4.2).`)
  }
  return { type, n: m[2]! }
}

/** Kleiner deterministischer Zufall aus dem Schlüssel (Wackel, Neigung). */
function jitter(key: string): (i: number) => number {
  const h = createHash('sha256').update(key).digest()
  return (i: number) => (h[i % h.length]! / 255) * 2 - 1
}

const f = (n: number) => n.toFixed(1)

function inkShape(type: PlaceholderType, r: (i: number) => number): string {
  const w = (i: number, amp = 3) => r(i) * amp
  switch (type) {
    case 'teller':
      return `<ellipse cx="${f(200 + w(1))}" cy="${f(260 + w(2))}" rx="130" ry="${f(78 + w(3))}"/><ellipse cx="200" cy="260" rx="${f(82 + w(4))}" ry="${f(46 + w(5))}"/>`
    case 'fliese':
      return `<path d="M${f(95 + w(1))} ${f(150 + w(2))} L${f(305 + w(3))} ${f(146 + w(4))} L${f(309 + w(5))} ${f(356 + w(6))} L${f(92 + w(7))} ${f(360 + w(8))} Z"/>`
    case 'shirt':
      return `<path d="M${f(150 + w(1))} 140 L${f(95 + w(2))} 175 L${f(115 + w(3))} 225 L145 212 L${f(148 + w(4))} 380 L${f(252 + w(5))} 380 L255 212 L285 225 L${f(305 + w(6))} 175 L${f(250 + w(7))} 140 Q200 ${f(170 + w(8))} 150 140"/>`
    case 'kleid':
      return `<path d="M${f(170 + w(1))} 130 L${f(230 + w(2))} 130 L${f(245 + w(3))} 210 L${f(300 + w(4))} 390 L${f(100 + w(5))} 390 L${f(155 + w(6))} 210 Z"/><path d="M200 ${f(96 + w(7))} Q205 112 185 130"/>`
    case 'cap':
      return `<path d="M${f(110 + w(1))} 280 Q${f(115 + w(2))} 170 200 ${f(165 + w(3))} Q${f(285 + w(4))} 170 ${f(290 + w(5))} 280 Z"/><path d="M${f(270 + w(6))} 280 Q330 ${f(290 + w(7))} ${f(345 + w(8))} 305 L280 300"/>`
    case 'zeichnung':
      return `<path d="M${f(110 + w(1))} ${f(120 + w(2))} L${f(292 + w(3))} ${f(118 + w(4))} L${f(296 + w(5))} ${f(382 + w(6))} L${f(106 + w(7))} ${f(384 + w(8))} Z"/><path d="M${f(96 + w(9))} 132 L128 106 M272 106 L${f(304 + w(10))} 132"/>`
    case 'anhaenger':
      return `<circle cx="${f(200 + w(1))}" cy="${f(275 + w(2))}" r="${f(72 + w(3))}"/><circle cx="200" cy="${f(183 + w(4))}" r="14"/>`
    case 'spiegel':
      return `<path d="M${f(118 + w(1))} 118 L${f(284 + w(2))} 116 L${f(286 + w(3))} 388 L${f(116 + w(4))} 390 Z"/><path d="M140 140 L262 140 L264 366 L140 366 Z"/>`
    case 'flash':
      return `<circle cx="${f(200 + w(1))}" cy="${f(250 + w(2))}" r="${f(62 + w(3))}"/><ellipse cx="200" cy="250" rx="${f(118 + w(4))}" ry="${f(26 + w(5))}" transform="rotate(${f(-14 + w(6, 4))} 200 250)"/>`
    case 'tattoo':
      return `<path d="M${f(150 + w(1))} 110 Q${f(130 + w(2))} 260 ${f(160 + w(3))} 400 M${f(250 + w(4))} 110 Q${f(272 + w(5))} 260 ${f(240 + w(6))} 400"/><circle cx="${f(200 + w(7))}" cy="${f(255 + w(8))}" r="22"/>`
  }
}

/** Deterministisches Ersatz-SVG 400×500 (ohne Text). `wash` fehlt bei Flash (Stencil-Anmutung). */
export function fallbackArtSvg(key: string, wash?: WashToken | null): string {
  const { type } = parsePlaceholderKey(key)
  const r = jitter(key)
  const tilt = f(r(20) * 3)
  const washRect = wash
    ? `<rect x="${f(108 + r(21) * 4)}" y="${f(138 + r(22) * 4)}" width="190" height="240" rx="18" fill="${ART_TOKENS.wash[wash]}"/>`
    : ''
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 500" width="400" height="500">',
    `<rect width="400" height="500" fill="${ART_TOKENS.paper2}"/>`,
    washRect,
    `<g transform="rotate(${tilt} 200 250)" fill="none" stroke="${ART_TOKENS.ink}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">`,
    inkShape(type, r),
    '</g></svg>',
  ].join('')
}

/**
 * Rasterbild eines Platzhalters: echtes SVG aus `src/art/placeholders/{typ}-{n}.svg`, sonst die Ersatzzeichnung;
 * gerastert als WebP 800×1000.
 */
export async function placeholderArtWebp(
  key: string,
  wash?: WashToken | null,
  root = process.cwd(),
): Promise<{ data: Buffer; fromFile: boolean }> {
  const { type, n } = parsePlaceholderKey(key)
  let svg: string
  let fromFile = false
  try {
    svg = await readFile(path.join(root, PLACEHOLDER_DIR, `${type}-${n}.svg`), 'utf8')
    fromFile = true
  } catch {
    svg = fallbackArtSvg(key, wash)
  }
  const data = await sharp(Buffer.from(svg), { density: 144 })
    .resize(PLACEHOLDER_RASTER.width, PLACEHOLDER_RASTER.height, { fit: 'fill' })
    .webp({ quality: 88 })
    .toBuffer()
  return { data, fromFile }
}
