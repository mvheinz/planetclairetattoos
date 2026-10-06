// `pnpm art:fitness` (PLAN P12.5, U-09, `content/art/jutta-skizzen/FITNESS-COCO.md`): Fitness-Coco der Startseite.
// Sieben Übungen aus Juttas Skizzenblatt (Body wave, Body bounce, Single arm raises, Body bounces with hip rotation,
// Chest opener, Straight arm trunk twist, Arm raises both arms) und das erschöpfte Liegen als Schluss; danach beginnt die
// Schleife von vorn. Jede Übung besteht aus 12–24 von Hand gezeichneten Zwischenbildern (Tuschelinie schwarz mit leichtem
// Zittern, jedes Bild neu nachgezogen) plus zartem orangem Buntstift-Strich im Fell (kreuzfreie Schraffur, je Bild neu,
// körnig gestrichelt wie Papierkörnung); dazu weiche Übergänge (3–4 Bilder) zwischen den Übungen. Keine Beschriftung.
// Ausgabe: `public/art/fitness-coco.v1.json` (nachgeladen nach dem ersten Bild, ≤ 150 KB gz) und
// `src/art/fitness/still.json` (Standbild für die Startseite/reduzierte Bewegung, SSR, wenige KB).
// Deterministisch (Seed je Bild). Nur Pfade; Zeichen-Helfer aus `draw-coco.ts` (Strich wie Juttas Skizzen).
import { mkdirSync, writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { gzipSync } from 'node:zlib'

import {
  blob,
  earPts,
  knickEarPts,
  leg,
  mulberry32,
  retrace,
  tailOutline,
  toPath,
  type P,
} from './draw-coco'

export const FITNESS_VERSION = 1
export const FITNESS_JSON = `public/art/fitness-coco.v${FITNESS_VERSION}.json`
export const FITNESS_STILL = `public/art/fitness-still.v${FITNESS_VERSION}.svg`
/** Farben und Strichmaße von Standbild und Leinwand (Behaviour `fitness-coco` zeichnet mit denselben Werten). */
export const PENCIL = {
  color: '#D9822B',
  width: 1.2,
  dash: '5 1.2 3 1.6 7 1',
  opacity: 0.85,
} as const
export const INK = { color: '#1C1A17', width: 1.5 } as const

/** Standbild als eigenständiges SVG (wird als <img> geladen: kein Inline-SVG im HTML der Startseite, PF-10). */
export function stillSvg(f: Frame): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 250" fill="none" stroke-linecap="round" stroke-linejoin="round">` +
    `<path d="${f.pencil}" stroke="${PENCIL.color}" stroke-width="${PENCIL.width}" stroke-dasharray="${PENCIL.dash}" opacity="${PENCIL.opacity}"/>` +
    `<path d="${f.ink}" stroke="${INK.color}" stroke-width="${INK.width}"/></svg>\n`
  )
}
export const FITNESS_W = 200
export const FITNESS_H = 250
export const GROUND = 238
/** Bildfolge je Übung: 12–24 Zwischenbilder (U-09). */
export const FRAME_RANGE = [12, 24] as const
/** Anzeigedauer je Bild in ms (≈ 10 Bilder/s) und je Übung in ms (≈ 4–6 s, U-09). */
export const FRAME_MS = 100
export const BUDGET_GZ = 150_000

const DEG = Math.PI / 180
const add = (a: P, b: P): P => [a[0] + b[0], a[1] + b[1]]
const mul = (a: P, k: number): P => [a[0] * k, a[1] * k]
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const ease = (t: number) => t * t * (3 - 2 * t)
const tri = (t: number) => (t < 0.5 ? t * 2 : 2 - t * 2)

// ---------- Pose ----------

export interface Pose {
  /** Becken seitlich (px). */
  sway: number
  /** Becken abgesenkt (px, Kniebeuge). */
  down: number
  /** Rumpfneigung in Grad (+ nach rechts im Bild). */
  lean: number
  /** Rumpfdrehung −1…1 (Brust verkürzt sich, Kopf folgt). */
  twist: number
  /** Kopfneigung in Grad. */
  head: number
  /** Blick/Kopfwendung −1…1. */
  look: number
  /** Arme (Absolutwinkel Ober-/Unterarm aus der Senkrechten nach unten; − links, + rechts im Bild). */
  armL: [number, number]
  armR: [number, number]
  /** Armlängen-Faktor (Verkürzung bei Drehung). */
  armK: [number, number]
  /** Schwanz: Grundwinkel aus der Senkrechten (+ nach rechts) und Krümmung je Segment. */
  tail: number
  curl: number
  /** Augen: 1 offen, 0,5 halb, 0 geschlossen; Mund: 0 zu … 1 weit auf (Zunge). */
  eyes: number
  mouth: number
}

