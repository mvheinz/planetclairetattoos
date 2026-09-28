import {
  BP_DESKTOP,
  BP_TABLET,
  PRESET_CONFIG,
  WOBBLE,
  isScrollCoupled,
  loopScroll,
} from './presets'
import { mulberry32, valueNoise1D } from './random'
import type {
  BuildInput,
  LeashAnchor,
  LeashGeometry,
  LeashSegment,
  LoopKind,
  SpritePose,
} from './types'

// Geometrie der Tuschelinie (DESIGN §9.3 Schritte 1–11, Schlaufen §9.5, Scroll-Abbildung §9.6).
// Rein, ohne DOM, deterministisch: gleiche Eingabe → byte-gleiche `outlineD`/`centerD` (Seed aus der Route).

interface Pt {
  x: number
  y: number
}

/** Abtastabstand nach Bogenlänge (Schritt 5) und LUT-Raster (Schritt 10). */
export const SAMPLE_STEP = 2
export const LUT_STEP = 4
/** Toleranz der Umriss-/Mittellinien-Vereinfachung (Schritt 8). */
const RDP_TOLERANCE = 0.2
/** Überlappung benachbarter Segmente (Schritt 9). */
const SEGMENT_OVERLAP = 2
/** Anfangs-/Endverjüngung (Schritt 7). */
const TAPER_START = 28
const TAPER_END = 18
/** Sicherheitsabstand der Rinnen-Schlaufen zur Rinnenkante (§9.5 Freiraum-Regel). */
const GUTTER_CLEARANCE = 2
/** Schlaufen, nach denen die Linie endet (Danke-Herz, 404-Knäuel, Haken am Knopf). */
const TERMINAL_LOOPS: readonly LoopKind[] = ['heart', 'coil', 'hook']

interface LoopMark {
  anchor: LeashAnchor
  kind: LoopKind
  /** Index der Wegpunkte (Anfang/Ende der Schlaufe). */
  i0: number
  i1: number
  dot: boolean
}

interface Plan {
  pts: Pt[]
  loops: LoopMark[]
}

/** Abgetastete Linie (Schritt 5–7) – für Tests und den späteren statischen Renderer. */
export interface LeashSamples {
  s: Float64Array
  x: Float64Array
  y: Float64Array
  w: Float64Array
}

// ---------- Schritt 1–3: Anker, Wegpunkte, Schlaufen ----------

function planPath(input: BuildInput, rand: () => number, rMax: number): Plan {
  const cfg = PRESET_CONFIG[input.preset]
  const { viewport, root, gutter } = input
  const desktop = viewport.w >= BP_TABLET
  const wide = viewport.w >= BP_DESKTOP
  const onRail = cfg.rail !== 'none'

  const sorted = [...input.anchors].sort((a, b) => a.y - b.y || a.x - b.x)
  const startAnchor = sorted.find((a) => a.kind === 'start')
  const endAnchor = sorted.find((a) => a.kind === 'end')
  const middle = sorted.filter((a) => a.kind !== 'start' && a.kind !== 'end')

  const fallbackX = onRail ? gutter / 2 : (desktop ? 24 : 16) + 8
  const start: Pt = startAnchor
    ? { x: startAnchor.x + startAnchor.w / 2, y: startAnchor.y + startAnchor.h }
    : { x: fallbackX, y: 0 }
  const railX = start.x

  const pts: Pt[] = []
  const loops: LoopMark[] = []
  const push = (p: Pt): number => {
    const last = pts[pts.length - 1]
    if (last && Math.hypot(p.x - last.x, p.y - last.y) < 0.5) return pts.length - 1
    pts.push(p)
    return pts.length - 1
  }
  const swayBase = 0.18 * gutter
  let swaySign = rand() < 0.5 ? 1 : -1

  // S-Kurve zwischen zwei Punkten: in der Rinne alternierender Schwung ±0.18 × Rinne (Schritt 2).
  const section = (to: Pt) => {
    const from = pts[pts.length - 1]!
    const dy = to.y - from.y
    const dist = Math.hypot(to.x - from.x, dy)
    if (onRail && dy > 48) {
      const n = Math.max(1, Math.round(dy / (300 + rand() * 120)))
      for (let k = 0; k < n; k++) {
        const t = (k + 0.5) / n
        push({
          x: from.x + (to.x - from.x) * t + swaySign * swayBase * (0.8 + 0.4 * rand()),
          y: from.y + dy * t,
        })
        swaySign = -swaySign
      }
    } else if (dist > 48) {
      // ruhiger Bogen ohne Rinne: leichte Auslenkung quer zur Richtung
      const bend = swaySign * Math.min(24, dist * 0.06) * (0.8 + 0.4 * rand())
      swaySign = -swaySign
      push({
        x: (from.x + to.x) / 2 + (-dy / dist) * bend,
        y: (from.y + to.y) / 2 + ((to.x - from.x) / dist) * bend,
      })
    }
    return push(to)
  }

  // Leinen-Anschluss (§9.8): Beginn an der Unterkante der Kopfleiste, 24-px-Kurve ins Preset.
  push(start)
  push({ x: start.x, y: start.y + 12 })

  for (const anchor of middle) {
    let kind: LoopKind = cfg.loops.includes(anchor.loop) ? anchor.loop : 'none'
    if (kind === 'lasso' && !wide) kind = cfg.loops.includes('right') ? 'right' : 'none'
    const loopPts = loopPoints(kind, anchor, {
      railX,
      onRail,
      desktop,
      gutter,
      rMax,
      rand,
    })
    if (loopPts.length === 0) {
      // Station ohne Schlaufe: kurzer Abschnitt auf der Linie als Stationsbereich.
      const x = onRail ? railX : anchor.x
      const i0 = section({ x, y: anchor.y })
      const i1 = push({ x, y: anchor.y + 24 })
      loops.push({ anchor, kind: 'none', i0, i1, dot: false })
      continue
    }
    const i0 = section(loopPts[0]!)
    let i1 = i0
    for (let k = 1; k < loopPts.length; k++) i1 = push(loopPts[k]!)
    loops.push({ anchor, kind, i0, i1, dot: true })
    if (TERMINAL_LOOPS.includes(kind)) return { pts, loops }
  }

  const end: Pt = endAnchor
    ? { x: endAnchor.x + endAnchor.w / 2, y: endAnchor.y }
    : { x: onRail ? railX : pts[pts.length - 1]!.x, y: root.h }
  section(end)
  return { pts, loops }
}

