// Handlinie für Platzhalter-Zeichnungen (PLAN P8.12, DESIGN §12.3, SEED-SPEC §4.2): macht aus gezeichneten
// Bezier-Kontrollpunkten (Motiv-Skizzen `content/art/placeholders/{typ}-{n}.ts`) einen Tuschestrich wie in Juttas
// Skizzen (`content/art/jutta-skizzen/README.md`): Monoline 2.4, gesäter Wackel quer zur Richtung, offene Enden und
// Absetzer statt geschlossener Konturen, 1–2 Doppelkonturen, Schatten aus 5–7 Schraffurstrichen unter 40°, eine flache
// Wash-Fläche um 3–4 Einheiten nach rechts unten versetzt. Nur kleine Punkte (Pupillen, Nase) sind schwarz gefüllt.
// Deterministisch: gleicher Schlüssel → byte-gleiches SVG (kein Math.random, keine Zeit).
import { fnv1a32, mulberry32, valueNoise1D } from '../../../src/leash/random'

export type Pt = readonly [number, number]

/** Ein gezeichneter Strich: SVG-Pfad aus M/L/Q/C/S/Z (absolut oder relativ) – nur Kontrollpunkte, keine Formen. */
export type StrokeSpec =
  | string
  | {
      d: string
      /** Doppelt nachgezogen (Versatz 1–1,5 Einheiten, 50–80 % der Länge). */
      double?: boolean
      /** Kein automatischer Absetzer und keine Lücke (z. B. für winzige Details). */
      exact?: boolean
    }

/** Bausteine einer Zeichnung (auch für wiederverwendbare Figuren wie Hasen, Fuchs, Coco). */
export interface Ink {
  strokes: StrokeSpec[]
  /** Kleine schwarz gefüllte Flächen (Pupillen, Nase, Ballen) als geschlossene Pfade. */
  dots?: string[]
  /** Glanzpunkte in Papierfarbe auf den Pupillen (geschlossene Pfade). */
  lights?: string[]
  /** Kleine Flächen im roten Geschirr-Ton (nur Coco, DESIGN §10.1). */
  harness?: string[]
}

export interface Motif extends Ink {
  /** Neigung des ganzen Motivs in Grad (±3, DESIGN §12.3). */
  tilt: number
  /** Umriss der einen Wash-Fläche (geschlossener Pfad); fehlt bei Flash-Platzhaltern. */
  wash?: string
  /** Schatten: 5–7 Schraffurstriche unter 40° entlang einer Grundlinie ab `x`/`y` über `w` Einheiten. */
  shadow?: { x: number; y: number; w: number; count?: 5 | 6 | 7; len?: number }
  /** Eingebettete Teilzeichnung mit eigener Strichstärke (Tattoo: frisch kräftiger, verheilt feiner). */
  inset?: { ink: Ink; width: number }
  /** Ganzes Motiv um die Bildmitte skalieren (Strichstärke bleibt 2.4). */
  zoom?: number
}

/** Motiv um die Bildmitte (200|250) skalieren; Strichstärke bleibt. */
export function zoomMotif(motif: Motif): Motif {
  const z = motif.zoom ?? 1
  if (z === 1) return motif
  const at: Place = { x: 200 * (1 - z), y: 250 * (1 - z), s: z }
  return {
    ...motif,
    ...place(motif, at),
    wash: motif.wash ? placePath(motif.wash, at) : undefined,
    shadow: motif.shadow && {
      ...motif.shadow,
      x: motif.shadow.x * z + 200 * (1 - z),
      y: motif.shadow.y * z + 250 * (1 - z),
      w: motif.shadow.w * z,
    },
    inset: motif.inset && { ...motif.inset, ink: place(motif.inset.ink, at) },
    zoom: 1,
  }
}

export const ART = {
  paper: '#F4EFE6',
  paper2: '#EAE2D4',
  ink: '#1C1A17',
  harness: '#C23B2A',
  wash: { clay: '#E3D3BA', pink: '#F4CCDA', mat: '#CFE2D5', sky: '#D6E4EC' },
} as const
export type WashName = keyof typeof ART.wash

