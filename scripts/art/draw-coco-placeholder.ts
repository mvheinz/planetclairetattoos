// `pnpm art:coco-placeholder` (PLAN P2.18, DESIGN §10): zeichnet den **Platzhalter**-Sprite von Coco
// (`src/art/coco/coco-sprite.svg`) – 6 Posen × 3 Frames (A/B/C) + 4 Brücken = 22 Symbole. Deterministisch (Seed je
// Symbol), damit der Platzhalter reproduzierbar bleibt, bis P9 die Zeichnungen von Hand ersetzt (IDs, viewBox und
// Anker-Metadaten bleiben, §10.4 „Platzhalter bis P9“).
//
// Aufbau: kleines Figuren-Gerüst (Rumpf, Kopf seitlich bzw. ¾, Beine als Gelenkketten, Sichelschwanz, Geschirr mit
// D-Ring) nach dem Charakterblatt §10.1 (Einheit K = Kopflänge ≈ 38), Grundlage `coco-run` der Konzeptseite. Jeder Frame
// zeichnet **jede** Linie neu nach (Punktabweichung 0,5–1,5 Einheiten), mit Handmerkmalen je Frame (§10.2): 2 offene
// Stellen, Überstände an den Beinansätzen, eine doppelt nachgezogene Kontur. Nur `<path>`, keine Formen-Primitive.
// Referenzfotos (`content/seed/instagram/highlight-*.jpg`) nur als Vorlage, nie im Ergebnis.
import { writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

import { fnv1a } from '../../src/lib/stringHash'

export type P = [number, number]
export type Layer = 'fur' | 'harness' | 'line' | 'solid' | 'hi'
export const PARTS = [
  'head',
  'snout',
  'nose',
  'ear-l',
  'ear-r',
  'eye-l',
  'eye-r',
  'body',
  'leg-fl',
  'leg-fr',
  'leg-hl',
  'leg-hr',
  'tail',
  'harness',
  'ring',
] as const
export type Part = (typeof PARTS)[number]

interface Stroke {
  layer: Layer
  part: Part
  pts: P[]
  closed?: boolean
  /** Handmerkmal: offene Stelle (gap), Doppelkontur (double), Überstand am Ende (over). */
  feature?: 'gap' | 'double' | 'over'
  /** Zitter-Faktor (Standard 1; Füllungen weniger, D-Ring kaum). */
  jitter?: number
}

interface Figure {
  strokes: Stroke[]
  ring: P
  hidden: Part[]
}

export const SPRITE_POSES = [
  'rennen',
  'schnueffeln',
  'sitzen',
  'schlafen',
  'springen',
  'kopfschief',
] as const
export const BRIDGES = ['bremsen', 'abspringen', 'einrollen-1', 'einrollen-2'] as const
export const GROUND_Y = 112

// ---------- Geometrie ----------

const DEG = Math.PI / 180

interface Tf {
  x: number
  y: number
  rot?: number
  sx?: number
  sy?: number
}

function apply(t: Tf, [px, py]: P): P {
  const sx = (t.sx ?? 1) * px
  const sy = (t.sy ?? 1) * py
  const a = (t.rot ?? 0) * DEG
  return [t.x + sx * Math.cos(a) - sy * Math.sin(a), t.y + sx * Math.sin(a) + sy * Math.cos(a)]
}
const map = (t: Tf, pts: P[]): P[] => pts.map((p) => apply(t, p))

function rotAround(pts: P[], [cx, cy]: P, deg: number): P[] {
  return map(
    { x: cx, y: cy, rot: deg },
    pts.map(([x, y]) => [x - cx, y - cy]),
  )
}

const add = (a: P, b: P): P => [a[0] + b[0], a[1] + b[1]]
const sub = (a: P, b: P): P => [a[0] - b[0], a[1] - b[1]]
const mul = (a: P, k: number): P => [a[0] * k, a[1] * k]
const len = (a: P) => Math.hypot(a[0], a[1])
const norm = (a: P): P => {
  const l = len(a) || 1
  return [a[0] / l, a[1] / l]
}
const lerp = (a: P, b: P, t: number): P => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]

/** Leicht unruhiges Ei (keine perfekte Ellipse, §10.2). */
function egg(c: P, rx: number, ry: number, tilt = 0, n = 6): P[] {
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * 2 * Math.PI
    const k = 1 + 0.07 * Math.sin(a * 2 + 0.6)
    return apply({ x: c[0], y: c[1], rot: tilt }, [Math.cos(a) * rx * k, Math.sin(a) * ry])
  })
}

/**
 * Bein als Gelenkkette ab `pivot` (Winkel in Grad aus der Senkrechten, positiv = in Blickrichtung), gezeichnet als
 * U-Form (hinten hinunter, Pfote, vorn hinauf; oben offen – Ansatz am Körper).
 */