interface LoopCtx {
  railX: number
  onRail: boolean
  desktop: boolean
  gutter: number
  rMax: number
  rand: () => number
}

const DEG = Math.PI / 180

function rotate(p: Pt, c: Pt, a: number): Pt {
  const cos = Math.cos(a)
  const sin = Math.sin(a)
  const dx = p.x - c.x
  const dy = p.y - c.y
  return { x: c.x + dx * cos - dy * sin, y: c.y + dx * sin + dy * cos }
}

/** Punkte einer Schlaufenform (§9.5); leer bei `none`. Erster Punkt = Eintritt, letzter = Austritt. */
function loopPoints(kind: LoopKind, a: LeashAnchor, ctx: LoopCtx): Pt[] {
  const { railX, desktop, gutter, rMax, rand } = ctx
  const pts: Pt[] = []
  // Jede Form ist leicht verkippt und im Radius unruhig (±12 %), nie geometrisch perfekt.
  const tilt = (2 * rand() - 1) * 6 * DEG
  const squash = 0.9 + 0.08 * rand()
  // Radius-Unruhe als glattes Rauschen über dem Winkel (eine Delle je ~1,4 rad), nicht Punkt für Punkt.
  const rn = valueNoise1D(Math.floor(rand() * 4294967296))
  const jitter = (th: number) => 1 + 0.12 * rn(th / 1.4)
  switch (kind) {
    case 'right':
    case 'left': {
      // Tropfenschlaufe ~330° (im / gegen den Uhrzeigersinn), Mittelpunkt auf der Rinnenmitte.
      const dir = kind === 'right' ? 1 : -1
      const nominal = desktop ? 28 : Math.min(22, Math.max(14, 0.3 * gutter))
      const r = ctx.onRail ? Math.min(nominal, rMax / 1.12) : nominal
      const c = { x: ctx.onRail ? railX : a.x, y: a.y + r }
      const sweep = 330 * DEG
      const steps = 15
      for (let k = 0; k <= steps; k++) {
        const th = (sweep * k) / steps
        const rr = Math.min(r * jitter(th), ctx.onRail ? rMax : Infinity)
        const drift = (0.35 * r * th) / (2 * Math.PI)
        const p = { x: c.x + dir * rr * Math.sin(th), y: c.y - rr * squash * Math.cos(th) + drift }
        pts.push(rotate(p, c, tilt))
      }
      pts.push({ x: c.x, y: c.y + r + 16 })
      return pts
    }
    case 'spiral': {
      // 2,5 Windungen, Radius r → 0.4 r („Feder prüft die Tinte“), danach nach unten hinaus.
      const nominal = desktop ? 26 : 18
      const r = ctx.onRail ? Math.min(nominal, rMax / 1.12) : nominal
      const c = { x: ctx.onRail ? railX : a.x, y: a.y + r }
      const sweep = 5 * Math.PI
      const steps = 36
      for (let k = 0; k <= steps; k++) {
        const th = (sweep * k) / steps
        const rr = Math.min(r * (1 - (0.6 * th) / sweep) * jitter(th), ctx.onRail ? rMax : Infinity)
        const p = { x: c.x + rr * Math.sin(th), y: c.y - rr * squash * Math.cos(th) }
        pts.push(rotate(p, c, tilt))
      }
      pts.push({ x: c.x, y: c.y + r + 18 })
      return pts
    }
    case 'lasso':
      // Ellipse um die obere linke Ecke der Stationszeichnung, 1,1 Umläufe, rx 46, ry 34, −8°.
      return ellipse({ x: a.x, y: a.y }, 46, 34, -8 * DEG, 1.1, jitter, 24)
    case 'orbit': {
      // Ellipse um die Planet-Marke, 1 Umlauf, rx 0.9 w, ry 0.35 w, −14°.
      const w = Math.max(a.w, 8)
      return ellipse(
        { x: a.x + a.w / 2, y: a.y + a.h / 2 },
        0.9 * w,
        0.35 * w,
        -14 * DEG,
        1.04,
        jitter,
        24,
      )
    }
    case 'hook': {
      // Halbschlaufe (180°) um die linke Kante des Knopfs, Radius = halbe Knopfhöhe + 6.
      const R = a.h / 2 + 6
      const c = { x: a.x, y: a.y + a.h / 2 }
      for (let k = 0; k <= 10; k++) {
        const th = (Math.PI * k) / 10
        pts.push({ x: c.x - R * Math.sin(th), y: c.y - R * Math.cos(th) })
      }
      pts.push({ x: c.x + 6, y: c.y + R })
      return pts
    }
    case 'contour':
      return contour(a, rand)
    case 'heart': {
      // Herz 36 / 48 px in einem Zug, linke Rundung 8 % größer, endet in der Spitze mit 3 px Überstand.
      const size = desktop ? 48 : 36
      const k = size / 32
      const c = { x: a.x + a.w / 2, y: a.y + a.h / 2 }
      const steps = 32
      for (let i = 0; i <= steps; i++) {
        const t = Math.PI + (2 * Math.PI * i) / steps
        let x = 16 * Math.sin(t) ** 3
        let y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t))
        if (x < 0) {
          x *= 1.08
          y *= 1.04
        }
        pts.push({ x: c.x + x * k, y: c.y + y * k })
      }
      const tip = pts[pts.length - 1]!
      pts.push({ x: tip.x + 0.6, y: tip.y + 3 })
      return pts
    }
    case 'coil': {
      // 3 lockere, übereinanderliegende Schlingen am Boden (Breite 120 / 180).
      const W = desktop ? 180 : 120
      const r = W / 5.5
      const v = (W - 2 * r) / (6 * Math.PI)
      const x0 = a.x + a.w / 2 - W / 2
      const yb = a.y + a.h
      const steps = 48
      for (let k = 0; k <= steps; k++) {
        const t = (6 * Math.PI * k) / steps
        const rr = r * jitter(t)
        pts.push({ x: x0 + v * t + rr * Math.sin(t), y: yb - rr * 0.9 * (1 - Math.cos(t)) })
      }
      return pts
    }
    default:
      return pts
  }
}

