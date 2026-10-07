// Fitness-Coco (P12.5, U-09): Puppen-Gerüst für die Startseite. Coco ist ein kleines 3D-Skelett (Becken, Wirbelsäule, Kopf,
// zwei Arme, zwei Beine, Schwanz); jedes Bild wird daraus als Strichzeichnung berechnet (Tusche + Buntstift-Schraffur +
// Papierfüllung): Gliedmaßen als weich gebogene Röhren, Rumpf als Querschnitte (dreht sich echt bei Twist und Seitenansicht),
// Kopf als Kugel mit Schnauze, Augen, Nase und Ohren (rechtes Ohr geknickt). Reines TypeScript ohne Framework; dieselbe
// Funktion erzeugt das Standbild (SVG), die Tests und die Leinwand der Startseite (Behaviour `fitness-coco`).
// Koordinaten: Zeichenfläche 200 × 250, x rechts, y unten, z zum Betrachter. Winkel in Grad.

export type P2 = [number, number]
type V3 = [number, number, number]
type M = [V3, V3, V3]

export const W = 200
export const H = 250
export const GROUND = 232
export const COLORS = {
  ink: '#1C1A17',
  crayon: '#D9822B',
  paper: '#F4EFE6',
  wash: '#F1DCB8',
  harness: '#C23B2A',
  tongue: '#E58C98',
} as const
/** Ansicht: Modell wird um den Fußpunkt vergrößert (Figur füllt die Box); Strichstärken in Modell-Einheiten. */
export const VIEW = { s: 1.2, ox: 100, oy: 232 }
export const INK_W = 1.25
export const CRAYON_W = 1.0
export const GROUND_W = 2.1
/** Buntstift: leicht körnig unterbrochen (Papierkörnung). */
export const CRAYON_DASH = [5.5, 0.7, 3.4, 0.9]

// ---------- Parameter ----------

/** Alle animierbaren Größen (Winkel in Grad, Längen in Zeichen-Einheiten). Ruhepose: `NEUTRAL`. */
export const NEUTRAL = {
  // Becken: Verschiebung x/y, Drehung des ganzen Körpers (Ansicht) yaw, Kippen in der Bildebene roll, Neigung vor pit, zur Seite swy, Hüftdrehung hip
  x: 0,
  y: 4,
  yaw: 0,
  roll: 0,
  pit: 0,
  swy: 0,
  hip: 0,
  // Brust gegen Becken: Verdrehung tw, Beuge vor bf / seitlich bs, Stauchung sq (1 = normal)
  tw: 0,
  bf: 0,
  bs: 0,
  sq: 1,
  // Kopf: Drehung hy, Nicken hp, Neigen hr, Blick lx/ly, Lid (0 offen … 1 zu), Mund (−1 … 1), Zunge tg (0 … 1) + Winkel tga, Ohren-Wippen
  hy: 0,
  hp: 0,
  hr: 0,
  lx: 0,
  ly: 0,
  lid: 0,
  mo: 0.7,
  tg: 0,
  tga: 14,
  ear: 0,
  // Arme (l = links im Bild): Oberarm a1, Unterarm a2 (je Grad von „nach unten“), Ebene b (0 seitlich … 90 nach vorn), Ellbogen-Ebene be
  la1: 15,
  la2: 8,
  lb: 0,
  lbe: 0,
  ra1: 15,
  ra2: 8,
  rb: 0,
  rbe: 0,
  // Füße: Verschiebung x / Anheben y / z (Boden = 0)
  lfx: -4,
  lfy: 0,
  lfz: 0,
  rfx: 4,
  rfy: 0,
  rfz: 0,
  kb: 6,
  // Schwanz: Grundwinkel ta, Einrollen tc, Ebene tb, Wellenhöhe tm, Wellenphase tp (rad)
  ta: 72,
  tc: 20,
  tb: 6,
  tm: 0,
  tp: 0,
}
export type Params = typeof NEUTRAL
export type ParamKey = keyof Params

// ---------- Mathe ----------

const D = Math.PI / 180
const rx = (a: number): M => {
  const c = Math.cos(a * D),
    s = Math.sin(a * D)
  return [
    [1, 0, 0],
    [0, c, -s],
    [0, s, c],
  ]
}
const ry = (a: number): M => {
  const c = Math.cos(a * D),
    s = Math.sin(a * D)
  return [
    [c, 0, s],
    [0, 1, 0],
    [-s, 0, c],
  ]
}
const rz = (a: number): M => {
  const c = Math.cos(a * D),
    s = Math.sin(a * D)
  return [
    [c, -s, 0],
    [s, c, 0],
    [0, 0, 1],
  ]
}
const mm = (a: M, b: M): M =>
  a.map((r) => [0, 1, 2].map((j) => r[0] * b[0][j]! + r[1] * b[1][j]! + r[2] * b[2][j]!)) as M
const mv = (m: M, v: V3): V3 => [
  m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2],
  m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2],
  m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2],
]
const va = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
const vs = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const vk = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k]
const vl = (a: V3) => Math.hypot(a[0], a[1], a[2])
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
/** Weicher Anstieg 0 … 1 zwischen a und b (Schraffur wächst ein, statt aufzuploppen). */
const ramp = (x: number, a: number, b: number) => Math.min(1, Math.max(0, (x - a) / (b - a)))
const p2 = (v: V3): P2 => [v[0], v[1]]
const fr = (x: number) => x - Math.floor(x)
/** Zufall in [-1, 1], deterministisch aus einer Zahl. */
const hs = (n: number) => fr(Math.sin(n * 127.1 + 311.7) * 43758.5453) * 2 - 1

// ---------- Zeichenliste ----------

/** `f` Füllung, `i` Tusche, `h` Buntstift, `w` Bodenlinie; `c` Farbe der Füllung. */
export interface Draw {
  t: 'f' | 'i' | 'h' | 'w'
  d: string
  c?: 'paper' | 'wash' | 'ink' | 'tongue' | 'harness'
  /** Markierung für Tests: geknicktes Ohr (U-07), Halsband, Zunge */
  k?: 'knick' | 'collar' | 'tongue'
}