function leg(pivot: P, segs: [number, number][], w: number, face: 1 | -1, paw = 6.2): P[] {
  const joints: P[] = [pivot]
  let p = pivot
  for (const [l, a] of segs) {
    p = add(p, [Math.sin(a * DEG) * l * face, Math.cos(a * DEG) * l])
    joints.push(p)
  }
  const back: P[] = []
  const front: P[] = []
  joints.forEach((j, i) => {
    const d = norm(sub(joints[Math.min(i + 1, joints.length - 1)]!, joints[Math.max(i - 1, 0)]!))
    // Normale zur Blickrichtung hin
    let n: P = [-d[1], d[0]]
    if (n[0] * face < 0) n = mul(n, -1)
    const taper = i === joints.length - 1 ? 0.85 : 1
    back.push(add(j, mul(n, (-w / 2) * taper)))
    front.push(add(j, mul(n, (w / 2) * taper)))
  })
  const e = joints[joints.length - 1]!
  const d = norm(sub(e, joints[joints.length - 2]!))
  let f: P = [-d[1], d[0]]
  if (f[0] * face < 0) f = mul(f, -1)
  const toe = add(add(e, mul(f, w / 2 + paw * 0.8)), mul(d, 0.6))
  const sole: P[] = [
    add(add(e, mul(f, -w / 2)), mul(d, 1.6)),
    add(add(e, mul(f, paw * 0.35)), mul(d, 2.1)),
    toe,
  ]
  return [...back, ...sole, ...front.slice(0, -1).reverse()]
}

/** Schwanz: sich verjüngender Umriss entlang der Mittellinie `c` (Wurzelbreite `w0`). */
function tail(c: P[], w0: number): P[] {
  const a: P[] = []
  const b: P[] = []
  c.forEach((p, i) => {
    const d = norm(sub(c[Math.min(i + 1, c.length - 1)]!, c[Math.max(i - 1, 0)]!))
    const n: P = [-d[1], d[0]]
    const w = (w0 * (1 - i / (c.length - 1)) + 0.5) / 2
    a.push(add(p, mul(n, w)))
    b.push(add(p, mul(n, -w)))
  })
  return [...a, ...b.slice(0, -1).reverse()]
}

// ---------- Köpfe (lokal, Mittelpunkt Schädel, Blick nach +x; K ≈ 38) ----------

interface HeadOpts {
  earNear?: number
  earFar?: number
  eyesClosed?: boolean
  flatEars?: boolean
}

function sideHead(t: Tf, o: HeadOpts = {}): Stroke[] {
  const earN = rotAround(
    [
      [-10, -11],
      [-14.5, -24],
      [-12.5, -37],
      [-8, -42.5],
      [-1.5, -34],
      [3, -22],
      [5.5, -12.5],
    ],
    [-3, -11],
    (o.earNear ?? 0) + (o.flatEars ? -62 : 0),
  )
  const earNIn = rotAround(
    [
      [-6.5, -17],
      [-7, -32],
    ],
    [-3, -11],
    (o.earNear ?? 0) + (o.flatEars ? -62 : 0),
  )
  const earF = rotAround(
    [
      [-13, -8],
      [-20.5, -21],
      [-22.5, -34],
      [-19, -38],
      [-13.5, -29],
      [-10, -18],
    ],
    [-12, -9],
    (o.earFar ?? 0) + (o.flatEars ? -55 : 0),
  )
  const s: Stroke[] = [
    {
      layer: 'line',
      part: 'head',
      pts: [
        [-4, 10],
        [-12, 6.5],
        [-14.5, -3],
        [-10, -12.5],
        [0, -16],
        [9, -12.5],
        [12, -6.5],
      ],
    },
    {
      layer: 'line',
      part: 'snout',
      pts: [
        [12, -6.5],
        [15.5, -4.5],
        [20, -3],
        [22.5, -1],
      ],
    },
    {
      layer: 'line',
      part: 'snout',
      pts: [
        [22, 2.5],
        [17.5, 5.5],
        [11, 7.5],
        [4, 9.5],
        [-2.5, 10.2],
      ],
    },
    {
      layer: 'line',
      part: 'snout',
      pts: [
        [17, 1],
        [24, -0.8],
        [29, 0.2],
      ],
    },
    {
      layer: 'line',
      part: 'snout',
      pts: [
        [17, 3],
        [23, 4],
        [28, 6],
      ],
    },
    { layer: 'line', part: 'ear-l', pts: earN, feature: 'double' },
    { layer: 'line', part: 'ear-l', pts: earNIn },
    { layer: 'line', part: 'ear-r', pts: earF },
    { layer: 'solid', part: 'nose', pts: egg([22.4, 0.3], 2.4, 2, -10, 5), closed: true },
    {
      layer: 'fur',
      part: 'head',
      pts: [
        [-13.5, -2],
        [-10, -12.5],
        [0, -15.5],
        [9, -12.5],
        [10, -6],
        [2, -7],
        [-4, -2],
        [-10, 3],
      ],
      closed: true,
      jitter: 0.5,
    },
    { layer: 'fur', part: 'ear-l', pts: earN, closed: true, jitter: 0.5 },
  ]
  if (o.eyesClosed)
    s.push({
      layer: 'line',
      part: 'eye-l',
      pts: [
        [1, -4],
        [5, -2],
        [9, -3.6],
      ],
    })
  else {
    s.push({ layer: 'solid', part: 'eye-l', pts: egg([5, -4], 4.6, 3.9, -12), closed: true })
    s.push({
      layer: 'hi',
      part: 'eye-l',
      pts: egg([6.6, -5.5], 1.3, 1.1, 0, 3),
      closed: true,
      jitter: 0.2,
    })
  }
  return s.map((st) => ({ ...st, pts: map(t, st.pts) }))
}

