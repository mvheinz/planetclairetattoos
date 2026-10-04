// `pnpm art:coco` (PLAN P9.8–P9.10, DESIGN §10.1–§10.4, §10.7): zeichnet Coco für den Sprite
// `src/art/coco/coco-sprite.svg` – 6 Posen × 3 Frames (A/B/C) + 4 Brücken = 22 Symbole – nach dem Charakterblatt
// `content/art/coco/character-sheet.svg` (Einheit K = Kopflänge = 36 viewBox-Einheiten).
//
// Frame A jeder Pose ist von Hand gesetzt: Stützpunkte je Strich (Feder-Zug, quadratischer B-Spline), Strich wie in
// Juttas Skizzen (`content/art/jutta-skizzen/`): Monoline, offene Konturen mit Absetzern, kleine Haken an Strichenden,
// Seitenblick, nur Nase/Pupillen/Ballen gefüllt. Frames B und C zeichnen **jede** Linie neu nach (Stützpunkte um
// 0,5–1,5 Einheiten versetzt, Absetzer und Doppelkontur an neuer Stelle) – gleiche Anatomie, Anker ± 2. `rennen`
// hat drei echte Gangphasen (A Streckung, B Sammlung, C Flug). Deterministisch (Seed je Symbol-ID), nur `<path>`.
// Referenzfotos und Juttas Skizzen sind nur Vorlage, nie Teil des Ergebnisses.
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

/**
 * Kopflänge K (Hinterkopf bis Nasenspitze, Seitenansicht; DESIGN §10.1): Köpfe sind lokal mit 36 Einheiten gezeichnet
 * und werden mit 1,1 eingesetzt – im Sprite ist K = 39,6 viewBox-Einheiten.
 */
export const K = 36 * 1.1
export const GROUND_Y = 112

export const SPRITE_POSES = [
  'rennen',
  'schnueffeln',
  'sitzen',
  'schlafen',
  'springen',
  'kopfschief',
] as const
export const BRIDGES = ['bremsen', 'abspringen', 'einrollen-1', 'einrollen-2'] as const

interface Stroke {
  layer: Layer
  part: Part
  pts: P[]
  closed?: boolean
  /** Handmerkmal: Absetzer (gap), Doppelkontur (double), Überstand an beiden Enden (over), Haken am Ende (hook). */
  feature?: 'gap' | 'double' | 'over' | 'hook'
  /** Zitter-Faktor beim Nachzeichnen (Standard 1; Flächen weniger, Punkte kaum). */
  jitter?: number
}

export interface Figure {
  strokes: Stroke[]
  ring: P
  hidden: Part[]
}

// ---------- Geometrie ----------

const DEG = Math.PI / 180

export interface Tf {
  x: number
  y: number
  rot?: number
  s?: number
  /** Spiegeln an der lokalen y-Achse (Blick nach links). */
  flip?: boolean
}

export function apply(t: Tf, [px, py]: P): P {
  const s = t.s ?? 1
  const x = (t.flip ? -px : px) * s
  const y = py * s
  const a = (t.rot ?? 0) * DEG
  return [t.x + x * Math.cos(a) - y * Math.sin(a), t.y + x * Math.sin(a) + y * Math.cos(a)]
}
const map = (t: Tf, pts: P[]): P[] => pts.map((p) => apply(t, p))
const rotAround = (pts: P[], c: P, deg: number): P[] =>
  map(
    { x: c[0], y: c[1], rot: deg },
    pts.map(([x, y]) => [x - c[0], y - c[1]]),
  )
const add = (a: P, b: P): P => [a[0] + b[0], a[1] + b[1]]
const sub = (a: P, b: P): P => [a[0] - b[0], a[1] - b[1]]
const mul = (a: P, k: number): P => [a[0] * k, a[1] * k]
const len = (a: P) => Math.hypot(a[0], a[1])
const norm = (a: P): P => {
  const l = len(a) || 1
  return [a[0] / l, a[1] / l]
}
const lerp = (a: P, b: P, t: number): P => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]

/** Höhe einer Punktfolge (y-Ausdehnung). */
const heightOf = (pts: P[]) => Math.max(...pts.map((p) => p[1])) - Math.min(...pts.map((p) => p[1]))

/**
 * Ohr-Asymmetrie (DESIGN §10.1, KUNST-QA CO-06: 5–15 %): skaliert `pts` um den Fußpunkt `base`, bis seine Höhe
 * `ratio` × Höhe von `ref` ist – so bleibt der Unterschied bei kleinen runden Ohren in jeder Pose im Band.
 */
function earAsym(pts: P[], ref: P[], base: P, ratio = 0.9): P[] {
  const k = (ratio * heightOf(ref)) / (heightOf(pts) || 1)
  return pts.map(([x, y]) => [base[0] + (x - base[0]) * k, base[1] + (y - base[1]) * k])
}

/**
 * Ohr-Asymmetrie im fertigen (gedrehten) Kopf: alle Striche des Ohrs `smaller` werden um `base` skaliert, bis ihre
 * Höhe 90 % der Höhe des anderen Ohrs ist (CO-06 misst die Höhe der `data-part`-Gruppen in Bildschirm-Richtung).
 */
function balanceEars(
  strokes: Stroke[],
  smaller: 'ear-l' | 'ear-r',
  base: P,
  ratio = 0.9,
): Stroke[] {
  const other = smaller === 'ear-l' ? 'ear-r' : 'ear-l'
  const ref = strokes.filter((st) => st.part === other).flatMap((st) => st.pts)
  const own = strokes.filter((st) => st.part === smaller).flatMap((st) => st.pts)
  if (!ref.length || !own.length) return strokes
  const k = (ratio * heightOf(ref)) / (heightOf(own) || 1)
  return strokes.map((st) =>
    st.part === smaller
      ? {
          ...st,
          pts: st.pts.map(([x, y]): P => [
            base[0] + (x - base[0]) * k,
            base[1] + (y - base[1]) * k,
          ]),
        }
      : st,
  )
}

/** Kleiner unruhiger Klecks (Nase, Pupille, Ballen) – nie ein perfekter Kreis. */
function blob(c: P, rx: number, ry: number, tilt = 0, n = 6, bump = 0.08): P[] {
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * 2 * Math.PI + 0.3
    const k = 1 + bump * Math.sin(a * 3 + 1.1)
    return apply({ x: c[0], y: c[1], rot: tilt }, [Math.cos(a) * rx * k, Math.sin(a) * ry * k])
  })
}

/**
 * Dünnes Bein als Gelenkkette ab `pivot` (Winkel je Segment in Grad aus der Senkrechten, + = in Blickrichtung `face`),
 * gezeichnet als offene U-Form: hintere Kante hinunter, kleine Pfote nach vorn, vordere Kante hinauf (oben offen).
 */