const n1 = (n: number) => String(Math.round(n * 10) / 10)
/** Tiefster ausgegebener Punkt des laufenden Bildes (für die Bodenführung). */
let maxY = 0
const pt = (p: P2) => {
  if (p[1] > maxY) maxY = p[1]
  return `${n1(p[0])} ${n1(p[1])}`
}
const mid = (a: P2, b: P2): P2 => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]

/** Weich durch Stützpunkte (quadratischer B-Spline wie im Coco-Sprite). */
function smooth(p: P2[], closed: boolean): string {
  const n = p.length
  if (n < 2) return ''
  if (n === 2) return `M${pt(p[0]!)}L${pt(p[1]!)}`
  if (closed) {
    let d = `M${pt(mid(p[n - 1]!, p[0]!))}`
    for (let i = 0; i < n; i++) d += `Q${pt(p[i]!)} ${pt(mid(p[i]!, p[(i + 1) % n]!))}`
    return d + 'Z'
  }
  let d = `M${pt(p[0]!)}`
  for (let i = 1; i < n - 1; i++) d += `Q${pt(p[i]!)} ${pt(mid(p[i]!, p[i + 1]!))}`
  return d + `L${pt(p[n - 1]!)}`
}

/** Tusche entlang eines geschlossenen Umrisses mit Absetzern (`gaps` = [Start, Länge]) – offene Kontur wie bei Jutta. */
function inkRuns(poly: P2[], gaps: [number, number][], seed: number): string {
  const n = poly.length
  const off = new Array<boolean>(n).fill(false)
  for (const [g, l] of gaps) for (let k = 0; k < l; k++) off[(((g + k) % n) + n) % n] = true
  const start = off.findIndex((o) => o)
  if (start < 0) return smooth(poly, true)
  let d = ''
  let run: P2[] = []
  const flush = () => {
    if (run.length > 1) {
      const a = run[run.length - 2]!,
        b = run[run.length - 1]!
      const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1
      run.push([
        b[0] + ((b[0] - a[0]) / l) * 1.2,
        b[1] + ((b[1] - a[1]) / l) * 1.2 + hs(seed + run.length) * 0.3,
      ])
      d += smooth(run, false)
    }
    run = []
  }
  for (let k = 1; k <= n; k++) {
    const i = (start + k) % n
    if (off[i]) flush()
    else run.push(poly[i]!)
  }
  flush()
  return d
}

/** Leichtes Zittern der Stützpunkte (an den Punkt gebunden: wandert mit dem Körperteil, kein Flimmern). */
const wob = (p: P2[], seed: number, a = 0.38): P2[] =>
  p.map((q, i) => [q[0] + hs(seed + i * 2) * a, q[1] + hs(seed + i * 2 + 1) * a])

function inside(poly: P2[], x: number, y: number): boolean {
  let c = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]!,
      b = poly[j]!
    if (a[1] > y !== b[1] > y && x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0]) c = !c
  }
  return c
}

/** Buntstift-Schrägstrich um `c`: immer dieselbe Richtung (wie Juttas Schraffur), nur wenn er im Körperteil bleibt. */
function slash(poly: P2[], c: P2, len: number): string {
  const a = 60 * D
  for (const k of [1, 0.88, 0.76, 0.64, 0.52, 0.4, 0.3]) {
    const dx = (Math.cos(a) * len * k) / 2,
      dy = (Math.sin(a) * len * k) / 2
    const x0 = c[0] - dx,
      y0 = c[1] - dy,
      x1 = c[0] + dx,
      y1 = c[1] + dy
    if (inside(poly, x0, y0) && inside(poly, x1, y1) && inside(poly, c[0], c[1]))
      return `M${n1(x0)} ${n1(y0)}L${n1(x1)} ${n1(y1)}`
  }
  return ''
}

/** Halbebene y ≥ y0 (für Augenlider). */
function clipBelow(poly: P2[], y0: number): P2[] {
  const out: P2[] = []
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!,
      b = poly[(i + 1) % poly.length]!
    const ia = a[1] >= y0,
      ib = b[1] >= y0
    if (ia) out.push(a)
    if (ia !== ib) out.push([a[0] + ((b[0] - a[0]) * (y0 - a[1])) / (b[1] - a[1]), y0])
  }
  return out
}

const ellipse = (c: P2, rxx: number, ryy: number, n = 12, rot = 0): P2[] =>
  Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2
    const x = Math.cos(a) * rxx,
      y = Math.sin(a) * ryy
    return [
      c[0] + x * Math.cos(rot) - y * Math.sin(rot),
      c[1] + x * Math.sin(rot) + y * Math.cos(rot),
    ]
  })

/** Kapsel zwischen zwei Kreisen (Pfote, Schnauze). */
function capsule(a: P2, ra: number, b: P2, rb: number, n = 5): P2[] {
  const ang = Math.atan2(b[1] - a[1], b[0] - a[0])
  const out: P2[] = []
  for (let i = 0; i <= n; i++) {
    const q = ang - Math.PI / 2 + (i / n) * Math.PI
    out.push([b[0] + Math.cos(q) * rb, b[1] + Math.sin(q) * rb])
  }
  for (let i = 0; i <= n; i++) {
    const q = ang + Math.PI / 2 + (i / n) * Math.PI
    out.push([a[0] + Math.cos(q) * ra, a[1] + Math.sin(q) * ra])
  }
  return out
}

// ---------- Röhren (Arme, Beine, Schwanz) ----------

interface Tube {
  poly: P2[]
  /** Punkt bei Längenanteil t und Querlage u (in Radien, −1 … 1). */
  at: (t: number, u: number) => P2
  base: number
}