function frontHead(t: Tf, o: { knick?: boolean } = {}): Stroke[] {
  const earR: P[] = o.knick
    ? [
        [5, -12],
        [10, -26],
        [15, -34],
        [22, -33],
        [19, -27],
        [17, -18],
        [13, -6],
      ]
    : [
        [4.5, -12],
        [9.5, -26],
        [15.5, -36],
        [20.5, -33],
        [20, -19],
        [14, -5],
      ]
  const earL: P[] = [
    [-13, -5],
    [-19.5, -18],
    [-21, -33],
    [-16.5, -37],
    [-8, -27],
    [-3.5, -12],
  ]
  const s: Stroke[] = [
    {
      layer: 'line',
      part: 'head',
      pts: [
        [-12, 7],
        [-15, -3],
        [-10, -11.5],
        [0, -14],
        [10, -11],
        [14, -3],
        [12, 5],
      ],
      feature: 'gap',
    },
    {
      layer: 'line',
      part: 'snout',
      pts: [
        [-7, 5],
        [-4, 11],
        [3, 13],
        [9, 10.5],
        [11, 4.5],
      ],
    },
    {
      layer: 'line',
      part: 'snout',
      pts: [
        [0, 10.5],
        [3, 11.6],
        [6, 10.2],
      ],
    },
    {
      layer: 'line',
      part: 'snout',
      pts: [
        [9, 8],
        [17, 6],
        [24, 7],
      ],
    },
    {
      layer: 'line',
      part: 'snout',
      pts: [
        [9, 10],
        [16, 11.5],
        [22, 14],
      ],
    },
    {
      layer: 'line',
      part: 'snout',
      pts: [
        [-4, 8],
        [-11, 7],
        [-17, 9],
      ],
    },
    { layer: 'line', part: 'ear-l', pts: earL, feature: 'double' },
    {
      layer: 'line',
      part: 'ear-l',
      pts: [
        [-13, -12],
        [-15.5, -30],
      ],
    },
    { layer: 'line', part: 'ear-r', pts: earR },
    {
      layer: 'line',
      part: 'ear-r',
      pts: o.knick
        ? [
            [11, -12],
            [14, -26],
          ]
        : [
            [12, -12],
            [16, -30],
          ],
    },
    {
      layer: 'solid',
      part: 'nose',
      pts: [
        [0.8, 4.4],
        [3, 3.8],
        [5.4, 4.5],
        [4.8, 6.6],
        [3, 7.5],
        [1.4, 6.4],
      ],
      closed: true,
    },
    { layer: 'solid', part: 'eye-l', pts: egg([-5.5, -1.5], 4.1, 3.8, 8), closed: true },
    { layer: 'solid', part: 'eye-r', pts: egg([8, -1.8], 3.8, 3.6, -6), closed: true },
    { layer: 'hi', part: 'eye-l', pts: egg([-4.2, -3.1], 1.2, 1, 0, 3), closed: true, jitter: 0.2 },
    {
      layer: 'hi',
      part: 'eye-r',
      pts: egg([9.2, -3.3], 1.1, 0.9, 0, 3),
      closed: true,
      jitter: 0.2,
    },
    {
      layer: 'fur',
      part: 'head',
      pts: [
        [-14, -2],
        [-10, -11],
        [-2.5, -13.5],
        [-2.5, -6],
        [-8, 2],
      ],
      closed: true,
      jitter: 0.5,
    },
    {
      layer: 'fur',
      part: 'head',
      pts: [
        [3, -13.5],
        [10, -11],
        [13.5, -3],
        [11, 3],
        [4, -5],
      ],
      closed: true,
      jitter: 0.5,
    },
    { layer: 'fur', part: 'ear-l', pts: earL, closed: true, jitter: 0.5 },
    { layer: 'fur', part: 'ear-r', pts: earR, closed: true, jitter: 0.5 },
  ]
  return s.map((st) => ({ ...st, pts: map(t, st.pts) }))
}

// ---------- Seitenansicht: Rumpf + Kopf + Beine + Schwanz ----------

interface SideRig {
  torso: Tf
  /** Wölbung des Rückens (Sammlung beim Rennen). */
  arch?: number
  head: Tf
  headOpts?: HeadOpts
  /** Beine: Winkel je Segment (Grad aus der Senkrechten, + = nach vorn). */
  fl: [number, number][]
  fr: [number, number][]
  hl: [number, number][]
  hr: [number, number][]
  /** Schwanz-Mittellinie im Rumpf-System ab der Wurzel. */
  tail: P[]
}