function leg(pivot: P, segs: [number, number][], face: 1 | -1, w = 2.2, paw = 2.2): P[] {
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
    let n: P = [-d[1], d[0]]
    if (n[0] * face < 0) n = mul(n, -1)
    const taper = i === 0 ? 1.15 : i === joints.length - 1 ? 0.85 : 1
    back.push(add(j, mul(n, (-w / 2) * taper)))
    front.push(add(j, mul(n, (w / 2) * taper)))
  })
  const e = joints[joints.length - 1]!
  const d = norm(sub(e, joints[joints.length - 2]!))
  let f: P = [-d[1], d[0]]
  if (f[0] * face < 0) f = mul(f, -1)
  const sole: P[] = [
    add(add(e, mul(f, -w * 0.45)), mul(d, 1.8)),
    add(add(e, mul(f, paw * 0.45)), mul(d, 2.2)),
    add(add(e, mul(f, w / 2 + paw * 0.6)), mul(d, 0.9)),
  ]
  return [...back, ...sole, ...front.slice(1, -1).reverse(), front[0]!]
}

/** Fernes Bein als ein Strich: Gelenkkette mit kleinem Pfotenhaken nach vorn. */
function legLine(pivot: P, segs: [number, number][], face: 1 | -1): P[] {
  const joints: P[] = [pivot]
  let p = pivot
  for (const [l, a] of segs) {
    p = add(p, [Math.sin(a * DEG) * l * face, Math.cos(a * DEG) * l])
    joints.push(p)
  }
  const d = norm(sub(p, joints[joints.length - 2]!))
  let f: P = [-d[1], d[0]]
  if (f[0] * face < 0) f = mul(f, -1)
  return [...joints, add(add(p, mul(f, 3.2)), mul(d, 0.4))]
}

/** Endpunkt (Pfote) einer Gelenkkette – für Ballen. */
function legEnd(pivot: P, segs: [number, number][], face: 1 | -1): { e: P; d: P } {
  let p = pivot
  let prev = pivot
  for (const [l, a] of segs) {
    prev = p
    p = add(p, [Math.sin(a * DEG) * l * face, Math.cos(a * DEG) * l])
  }
  return { e: p, d: norm(sub(p, prev)) }
}

/** Schwanz: sich verjüngender, an der Spitze offener Umriss entlang der Mittellinie `c` (Wurzelbreite `w0`). */
function tailOutline(c: P[], w0: number): { line: P[]; fill: P[] } {
  const a: P[] = []
  const b: P[] = []
  c.forEach((p, i) => {
    const d = norm(sub(c[Math.min(i + 1, c.length - 1)]!, c[Math.max(i - 1, 0)]!))
    const n: P = [-d[1], d[0]]
    const w = (w0 * (1 - i / (c.length - 1)) ** 0.8 + 0.4) / 2
    a.push(add(p, mul(n, w)))
    b.push(add(p, mul(n, -w)))
  })
  return { line: [...a, ...b.slice(0, -1).reverse()], fill: [...a, ...b.reverse()] }
}

// ---------- Kopf seitlich (lokal: Schädelmitte 0|0, Blick nach +x, Maße in K = 36) ----------

interface HeadOpts {
  /** Drehung der Ohren in Grad (− = nach hinten). */
  earNear?: number
  earFar?: number
  eyesClosed?: boolean
  /** Maul leicht offen (Rennen, Springen). */
  pant?: boolean
  /** Fernes Ohr verdeckt (eingerollt). */
  noFarEar?: boolean
  /** Ohren nach vorn gedreht wirken verkürzt (Schnüffeln). */
  earScale?: number
}

/** Ohrhöhe (lokal, vor `earScale`) – Ohr/Kopflänge ≈ 0,65 wie auf den Fotos (KUNST-QA CO-02). */
const EAR_H = 26

/**
 * Ohr (lokal, Basis bei `base`), Höhe `h`: groß und aufrecht mit breiter Basis und leicht gerundeter Spitze – so wie auf
 * Juttas Coco-Fotos (`content/seed/coco/`, 04.10.2026: Profil sitzend, frontal nah, stehend mit Schulterblick).
 */
function earPts(h: number, lean: number): P[] {
  // breite Basis (≈ 0,45 K), Außenkante bauchig, Spitze leicht gerundet
  const pts: P[] = [
    [-11.5, 1.5],
    [-13.6, -0.3 * h],
    [-11.8, -0.64 * h],
    [-7.4, -0.9 * h],
    [-4.6, -h],
    [-1.6, -0.95 * h],
    [1.8, -0.58 * h],
    [4.6, -0.26 * h],
    [5.4, 1],
  ]
  return rotAround(pts, [-3, 0], lean)
}