function tube(J: P2[], R: number[], steps = 5): Tube {
  const S: P2[] = []
  const RR: number[] = []
  const m = J.length
  for (let i = 0; i < m - 1; i++) {
    const p0 = J[Math.max(0, i - 1)]!,
      p1 = J[i]!,
      p2_ = J[i + 1]!,
      p3 = J[Math.min(m - 1, i + 2)]!
    for (let k = 0; k < steps; k++) {
      const t = k / steps,
        t2 = t * t,
        t3 = t2 * t
      S.push(
        [0, 1].map(
          (a) =>
            0.5 *
            (2 * p1[a]! +
              (-p0[a]! + p2_[a]!) * t +
              (2 * p0[a]! - 5 * p1[a]! + 4 * p2_[a]! - p3[a]!) * t2 +
              (-p0[a]! + 3 * p1[a]! - 3 * p2_[a]! + p3[a]!) * t3),
        ) as P2,
      )
      RR.push(lerp(R[i]!, R[i + 1]!, t))
    }
  }
  S.push(J[m - 1]!)
  RR.push(R[m - 1]!)
  const n = S.length
  const N: P2[] = S.map((_, i) => {
    const a = S[Math.max(0, i - 1)]!,
      b = S[Math.min(n - 1, i + 1)]!
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1
    return [-(b[1] - a[1]) / l, (b[0] - a[0]) / l]
  })
  const L = S.map((s, i) => [s[0] + N[i]![0] * RR[i]!, s[1] + N[i]![1] * RR[i]!] as P2)
  const Rt = S.map((s, i) => [s[0] - N[i]![0] * RR[i]!, s[1] - N[i]![1] * RR[i]!] as P2)
  const e = S[n - 1]!,
    tn = N[n - 1]!,
    r = RR[n - 1]!
  const dir: P2 = [tn[1], -tn[0]]
  const cap: P2[] = [45, 90, 135].map((a) => [
    e[0] + tn[0] * Math.cos(a * D) * r + dir[0] * Math.sin(a * D) * r,
    e[1] + tn[1] * Math.cos(a * D) * r + dir[1] * Math.sin(a * D) * r,
  ])
  const b0 = S[0]!,
    bn = N[0]!,
    br = RR[0]!
  const bdir: P2 = [-bn[1], bn[0]]
  const bcap: P2[] = [45, 90, 135].map((a) => [
    b0[0] - bn[0] * Math.cos(a * D) * br + bdir[0] * Math.sin(a * D) * br,
    b0[1] - bn[1] * Math.cos(a * D) * br + bdir[1] * Math.sin(a * D) * br,
  ])
  return {
    poly: [...L, ...cap, ...Rt.reverse(), ...bcap],
    base: 0,
    at: (t, u) => {
      const f = Math.min(n - 1, Math.max(0, t * (n - 1)))
      const i = Math.floor(f),
        j = Math.min(n - 1, i + 1),
        k = f - i
      return [
        lerp(S[i]![0], S[j]![0], k) + lerp(N[i]![0] * RR[i]!, N[j]![0] * RR[j]!, k) * u,
        lerp(S[i]![1], S[j]![1], k) + lerp(N[i]![1] * RR[i]!, N[j]![1] * RR[j]!, k) * u,
      ]
    },
  }
}

/** Gliedmaß zeichnen: Papier, Schraffur (Bereich t0…t1, Querlage ±uMax), Tusche mit Absetzern; Wurzel offen. */
function drawTube(
  out: Draw[],
  tb: Tube,
  seed: number,
  o: { hatch?: [number, number]; count?: number; len?: number; gaps?: [number, number][] } = {},
) {
  out.push({ t: 'f', d: smooth(tb.poly, true), c: 'wash' })
  if (o.hatch) {
    let h = ''
    const cnt = o.count ?? 8
    for (let i = 0; i < cnt; i++) {
      const t = lerp(o.hatch[0], o.hatch[1], (i + 0.5 + hs(seed + i) * 0.2) / cnt)
      const u = hs(seed + i * 3 + 1) * 0.55 + (i % 2 ? 0.12 : -0.12)
      h += slash(tb.poly, tb.at(t, u * 3.2), (o.len ?? 7.5) + hs(seed + i * 5) * 1.5)
    }
    if (h) out.push({ t: 'h', d: h })
  }
  const n = tb.poly.length
  out.push({ t: 'i', d: inkRuns(wob(tb.poly, seed), o.gaps ?? [[n - 4, 5]], seed) })
}

// ---------- Rumpf ----------

const SEC_A = [19, 15, 12, 15, 19, 16, 11]
const SEC_B = [15, 12.5, 11.5, 14.5, 16.5, 13.5, 10]
const SPINE = 38

interface Sec {
  c: V3
  R: M
  a: number
  b: number
}

function spine(p: Params, R0: M, C0: V3): Sec[] {
  const ds = (SPINE * p.sq) / 6
  const rot = (s: number) => mm(mm(mm(R0, ry(p.tw * s)), rx(-p.bf * s)), rz(p.bs * s))
  const out: Sec[] = []
  let c = C0
  for (let k = 0; k <= 6; k++) {
    out.push({ c, R: rot(k / 6), a: SEC_A[k]!, b: SEC_B[k]! })
    if (k < 6) c = va(c, mv(rot((k + 0.5) / 6), [0, -ds, 0]))
  }
  return out
}
/** Punkt auf der Rumpfoberfläche (Längenanteil s, Winkel φ ab „vorn“) mit Sichtbarkeit. */
function torsoSurf(S: Sec[], s: number, phi: number): { p: P2; nz: number } {
  const f = Math.min(5.999, Math.max(0, s * 6))
  const k = Math.floor(f),
    t = f - k
  const A = S[k]!,
    B = S[k + 1]!
  const a = lerp(A.a, B.a, t),
    b = lerp(A.b, B.b, t)
  const R = t < 0.5 ? A.R : B.R
  const c: V3 = [lerp(A.c[0], B.c[0], t), lerp(A.c[1], B.c[1], t), lerp(A.c[2], B.c[2], t)]
  const q = va(c, mv(R, [a * Math.sin(phi * D), 0, b * Math.cos(phi * D)]))
  const n = mv(R, [Math.sin(phi * D) / a, 0, Math.cos(phi * D) / b])
  return { p: p2(q), nz: n[2] / (vl(n) || 1) }
}