function sideFigure(r: SideRig): Figure {
  const T = r.torso
  const arch = r.arch ?? 0
  const back: P[] = [
    [-33, 5.5],
    [-37.5, 1],
    [-35, -4.5],
    [-27, -11 - arch * 0.6],
    [-10, -13.5 - arch],
    [8, -14 - arch * 0.8],
    [24, -17],
  ]
  const belly: P[] = [
    [35, -2],
    [36.5, 8],
    [30, 15],
    [20, 16.5],
    [4, 13],
    [-10, 7 - arch * 0.3],
    [-22, 6.5],
    [-31, 4],
  ]
  const furTorso: P[] = [
    [-36, 1],
    [-35, -5],
    [-27, -11 - arch * 0.6],
    [-10, -13.5 - arch],
    [8, -14 - arch * 0.8],
    [24, -17],
    [27, -9],
    [14, -3],
    [0, -1.5],
    [-16, -0.5],
    [-30, 3],
  ]
  const band: P[] = [
    [12, -14.6 - arch * 0.8],
    [16.8, -15.4 - arch * 0.6],
    [20.3, 15.6],
    [15.6, 15.1],
  ]
  const ringLocal: P = [14.4, -18.3 - arch * 0.7]
  const ring = apply(T, ringLocal)
  // Hals: Rückenlinie zum Hinterkopf, Kehle zum Kiefer (Kopf-System → Welt)
  const nb0 = apply(T, [24, -17])
  const nb1 = apply(r.head, [-10, 3])
  const th0 = apply(T, [35, -2])
  const th1 = apply(r.head, [-1, 9])
  const neckBack: P[] = [nb0, add(lerp(nb0, nb1, 0.5), [-1.2, -1.5]), nb1]
  const throat: P[] = [th0, add(lerp(th0, th1, 0.5), [1.5, 0.5]), th1]
  const collar: P[] = [
    lerp(nb0, nb1, 0.52),
    lerp(nb0, nb1, 0.78),
    lerp(th0, th1, 0.8),
    lerp(th0, th1, 0.5),
  ]
  const face: 1 | -1 = 1
  const W = 4.4
  const legOf = (pivot: P, segs: [number, number][]) => leg(apply(T, pivot), segs, W, face)
  const strokes: Stroke[] = [
    // hintere (verdeckte) Beine zuerst
    { layer: 'line', part: 'leg-hr', pts: legOf([-22, 0], r.hr) },
    { layer: 'line', part: 'leg-fr', pts: legOf([30, 4], r.fr) },
    { layer: 'line', part: 'body', pts: map(T, back), feature: 'gap' },
    { layer: 'line', part: 'body', pts: map(T, belly), feature: 'gap' },
    { layer: 'line', part: 'body', pts: neckBack },
    { layer: 'line', part: 'body', pts: throat },
    { layer: 'line', part: 'leg-hl', pts: legOf([-27, 1], r.hl), feature: 'over' },
    { layer: 'line', part: 'leg-fl', pts: legOf([24, 5], r.fl), feature: 'over' },
    { layer: 'line', part: 'tail', pts: tail(map(T, r.tail), 4.4) },
    { layer: 'fur', part: 'body', pts: map(T, furTorso), closed: true, jitter: 0.5 },
    { layer: 'fur', part: 'tail', pts: tail(map(T, r.tail), 4.4), closed: true, jitter: 0.5 },
    { layer: 'harness', part: 'harness', pts: map(T, band), closed: true, jitter: 0.5 },
    { layer: 'harness', part: 'harness', pts: collar, closed: true, jitter: 0.5 },
    { layer: 'line', part: 'ring', pts: egg(ring, 2.4, 2.1, 20, 4), closed: true, jitter: 0.25 },
    ...sideHead({ sx: 1.12, sy: 1.12, ...r.head }, r.headOpts),
  ]
  return { strokes, ring, hidden: ['eye-r'] }
}

// Schwanz-Formen (Rumpf-System, Wurzel am Po)
const TAIL_UP: P[] = [
  [-35, -5],
  [-42, -12],
  [-44, -24],
  [-38, -33],
  [-29, -33],
]
const TAIL_BACK: P[] = [
  [-35, -5],
  [-44, -10],
  [-52, -18],
  [-56, -28],
  [-53, -33],
]
const TAIL_CURL: P[] = [
  [-35, -5],
  [-41, -15],
  [-40, -27],
  [-31, -31],
  [-26, -25],
]

/** Stehend/rennend: Rumpf-Mitte (78, 73), Füße auf 112. */
function rennen(frame: 'a' | 'b' | 'c'): Figure {
  const base = { x: 76, y: 73 }
  const head: Tf = { x: 124, y: 50, rot: 8 }
  const headOpts: HeadOpts = { earNear: -22, earFar: -30 }
  if (frame === 'a')
    return sideFigure({
      torso: { ...base, rot: -2, sx: 1.05 },
      head,
      headOpts,
      fl: [
        [17, 48],
        [16, 70],
      ],
      fr: [
        [17, 34],
        [16, 58],
      ],
      hl: [
        [16, -48],
        [11, -80],
        [9, -70],
      ],
      hr: [
        [16, -36],
        [11, -66],
        [9, -58],
      ],
      tail: TAIL_BACK,
    })
  if (frame === 'b')
    return sideFigure({
      torso: { ...base, y: base.y + 0.5, rot: 1 },
      arch: 3.5,
      head: { ...head, y: head.y + 2, rot: 12 },
      headOpts,
      fl: [
        [17, -18],
        [15, -52],
      ],
      fr: [
        [17, -6],
        [15, -34],
      ],
      hl: [
        [15, 42],
        [11, 5],
        [9, 20],
      ],
      hr: [
        [15, 30],
        [11, -8],
        [9, 8],
      ],
      tail: TAIL_UP,
    })
  return sideFigure({
    torso: { ...base, y: base.y - 1.5, rot: -1, sx: 1.02 },
    arch: 1.5,
    head: { ...head, y: head.y - 1.5, rot: 4 },
    headOpts,
    fl: [
      [16, 62],
      [13, -15],
    ],
    fr: [
      [16, 50],
      [13, -30],
    ],
    hl: [
      [15, -22],
      [11, 62],
      [8, 10],
    ],
    hr: [
      [15, -32],
      [11, 50],
      [8, 0],
    ],
    tail: TAIL_BACK,
  })
}