/** Strichstärke der Platzhalter (DESIGN §12.3): 2.8 seit P9.13 (vorher 2.4, zu dünn gegenüber Juttas Filzstift). */
export const STROKE_WIDTH = 2.8
export const VIEW = { w: 400, h: 500 } as const

// ---------------------------------------------------------------------------------------------------------------
// Pfade lesen, transformieren, abtasten

type Seg =
  | { k: 'M'; p: Pt }
  | { k: 'L'; p: Pt }
  | { k: 'Q'; c: Pt; p: Pt }
  | { k: 'C'; c1: Pt; c2: Pt; p: Pt }
  | { k: 'Z' }

const TOKEN = /[MLQCSZmlqcsz]|-?(?:\d+\.?\d*|\.\d+)(?:e-?\d+)?/g

/** Liest einen Pfad (M, L, Q, C, S, Z – groß absolut, klein relativ) in absolute Segmente. */
export function parsePath(d: string): Seg[] {
  const tokens = d.match(TOKEN) ?? []
  const out: Seg[] = []
  let i = 0
  let cmd = ''
  let cur: Pt = [0, 0]
  let start: Pt = [0, 0]
  let lastC2: Pt | null = null
  const num = () => {
    const t = tokens[i++]
    if (t === undefined || /[a-z]/i.test(t)) throw new Error(`Pfad unvollständig: ${d}`)
    return Number(t)
  }
  const pt = (rel: boolean): Pt => {
    const x = num()
    const y = num()
    return rel ? [cur[0] + x, cur[1] + y] : [x, y]
  }
  while (i < tokens.length) {
    if (/[a-z]/i.test(tokens[i]!)) cmd = tokens[i++]!
    const rel = cmd === cmd.toLowerCase()
    switch (cmd.toUpperCase()) {
      case 'M': {
        cur = pt(rel)
        start = cur
        out.push({ k: 'M', p: cur })
        cmd = rel ? 'l' : 'L'
        lastC2 = null
        break
      }
      case 'L': {
        cur = pt(rel)
        out.push({ k: 'L', p: cur })
        lastC2 = null
        break
      }
      case 'Q': {
        const c = pt(rel)
        const p = pt(rel)
        out.push({ k: 'Q', c, p })
        cur = p
        lastC2 = null
        break
      }
      case 'C': {
        const c1 = pt(rel)
        const c2 = pt(rel)
        const p = pt(rel)
        out.push({ k: 'C', c1, c2, p })
        cur = p
        lastC2 = c2
        break
      }
      case 'S': {
        const c1: Pt = lastC2 ? [2 * cur[0] - lastC2[0], 2 * cur[1] - lastC2[1]] : cur
        const c2 = pt(rel)
        const p = pt(rel)
        out.push({ k: 'C', c1, c2, p })
        cur = p
        lastC2 = c2
        break
      }
      case 'Z': {
        out.push({ k: 'Z' })
        cur = start
        lastC2 = null
        break
      }
      default:
        throw new Error(`Unbekannter Pfadbefehl „${cmd}“ in ${d}`)
    }
  }
  return out
}

const f1 = (n: number) => {
  const r = Math.round(n * 10) / 10
  const s = String(r === 0 ? 0 : r)
  return s.replace(/^(-?)0\./, '$1.')
}

/** Segmente zurück in einen absoluten Pfad (für Transformationen von Bausteinen). */
export function serializePath(segs: readonly Seg[]): string {
  const p = (q: Pt) => `${f1(q[0])} ${f1(q[1])}`
  return segs
    .map((s) => {
      switch (s.k) {
        case 'M':
          return `M${p(s.p)}`
        case 'L':
          return `L${p(s.p)}`
        case 'Q':
          return `Q${p(s.c)} ${p(s.p)}`
        case 'C':
          return `C${p(s.c1)} ${p(s.c2)} ${p(s.p)}`
        case 'Z':
          return 'Z'
      }
    })
    .join('')
}