export const REST: Pose = {
  sway: 0,
  down: 0,
  lean: 0,
  twist: 0,
  head: 0,
  look: 0,
  armL: [-10, -6],
  armR: [10, 6],
  armK: [1, 1],
  tail: 24,
  curl: 12,
  eyes: 1,
  mouth: 0.1,
}

const mix = (a: Pose, b: Pose, t: number): Pose => {
  const m = (x: number, y: number) => lerp(x, y, t)
  const m2 = (x: [number, number], y: [number, number]): [number, number] => [
    m(x[0], y[0]),
    m(x[1], y[1]),
  ]
  return {
    sway: m(a.sway, b.sway),
    down: m(a.down, b.down),
    lean: m(a.lean, b.lean),
    twist: m(a.twist, b.twist),
    head: m(a.head, b.head),
    look: m(a.look, b.look),
    armL: m2(a.armL, b.armL),
    armR: m2(a.armR, b.armR),
    armK: m2(a.armK, b.armK),
    tail: m(a.tail, b.tail),
    curl: m(a.curl, b.curl),
    eyes: m(a.eyes, b.eyes),
    mouth: m(a.mouth, b.mouth),
  }
}

const withPose = (o: Partial<Pose>): Pose => ({ ...REST, ...o })

// ---------- Übungen (t = 0…1 über einen Durchgang, zyklisch) ----------

export interface Exercise {
  id: string
  /** Anzahl Zwischenbilder (12–24). */
  frames: number
  /** Dauer in ms (4–6 s). */
  ms: number
  pose: (t: number) => Pose
}

const S = (t: number, k = 1, ph = 0) => Math.sin(2 * Math.PI * (k * t) + ph)
const C = (t: number, k = 1, ph = 0) => Math.cos(2 * Math.PI * (k * t) + ph)

export const EXERCISES: readonly Exercise[] = [
  {
    // 1. Body wave: Körper schwingt in einer Welle, ein Arm kreist über den Kopf, Schwanz schwingt mit, leicht zurückgebogen
    id: 'wave',
    frames: 20,
    ms: 5000,
    pose: (t) =>
      withPose({
        sway: 7 * S(t, 1, -0.5),
        lean: -6 + 9 * S(t, 1, 1.2),
        head: 12 * S(t, 1, 0.8),
        look: 0.3 * S(t, 1, 0.8),
        armL: [-14 + 6 * S(t, 1, 0.4), -10],
        armR: [360 * t - 8, 360 * t - 8],
        tail: 34 + 34 * S(t, 1, -1.2),
        curl: 18,
        mouth: 0.25,
      }),
  },
  {
    // 2. Body bounce („Boing Boing Boing“): ganzer Körper federt, Arme locker, Schwanz hängt
    id: 'bounce',
    frames: 14,
    ms: 5000,
    pose: (t) =>
      withPose({
        down: 10 * (0.5 - 0.5 * C(t)),
        lean: 2 * S(t, 2),
        head: 5 * S(t, 2, 0.6),
        armL: [-14 - 9 * C(t, 1, 0.8), -8 - 14 * C(t, 1, 0.8)],
        armR: [14 + 9 * C(t, 1, 0.8), 8 + 14 * C(t, 1, 0.8)],
        tail: 6 + 5 * C(t, 1, 1),
        curl: 6,
        eyes: 1 - 0.55 * (0.5 - 0.5 * C(t)),
        mouth: 0.45,
      }),
  },
  {
    // 3. Single arm raises: ein Arm gestreckt nach oben, Kopf schaut hin, unbeeindruckter Blick
    id: 'arm',
    frames: 16,
    ms: 5000,
    pose: (t) => {
      const up = ease(tri(t))
      return withPose({
        lean: -5 * up,
        head: 11 * up,
        look: 0.7 * up,
        armL: [-12, -8],
        armR: [lerp(12, 176, up), lerp(8, 176, up)],
        tail: 52,
        curl: 8,
        eyes: 0.5,
        mouth: 0.05,
      })
    },
  },
  {
    // 4. Body bounces with hip rotation: hüpft mit kreisender Hüfte, Schwanz peitscht
    id: 'hip',
    frames: 18,
    ms: 5000,
    pose: (t) =>
      withPose({
        sway: 9 * S(t),
        down: 7 * (0.5 - 0.5 * C(t, 2)),
        lean: -8 * S(t),
        twist: 0.35 * C(t),
        head: 7 * S(t, 1, 2),
        armL: [-30 - 12 * S(t, 1, 1), -22],
        armR: [30 + 12 * S(t, 1, 1), 22],
        tail: 24 + 64 * S(t, 1, 0.6),
        curl: 26,
        mouth: 0.4,
      }),
  },
  {
    // 5. Chest opener: Arme weit auseinander und wieder zusammen, Pfoten treffen vor der Brust, würdevoll halb geschlossene Augen
    id: 'chest',
    frames: 16,
    ms: 5000,
    pose: (t) => {
      const open = ease(tri(t))
      return withPose({
        head: -5 * open,
        armL: [lerp(-40, -98, open), lerp(150, -104, open)],
        armR: [lerp(40, 98, open), lerp(-150, 104, open)],
        armK: [lerp(0.86, 1, open), lerp(0.86, 1, open)],
        tail: 20,
        curl: 10,
        eyes: 0.45,
        mouth: 0.05,
      })
    },
  },
  {
    // 6. Straight arm trunk twist: gestreckte Arme, Oberkörper dreht sich, Kopf folgt, Füße fest
    id: 'twist',
    frames: 20,
    ms: 5000,
    pose: (t) => {
      const w = S(t)
      return withPose({
        twist: w,
        lean: 3 * w,
        head: -9 * w,
        look: 0.9 * w,
        armL: [-92 + 18 * w, -92 + 18 * w],
        armR: [92 + 18 * w, 92 + 18 * w],
        armK: [1 - 0.42 * Math.max(0, w), 1 - 0.42 * Math.max(0, -w)],
        tail: 30 - 20 * w,
        curl: 14,
        mouth: 0.2,
      })
    },
  },
  {
    // 7. Arm raises both arms (thump up): beide Arme über den Kopf, fallen mit einem „Thump“
    id: 'thump',
    frames: 14,
    ms: 5000,
    pose: (t) => {
      const rise = t < 0.62 ? ease(t / 0.62) : 1 - ease(Math.min(1, (t - 0.62) / 0.16))
      const hit = t > 0.78 && t < 0.92 ? Math.sin(((t - 0.78) / 0.14) * Math.PI) : 0
      return withPose({
        twist: 0.45,
        down: 9 * hit,
        lean: 5 * hit,
        head: -6 * rise + 6 * hit,
        look: 0.35,
        armL: [lerp(-12, -172, rise), lerp(-8, -172, rise)],
        armR: [lerp(12, 172, rise), lerp(8, 172, rise)],
        tail: 64,
        curl: 8,
        eyes: 1 - 0.5 * hit,
        mouth: 0.3 * rise,
      })
    },
  },
]

