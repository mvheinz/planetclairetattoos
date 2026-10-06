import type { Locale } from '@/lib/enums'
import { formatMoney } from '@/lib/money'

// Preisschild und „sold“-Stempel (DESIGN KO-05, KO-06, E-77): alle Maße und Winkel deterministisch aus der Objektnummer
// – Server und Browser rechnen dasselbe, keine Zufallswerte zur Laufzeit. Reines Modul (auch im Browser nutzbar).

export type PriceTagVariant = 'hanging' | 'pinned' | 'mini'

const mod = (a: number, n: number) => ((a % n) + n) % n

/** Drehung des Schilds in Grad: `((nr × 37) mod 9) − 4`; ergibt das 0, gilt 2.5° (ein Schild hängt nie gerade). */
export function tagAngle(nr: number): number {
  const angle = mod(nr * 37, 9) - 4
  return angle === 0 ? 2.5 : angle
}

/** Fadenlänge in px: `6 + ((nr × 13) mod 9)` (6–14 px). */
export function threadLength(nr: number): number {
  return 6 + mod(nr * 13, 9)
}

/** Drehung des Stempels: −14° ± 2° nach Nummer (−16 … −12). */
export function stampAngle(nr: number): number {
  return -14 + (mod(nr * 29, 5) - 2)
}

/** Preis auf dem Schild: ganze Euro ohne Nachkommastellen („45 €“ / „€45“), sonst mit („38,50 €“). */
export function formatTagPrice(cents: number, locale: Locale): string {
  return formatMoney(cents, locale, { style: 'tag' })
}

/** Mindestbreite des Schilds in px (KO-05: mobil 76, ab 768 px 92; `mini` 64). */
export const TAG_MIN_WIDTH: Record<PriceTagVariant, number> = { hanging: 76, pinned: 92, mini: 64 }
/** Höhe des Schild-Körpers in px (KO-05: ≥ 58; `mini` kleiner, ohne Nummer). */
export const TAG_HEIGHT: Record<PriceTagVariant, number> = { hanging: 72, pinned: 76, mini: 50 }
/** Mitte der Öse ab Oberkante des Schild-Körpers (Drehpunkt, `transform-origin`). */
export const EYELET_Y = 10

/**
 * Geschätzte Breite des Schilds (viewBox der Kontur): Spectral-Italic-Ziffern sind im Mittel etwa 0,46 em breit. Das Schild wächst
 * per CSS mit dem Inhalt; die Schätzung hält nur die Kontur nahe an ihren natürlichen Proportionen.
 */
export function estimateTagWidth(priceText: string, variant: PriceTagVariant): number {
  const em = variant === 'mini' ? 22 : 30
  const chars = [...priceText].length + 1 // + Sternchen
  const content = Math.round(chars * 0.46 * em) + (variant === 'mini' ? 12 : 20)
  return Math.max(TAG_MIN_WIDTH[variant], content)
}

/** Kleiner deterministischer Zahlengenerator (Mulberry32) für den Wackel der Kontur. */
function prng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const r1 = (n: number) => Math.round(n * 10) / 10

/**
 * Kontur „Kofferanhänger“ (KO-05): oben zwei um 8 px abgeschrägte Ecken, unten leicht gerundet, jeder Stützpunkt um
 * höchstens ±0.6 px verschoben (Wackel aus der Nummer). Koordinaten in einer `width × height`-viewBox, 1 px Innenrand
 * für die 1.5-px-Kontur.
 */
export function tagOutlinePath(width: number, height: number, nr: number): string {
  const rand = prng(Math.imul(nr, 0x9e3779b1) ^ 0x5bd1e995)
  const j = () => (rand() * 2 - 1) * 0.6
  const i = 1
  const bevel = 8
  const r = 5
  const w = width - i
  const h = height - i
  const P = (x: number, y: number) => `${r1(x + j())} ${r1(y + j())}`
  return [
    `M${P(i, i + bevel)}`,
    `L${P(i + bevel, i)}`,
    `L${P(width * 0.5, i)}`,
    `L${P(w - bevel, i)}`,
    `L${P(w, i + bevel)}`,
    `L${P(w, height * 0.55)}`,
    `L${P(w, h - r)}`,
    `Q${P(w, h)} ${P(w - r, h)}`,
    `L${P(width * 0.62, h)}`,
    `L${P(width * 0.3, h)}`,
    `L${P(i + r, h)}`,
    `Q${P(i, h)} ${P(i, h - r)}`,
    `L${P(i, height * 0.5)}`,
    'Z',
  ].join('')
}

/** viewBox des Stempel-Rahmens (Seitenverhältnis des Stempels „sold“). */
export const STAMP_VIEWBOX = { w: 110, h: 46 } as const

/**
 * Rahmen des Stempels (KO-06): Rechteck mit rauen Kanten (Radius 4) und 3–5 kleinen Lücken (Druckbild), als offene
 * Teilstücke entlang des Umfangs. Deterministisch aus der Nummer.
 */
export function stampFramePaths(nr: number): string[] {
  const rand = prng(Math.imul(nr, 0x85ebca6b) ^ 0x27d4eb2d)
  const { w, h } = STAMP_VIEWBOX
  const inset = 3
  const x0 = inset
  const y0 = inset
  const x1 = w - inset
  const y1 = h - inset
  const rough = () => (rand() * 2 - 1) * 0.7
  // Umlauf im Uhrzeigersinn in kleinen Schritten; Ecken als kurze Diagonale (Radius ≈ 4).
  const ring: [number, number][] = []
  const edge = (ax: number, ay: number, bx: number, by: number, steps: number) => {
    for (let k = 0; k < steps; k++) {
      const t = k / steps
      ring.push([ax + (bx - ax) * t + rough(), ay + (by - ay) * t + rough()])
    }
  }
  const c = 4
  edge(x0 + c, y0, x1 - c, y0, 12)
  edge(x1 - c, y0, x1, y0 + c, 1)
  edge(x1, y0 + c, x1, y1 - c, 5)
  edge(x1, y1 - c, x1 - c, y1, 1)
  edge(x1 - c, y1, x0 + c, y1, 12)
  edge(x0 + c, y1, x0, y1 - c, 1)
  edge(x0, y1 - c, x0, y0 + c, 5)
  edge(x0, y0 + c, x0 + c, y0, 1)
  const n = ring.length
  const gaps = 3 + Math.floor(rand() * 3)
  const cut = new Set<number>()
  for (let g = 0; g < gaps; g++) cut.add(Math.floor(((g + 0.3 + rand() * 0.4) / gaps) * n) % n)
  const paths: string[] = []
  let current: string[] = []
  for (let k = 0; k <= n; k++) {
    const idx = k % n
    if (cut.has(idx) && current.length > 0) {
      if (current.length > 1) paths.push(`M${current.join('L')}`)
      current = []
      continue
    }
    const [x, y] = ring[idx]!
    current.push(`${r1(x)} ${r1(y)}`)
  }
  if (current.length > 1) paths.push(`M${current.join('L')}`)
  return paths
}
