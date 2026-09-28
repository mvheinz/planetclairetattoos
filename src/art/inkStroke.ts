import { mulberry32, valueNoise1D } from '../leash/random'

// Tuschestrich aus einer Mittellinie (DESIGN §9.3 „Hand“, KO-18): gefüllter Umriss mit schwankender Breite (Druck),
// leichtem Zittern quer zur Richtung und verjüngten, runden Enden – wie die Tuschelinie, aber als statische Form für
// Server-HTML (404-Karabiner, 500-Knäuel). Deterministisch je Seed, ohne DOM, framework-frei.

export interface Pt {
  x: number
  y: number
}

export interface InkStrokeOptions {
  /** Grundbreite in px (Tuschelinie: 2.2 mobil / 2.6 ab 768). */
  width: number
  seed: number
  /** Zittern quer zur Richtung in px. */
  wobble?: number
  /** Länge der verjüngten Enden in px. */
  taper?: number
  /** Abstand der Stützstellen in px. */
  step?: number
}

const r1 = (n: number) => String(Math.round(n * 10) / 10)

/** Mittellinie gleichmäßig nach Bogenlänge neu abtasten. */
export function resample(points: readonly Pt[], step: number): Pt[] {
  if (points.length < 2) return [...points]
  const out: Pt[] = [points[0]!]
  let carry = 0
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!
    const b = points[i]!
    const len = Math.hypot(b.x - a.x, b.y - a.y)
    let d = step - carry
    while (d <= len) {
      const t = d / len
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })
      d += step
    }
    carry = len - (d - step)
  }
  const last = points[points.length - 1]!
  const tail = out[out.length - 1]!
  if (Math.hypot(last.x - tail.x, last.y - tail.y) > step * 0.25) out.push(last)
  return out
}

/** Gefüllter Umriss (`d`) eines Tuschestrichs entlang `points`. */
export function inkStrokePath(points: readonly Pt[], options: InkStrokeOptions): string {
  const { width, seed, wobble = 0.5, taper = 14, step = 2 } = options
  const pts = resample(points, step)
  const n = pts.length
  if (n < 2) return ''
  const pressure = valueNoise1D(seed)
  const shake = valueNoise1D(seed ^ 0x9e3779b9)
  const total = (n - 1) * step
  const left: Pt[] = []
  const right: Pt[] = []
  for (let i = 0; i < n; i++) {
    const p = pts[i]!
    const a = pts[Math.max(0, i - 1)]!
    const b = pts[Math.min(n - 1, i + 1)]!
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1
    const nx = -(b.y - a.y) / len
    const ny = (b.x - a.x) / len
    const s = i * step
    let w = width * (1 + 0.16 * pressure(s / 70) + 0.05 * pressure(s / 11 + 40))
    const head = Math.min(1, s / taper)
    const tail = Math.min(1, (total - s) / taper)
    w *= (0.35 + 0.65 * Math.sqrt(head)) * (0.45 + 0.55 * Math.sqrt(tail))
    const off = wobble * shake(s / 45)
    const cx = p.x + nx * off
    const cy = p.y + ny * off
    left.push({ x: cx + (nx * w) / 2, y: cy + (ny * w) / 2 })
    right.push({ x: cx - (nx * w) / 2, y: cy - (ny * w) / 2 })
  }
  const ring = [...left, ...right.reverse()]
  let d = `M${r1(ring[0]!.x)} ${r1(ring[0]!.y)}`
  for (let i = 1; i < ring.length; i++) d += `L${r1(ring[i]!.x)} ${r1(ring[i]!.y)}`
  return `${d}Z`
}

/** Kleine, reproduzierbare Streuung für Zeichenpunkte (Hand statt Zirkel). */
export function jitterer(seed: number, amount: number): (p: Pt) => Pt {
  const rand = mulberry32(seed)
  return (p) => ({ x: p.x + (rand() - 0.5) * amount, y: p.y + (rand() - 0.5) * amount })
}