/** Letzte Pose vor dem Liegen / erste danach: schlaff nach vorn gesunken. */
export const SLUMP: Pose = withPose({
  down: 22,
  lean: 14,
  head: 18,
  armL: [-6, -4],
  armR: [6, 4],
  tail: -4,
  curl: 4,
  eyes: 0.25,
  mouth: 0.5,
})

// ---------- Figur (frontal aufrecht auf den Hinterbeinen) ----------

export type Layer = 'ink' | 'pencil'
export interface Frame {
  ink: string
  pencil: string
}

export interface Ink {
  pts: P[]
  /** Strich gehört zum geknickten Ohr (U-07). */
  knick?: boolean
  closed?: boolean
  gap?: boolean
  j?: number
}

/** Zwei-Knochen-Beugung: Gelenk zwischen `hip` und `foot` (Länge a, b), Knie nach `dir` (±1). */
function knee(hip: P, foot: P, a: number, b: number, dir: 1 | -1): P {
  const dx = foot[0] - hip[0]
  const dy = foot[1] - hip[1]
  const d = Math.min(Math.hypot(dx, dy), a + b - 0.5)
  const x = (a * a - b * b + d * d) / (2 * d)
  const h = Math.sqrt(Math.max(0, a * a - x * x))
  const ux = dx / Math.hypot(dx, dy)
  const uy = dy / Math.hypot(dx, dy)
  return [hip[0] + ux * x - uy * h * dir, hip[1] + uy * x + ux * h * dir]
}

/** Torso-Koordinaten (r = rechts, u = oben) → Bildkoordinaten. */
function frameOf(origin: P, leanDeg: number) {
  const a = leanDeg * DEG
  const r: P = [Math.cos(a), Math.sin(a)]
  const u: P = [Math.sin(a), -Math.cos(a)]
  return (x: number, y: number): P => [
    origin[0] + r[0] * x + u[0] * y,
    origin[1] + r[1] * x + u[1] * y,
  ]
}

interface Built {
  ink: Ink[]
  fur: P[][]
}