function ellipse(
  c: Pt,
  rx: number,
  ry: number,
  tilt: number,
  turns: number,
  jitter: (th: number) => number,
  stepsPerTurn: number,
): Pt[] {
  const pts: Pt[] = []
  const steps = Math.round(stepsPerTurn * turns)
  for (let k = 0; k <= steps; k++) {
    const th = Math.PI + (2 * Math.PI * turns * k) / steps
    const j = jitter(th)
    pts.push(rotate({ x: c.x + rx * j * Math.cos(th), y: c.y + ry * j * Math.sin(th) }, c, tilt))
  }
  return pts
}

/** Wackeliges Rechteck mit Eckradius 14 im Abstand 10 px um eine Karte, 1 Umlauf + 8 px Überlappung. */
function contour(a: LeashAnchor, rand: () => number): Pt[] {
  const gap = 10
  const rad = 14
  const x0 = a.x - gap
  const y0 = a.y - gap
  const x1 = a.x + a.w + gap
  const y1 = a.y + a.h + gap
  const wob = () => (2 * rand() - 1) * 1.5
  const pts: Pt[] = []
  const edge = (ax: number, ay: number, bx: number, by: number) => {
    const len = Math.hypot(bx - ax, by - ay)
    const n = Math.max(1, Math.round(len / 36))
    for (let k = 0; k < n; k++) {
      const t = k / n
      pts.push({ x: ax + (bx - ax) * t + wob(), y: ay + (by - ay) * t + wob() })
    }
  }
  const corner = (cx: number, cy: number, from: number) => {
    for (let k = 0; k < 3; k++) {
      const th = from + (k * Math.PI) / 6
      pts.push({ x: cx + rad * Math.cos(th), y: cy + rad * Math.sin(th) })
    }
  }
  edge(x0 + rad, y0, x1 - rad, y0)
  corner(x1 - rad, y0 + rad, -Math.PI / 2)
  edge(x1, y0 + rad, x1, y1 - rad)
  corner(x1 - rad, y1 - rad, 0)
  edge(x1 - rad, y1, x0 + rad, y1)
  corner(x0 + rad, y1 - rad, Math.PI / 2)
  edge(x0, y1 - rad, x0, y0 + rad)
  corner(x0 + rad, y0 + rad, Math.PI)
  pts.push({ x: x0 + rad + 8, y: y0 + 0.5 })
  return pts
}