/** Lage eines Bausteins: verschieben, skalieren, drehen (Grad), spiegeln. */
export interface Place {
  x?: number
  y?: number
  s?: number
  /** Unterschiedliche Skalierung in y (z. B. Ellipsen-Draufsicht); Standard = `s`. */
  sy?: number
  r?: number
  flip?: boolean
}

export function placePoint(p: Pt, at: Place): Pt {
  const s = at.s ?? 1
  const sy = at.sy ?? s
  const x0 = (at.flip ? -p[0] : p[0]) * s
  const y0 = p[1] * sy
  const a = ((at.r ?? 0) * Math.PI) / 180
  const cos = Math.cos(a)
  const sin = Math.sin(a)
  return [x0 * cos - y0 * sin + (at.x ?? 0), x0 * sin + y0 * cos + (at.y ?? 0)]
}

export function placePath(d: string, at: Place): string {
  const m = (p: Pt) => placePoint(p, at)
  return serializePath(
    parsePath(d).map((s): Seg => {
      switch (s.k) {
        case 'M':
          return { k: 'M', p: m(s.p) }
        case 'L':
          return { k: 'L', p: m(s.p) }
        case 'Q':
          return { k: 'Q', c: m(s.c), p: m(s.p) }
        case 'C':
          return { k: 'C', c1: m(s.c1), c2: m(s.c2), p: m(s.p) }
        case 'Z':
          return s
      }
    }),
  )
}

/** Baustein an eine Stelle setzen (alle Striche, Punkte, Glanzpunkte). */
export function place(ink: Ink, at: Place): Ink {
  const pp = (d: string) => placePath(d, at)
  return {
    strokes: ink.strokes.map((s) => (typeof s === 'string' ? pp(s) : { ...s, d: pp(s.d) })),
    dots: ink.dots?.map(pp),
    lights: ink.lights?.map(pp),
    harness: ink.harness?.map(pp),
  }
}

/** Mehrere Bausteine zu einem zusammenfassen. */
export function merge(...parts: Ink[]): Ink {
  return {
    strokes: parts.flatMap((p) => p.strokes),
    dots: parts.flatMap((p) => p.dots ?? []),
    lights: parts.flatMap((p) => p.lights ?? []),
    harness: parts.flatMap((p) => p.harness ?? []),
  }
}

function bez(a: Pt, b: Pt, c: Pt, d: Pt, t: number): Pt {
  const u = 1 - t
  return [
    u * u * u * a[0] + 3 * u * u * t * b[0] + 3 * u * t * t * c[0] + t * t * t * d[0],
    u * u * u * a[1] + 3 * u * u * t * b[1] + 3 * u * t * t * c[1] + t * t * t * d[1],
  ]
}

/** Teilpfade als dichte Punktfolgen. */
export function sample(d: string): Pt[][] {
  const subs: Pt[][] = []
  let cur: Pt[] = []
  let start: Pt = [0, 0]
  let last: Pt = [0, 0]
  for (const s of parsePath(d)) {
    if (s.k === 'M') {
      if (cur.length > 1) subs.push(cur)
      cur = [s.p]
      start = s.p
      last = s.p
      continue
    }
    if (s.k === 'Z') {
      cur.push(start)
      last = start
      continue
    }
    const end = s.p
    const a = last
    const [b, c] =
      s.k === 'C'
        ? [s.c1, s.c2]
        : s.k === 'Q'
          ? [
              [a[0] + (2 / 3) * (s.c[0] - a[0]), a[1] + (2 / 3) * (s.c[1] - a[1])] as Pt,
              [end[0] + (2 / 3) * (s.c[0] - end[0]), end[1] + (2 / 3) * (s.c[1] - end[1])] as Pt,
            ]
          : [a, end]
    const n = s.k === 'L' ? 4 : 24
    for (let k = 1; k <= n; k++) cur.push(bez(a, b, c, end, k / n))
    last = end
  }
  if (cur.length > 1) subs.push(cur)
  return subs
}

const dist = (a: Pt, b: Pt) => Math.hypot(b[0] - a[0], b[1] - a[1])

function lengthOf(pts: readonly Pt[]): number {
  let l = 0
  for (let i = 1; i < pts.length; i++) l += dist(pts[i - 1]!, pts[i]!)
  return l
}