/** Zeichnet die stehende Coco für `pose` (Strichlisten in Bildkoordinaten, ohne Zittern). */
export function standing(pose: Pose): Built {
  const ink: Ink[] = []
  const fur: P[][] = []
  const tw = 1 - 0.3 * Math.abs(pose.twist)
  const pelvis: P = [100 + pose.sway, 180 + pose.down * 0.62]
  const T = frameOf(pelvis, pose.lean)
  // Torso-Koordinaten: breit und kurz wie ein Hund auf den Hinterbeinen (x ×1,2, y ×0,85)
  const sh = (x: number, y: number) => T(x * 1.2 * tw + pose.twist * 6, y * 0.85)
  const sideL: [number, number][] = [
    [-17, 0],
    [-17, 12],
    [-15, 26],
    [-16, 42],
    [-20, 55],
    [-22, 62],
  ]
  const sideR: [number, number][] = sideL.map(([x, y]) => [-x, y])
  ink.push({ pts: sideL.map(([x, y]) => sh(x, y)), gap: true })
  ink.push({ pts: sideR.map(([x, y]) => sh(x, y)), gap: true })
  // Brust: heller Latz mit Zacken (Fellkragen wie bei Juttas Koko), Bauchbogen
  ink.push({ pts: [sh(-10, 52), sh(-6, 40), sh(0, 46), sh(6, 38), sh(10, 52)], j: 0.6 })
  ink.push({ pts: [sh(-13, 6), sh(-6, 0), sh(6, 0), sh(13, 7)], j: 0.7 })
  fur.push([
    sh(-22, 62),
    sh(-16, 42),
    sh(-15, 26),
    sh(-17, 12),
    sh(-17, 0),
    sh(-9, 0),
    sh(-9, 24),
    sh(-9, 44),
    sh(-11, 58),
  ])
  fur.push([
    sh(22, 62),
    sh(16, 42),
    sh(15, 26),
    sh(17, 12),
    sh(17, 0),
    sh(9, 0),
    sh(9, 24),
    sh(9, 44),
    sh(11, 58),
  ])
  const S0 = sh(0, 58)
  // Kopf (1,45-fach): rund, große Ohren, Seitenblick
  const hs = 1.45
  const hAng = pose.lean + pose.head
  const H = add(S0, mul([Math.sin(hAng * DEG), -Math.cos(hAng * DEG)], 31))
  const Hf0 = frameOf(H, hAng)
  const Hf = (x: number, y: number): P => Hf0(x * hs, -y * hs) // Kopf-Koordinaten: y nach unten
  const lk = pose.look
  const face = (x: number, y: number): P => Hf(x + lk * 4, y)
  const skull = [
    [-24, 4],
    [-25, -8],
    [-19, -19],
    [-8, -24],
    [4, -25],
    [16, -21],
    [24, -11],
    [25, 2],
    [20, 14],
  ]
  ink.push({ pts: skull.map(([x, y]) => Hf(x!, y!)), gap: true })
  ink.push({
    pts: [
      [-17, 15],
      [-8, 22],
      [3, 24],
      [13, 20],
      [19, 14],
    ].map(([x, y]) => Hf(x!, y!)),
    j: 0.7,
  })
  // Schnauze, Nase (dick, gefüllt), Mund wie in Juttas „Oh“-Skizze
  ink.push({
    pts: [
      [-8, 5],
      [-9, 11],
      [-4, 15],
      [5, 15],
      [10, 10],
      [8, 4],
    ].map(([x, y]) => face(x!, y!)),
    j: 0.6,
  })
  ink.push({ pts: blob(face(0, 5), 4.8 * hs, 3.6 * hs, -6, 6), closed: true, j: 0.2 })
  const mo = pose.mouth
  ink.push({
    pts: [
      [0, 9],
      [0, 12],
      [-5, 14.5 + mo * 3],
      [-8, 12.5 + mo * 2],
    ].map(([x, y]) => face(x!, y!)),
    j: 0.5,
  })
  ink.push({
    pts: [
      [0, 12],
      [5, 14.5 + mo * 3],
      [8, 12.5 + mo * 2],
    ].map(([x, y]) => face(x!, y!)),
    j: 0.5,
  })
  if (mo > 0.4)
    ink.push({
      pts: [
        [-3, 14.5 + mo * 3],
        [-2, 19 + mo * 4],
        [3, 20 + mo * 4],
        [4, 14.5 + mo * 3],
      ].map(([x, y]) => face(x!, y!)),
      j: 0.4,
    })
  const eye = (ex: number, fl: number) => {
    const c = face(ex, -5)
    if (pose.eyes < 0.18) {
      ink.push({
        pts: [face(ex - 6, -4), face(ex - 2, -1), face(ex + 3, -1), face(ex + 6, -4)],
        j: 0.4,
      })
      return
    }
    ink.push({ pts: blob(c, 6.4 * hs, 5.8 * hs * (0.55 + 0.45 * pose.eyes) + 0.4, fl, 8), j: 0.3 })
    ink.push({
      pts: blob(add(c, [lk * 2.6 + 1.4, 0.4]), 3.1 * hs, 3.1 * hs * (0.6 + 0.4 * pose.eyes), 0, 6),
      closed: true,
      j: 0.15,
    })
  }
  eye(-10.5, -8)
  eye(10.5, 8)
  // Ohren: Bild links = Cocos rechtes Ohr, immer geknickt (U-07); Bild rechts aufrecht, beide groß
  const earAt = (x: number): P => Hf(x, -17)
  const ek = knickEarPts(30, -16 + hAng)
  const ekOuter = ek.outer.map(([x, y]): P => add(earAt(-15), [x * 1.15, y * 1.15]))
  ink.push({ pts: ekOuter, j: 0.4, knick: true })
  ink.push({
    pts: ek.inner.map(([x, y]): P => add(earAt(-15), [x * 1.15, y * 1.15])),
    j: 0.5,
    knick: true,
  })
  fur.push(ekOuter)
  const eu = earPts(33, 14 + hAng).map(([x, y]): P => add(earAt(15), [x * 1.15, y * 1.15]))
  ink.push({ pts: eu, j: 0.4 })
  fur.push(eu)
  fur.push(
    [
      [-24, 2],
      [-24, -8],
      [-18, -19],
      [-8, -24],
      [4, -25],
      [14, -21],
      [20, -13],
      [10, -13],
      [0, -9],
      [-10, -10],
      [-18, -4],
    ].map(([x, y]) => Hf(x!, y!)),
  )
  // Arme (kurze Vorderbeine mit Pfoten)
  const shoulderL = sh(-19, 54)
  const shoulderR = sh(19, 54)
  const A1 = 21
  const A2 = 20
  const armSegs = (a: [number, number], k: number): [number, number][] => [
    [A1 * k, a[0]],
    [A2 * k, a[1]],
  ]
  ink.push({ pts: leg(shoulderL, armSegs(pose.armL, pose.armK[0]), 1, 9, 5.5), j: 0.5 })
  ink.push({ pts: leg(shoulderR, armSegs(pose.armR, pose.armK[1]), 1, 9, 5.5), j: 0.5 })
  const armTop = (sp: P, a: number, k: number): P[] => {
    const e = add(sp, [Math.sin(a * DEG) * A1 * k, Math.cos(a * DEG) * A1 * k])
    const n: P = [Math.cos(a * DEG) * 4.5, -Math.sin(a * DEG) * 4.5]
    return [add(sp, n), add(e, n), add(e, mul(n, -1)), add(sp, mul(n, -1))]
  }
  fur.push(armTop(shoulderL, pose.armL[0], pose.armK[0]))
  fur.push(armTop(shoulderR, pose.armR[0], pose.armK[1]))
  // Beine: Zwei-Knochen-Beugung (Sprunggelenk), Pfoten nach außen, Füße fest am Boden
  for (const s of [-1, 1] as const) {
    const hip = add(T(s * 14, 6), [0, 4])
    const foot: P = [100 + s * 22, GROUND - 3]
    const k = knee(hip, foot, 30, 30, s === -1 ? 1 : -1)
    const w = 8
    ink.push({
      pts: [
        add(hip, [s * w, 0]),
        add(k, [s * (w + 3), 0]),
        add(foot, [s * (w - 2), -5]),
        add(foot, [s * 15, 2]),
        add(foot, [s * 4, 3]),
        add(foot, [-s * 6, -3]),
      ],
      j: 0.5,
    })
    ink.push({
      pts: [add(hip, [-s * w * 0.6, 4]), add(k, [-s * 5, 0]), add(foot, [-s * 6, -5])],
      j: 0.6,
    })
    ink.push({ pts: [add(foot, [s * 8, 0]), add(foot, [s * 10, 3])], j: 0.2 })
    ink.push({ pts: [add(foot, [s * 3, 1]), add(foot, [s * 4, 4])], j: 0.2 })
    fur.push([
      add(hip, [s * w, -2]),
      add(k, [s * (w + 3), 0]),
      add(k, [-s * 4, 0]),
      add(hip, [-s * w * 0.4, 2]),
    ])
  }
  // Schwanz hinter der Hüfte (buschig)
  const tb = T(16, 8)
  const centre: P[] = [tb]
  let ang = pose.tail
  let cur = tb
  for (let i = 0; i < 4; i++) {
    cur = add(cur, [Math.sin(ang * DEG) * 15, -Math.cos(ang * DEG) * 12])
    centre.push(cur)
    ang += pose.curl
  }
  const tl = tailOutline(centre, 14)
  ink.push({ pts: tl.line, j: 0.7 })
  fur.push(tl.fill)
  return { ink, fur }
}

