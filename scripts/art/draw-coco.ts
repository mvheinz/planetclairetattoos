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
/**
 * Zusatz-Posen (P12.4, U-03/U-04) in der nachgeladenen Datei `coco-extra` (nur im Leerlauf geladen): Warte-Aktionen im
 * Sitzen (Hecheln, Ohr zucken, Kratzen, Gähnen, Schwanz wedeln) und die vier neuen Posen (Spielverbeugung, Schütteln,
 * Freudenhüpfer mit Drehung, Hinlegen mit Bauch hoch). Je 3 Frames; gleiche IDs-Regeln wie der Haupt-Sprite.
 */
export const EXTRA_POSES = [
  'hecheln',
  'zucken',
  'kratzen',
  'gaehnen',
  'wedeln',
  'verbeugung',
  'schuetteln',
  'freude',
  'liegen',
] as const
export const BRIDGES = ['bremsen', 'abspringen', 'einrollen-1', 'einrollen-2'] as const

export interface Stroke {
  layer: Layer
  part: Part
  pts: P[]
  closed?: boolean
  /** Handmerkmal: Absetzer (gap), Doppelkontur (double), Überstand an beiden Enden (over), Haken am Ende (hook). */
  feature?: 'gap' | 'double' | 'over' | 'hook'
  /** Knickohr (U-07): Strich gehört zum geknickten Ohr – nur für Tests/Geometrie, nicht im Sprite. */
  knick?: boolean
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
export const rotAround = (pts: P[], c: P, deg: number): P[] =>
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
export function blob(c: P, rx: number, ry: number, tilt = 0, n = 6, bump = 0.08): P[] {
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
export function leg(pivot: P, segs: [number, number][], face: 1 | -1, w = 2.2, paw = 2.2): P[] {
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
export function legLine(pivot: P, segs: [number, number][], face: 1 | -1): P[] {
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
export function tailOutline(c: P[], w0: number): { line: P[]; fill: P[] } {
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
  /** Zunge hängt heraus (Hecheln, Freude); Länge 0–1. */
  tongue?: number
  /** Maul weit offen (Gähnen). */
  yawn?: boolean
  /** Fernes Ohr verdeckt (eingerollt). */
  noFarEar?: boolean
  /** Ohren nach vorn gedreht wirken verkürzt (Schnüffeln). */
  earScale?: number
  /** Kurzes Aufspitzen (U-07): das hintere Ohr steht gerade statt geknickt (Ohr zucken, Aufmerken). */
  earUp?: boolean
  /** Blick nach links (gespiegelter Kopf, `curl`): das vordere (einzige sichtbare) Ohr ist das geknickte. */
  knickNear?: boolean
}

/** Ohrhöhe (lokal, vor `earScale`) – Ohr/Kopflänge ≈ 0,65 wie auf den Fotos (KUNST-QA CO-02). */
const EAR_H = 26

/**
 * Ohr (lokal, Basis bei `base`), Höhe `h`: groß und aufrecht mit breiter Basis und leicht gerundeter Spitze – so wie auf
 * Juttas Coco-Fotos (`content/seed/coco/`, 04.10.2026: Profil sitzend, frontal nah, stehend mit Schulterblick).
 */
export function earPts(h: number, lean: number): P[] {
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

/**
 * Knickohr (U-07): breite Basis, die Spitze knickt im oberen Drittel nach vorn-unten ab (Juttas Coco: das rechte Ohr
 * steht nie ganz gerade). Liefert Außenkante mit Knick und die kurze Innenkante zur Basis.
 */
export function knickEarPts(h: number, lean: number): { outer: P[]; inner: P[] } {
  const outer: P[] = [
    [-11.5, 1.5],
    [-13.4, -0.3 * h],
    [-11.8, -0.58 * h],
    [-8.4, -0.86 * h],
    [-3.2, -0.92 * h],
    [1.6, -0.8 * h],
    [5.2, -0.58 * h],
    [6, -0.36 * h],
    [5.4, -0.16 * h],
  ]
  const inner: P[] = [
    [5.6, 1],
    [4.6, -0.1 * h],
    [2.6, -0.3 * h],
  ]
  // Spitze knickt nach hinten-außen (weg vom Gesicht): gespiegelt an der Ohrmitte, so bleibt sie neben dem nahen Ohr sichtbar
  const m = (pts: P[]) => pts.map(([x, y]): P => [-6 - x, y])
  const r = (pts: P[]) => rotAround(m(pts), [-3, 0], lean)
  return { outer: r(outer), inner: r(inner) }
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
  const upF = map({ x: -5, y: -12.5 }, earAsym(earPts(eh, far), earN0, [-3, 0]))
  // Knickohr (U-07): hinteres Ohr geknickt, außer beim Aufspitzen (`earUp`); beim Blick nach links das vordere
  const kF = knickEarPts(eh, far)
  const kN = knickEarPts(eh, near)
  const farKnick = !o.earUp && !o.knickNear
  const earF = farKnick ? map({ x: -5, y: -12.5 }, kF.outer) : upF.slice(0, 5)
  const earFIn = farKnick ? map({ x: -5, y: -12.5 }, kF.inner) : null
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
      pts: o.yawn
        ? [
            [20, 15.5],
            [15, 17.8],
            [10.4, 14.4],
            [8.2, 8],
          ]
        : o.pant
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
      pts: o.yawn
        ? [
            [18.4, 3],
            [13.5, 4.6],
            [8.6, 6.6],
          ]
        : o.pant
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
      pts: blob([19.4, 0.4], 2.5, 2.2, -8, 7),
      closed: true,
      jitter: 0.25,
    },
    ...(o.tongue || o.yawn
      ? ([
          {
            layer: 'harness',
            part: 'snout',
            pts: o.yawn
              ? [
                  [16.4, 14.6],
                  [13, 11.4],
                  [10.4, 12.4],
                  [11.6, 15.6],
                ]
              : [
                  [15.6, 7],
                  [17.2, 7 + 5 * (o.tongue ?? 0.6)],
                  [14.8, 8.6 + 5.4 * (o.tongue ?? 0.6)],
                  [12.6, 9.4],
                ],
            closed: true,
            jitter: 0.3,
          },
        ] satisfies Stroke[])
      : []),
    // Ohren: nahes Ohr doppelt nachgezogen, Innenohr-Linie; fernes Ohr nur als Kante dahinter
    o.knickNear
      ? {
          layer: 'line',
          part: 'ear-l',
          pts: map({ x: 0, y: -12.5 }, kN.outer),
          jitter: 0.3,
          knick: true,
        }
      : { layer: 'line', part: 'ear-l', pts: earN, jitter: 0.3 },
    o.knickNear
      ? {
          layer: 'line',
          part: 'ear-l',
          pts: map({ x: 0, y: -12.5 }, kN.inner),
          jitter: 0.5,
          knick: true,
        }
      : { layer: 'line', part: 'ear-l', pts: earNIn, jitter: 0.6 },
    ...(o.noFarEar
      ? []
      : [
          {
            layer: 'line',
            part: 'ear-r',
            pts: earF,
            jitter: 0.3,
            knick: farKnick,
          } satisfies Stroke,
          ...(earFIn
            ? [
                {
                  layer: 'line',
                  part: 'ear-r',
                  pts: earFIn,
                  jitter: 0.5,
                  knick: true,
                } satisfies Stroke,
              ]
            : []),
        ]),
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
      pts: (o.knickNear ? map({ x: 0, y: -12.5 }, kN.outer) : earN).filter((_, i) => i % 2 === 0),
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
    0.88,
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

// ---------- Sitzen / Kopf schief (Seitenansicht nach Juttas Fotos, von Hand gesetzt in viewBox-Koordinaten) ----------

/** Ganze Figur um `pivot` skalieren (Anker und Striche). */
function scaleFig(f: Figure, k: number, pivot: P): Figure {
  const m = ([x, y]: P): P => [pivot[0] + (x - pivot[0]) * k, pivot[1] + (y - pivot[1]) * k]
  return { ...f, ring: m(f.ring), strokes: f.strokes.map((st) => ({ ...st, pts: st.pts.map(m) })) }
}

export interface SitOpts {
  /** Kopfneigung in Grad (+ = Kopf kippt nach vorn-unten zur Schulter, wie bei `kopfschief`). */
  tilt?: number
  /** Kopfposition (Schädelmitte). */
  head?: P
  pant?: boolean
  tongue?: number
  yawn?: boolean
  earUp?: boolean
  eyesClosed?: boolean
  /** Ohr-Skalierung (Kopf schief wirkt sonst zu groß, CO-02). */
  earScale?: number
  /** Hinterbein kratzt hinterm Ohr: Pfotenposition (Versatz in Einheiten). */
  scratch?: P
  /** Schwanzspitze (Versatz in Einheiten) – wedelt zwischen den Frames. */
  wag?: P
  /** Schwanzhaltung: Spitze weiter nach oben (aufmerksam) bzw. flach am Boden. */
  tailLift?: number
}

/**
 * Sitzen in der Seitenansicht (Blick nach rechts), wie auf Juttas Foto „Profil sitzend“: Brust leicht vorgestreckt,
 * gerade Vorderbeine, Hinterteil seitlich abgesetzt (Oberschenkel mit nach vorn gelegter Hinterpfote), buschiger
 * Schwanz am Boden, große aufrechte Ohren (hinteres Ohr geknickt, U-07). Nicht katzenhaft: Schnauze, Beine, Schwanz.
 */
export function sitSide(o: SitOpts = {}): Figure {
  const hp = o.head ?? [108, 37]
  const H: Tf = { x: hp[0], y: hp[1], rot: o.tilt ?? -4, s: 1.1 }
  const th = apply(H, [0, 10.4])
  const nb = apply(H, [-12, 4])
  const w = o.wag ?? [0, 0]
  const lift = o.tailLift ?? 3
  const ring: P = [80, 59]
  const tailC: P[] = [
    [62, 106],
    [52, 109.5],
    [42, 108.5 - lift * 0.3],
    [34.5, 103 - lift],
    [32.5 + w[0], 95 - lift * 1.6 + w[1]],
  ]
  const tl = tailOutline(tailC, 11)
  // buschig: Außenkante mit kleinen Zacken (Juttas Zackenschwanz)
  const bushy = tl.line.map(([x, y], i): P =>
    i % 2 === 1 ? [x + (i < 5 ? 0.4 : -1.1), y + 1.1] : [x, y],
  )
  const strokes: Stroke[] = [
    // fernes Vorderbein: ein Strich mit kleinem Pfotenhaken
    { layer: 'line', part: 'leg-fr', pts: legLine([107, 82], [[30, 1]], 1), jitter: 0.6 },
    // Rücken vom Nacken über den Po – offen, doppelt nachgezogen
    {
      layer: 'line',
      part: 'body',
      pts: [nb, [88, 52], [79, 60], [70, 72], [63, 86], [60, 98], [62, 107], [68, 111]],
      feature: 'double',
    },
    // Brust (vorgestreckt) vom Hals bis zum Ellbogen
    {
      layer: 'line',
      part: 'body',
      pts: [th, [112, 53], [116.5, 61], [118, 71], [116, 80]],
      feature: 'hook',
    },
    // nahes Vorderbein: gerade, mit heller „Socke“ und kleiner Pfote
    {
      layer: 'line',
      part: 'leg-fl',
      pts: leg([114, 78], [[34, 0]], 1, 5, 2.4),
      feature: 'over',
      jitter: 0.6,
    },
    // Bauchlinie zwischen Vorderbein und Oberschenkel
    {
      layer: 'line',
      part: 'body',
      pts: [
        [110, 92],
        [102, 96.5],
        [93, 95],
      ],
      jitter: 0.5,
    },
    // Oberschenkel mit nach vorn gelegter Hinterpfote
    {
      layer: 'line',
      part: 'leg-hl',
      pts: [
        [64, 90],
        [67, 80],
        [76, 77],
        [85, 83],
        [89, 95],
        [89, 105],
        [94, 110],
        [98, 111.6],
        [84, 112],
        [70, 111.5],
      ],
      feature: 'over',
      jitter: 0.7,
    },
    { layer: 'line', part: 'tail', pts: bushy, jitter: 0.8 },
    // Fell-Wash: Rücken und Oberschenkel; Brust, Beine, Schnauze bleiben Papier
    {
      layer: 'fur',
      part: 'body',
      pts: [
        nb,
        [88, 52],
        [79, 60],
        [70, 72],
        [63, 86],
        [60, 98],
        [62, 107],
        [76, 108],
        [86, 100],
        [88, 88],
        [82, 80],
        [84, 68],
        [92, 58],
        [97, 50],
      ],
      closed: true,
      jitter: 0.4,
    },
    {
      layer: 'fur',
      part: 'tail',
      pts: tl.fill.filter((_, i) => i % 2 === 0),
      closed: true,
      jitter: 0.4,
    },
    // Geschirr: Halsring, Rückensteg und Brustgurt hinter den Vorderbeinen
    {
      layer: 'harness',
      part: 'harness',
      pts: [
        apply(H, [-11, 5.5]),
        apply(H, [-4, 9]),
        apply(H, [2.5, 13.5]),
        apply(H, [-1.6, 16.5]),
        apply(H, [-8, 12.5]),
        apply(H, [-13.5, 8.6]),
      ],
      closed: true,
      jitter: 0.3,
    },
    {
      layer: 'harness',
      part: 'harness',
      pts: [
        [91, 55],
        [95.4, 55.4],
        [99, 86],
        [94, 87.4],
      ],
      closed: true,
      jitter: 0.3,
    },
    {
      layer: 'harness',
      part: 'harness',
      pts: [
        [85, 55],
        [91, 55],
        [89, 59.4],
        [83, 60.2],
      ],
      closed: true,
      jitter: 0.3,
    },
    {
      layer: 'line',
      part: 'ring',
      pts: blob(ring, 2.8, 2.5, 15, 5, 0.12),
      closed: true,
      jitter: 0.2,
    },
    ...sideHead(H, {
      earNear: -4,
      earFar: -14,
      earScale: o.earScale ?? 1,
      pant: o.pant,
      tongue: o.tongue,
      yawn: o.yawn,
      earUp: o.earUp,
      eyesClosed: o.eyesClosed,
    }),
  ]
  if (o.scratch) {
    // Hinterbein hoch zum Ohr: Oberschenkel bleibt, Unterschenkel (zwei Kanten) schnellt zum Ohr, Pfote kratzt
    const i = strokes.findIndex((st) => st.part === 'leg-hl')
    const paw: P = [98 + o.scratch[0], 43 + o.scratch[1]]
    strokes.splice(
      i,
      1,
      {
        layer: 'line',
        part: 'leg-hl',
        pts: [
          [64, 90],
          [67, 80],
          [76, 77],
          [85, 83],
          [88, 92],
        ],
        feature: 'over',
        jitter: 0.7,
      },
      {
        layer: 'line',
        part: 'leg-hl',
        pts: [
          [72, 111.5],
          [84, 112],
          [96, 111],
        ],
        jitter: 0.6,
      },
      {
        layer: 'line',
        part: 'leg-hl',
        pts: [
          [75, 86],
          [80, 72],
          [88, 60],
          add(paw, [-2.4, 6]),
          add(paw, [-1.2, 1.4]),
          add(paw, [2.4, -2]),
          add(paw, [4.4, 1.2]),
        ],
        feature: 'hook',
        jitter: 0.5,
      },
      {
        layer: 'line',
        part: 'leg-hl',
        pts: [add(paw, [5.4, 4.6]), [101, 56], [95, 70], [90, 86]],
        jitter: 0.5,
      },
    )
  }
  return scaleFig({ strokes, ring, hidden: ['eye-r', 'leg-hr'] }, 0.88, [80, 112])
}

/** Sitzen: A ruhig, B/C wedeln mit der Schwanzspitze (gleiche Anatomie, Boil). */
function sitzen(frame: 'a' | 'b' | 'c'): Figure {
  return sitSide({ wag: frame === 'b' ? [1.6, -0.8] : frame === 'c' ? [-1.2, -0.6] : [0, 0] })
}

/** Kopf schief: Kopf kippt, das geknickte Ohr bleibt (U-07). */
function kopfschief(frame: 'a' | 'b' | 'c'): Figure {
  return sitSide({
    tilt: 14,
    head: [109, 38],
    earScale: 0.94,
    wag: frame === 'b' ? [1.2, -0.6] : frame === 'c' ? [-1, -0.4] : [0, 0],
  })
}

// ---------- Warte-Aktionen im Sitzen (U-03) ----------

/** Hecheln: Maul offen, Zunge hängt und wippt, Brust hebt sich (Kopf ±0,8). */
function hecheln(frame: 'a' | 'b' | 'c'): Figure {
  const k = frame === 'a' ? 0 : frame === 'b' ? 1 : -1
  return sitSide({
    pant: true,
    tongue: 0.6 + 0.3 * k,
    head: [108, 37 + 0.8 * k],
    wag: [0.6 * k, 0],
  })
}

/** Kopf schief + Ohr zucken: A/C geknickt, B spitzt kurz auf (U-07). */
function zucken(frame: 'a' | 'b' | 'c'): Figure {
  return sitSide({ tilt: frame === 'b' ? 18 : 14, head: [109, 38], earUp: frame === 'b' })
}

/** Hinterbein kratzt hinterm Ohr: Pfote wippt, Kopf neigt sich, Auge zu. */
function kratzen(frame: 'a' | 'b' | 'c'): Figure {
  const o: P = frame === 'a' ? [0, 0] : frame === 'b' ? [2.4, -2.6] : [-1.6, 2]
  return sitSide({ scratch: o, tilt: 10, head: [107, 38.5], eyesClosed: true })
}

/** Gähnen: Kopf in den Nacken, Maul weit auf; A öffnet, B/C weit. */
function gaehnen(frame: 'a' | 'b' | 'c'): Figure {
  return sitSide({
    yawn: frame !== 'a',
    pant: frame === 'a',
    tilt: frame === 'a' ? -10 : -24,
    head: frame === 'a' ? [108, 37] : [106, 37],
    eyesClosed: frame !== 'a',
  })
}

/** Schwanz wedelt: Spitze schwingt weit (Freude), Maul leicht offen. */
function wedeln(frame: 'a' | 'b' | 'c'): Figure {
  const w: P = frame === 'a' ? [-5, 7] : frame === 'b' ? [6, -9] : [0, -2]
  return sitSide({ pant: true, tongue: 0.35, wag: w, tailLift: frame === 'b' ? 6 : 1 })
}

// ---------- Neue Posen (U-04): Spielverbeugung, Schütteln, Freudenhüpfer, Hinlegen ----------

/** Spielverbeugung: Vorderkörper runter, Vorderbeine flach nach vorn, Hinterteil hoch, Schwanz wedelt. */
function verbeugung(frame: 'a' | 'b' | 'c'): Figure {
  const d = frame === 'a' ? 0 : frame === 'b' ? -2.2 : 1.6
  return sideFigure({
    torso: { x: 72, y: 74 + d * 0.4, rot: 17 },
    stretch: 1.02,
    head: { x: 122, y: 87 + d, rot: 14 },
    headOpts: { earNear: -16, earFar: -22, pant: true, tongue: 0.5 },
    fl: [
      [14, 66],
      [10, 82],
    ],
    fr: [
      [14, 56],
      [10, 74],
    ],
    hl: [
      [11, -6],
      [12, 14],
      [8, -4],
    ],
    hr: [
      [11, -12],
      [12, 8],
      [8, -10],
    ],
    tail: frame === 'b' ? TAIL_HIGH : frame === 'c' ? TAIL_SICKLE : TAIL_BACK,
  })
}

/** Kleine Schüttel-Striche (Bewegungsandeutung) um `c`. */
function shakeMarks(c: P, r: number, turn: number): Stroke[] {
  const arc = (a0: number, a1: number): P[] =>
    [0, 1, 2, 3].map((i) => {
      const a = (a0 + ((a1 - a0) * i) / 3) * DEG
      return [c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r * 0.8]
    })
  return [
    { layer: 'line', part: 'body', pts: arc(150 + turn, 200 + turn), jitter: 0.5 },
    { layer: 'line', part: 'body', pts: arc(-20 + turn, 30 + turn), jitter: 0.5 },
  ]
}

/** Schütteln: Fell auslockern – Rumpf und Kopf schwingen gegeneinander, Ohren klappen, Schüttel-Striche. */
function schuetteln(frame: 'a' | 'b' | 'c'): Figure {
  const s = frame === 'a' ? 1 : frame === 'b' ? -1 : 0.4
  const f = sideFigure({
    torso: { x: 76 + 1.2 * s, y: 76, rot: 4 * s },
    head: { x: 118 - 1.5 * s, y: 54, rot: 10 * s },
    headOpts: { earNear: -26 - 24 * s, earFar: -32 + 20 * s, earScale: 0.8 },
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
    tail: frame === 'b' ? TAIL_BACK : TAIL_SICKLE,
  })
  return {
    ...f,
    strokes: [
      ...f.strokes,
      ...shakeMarks([76, 66], 44, s * 8),
      ...shakeMarks([118, 50], 24, -s * 8),
    ],
  }
}

/** Freudenhüpfer mit Drehung: A Absprung (nach rechts), B Scheitelpunkt (von vorn gestaucht), C Landung (nach links). */
function freude(frame: 'a' | 'b' | 'c'): Figure {
  const base = (rise: number, tail: P[]) =>
    sideFigure({
      torso: { x: 80, y: 62 - rise, rot: -14 },
      head: { x: 122, y: 38 - rise, rot: -12 },
      headOpts: { earNear: -44, earFar: -50, pant: true, tongue: 0.7 },
      fl: [
        [16, 24],
        [14, 36],
      ],
      fr: [
        [16, 10],
        [14, 22],
      ],
      hl: [
        [12, 2],
        [12, -8],
        [8, -4],
      ],
      hr: [
        [12, 14],
        [12, 2],
        [8, 6],
      ],
      tail,
    })
  if (frame === 'a') return base(0, TAIL_HIGH)
  if (frame === 'b') {
    // Drehung: Figur von vorn gestaucht (Breite 0,55) auf dem Scheitelpunkt, um den D-Ring gestaucht (Anker bleibt)
    const f = base(8, TAIL_HIGH)
    const px = f.ring[0]
    const m = ([x, y]: P): P => [px + (x - px) * 0.55, y]
    return {
      ...f,
      ring: m(f.ring),
      strokes: f.strokes.map((st) => ({ ...st, pts: st.pts.map(m) })),
    }
  }
  // Landung: gespiegelt um den D-Ring (Blick nach links, Anker bleibt), Beine fangen auf
  const f = base(-2, TAIL_SICKLE)
  const px = f.ring[0]
  const m = ([x, y]: P): P => [2 * px - x, y]
  return { ...f, ring: m(f.ring), strokes: f.strokes.map((st) => ({ ...st, pts: st.pts.map(m) })) }
}

/**
 * Hinlegen auf den Rücken (U-04): Bauch hoch, Vorderpfoten übereinander auf der Brust, Hinterbeine mit angezogenen
 * Knien in der Luft, Kopf verkehrt herum mit Zunge. Von Hand gesetzt; B/C wippen mit den Pfoten.
 */
function liegen(frame: 'a' | 'b' | 'c'): Figure {
  const d = frame === 'a' ? 0 : frame === 'b' ? 1.4 : -1.2
  const ring: P = [60, 110]
  const H: Tf = { x: 124, y: 83, rot: 180, s: 1.1, flip: true }
  const head = sideHead(H, { earNear: -34, earFar: -40, tongue: 0.9, eyesClosed: frame === 'c' })
  const fw = (x: number, y: number): P => [x + d * 0.6, y + d]
  const strokes: Stroke[] = [
    // Bauchlinie (oben) von der Brust bis zum Po
    {
      layer: 'line',
      part: 'body',
      pts: [
        [104, 88],
        [92, 80],
        [76, 78],
        [60, 83],
        [50, 93],
        [49, 102],
      ],
      feature: 'double',
    },
    // Rücken am Boden
    {
      layer: 'line',
      part: 'body',
      pts: [
        [110, 103],
        [102, 110],
        [84, 112],
        [64, 111.6],
        [52, 107],
      ],
      feature: 'gap',
    },
    {
      layer: 'line',
      part: 'body',
      pts: [
        [111, 91],
        [112, 98],
        [110, 103],
      ],
      feature: 'hook',
    },
    // Hinterbeine mit angezogenen Knien (nah und fern)
    {
      layer: 'line',
      part: 'leg-hl',
      pts: [[56, 84], [53, 70], [57, 59], [66, 55], fw(70, 61), fw(66, 64), [62, 72], [62, 82]],
      feature: 'over',
      jitter: 0.7,
    },
    {
      layer: 'line',
      part: 'leg-hr',
      pts: [[67, 80], [68, 68], [74, 60], [82, 59], fw(85, 65)],
      jitter: 0.6,
    },
    // Vorderpfoten übereinander auf der Brust
    {
      layer: 'line',
      part: 'leg-fl',
      pts: [
        [96, 86],
        [96, 72],
        [102, 64],
        [110, 64],
        fw(114, 70),
        fw(108, 72),
        [104, 76],
        [103, 86],
      ],
      feature: 'over',
      jitter: 0.7,
    },
    {
      layer: 'line',
      part: 'leg-fr',
      pts: [[88, 82], [90, 70], [96, 63], [104, 60], fw(108, 64)],
      jitter: 0.6,
    },
    // Pfotenballen als kleine Punkte
    {
      layer: 'solid',
      part: 'leg-fl',
      pts: blob(fw(109, 68), 1.4, 1, 20, 5),
      closed: true,
      jitter: 0.15,
    },
    {
      layer: 'solid',
      part: 'leg-hl',
      pts: blob(fw(66, 59.5), 1.4, 1, -20, 5),
      closed: true,
      jitter: 0.15,
    },
    // Schwanz hängt locker über den Boden
    {
      layer: 'line',
      part: 'tail',
      pts: [
        [50, 98],
        [42, 104],
        [34, 106],
        [26, 104],
        [22, 99],
      ],
      jitter: 0.8,
    },
    {
      layer: 'line',
      part: 'tail',
      pts: [
        [50, 104],
        [42, 109],
        [32, 110.4],
        [24, 108.6],
        [20, 102],
      ],
      jitter: 0.8,
    },
    // Fell-Wash: Rückenseite am Boden und Beine außen
    {
      layer: 'fur',
      part: 'body',
      pts: [
        [110, 103],
        [102, 110],
        [84, 112],
        [64, 111.6],
        [52, 107],
        [58, 100],
        [80, 104],
        [100, 100],
      ],
      closed: true,
      jitter: 0.4,
    },
    {
      layer: 'fur',
      part: 'tail',
      pts: [
        [50, 100],
        [34, 106],
        [22, 100],
        [32, 108],
        [50, 104],
      ],
      closed: true,
      jitter: 0.3,
    },
    {
      layer: 'fur',
      part: 'leg-hl',
      pts: [
        [53, 72],
        [57, 60],
        [66, 56],
        [62, 66],
        [58, 80],
      ],
      closed: true,
      jitter: 0.3,
    },
    // Halsband am verkehrten Kopf
    {
      layer: 'harness',
      part: 'harness',
      pts: [
        apply(H, [-11, 5.5]),
        apply(H, [-4, 9]),
        apply(H, [2.5, 13.5]),
        apply(H, [-1.6, 16.5]),
        apply(H, [-8, 12.5]),
        apply(H, [-13.5, 8.6]),
      ],
      closed: true,
      jitter: 0.3,
    },
    ...head,
  ]
  return { strokes, ring, hidden: ['eye-r', 'ring'] }
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
  const head = sideHead(headT, {
    earNear: awake ? -58 : -66,
    noFarEar: true,
    knickNear: true,
    eyesClosed: !awake,
  })
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

export function mulberry32(seed: number): () => number {
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
export function retrace(pts: P[], rand: () => number, k: number): P[] {
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
      return sitzen(f)
    case 'kopfschief':
      return kopfschief(f)
    case 'schlafen':
      return curl(false)
    case 'springen':
      return springen()
    case 'hecheln':
      return hecheln(f)
    case 'zucken':
      return zucken(f)
    case 'kratzen':
      return kratzen(f)
    case 'gaehnen':
      return gaehnen(f)
    case 'wedeln':
      return wedeln(f)
    case 'verbeugung':
      return verbeugung(f)
    case 'schuetteln':
      return schuetteln(f)
    case 'freude':
      return freude(f)
    case 'liegen':
      return liegen(f)
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

export type SpriteSet = 'main' | 'extra'

export function symbolSpecs(set: SpriteSet = 'main'): SymbolSpec[] {
  if (set === 'extra')
    return EXTRA_POSES.flatMap((pose) =>
      (['a', 'b', 'c'] as const).map((frame) => ({
        id: `coco-${pose}-${frame}`,
        pose,
        frame,
        bridge: false,
      })),
    )
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

/** Ohren-Asymmetrie eines fertig nachgezeichneten Frames: Höhe kleineres/größeres Ohr in {@link EAR_RATIO} halten. */
const EAR_RATIO = [0.89, 0.93] as const
function rebalanceEars(strokes: Stroke[]): Stroke[] {
  const parts = (['ear-l', 'ear-r'] as const).map((part) => {
    const pts = strokes
      .filter((st) => st.part === part && st.layer === 'line')
      .flatMap((st) => st.pts)
    return { part, pts, h: pts.length ? heightOf(pts) : 0 }
  })
  const [a, b] = parts as [(typeof parts)[0], (typeof parts)[0]]
  if (!a.h || !b.h) return strokes
  const [small, big] = a.h <= b.h ? [a, b] : [b, a]
  const r = small.h / big.h
  const k = Math.min(EAR_RATIO[1], Math.max(EAR_RATIO[0], r)) / r
  if (k === 1) return strokes
  // Fußpunkt: Mitte der untersten Punkte des kleineren Ohrs
  const ys = small.pts.map((p) => p[1])
  const yMax = Math.max(...ys)
  const xs = small.pts.filter((p) => p[1] > yMax - 2).map((p) => p[0])
  const base: P = [xs.reduce((x, v) => x + v, 0) / xs.length, yMax]
  return strokes.map((st) =>
    st.part === small.part
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
  // erst alle Linien neu nachzeichnen, dann die Ohren-Asymmetrie je Frame einstellen (CO-06: 5–15 %, nach dem
  // Nachzeichnen gemessen – vorher streute sie je Frame um ± 6 Prozentpunkte)
  const traced = fig.strokes.map((s) => {
    const src = s.layer === 'fur' && s.pts.length > 8 ? s.pts.filter((_, i) => i % 2 === 0) : s.pts
    return { ...s, pts: retrace(src, rand, (s.jitter ?? 1) * k) }
  })
  for (const s of rebalanceEars(traced)) {
    const pts = s.pts
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
    if (s.layer === 'harness' && s.part === 'harness') {
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

export function drawSprite(set: SpriteSet = 'main'): string {
  const header =
    set === 'main'
      ? '<!-- Coco (P9.9/P9.10, P12.4) – erzeugt von scripts/art/draw-coco.ts nach dem Charakterblatt ' +
        'content/art/coco/character-sheet.svg (DESIGN §10). Nicht von Hand ändern: pnpm art:coco && pnpm art:sprite. -->'
      : '<!-- Coco Zusatz-Posen (P12.4: Warte-Aktionen, Verbeugung, Schütteln, Freudenhüpfer, Hinlegen) – erzeugt von ' +
        'scripts/art/draw-coco.ts, nachgeladen im Leerlauf (DESIGN §10.8). Nicht von Hand ändern: pnpm art:coco && pnpm art:sprite. -->'
  return (
    `<svg xmlns="http://www.w3.org/2000/svg">${header}<style>${SPRITE_STYLE}</style>` +
    symbolSpecs(set)
      .map((spec) => renderSymbol(spec))
      .join('') +
    '</svg>\n'
  )
}

export const SPRITE_SOURCE = 'src/art/coco/coco-sprite.svg'
export const EXTRA_SOURCE = 'src/art/coco/coco-extra.svg'

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  writeFileSync(SPRITE_SOURCE, drawSprite('main'))
  writeFileSync(EXTRA_SOURCE, drawSprite('extra'))
  console.log(
    `art:coco: ${SPRITE_SOURCE} (${symbolSpecs().length} Symbole) und ${EXTRA_SOURCE} (${symbolSpecs('extra').length} Symbole) geschrieben.`,
  )
}