/** Gleichmäßig nach Bogenlänge abtasten; liefert Punkte samt Bogenlänge. */
function resample(pts: readonly Pt[], step: number): { p: Pt; s: number }[] {
  const total = lengthOf(pts)
  const n = Math.max(2, Math.round(total / step) + 1)
  const out: { p: Pt; s: number }[] = []
  let seg = 1
  let acc = 0
  for (let k = 0; k < n; k++) {
    const target = (total * k) / (n - 1)
    while (seg < pts.length - 1 && acc + dist(pts[seg - 1]!, pts[seg]!) < target) {
      acc += dist(pts[seg - 1]!, pts[seg]!)
      seg++
    }
    const a = pts[seg - 1]!
    const b = pts[seg]!
    const l = dist(a, b) || 1
    const t = Math.min(1, Math.max(0, (target - acc) / l))
    out.push({ p: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], s: target })
  }
  return out
}

/** Teilstück einer Punktfolge zwischen Bogenlängen `from` und `to`. */
function slice(pts: readonly Pt[], from: number, to: number): Pt[] {
  const out: Pt[] = []
  let acc = 0
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!
    const b = pts[i]!
    const l = dist(a, b)
    const s0 = acc
    const s1 = acc + l
    if (s1 >= from && s0 <= to) {
      const t0 = l ? Math.max(0, (from - s0) / l) : 0
      const t1 = l ? Math.min(1, (to - s0) / l) : 1
      if (out.length === 0) out.push([a[0] + (b[0] - a[0]) * t0, a[1] + (b[1] - a[1]) * t0])
      out.push([a[0] + (b[0] - a[0]) * t1, a[1] + (b[1] - a[1]) * t1])
    }
    acc = s1
  }
  return out
}

/** Verlängert eine Punktfolge am Ende entlang ihrer Startrichtung (Überstand bei geschlossenen Formen). */
function extendPastStart(pts: readonly Pt[], by: number): Pt[] {
  const head = slice(pts, 0, by)
  return [...pts, ...head.slice(1)]
}

// ---------------------------------------------------------------------------------------------------------------
// Handstrich

export interface HandOptions {
  /** Wackel quer zur Richtung (Einheiten) und seine Wellenlänge. */
  wobble?: number
  wave?: number
  /** Feines Zittern (zweite, kürzere Welle). */
  tremor?: number
  /** Druckstellen (Platzhalter, P9.13): lange Striche an einer Stelle noch einmal leicht versetzt nachgezogen. */
  press?: boolean
}

// P9.13: etwas mehr Zittern als in P8 – näher an Juttas Filzstift (ART-NOTES, `coco-oh-01.jpg`)
const DEFAULT_HAND: Required<Omit<HandOptions, 'press'>> & { press: boolean } = {
  wobble: 1.8,
  wave: 40,
  tremor: 0.9,
  press: false,
}

/** Zahlen kompakt verketten (Leerzeichen nur, wo kein Minus trennt). */
function nums(list: readonly number[]): string {
  let out = ''
  for (const n of list) {
    const s = f1(n)
    out += out === '' || s.startsWith('-') ? s : ` ${s}`
  }
  return out
}

/** Kompakter Pfad (relative Quadratik-Kette über Mittelpunkte) aus einer Punktfolge. */
export function pointsToPath(pts: readonly Pt[], coarse = false): string {
  if (pts.length < 2) return ''
  const r = (n: number) => (coarse ? Math.round(n) : Math.round(n * 10) / 10)
  let cx = r(pts[0]![0])
  let cy = r(pts[0]![1])
  const head = `M${nums([cx, cy])}`
  if (pts.length === 2) return `${head}l${nums([r(pts[1]![0]) - cx, r(pts[1]![1]) - cy])}`
  const body: number[] = []
  for (let i = 1; i < pts.length - 1; i++) {
    const c = pts[i]!
    const n = pts[i + 1]!
    const end: Pt = i === pts.length - 2 ? n : [(c[0] + n[0]) / 2, (c[1] + n[1]) / 2]
    body.push(r(c[0]) - cx, r(c[1]) - cy, r(end[0]) - cx, r(end[1]) - cy)
    cx = r(end[0])
    cy = r(end[1])
  }
  return `${head}q${nums(body)}`
}