/** Erschöpft flach ausgestreckt am Boden (Schlussbild): Zunge seitlich, Augen zu, Schwanz hängt. */
export function lying(t: number): Built {
  const b = 0.8 * Math.sin(2 * Math.PI * t)
  const w = Math.sin(2 * Math.PI * t + 1)
  const ink: Ink[] = []
  const fur: P[][] = []
  const g = GROUND
  // Rücken (offen), Bauchlinie am Boden
  ink.push({
    pts: [
      [56, g - 8 - b],
      [70, g - 20 - b],
      [92, g - 25 - b],
      [116, g - 22 - b],
      [132, g - 16 - b],
    ],
    gap: true,
  })
  ink.push({
    pts: [
      [62, g - 2],
      [88, g - 4],
      [118, g - 3],
      [138, g - 5],
    ],
    j: 0.6,
  })
  // Hinterteil/Schenkel nach hinten gestreckt
  ink.push({
    pts: [
      [56, g - 8],
      [44, g - 9],
      [26, g - 7],
      [14, g - 5],
      [10, g - 2],
    ],
    j: 0.6,
  })
  ink.push({
    pts: [
      [60, g - 2],
      [44, g - 2],
      [26, g - 2],
      [12, g],
    ],
    j: 0.6,
  })
  ink.push({
    pts: [
      [10, g - 2],
      [8, g - 6],
      [14, g - 8],
    ],
    j: 0.3,
  })
  // Vorderbeine nach vorn gestreckt (Pfoten übereinander)
  ink.push({
    pts: [
      [132, g - 10],
      [152, g - 8],
      [172, g - 7],
      [186, g - 6],
      [190, g - 2],
      [182, g],
    ],
    j: 0.5,
  })
  ink.push({
    pts: [
      [130, g - 3],
      [152, g - 2],
      [176, g - 1],
      [186, g - 1],
    ],
    j: 0.5,
  })
  ink.push({
    pts: [
      [176, g - 6],
      [178, g - 2],
    ],
    j: 0.2,
  })
  ink.push({
    pts: [
      [182, g - 6],
      [184, g - 2],
    ],
    j: 0.2,
  })
  // Schwanz hängt über den Boden
  const tail = tailOutline(
    [
      [58, g - 10],
      [44, g - 14],
      [30, g - 12],
      [20, g - 8],
    ],
    9,
  )
  ink.push({ pts: tail.line, j: 0.6 })
  // Kopf flach auf den Pfoten, Seitenansicht nach rechts: Schädel, Schnauze, Zunge, geschlossenes Auge, Ohr geknickt
  const hx = 150
  const hy = g - 30 - b * 0.6
  ink.push({
    pts: [
      [hx - 22, hy + 20],
      [hx - 25, hy + 6],
      [hx - 16, hy - 8],
      [hx - 2, hy - 12],
      [hx + 12, hy - 6],
    ],
    gap: true,
  })
  ink.push({
    pts: [
      [hx + 12, hy - 6],
      [hx + 26, hy - 2],
      [hx + 34, hy + 4],
      [hx + 32, hy + 12],
      [hx + 20, hy + 17],
    ],
    j: 0.5,
  })
  ink.push({
    pts: [
      [hx - 14, hy + 22],
      [hx, hy + 22],
      [hx + 14, hy + 19],
    ],
    j: 0.5,
  })
  ink.push({ pts: blob([hx + 33, hy + 5], 3.4, 2.8, -10, 6), closed: true, j: 0.2 })
  ink.push({
    pts: [
      [hx + 28, hy + 12],
      [hx + 20, hy + 14],
      [hx + 12, hy + 12],
    ],
    j: 0.5,
  })
  // Zunge seitlich heraus
  ink.push({
    pts: [
      [hx + 18, hy + 14],
      [hx + 19, hy + 22 + w],
      [hx + 12, hy + 25 + w],
      [hx + 9, hy + 15],
    ],
    j: 0.4,
  })
  // Auge geschlossen (Bogen), Ohr geknickt (hinteres, flach nach hinten)
  ink.push({
    pts: [
      [hx + 4, hy - 1],
      [hx + 9, hy + 3],
      [hx + 16, hy + 1],
    ],
    j: 0.3,
  })
  const e = knickEarPts(24, -64)
  ink.push({ pts: e.outer.map(([x, y]): P => add([hx - 12, hy - 8], [x, y])), j: 0.4, knick: true })
  ink.push({ pts: e.inner.map(([x, y]): P => add([hx - 12, hy - 8], [x, y])), j: 0.5, knick: true })
  fur.push([
    [56, g - 8],
    [70, g - 20],
    [92, g - 25],
    [116, g - 22],
    [132, g - 16],
    [120, g - 12],
    [92, g - 14],
    [70, g - 10],
  ])
  fur.push([
    [56, g - 8],
    [26, g - 7],
    [14, g - 5],
    [26, g - 2],
    [60, g - 2],
  ])
  fur.push(tail.fill)
  fur.push([
    [hx - 22, hy + 20],
    [hx - 25, hy + 6],
    [hx - 16, hy - 8],
    [hx - 2, hy - 12],
    [hx + 6, hy - 3],
    [hx - 4, hy + 2],
    [hx - 12, hy + 12],
  ])
  return { ink, fur }
}