function sideHead(t: Tf, o: HeadOpts = {}): Stroke[] {
  const near = o.earNear ?? -30
  const far = o.earFar ?? -36
  const es = o.earScale ?? 0.8
  // große aufrechte Ohren oben am Hinterkopf (Juttas Fotos); Höhe ≈ 0,65 Kopflänge
  const eh = EAR_H * es
  const earN = map({ x: 0, y: -12.5 }, earPts(eh, near))
  const earNIn = map(
    { x: 0, y: -12.5 },
    rotAround(
      [
        [-6.4, -0.18 * eh],
        [-7.2, -0.5 * eh],
        [-5.4, -0.79 * eh],
      ],
      [-3, 0],
      near,
    ),
  )
  // fernes Ohr: fast deckungsgleich dahinter, nur Hinterkante und Spitze sichtbar, etwas kleiner (Asymmetrie)
  const earN0 = earPts(eh, near)
  const earF = map({ x: -2.5, y: -13 }, earAsym(earPts(eh, far), earN0, [-3, 0]).slice(0, 5))
  const s: Stroke[] = [
    // Schädel: vom Kiefer über den Hinterkopf zur Stirn – offen, mit Absetzer
    {
      layer: 'line',
      part: 'head',
      pts: [
        [-3, 10.8],
        [-11.6, 7.6],
        [-16.2, -0.8],
        [-14, -10.8],
        [-5, -15.6],
        [4, -14.2],
        [8.6, -8],
      ],
      feature: 'gap',
    },
    // Unterkiefer
    {
      layer: 'line',
      part: 'head',
      pts: [
        [9, 7.2],
        [3.5, 9.4],
        [-1.5, 10.6],
      ],
    },
    // Schnauze oben (Stopp bis Nasenspitze) und Kinn
    {
      layer: 'line',
      part: 'snout',
      pts: [
        [8, -7.6],
        [10.8, -5],
        [15, -4.2],
        [18.6, -3.4],
      ],
      feature: 'hook',
      jitter: 0.7,
    },
    {
      layer: 'line',
      part: 'snout',
      pts: o.pant
        ? [
            [18.8, 3.4],
            [15.5, 7.8],
            [11.4, 9.6],
            [8.8, 8.6],
          ]
        : [
            [19, 4],
            [15.6, 6.6],
            [11.4, 7.6],
            [8.8, 7.4],
          ],
    },
    // Maul: kleiner Bogen mit Haken wie in Juttas „Oh“-Skizze
    {
      layer: 'line',
      part: 'snout',
      pts: o.pant
        ? [
            [18.2, 2.8],
            [14.5, 4.4],
            [11.4, 4.2],
          ]
        : [
            [17.6, 2.6],
            [14.6, 3.7],
            [11.8, 3.2],
          ],
      feature: 'hook',
      jitter: 0.5,
    },
    {
      layer: 'solid',
      part: 'nose',
      // dicke, gefüllte Nase wie in Juttas Skizze (ovaler Tupfer)
      pts: blob([19.4, 0.4], 2.7, 2.3, -8, 7),
      closed: true,
      jitter: 0.25,
    },
    // Ohren: nahes Ohr doppelt nachgezogen, Innenohr-Linie; fernes Ohr nur als Kante dahinter
    { layer: 'line', part: 'ear-l', pts: earN, jitter: 0.3 },
    { layer: 'line', part: 'ear-l', pts: earNIn, jitter: 0.6 },
    ...(o.noFarEar
      ? []
      : [{ layer: 'line', part: 'ear-r', pts: earF, jitter: 0.3 } satisfies Stroke]),
    // Fell-Wash: Kopfoberseite (Blesse/Schnauze bleiben Papier) und Ohren außen
    {
      layer: 'fur',
      part: 'head',
      pts: [
        [-15, 1],
        [-13, -10],
        [-4.5, -14],
        [2.5, -12.6],
        [-1.5, -8.5],
        [-6.5, -2],
        [-9, 5],
      ],
      closed: true,
      jitter: 0.4,
    },
    {
      layer: 'fur',
      part: 'ear-l',
      pts: earN.filter((_, i) => i % 2 === 0),
      closed: true,
      jitter: 0.4,
    },
    ...(o.noFarEar
      ? []
      : [{ layer: 'fur', part: 'ear-r', pts: earF, closed: true, jitter: 0.4 } satisfies Stroke]),
  ]
  if (o.eyesClosed)
    s.push({
      layer: 'line',
      part: 'eye-l',
      pts: [
        [-2.8, -3.6],
        [0, -1.2],
        [3.6, -0.8],
        [6.8, -3],
      ],
      feature: 'hook',
      jitter: 0.4,
    })
  else {
    // Auge wie in Juttas Skizzen: offener Ring, große dunkle Pupille nach vorn gerückt (Seitenblick), Glanzpunkt
    // große runde Augen mit Glanzpunkt (Juttas Skizze)
    s.push({
      layer: 'solid',
      part: 'eye-l',
      pts: blob([3.2, -3.6], 4.1, 3.8, -10, 7),
      closed: true,
      jitter: 0.25,
    })
    s.push({
      layer: 'hi',
      part: 'eye-l',
      pts: blob([4.5, -5], 1.35, 1.2, 0, 5, 0.1),
      closed: true,
      jitter: 0.1,
    })
    s.push({ layer: 'line', part: 'head', pts: blob([2, -4], 5.9, 5.5, -10, 8), jitter: 0.4 })
  }
  return balanceEars(
    s.map((st) => ({ ...st, pts: map(t, st.pts) })),
    'ear-r',
    apply(t, [-3.5, -12.5]),
    0.9,
  )
}

// ---------- Seitenfigur (Rumpf lokal: Mitte 0|0, Blick nach +x) ----------

interface SideRig {
  torso: Tf
  /** Rückenwölbung (Sammlung) bzw. Durchhang (−). */
  arch?: number
  /** Streckung des Rumpfs (1 = stehend). */
  stretch?: number
  head: Tf
  headOpts?: HeadOpts
  fl: [number, number][]
  fr: [number, number][]
  hl: [number, number][]
  hr: [number, number][]
  /** Schwanz-Mittellinie (Rumpf-System, ab der Wurzel). */
  tail: P[]
  /** Ballen an diesen Beinen zeigen (Pfote von unten sichtbar, wie in Juttas Sprung-Skizze). */
  pads?: ('fl' | 'fr' | 'hl' | 'hr')[]
}

/**
 * Kürzere Beine wie auf Juttas Coco-Fotos (Shiba/Corgi-Mischung, 04.10.2026): alle Beinsegmente der Seitenansicht ×
 * {@link LEG_K}; Rumpf und Kopf sinken um {@link LEG_DROP} Einheiten, damit die Pfoten weiter auf dem Boden stehen
 * (feste Verschiebung je Figur, damit die Anker einer Pose über A/B/C stabil bleiben, CO-04).
 */
const LEG_K = 0.85
const LEG_DROP = 4.8