/** Ein Teilstrich: Wackel anwenden und als Pfad ausgeben. */
function wobbleLine(pts: readonly Pt[], seed: number, opts: typeof DEFAULT_HAND): string {
  const total = lengthOf(pts)
  if (total < 0.5) return ''
  const step = Math.min(14, Math.max(2.6, total / 6))
  const res = resample(pts, step)
  const lo = valueNoise1D(seed)
  const hi = valueNoise1D(seed ^ 0x5bd1e995)
  // kurze Striche wackeln weniger (sonst zerfallen Augen und Nasen)
  const amp = opts.wobble * Math.min(1, total / 60)
  const out: Pt[] = res.map(({ p, s }, i) => {
    const a = res[Math.max(0, i - 1)]!.p
    const b = res[Math.min(res.length - 1, i + 1)]!.p
    const l = dist(a, b) || 1
    const nx = -(b[1] - a[1]) / l
    const ny = (b[0] - a[0]) / l
    const off = amp * lo(s / opts.wave) + opts.tremor * Math.min(1, total / 40) * hi(s / 21)
    return [p[0] + nx * off, p[1] + ny * off]
  })
  // Druckstelle: auf langen Strichen drückt die Hand an einer Stelle fester auf – dieselbe Linie dort noch einmal,
  // um 0,8 Einheiten versetzt (gleiche Werkzeugstärke, wirkt dicker; Juttas Filzstift, ART-NOTES)
  let press = ''
  if (opts.press && total > 70 && out.length > 6) {
    const r = mulberry32(seed ^ 0x51ed270b)
    if (r() < 0.5) {
      const n = out.length
      const len = Math.max(3, Math.round(n * (0.2 + r() * 0.15)))
      const at = Math.floor(r() * (n - len))
      const side = r() < 0.5 ? 0.8 : -0.8
      const part = out.slice(at, at + len + 1)
      press = pointsToPath(
        part.map((q, i) => {
          const a2 = part[Math.max(0, i - 1)]!
          const b2 = part[Math.min(part.length - 1, i + 1)]!
          const l = dist(a2, b2) || 1
          return [q[0] - ((b2[1] - a2[1]) / l) * side, q[1] + ((b2[0] - a2[0]) / l) * side] as Pt
        }),
        total > 36,
      )
    }
  }
  // lange Striche ganzzahlig (spart Bytes; die Rundung wirkt wie zusätzliches Handzittern)
  return pointsToPath(out, total > 36) + press
}