// ---------- Zeichnen: Tuschelinie mit Zittern, Buntstift-Schraffur mit Körnung ----------

/** Bodenlinie: dicker, mehrfach übermalter Tuschestrich. */
function ground(rand: () => number): Ink[] {
  const y = GROUND
  const line = (dy: number, x0: number, x1: number): Ink => ({
    pts: [x0, lerp(x0, x1, 0.33), lerp(x0, x1, 0.66), x1].map(
      (x) => [x, y + dy + (rand() - 0.5) * 1.6] as P,
    ),
    j: 0.4,
  })
  return [line(0, 18, 184), line(1.8, 26, 176), line(-1.2, 40, 160)]
}

/** Schraffur eines Polygons: Linien unter `deg`, Abstand `gap`, Scanline-Schnitt, je Bild versetzt und gewellt. */
export function hatch(
  poly: readonly P[],
  rand: () => number,
  deg = 58,
  gap = 3.6,
): [number, number, number, number][] {
  const a = -deg * DEG
  const rot = (p: P): P => [
    p[0] * Math.cos(a) - p[1] * Math.sin(a),
    p[0] * Math.sin(a) + p[1] * Math.cos(a),
  ]
  const back = (p: P): P => [
    p[0] * Math.cos(-a) - p[1] * Math.sin(-a),
    p[0] * Math.sin(-a) + p[1] * Math.cos(-a),
  ]
  const q = poly.map(rot)
  const ys = q.map((p) => p[1])
  const y0 = Math.min(...ys)
  const y1 = Math.max(...ys)
  const out: [number, number, number, number][] = []
  for (let y = y0 + rand() * gap; y < y1; y += gap * (0.85 + rand() * 0.3)) {
    const xs: number[] = []
    for (let i = 0; i < q.length; i++) {
      const p = q[i]!
      const n = q[(i + 1) % q.length]!
      if ((p[1] <= y && n[1] > y) || (n[1] <= y && p[1] > y))
        xs.push(lerp(p[0], n[0], (y - p[1]) / (n[1] - p[1])))
    }
    xs.sort((m, n) => m - n)
    for (let i = 0; i + 1 < xs.length; i += 2) {
      const l = xs[i + 1]! - xs[i]!
      if (l < 1.6) continue
      const s = xs[i]! + l * rand() * 0.12
      const e = xs[i + 1]! - l * rand() * 0.12
      const A = back([s, y])
      const B = back([e, y + (rand() - 0.5) * 1.2])
      out.push([A[0], A[1], B[0], B[1]])
    }
  }
  return out
}

