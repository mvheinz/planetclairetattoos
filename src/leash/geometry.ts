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
  LeashStroke,
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
/** Stufe A: Stücke der Mittellinie, deren Breite höchstens so weit vom Stückanfang abweicht (× Grundbreite). */
const STROKE_WIDTH_TOL = 0.07
/** Stufe A: Toleranz der Vereinfachung der Strich-Stücke (die Mittellinie ist bereits gewackelt). */
const STROKE_RDP_TOLERANCE = 0.34
/** Stufe A: längstes Stück in px Bogenlänge. */
const STROKE_MAX_LEN = 240
/** Anfangs-/Endverjüngung (Schritt 7). */
const TAPER_START = 28
const TAPER_END = 18
/** Federansatz bzw. Abheben: die ersten/letzten 4 px ruht die Feder auf der Ansatz-/Abhebebreite (LQ-05). */
const TAPER_REST = 4
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
  /** Glatte Linie vor dem Wackel (Schritt 5) – Bezug für KUNST-QA LQ-03. */
  sx: Float64Array
  sy: Float64Array
}

// ---------- Schritt 1–3: Anker, Wegpunkte, Schlaufen ----------

/** Schnur `shopString` (§9.7): Überstand am Reihenende und Toleranz für „gleiche Reihe“. */
export const STRING_OVERHANG = 12
const ROW_TOLERANCE = 12

/** Durchhang zwischen zwei Aufhängepunkten (§9.7): `clamp(4, 0.03 × Abstand, 14)` px. */
export function stringSag(distance: number): number {
  return Math.min(14, Math.max(4, 0.03 * distance))
}

/** Faden-Anker (`kind = 'tag'`) zu Reihen gruppiert (oben → unten, je Reihe links → rechts). */
export function stringRows(anchors: readonly LeashAnchor[]): { y: number; xs: number[] }[] {
  const tags = anchors
    .filter((a) => a.kind === 'tag')
    .map((a) => ({ x: a.x + a.w / 2, y: a.y }))
    .sort((a, b) => a.y - b.y || a.x - b.x)
  const rows: { y: number; xs: number[] }[] = []
  for (const t of tags) {
    const row = rows[rows.length - 1]
    if (row && Math.abs(t.y - row.y) <= ROW_TOLERANCE) row.xs.push(t.x)
    else rows.push({ y: t.y, xs: [t.x] })
  }
  for (const row of rows) row.xs.sort((a, b) => a - b)
  return rows
}

/**
 * Preset `shopString` (§9.7, KO-07/KO-08): Die Linie wird zur Schnur. Sie beginnt am Start-Anker (Coco über der ersten
 * Reihe), läuft im Seitenrand hinunter zur ersten Reihe und dann durch die Faden-Anker aller Karten einer Reihe –
 * zwischen zwei Ankern mit Durchhang –, am Reihenende 12 px über das Raster hinaus, in einer Kurve (Radius ≤ Seitenrand)
 * im Rand hinunter zur nächsten Reihe, die in Gegenrichtung läuft (Serpentine). Die Reihen werden als „Stationen“
 * `row-<n>` gemeldet (Bogenlänge vom Ende der vorigen Reihe bis zum Ende dieser Reihe) – damit zeichnet die Laufzeit je
 * Reihe beim Eintritt (`draw: 'rowEnter'`) und behält gezeichnete Reihen beim Neuaufbau.
 * Rastergrenzen: Anker `kind = 'target'` (volle Rasterbreite), sonst aus den Faden-Ankern geschätzt.
 */