/** Handstrich aus einem gezeichneten Pfad: Wackel, offene Enden, Absetzer, ggf. Doppelkontur. */
export function handStroke(spec: StrokeSpec, seed: number, opts: HandOptions = {}): string[] {
  const o = { ...DEFAULT_HAND, ...opts }
  const d = typeof spec === 'string' ? spec : spec.d
  const exact = typeof spec !== 'string' && spec.exact === true
  const double = typeof spec !== 'string' && spec.double === true
  const rand = mulberry32(seed)
  const out: string[] = []
  sample(d).forEach((raw, idx) => {
    let pts: Pt[] = raw
    const sub = seed + idx * 7919
    const total = lengthOf(pts)
    const closed = dist(pts[0]!, pts[pts.length - 1]!) < 2.5 && total > 20
    if (closed && !exact) {
      // geschlossene Form: Überstand (wie Juttas Augen) oder offene Lücke
      if (rand() < 0.55) pts = extendPastStart(pts, 2 + rand() * 3)
      else pts = slice(pts, 0, total - (2.5 + rand() * 2.5))
    }
    const len = lengthOf(pts)
    // P9.13: mehr Absetzer (ab 110 Einheiten, 80 %) – Juttas Konturen setzen oft ab
    if (!exact && len > 110 && rand() < 0.8) {
      // Absetzer: Stift abgesetzt und knapp daneben neu angesetzt
      const at = len * (0.38 + rand() * 0.24)
      const a = slice(pts, 0, at)
      const b = slice(pts, at - (1.5 + rand() * 2.5), len)
      const shift = (rand() < 0.5 ? -1 : 1) * (0.5 + rand() * 0.7)
      const b2 = b.map((p, i) => {
        const q = b[Math.min(b.length - 1, i + 1)]!
        const r0 = b[Math.max(0, i - 1)]!
        const l = dist(r0, q) || 1
        const fade = Math.max(0, 1 - i / 6)
        return [
          p[0] - ((q[1] - r0[1]) / l) * shift * fade,
          p[1] + ((q[0] - r0[0]) / l) * shift * fade,
        ] as Pt
      })
      out.push(wobbleLine(a, sub, o), wobbleLine(b2, sub + 1, o))
    } else {
      out.push(wobbleLine(pts, sub, o))
    }
    if (double) {
      // zweiter Zug: leicht versetzt, nur ein Teil der Länge
      const from = len * (0.08 + rand() * 0.2)
      const to = len * (0.62 + rand() * 0.3)
      const part = slice(pts, from, to)
      const off = 1 + rand() * 0.5
      const moved = part.map((p, i) => {
        const q = part[Math.min(part.length - 1, i + 1)]!
        const r0 = part[Math.max(0, i - 1)]!
        const l = dist(r0, q) || 1
        return [p[0] - ((q[1] - r0[1]) / l) * off, p[1] + ((q[0] - r0[0]) / l) * off] as Pt
      })
      out.push(wobbleLine(moved, sub + 3, { ...o, wobble: o.wobble * 1.3 }))
    }
  })
  return out.filter(Boolean)
}

/** Gefüllter Punkt (Pupille, Nase): Kontrollpunkte leicht verrückt, damit nichts zirkelrund ist. */
export function handBlob(d: string, seed: number, amount = 0.5): string {
  const rand = mulberry32(seed)
  const j = (p: Pt): Pt => [p[0] + (rand() - 0.5) * amount, p[1] + (rand() - 0.5) * amount]
  return serializePath(
    parsePath(d).map((s): Seg => {
      switch (s.k) {
        case 'M':
          return { k: 'M', p: j(s.p) }
        case 'L':
          return { k: 'L', p: j(s.p) }
        case 'Q':
          return { k: 'Q', c: j(s.c), p: j(s.p) }
        case 'C':
          return { k: 'C', c1: j(s.c1), c2: j(s.c2), p: j(s.p) }
        case 'Z':
          return s
      }
    }),
  )
}

/** Schatten aus `count` Schraffurstrichen unter 40° (DESIGN §12.3). */
export function hatch(shadow: NonNullable<Motif['shadow']>, seed: number): string[] {
  const rand = mulberry32(seed)
  const count = shadow.count ?? 5 + Math.floor(rand() * 3)
  const len = (shadow.len ?? 18) * (0.8 + rand() * 0.25)
  // 40° mit leichter Streuung je Motiv (jede Schraffur von Hand, nie ein Stempel)
  const a = ((40 + (rand() - 0.5) * 12) * Math.PI) / 180
  // Je Motiv anders (Prüf-Linse P9.13: „gleiche Schraffur in jeder Kachel wirkt wie ein Stempel“): Richtung gespiegelt
  // (40° nach rechts oder links geneigt), Schattenlage etwas nach links/rechts verrückt, Abstände ungleich.
  const mirror = rand() < 0.5 ? -1 : 1
  const dx = Math.cos(a) * mirror
  const dy = -Math.sin(a)
  const shift = (rand() - 0.5) * shadow.w * 0.5
  const out: string[] = []
  for (let i = 0; i < count; i++) {
    const t = Math.min(1, Math.max(0, i / (count - 1) + (rand() - 0.5) * 0.12))
    // mittlere Striche etwas länger (Schattenform), Ränder kürzer
    const l = len * (0.7 + 0.45 * Math.sin(Math.PI * t)) * (0.9 + rand() * 0.2)
    const x0 = shadow.x + shift + shadow.w * t + (rand() - 0.5) * 3.2
    const y0 = shadow.y + (rand() - 0.5) * 4
    const bend = (rand() - 0.5) * 2.6
    const mx = x0 + (dx * l) / 2 - dy * bend
    const my = y0 + (dy * l) / 2 + dx * bend
    out.push(
      `M${f1(x0)} ${f1(y0)}q${f1(mx - x0)} ${f1(my - y0)} ${f1(dx * l)} ${f1(dy * l)}`.replace(
        / -/g,
        '-',
      ),
    )
  }
  return out
}