const r1 = (n: number) => Math.round(n * 2) / 2

/** Pfad der Schraffur: `M x y l dx dy` mit halben Einheiten; Körnung über unregelmäßige Segmente (Papier). */
function pencilPath(segs: [number, number, number, number][]): string {
  let d = ''
  let px = 0
  let py = 0
  for (const [x0, y0, x1, y1] of segs) {
    const ax = r1(x0)
    const ay = r1(y0)
    d += `m${r1(ax - px)} ${r1(ay - py)}l${r1(x1 - x0)} ${r1(y1 - y0)}`
    px = ax + r1(x1 - x0)
    py = ay + r1(y1 - y0)
  }
  return d.replace(/^m/, 'M')
}

/** Ein fertiges Bild: Tusche (je Strich neu nachgezogen) + Buntstift. */
export function drawFrame(built: Built, seed: number): Frame {
  const rand = mulberry32(seed)
  const inkD: string[] = []
  for (const s of [...built.ink, ...ground(rand)]) {
    const pts = retrace(s.pts, rand, (s.j ?? 1) * 0.9)
    if (s.gap && pts.length > 4 && rand() < 0.85) {
      // Absetzer: Strich an einer Stelle unterbrechen (offene Kontur)
      const cut = 1 + Math.floor(rand() * (pts.length - 3))
      inkD.push(toPath(pts.slice(0, cut + 1), false, true), toPath(pts.slice(cut + 1), false, true))
    } else inkD.push(toPath(pts, !!s.closed, s.pts.length > 7))
  }
  const segs = built.fur.flatMap((poly) => hatch(poly, rand))
  return { ink: inkD.filter(Boolean).join(''), pencil: pencilPath(segs) }
}