function schnueffeln(frame: 'a' | 'b' | 'c'): Figure {
  return sideFigure({
    torso: { x: 72, y: 76, rot: 7 },
    head: { x: 116, y: 88 + (frame === 'c' ? 1 : 0), rot: 38 },
    headOpts: { earNear: 18, earFar: 12 },
    fl: [
      [16, 14],
      [15, -6],
    ],
    fr: [
      [16, 4],
      [15, -14],
    ],
    hl: [
      [15, 12],
      [10, -28],
      [10, 4],
    ],
    hr: [
      [15, 2],
      [10, -36],
      [10, -2],
    ],
    tail: TAIL_CURL,
  })
}

function springen(): Figure {
  return sideFigure({
    torso: { x: 76, y: 76, rot: -24 },
    head: { x: 118, y: 40, rot: -14 },
    headOpts: { earNear: -18, earFar: -26 },
    fl: [
      [15, 110],
      [13, 40],
    ],
    fr: [
      [15, 96],
      [13, 26],
    ],
    hl: [
      [16, -70],
      [11, -100],
      [9, -90],
    ],
    hr: [
      [16, -58],
      [11, -88],
      [9, -80],
    ],
    tail: TAIL_BACK,
  })
}

function bremsen(): Figure {
  return sideFigure({
    torso: { x: 72, y: 75, rot: -7 },
    head: { x: 116, y: 49, rot: -6 },
    headOpts: { earNear: 12, earFar: 6 },
    fl: [
      [17, 38],
      [16, 40],
    ],
    fr: [
      [17, 28],
      [16, 32],
    ],
    hl: [
      [15, 22],
      [11, -10],
      [9, 12],
    ],
    hr: [
      [15, 12],
      [11, -20],
      [9, 4],
    ],
    tail: TAIL_UP,
  })
}

function abspringen(): Figure {
  return sideFigure({
    torso: { x: 76, y: 83, rot: 3 },
    arch: 2.5,
    head: { x: 121, y: 62, rot: 6 },
    headOpts: { earNear: -8, earFar: -14 },
    fl: [
      [14, -38],
      [13, 32],
    ],
    fr: [
      [14, -46],
      [13, 22],
    ],
    hl: [
      [14, 62],
      [11, -58],
      [8, 10],
    ],
    hr: [
      [14, 54],
      [11, -66],
      [8, 4],
    ],
    tail: TAIL_UP,
  })
}

// ---------- Sitzen (Körper seitlich, Kopf ¾ zum Betrachter) ----------

function sitzenFigure(knick: boolean): Figure {
  const ring: P = [60.5, 67]
  const head: Tf = knick ? { x: 84, y: 41, rot: 20 } : { x: 83, y: 40, rot: -3 }
  const strokes: Stroke[] = [
    {
      layer: 'line',
      part: 'leg-fr',
      pts: leg(
        [95, 84],
        [
          [14, 2],
          [13, 0],
        ],
        4.3,
        1,
      ),
    },
    {
      layer: 'line',
      part: 'body',
      pts: [
        [73, 54],
        [63, 62],
        [56.5, 77],
        [54.5, 93],
        [58, 106],
        [66, 111],
      ],
      feature: 'gap',
    },
    {
      layer: 'line',
      part: 'body',
      pts: [
        [91, 57],
        [94, 69],
        [93, 80],
        [90, 89],
      ],
    },
    {
      layer: 'line',
      part: 'leg-hl',
      pts: [
        [58, 86],
        [66, 80.5],
        [76, 84.5],
        [80.5, 95],
        [78, 105],
        [71, 110.5],
      ],
      feature: 'gap',
    },
    {
      layer: 'line',
      part: 'leg-hl',
      pts: [
        [72, 110.5],
        [80, 112],
        [87, 111.5],
        [89.5, 109],
        [85, 107.5],
        [79, 107.8],
      ],
    },
    {
      layer: 'line',
      part: 'leg-fl',
      pts: leg(
        [87.5, 84],
        [
          [14, -2],
          [13, 1],
        ],
        4.5,
        1,
      ),
      feature: 'over',
    },
    {
      layer: 'line',
      part: 'tail',
      pts: tail(
        [
          [57, 106],
          [64, 113],
          [78, 114.5],
          [92, 114],
          [101, 109.5],
        ],
        4,
      ),
    },
    {
      layer: 'fur',
      part: 'body',
      pts: [
        [73, 54],
        [63, 62],
        [56.5, 77],
        [54.5, 93],
        [60, 99],
        [65, 84],
        [72, 70],
        [80, 60],
      ],
      closed: true,
      jitter: 0.5,
    },
    {
      layer: 'fur',
      part: 'leg-hl',
      pts: [
        [59, 87],
        [66, 81.5],
        [76, 85],
        [80, 95],
        [75, 103],
        [66, 99],
      ],
      closed: true,
      jitter: 0.5,
    },
    {
      layer: 'fur',
      part: 'tail',
      pts: tail(
        [
          [57, 106],
          [64, 113],
          [78, 114.5],
          [92, 114],
          [101, 109.5],
        ],
        4,
      ),
      closed: true,
      jitter: 0.5,
    },
    {
      layer: 'harness',
      part: 'harness',
      pts: [
        [59, 69.5],
        [62.5, 66],
        [89.5, 85],
        [87.5, 89],
      ],
      closed: true,
      jitter: 0.5,
    },
    {
      layer: 'harness',
      part: 'harness',
      pts: [
        [70, 55],
        [74.5, 51],
        [92, 57.5],
        [91, 62.5],
      ],
      closed: true,
      jitter: 0.5,
    },
    { layer: 'line', part: 'ring', pts: egg(ring, 2.4, 2.1, -30, 4), closed: true, jitter: 0.25 },
    ...frontHead(head, { knick }),
  ]
  return { strokes, ring, hidden: ['leg-hr'] }
}