function planShopString(input: BuildInput): Plan {
  const { root } = input
  const startAnchor = input.anchors.find((a) => a.kind === 'start')
  const bounds = input.anchors.find((a) => a.kind === 'target')
  const rows = stringRows(input.anchors)
  const pts: Pt[] = []
  const loops: LoopMark[] = []
  const push = (p: Pt) => pts.push(p) - 1
  /** Gerade senkrecht im Rand: Zwischenpunkte alle ≤ 60 px, damit der Spline nicht nach außen ausbaucht. */
  const straightDown = (x: number, fromY: number, toY: number) => {
    const n = Math.floor((toY - fromY) / 60)
    for (let k = 1; k <= n; k++) push({ x, y: fromY + ((toY - fromY) * k) / (n + 1) })
  }
  const start: Pt = startAnchor
    ? { x: startAnchor.x + startAnchor.w / 2, y: startAnchor.y + startAnchor.h }
    : { x: 24, y: 0 }
  push(start)
  if (rows.length === 0) {
    // Ohne Karten nur der Leinen-Anschluss (§9.8): kurzes Stück nach unten.
    push({ x: start.x, y: start.y + 24 })
    return { pts, loops }
  }
  const gridLeft = bounds ? bounds.x : 16
  const gridRight = bounds ? bounds.x + bounds.w : root.w - 16
  // Seitenrand links/rechts des Rasters: Überstand 12 px, aber nie über den Rand der Linien-Ebene hinaus.
  const margin = (edge: number, dir: 1 | -1) => {
    const room = dir > 0 ? root.w - edge : edge
    return edge + dir * Math.max(2, Math.min(STRING_OVERHANG, room - 6))
  }
  const sideX: Record<'left' | 'right', number> = {
    left: margin(gridLeft, -1),
    right: margin(gridRight, 1),
  }
  // Kurvenradius im Rand: höchstens der Überstand (≤ Seitenrand), höchstens 10 px.
  const radius = (side: 'left' | 'right') =>
    Math.min(10, side === 'left' ? gridLeft - sideX.left : sideX.right - gridRight)

  // Vom Start (Coco) in den linken Rand und hinunter bis kurz vor die erste Reihe.
  let side: 'left' | 'right' = 'left'
  const firstY = rows[0]!.y
  const rStart = radius('left')
  if (firstY - start.y > 3 * rStart) {
    push({ x: (start.x + sideX.left) / 2, y: start.y + Math.min(14, (firstY - start.y) / 4) })
    const y0 = Math.min(firstY - rStart, start.y + 28)
    push({ x: sideX.left, y: y0 })
    straightDown(sideX.left, y0, firstY - rStart)
  }
  let prevEnd = 0
  rows.forEach((row, k) => {
    const dir: 1 | -1 = side === 'left' ? 1 : -1
    const r = radius(side)
    const x0 = sideX[side]
    // Kurve aus dem Rand in die Reihe.
    push({ x: x0, y: row.y - r })
    push({ x: x0 + dir * r * 0.35, y: row.y - r * 0.35 })
    const xs = dir > 0 ? row.xs : [...row.xs].reverse()
    const exitSide: 'left' | 'right' = side === 'left' ? 'right' : 'left'
    const exitX = sideX[exitSide]
    const next = rows[k + 1]
    const r2 = radius(exitSide)
    // Letzter Punkt der Reihe: mit Folgereihe kurz vor der Kurve, sonst das Schnurende im Rand (Überstand).
    const hang = [x0 + dir * r, ...xs, next ? exitX - dir * r2 : exitX]
    for (let i = 0; i < hang.length; i++) {
      const x = hang[i]!
      if (i > 0) {
        const px = hang[i - 1]!
        push({ x: (px + x) / 2, y: row.y + stringSag(Math.abs(x - px)) })
      }
      push({ x, y: row.y })
    }
    const i1 = pts.length - 1
    loops.push({
      anchor: { id: `row-${k}`, kind: 'station', x: 0, y: row.y, w: 0, h: 0, loop: 'none' },
      kind: 'none',
      i0: prevEnd,
      i1,
      dot: false,
    })
    prevEnd = i1
    if (next) {
      // Kurve im Rand hinunter zur nächsten Reihe (Serpentine).
      push({ x: exitX - dir * r2 * 0.35, y: row.y + r2 * 0.35 })
      push({ x: exitX, y: row.y + r2 })
      straightDown(exitX, row.y + r2, next.y - r2)
    }
    side = exitSide
  })
  return { pts, loops }
}