// ---------- Ketten (Arme, Schwanz) ----------

/** Punkte einer Kette in der Ebene mit Azimut b (0 seitlich, 90 nach vorn); Winkel je Glied von „nach unten“. */
function chain(
  o: V3,
  R: M,
  side: number,
  b: number,
  angles: number[],
  lens: number[],
  az2?: number,
): V3[] {
  const pts: V3[] = [o]
  let c = o
  angles.forEach((a, i) => {
    const bb = (i > 0 && az2 !== undefined ? b + az2 : b) * D
    const eu: V3 = [side * Math.cos(bb), 0, Math.sin(bb)]
    const v: V3 = [eu[0] * Math.sin(a * D), Math.cos(a * D), eu[2] * Math.sin(a * D)]
    c = va(c, mv(R, vk(v, lens[i]!)))
    pts.push(c)
  })
  return pts
}

// ---------- Kopf ----------

function head(out: Draw[], p: Params, hc: V3, Rh: M, seed: number) {
  const HS = 1.16
  const PJ = (v: V3): V3 => va(hc, mv(Rh, vk(v, HS)))
  const NZ = (v: V3) => {
    const n = mv(Rh, v)
    return n[2] / (vl(n) || 1)
  }
  const R = 19.6

  // Ohren (Coco: groß, aufrecht; das linke im Bild = ihr rechtes ist geknickt)
  const ears = ([-1, 1] as const).map((s) => {
    const B: V3 = [s * 10.5, -14.5, -2.5]
    const fold = s < 0
    const up = mv(rz(s * (p.ear + 4)), [s * 0.2, -1, -0.1])
    const H0 = fold ? 19 : 32
    const K = va(B, vk(up, H0))
    const ew: V3 = [0.74, 0, -0.67 * s]
    const C = (t: number): V3 => va(B, vk(vs(K, B), t))
    const ts = [0, 0.15, 0.32, 0.5, 0.68, 0.84, 1]
    const wd = (t: number) =>
      fold
        ? 6.4 - 1.6 * t
        : 7.2 * Math.pow(1 - t, 0.72) * (1 + 0.22 * Math.sin(Math.PI * Math.min(1, t * 1.3)))
    const left: P2[] = [],
      right: P2[] = []
    for (const t of ts) {
      const c = PJ(C(t))
      const wp = mv(Rh, ew)
      const wl = Math.hypot(wp[0], wp[1])
      const w: V3 =
        wl < 0.6
          ? [
              (wl > 0.01 ? wp[0] / wl : 1) * 0.6 * wd(t) * HS,
              (wl > 0.01 ? wp[1] / wl : 0) * 0.6 * wd(t) * HS,
              0,
            ]
          : vk(wp, wd(t) * HS)
      left.push(p2(va(c, w)))
      right.push(p2(vs(c, w)))
    }
    const poly: P2[] = [...left, ...right.reverse()]
    let flap: P2[] | null = null
    if (fold) {
      const fd = mv(rz(s * p.ear * 0.4), [s * 0.8, 0.55, 0.15])
      const kc = p2(PJ(K)),
        tc = p2(PJ(va(K, vk(fd, 14))))
      const dx = tc[0] - kc[0],
        dy = tc[1] - kc[1]
      const l = Math.hypot(dx, dy) || 1
      const ux = dx / l,
        uy = dy / l,
        qx = -uy,
        qy = ux
      const at = (a: number, b: number): P2 => [kc[0] + ux * a + qx * b, kc[1] + uy * a + qy * b]
      flap = [
        at(0, 5.8),
        at(l * 0.5, 5.4),
        at(l * 0.92, 1.8),
        at(l * 1.04, -0.4),
        at(l * 0.8, -3.6),
        at(l * 0.4, -4.4),
        at(-1, -5),
      ]
    }
    return {
      s,
      poly,
      flap,
      zb: PJ(B)[2] - hc[2],
      C: (t: number) => p2(PJ(C(t))),
      ew: p2(mv(Rh, ew)),
      fold,
    }
  })
  const drawEar = (e: (typeof ears)[number], sd: number) => {
    out.push({ t: 'f', d: smooth(e.poly, true), c: 'wash' })
    let h = ''
    for (let i = 0; i < (e.fold ? 4 : 7); i++) {
      const t = (e.fold ? 0.1 : 0.1) + i * (e.fold ? 0.2 : 0.12) + hs(sd + i) * 0.03
      const c = e.C(t)
      const off = (hs(sd + i * 7) * 0.5 + 0.3 * e.s) * 2.2
      h += slash(e.poly, [c[0] + e.ew[0] * off, c[1] + e.ew[1] * off], 6.2)
    }
    if (h) out.push({ t: 'h', d: h })
    const n = e.poly.length
    out.push({ t: 'i', d: inkRuns(wob(e.poly, sd), [[n - 2, 3]], sd) })
    if (!e.fold) {
      const pts: P2[] = [0.14, 0.32, 0.5, 0.64].map((t) => {
        const c = e.C(t)
        return [c[0] - e.ew[0] * 0.7 * e.s, c[1] - e.ew[1] * 0.7 * e.s] as P2
      })
      out.push({ t: 'i', d: smooth(pts, false) })
    }
    if (e.flap) {
      out.push({ t: 'f', d: smooth(e.flap, true), c: 'wash', k: 'knick' })
      let fh = ''
      const fc = e.flap
      const cx = (fc[0]![0] + fc[2]![0] + fc[4]![0]) / 3,
        cy = (fc[0]![1] + fc[2]![1] + fc[4]![1]) / 3
      for (const [dx, dy] of [
        [-2, -1],
        [1.5, 1],
        [-0.5, 2.5],
      ] as P2[])
        fh += slash(fc, [cx + dx, cy + dy], 5)
      if (fh) out.push({ t: 'h', d: fh })
      out.push({ t: 'i', d: inkRuns(wob(fc, sd + 5), [[fc.length - 2, 2]], sd + 5) })
    }
  }
  const behind = ears.filter((e) => e.zb < -1.5)
  const front = ears.filter((e) => e.zb >= -1.5)
  behind.forEach((e) => drawEar(e, seed + e.s * 11))

  // Schädel
  const hcp = p2(hc)
  const skull = wob(ellipse(hcp, R * HS * 1.03, R * HS * 0.95, 22, -Math.PI / 2), seed + 40, 0.3)
  out.push({ t: 'f', d: smooth(skull, true), c: 'wash' })
  // Schnauze und Augenpunkte (für die Schraffur-Aussparung)
  const M0 = p2(PJ([0, 7, 10])),
    M1 = p2(PJ([0, 9.5, 25]))
  const eyeL = PJ([-8.6, -4, 16.5]),
    eyeR = PJ([8.6, -4, 16.5])
  let h = ''
  for (let i = 0; i < 44; i++) {
    const az = (hs(seed + i * 3) > 0 ? 1 : -1) * (24 + fr(i * 0.618) * 90)
    const el = -22 + fr(i * 0.7548) * 78
    const l: V3 = [
      R * 0.96 * Math.cos(el * D) * Math.sin(az * D),
      -R * 0.96 * Math.sin(el * D),
      R * 0.96 * Math.cos(el * D) * Math.cos(az * D),
    ]
    const vis = ramp(NZ(l), 0.14 + 0.3 * fr(i * 0.37), 0.3 + 0.3 * fr(i * 0.37))
    if (vis <= 0.05) continue
    const c = p2(PJ(l))
    if (
      Math.hypot(c[0] - eyeL[0], c[1] - eyeL[1]) < 8 * HS ||
      Math.hypot(c[0] - eyeR[0], c[1] - eyeR[1]) < 8 * HS
    )
      continue
    if (Math.hypot(c[0] - M0[0], c[1] - M0[1]) < 11 * HS) continue
    h += slash(skull, c, (6.5 + hs(seed + i) * 1.4) * vis)
  }
  if (h) out.push({ t: 'h', d: h })
  // weiße Blesse zwischen den Augen
  const bl: P2[] = []
  let blOk = true
  for (const l of [
    [-3.4, -2, 18.8],
    [-2.6, -10, 15.6],
    [-1.2, -17, 9],
    [1.2, -17, 9],
    [2.6, -10, 15.6],
    [3.4, -2, 18.8],
  ] as V3[]) {
    if (NZ(l) < 0.2) blOk = false
    bl.push(p2(PJ(l)))
  }
  if (blOk) out.push({ t: 'f', d: smooth(bl, true), c: 'paper' })
  out.push({ t: 'i', d: inkRuns(skull, [[16, 2]], seed + 5) })

  const muz = wob(capsule(M0, 10 * HS, M1, 7.2 * HS, 5), seed + 70, 0.25)
  out.push({ t: 'f', d: smooth(muz, true), c: 'paper' })
  let top = 0
  muz.forEach((q, i) => {
    if (q[1] < muz[top]![1]) top = i
  })
  // Schnauzen-Umriss nur dort, wo er über den Schädel hinausragt (Seitenansicht)
  const mg: [number, number][] = []
  muz.forEach((q, i) => {
    if (Math.hypot(q[0] - hcp[0], q[1] - hcp[1]) < R * HS * 0.95) mg.push([i, 1])
  })
  if (mg.length < muz.length) out.push({ t: 'i', d: inkRuns(muz, mg, seed + 9) })
  void top

  // Nase
  const nose = p2(PJ([0, 5.4, 30.2]))
  const nf = Math.abs(Math.cos(Math.atan2(Rh[0][2], Rh[2][2])))
  out.push({
    t: 'f',
    d: smooth(ellipse(nose, (3.3 + 1.0 * nf) * HS, 2.9 * HS, 10), true),
    c: 'ink',
  })
  // Mund
  const mo = p2(PJ([0, 12.3, 29.4]))
  const mc = (sx: number): P2[] => [
    p2(PJ([0, 8.8, 30.6])),
    mo,
    p2(PJ([sx * 3.4, 13.6 - p.mo * 0.6, 27.8])),
    p2(PJ([sx * 6.8, 12.6 - p.mo * 2.6, 24.2])),
  ]
  out.push({ t: 'i', d: smooth(mc(-1), false) + smooth(mc(1), false) })

  // Zunge (hängt zur Schwerkraft, aus dem rechten Mundwinkel)
  if (p.tg > 0.02) {
    const b = p2(PJ([5.2, 12.8, 25.2]))
    const a = p.tga * D
    const dx = Math.sin(a),
      dy = Math.cos(a)
    const px = dy,
      py = -dx
    const len = (3 + 10 * p.tg) * HS,
      wd = (2.5 + 0.9 * p.tg) * HS
    const pts: P2[] = [
      [b[0] + px * wd * 0.8, b[1] + py * wd * 0.8],
      [b[0] + dx * len * 0.55 + px * wd * 1.1, b[1] + dy * len * 0.55 + py * wd * 1.1],
      [b[0] + dx * len * 1.0 + px * wd * 0.5, b[1] + dy * len * 1.0 + py * wd * 0.5],
      [b[0] + dx * len * 1.12, b[1] + dy * len * 1.12],
      [b[0] + dx * len * 1.0 - px * wd * 0.5, b[1] + dy * len * 1.0 - py * wd * 0.5],
      [b[0] + dx * len * 0.55 - px * wd * 1.1, b[1] + dy * len * 0.55 - py * wd * 1.1],
      [b[0] - px * wd * 0.8, b[1] - py * wd * 0.8],
    ]
    out.push({ t: 'f', d: smooth(pts, true), c: 'tongue', k: 'tongue' })
    out.push({ t: 'i', d: smooth(pts, true) })
    out.push({
      t: 'i',
      d: `M${pt([b[0] + dx * 1.5, b[1] + dy * 1.5])}L${pt([b[0] + dx * len * 0.8, b[1] + dy * len * 0.8])}`,
    })
  }

  // Augen
  for (const [E, loc] of [
    [eyeL, [-8.6, -4, 16.5]],
    [eyeR, [8.6, -4, 16.5]],
  ] as [V3, V3][]) {
    const f = NZ(loc)
    if (f < 0.1) continue
    const c = p2(E)
    const erx = 4.3 * HS * (0.35 + 0.65 * Math.min(1, f * 1.15)),
      ery = 4.9 * HS
    if (p.lid > 0.86) {
      out.push({
        t: 'i',
        d: smooth(
          [
            [c[0] - erx * 1.1, c[1] - 0.6],
            [c[0], c[1] + 1.5],
            [c[0] + erx * 1.1, c[1] - 0.6],
          ],
          false,
        ),
      })
      continue
    }
    const lidY = c[1] - ery + p.lid * 2 * ery
    let ball = ellipse(c, erx, ery, 14)
    if (p.lid > 0.03) ball = clipBelow(ball, lidY)
    out.push({ t: 'f', d: smooth(ball, true), c: 'paper' })
    const pr = Math.min(erx, 3.4 * HS)
    const pc: P2 = [c[0] + p.lx * (erx - pr * 0.7), c[1] + p.ly * 1.6 + 0.4]
    let pup = ellipse(pc, pr, 3.6 * HS, 12)
    if (p.lid > 0.03) pup = clipBelow(pup, lidY)
    if (pup.length > 2) out.push({ t: 'f', d: smooth(pup, true), c: 'ink' })
    if (p.lid < 0.35)
      out.push({
        t: 'f',
        d: smooth(ellipse([pc[0] - pr * 0.35, pc[1] - 1.5], 0.9 * HS, 0.9 * HS, 6), true),
        c: 'paper',
      })
    out.push({ t: 'i', d: smooth(wob(ball, seed + (loc[0] > 0 ? 3 : 4), 0.12), true) })
  }
  front.forEach((e) => drawEar(e, seed + e.s * 11))
}