function sideFigure(r0: SideRig): Figure {
  const shorten = (segs: [number, number][]) =>
    segs.map(([l, a]): [number, number] => [l * LEG_K, a])
  const r: SideRig = {
    ...r0,
    torso: { ...r0.torso, y: r0.torso.y + LEG_DROP },
    head: { ...r0.head, y: r0.head.y + LEG_DROP },
    fl: shorten(r0.fl),
    fr: shorten(r0.fr),
    hl: shorten(r0.hl),
    hr: shorten(r0.hr),
  }
  const H: Tf = { s: 1.1, ...r.head }
  const st = r.stretch ?? 1
  const T = r.torso
  const a = r.arch ?? 0
  const X = (x: number) => x * st
  const back: P[] = [
    [X(-31), 3],
    [X(-34.5), -3],
    [X(-29), -10 - a * 0.5],
    [X(-14), -12.6 - a],
    [X(2), -12.4 - a * 0.8],
    [X(16), -15.5],
    [X(23), -18],
  ]
  const belly: P[] = [
    [X(31), -6],
    [X(33.5), 4],
    [X(27), 12.5],
    [X(14), 13],
    [X(1), 7.5 - a * 0.3],
    [X(-13), 4 - a * 0.2],
    [X(-24), 6.5],
  ]
  const fur: P[] = [
    [X(-33.5), -2],
    [X(-29), -10 - a * 0.5],
    [X(-14), -12.6 - a],
    [X(2), -12.4 - a * 0.8],
    [X(16), -15.5],
    [X(24), -2],
    [X(9), 6],
    [X(-10), 4.5],
    [X(-26), 6],
  ]
  // Geschirr: Bauchgurt hinter den Vorderbeinen, Rückensteg zum Halsring
  const band: P[] = [
    [X(10.5), -14.4 - a * 0.7],
    [X(15.2), -15.4 - a * 0.4],
    [X(19.2), 11.2],
    [X(14.6), 11.4],
  ]
  const ringLocal: P = [X(13), -16.8 - a * 0.6]
  const ring = apply(T, ringLocal)
  const nb0 = apply(T, [X(23), -18])
  const nb1 = apply(H, [-12, 4])
  const th0 = apply(T, [X(31), -6])
  const th1 = apply(H, [0, 10.4])
  const neckBack: P[] = [nb0, add(lerp(nb0, nb1, 0.5), [-1.4, -1.2]), nb1]
  const throat: P[] = [th0, add(lerp(th0, th1, 0.5), [1.6, 0.6]), th1]
  const collar: P[] = [
    lerp(nb0, nb1, 0.5),
    lerp(nb0, nb1, 0.76),
    lerp(th0, th1, 0.78),
    lerp(th0, th1, 0.52),
  ]
  const strap: P[] = [
    apply(T, [X(14), -15.6 - a * 0.5]),
    lerp(nb0, nb1, 0.52),
    lerp(nb0, nb1, 0.62),
    apply(T, [X(15), -14 - a * 0.5]),
  ]
  const face: 1 | -1 = 1
  const piv = {
    fr: apply(T, [X(27), 5]),
    fl: apply(T, [X(22), 6]),
    hr: apply(T, [X(-21), 0]),
    hl: apply(T, [X(-26), 1]),
  }
  const tl = tailOutline(map(T, r.tail), 7.6)
  const strokes: Stroke[] = [
    // ferne Beine zuerst
    // ferne Beine als ein einziger Strich mit kleiner Pfote (wie in Juttas Skizzen, keine Linienbündel)
    { layer: 'line', part: 'leg-hr', pts: legLine(piv.hr, r.hr, face), jitter: 0.6 },
    { layer: 'line', part: 'leg-fr', pts: legLine(piv.fr, r.fr, face), jitter: 0.6 },
    { layer: 'line', part: 'body', pts: map(T, back), feature: 'double' },
    { layer: 'line', part: 'body', pts: map(T, belly), feature: 'gap' },
    { layer: 'line', part: 'body', pts: neckBack },
    { layer: 'line', part: 'body', pts: throat, feature: 'hook' },
    { layer: 'line', part: 'leg-hl', pts: leg(piv.hl, r.hl, face), feature: 'over', jitter: 0.6 },
    { layer: 'line', part: 'leg-fl', pts: leg(piv.fl, r.fl, face), feature: 'over', jitter: 0.6 },
    { layer: 'line', part: 'tail', pts: tl.line },
    { layer: 'fur', part: 'body', pts: map(T, fur), closed: true, jitter: 0.4 },
    {
      layer: 'fur',
      part: 'tail',
      pts: tl.fill.filter((_, i) => i % 2 === 0),
      closed: true,
      jitter: 0.4,
    },
    { layer: 'harness', part: 'harness', pts: map(T, band), closed: true, jitter: 0.4 },
    { layer: 'harness', part: 'harness', pts: collar, closed: true, jitter: 0.4 },
    { layer: 'harness', part: 'harness', pts: strap, closed: true, jitter: 0.3 },
    {
      layer: 'line',
      part: 'ring',
      pts: blob(ring, 2.8, 2.5, 15, 5, 0.12),
      closed: true,
      jitter: 0.2,
    },
    ...sideHead(H, r.headOpts),
  ]
  for (const k of r.pads ?? []) {
    const { e, d } = legEnd(piv[k], r[k], face)
    const n: P = [-d[1], d[0]]
    strokes.push({
      layer: 'solid',
      part: `leg-${k}` as Part,
      pts: blob(add(e, mul(d, 1.2)), 1.3, 0.9, (Math.atan2(n[1], n[0]) / DEG) | 0, 5),
      closed: true,
      jitter: 0.15,
    })
  }
  return { strokes, ring, hidden: ['eye-r'] }
}

// Schwanz-Formen (Rumpf-System, Wurzel am Po): lockere Sichel nach oben über den Rücken
const TAIL_SICKLE: P[] = [
  [-33, -6],
  [-40, -12],
  [-42.5, -22],
  [-38, -29.5],
  [-31, -29],
  [-29.5, -23],
]
const TAIL_BACK: P[] = [
  [-33, -6],
  [-42, -11],
  [-50, -18],
  [-52, -28],
  [-48, -32],
]
const TAIL_HIGH: P[] = [
  [-33, -6],
  [-39, -16],
  [-38, -28],
  [-31, -34],
  [-25, -30],
]

/** Stehend, Seitenansicht – nur für das Charakterblatt (Messfigur mit Hilfslinien in K), nicht im Sprite. */
export function stehen(): Figure {
  return sideFigure({
    torso: { x: 76, y: 76, rot: 0 },
    head: { x: 118, y: 52, rot: 4 },
    headOpts: { earNear: -26, earFar: -32 },
    fl: [
      [17, 4],
      [15, 2],
    ],
    fr: [
      [17, -4],
      [15, -2],
    ],
    hl: [
      [12, 12],
      [12, -8],
      [8, 2],
    ],
    hr: [
      [12, 6],
      [12, -12],
      [8, -2],
    ],
    tail: TAIL_SICKLE,
  })
}

/** Rennen: drei echte Gangphasen (Galopp), Anker am Rücken ± 3; Beine als fast gerade Striche wie in Juttas Skizzen. */
function rennen(frame: 'a' | 'b' | 'c'): Figure {
  const headOpts: HeadOpts = { earNear: -34, earFar: -40, pant: true }
  if (frame === 'a')
    // Streckung: Vorderbeine weit nach vorn, Hinterbeine weit nach hinten
    return sideFigure({
      torso: { x: 76, y: 74, rot: 1 },
      stretch: 1.06,
      head: { x: 119, y: 53, rot: 6 },
      headOpts,
      fl: [
        [17, 56],
        [16, 64],
      ],
      fr: [
        [17, 42],
        [17, 50],
      ],
      hl: [
        [12, -56],
        [13, -64],
        [8, -72],
      ],
      hr: [
        [12, -42],
        [13, -50],
        [8, -58],
      ],
      tail: TAIL_BACK,
    })
  if (frame === 'b')
    // Sammlung: Beine unter dem Körper, Rücken gewölbt
    return sideFigure({
      torso: { x: 77, y: 75, rot: -2 },
      stretch: 0.96,
      arch: 3,
      head: { x: 118, y: 54, rot: 10 },
      headOpts: { ...headOpts, earNear: -38, earFar: -42 },
      fl: [
        [17, -20],
        [17, -12],
      ],
      fr: [
        [17, -6],
        [17, 2],
      ],
      hl: [
        [12, 40],
        [13, 30],
        [8, 34],
      ],
      hr: [
        [12, 28],
        [13, 18],
        [8, 22],
      ],
      tail: TAIL_HIGH,
    })
  // Flug: alle Pfoten in der Luft – Vorderbeine greifen nach vorn unten, Hinterbeine schieben nach hinten
  return sideFigure({
    torso: { x: 77, y: 74.5, rot: -3 },
    stretch: 1.02,
    arch: 2,
    head: { x: 119, y: 52.5, rot: 4 },
    headOpts: { ...headOpts, earNear: -40, earFar: -46 },
    fl: [
      [16, 26],
      [14, 34],
    ],
    fr: [
      [16, 12],
      [14, 20],
    ],
    hl: [
      [12, -6],
      [12, -14],
      [7, -20],
    ],
    hr: [
      [12, 6],
      [12, -2],
      [7, -8],
    ],
    tail: TAIL_BACK,
  })
}