// ---------- Liegen / Einrollen / Schlafen ----------

function einrollen1(): Figure {
  // halb liegend (Sphinx): Rumpf flach am Boden, Vorderbeine nach vorn, Kopf wach
  const T: Tf = { x: 70, y: 96, rot: 0, sy: 0.8 }
  const f = sideFigure({
    torso: T,
    head: { x: 114, y: 72, rot: 4 },
    headOpts: { earNear: -12, earFar: -20 },
    fl: [
      [10, 78],
      [16, 92],
    ],
    fr: [
      [10, 70],
      [15, 88],
    ],
    hl: [
      [12, 100],
      [11, -80],
      [6, -90],
    ],
    hr: [
      [12, 92],
      [10, -86],
      [6, -92],
    ],
    tail: [
      [-35, -4],
      [-42, 0],
      [-44, 9],
      [-37, 14],
    ],
  })
  return f
}

function curl(frame: string, awake: boolean): Figure {
  const ring: P = awake ? [85, 72.5] : [85, 73]
  const hatch: Stroke[] = [0, 1, 2, 3, 4].map((i) => ({
    layer: 'line' as const,
    part: 'body' as const,
    pts: [
      [52 + i * 13, 117],
      [56.5 + i * 13, 112.8],
    ] as P[],
    jitter: 0.6,
  }))
  // Rumpf-Bogen beginnt hinter dem Kopf (keine Linie durch den Kopf)
  const body: P[] = [
    [64, 84],
    [74, 77],
    [88, 75],
    [102, 80],
    [111, 91],
    [112, 104],
  ]
  // Kopf vorn links auf den Pfoten, Blick nach rechts zur Schwanzspitze (Nase im Schwanz)
  const head: Tf = awake
    ? { x: 58, y: 94, rot: -6, sx: 1.05, sy: 1.05 }
    : { x: 57, y: 101, rot: 6, sx: 1.02, sy: 1.02 }
  const strokes: Stroke[] = [
    { layer: 'line', part: 'body', pts: body, feature: 'gap' },
    {
      layer: 'line',
      part: 'body',
      pts: [
        [74, 112],
        [92, 112.8],
        [108, 111],
      ],
      feature: 'gap',
    },
    {
      layer: 'line',
      part: 'body',
      pts: [
        [70, 83],
        [80, 79],
        [92, 79],
      ],
      feature: 'double',
    },
    {
      layer: 'line',
      part: 'leg-fl',
      pts: leg(
        [76, 107],
        [
          [5, 70],
          [8, 88],
        ],
        4.2,
        1,
        5,
      ),
      feature: 'over',
    },
    {
      layer: 'line',
      part: 'tail',
      pts: tail(
        [
          [111, 103],
          [106, 111],
          [96, 114],
          [86, 113],
          [81, 109.5],
        ],
        4,
      ),
    },
    ...hatch,
    {
      layer: 'fur',
      part: 'body',
      pts: [
        [64, 86],
        [74, 77],
        [88, 75],
        [102, 80],
        [109, 90],
        [96, 93],
        [80, 91],
        [70, 94],
      ],
      closed: true,
      jitter: 0.5,
    },
    {
      layer: 'fur',
      part: 'tail',
      pts: tail(
        [
          [111, 103],
          [106, 111],
          [96, 114],
          [86, 113],
          [81, 109.5],
        ],
        4,
      ),
      closed: true,
      jitter: 0.5,
    },
    {
      layer: 'harness',
      part: 'harness',
      pts: [
        [82, 75.5],
        [87.5, 75],
        [89, 91.5],
        [83.5, 92],
      ],
      closed: true,
      jitter: 0.5,
    },
    { layer: 'line', part: 'ring', pts: egg(ring, 2.4, 2.1, 10, 4), closed: true, jitter: 0.25 },
    ...sideHead(head, {
      eyesClosed: !awake,
      flatEars: !awake,
      earNear: awake ? -34 : -8,
      earFar: awake ? -40 : -10,
    }),
  ]
  void frame
  return {
    strokes,
    ring,
    hidden: ['eye-r', 'leg-fr', 'leg-hl', 'leg-hr'],
  }
}