// ---------- Ganzes Bild ----------

export interface Frame {
  draws: Draw[]
}

/** Zeichenliste einer Pose. Nichts reicht unter den Boden: liegt ein Teil tiefer, wird der ganze Körper angehoben. */
export function build(p: Params): Draw[] {
  maxY = 0
  let out = draw(p)
  if (maxY > GROUND + 2.6) out = draw({ ...p, y: p.y - (maxY - (GROUND + 1.6)) })
  return out.filter((d) => d.d.length > 3)
}

function draw(p: Params): Draw[] {
  maxY = 0
  const out: Draw[] = []
  const R0 = mm(mm(mm(mm(rz(p.roll), ry(p.yaw)), rx(-p.pit)), rz(p.swy)), ry(p.hip))
  const C0: V3 = [100 + p.x, 173 + p.y, 0]
  const S = spine(p, R0, C0)
  const top = S[6]!
  const Rc = S[4]!.R

  // Beine (Zwei-Knochen-IK, Knie nach vorn)
  const Rf = mm(rz(p.roll), ry(p.yaw))
  type Leg = { z: number; draw: () => void }
  const legs: Leg[] = ([-1, 1] as const).map((s) => {
    const hip = va(C0, mv(R0, [s * 10, 4, 0]))
    const fx = s < 0 ? p.lfx : p.rfx,
      fy = s < 0 ? p.lfy : p.rfy,
      fz = s < 0 ? p.lfz : p.rfz
    const A = va([100, GROUND - 7 - fy, 0], mv(ry(p.yaw), [s * 12 + fx, 0, fz]))
    const d = vs(A, hip)
    const L1 = 27,
      L2 = 26
    const L = Math.min(vl(d), (L1 + L2) * 0.992)
    const dir = vk(d, 1 / (vl(d) || 1))
    const a = (L1 * L1 - L2 * L2 + L * L) / (2 * L)
    const h = Math.sqrt(Math.max(0, L1 * L1 - a * a))
    const fwd = mv(R0, [Math.sin(p.kb * D) * s, 0, Math.cos(p.kb * D)])
    let perp = vs(fwd, vk(dir, dot(fwd, dir)))
    perp = vk(perp, 1 / (vl(perp) || 1))
    const knee = va(va(hip, vk(dir, a)), vk(perp, h))
    const ank = va(hip, vk(dir, L))
    const z = (hip[2] + knee[2] + ank[2]) / 3
    return {
      z,
      draw: () => {
        const tb = tube([p2(hip), p2(knee), p2(ank)], [10.5, 7, 4.4], 6)
        drawTube(out, tb, 200 + s * 17, { hatch: [0.05, 0.78], count: 18, len: 8 })
        // Pfote (weiße „Söckchen“)
        const toe = va(ank, mv(Rf, [s * 1, 3.2, 11]))
        const sock = va(ank, vk(dir, -5))
        const paw = wob(capsule(p2(sock), 4.1, p2(toe), 4.6, 5), 230 + s, 0.25)
        out.push({ t: 'f', d: smooth(paw, true), c: 'paper' })
        out.push({
          t: 'i',
          d: inkRuns(
            paw,
            [
              [1, 3],
              [paw.length - 3, 2],
            ],
            231 + s,
          ),
        })
        const tp = p2(toe)
        const ax = p2(vs(toe, ank))
        const al = Math.hypot(ax[0], ax[1]) || 1
        const ux: P2 = [ax[0] / al, ax[1] / al],
          pe: P2 = [-ux[1], ux[0]]
        for (const o of [-1.9, 1.9]) {
          const b: P2 = [tp[0] + pe[0] * o - ux[0] * 1.2, tp[1] + pe[1] * o - ux[1] * 1.2]
          out.push({ t: 'i', d: `M${pt(b)}L${pt([b[0] + ux[0] * 3.6, b[1] + ux[1] * 3.6])}` })
        }
      },
    }
  })

  // Arme
  const sh = (s: number) => {
    const q = torsoSurf(S, 0.76, 0)
    void q
    const k = 4,
      t = 0.56
    const A = S[k]!,
      B = S[k + 1]!
    const c: V3 = [lerp(A.c[0], B.c[0], t), lerp(A.c[1], B.c[1], t), lerp(A.c[2], B.c[2], t)]
    return va(c, mv(A.R, [s * (lerp(A.a, B.a, t) - 1.2), 0, 0]))
  }
  const arms = ([-1, 1] as const).map((s) => {
    const a1 = s < 0 ? p.la1 : p.ra1,
      a2 = s < 0 ? p.la2 : p.ra2,
      b = s < 0 ? p.lb : p.rb,
      be = s < 0 ? p.lbe : p.rbe
    const J = chain(sh(s), Rc, s, b, [a1, a2, a2], [19, 17, 6], be)
    const z = (J[0]![2] + J[1]![2] + J[2]![2] + J[3]![2]) / 4
    return {
      z,
      draw: () => {
        const tb = tube(J.map(p2), [5.2, 4.6, 4.0, 4.2], 6)
        drawTube(out, tb, 300 + s * 13, { hatch: [0.08, 0.66], count: 12, len: 7 })
        // Pfote
        const e = p2(J[3]!),
          w = p2(J[2]!)
        const wl = Math.hypot(e[0] - w[0], e[1] - w[1]) || 1
        const u: P2 = [(e[0] - w[0]) / wl, (e[1] - w[1]) / wl]
        const pe: P2 = [-u[1], u[0]]
        const paw = wob(
          capsule(
            [w[0] - u[0] * 3, w[1] - u[1] * 3],
            4.0,
            [e[0] + u[0] * 2, e[1] + u[1] * 2],
            4.5,
            5,
          ),
          330 + s,
          0.22,
        )
        out.push({ t: 'f', d: smooth(paw, true), c: 'paper' })
        out.push({
          t: 'i',
          d: inkRuns(
            paw,
            [
              [2, 3],
              [paw.length - 2, 3],
            ],
            331 + s,
          ),
        })
        const tip: P2 = [e[0] + u[0] * 5.5, e[1] + u[1] * 5.5]
        for (const o of [-1.6, 1.6]) {
          const b0: P2 = [tip[0] + pe[0] * o - u[0] * 3.4, tip[1] + pe[1] * o - u[1] * 3.4]
          out.push({ t: 'i', d: `M${pt(b0)}L${pt([b0[0] + u[0] * 3, b0[1] + u[1] * 3])}` })
        }
      },
    }
  })

  // Schwanz
  const T0 = va(C0, mv(R0, [0, 3, -10]))
  const tl = [9, 9, 9, 9, 8]
  const wave = (i: number) => p.tm * Math.sin(p.tp - i * 0.85) * (0.6 + 0.2 * i)
  const ta = [0, 1, 2, 3, 4].map((i) => p.ta + p.tc * i + wave(i))
  const TJ = chain(T0, R0, 1, -p.tb, ta, tl)
  const tailZ = (TJ[2]![2] + TJ[3]![2]) / 2 - C0[2]
  const drawTail = () => {
    const tb = tube(TJ.map(p2), [4.6, 6.6, 7.6, 7, 5, 1.5], 5)
    out.push({ t: 'f', d: smooth(tb.poly, true), c: 'wash' })
    // weiße Schwanzspitze (Papier)
    const tip = tube([tb.at(0.72, 0), tb.at(0.86, 0), tb.at(1, 0)], [4.4, 3.2, 1.2], 4)
    out.push({ t: 'f', d: smooth(tip.poly, true), c: 'paper' })
    let h = ''
    for (let i = 0; i < 12; i++) {
      const t = 0.08 + (i / 12) * 0.6
      h += slash(tb.poly, tb.at(t, (hs(400 + i) * 0.5 + (i % 2 ? 0.3 : -0.3)) * 3.4), 7)
    }
    if (h) out.push({ t: 'h', d: h })
    const n = tb.poly.length
    out.push({
      t: 'i',
      d: inkRuns(
        wob(tb.poly, 410),
        [
          [n - 3, 6],
          [Math.floor(n * 0.7), 2],
        ],
        410,
      ),
    })
  }

  // Maler-Reihenfolge
  const beforeTorso = legs.filter((l) => l.z <= 8)
  if (tailZ < 0) drawTail()
  beforeTorso.sort((a, b) => a.z - b.z).forEach((l) => l.draw())
  const farArms = arms.filter((a) => a.z < -6)
  farArms.sort((a, b) => a.z - b.z).forEach((a) => a.draw())

  // Rumpf
  const left: P2[] = [],
    right: P2[] = []
  for (const sc of S) {
    const ax = sc.R[0][0] * sc.a,
      bz = sc.R[0][2] * sc.b
    const w = Math.hypot(ax, bz) || 1
    const sp = ax / w,
      cp = bz / w
    const v = mv(sc.R, [sc.a * sp, 0, sc.b * cp])
    right.push([sc.c[0] + v[0], sc.c[1] + v[1]])
    left.push([sc.c[0] - v[0], sc.c[1] - v[1]])
  }
  const bot = p2(va(S[0]!.c, mv(S[0]!.R, [0, 8, 0])))
  const tp = p2(va(top.c, mv(top.R, [0, -3, 0])))
  const torso = wob([tp, ...left.slice().reverse(), bot, ...right], 500, 0.3)
  out.push({ t: 'f', d: smooth(torso, true), c: 'wash' })
  // weiße Brust und Bauch (Papier): Streifen vorn zwischen φ = ±38°
  const bib: P2[] = []
  const bibEdge = (sgn: number, ss: number[]) => {
    for (const sv of ss) {
      const q = torsoSurf(S, sv, sgn * 40)
      if (q.nz > 0.04) bib.push(q.p)
    }
  }
  bibEdge(1, [0.96, 0.8, 0.6, 0.4, 0.2, 0.06])
  for (const phi of [26, 0, -26]) {
    const q = torsoSurf(S, 0.0, phi)
    if (q.nz > 0.04) bib.push(q.p)
  }
  bibEdge(-1, [0.06, 0.2, 0.4, 0.6, 0.8, 0.96])
  if (bib.length > 6) out.push({ t: 'f', d: smooth(bib, true), c: 'paper' })
  let h = ''
  for (let i = 0; i < 130; i++) {
    const s = 0.04 + fr(i * 0.6180339) * 0.92
    const phi = (i % 2 ? 1 : -1) * (46 + fr(i * 0.7548777) * 120)
    const q = torsoSurf(S, s, phi)
    // Dichte ausgleichen: wo die Fläche dem Betrachter voll zugewandt ist (Seitenansicht), nur ein Drittel der Striche
    const thin = ramp(1 - 0.68 * ramp(q.nz, 0.5, 0.95) - fr(i * 0.41 + 0.13), 0, 0.1)
    const vis = ramp(q.nz, 0.12 + 0.4 * fr(i * 0.31), 0.26 + 0.4 * fr(i * 0.31)) * thin
    if (vis <= 0.05) continue
    h += slash(torso, q.p, (8 + hs(i) * 1.6) * vis)
  }
  if (h) out.push({ t: 'h', d: h })
  const tn = torso.length
  out.push({
    t: 'i',
    d: inkRuns(
      torso,
      [
        [0, 2],
        [7, 3],
        [Math.floor(tn * 0.3), 2],
      ],
      510,
    ),
  })
  // Brustkrause (weiße Brust)
  const ruff: P2[] = []
  let okr = true
  for (const phi of [-36, -18, 0, 18, 36]) {
    const q = torsoSurf(S, 0.6 - 0.08 * (1 - (phi / 40) ** 2), phi)
    if (q.nz < 0.5) okr = false
    ruff.push(q.p)
  }
  void okr
  void ruff
  // rotes Geschirr wie auf Cocos Sprite: Halsband mit D-Ring (liegt unter dem Kinn)
  const up: P2[] = [],
    lo: P2[] = []
  for (const phi of [-86, -58, -29, 0, 29, 58, 86]) {
    const a = torsoSurf(S, 0.84, phi),
      b = torsoSurf(S, 0.7 + 0.02 * Math.cos(phi * D), phi)
    if (a.nz > 0.04 && b.nz > 0.04) {
      up.push(a.p)
      lo.push(b.p)
    }
  }
  if (up.length > 2) {
    const band = [...up, ...lo.reverse()]
    out.push({ t: 'f', d: smooth(band, true), c: 'harness', k: 'collar' })
    out.push({ t: 'i', d: smooth(band, true) })
    const ring = torsoSurf(S, 0.7, 0)
    if (ring.nz > 0.5)
      out.push({ t: 'i', d: smooth(ellipse([ring.p[0], ring.p[1] + 2.4], 2.4, 2.6, 8), true) })
  }

  // Kopf
  const hy = mm(mm(mm(Rc, ry(p.hy)), rx(-p.hp)), rz(p.hr))
  const Rh = mm(S[6]!.R, mm(mm(ry(p.hy), rx(-p.hp)), rz(p.hr)))
  void hy
  const hc = va(top.c, mv(Rh, [0, -15, 1.2]))

  const midArms = arms.filter((a) => a.z >= -6 && a.z < 12)
  midArms.forEach((a) => a.draw())
  head(out, p, hc, Rh, 700)
  arms.filter((a) => a.z >= 12).forEach((a) => a.draw())
  legs.filter((l) => l.z > 8).forEach((l) => l.draw())
  if (tailZ >= 0) drawTail()
  return out
}