/** Wash-Fläche: geschlossener Umriss, um 3–4 Einheiten nach rechts unten versetzt, Kontrollpunkte leicht verrückt. */
export function washPath(d: string, seed: number): { d: string; dx: number; dy: number } {
  const rand = mulberry32(seed)
  const dx = 3 + rand()
  const dy = 3 + rand()
  return { d: placePath(handBlob(d, seed + 1, 5), { x: dx, y: dy }), dx, dy }
}

// ---------------------------------------------------------------------------------------------------------------
// SVG

export interface RenderOptions {
  key: string
  wash: WashName | null
}

function renderInk(
  ink: Ink,
  seed: number,
): { strokes: string; dots: string; lights: string; harness: string } {
  const strokes: string[] = []
  ink.strokes.forEach((s, i) => strokes.push(...handStroke(s, seed + i * 104729, { press: true })))
  const blob = (list: string[] | undefined, salt: number) =>
    (list ?? []).map((d, i) => handBlob(d, seed + salt + i * 31, 0.45)).join('')
  return {
    strokes: strokes.join(''),
    dots: blob(ink.dots, 11),
    lights: blob(ink.lights, 23),
    harness: blob(ink.harness, 37),
  }
}

/** Platzhalter-SVG 400×500 aus einer Motiv-Skizze (deterministisch je `key`). */
export function renderMotif(input: Motif, options: RenderOptions): string {
  const motif = zoomMotif(input)
  if (Math.abs(motif.tilt) > 3) throw new Error(`${options.key}: Neigung ${motif.tilt}° > 3°`)
  const seed = fnv1a32(options.key)
  const main = renderInk(motif, seed)
  const inset = motif.inset ? renderInk(motif.inset.ink, seed ^ 0x1b873593) : null
  const shadow = motif.shadow ? hatch(motif.shadow, seed ^ 0x2545f491).join('') : ''
  const harness = main.harness + (inset?.harness ?? '')
  const dots = main.dots + (inset?.dots ?? '')
  const lights = main.lights + (inset?.lights ?? '')
  const parts: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VIEW.w} ${VIEW.h}" width="${VIEW.w}" height="${VIEW.h}">`,
    `<path fill="${ART.paper2}" d="M0 0h${VIEW.w}v${VIEW.h}H0z"/>`,
    `<g transform="rotate(${f1(motif.tilt)} 200 250)">`,
  ]
  if (options.wash) {
    if (!motif.wash) throw new Error(`${options.key}: Wash-Umriss fehlt`)
    const w = washPath(motif.wash, seed ^ 0x68e31da4)
    parts.push(`<path fill="${ART.wash[options.wash]}" d="${w.d}"/>`)
  }
  if (harness) parts.push(`<path fill="${ART.harness}" d="${harness}"/>`)
  parts.push(
    `<g fill="none" stroke="${ART.ink}" stroke-width="${STROKE_WIDTH}" stroke-linecap="round" stroke-linejoin="round">`,
    `<path d="${main.strokes}${shadow}"/>`,
  )
  // Druckstellen: dieselben Punkte, fester aufgedrückt (3.8 statt 2.8)
  if (inset && motif.inset)
    parts.push(`<path stroke-width="${motif.inset.width}" d="${inset.strokes}"/>`)
  parts.push('</g>')
  if (dots) parts.push(`<path fill="${ART.ink}" d="${dots}"/>`)
  if (lights) parts.push(`<path fill="${ART.paper}" d="${lights}"/>`)
  parts.push('</g></svg>')
  return parts.join('')
}