// ---------- Schritt 4: zentripetale Catmull-Rom-Kurve → kubische Bézier ----------

type Cubic = [number, number, number, number, number, number, number, number]

function catmullRom(pts: Pt[]): Cubic[] {
  const out: Cubic[] = []
  const n = pts.length
  const at = (i: number): Pt => {
    if (i < 0) return { x: 2 * pts[0]!.x - pts[1]!.x, y: 2 * pts[0]!.y - pts[1]!.y }
    if (i >= n)
      return { x: 2 * pts[n - 1]!.x - pts[n - 2]!.x, y: 2 * pts[n - 1]!.y - pts[n - 2]!.y }
    return pts[i]!
  }
  for (let i = 0; i < n - 1; i++) {
    const p0 = at(i - 1)
    const p1 = at(i)
    const p2 = at(i + 1)
    const p3 = at(i + 2)
    const d1 = Math.max(Math.sqrt(Math.hypot(p1.x - p0.x, p1.y - p0.y)), 1e-4)
    const d2 = Math.max(Math.sqrt(Math.hypot(p2.x - p1.x, p2.y - p1.y)), 1e-4)
    const d3 = Math.max(Math.sqrt(Math.hypot(p3.x - p2.x, p3.y - p2.y)), 1e-4)
    const a1 = 2 * d1 * d1 + 3 * d1 * d2 + d2 * d2
    const n1 = 3 * d1 * (d1 + d2)
    const a2 = 2 * d3 * d3 + 3 * d3 * d2 + d2 * d2
    const n2 = 3 * d3 * (d3 + d2)
    out.push([
      p1.x,
      p1.y,
      (d1 * d1 * p2.x - d2 * d2 * p0.x + a1 * p1.x) / n1,
      (d1 * d1 * p2.y - d2 * d2 * p0.y + a1 * p1.y) / n1,
      (d3 * d3 * p1.x - d2 * d2 * p3.x + a2 * p2.x) / n2,
      (d3 * d3 * p1.y - d2 * d2 * p3.y + a2 * p2.y) / n2,
      p2.x,
      p2.y,
    ])
  }
  return out
}

// ---------- Schritt 5: Abtasten nach Bogenlänge ----------

interface Fine {
  x: number[]
  y: number[]
  s: number[]
  /** Bogenlänge an jedem Wegpunkt (Anfang jeder Bézier-Kurve + Ende). */
  knot: number[]
}

function flatten(cubics: Cubic[]): Fine {
  const x: number[] = []
  const y: number[] = []
  const s: number[] = []
  const knot: number[] = []
  let len = 0
  for (let j = 0; j < cubics.length; j++) {
    const [x0, y0, x1, y1, x2, y2, x3, y3] = cubics[j]!
    const poly =
      Math.hypot(x1 - x0, y1 - y0) + Math.hypot(x2 - x1, y2 - y1) + Math.hypot(x3 - x2, y3 - y2)
    const n = Math.max(2, Math.ceil(poly / 0.75))
    if (j === 0) {
      x.push(x0)
      y.push(y0)
      s.push(0)
    }
    knot.push(len)
    for (let k = 1; k <= n; k++) {
      const t = k / n
      const u = 1 - t
      const b0 = u * u * u
      const b1 = 3 * u * u * t
      const b2 = 3 * u * t * t
      const b3 = t * t * t
      const px = b0 * x0 + b1 * x1 + b2 * x2 + b3 * x3
      const py = b0 * y0 + b1 * y1 + b2 * y2 + b3 * y3
      len += Math.hypot(px - x[x.length - 1]!, py - y[y.length - 1]!)
      x.push(px)
      y.push(py)
      s.push(len)
    }
  }
  knot.push(len)
  return { x, y, s, knot }
}