/** Bodenlinie: dicker, mehrfach übermalter Tuschestrich (wie auf Juttas Skizzen). */
export function ground(): Draw[] {
  const y = GROUND
  return [
    { t: 'w', d: `M30 ${y}Q70 ${y - 1.2} 104 ${y}T170 ${y - 0.4}` },
    { t: 'w', d: `M34 ${y + 1.4}Q80 ${y + 0.4} 118 ${y + 1.2}T166 ${y + 0.6}` },
    { t: 'w', d: `M40 ${y - 0.6}Q90 ${y + 1} 136 ${y - 0.2}T160 ${y + 0.4}` },
  ]
}

/** Zeichenliste → SVG-Text (Standbild, Prüfbilder). */
export function toSvg(
  draws: Draw[],
  opt: { paper?: string; bg?: boolean; vb?: string } = {},
): string {
  const paper = opt.paper ?? COLORS.paper
  const col = {
    paper,
    wash: COLORS.wash,
    harness: COLORS.harness,
    ink: COLORS.ink,
    tongue: COLORS.tongue,
  }
  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${opt.vb ?? `0 0 ${W} ${H}`}" stroke-linecap="round" stroke-linejoin="round">`
  if (opt.bg) s += `<rect x="-50" y="-50" width="${W + 100}" height="${H + 100}" fill="${paper}"/>`
  s += `<g transform="translate(${VIEW.ox} ${VIEW.oy}) scale(${VIEW.s}) translate(${-VIEW.ox} ${-VIEW.oy})">`
  for (const d of draws) {
    if (d.t === 'f') s += `<path d="${d.d}" fill="${col[d.c!]}"/>`
    else if (d.t === 'i')
      s += `<path d="${d.d}" fill="none" stroke="${COLORS.ink}" stroke-width="${INK_W}"/>`
    else if (d.t === 'h')
      s += `<path d="${d.d}" fill="none" stroke="${COLORS.crayon}" stroke-width="${CRAYON_W}" stroke-dasharray="${CRAYON_DASH.join(' ')}" opacity=".9"/>`
    else s += `<path d="${d.d}" fill="none" stroke="${COLORS.ink}" stroke-width="${GROUND_W}"/>`
  }
  return s + '</g></svg>\n'
}