function planPath(input: BuildInput, rand: () => number, rMax: number): Plan {
  if (input.preset === 'shopString') return planShopString(input)
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
    // Kontur: erst auf der Rinne bis kurz vor die Zeichnung, dann hinein – sonst läuft die Linie diagonal durch den Text
    if (onRail && kind === 'contour') section({ x: railX, y: loopPts[0]!.y - 40 })
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
  const phase = rand() * 2 * Math.PI
  // Plus eine Vierer-Welle (kein Kegelschnitt kann sie glätten) – zusammen höchstens ±12 %.
  const jitter = (th: number) => 1 + 0.12 * (0.35 * rn(th / 1.4) + 0.65 * Math.sin(4 * th + phase))
  switch (kind) {
    case 'right':
    case 'left':
    case 'spiral': {
      // Tropfenschlaufe ~330° (rechts im / links gegen den Uhrzeigersinn) bzw. Spirale mit 2,5 Windungen (Radius
      // r → 0.4 r, „Feder prüft die Tinte“), Mittelpunkt auf der Rinnenmitte, danach nach unten hinaus.
      const sp = kind === 'spiral'
      const dir = kind === 'left' ? -1 : 1
      const nominal = sp
        ? desktop
          ? 26
          : 18
        : desktop
          ? 28
          : Math.min(22, Math.max(14, 0.3 * gutter))
      const r = ctx.onRail ? Math.min(nominal, rMax / 1.12) : nominal
      const c = { x: ctx.onRail ? railX : a.x, y: a.y + r }
      const sweep = sp ? 5 * Math.PI : 330 * DEG
      const steps = sp ? 36 : 15
      for (let k = 0; k <= steps; k++) {
        const th = (sweep * k) / steps
        const rr = Math.min(
          r * (sp ? 1 - (0.6 * th) / sweep : 1) * jitter(th),
          ctx.onRail ? rMax : Infinity,
        )
        const drift = sp ? 0 : (0.35 * r * th) / (2 * Math.PI)
        const p = { x: c.x + dir * rr * Math.sin(th), y: c.y - rr * squash * Math.cos(th) + drift }
        pts.push(rotate(p, c, tilt))
      }
      pts.push({ x: c.x, y: c.y + r + (sp ? 18 : 16) })
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
    // Achsen mit versetzter Unruhe: die Hand zieht die Ellipse nie gleichmäßig (LQ-04).
    pts.push(
      rotate(
        { x: c.x + rx * jitter(th) * Math.cos(th), y: c.y + ry * jitter(th + 1.1) * Math.sin(th) },
        c,
        tilt,
      ),
    )
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
  const mirror = (a: Pt, b: Pt): Pt => ({ x: 2 * a.x - b.x, y: 2 * a.y - b.y })
  const at = (i: number): Pt =>
    i < 0 ? mirror(pts[0]!, pts[1]!) : i >= n ? mirror(pts[n - 1]!, pts[n - 2]!) : pts[i]!
  const chord = (a: Pt, b: Pt) => Math.max(Math.sqrt(Math.hypot(a.x - b.x, a.y - b.y)), 1e-4)
  for (let i = 0; i < n - 1; i++) {
    const p0 = at(i - 1)
    const p1 = at(i)
    const p2 = at(i + 1)
    const p3 = at(i + 2)
    const d1 = chord(p1, p0)
    const d2 = chord(p2, p1)
    const d3 = chord(p3, p2)
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

function rdp(xs: ArrayLike<number>, ys: ArrayLike<number>, tol: number): number[] {
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
  return String(Math.round(n * 10) / 10 || 0)
}

/** Offene Polylinie als `M x y l dx dy …` (relativ, aus den gerundeten Koordinaten – kürzer als absolut). */
function relD(xs: number[], ys: number[]): string {
  let px = +fmt(xs[0]!)
  let py = +fmt(ys[0]!)
  let d = `M${fmt(px)} ${fmt(py)}l`
  for (let i = 1; i < xs.length; i++) {
    const x = +fmt(xs[i]!)
    const y = +fmt(ys[i]!)
    const dx = fmt(x - px)
    const dy = fmt(y - py)
    d += `${i > 1 && !dx.startsWith('-') ? ' ' : ''}${dx}${dy.startsWith('-') ? '' : ' '}${dy}`
    px = x
    py = y
  }
  return d
}

function polyD(xs: ArrayLike<number>, ys: ArrayLike<number>, close: boolean): string {
  let d = `M${fmt(xs[0]!)} ${fmt(ys[0]!)}L`
  for (let i = 1; i < xs.length; i++) d += `${i > 1 ? ' ' : ''}${fmt(xs[i]!)} ${fmt(ys[i]!)}`
  return close ? `${d}Z` : d
}

// ---------- Hauptfunktion ----------

type GeometryResult = { geometry: LeashGeometry; samples: LeashSamples }

/**
 * `buildGeometry` in Teilstücken (DESIGN §9.10 „bei 4× Drosselung in Idle-Teilstücken, kein Task > 50 ms“): Der
 * Generator hält nach jedem Schritt bzw. Segment an; die Laufzeit führt jedes Teilstück in einem eigenen Idle-Callback
 * aus. Das Ergebnis ist identisch mit {@link buildGeometryWithSamples}.
 */
export function* geometrySteps(input: BuildInput): Generator<void, GeometryResult, void> {
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
  yield
  const { sx, sy, ss, tx, ty, total } = resample(fine, SAMPLE_STEP)
  const n = ss.length

  yield
  // Schritt 6: Wackel entlang der Normalen.
  const n1 = valueNoise1D(input.seed ^ 0x9e3779b9, true)
  const n2 = valueNoise1D(input.seed ^ 0x85ebca6b, true)
  const n3 = valueNoise1D(input.seed ^ 0xc2b2ae35)
  const wx = new Float64Array(n)
  const wy = new Float64Array(n)
  for (let i = 0; i < n; i++) {
    // Die Feder setzt genau am Leinen-Anschluss an (§9.8); das Zittern wächst über die Anfangsverjüngung hinein.
    const fade = Math.min(1, ss[i]! / TAPER_START)
    const off = fade * (a1 * n1(ss[i]! / WOBBLE.lambda1) + a2 * n2(ss[i]! / WOBBLE.lambda2))
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

  // Schritt 7: Breitenprofil mit Krümmungsverdickung, Grenzen und Verjüngungen.
  const w = new Float64Array(n)
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - 3)
    const b = Math.min(n - 1, i + 3)
    // Winkeländerung der geglätteten Tangente (Kreuz-/Skalarprodukt statt aufgerolltem Winkel).
    const dTheta = Math.atan2(tx[a]! * ty[b]! - ty[a]! * tx[b]!, tx[a]! * tx[b]! + ty[a]! * ty[b]!)
    const kappa = b > a ? dTheta / (ss[b]! - ss[a]! || 1) : 0
    const noise = (n3(ss[i]! / 220) + 1) / 2
    let width = bw * (0.85 + 0.3 * noise) * (1 + Math.min(0.25, 12 * Math.abs(kappa)))
    width = Math.min(1.35 * bw, Math.max(0.8 * bw, width))
    const s = ss[i]!
    // Federansatz: 4 px Ruhe auf 0,35, dann ease-out auf die volle Breite (bis 28 px). Abheben: ease-in auf 0,45,
    // die letzten 4 px auf 0,45. In den Verjüngungen gilt die Grundbreite (keine Krümmungszuschläge an der Spitze).
    if (s < TAPER_START) {
      const t = Math.max(0, (s - TAPER_REST) / (TAPER_START - TAPER_REST))
      const e = 1 - (1 - t) * (1 - t)
      width = bw + (width - bw) * e
      width *= 0.35 + 0.65 * e
    }
    if (total - s < TAPER_END) {
      const t = Math.min(1, (TAPER_END - (total - s)) / (TAPER_END - TAPER_REST))
      const e = t * t
      width = width + (bw - width) * e
      width *= 1 - 0.55 * e
    }
    w[i] = width
  }

  yield
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
    segments.push(buildSegment(`s${k}`, i0, i1, { wx, wy, nx, ny, ang, w, ss }, dots, bw))
    yield
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
    samples: { s: ss, x: wx, y: wy, w, sx, sy },
  }
}

/** `buildGeometry` plus die abgetasteten Punkte und Breiten (Tests, Stufe C). */
export function buildGeometryWithSamples(input: BuildInput): GeometryResult {
  const steps = geometrySteps(input)
  for (;;) {
    const r = steps.next()
    if (r.done) return r.value
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

/** Länge einer Polylinie aus den gerundeten Koordinaten (wie der Browser sie misst). */
function polyLen(xs: ArrayLike<number>, ys: ArrayLike<number>): number {
  let L = 0
  for (let k = 1; k < xs.length; k++)
    L += Math.hypot(+fmt(xs[k]!) - +fmt(xs[k - 1]!), +fmt(ys[k]!) - +fmt(ys[k - 1]!))
  return Math.round(L * 100) / 100
}

/**
 * Stufe A „Tusche“ ohne Maske (DESIGN §9.4): die gewackelte Mittellinie in Stücken, in denen die Breite fast gleich
 * bleibt (± {@link STROKE_WIDTH_TOL} × Grundbreite); jedes Stück wird als runder Strich mit seiner mittleren Breite
 * gezeichnet und per `stroke-dashoffset` enthüllt (nur Paint, kein Layout – KUNST-QA PF-05). Benachbarte Stücke teilen
 * den Endpunkt, die runden Kappen überdecken die Fuge. Tintenpunkte sind eigene, fast punktförmige Stücke.
 */
function buildStrokes(i0: number, i1: number, d: SegmentData, dots: number[], bw: number) {
  const out: LeashStroke[] = []
  const tol = STROKE_WIDTH_TOL * bw
  const stops = new Set(dots.filter((i) => i >= i0 && i < i1))
  let a = i0
  while (a < i1) {
    const w0 = d.w[a]!
    let b = a + 1
    // Stück endet an einem Tintenpunkt, damit er an der Stückgrenze (Strich → Punkt → nächster Strich) erscheint
    while (
      b < i1 &&
      !stops.has(b) &&
      Math.abs(d.w[b + 1]! - w0) <= tol &&
      d.ss[b + 1]! - d.ss[a]! <= STROKE_MAX_LEN
    )
      b++
    const xs: number[] = []
    const ys: number[] = []
    let sum = 0
    for (let i = a; i <= b; i++) {
      xs.push(d.wx[i]!)
      ys.push(d.wy[i]!)
      sum += d.w[i]!
    }
    const keep = rdp(xs, ys, STROKE_RDP_TOLERANCE)
    const kx = keep.map((k) => xs[k]!)
    const ky = keep.map((k) => ys[k]!)
    out.push({
      d: relD(kx, ky),
      w: Math.round((sum / (b - a + 1)) * 10) / 10,
      L: polyLen(kx, ky),
      len0: d.ss[a]!,
      len1: d.ss[b]!,
    })
    // Tintenpunkt am Schlaufenstart: Strich der Länge 0,1 mit runder Kappe (Ø 1,3 × Breite).
    if (stops.has(b))
      out.push({
        d: `M${fmt(d.wx[b]!)} ${fmt(d.wy[b]!)}h0.1`,
        w: Math.round(1.3 * d.w[b]! * 10) / 10,
        L: 0.1,
        len0: d.ss[b]!,
        len1: d.ss[b]!,
      })
    a = b
  }
  return out
}

function buildSegment(
  id: string,
  i0: number,
  i1: number,
  d: SegmentData,
  dots: number[],
  bw: number,
): LeashSegment {
  // Bbox aus der Mittellinie ± halber Breite bzw. Tintenpunkt-Radius (umschließt Umriss und Striche).
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  const grow = (x: number, y: number, h: number) => {
    minX = Math.min(minX, x - h)
    minY = Math.min(minY, y - h)
    maxX = Math.max(maxX, x + h)
    maxY = Math.max(maxY, y + h)
  }
  const cx = d.wx.slice(i0, i1 + 1)
  const cy = d.wy.slice(i0, i1 + 1)
  for (let i = i0; i <= i1; i++) grow(d.wx[i]!, d.wy[i]!, d.w[i]! / 2 + 0.5)
  const segDots = dots.filter((i) => i >= i0 && i < i1)
  for (const i of segDots) grow(d.wx[i]!, d.wy[i]!, 0.65 * d.w[i]! + 0.5)
  const keepC = rdp(cx, cy, RDP_TOLERANCE)
  const ccx = keepC.map((k) => cx[k]!)
  const ccy = keepC.map((k) => cy[k]!)
  const centerD = polyD(ccx, ccy, false)
  const strokes = buildStrokes(i0, i1, d, segDots, bw)
  const x = Math.floor(minX)
  const y = Math.floor(minY)
  // Der Umriss (Stufe C, Schritt 8) entsteht erst beim ersten Zugriff – Stufe A/B brauchen ihn nicht (PF-04).
  let outline: string | null = null
  return {
    id,
    bbox: { x, y, w: Math.ceil(maxX) - x, h: Math.ceil(maxY) - y },
    centerD,
    get outlineD() {
      return (outline ??= outlineOf(i0, i1, d, segDots))
    },
    len0: d.ss[i0]!,
    len1: d.ss[i1]!,
    centerL: polyLen(ccx, ccy),
    strokes,
  }
}

/** Schritt 8: gefüllter Umriss mit runden Kappen und Tintenpunkten (Kreis, Radius 0.65 × Breite). */
function outlineOf(i0: number, i1: number, d: SegmentData, dots: number[]): string {
  const side = (sign: number) => {
    const xs: number[] = []
    const ys: number[] = []
    for (let i = i0; i <= i1; i++) {
      const h = (sign * d.w[i]!) / 2
      xs.push(d.wx[i]! + d.nx[i]! * h)
      ys.push(d.wy[i]! + d.ny[i]! * h)
    }
    return { xs, ys, keep: rdp(xs, ys, RDP_TOLERANCE) }
  }
  const L = side(1)
  const R = side(-1)
  const ox = L.keep.map((k) => L.xs[k]!)
  const oy = L.keep.map((k) => L.ys[k]!)
  // Runde Kappe am Ende (Halbkreis, 8 Punkte inkl. der Kanten).
  const cap = (i: number, fromAngle: number) => {
    const h = d.w[i]! / 2
    for (let k = 1; k <= 6; k++) {
      const a = fromAngle - (k * Math.PI) / 7
      ox.push(d.wx[i]! + Math.cos(a) * h)
      oy.push(d.wy[i]! + Math.sin(a) * h)
    }
  }
  cap(i1, Math.atan2(d.ny[i1]!, d.nx[i1]!))
  for (const k of R.keep.reverse()) {
    ox.push(R.xs[k]!)
    oy.push(R.ys[k]!)
  }
  cap(i0, Math.atan2(d.ny[i0]!, d.nx[i0]!) + Math.PI)
  let outlineD = polyD(ox, oy, true)
  // Der Umriss läuft immer im Uhrzeigersinn (links vorwärts, rechts zurück): Tintenpunkte laufen gleich herum,
  // sonst stanzt `nonzero` ein Loch.
  for (const i of dots) {
    const r = 0.65 * d.w[i]!
    const px: number[] = []
    const py: number[] = []
    for (let k = 0; k < 12; k++) {
      const a = (-k * Math.PI) / 6
      px.push(d.wx[i]! + Math.cos(a) * r)
      py.push(d.wy[i]! + Math.sin(a) * r)
    }
    outlineD += polyD(px, py, true)
  }
  return outlineD
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
  } else if (PRESET_CONFIG[input.preset].draw === 'rowEnter') {
    // Treppe: erreicht die Eintrittslinie eine Reihe, gilt sie als ganz gezeichnet (Laufzeit animiert 500 ms).
    for (const s of stations) {
      raw.push({ readingY: s.y, len: s.loopLen0 })
      // knapp unter der Gesamtlänge, sonst entfiele die Stufe der letzten Reihe (nur der Endpunkt darf `total` sein)
      raw.push({ readingY: s.y + 1, len: Math.min(s.loopLen1, total - 0.02) })
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