// ---------- Folge ----------

export interface FitnessData {
  v: number
  w: number
  h: number
  /** Anzeigedauer je Bild (ms). */
  f: number
  /** Übungen in Reihenfolge (Schleife), danach wieder von vorn. */
  ex: { id: string; ms: number; fr: string[] }[]
  /** Übergang vor der Übung `ex[i]` (3–4 Bilder, weich). */
  tr: string[][]
}

const pack = (f: Frame) => `${f.ink}|${f.pencil}`

export function buildFitness(): { data: FitnessData; still: Frame } {
  const ex: FitnessData['ex'] = []
  const lyingEx = { id: 'lying', frames: 12, ms: 5000 }
  let n = 0
  for (const e of EXERCISES)
    ex.push({
      id: e.id,
      ms: e.ms,
      fr: Array.from({ length: e.frames }, (_, k) =>
        pack(drawFrame(standing(e.pose(k / e.frames)), 1000 * ++n + k)),
      ),
    })
  ex.push({
    id: lyingEx.id,
    ms: lyingEx.ms,
    fr: Array.from({ length: lyingEx.frames }, (_, k) =>
      pack(drawFrame(lying(k / lyingEx.frames), 90000 + k)),
    ),
  })
  // Übergänge vor jeder Übung: aus der Endpose der vorigen in die Startpose der nächsten
  const startPose = (i: number): Pose => EXERCISES[i]!.pose(0)
  const endPose = (i: number): Pose => EXERCISES[i]!.pose(1 - 1 / EXERCISES[i]!.frames)
  const tr: string[][] = []
  const total = EXERCISES.length
  for (let i = 0; i <= total; i++) {
    // Übergang VOR Übung i; Übung `total` ist das Liegen; vor Übung 0 kommt die Folge aus dem Liegen
    const frames: Frame[] = []
    if (i === 0) {
      for (const [k, t] of [0.35, 0.7, 0.9].entries())
        frames.push(drawFrame(standing(mix(SLUMP, startPose(0), ease(t))), 70000 + k))
    } else if (i === total) {
      for (const [k, t] of [0.4, 0.8].entries())
        frames.push(drawFrame(standing(mix(endPose(total - 1), SLUMP, ease(t))), 71000 + k))
      frames.push(drawFrame(standing({ ...SLUMP, down: 30, lean: 22, eyes: 0.1 }), 71010))
    } else {
      for (const [k, t] of [0.25, 0.5, 0.75].entries())
        frames.push(
          drawFrame(standing(mix(endPose(i - 1), startPose(i), ease(t))), 72000 + 10 * i + k),
        )
    }
    tr.push(frames.map(pack))
  }
  const still = drawFrame(standing(EXERCISES[2]!.pose(0.5)), 4242)
  return { data: { v: FITNESS_VERSION, w: FITNESS_W, h: FITNESS_H, f: FRAME_MS, ex, tr }, still }
}

/** Dauer einer vollen Schleife in ms (Übungen + Übergänge). */
export function loopMs(d: FitnessData): number {
  return d.ex.reduce((n, e) => n + e.ms, 0) + d.tr.reduce((n, t) => n + t.length * d.f, 0)
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const { data, still } = buildFitness()
  const json = JSON.stringify(data)
  mkdirSync('public/art', { recursive: true })
  writeFileSync(FITNESS_JSON, json)
  writeFileSync(FITNESS_STILL, stillSvg(still))
  const gz = gzipSync(json, { level: 9 }).length
  const frames =
    data.ex.reduce((n, e) => n + e.fr.length, 0) + data.tr.reduce((n, t) => n + t.length, 0)
  console.log(
    `art:fitness: ${FITNESS_JSON} ${json.length} B roh / ${gz} B gz (${frames} Bilder, Schleife ${(loopMs(data) / 1000).toFixed(1)} s, Budget ${BUDGET_GZ} B gz), ${FITNESS_STILL}.`,
  )
}