function resample(fine: Fine, step: number) {
  const total = fine.s[fine.s.length - 1]!
  const count = Math.floor(total / step) + 1
  const extra = total - (count - 1) * step > 1e-6 ? 1 : 0
  const n = count + extra
  const sx = new Float64Array(n)
  const sy = new Float64Array(n)
  const ss = new Float64Array(n)
  const tx = new Float64Array(n)
  const ty = new Float64Array(n)
  let j = 0
  for (let i = 0; i < n; i++) {
    const s = i < count ? i * step : total
    while (j < fine.s.length - 2 && fine.s[j + 1]! < s) j++
    const s0 = fine.s[j]!
    const s1 = fine.s[j + 1]!
    const t = s1 > s0 ? (s - s0) / (s1 - s0) : 0
    const dx = fine.x[j + 1]! - fine.x[j]!
    const dy = fine.y[j + 1]! - fine.y[j]!
    const d = Math.hypot(dx, dy) || 1
    sx[i] = fine.x[j]! + dx * t
    sy[i] = fine.y[j]! + dy * t
    ss[i] = s
    tx[i] = dx / d
    ty[i] = dy / d
  }
  return { sx, sy, ss, tx, ty, total }
}

// ---------- Schritt 8: Vereinfachung und Ausgabe ----------

function rdp(xs: number[], ys: number[], tol: number): number[] {
  const n = xs.length
  if (n <= 2) return Array.from({ length: n }, (_, i) => i)
  const keep = new Uint8Array(n)
  keep[0] = 1
  keep[n - 1] = 1
  const stack: [number, number][] = [[0, n - 1]]
  while (stack.length) {
    const [a, b] = stack.pop()!
    const ax = xs[a]!
    const ay = ys[a]!
    const dx = xs[b]! - ax
    const dy = ys[b]! - ay
    const len = Math.hypot(dx, dy)
    let maxD = 0
    let idx = -1
    for (let i = a + 1; i < b; i++) {
      const px = xs[i]! - ax
      const py = ys[i]! - ay
      const d = len > 1e-9 ? Math.abs(px * dy - py * dx) / len : Math.hypot(px, py)
      if (d > maxD) {
        maxD = d
        idx = i
      }
    }
    if (idx >= 0 && maxD > tol) {
      keep[idx] = 1
      stack.push([a, idx], [idx, b])
    }
  }
  const out: number[] = []
  for (let i = 0; i < n; i++) if (keep[i]) out.push(i)
  return out
}

/** Zahl mit höchstens 1 Nachkommastelle (Schritt 8), ohne `-0`. */
function fmt(n: number): string {
  const r = Math.round(n * 10) / 10
  return String(r === 0 ? 0 : r)
}

function polyD(xs: number[], ys: number[], close: boolean): string {
  let d = `M${fmt(xs[0]!)} ${fmt(ys[0]!)}L`
  for (let i = 1; i < xs.length; i++) d += `${i > 1 ? ' ' : ''}${fmt(xs[i]!)} ${fmt(ys[i]!)}`
  return close ? `${d}Z` : d
}

// ---------- Hauptfunktion ----------