/** Schnüffeln: Kopf tief, Nase am Boden, Vorderbeine leicht gebeugt, Schwanz hoch, Ohren vor. */
function schnueffeln(frame: 'a' | 'b' | 'c'): Figure {
  const twitch = frame === 'c' ? 1 : 0
  return sideFigure({
    torso: { x: 70, y: 77, rot: 6 },
    head: { x: 117, y: 97 + twitch, rot: 22 },
    headOpts: { earNear: -14, earFar: -26, earScale: 0.76 },
    fl: [
      [15, 12],
      [15, 2],
    ],
    fr: [
      [15, 2],
      [16, -8],
    ],
    hl: [
      [12, 14],
      [12, 2],
      [8, 8],
    ],
    hr: [
      [12, 6],
      [12, -6],
      [8, 0],
    ],
    tail: TAIL_HIGH,
  })
}

/** Springen: Luftbogen, Vorderbeine vorgestreckt, Hinterbeine gestreckt, Ohren hoch/zurück, Schwanz hoch. */
function springen(): Figure {
  return sideFigure({
    torso: { x: 74, y: 74, rot: -20 },
    stretch: 1.04,
    head: { x: 116, y: 43, rot: -12 },
    headOpts: { earNear: -16, earFar: -22, pant: true },
    fl: [
      [16, 114],
      [16, 120],
    ],
    fr: [
      [16, 90],
      [16, 98],
    ],
    hl: [
      [12, -34],
      [13, -30],
      [8, -38],
    ],
    hr: [
      [12, -24],
      [13, -20],
      [8, -28],
    ],
    tail: TAIL_HIGH,
    pads: ['hl'],
  })
}

/** Brücke bremsen: Vorderbeine gestemmt, Körper nach hinten, Ohren vor. */
function bremsen(): Figure {
  return sideFigure({
    torso: { x: 72, y: 74, rot: 8 },
    stretch: 0.98,
    head: { x: 116, y: 52, rot: -6 },
    headOpts: { earNear: -10, earFar: -16 },
    fl: [
      [17, 40],
      [18, 30],
    ],
    fr: [
      [17, 30],
      [18, 22],
    ],
    hl: [
      [11, 46],
      [11, -6],
      [7, 30],
    ],
    hr: [
      [11, 38],
      [11, -12],
      [7, 22],
    ],
    tail: TAIL_SICKLE,
  })
}

/** Brücke abspringen: geduckt, Hinterbeine gebeugt. */
function abspringen(): Figure {
  return sideFigure({
    torso: { x: 78, y: 86, rot: -6 },
    stretch: 0.96,
    arch: 2,
    head: { x: 120, y: 64, rot: 0 },
    headOpts: { earNear: -30, earFar: -36 },
    fl: [
      [13, -30],
      [14, 26],
    ],
    fr: [
      [13, -40],
      [14, 18],
    ],
    hl: [
      [10, 70],
      [10, -60],
      [7, 10],
    ],
    hr: [
      [10, 64],
      [10, -66],
      [7, 4],
    ],
    tail: TAIL_BACK,
  })
}

// ---------- Sitzen / Kopf schief (¾-Ansicht, von Hand gesetzt in viewBox-Koordinaten) ----------