// ---------- Handmerkmale und Pfade ----------

function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Neu nachgezeichnet: jeder Punkt um 0,5–1,5 Einheiten (× Faktor) in zufällige Richtung versetzt. */
function retrace(pts: P[], rand: () => number, k: number): P[] {
  return pts.map(([x, y]) => {
    const a = rand() * 2 * Math.PI
    const r = (0.5 + rand()) * k * 0.7
    return [x + Math.cos(a) * r, y + Math.sin(a) * r]
  })
}

/** Polylinie an Bogenlängen-Anteil `t` teilen und `gap` Einheiten Lücke lassen. */
function splitGap(pts: P[], t: number, gap: number): [P[], P[]] {
  const lens = [0]
  for (let i = 1; i < pts.length; i++) lens.push(lens[i - 1]! + len(sub(pts[i]!, pts[i - 1]!)))
  const total = lens[lens.length - 1]!
  const at = (s: number): { p: P; i: number } => {
    for (let i = 1; i < pts.length; i++)
      if (lens[i]! >= s) {
        const u = (s - lens[i - 1]!) / (lens[i]! - lens[i - 1]! || 1)
        return { p: lerp(pts[i - 1]!, pts[i]!, u), i }
      }
    return { p: pts[pts.length - 1]!, i: pts.length - 1 }
  }
  const a = at(total * t - gap / 2)
  const b = at(total * t + gap / 2)
  return [
    [...pts.slice(0, a.i), a.p],
    [b.p, ...pts.slice(b.i)],
  ]
}

/** Auf halbe Einheiten gerundet (Handzeichnung verträgt es; hält den Sprite im Budget §9.10). */
const fmt = (n: number) => (Math.round(n * 2) / 2).toString()
/** Flächen (Fell, Geschirr) auf ganze Einheiten – der Wash ist ohnehin locker. */
const fmtInt = (n: number) => Math.round(n).toString()

/**
 * Glatter Linienzug als quadratischer B-Spline (Stützpunkte = Kontrollpunkte, Kurve läuft durch deren Mitten):
 * `M p0 Q p1 m12 T m23 … T pn` – kompakt (je Punkt nur ein `T`), weich wie ein Federstrich.
 */
export function toPath(pts: P[], closed = false, coarse = false): string {
  if (pts.length < 2) return ''
  const r = coarse ? fmtInt : fmt
  const f = (p: P) => `${r(p[0])} ${r(p[1])}`
  if (pts.length === 2) return `M${f(pts[0]!)}L${f(pts[1]!)}`
  if (closed) {
    const n = pts.length
    const mid = (i: number) => lerp(pts[i % n]!, pts[(i + 1) % n]!, 0.5)
    let d = `M${f(mid(n - 1))}Q${f(pts[0]!)} ${f(mid(0))}`
    for (let i = 1; i < n; i++) d += `T${f(mid(i))}`
    return `${d}Z`
  }
  const n = pts.length
  let d = `M${f(pts[0]!)}`
  if (n === 3) return `${d}Q${f(pts[1]!)} ${f(pts[2]!)}`
  d += `Q${f(pts[1]!)} ${f(lerp(pts[1]!, pts[2]!, 0.5))}`
  for (let i = 2; i < n - 2; i++) d += `T${f(lerp(pts[i]!, pts[i + 1]!, 0.5))}`
  // letzter Abschnitt: Kontrollpunkt p[n-2] bis zum Endpunkt
  return `${d}Q${f(pts[n - 2]!)} ${f(pts[n - 1]!)}`
}

function figureFor(pose: string, frame: string): Figure {
  const f = frame as 'a' | 'b' | 'c'
  switch (pose) {
    case 'rennen':
      return rennen(f)
    case 'schnueffeln':
      return schnueffeln(f)
    case 'sitzen':
      return sitzenFigure(false)
    case 'kopfschief':
      return sitzenFigure(true)
    case 'schlafen':
      return curl(frame, false)
    case 'springen':
      return springen()
    case 'bremsen':
      return bremsen()
    case 'abspringen':
      return abspringen()
    case 'einrollen-1':
      return einrollen1()
    case 'einrollen-2':
      return curl(frame, true)
  }
  throw new Error(`Unbekannte Pose ${pose}`)
}

export interface SymbolSpec {
  id: string
  pose: string
  frame: string
  bridge: boolean
}

export function symbolSpecs(): SymbolSpec[] {
  return [
    ...SPRITE_POSES.flatMap((pose) =>
      (['a', 'b', 'c'] as const).map((frame) => ({
        id: `coco-${pose}-${frame}`,
        pose,
        frame,
        bridge: false,
      })),
    ),
    ...BRIDGES.map((b) => ({ id: `coco-bridge-${b}`, pose: b, frame: 'a', bridge: true })),
  ]
}