/** `buildGeometry` plus die abgetasteten Punkte und Breiten (Tests, Stufe C). */
export function buildGeometryWithSamples(input: BuildInput): {
  geometry: LeashGeometry
  samples: LeashSamples
} {
  const cfg = PRESET_CONFIG[input.preset]
  const { viewport, baseWidth: bw } = input
  const desktop = viewport.w >= BP_TABLET
  const wob = cfg.wobble === 'calm' ? WOBBLE.calm : WOBBLE.normal
  const a1 = desktop ? wob.a1Desktop : wob.a1Mobile
  const a2 = wob.a2
  const maxHalfW = (1.35 * bw) / 2
  // Freiraum-Regel §9.5: Radius + halbe Linienbreite + 2 ≤ halbe Rinne – inklusive Wackel und Glättungsreserve.
  const rMax = Math.max(4, input.gutter / 2 - maxHalfW - GUTTER_CLEARANCE - (a1 + a2) - 0.5)

  const rand = mulberry32(input.seed)
  const plan = planPath(input, rand, rMax)
  if (plan.pts.length < 2) plan.pts.push({ x: plan.pts[0]!.x, y: plan.pts[0]!.y + 24 })
  const fine = flatten(catmullRom(plan.pts))
  const { sx, sy, ss, tx, ty, total } = resample(fine, SAMPLE_STEP)
  const n = ss.length

  // Schritt 6: Wackel entlang der Normalen.
  const n1 = valueNoise1D(input.seed ^ 0x9e3779b9)
  const n2 = valueNoise1D(input.seed ^ 0x85ebca6b)
  const n3 = valueNoise1D(input.seed ^ 0xc2b2ae35)
  const wx = new Float64Array(n)
  const wy = new Float64Array(n)
  for (let i = 0; i < n; i++) {
    const off = a1 * n1(ss[i]! / WOBBLE.lambda1) + a2 * n2(ss[i]! / WOBBLE.lambda2)
    wx[i] = sx[i]! - ty[i]! * off
    wy[i] = sy[i]! + tx[i]! * off
  }

  // Tangenten/Normalen der gewackelten Linie und Krümmung der geglätteten Linie.
  const nx = new Float64Array(n)
  const ny = new Float64Array(n)
  const ang = new Float64Array(n)
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - 1)
    const b = Math.min(n - 1, i + 1)
    let dx = wx[b]! - wx[a]!
    let dy = wy[b]! - wy[a]!
    if (Math.hypot(dx, dy) < 1e-6) {
      dx = tx[i]!
      dy = ty[i]!
    }
    const d = Math.hypot(dx, dy)
    nx[i] = -dy / d
    ny[i] = dx / d
    ang[i] = Math.atan2(dy, dx)
  }
  const theta = new Float64Array(n)
  let prevRaw = 0
  for (let i = 0; i < n; i++) {
    const t = Math.atan2(ty[i]!, tx[i]!)
    if (i === 0) theta[i] = t
    else {
      let d = t - prevRaw
      while (d > Math.PI) d -= 2 * Math.PI
      while (d < -Math.PI) d += 2 * Math.PI
      theta[i] = theta[i - 1]! + d
    }
    prevRaw = t
  }

  // Schritt 7: Breitenprofil mit Krümmungsverdickung, Grenzen und Verjüngungen.
  const w = new Float64Array(n)
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - 3)
    const b = Math.min(n - 1, i + 3)
    const kappa = b > a ? (theta[b]! - theta[a]!) / (ss[b]! - ss[a]! || 1) : 0
    const noise = (n3(ss[i]! / 220) + 1) / 2
    let width = bw * (0.85 + 0.3 * noise) * (1 + Math.min(0.25, 12 * Math.abs(kappa)))
    width = Math.min(1.35 * bw, Math.max(0.8 * bw, width))
    const s = ss[i]!
    if (s < TAPER_START) {
      const t = s / TAPER_START
      width *= 0.35 + 0.65 * (1 - (1 - t) * (1 - t))
    }
    if (total - s < TAPER_END) {
      const t = 1 - (total - s) / TAPER_END
      width *= 1 - 0.55 * t * t
    }
    w[i] = width
  }

  // Schritt 9: Segmente – Schnitt an Schlaufen-Enden und spätestens alle max(600, 1.25 × Viewport-Höhe).
  const knotLen = (i: number) => fine.knot[Math.min(i, fine.knot.length - 1)]!
  const maxLen = Math.max(600, 1.25 * viewport.h)
  const cuts = new Set<number>([0, total])
  for (const l of plan.loops) if (l.kind !== 'none') cuts.add(knotLen(l.i1))
  const sortedCuts = [...cuts].filter((c) => c >= 0 && c <= total).sort((a, b) => a - b)
  const bounds: number[] = [0]
  for (let k = 1; k < sortedCuts.length; k++) {
    const a = bounds[bounds.length - 1]!
    const b = sortedCuts[k]!
    if (b - a < 40 && b !== total) continue
    const parts = Math.ceil((b - a) / maxLen)
    for (let p = 1; p <= parts; p++) bounds.push(a + ((b - a) * p) / parts)
  }
  if (bounds.length > 2 && total - bounds[bounds.length - 2]! < 40)
    bounds.splice(bounds.length - 2, 1)

  const idxAt = (s: number) => Math.min(n - 1, Math.max(0, Math.round(s / SAMPLE_STEP)))
  const dots = plan.loops
    .filter((l) => l.dot)
    .map((l) => idxAt(knotLen(l.i0)))
    .filter((i) => ss[i]! > TAPER_START)

  const segments: LeashSegment[] = []
  for (let k = 0; k < bounds.length - 1; k++) {
    const i0 = idxAt(bounds[k]!)
    const i1 = k === bounds.length - 2 ? n - 1 : idxAt(bounds[k + 1]! + SEGMENT_OVERLAP)
    if (i1 <= i0) continue
    segments.push(buildSegment(`s${k}`, i0, i1, { wx, wy, nx, ny, ang, w, ss }, dots))
  }

  // Schritt 10: LUT je 4 px Bogenlänge.
  const lutCount = Math.floor(total / LUT_STEP) + 1
  const lut = new Float32Array(lutCount * 4)
  for (let k = 0; k < lutCount; k++) {
    const i = Math.min(n - 1, (k * LUT_STEP) / SAMPLE_STEP)
    lut[k * 4] = ss[i]!
    lut[k * 4 + 1] = wx[i]!
    lut[k * 4 + 2] = wy[i]!
    lut[k * 4 + 3] = ang[i]!
  }

  // Stationen und Schritt 11: Scroll-Abbildung.
  const stations = plan.loops
    .filter((l) => l.anchor.kind === 'station')
    .map((l) => {
      const loopLen0 = knotLen(l.i0)
      const loopLen1 = Math.max(knotLen(l.i1), loopLen0 + 1)
      return {
        id: l.anchor.id,
        pose: (l.anchor.pose ?? 'sitzen') as SpritePose,
        loopLen0,
        loopLen1,
        y: l.anchor.y,
        loop: l.kind,
      }
    })
  const scrollMap = buildScrollMap(input, stations, total)

  return {
    geometry: {
      segments,
      totalLength: total,
      lut,
      stations: stations.map(({ loop: _loop, ...s }) => s),
      scrollMap,
    },
    samples: { s: ss, x: wx, y: wy, w },
  }
}