/** ¾-Kopf (lokal: Schädelmitte 0|0), Schnauze nach rechts unten zum Betrachter. */
function frontHead(t: Tf, knick: boolean, flop: P = [0, 0]): Stroke[] {
  // Ohren groß, aufrecht und spitz mit gerundeter Spitze, leicht nach außen gestellt (Juttas Coco-Fotos 04.10.2026);
  // runder Kopf, Augen und Nase nach Juttas Skizze; das rechte Ohr etwas größer (Asymmetrie)
  const earL0: P[] = [
    [-16.4, -7.6],
    [-19.4, -15],
    [-20.6, -24],
    [-19.8, -31.4],
    [-17.2, -34.2],
    [-13.8, -30.6],
    [-9.4, -24],
    [-5.6, -17.6],
  ]
  const shrink = ([x, y]: P): P => [x, y]
  // beim schiefen Kopf das linke Ohr steiler stellen, damit es trotz Neigung aufrecht wirkt
  const earL1 = earL0.map(([x, y]): P => shrink([x, knick ? y * 1.06 : y]))
  const earLr = knick ? rotAround(earL1, [-9, -9], 16) : earL1
  const earR0: P[] = knick
    ? [
        // Ohr knickt oben nach außen ab (bei `kopfschief`, wie auf Juttas Fotos)
        [4.8, -17.4],
        [8.8, -24.6],
        [13, -29.6],
        add([17, -32.2], flop),
        add([21.4, -30.8], flop),
        add([23.8, -27.4], flop),
        add([20.6, -27], flop),
        [19.4, -21],
        [18.8, -15],
        [16.6, -9.6],
      ]
    : [
        [4.8, -17.4],
        [8.8, -24.6],
        [13, -31],
        [16, -34.4],
        [18.8, -32],
        [19.8, -24.6],
        [18.8, -16],
        [16.6, -9.6],
      ]
  // Asymmetrie 10 %: gerade – links kleiner; schief (Knick rechts) – rechts kleiner
  const earR1 = earR0.map(shrink)
  const earL = knick ? earLr : earAsym(earLr, earR1, [-11, -7])
  const earR = knick ? earAsym(earR1, earLr, [11, -9]) : earR1
  const s: Stroke[] = [
    // Schädel und Wangen – offen, mit Absetzer oben
    {
      layer: 'line',
      part: 'head',
      // runder Kopf (Juttas Skizze): fast ein Kreis, offen am Kinn
      pts: [
        [-5, 16.4],
        [-14.6, 11.6],
        [-18.2, 1.6],
        [-16.2, -9.6],
        [-8, -16.6],
        [2.6, -17.6],
        [12.2, -13.6],
        [17.4, -4.6],
        [17.4, 6],
        [13.6, 13.4],
      ],
      feature: 'gap',
    },
    // Schnauze (hell) mit Kinn
    {
      layer: 'line',
      part: 'snout',
      // Nasenrücken zwischen den Augen hinab (kurz)
      pts: [
        [0.6, 0.6],
        [1.4, 3.2],
        [2.4, 5],
      ],
    },
    {
      layer: 'line',
      part: 'snout',
      // Kinn
      pts: [
        [10.4, 13.2],
        [7, 15.2],
        [2.6, 15.6],
        [-0.6, 14.2],
      ],
      feature: 'hook',
    },
    // Maul: Lächeln unter der Nase mit Haken (Juttas „Oh“-Skizze)
    {
      layer: 'line',
      part: 'snout',
      // mittig unter der Nase (vorher nach rechts gezogen – wirkte wie ein Schnurrbart)
      pts: [
        [-0.8, 10.8],
        [2.2, 12.9],
        [6.6, 12.7],
        [10.2, 10.2],
      ],
      feature: 'hook',
      jitter: 0.5,
    },
    {
      layer: 'solid',
      part: 'nose',
      // dicke, gefüllte Nase knapp unter und zwischen den Augen
      pts: blob([3.2, 7.2], 3.2, 2.7, 4, 7),
      closed: true,
      jitter: 0.25,
    },
    // Augen: groß, dunkel, verschieden; Glanzpunkte oben seitlich (Blick zum Betrachter)
    // große runde Augen (Juttas „Oh“-Skizze): Pupillen groß, zur Seite gerückt = Seitenblick, Glanzpunkt oben
    {
      layer: 'solid',
      part: 'eye-l',
      pts: blob([-6.4, -3.2], 3.9, 3.6, -12, 7),
      closed: true,
      jitter: 0.25,
    },
    {
      layer: 'solid',
      part: 'eye-r',
      pts: blob([9.2, -3.8], 4.6, 4.0, 10, 7),
      closed: true,
      jitter: 0.25,
    },
    {
      layer: 'hi',
      part: 'eye-l',
      pts: blob([-5, -4.8], 1.3, 1.2, 0, 5, 0.1),
      closed: true,
      jitter: 0.1,
    },
    {
      layer: 'hi',
      part: 'eye-r',
      pts: blob([10.6, -5.4], 1.4, 1.25, 0, 5, 0.1),
      closed: true,
      jitter: 0.1,
    },
    // Augenringe rund und offen, das rechte etwas größer
    { layer: 'line', part: 'head', pts: blob([-7.8, -3.4], 5.6, 5.4, -12, 8), jitter: 0.4 },
    { layer: 'line', part: 'head', pts: blob([7.6, -4], 6.2, 5.8, 10, 8), jitter: 0.4 },
    // Ohren mit Innenohr-Linie
    { layer: 'line', part: 'ear-l', pts: earL, jitter: 0.3 },
    {
      layer: 'line',
      part: 'ear-l',
      pts: rotAround(
        [
          [-15.2, -11.6],
          [-17.2, -20],
          [-16.8, -28],
        ],
        [-9, -9],
        knick ? 16 : 0,
      ),
      jitter: 0.6,
    },
    { layer: 'line', part: 'ear-r', pts: earR, jitter: 0.3 },
    {
      layer: 'line',
      part: 'ear-r',
      pts: (knick
        ? [
            [8.8, -18.6],
            [12.6, -24.4],
            [16, -28],
          ]
        : [
            [8.8, -18.6],
            [13, -25.4],
            [16.2, -30],
          ]) as P[],
      jitter: 0.6,
    },
    // Schnurrhaare (lang, leicht gebogen) – je Seite 2
    {
      layer: 'line',
      part: 'head',
      pts: [
        [13, 9],
        [17.4, 8.6],
        [20.4, 10],
      ],
      jitter: 0.4,
    },
    {
      layer: 'line',
      part: 'head',
      pts: [
        [12.4, 11.4],
        [16.4, 12.4],
        [19, 14.4],
      ],
      jitter: 0.4,
    },
    // Fell-Wash: Stirn links/rechts der Blesse, Ohren außen
    {
      layer: 'fur',
      part: 'head',
      pts: [
        [-17.4, 2],
        [-15.6, -9.6],
        [-7.6, -16.2],
        [-2.4, -10],
        [-2.6, -1],
        [-14, 6],
      ],
      closed: true,
      jitter: 0.4,
    },
    {
      layer: 'fur',
      part: 'head',
      pts: [
        [3, -17],
        [12, -13.2],
        [16.8, -4.6],
        [14, -1],
        [3, -9.6],
      ],
      closed: true,
      jitter: 0.4,
    },
    { layer: 'fur', part: 'ear-l', pts: earL, closed: true, jitter: 0.4 },
    { layer: 'fur', part: 'ear-r', pts: earR, closed: true, jitter: 0.4 },
  ]
  return balanceEars(
    s.map((st) => ({ ...st, pts: map(t, st.pts) })),
    knick ? 'ear-r' : 'ear-l',
    apply(t, knick ? [11, -9] : [-11, -7]),
  )
}

function sitzenFigure(knick: boolean, frame: string): Figure {
  // Schwanzspitze wedelt zwischen den Frames um gut eine Einheit (lebendig, gleiche Anatomie)
  const wag: P = frame === 'b' ? [1.6, -0.8] : frame === 'c' ? [-1.2, -0.6] : [0, 0]
  const ring: P = [62.4, 63.4]
  const head: Tf = knick ? { x: 85, y: 43, rot: -14, s: 1.1 } : { x: 86, y: 42, rot: -3, s: 1.1 }
  const strokes: Stroke[] = [
    // Rücken vom Nacken über den Po – offen, doppelt nachgezogen
    {
      layer: 'line',
      part: 'body',
      pts: [
        [72, 52],
        [63, 60],
        [55, 72],
        [50, 86],
        [49, 98],
        [53, 107],
        [61, 111],
      ],
      feature: 'double',
    },
    // Brust (tief, hell) bis zum Ellbogen
    {
      layer: 'line',
      part: 'body',
      pts: [
        [97, 55],
        [102, 64],
        [103.6, 75],
        [101.4, 85],
      ],
      feature: 'hook',
    },
    // Schenkel (sitzend) mit Hinterpfote vorn
    {
      layer: 'line',
      part: 'leg-hl',
      pts: [
        [60, 78],
        [70, 82],
        [76.4, 92],
        [75.4, 103],
        [69.4, 107.6],
        [71, 111.6],
        [80, 111.8],
        [83.6, 110.6],
        [80.6, 108.2],
        [75.6, 107.4],
      ],
      feature: 'over',
    },
    // Vorderbeine: dünn, gerade, Söckchen (Papier), kleine Pfoten; das ferne Bein schaut dahinter hervor
    {
      layer: 'line',
      part: 'leg-fl',
      pts: [
        [93, 82],
        [93.4, 95],
        [93.6, 108],
        [93, 111.6],
        [99, 112],
        [102.6, 110.6],
        [99.6, 108.2],
        [99.2, 97],
        [99.8, 84],
      ],
      feature: 'over',
    },
    {
      layer: 'line',
      part: 'leg-fr',
      pts: [
        [85, 86],
        [85.2, 97],
        [85.4, 108.4],
        [84.8, 111.4],
        [90, 111.8],
        [93, 111.2],
        [89.8, 108],
        [89.6, 97],
        [90, 88],
      ],
    },
    // Schwanz seitlich um die Pfoten gelegt (unten vorbei)
    {
      layer: 'line',
      part: 'tail',
      pts: [
        [54, 106],
        [61, 110.6],
        [72, 113.8],
        [86, 114.4],
        add([97.6, 113.6], wag),
        add([91, 112.6], wag),
        [74, 111.6],
        [62, 108.4],
      ],
    },
    // Fell: Rücken/Flanke, Schenkel, Schwanz
    {
      layer: 'fur',
      part: 'body',
      pts: [
        [71, 53],
        [62, 61],
        [55, 72],
        [50, 87],
        [50, 99],
        [55, 107],
        [68, 107],
        [75, 96],
        [71, 84],
        [62, 78],
        [70, 66],
      ],
      closed: true,
      jitter: 0.4,
    },
    {
      layer: 'fur',
      part: 'tail',
      pts: [
        [56, 107],
        [72, 113.4],
        [94, 113.6],
        [74, 111.4],
      ],
      closed: true,
      jitter: 0.3,
    },
    // Geschirr: Halsring, Bauchgurt hinter den Vorderbeinen, Rückensteg zum D-Ring
    {
      layer: 'harness',
      part: 'harness',
      pts: [
        [70, 54],
        [83, 57.4],
        [97, 56.8],
        [98.4, 61.6],
        [83, 62.2],
        [70.6, 59],
      ],
      closed: true,
      jitter: 0.3,
    },
    {
      layer: 'harness',
      part: 'harness',
      pts: [
        [59.6, 67.4],
        [63.4, 65.6],
        [73.4, 79.4],
        [79.4, 92.8],
        [76, 94.4],
        [69.4, 81.6],
      ],
      closed: true,
      jitter: 0.3,
    },
    {
      layer: 'harness',
      part: 'harness',
      pts: [
        [61, 65.6],
        [70, 57.4],
        [72, 60],
        [64, 67.6],
      ],
      closed: true,
      jitter: 0.3,
    },
    {
      layer: 'line',
      part: 'ring',
      pts: blob(ring, 2.8, 2.5, -20, 5, 0.12),
      closed: true,
      jitter: 0.2,
    },
    ...frontHead(head, knick, mul(wag, 1.8)),
  ]
  return { strokes, ring, hidden: ['leg-hr'] }
}