function renderSymbol(spec: SymbolSpec): string {
  const fig = figureFor(spec.pose, spec.frame)
  const rand = mulberry32(fnv1a(spec.id))
  const byLayer = new Map<Layer, Map<Part, string[]>>()
  const push = (layer: Layer, part: Part, d: string) => {
    if (!d) return
    const parts = byLayer.get(layer) ?? new Map<Part, string[]>()
    byLayer.set(layer, parts)
    parts.set(part, [...(parts.get(part) ?? []), d])
  }
  for (const s of fig.strokes) {
    // Fell-Wash ist eine lockere Fläche: bei vielen Stützpunkten genügt jeder zweite (Budget §9.10).
    const src = s.layer === 'fur' && s.pts.length > 7 ? s.pts.filter((_, i) => i % 2 === 0) : s.pts
    const pts = retrace(src, rand, s.jitter ?? 1)
    if (s.feature === 'gap' && !s.closed) {
      const [a, b] = splitGap(pts, 0.3 + rand() * 0.4, 2.5 + rand() * 1.5)
      push(s.layer, s.part, toPath(a) + toPath(b))
      continue
    }
    if (s.feature === 'over' && !s.closed) {
      // Überstand: beide Enden 1–3 Einheiten über den Ansatz hinaus verlängert
      const first = pts[0]!
      const last = pts[pts.length - 1]!
      const e0 = add(first, mul(norm(sub(first, pts[1]!)), 1 + rand() * 2))
      const e1 = add(last, mul(norm(sub(last, pts[pts.length - 2]!)), 1 + rand() * 2))
      push(s.layer, s.part, toPath([e0, ...pts.slice(1, -1), e1]))
      continue
    }
    if (s.layer === 'harness') {
      // Gurte: gerade Kanten (flache Bänder), ganze Einheiten
      push(s.layer, s.part, `M${pts.map((p) => `${fmtInt(p[0])} ${fmtInt(p[1])}`).join('L')}Z`)
      continue
    }
    push(s.layer, s.part, toPath(pts, s.closed, s.layer === 'fur'))
    if (s.feature === 'double' && !s.closed) {
      // Doppelkontur: ein Teilstück (≈ 55 %) um 1–1,5 Einheiten versetzt noch einmal gezogen
      const from = Math.floor(rand() * Math.max(1, pts.length - 3))
      const sub3 = s.pts.slice(from, from + Math.max(3, Math.ceil(s.pts.length * 0.55)))
      const d = norm(sub(sub3[sub3.length - 1]!, sub3[0]!))
      const off = mul([-d[1], d[0]], 1 + rand() * 0.5)
      push(
        s.layer,
        s.part,
        toPath(
          retrace(
            sub3.map((p) => add(p, off)),
            rand,
            0.8,
          ),
        ),
      )
    }
  }
  const group = (layer: Layer, attrs = '') => {
    const parts = byLayer.get(layer)
    if (!parts) return ''
    const inner =
      layer === 'fur' || layer === 'hi'
        ? `<path d="${[...parts.values()].flat().join('')}"/>`
        : [...parts.entries()]
            .map(([part, ds]) => `<g data-part="${part}"><path d="${ds.join('')}"/></g>`)
            .join('')
    return `<g class="${layer}"${attrs}>${inner}</g>`
  }
  const riso = ' transform="translate(1.5 1.2)"'
  const hidden = fig.hidden.length ? ` data-hidden-parts="${fig.hidden.join(' ')}"` : ''
  return (
    `<symbol id="${spec.id}" viewBox="0 0 160 120" data-anchor-x="${fmt(fig.ring[0])}" ` +
    `data-anchor-y="${fmt(fig.ring[1])}" data-ground-y="${GROUND_Y}"${hidden}>` +
    group('fur', riso) +
    group('harness', riso) +
    group('line') +
    group('solid') +
    group('hi') +
    `</symbol>`
  )
}

/** Stil im Sprite selbst: Klone aus einer externen Datei (`<use href="…svg#id">`) erreicht nur das Stylesheet der Datei. */
export const SPRITE_STYLE =
  '.fur{fill:var(--coco-fur,#E2BF8E)}' +
  '.harness{fill:var(--coco-harness,#C23B2A);stroke:var(--ink,#1C1A17);stroke-width:var(--coco-stroke,1.6px);stroke-linejoin:round}' +
  '.line{fill:none;stroke:var(--ink,#1C1A17);stroke-width:var(--coco-stroke,1.6px);stroke-linecap:round;stroke-linejoin:round}' +
  '.line path,.harness path{vector-effect:non-scaling-stroke}' +
  '.solid{fill:var(--ink,#1C1A17)}.hi{fill:var(--paper,#F4EFE6)}' +
  '@media (forced-colors:active){.fur,.harness{fill:none}.line,.harness{stroke:CanvasText}.solid{fill:CanvasText}.hi{fill:Canvas}}'

export function drawSprite(): string {
  const header =
    '<!-- Coco-Platzhalter (P2.18) – erzeugt von scripts/art/draw-coco-placeholder.ts; P9 ersetzt die Zeichnungen, ' +
    'IDs/viewBox/Anker bleiben (DESIGN §10.4). -->'
  return (
    `<svg xmlns="http://www.w3.org/2000/svg">${header}<style>${SPRITE_STYLE}</style>` +
    symbolSpecs().map(renderSymbol).join('') +
    '</svg>\n'
  )
}

export const SPRITE_SOURCE = 'src/art/coco/coco-sprite.svg'

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  writeFileSync(SPRITE_SOURCE, drawSprite())
  console.log(
    `art:coco-placeholder: ${SPRITE_SOURCE} geschrieben (${symbolSpecs().length} Symbole).`,
  )
}