/** Geometrie der Tuschelinie (DESIGN §9.3). */
export function buildGeometry(input: BuildInput): LeashGeometry {
  return buildGeometryWithSamples(input).geometry
}

interface SegmentData {
  wx: Float64Array
  wy: Float64Array
  nx: Float64Array
  ny: Float64Array
  ang: Float64Array
  w: Float64Array
  ss: Float64Array
}

function buildSegment(
  id: string,
  i0: number,
  i1: number,
  d: SegmentData,
  dots: number[],
): LeashSegment {
  const lx: number[] = []
  const ly: number[] = []
  const rx: number[] = []
  const ry: number[] = []
  const cx: number[] = []
  const cy: number[] = []
  for (let i = i0; i <= i1; i++) {
    const h = d.w[i]! / 2
    lx.push(d.wx[i]! + d.nx[i]! * h)
    ly.push(d.wy[i]! + d.ny[i]! * h)
    rx.push(d.wx[i]! - d.nx[i]! * h)
    ry.push(d.wy[i]! - d.ny[i]! * h)
    cx.push(d.wx[i]!)
    cy.push(d.wy[i]!)
  }
  const keepL = rdp(lx, ly, RDP_TOLERANCE)
  const keepR = rdp(rx, ry, RDP_TOLERANCE)
  const ox: number[] = []
  const oy: number[] = []
  for (const k of keepL) {
    ox.push(lx[k]!)
    oy.push(ly[k]!)
  }
  // Runde Kappe am Ende (Halbkreis, 8 Punkte inkl. der Kanten).
  const cap = (i: number, fromAngle: number, sign: number) => {
    const h = d.w[i]! / 2
    for (let k = 1; k <= 6; k++) {
      const a = fromAngle + (sign * k * Math.PI) / 7
      ox.push(d.wx[i]! + Math.cos(a) * h)
      oy.push(d.wy[i]! + Math.sin(a) * h)
    }
  }
  cap(i1, Math.atan2(d.ny[i1]!, d.nx[i1]!), -1)
  for (let j = keepR.length - 1; j >= 0; j--) {
    ox.push(rx[keepR[j]!]!)
    oy.push(ry[keepR[j]!]!)
  }
  cap(i0, Math.atan2(d.ny[i0]!, d.nx[i0]!) + Math.PI, -1)
  let outlineD = polyD(ox, oy, true)

  // Tintenpunkte an Schlaufen-Starts (Feder ruht kurz), Radius 0.65 × Breite.
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  const extend = (x: number, y: number) => {
    if (x < minX) minX = x
    if (y < minY) minY = y
    if (x > maxX) maxX = x
    if (y > maxY) maxY = y
  }
  for (let k = 0; k < ox.length; k++) extend(ox[k]!, oy[k]!)
  // Umlaufsinn des Umrisses (Shoelace): Tintenpunkte laufen gleich herum, sonst stanzt `nonzero` ein Loch.
  let area = 0
  for (let k = 0, j = ox.length - 1; k < ox.length; j = k++)
    area += ox[j]! * oy[k]! - ox[k]! * oy[j]!
  const turn = area >= 0 ? 1 : -1
  for (const i of dots) {
    if (i < i0 || i >= i1) continue
    const r = 0.65 * d.w[i]!
    const px: number[] = []
    const py: number[] = []
    for (let k = 0; k < 12; k++) {
      const a = (turn * k * Math.PI) / 6
      px.push(d.wx[i]! + Math.cos(a) * r)
      py.push(d.wy[i]! + Math.sin(a) * r)
      extend(px[k]!, py[k]!)
    }
    outlineD += polyD(px, py, true)
  }

  const keepC = rdp(cx, cy, RDP_TOLERANCE)
  const centerD = polyD(
    keepC.map((k) => cx[k]!),
    keepC.map((k) => cy[k]!),
    false,
  )
  const x = Math.floor(minX)
  const y = Math.floor(minY)
  return {
    id,
    bbox: { x, y, w: Math.ceil(maxX) - x, h: Math.ceil(maxY) - y },
    centerD,
    outlineD,
    len0: d.ss[i0]!,
    len1: d.ss[i1]!,
  }
}