// ---------- Liegen, Einrollen, Schlafen ----------

/** Brücke einrollen-1: halb liegend (Sphinx), Kopf noch oben. */
function einrollen1(): Figure {
  return sideFigure({
    torso: { x: 74, y: 94, rot: 0 },
    stretch: 0.96,
    arch: -1,
    head: { x: 113, y: 73, rot: 4 },
    headOpts: { earNear: -36, earFar: -42 },
    fl: [
      [10, 72],
      [12, 88],
    ],
    fr: [
      [10, 66],
      [12, 84],
    ],
    hl: [
      [9, 80],
      [9, -90],
      [6, 88],
    ],
    hr: [
      [9, 74],
      [9, -96],
      [6, 82],
    ],
    tail: [
      [-33, -4],
      [-40, 4],
      [-38, 13],
      [-28, 15],
      [-18, 14],
    ],
  })
}

/** Donut: eingerollt, Nase am Schwanz, Ohren angelegt; `awake` = einrollen-2 (Augen noch offen, Kopf höher). */
function curl(awake: boolean): Figure {
  const ring: P = [84.6, 66.6]
  // Kopf vorn rechts, Blick zurück zum Schwanz (gespiegelt), Nase gesenkt
  const headT: Tf = awake
    ? { x: 107, y: 91, rot: -8, s: 1.12, flip: true }
    : { x: 107, y: 95, rot: -14, s: 1.12, flip: true }
  const head = sideHead(headT, { earNear: awake ? -58 : -66, noFarEar: true, eyesClosed: !awake })
  const strokes: Stroke[] = [
    // Rücken als großer Bogen vom Nacken über den Po – offen, doppelt nachgezogen
    {
      layer: 'line',
      part: 'body',
      pts: [
        [121, 92],
        [116, 77],
        [100, 67.6],
        [78, 66],
        [59, 71],
        [47, 83],
        [43, 97],
        [47, 107],
        [57, 111.4],
      ],
      feature: 'double',
    },
    // Brust vorn auf dem Boden (hinter der Pfote)
    {
      layer: 'line',
      part: 'body',
      pts: [
        [122.6, 98],
        [124, 105],
        [121, 110.6],
      ],
      feature: 'hook',
    },
    // Hinterschenkel (eingeklappt) mit Pfote vorn
    {
      layer: 'line',
      part: 'leg-hl',
      pts: [
        [55, 82],
        [66, 83],
        [73, 92],
        [71.5, 101],
        [64, 104],
        [72, 106.6],
        [81, 105.4],
      ],
      feature: 'over',
    },
    // Vorderpfote unter dem Kinn, nach links zur Nase
    {
      layer: 'line',
      part: 'leg-fl',
      pts: [
        [118, 106.4],
        [104, 106],
        [92, 106.6],
        [88, 109],
        [91.6, 111.6],
        [106, 111.6],
        [116, 111.8],
      ],
    },
    // Schwanz vom Po vorn um den Körper bis zur Nase
    {
      layer: 'line',
      part: 'tail',
      pts: [
        [46, 101],
        [50, 109.6],
        [62, 114.4],
        [76, 114.6],
        [86, 112.6],
        [89.4, 110.4],
        [84.6, 109.8],
        [74, 111.2],
        [60, 110.6],
      ],
    },
    {
      layer: 'fur',
      part: 'body',
      pts: [
        [116, 84],
        [96, 68],
        [76, 67],
        [58, 72],
        [46, 84],
        [43.5, 98],
        [50, 107],
        [64, 104],
        [72, 92],
        [64, 84],
        [84, 78],
        [104, 80],
      ],
      closed: true,
      jitter: 0.4,
    },
    {
      layer: 'fur',
      part: 'tail',
      pts: [
        [47, 103],
        [62, 113.6],
        [86, 112],
        [62, 110.6],
      ],
      closed: true,
      jitter: 0.3,
    },
    // Geschirr: Bauchgurt über den Rücken, Halsring am Nacken, D-Ring obenauf
    {
      layer: 'harness',
      part: 'harness',
      pts: [
        [82.4, 66.6],
        [87.6, 67],
        [89.4, 79],
        [84.4, 79.6],
      ],
      closed: true,
      jitter: 0.3,
    },
    {
      layer: 'harness',
      part: 'harness',
      pts: [
        [107, 72],
        [111.6, 75.6],
        [114, 84],
        [109.6, 82],
      ],
      closed: true,
      jitter: 0.3,
    },
    {
      layer: 'line',
      part: 'ring',
      pts: blob(ring, 2.8, 2.5, 10, 5, 0.12),
      closed: true,
      jitter: 0.2,
    },
    ...head,
  ]
  // Schlaf-Schatten: 5 Schraffurstriche unter 40° (DESIGN §10.2)
  if (!awake)
    for (let i = 0; i < 5; i++) {
      const x = 52 + i * 14
      strokes.push({
        layer: 'line',
        part: 'body',
        pts: [
          [x, 119],
          [x + 3.4, 116],
        ],
        jitter: 0.3,
      })
    }
  return { strokes, ring, hidden: ['eye-r', 'ear-r', 'leg-fr', 'leg-hr'] }
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

/** Neu nachgezeichnet: jeder Punkt um 0,5–1,5 Einheiten (× Faktor) in eine zufällige Richtung versetzt. */
function retrace(pts: P[], rand: () => number, k: number): P[] {
  return pts.map(([x, y]) => {
    const a = rand() * 2 * Math.PI
    const r = (0.5 + rand()) * k * 0.62
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
  return `${d}Q${f(pts[n - 2]!)} ${f(pts[n - 1]!)}`
}

export function figureFor(pose: string, frame: string): Figure {
  const f = frame as 'a' | 'b' | 'c'
  switch (pose) {
    case 'rennen':
      return rennen(f)
    case 'schnueffeln':
      return schnueffeln(f)
    case 'sitzen':
      return sitzenFigure(false, f)
    case 'kopfschief':
      return sitzenFigure(true, f)
    case 'schlafen':
      return curl(false)
    case 'springen':
      return springen()
    case 'bremsen':
      return bremsen()
    case 'abspringen':
      return abspringen()
    case 'einrollen-1':
      return einrollen1()
    case 'einrollen-2':
      return curl(true)
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

/**
 * Striche eines Symbols mit Handmerkmalen. Frame A: Stützpunkte nur leicht (0,2–0,6 Einheiten) gezittert; B und C:
 * jede Linie neu nachgezeichnet (0,5–1,5 Einheiten, DESIGN §10.7). Absetzer/Doppelkontur je Frame an anderer Stelle
 * (eigener Seed je Symbol-ID).
 */
export function renderStrokes(
  spec: SymbolSpec,
  fig: Figure = figureFor(spec.pose, spec.frame),
): { layer: Layer; part: Part; d: string }[] {
  const rand = mulberry32(fnv1a(spec.id))
  const k = spec.frame === 'a' ? 0.6 : 1.6
  const out: { layer: Layer; part: Part; d: string }[] = []
  const push = (layer: Layer, part: Part, d: string) => d && out.push({ layer, part, d })
  for (const s of fig.strokes) {
    const src = s.layer === 'fur' && s.pts.length > 8 ? s.pts.filter((_, i) => i % 2 === 0) : s.pts
    const pts = retrace(src, rand, (s.jitter ?? 1) * k)
    // große Konturen auf ganze Einheiten (Handstrich verträgt es, Budget §9.10), Details auf halbe
    const c = s.layer === 'fur' || (s.layer === 'line' && (s.jitter ?? 1) >= 0.5)
    if (s.feature === 'gap' && !s.closed) {
      const [a, b] = splitGap(pts, 0.32 + rand() * 0.36, 2.2 + rand() * 1)
      push(s.layer, s.part, toPath(a, false, c) + toPath(b, false, c))
      continue
    }
    if (s.feature === 'over' && !s.closed) {
      // Überstand: beide Enden 1–3 Einheiten über den Ansatz hinaus verlängert
      const first = pts[0]!
      const last = pts[pts.length - 1]!
      const e0 = add(first, mul(norm(sub(first, pts[1]!)), 1 + rand() * 2))
      const e1 = add(last, mul(norm(sub(last, pts[pts.length - 2]!)), 1 + rand() * 2))
      push(s.layer, s.part, toPath([e0, ...pts.slice(1, -1), e1], false, c))
      continue
    }
    if (s.feature === 'hook' && !s.closed) {
      // kleiner Haken am Strichende (Feder setzt ab und zieht kurz zurück)
      const last = pts[pts.length - 1]!
      const d = norm(sub(last, pts[pts.length - 2]!))
      const side = rand() < 0.5 ? 1 : -1
      const hook = add(add(last, mul(d, -0.8)), mul([-d[1] * side, d[0] * side], 1.4))
      push(s.layer, s.part, toPath([...pts, hook], false, c))
      continue
    }
    if (s.layer === 'harness') {
      push(s.layer, s.part, `M${pts.map((p) => `${fmtInt(p[0])} ${fmtInt(p[1])}`).join('L')}Z`)
      continue
    }
    push(s.layer, s.part, toPath(pts, s.closed, c))
    if (s.feature === 'double' && !s.closed) {
      // Doppelkontur: ein Teilstück (≈ 55 %) um 1–1,5 Einheiten versetzt noch einmal gezogen
      const from = Math.floor(rand() * Math.max(1, s.pts.length - 3))
      const part = s.pts.slice(from, from + Math.max(3, Math.ceil(s.pts.length * 0.55)))
      const d = norm(sub(part[part.length - 1]!, part[0]!))
      const off = mul([-d[1], d[0]], 1 + rand() * 0.5)
      push(
        s.layer,
        s.part,
        toPath(
          retrace(
            part.map((p) => add(p, off)),
            rand,
            0.7,
          ),
          false,
          c,
        ),
      )
    }
  }
  return out
}

/**
 * Farben als Präsentationsattribute: WebKit (Safari, iOS) wendet das `<style>` einer extern per `<use href="…svg#id">`
 * eingebundenen Datei nicht an – ohne Attribute stünde Coco dort als schwarzer Klecks. Das `<style>` unten bleibt
 * maßgeblich (CSS schlägt Attribute: Token-Farben, nicht skalierende Strichbreite, erzwungene Farben); Strichbreite,
 * Enden und Ecken kommen sonst vom `<use>` (`.coco use` in `src/styles/coco.css`).
 */
export const LAYER_PAINT: Record<Layer, string> = {
  fur: ' fill="#E2BF8E"',
  harness: ' fill="#C23B2A" stroke="currentColor"',
  line: ' fill="none" stroke="currentColor"',
  solid: ' fill="currentColor"',
  hi: ' fill="#F4EFE6"',
}

export function renderSymbol(
  spec: SymbolSpec,
  fig: Figure = figureFor(spec.pose, spec.frame),
): string {
  const byLayer = new Map<Layer, Map<Part, string[]>>()
  for (const { layer, part, d } of renderStrokes(spec, fig)) {
    const parts = byLayer.get(layer) ?? new Map<Part, string[]>()
    byLayer.set(layer, parts)
    parts.set(part, [...(parts.get(part) ?? []), d])
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
    return `<g class="${layer}"${LAYER_PAINT[layer]}${attrs}>${inner}</g>`
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
    '<!-- Coco (P9.9/P9.10) – erzeugt von scripts/art/draw-coco.ts nach dem Charakterblatt ' +
    'content/art/coco/character-sheet.svg (DESIGN §10). Nicht von Hand ändern: pnpm art:coco && pnpm art:sprite. -->'
  return (
    `<svg xmlns="http://www.w3.org/2000/svg">${header}<style>${SPRITE_STYLE}</style>` +
    symbolSpecs()
      .map((spec) => renderSymbol(spec))
      .join('') +
    '</svg>\n'
  )
}

export const SPRITE_SOURCE = 'src/art/coco/coco-sprite.svg'

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  writeFileSync(SPRITE_SOURCE, drawSprite())
  console.log(`art:coco: ${SPRITE_SOURCE} geschrieben (${symbolSpecs().length} Symbole).`)
}