function buildScrollMap(
  input: BuildInput,
  stations: { y: number; loopLen0: number; loopLen1: number; loop: LoopKind }[],
  total: number,
): { readingY: number; len: number }[] {
  const raw: { readingY: number; len: number }[] = [{ readingY: 0, len: 0 }]
  if (isScrollCoupled(input.preset)) {
    for (const s of stations) {
      raw.push({ readingY: s.y, len: s.loopLen0 })
      raw.push({ readingY: s.y + loopScroll(s.loop, input.viewport.w), len: s.loopLen1 })
    }
  }
  raw.push({ readingY: input.root.h, len: total })
  // Beide Spalten streng monoton: zu dichte oder rückläufige Punkte werden verschoben bzw. ausgelassen.
  const out: { readingY: number; len: number }[] = [raw[0]!]
  for (let k = 1; k < raw.length; k++) {
    const prev = out[out.length - 1]!
    const p = raw[k]!
    const last = k === raw.length - 1
    let readingY = Math.max(p.readingY, prev.readingY + 1)
    let len = Math.min(total, Math.max(p.len, prev.len + 0.01))
    if (last) {
      readingY = Math.max(readingY, prev.readingY + 1)
      len = total
      if (len <= prev.len) out.pop()
    } else if (len >= total) continue
    out.push({ readingY, len })
  }
  if (out.length < 2) out.push({ readingY: Math.max(1, input.root.h), len: total })
  return out
}

/** Stückweise lineare Abbildung Lesezeile → Bogenlänge (§9.6); `readingY` relativ zum Seitencontainer. */
export function mapReadingY(scrollMap: LeashGeometry['scrollMap'], readingY: number): number {
  const first = scrollMap[0]
  if (!first) return 0
  if (readingY <= first.readingY) return first.len
  for (let k = 1; k < scrollMap.length; k++) {
    const b = scrollMap[k]!
    if (readingY <= b.readingY) {
      const a = scrollMap[k - 1]!
      return a.len + ((readingY - a.readingY) / (b.readingY - a.readingY)) * (b.len - a.len)
    }
  }
  return scrollMap[scrollMap.length - 1]!.len
}

/** Punkt auf der Linie bei Bogenlänge `len` aus der LUT (für Coco), linear interpoliert. */
export function pointAt(lut: Float32Array, len: number): { x: number; y: number; angle: number } {
  const count = lut.length / 4
  if (count === 0) return { x: 0, y: 0, angle: 0 }
  const f = Math.max(0, Math.min(count - 1, len / LUT_STEP))
  const k = Math.floor(f)
  const t = f - k
  const k2 = Math.min(count - 1, k + 1)
  const lerp = (o: number) => lut[k * 4 + o]! + (lut[k2 * 4 + o]! - lut[k * 4 + o]!) * t
  return { x: lerp(1), y: lerp(2), angle: lut[k * 4 + 3]! }
}
